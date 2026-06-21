from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import InventoryTransaction, Product
from app.schemas import InventoryAdjustmentCreate, InventoryTransactionRead, ProductRead
from app.services import adjust_inventory

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/transactions", response_model=list[InventoryTransactionRead])
def list_transactions(
    product_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
):
    query = (
        select(InventoryTransaction)
        .options(selectinload(InventoryTransaction.product))
        .order_by(InventoryTransaction.created_at.desc())
    )
    if product_id:
        query = query.where(InventoryTransaction.product_id == product_id)
    return db.execute(query).scalars().all()


@router.post("/adjustments", response_model=ProductRead)
def create_inventory_adjustment(payload: InventoryAdjustmentCreate, db: Session = Depends(get_db)):
    product = adjust_inventory(db, payload)
    db.commit()
    db.refresh(product)
    return product


@router.get("/low-stock", response_model=list[ProductRead])
def low_stock_products(db: Session = Depends(get_db)):
    return db.execute(
        select(Product).where(Product.quantity_in_stock <= Product.reorder_level).order_by(Product.quantity_in_stock.asc())
    ).scalars().all()
