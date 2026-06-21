from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Order, OrderItem
from app.schemas import OrderCreate, OrderRead
from app.services import cancel_order, create_order, get_order_or_404

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("", response_model=list[OrderRead])
def list_orders(db: Session = Depends(get_db)):
    orders = (
        db.execute(
            select(Order)
            .options(selectinload(Order.customer), selectinload(Order.items).selectinload(OrderItem.product))
            .order_by(Order.created_at.desc())
        )
        .scalars()
        .all()
    )
    return orders


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
def create_new_order(payload: OrderCreate, db: Session = Depends(get_db)):
    try:
        order = create_order(db, payload)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    return get_order_or_404(db, order.id)


@router.get("/{order_id}", response_model=OrderRead)
def get_order(order_id: int, db: Session = Depends(get_db)):
    return get_order_or_404(db, order_id)


@router.post("/{order_id}/cancel", response_model=OrderRead)
def cancel_existing_order(order_id: int, db: Session = Depends(get_db)):
    try:
        order = cancel_order(db, order_id)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise
    return get_order_or_404(db, order.id)
