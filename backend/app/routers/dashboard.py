from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Customer, Order, OrderItem, OrderStatus, Product
from app.schemas import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    total_products = db.scalar(select(func.count()).select_from(Product)) or 0
    total_customers = db.scalar(select(func.count()).select_from(Customer)) or 0
    active_orders = db.scalar(
        select(func.count()).select_from(Order).where(Order.status == OrderStatus.CREATED)
    ) or 0
    total_stock_units = db.scalar(select(func.coalesce(func.sum(Product.quantity_in_stock), 0))) or 0
    low_stock_products = db.scalar(
        select(func.count()).select_from(Product).where(Product.quantity_in_stock <= Product.reorder_level)
    ) or 0
    low_stock_items = db.execute(
        select(Product)
        .where(Product.quantity_in_stock <= Product.reorder_level)
        .order_by(Product.quantity_in_stock.asc())
        .limit(8)
    ).scalars().all()
    recent_orders = (
        db.execute(
            select(Order)
            .options(selectinload(Order.customer), selectinload(Order.items).selectinload(OrderItem.product))
            .order_by(Order.created_at.desc())
            .limit(6)
        )
        .scalars()
        .all()
    )
    return DashboardSummary(
        total_products=total_products,
        total_customers=total_customers,
        active_orders=active_orders,
        low_stock_products=low_stock_products,
        total_stock_units=total_stock_units,
        low_stock_items=low_stock_items,
        recent_orders=recent_orders,
    )
