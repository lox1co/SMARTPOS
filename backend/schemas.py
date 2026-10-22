from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal
from datetime import datetime

# --- Store Schemas ---
class StoreBase(BaseModel):
    name: str
    category: str
    phone: str
    email: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None
    tax_enabled: Optional[bool] = True
    tax_rate: Optional[Decimal] = Decimal("8.00")

class StoreCreate(StoreBase):
    pass

class StoreUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gst_number: Optional[str] = None
    address: Optional[str] = None
    tax_enabled: Optional[bool] = None
    tax_rate: Optional[Decimal] = None

class StoreResponse(StoreBase):
    id: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- User & Staff Schemas ---
class UserCreate(BaseModel):
    owner_name: str
    email_or_username: str
    password: str
    phone: str
    # If joining existing store with join code
    store_id: Optional[str] = None
    role: Optional[str] = None  # e.g. "cashier", "manager", "owner"
    # If creating a new store
    shop_name: Optional[str] = None
    shop_category: Optional[str] = None
    gst_number: Optional[str] = None
    business_address: Optional[str] = None

class StaffCreate(BaseModel):
    name: str
    email_or_username: str
    password: str
    role: str = "cashier"  # cashier, manager
    phone: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email_or_username: Optional[str] = None
    role: Optional[str] = None
    image: Optional[str] = None

class UserLogin(BaseModel):
    email_or_username: str
    password: str

class UserResponse(BaseModel):
    id: int
    store_id: str
    name: str
    email_or_username: str
    role: str
    phone: Optional[str] = None
    image: Optional[str] = None
    # Store Details embedded for instant frontend store setup
    shop_name: Optional[str] = None
    shop_category: Optional[str] = None
    gst_number: Optional[str] = None
    business_address: Optional[str] = None
    store_phone: Optional[str] = None
    tax_enabled: Optional[bool] = True
    tax_rate: Optional[Decimal] = None
    # JWT bearer token issued on login (None for signup/staff responses)
    token: Optional[str] = None

    class Config:
        from_attributes = True

# --- Product Schemas ---
class ProductBase(BaseModel):
    name: str
    sku: str
    price: Decimal
    cost_price: Decimal
    stock: Decimal
    low_stock_alert: Decimal = Decimal("5.000")
    category: str
    unit: Optional[str] = "pcs"
    tax_rate: Decimal = Decimal("8.00")
    image: Optional[str] = None
    is_active: bool = True

class ProductCreate(ProductBase):
    pass

class BulkProductCreate(BaseModel):
    products: List[ProductCreate]

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[Decimal] = None
    cost_price: Optional[Decimal] = None
    stock: Optional[Decimal] = None
    low_stock_alert: Optional[Decimal] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    tax_rate: Optional[Decimal] = None
    image: Optional[str] = None
    is_active: Optional[bool] = None

class ProductResponse(ProductBase):
    id: int
    store_id: str

    class Config:
        from_attributes = True

# --- Checkout & Bill Schemas ---
class CartItemSchema(BaseModel):
    product_id: int
    quantity: Decimal
    price: Decimal

class CheckoutSchema(BaseModel):
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    payment_method: str = "CASH"  # CASH, UPI, CARD, CREDIT
    payment_status: str = "PAID"
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    items: List[CartItemSchema]

class TransactionItemResponse(BaseModel):
    id: Optional[int] = None
    product_id: Optional[int] = None
    product_name: str
    quantity: Decimal
    price: Decimal

    class Config:
        from_attributes = True

class BillResponse(BaseModel):
    store_id: str
    invoice_number: str
    shop_name: str
    shop_address: Optional[str] = None
    shop_phone: Optional[str] = None
    gst_number: Optional[str] = None
    cashier_name: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    payment_method: str
    payment_status: str
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    created_at: datetime
    items: List[TransactionItemResponse]

    class Config:
        from_attributes = True

class TransactionResponse(BaseModel):
    store_id: str
    invoice_number: str
    shop_name: Optional[str] = None
    shop_address: Optional[str] = None
    shop_phone: Optional[str] = None
    gst_number: Optional[str] = None
    cashier_name: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_credit_balance: Optional[Decimal] = None
    payment_method: str
    payment_status: str = "PAID"
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    created_at: datetime
    items: List[TransactionItemResponse] = []

    class Config:
        from_attributes = True

# --- Customer & Credit Ledger Schemas ---
class CustomerCreate(BaseModel):
    name: str
    phone: Optional[str] = None

class PaymentCreate(BaseModel):
    amount: Decimal
    note: Optional[str] = None

class CreditEntryResponse(BaseModel):
    id: int
    entry_type: str  # DEBIT | CREDIT
    amount: Decimal
    note: Optional[str] = None
    invoice_number: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CustomerResponse(BaseModel):
    id: int
    store_id: str
    name: str
    phone: Optional[str] = None
    credit_balance: Decimal
    created_at: Optional[datetime] = None
    entries: List[CreditEntryResponse] = []

    class Config:
        from_attributes = True

# --- Dashboard Metrics Schemas ---
class LowStockAlert(BaseModel):
    id: int
    name: str
    stock: Decimal
    unit: Optional[str] = "pcs"

class RecentTransaction(BaseModel):
    store_id: str
    invoice_number: str
    created_at: datetime
    items_count: int
    total: Decimal
    payment_method: str

class DailySalesTrend(BaseModel):
    day: str
    date: str
    amount: Decimal

class DashboardMetricsResponse(BaseModel):
    today_sales: Decimal
    yesterday_sales: Decimal
    sales_growth_percentage: float
    orders_count: int
    profit: Decimal
    low_stock_alerts: List[LowStockAlert]
    recent_transactions: List[RecentTransaction]
    weekly_trend: List[DailySalesTrend]
