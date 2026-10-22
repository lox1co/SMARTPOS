from sqlalchemy import Column, Integer, String, DECIMAL, ForeignKey, DateTime, func, Text, UniqueConstraint, ForeignKeyConstraint, Boolean
from sqlalchemy.orm import relationship
from database import Base

class Store(Base):
    __tablename__ = "stores"

    id = Column(String(100), primary_key=True, index=True)  # e.g. 'DEMO-1001'
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)
    phone = Column(String(50), nullable=False)
    email = Column(String(255), nullable=True)
    gst_number = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    tax_enabled = Column(Boolean, default=True, nullable=False)
    tax_rate = Column(DECIMAL(5, 2), default=8.00, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    users = relationship("User", back_populates="store", cascade="all, delete-orphan")
    products = relationship("Product", back_populates="store", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="store", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="store", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String(100), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    email_or_username = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="cashier")  # owner, manager, cashier
    phone = Column(String(50), nullable=True)
    image = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    store = relationship("Store", back_populates="users")
    transactions = relationship("Transaction", back_populates="cashier")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String(100), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    sku = Column(String(100), index=True, nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False)
    cost_price = Column(DECIMAL(10, 2), nullable=False)
    stock = Column(DECIMAL(10, 3), nullable=False, default=0.000)
    low_stock_alert = Column(DECIMAL(10, 3), nullable=False, default=5.000)
    category = Column(String(100), nullable=False)
    unit = Column(String(50), nullable=True, default="pcs")
    tax_rate = Column(DECIMAL(5, 2), nullable=False, default=8.00)
    image = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint('store_id', 'sku', name='unique_store_sku'),)

    store = relationship("Store", back_populates="products")


class Transaction(Base):
    __tablename__ = "transactions"

    store_id = Column(String(100), ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True)
    invoice_number = Column(String(100), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    payment_method = Column(String(50), nullable=False, default="CASH")  # CASH, UPI, CARD
    payment_status = Column(String(50), nullable=False, default="PAID")
    subtotal = Column(DECIMAL(10, 2), nullable=False)
    discount = Column(DECIMAL(10, 2), nullable=False, default=0.00)
    tax = Column(DECIMAL(10, 2), nullable=False)
    total = Column(DECIMAL(10, 2), nullable=False)
    # Optional customer link (for credit / khata sales). customer_id is a soft
    # link; customer_name/phone are denormalized onto the bill for receipts.
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    customer_name = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    store = relationship("Store", back_populates="transactions")
    cashier = relationship("User", back_populates="transactions")
    items = relationship(
        "TransactionItem",
        back_populates="transaction",
        cascade="all, delete-orphan",
        primaryjoin="and_(Transaction.store_id==TransactionItem.store_id, Transaction.invoice_number==TransactionItem.invoice_number)"
    )


class TransactionItem(Base):
    __tablename__ = "transaction_items"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String(100), nullable=False)
    invoice_number = Column(String(100), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    product_name = Column(String(255), nullable=False)
    quantity = Column(DECIMAL(10, 3), nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False)

    __table_args__ = (
        ForeignKeyConstraint(
            ['store_id', 'invoice_number'],
            ['transactions.store_id', 'transactions.invoice_number'],
            ondelete='CASCADE'
        ),
    )

    transaction = relationship(
        "Transaction",
        back_populates="items",
        primaryjoin="and_(Transaction.store_id==TransactionItem.store_id, Transaction.invoice_number==TransactionItem.invoice_number)"
    )
    product = relationship("Product")


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String(100), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    # Positive credit_balance => the customer owes the shop (udhaar / khata).
    credit_balance = Column(DECIMAL(10, 2), nullable=False, default=0.00)
    created_at = Column(DateTime, server_default=func.now())

    # A customer name is unique within a store so credit sales can find-or-create
    # deterministically at checkout.
    __table_args__ = (UniqueConstraint('store_id', 'name', name='unique_store_customer_name'),)

    store = relationship("Store", back_populates="customers")
    entries = relationship(
        "CreditEntry",
        back_populates="customer",
        cascade="all, delete-orphan",
    )


class CreditEntry(Base):
    __tablename__ = "credit_entries"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(String(100), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    customer_id = Column(Integer, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False)
    # DEBIT = bought on credit (owes more); CREDIT = repayment received.
    entry_type = Column(String(10), nullable=False)
    amount = Column(DECIMAL(10, 2), nullable=False)
    note = Column(Text, nullable=True)
    invoice_number = Column(String(100), nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    customer = relationship("Customer", back_populates="entries")
