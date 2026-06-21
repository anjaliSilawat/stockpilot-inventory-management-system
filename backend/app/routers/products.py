from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import InventoryTransaction, InventoryTransactionType, OrderItem, Product
from app.schemas import ProductCreate, ProductRead, ProductUpdate

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=list[ProductRead])
def list_products(q: str | None = Query(default=None, max_length=100), db: Session = Depends(get_db)):
    query = select(Product).order_by(Product.created_at.desc())
    if q:
        phrase = f"%{q.strip()}%"
        query = query.where(or_(Product.name.ilike(phrase), Product.sku.ilike(phrase)))
    return db.execute(query).scalars().all()


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = Product(**payload.model_dump())
    db.add(product)
    try:
        db.flush()
        db.add(
            InventoryTransaction(
                product_id=product.id,
                transaction_type=InventoryTransactionType.OPENING_STOCK,
                quantity_change=product.quantity_in_stock,
                note="Opening stock recorded when product was created",
            )
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A product with this SKU already exists")
    db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductRead)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product


@router.patch("/{product_id}", response_model=ProductRead)
def update_product(product_id: int, payload: ProductUpdate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(product, key, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A product with this SKU already exists")
    db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    is_used_in_order = db.execute(select(OrderItem.id).where(OrderItem.product_id == product_id).limit(1)).first()
    if is_used_in_order:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This product cannot be deleted because it is referenced by an order",
        )
    # Products that have never been ordered may be removed along with their initial/manual audit rows.
    # Ordered products remain immutable to protect historical order records.
    db.execute(delete(InventoryTransaction).where(InventoryTransaction.product_id == product_id))
    db.delete(product)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
