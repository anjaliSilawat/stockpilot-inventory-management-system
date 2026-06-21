from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Customer,
    InventoryTransaction,
    InventoryTransactionType,
    Order,
    OrderItem,
    OrderStatus,
    Product,
)
from app.schemas import InventoryAdjustmentCreate, OrderCreate


def create_order(db: Session, payload: OrderCreate) -> Order:
    customer = db.get(Customer, payload.customer_id)
    if customer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

    product_ids = [item.product_id for item in payload.items]
    products = (
        db.execute(select(Product).where(Product.id.in_(product_ids)).with_for_update())
        .scalars()
        .all()
    )
    products_by_id = {product.id: product for product in products}
    missing_ids = sorted(set(product_ids) - set(products_by_id))
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product(s) not found: {', '.join(map(str, missing_ids))}",
        )

    insufficient = []
    for item in payload.items:
        product = products_by_id[item.product_id]
        if product.quantity_in_stock < item.quantity:
            insufficient.append(
                f"{product.name} (available: {product.quantity_in_stock}, requested: {item.quantity})"
            )
    if insufficient:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Insufficient stock for: " + "; ".join(insufficient),
        )

    order = Order(customer_id=customer.id, notes=payload.notes, status=OrderStatus.CREATED, total_amount=Decimal("0.00"))
    db.add(order)
    db.flush()

    total = Decimal("0.00")
    for item in payload.items:
        product = products_by_id[item.product_id]
        line_total = product.unit_price * item.quantity
        total += line_total

        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity=item.quantity,
                unit_price=product.unit_price,
            )
        )
        product.quantity_in_stock -= item.quantity
        db.add(
            InventoryTransaction(
                product_id=product.id,
                order_id=order.id,
                transaction_type=InventoryTransactionType.ORDER_OUT,
                quantity_change=-item.quantity,
                note=f"Stock reserved for order #{order.id}",
            )
        )

    order.total_amount = total
    db.flush()
    return get_order_or_404(db, order.id)


def cancel_order(db: Session, order_id: int) -> Order:
    order = (
        db.execute(
            select(Order)
            .where(Order.id == order_id)
            .options(selectinload(Order.items).selectinload(OrderItem.product))
            .with_for_update()
        )
        .scalars()
        .first()
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Order is already cancelled")

    for item in order.items:
        product = db.execute(select(Product).where(Product.id == item.product_id).with_for_update()).scalar_one()
        product.quantity_in_stock += item.quantity
        db.add(
            InventoryTransaction(
                product_id=product.id,
                order_id=order.id,
                transaction_type=InventoryTransactionType.RETURN_IN,
                quantity_change=item.quantity,
                note=f"Stock restored after cancellation of order #{order.id}",
            )
        )
    order.status = OrderStatus.CANCELLED
    db.flush()
    return get_order_or_404(db, order.id)


def adjust_inventory(db: Session, payload: InventoryAdjustmentCreate) -> Product:
    product = (
        db.execute(select(Product).where(Product.id == payload.product_id).with_for_update())
        .scalars()
        .first()
    )
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    proposed_stock = product.quantity_in_stock + payload.quantity_change
    if proposed_stock < 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Adjustment would make stock negative. Current stock: {product.quantity_in_stock}",
        )

    product.quantity_in_stock = proposed_stock
    db.add(
        InventoryTransaction(
            product_id=product.id,
            transaction_type=InventoryTransactionType.MANUAL_ADJUSTMENT,
            quantity_change=payload.quantity_change,
            note=payload.note,
        )
    )
    db.flush()
    return product


def get_order_or_404(db: Session, order_id: int) -> Order:
    order = (
        db.execute(
            select(Order)
            .where(Order.id == order_id)
            .options(
                selectinload(Order.customer),
                selectinload(Order.items).selectinload(OrderItem.product),
            )
        )
        .scalars()
        .first()
    )
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    return order
