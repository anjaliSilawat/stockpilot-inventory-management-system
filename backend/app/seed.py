from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Customer, InventoryTransaction, InventoryTransactionType, Product


def seed_database(db: Session) -> None:
    has_products = db.execute(select(Product.id).limit(1)).first()
    if has_products:
        return

    products = [
        Product(
            sku="CAP-500-BLU",
            name="Hydration Capsule 500 ml",
            description="BPA-free reusable bottle for daily hydration.",
            unit_price=Decimal("499.00"),
            quantity_in_stock=32,
            reorder_level=10,
        ),
        Product(
            sku="CAP-THERM-01",
            name="Thermal Bottle Sleeve",
            description="Insulated protective sleeve for 500 ml bottle.",
            unit_price=Decimal("299.00"),
            quantity_in_stock=8,
            reorder_level=10,
        ),
        Product(
            sku="CAP-STRW-SET",
            name="Reusable Straw Set",
            description="Set of four stainless steel straws with cleaning brush.",
            unit_price=Decimal("199.00"),
            quantity_in_stock=45,
            reorder_level=15,
        ),
        Product(
            sku="CAP-LID-SPORT",
            name="Sport Lid Replacement",
            description="Leak-resistant sport lid compatible with StockPilot bottles.",
            unit_price=Decimal("249.00"),
            quantity_in_stock=5,
            reorder_level=8,
        ),
    ]
    customers = [
        Customer(name="Ananya Sharma", email="ananya.sharma@example.com", phone="9876543210", address="Gurugram, Haryana"),
        Customer(name="Rohan Mehta", email="rohan.mehta@example.com", phone="9876501234", address="New Delhi, Delhi"),
        Customer(name="Priya Nair", email="priya.nair@example.com", phone="9876512345", address="Noida, Uttar Pradesh"),
    ]
    db.add_all(products + customers)
    db.flush()

    for product in products:
        db.add(
            InventoryTransaction(
                product_id=product.id,
                transaction_type=InventoryTransactionType.OPENING_STOCK,
                quantity_change=product.quantity_in_stock,
                note="Initial seeded stock",
            )
        )
    db.commit()
