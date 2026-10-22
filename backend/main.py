from fastapi import FastAPI, Depends, HTTPException, Query, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, inspect, text
from typing import List, Optional, Tuple
from datetime import datetime, date, time, timedelta, timezone
from zoneinfo import ZoneInfo
from decimal import Decimal
import hashlib
import re
import random
import string
import os
import secrets
import time as pytime

import jwt
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError

import models
import schemas
from database import get_db, engine

# Application business timezone (defaults to Asia/Kolkata / IST, +05:30)
APP_TIMEZONE = ZoneInfo(os.getenv("APP_TIMEZONE", "Asia/Kolkata"))

def get_now() -> datetime:
    """Current timestamp in the app timezone."""
    return datetime.now(APP_TIMEZONE)

def get_today_bounds() -> Tuple[datetime, datetime, date]:
    """Return (start_today, end_today, today_date) normalized to local app timezone."""
    today = datetime.now(APP_TIMEZONE).date()
    start_today = datetime.combine(today, time.min)
    end_today = datetime.combine(today, time.max)
    return start_today, end_today, today

# Create DB Tables if they don't exist yet (SQLAlchemy fallback).
# NOTE: create_all() adds NEW tables (e.g. customers, credit_entries) but never
# ALTERs existing ones, so new columns on the pre-existing `transactions` table
# are added separately below.
models.Base.metadata.create_all(bind=engine)


def _ensure_transaction_customer_columns() -> None:
    """Non-destructive migration: add the customer columns to `transactions` if
    they're missing. Uses the inspector to check first, then a plain
    `ALTER TABLE ... ADD COLUMN`, which both PostgreSQL (Render) and SQLite
    (local dev) support. Each column is guarded independently so a partial prior
    migration still completes."""
    try:
        inspector = inspect(engine)
        existing = {c["name"] for c in inspector.get_columns("transactions")}
    except Exception as e:
        print(f"Startup migration: could not inspect transactions table: {e}")
        return

    to_add = {
        "customer_id": "INTEGER",
        "customer_name": "VARCHAR(255)",
        "customer_phone": "VARCHAR(50)",
    }
    for column, ddl in to_add.items():
        if column in existing:
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE transactions ADD COLUMN {column} {ddl}"))
            print(f"Startup migration: added transactions.{column}")
        except Exception as e:
            print(f"Startup migration: could not add transactions.{column}: {e}")


def _ensure_product_active_column() -> None:
    """Non-destructive migration: add `is_active` to `products` if missing."""
    try:
        inspector = inspect(engine)
        existing = {c["name"] for c in inspector.get_columns("products")}
    except Exception as e:
        print(f"Startup migration: could not inspect products table: {e}")
        return

    if "is_active" not in existing:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE products ADD COLUMN is_active BOOLEAN DEFAULT TRUE"))
            print("Startup migration: added products.is_active")
        except Exception as e:
            print(f"Startup migration: could not add products.is_active: {e}")


def _ensure_store_tax_columns() -> None:
    """Non-destructive migration: add `tax_enabled` and `tax_rate` to `stores` if missing."""
    try:
        inspector = inspect(engine)
        existing = {c["name"] for c in inspector.get_columns("stores")}
    except Exception as e:
        print(f"Startup migration: could not inspect stores table: {e}")
        return

    if "tax_enabled" not in existing:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE stores ADD COLUMN tax_enabled BOOLEAN DEFAULT TRUE"))
            print("Startup migration: added stores.tax_enabled")
        except Exception as e:
            print(f"Startup migration: could not add stores.tax_enabled: {e}")

    if "tax_rate" not in existing:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE stores ADD COLUMN tax_rate DECIMAL(5, 2) DEFAULT 8.00"))
            print("Startup migration: added stores.tax_rate")
        except Exception as e:
            print(f"Startup migration: could not add stores.tax_rate: {e}")


_ensure_transaction_customer_columns()
_ensure_product_active_column()
_ensure_store_tax_columns()

app = FastAPI(title="SmartPOS API Backend", version="2.0.0")

# CORS — restrict to configured origins. Tokens are sent via the Authorization
# header (Bearer), not cookies, so credentials are not required. Set ALLOWED_ORIGINS
# (comma-separated) in the environment to your real web frontend origin(s).
# NOTE: CORS only affects browser/web clients; native mobile builds are unaffected.
_DEFAULT_ORIGINS = "http://localhost:8081,http://localhost:19006,http://localhost:3000"
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "SmartPOS Backend API",
        "version": "2.0.0",
        "docs": "/docs"
    }

# --- Password hashing (bcrypt, with transparent upgrade of legacy SHA-256) ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Matches an unsalted SHA-256 hex digest (legacy scheme used before bcrypt).
_SHA256_HEX = re.compile(r"^[0-9a-f]{64}$", re.IGNORECASE)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, stored_hash: str) -> Tuple[bool, bool]:
    """Verify a password against the stored hash.

    Returns (is_valid, needs_upgrade). Legacy accounts whose password was stored
    as an unsalted SHA-256 digest verify against that digest and are flagged for
    re-hashing with bcrypt (upgrade-on-login).
    """
    if not stored_hash:
        return False, False
    if _SHA256_HEX.match(stored_hash):
        legacy = hashlib.sha256(plain_password.encode()).hexdigest()
        return (legacy == stored_hash.lower()), True
    try:
        return pwd_context.verify(plain_password, stored_hash), False
    except Exception:
        return False, False


# --- JWT authentication ---
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY:
    # Dev fallback: an ephemeral key so local runs work. Tokens are invalidated on
    # every restart. A stable JWT_SECRET_KEY MUST be set in production (e.g. Render).
    JWT_SECRET_KEY = secrets.token_urlsafe(48)
    print("WARNING: JWT_SECRET_KEY not set; using an ephemeral dev key. "
          "Set JWT_SECRET_KEY in the environment for production.")

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = int(os.getenv("JWT_EXPIRE_DAYS", "7"))


def create_access_token(user_id: int, store_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "user_id": user_id,
        "store_id": store_id,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Resolve the authenticated user from a verified Bearer token.

    This replaces the previous header-trust model (raw X-Store-ID / X-User-ID):
    identity now comes from a signed token the client cannot forge.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
    store_id = payload.get("store_id")
    user_id = payload.get("user_id")
    if not store_id or user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
    return {"user_id": user_id, "store_id": str(store_id), "role": payload.get("role", "cashier")}

def generate_store_id(store_name: str, db: Session) -> str:
    """Generate a clean full-character store identifier e.g. TGMPOS, TGMAEX, MARTABC (3-4 letters from shop name + 3 random uppercase letters)"""
    clean_prefix = re.sub(r'[^A-Z]', '', store_name.upper())[:4]
    if len(clean_prefix) < 3:
        clean_prefix = (clean_prefix + "STR")[:3]
    
    random_suffix = ''.join(random.choices(string.ascii_uppercase, k=3))
    candidate_id = f"{clean_prefix}{random_suffix}"
    while db.query(models.Store).filter(models.Store.id == candidate_id).first():
        random_suffix = ''.join(random.choices(string.ascii_uppercase, k=3))
        candidate_id = f"{clean_prefix}{random_suffix}"
    return candidate_id

def get_store_id(current_user: dict = Depends(get_current_user)) -> str:
    # Store scope is derived from the verified token, not a client-supplied header.
    return current_user["store_id"]

def get_user_id(current_user: dict = Depends(get_current_user)) -> Optional[int]:
    # Acting user is derived from the verified token.
    return current_user["user_id"]

# --- Auth & Store Management Endpoints ---

@app.get("/api/stores/verify/{store_id}")
def verify_store_join_code(store_id: str, db: Session = Depends(get_db)):
    clean_id = store_id.strip().upper()
    db_store = db.query(models.Store).filter(
        (models.Store.id == clean_id) | (models.Store.id == store_id.strip())
    ).first()
    if not db_store:
        raise HTTPException(status_code=404, detail="No store found with this Join Code / Store ID")
    return {
        "id": db_store.id,
        "name": db_store.name,
        "category": db_store.category,
        "phone": db_store.phone
    }

@app.post("/api/signup", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if username or email already exists across users
    existing_user = db.query(models.User).filter(
        models.User.email_or_username == payload.email_or_username.lower().strip()
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or Email already registered")

    # Case A: User is joining an existing store using Store ID / Join Code
    if payload.store_id and payload.store_id.strip():
        join_code = payload.store_id.strip()
        db_store = db.query(models.Store).filter(
            (models.Store.id == join_code.upper()) | (models.Store.id == join_code)
        ).first()
        if not db_store:
            raise HTTPException(
                status_code=404, 
                detail=f"Store not found with Join Code '{join_code}'. Please check with your store owner/manager."
            )

        assigned_role = (payload.role.lower().strip() if payload.role else "cashier")

        db_user = models.User(
            store_id=db_store.id,
            name=payload.owner_name.strip(),
            email_or_username=payload.email_or_username.lower().strip(),
            password=hash_password(payload.password),
            role=assigned_role,
            phone=payload.phone.strip() if payload.phone else None
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        token = create_access_token(db_user.id, db_store.id, db_user.role)
        return schemas.UserResponse(
            id=db_user.id,
            store_id=db_store.id,
            name=db_user.name,
            email_or_username=db_user.email_or_username,
            role=db_user.role,
            phone=db_user.phone,
            image=db_user.image,
            shop_name=db_store.name,
            shop_category=db_store.category,
            gst_number=db_store.gst_number,
            business_address=db_store.address,
            store_phone=db_store.phone,
            token=token
        )

    # Case B: User is registering a new Store
    if not payload.shop_name or not payload.shop_name.strip():
        raise HTTPException(status_code=400, detail="Shop Name is required to register a new store")
    if not payload.shop_category or not payload.shop_category.strip():
        raise HTTPException(status_code=400, detail="Shop Category is required to register a new store")

    # 1. Generate Alphanumeric Store ID & Create Store
    new_store_id = generate_store_id(payload.shop_name, db)
    db_store = models.Store(
        id=new_store_id,
        name=payload.shop_name.strip(),
        category=payload.shop_category.strip(),
        phone=payload.phone.strip(),
        email=payload.email_or_username.lower().strip(),
        gst_number=payload.gst_number.strip() if payload.gst_number else None,
        address=payload.business_address.strip() if payload.business_address else None
    )
    db.add(db_store)
    db.commit()
    db.refresh(db_store)

    # 2. Create Owner User linked to this Store
    db_user = models.User(
        store_id=db_store.id,
        name=payload.owner_name.strip(),
        email_or_username=payload.email_or_username.lower().strip(),
        password=hash_password(payload.password),
        role="owner",
        phone=payload.phone.strip()
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    token = create_access_token(db_user.id, db_store.id, db_user.role)
    return schemas.UserResponse(
        id=db_user.id,
        store_id=db_store.id,
        name=db_user.name,
        email_or_username=db_user.email_or_username,
        role=db_user.role,
        phone=db_user.phone,
        image=db_user.image,
        shop_name=db_store.name,
        shop_category=db_store.category,
        gst_number=db_store.gst_number,
        business_address=db_store.address,
        store_phone=db_store.phone,
        token=token
    )

@app.post("/api/login", response_model=schemas.UserResponse)
def login(credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(
        models.User.email_or_username == credentials.email_or_username.lower().strip()
    ).first()

    is_valid, needs_upgrade = (
        verify_password(credentials.password, db_user.password) if db_user else (False, False)
    )
    if not db_user or not is_valid:
        raise HTTPException(status_code=401, detail="Invalid username/email or password")

    # Transparently migrate legacy unsalted SHA-256 hashes to bcrypt on login.
    if needs_upgrade:
        db_user.password = hash_password(credentials.password)
        db.commit()

    db_store = db.query(models.Store).filter(models.Store.id == db_user.store_id).first()
    if not db_store:
        raise HTTPException(status_code=404, detail="Store associated with this account not found")

    token = create_access_token(db_user.id, db_store.id, db_user.role)
    return schemas.UserResponse(
        id=db_user.id,
        store_id=db_store.id,
        name=db_user.name,
        email_or_username=db_user.email_or_username,
        role=db_user.role,
        phone=db_user.phone,
        image=db_user.image,
        shop_name=db_store.name,
        shop_category=db_store.category,
        gst_number=db_store.gst_number,
        business_address=db_store.address,
        store_phone=db_store.phone,
        tax_enabled=getattr(db_store, "tax_enabled", True),
        tax_rate=getattr(db_store, "tax_rate", Decimal("8.00")),
        token=token
    )

@app.post("/api/stores/{store_id}/staff", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def add_staff_user(
    store_id: str, 
    staff: schemas.StaffCreate, 
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    if store_id != x_store_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this store")
        
    existing_user = db.query(models.User).filter(
        models.User.email_or_username == staff.email_or_username.lower().strip()
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or email is already in use")

    db_store = db.query(models.Store).filter(models.Store.id == store_id).first()
    if not db_store:
        raise HTTPException(status_code=404, detail="Store not found")

    db_user = models.User(
        store_id=store_id,
        name=staff.name.strip(),
        email_or_username=staff.email_or_username.lower().strip(),
        password=hash_password(staff.password),
        role=staff.role.lower().strip(),
        phone=staff.phone.strip() if staff.phone else None
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return schemas.UserResponse(
        id=db_user.id,
        store_id=store_id,
        name=db_user.name,
        email_or_username=db_user.email_or_username,
        role=db_user.role,
        phone=db_user.phone,
        image=db_user.image,
        shop_name=db_store.name,
        shop_category=db_store.category,
        gst_number=db_store.gst_number,
        business_address=db_store.address,
        store_phone=db_store.phone
    )

@app.get("/api/stores/{store_id}/staff", response_model=List[schemas.UserResponse])
def get_staff_users(
    store_id: str,
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    if store_id != x_store_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this store")
    
    db_store = db.query(models.Store).filter(models.Store.id == store_id).first()
    if not db_store:
        raise HTTPException(status_code=404, detail="Store not found")

    users = db.query(models.User).filter(models.User.store_id == store_id).all()
    return [
        schemas.UserResponse(
            id=u.id,
            store_id=u.store_id,
            name=u.name,
            email_or_username=u.email_or_username,
            role=u.role,
            phone=u.phone,
            image=u.image,
            shop_name=db_store.name,
            shop_category=db_store.category,
            gst_number=db_store.gst_number,
            business_address=db_store.address,
            store_phone=db_store.phone
        ) for u in users
    ]

@app.put("/api/stores/{store_id}", response_model=schemas.StoreResponse)
def update_store(
    store_id: str,
    updated_fields: schemas.StoreUpdate,
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    if store_id != x_store_id:
        raise HTTPException(status_code=403, detail="Unauthorized access to this store")

    db_store = db.query(models.Store).filter(models.Store.id == store_id).first()
    if not db_store:
        raise HTTPException(status_code=404, detail="Store not found")

    for key, value in updated_fields.model_dump(exclude_unset=True).items():
        setattr(db_store, key, value)

    db.commit()
    db.refresh(db_store)
    return db_store

@app.get("/api/users/{user_id}", response_model=schemas.UserResponse)
def get_user(
    user_id: int,
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.store_id == x_store_id
    ).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found in this store")

    db_store = db.query(models.Store).filter(models.Store.id == x_store_id).first()
    return schemas.UserResponse(
        id=db_user.id,
        store_id=db_user.store_id,
        name=db_user.name,
        email_or_username=db_user.email_or_username,
        role=db_user.role,
        phone=db_user.phone,
        image=db_user.image,
        shop_name=db_store.name if db_store else None,
        shop_category=db_store.category if db_store else None,
        gst_number=db_store.gst_number if db_store else None,
        business_address=db_store.address if db_store else None,
        store_phone=db_store.phone if db_store else None,
        tax_enabled=getattr(db_store, "tax_enabled", True) if db_store else True,
        tax_rate=getattr(db_store, "tax_rate", Decimal("8.00")) if db_store else Decimal("8.00")
    )

@app.put("/api/users/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    updated_fields: schemas.UserUpdate,
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    db_user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.store_id == x_store_id
    ).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found in this store")

    if updated_fields.email_or_username:
        new_email = updated_fields.email_or_username.lower().strip()
        if new_email != db_user.email_or_username:
            existing = db.query(models.User).filter(models.User.email_or_username == new_email).first()
            if existing:
                raise HTTPException(status_code=400, detail="Username or Email already registered")
            db_user.email_or_username = new_email

    for key, value in updated_fields.model_dump(exclude_unset=True).items():
        if key == "email_or_username":
            continue
        setattr(db_user, key, value)

    db.commit()
    db.refresh(db_user)

    db_store = db.query(models.Store).filter(models.Store.id == x_store_id).first()
    return schemas.UserResponse(
        id=db_user.id,
        store_id=db_user.store_id,
        name=db_user.name,
        email_or_username=db_user.email_or_username,
        role=db_user.role,
        phone=db_user.phone,
        image=db_user.image,
        shop_name=db_store.name if db_store else None,
        shop_category=db_store.category if db_store else None,
        gst_number=db_store.gst_number if db_store else None,
        business_address=db_store.address if db_store else None,
        store_phone=db_store.phone if db_store else None
    )

# --- Product Endpoints (Multi-tenant scoped by x_store_id) ---

@app.get("/api/products", response_model=List[schemas.ProductResponse])
def read_products(
    category: Optional[str] = Query(None),
    query: Optional[str] = Query(None),
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    q = db.query(models.Product).filter(
        models.Product.store_id == x_store_id,
        models.Product.is_active != False
    )
    if category and category != "All Items" and category != "All":
        q = q.filter(models.Product.category.ilike(category))
    if query:
        search = f"%{query}%"
        q = q.filter(
            (models.Product.name.ilike(search)) | (models.Product.sku.ilike(search))
        )
    return q.order_by(models.Product.id.asc()).all()

@app.post("/api/products", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product: schemas.ProductCreate, 
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    existing = db.query(models.Product).filter(
        models.Product.sku == product.sku.upper(),
        models.Product.store_id == x_store_id,
        models.Product.is_active != False
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="SKU code already exists in your store catalog")
        
    db_product = models.Product(
        store_id=x_store_id,
        name=product.name,
        sku=product.sku.upper(),
        price=product.price,
        cost_price=product.cost_price,
        stock=product.stock,
        low_stock_alert=product.low_stock_alert,
        category=product.category,
        unit=product.unit,
        tax_rate=product.tax_rate,
        image=product.image,
        is_active=True
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@app.post("/api/products/bulk", status_code=status.HTTP_201_CREATED)
def create_products_bulk(
    bulk: schemas.BulkProductCreate,
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    added_count = 0
    errors = []
    
    for idx, product in enumerate(bulk.products):
        sku = product.sku.upper() if product.sku else f"SKU-{int(datetime.now().timestamp())}-{idx}"
        
        # Check for existing SKU
        existing = db.query(models.Product).filter(
            models.Product.sku == sku,
            models.Product.store_id == x_store_id,
            models.Product.is_active != False
        ).first()
        
        if existing:
            errors.append(f"Row {idx + 1}: SKU '{sku}' already exists.")
            continue
            
        db_product = models.Product(
            store_id=x_store_id,
            name=product.name,
            sku=sku,
            price=product.price,
            cost_price=product.cost_price,
            stock=product.stock,
            low_stock_alert=product.low_stock_alert,
            category=product.category,
            unit=product.unit,
            tax_rate=product.tax_rate,
            image=product.image,
            is_active=True
        )
        db.add(db_product)
        added_count += 1
        
    if added_count > 0:
        db.commit()
        
    return {
        "message": f"Successfully imported {added_count} products.",
        "added": added_count,
        "errors": errors
    }

@app.put("/api/products/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    product_id: int, 
    updated_fields: schemas.ProductUpdate, 
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    db_product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.store_id == x_store_id,
        models.Product.is_active != False
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
        
    if updated_fields.sku and updated_fields.sku.upper() != db_product.sku:
        existing = db.query(models.Product).filter(
            models.Product.sku == updated_fields.sku.upper(),
            models.Product.store_id == x_store_id,
            models.Product.is_active != False
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="SKU code already exists in your store catalog")
            
    for key, value in updated_fields.model_dump(exclude_unset=True).items():
        if key == "sku" and value:
            setattr(db_product, key, value.upper())
        else:
            setattr(db_product, key, value)
            
    db.commit()
    db.refresh(db_product)
    return db_product

@app.delete("/api/products/clear-all", status_code=status.HTTP_200_OK)
def clear_all_store_products(
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    """Clear all products from the store catalog (soft-delete active products)."""
    products = db.query(models.Product).filter(
        models.Product.store_id == x_store_id,
        models.Product.is_active == True
    ).all()
    count = len(products)
    timestamp_suffix = int(datetime.now().timestamp())
    for p in products:
        p.is_active = False
        p.sku = f"{p.sku[:80]}#DEL_{timestamp_suffix}_{p.id}"
    db.commit()
    return {"message": f"Successfully removed {count} products from catalog"}

@app.delete("/api/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    db_product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.store_id == x_store_id,
        models.Product.is_active == True
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Soft-delete: mark inactive and append tombstone suffix to free up the SKU code.
    # Truncate to 80 chars first to prevent VARCHAR(100) overflow (#DEL_<10-digit-ts> = 15 chars max).
    db_product.is_active = False
    timestamp_suffix = int(datetime.now().timestamp())
    db_product.sku = f"{db_product.sku[:80]}#DEL_{timestamp_suffix}"
    db.commit()
    return None

@app.post("/api/products/{product_id}/restock", response_model=schemas.ProductResponse)
def restock_product(
    product_id: int,
    qty: int = Query(..., gt=0),
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    db_product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.store_id == x_store_id,
        models.Product.is_active == True
    ).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    db_product.stock += Decimal(str(qty))
    db.commit()
    db.refresh(db_product)
    return db_product

# --- Checkout & Bill Generator Endpoints (Composite Primary Key: store_id, invoice_number) ---

def _generate_next_invoice_number(db: Session, store_id: str, today_str: str) -> str:
    """Find the highest sequence invoice number for today for this store and increment it."""
    prefix = f"INV-{today_str}-"
    latest_inv = db.query(models.Transaction.invoice_number).filter(
        models.Transaction.store_id == store_id,
        models.Transaction.invoice_number.like(f"{prefix}%")
    ).order_by(
        func.length(models.Transaction.invoice_number).desc(),
        models.Transaction.invoice_number.desc()
    ).first()

    if latest_inv and latest_inv[0]:
        try:
            seq_part = latest_inv[0][len(prefix):]
            next_seq = int(seq_part) + 1
        except Exception:
            next_seq = 1
    else:
        next_seq = 1

    return f"{prefix}{next_seq:04d}"


@app.post("/api/checkout", response_model=schemas.BillResponse, status_code=status.HTTP_201_CREATED)
def checkout(
    order: schemas.CheckoutSchema,
    x_store_id: str = Depends(get_store_id),
    x_user_id: Optional[int] = Depends(get_user_id),
    db: Session = Depends(get_db)
):
    db_store = db.query(models.Store).filter(models.Store.id == x_store_id).first()
    if not db_store:
        raise HTTPException(status_code=404, detail="Store not found")

    cashier_name = None
    if x_user_id:
        db_user = db.query(models.User).filter(models.User.id == x_user_id).first()
        if db_user:
            cashier_name = db_user.name

    cust_name = (order.customer_name or "").strip()
    cust_phone = (order.customer_phone or "").strip()

    # Retry loop to handle concurrent checkout invoice number collisions gracefully
    max_retries = 5
    for attempt in range(max_retries):
        now_local = get_now()
        today_str = now_local.strftime("%Y%m%d")
        invoice_number = _generate_next_invoice_number(db, x_store_id, today_str)

        try:
            # 1. Resolve / Find or Create customer within transaction
            db_customer = None
            if cust_name:
                db_customer = db.query(models.Customer).filter(
                    models.Customer.store_id == x_store_id,
                    models.Customer.name == cust_name
                ).first()
                if not db_customer:
                    db_customer = models.Customer(
                        store_id=x_store_id,
                        name=cust_name,
                        phone=cust_phone or None,
                        credit_balance=Decimal("0.00"),
                    )
                    db.add(db_customer)
                    db.flush()
                elif cust_phone and not db_customer.phone:
                    db_customer.phone = cust_phone

            # 2. Server-side integrity check: verify prices and recalculate totals from catalog.
            #    This prevents manipulated client requests from recording zero-dollar or
            #    artificially-discounted sales.
            server_subtotal = Decimal("0.00")
            server_tax = Decimal("0.00")
            verified_items: list[tuple] = []  # (db_product, quantity, catalog_price)

            for item in order.items:
                db_product = db.query(models.Product).filter(
                    models.Product.id == item.product_id,
                    models.Product.store_id == x_store_id,
                    models.Product.is_active == True
                ).first()
                if not db_product:
                    db.rollback()
                    raise HTTPException(
                        status_code=404,
                        detail=f"Product ID {item.product_id} not found in active store catalog"
                    )
                if db_product.stock < item.quantity:
                    db.rollback()
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock for {db_product.name}. Available: {db_product.stock}"
                    )

                # Always use catalog price — ignore client-supplied price.
                catalog_price = Decimal(str(db_product.price))
                is_store_tax_enabled = getattr(db_store, "tax_enabled", True)
                if not is_store_tax_enabled:
                    tax_rate = Decimal("0.00")
                else:
                    store_tax_val = getattr(db_store, "tax_rate", None)
                    tax_rate = Decimal(str(store_tax_val if store_tax_val is not None else (db_product.tax_rate or "0")))

                line_subtotal = catalog_price * Decimal(str(item.quantity))
                line_tax = (line_subtotal * tax_rate / Decimal("100")).quantize(Decimal("0.01"))

                server_subtotal += line_subtotal
                server_tax += line_tax
                verified_items.append((db_product, item.quantity, catalog_price))

            # Validate discount — must not exceed server-computed subtotal.
            client_discount = Decimal(str(order.discount))
            if client_discount < Decimal("0"):
                raise HTTPException(status_code=422, detail="Discount cannot be negative.")
            if client_discount > server_subtotal:
                raise HTTPException(
                    status_code=422,
                    detail=f"Discount ({client_discount}) exceeds order subtotal ({server_subtotal})."
                )

            server_total = (server_subtotal - client_discount + server_tax).quantize(Decimal("0.01"))
            server_subtotal = server_subtotal.quantize(Decimal("0.01"))
            server_tax = server_tax.quantize(Decimal("0.01"))

            # 3. Create Transaction using server-verified totals (not client-supplied values)
            db_transaction = models.Transaction(
                store_id=x_store_id,
                invoice_number=invoice_number,
                user_id=x_user_id,
                payment_method=order.payment_method.upper().strip(),
                payment_status=order.payment_status.upper().strip(),
                subtotal=server_subtotal,
                discount=client_discount,
                tax=server_tax,
                total=server_total,
                customer_id=db_customer.id if db_customer else None,
                customer_name=cust_name or None,
                customer_phone=cust_phone or None,
                created_at=now_local.replace(tzinfo=None)
            )
            db.add(db_transaction)
            db.flush()

            # 4. Add Line Items & Decrement Stock using verified catalog prices
            bill_items = []
            for db_product, qty, catalog_price in verified_items:
                db_product.stock -= qty

                db_item = models.TransactionItem(
                    store_id=x_store_id,
                    invoice_number=invoice_number,
                    product_id=db_product.id,
                    product_name=db_product.name,
                    quantity=qty,
                    price=catalog_price
                )
                db.add(db_item)
                bill_items.append(schemas.TransactionItemResponse(
                    product_id=db_product.id,
                    product_name=db_product.name,
                    quantity=qty,
                    price=catalog_price
                ))

            # 5. Record a credit-ledger DEBIT for unpaid (CREDIT) sales
            if db_customer and db_transaction.payment_status == "CREDIT":
                db.add(models.CreditEntry(
                    store_id=x_store_id,
                    customer_id=db_customer.id,
                    entry_type="DEBIT",
                    amount=server_total,
                    invoice_number=invoice_number,
                    note="Credit sale",
                    created_at=now_local.replace(tzinfo=None)
                ))
                db_customer.credit_balance = (db_customer.credit_balance or Decimal("0.00")) + server_total

            db.commit()

            return schemas.BillResponse(
                store_id=x_store_id,
                invoice_number=invoice_number,
                shop_name=db_store.name,
                shop_address=db_store.address,
                shop_phone=db_store.phone,
                gst_number=db_store.gst_number,
                cashier_name=cashier_name,
                customer_name=cust_name or None,
                customer_phone=cust_phone or None,
                customer_credit_balance=db_customer.credit_balance if db_customer else None,
                payment_method=order.payment_method,
                payment_status=order.payment_status,
                subtotal=server_subtotal,
                discount=client_discount,
                tax=server_tax,
                total=server_total,
                created_at=db_transaction.created_at or now_local.replace(tzinfo=None),
                items=bill_items
            )
        except IntegrityError:
            db.rollback()
            if attempt == max_retries - 1:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Concurrent checkout collision occurred. Please retry your request."
                )
            # Stagger colliding simultaneous checkout requests
            pytime.sleep(random.uniform(0.02, 0.08))

    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Unable to generate unique invoice after retries.")

@app.get("/api/bills/{invoice_number}", response_model=schemas.BillResponse)
def get_bill(
    invoice_number: str,
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    db_transaction = db.query(models.Transaction).filter(
        models.Transaction.store_id == x_store_id,
        models.Transaction.invoice_number == invoice_number
    ).first()
    if not db_transaction:
        raise HTTPException(status_code=404, detail="Bill / Invoice not found")

    db_store = db.query(models.Store).filter(models.Store.id == x_store_id).first()
    
    cashier_name = None
    if db_transaction.user_id:
        cashier = db.query(models.User).filter(models.User.id == db_transaction.user_id).first()
        if cashier:
            cashier_name = cashier.name

    db_customer = None
    if db_transaction.customer_name:
        db_customer = db.query(models.Customer).filter(
            models.Customer.store_id == x_store_id,
            models.Customer.name == db_transaction.customer_name
        ).first()

    items = db.query(models.TransactionItem).filter(
        models.TransactionItem.store_id == x_store_id,
        models.TransactionItem.invoice_number == invoice_number
    ).all()

    return schemas.BillResponse(
        store_id=x_store_id,
        invoice_number=invoice_number,
        shop_name=db_store.name if db_store else "SmartPOS",
        shop_address=db_store.address if db_store else None,
        shop_phone=db_store.phone if db_store else None,
        gst_number=db_store.gst_number if db_store else None,
        cashier_name=cashier_name,
        customer_name=db_transaction.customer_name,
        customer_phone=db_transaction.customer_phone,
        customer_credit_balance=db_customer.credit_balance if db_customer else None,
        payment_method=db_transaction.payment_method,
        payment_status=db_transaction.payment_status,
        subtotal=db_transaction.subtotal,
        discount=db_transaction.discount,
        tax=db_transaction.tax,
        total=db_transaction.total,
        created_at=db_transaction.created_at,
        items=[
            schemas.TransactionItemResponse(
                id=item.id,
                product_id=item.product_id,
                product_name=item.product_name,
                quantity=item.quantity,
                price=item.price
            ) for item in items
        ]
    )

@app.get("/api/transactions", response_model=List[schemas.TransactionResponse])
def get_transactions(
    query: Optional[str] = None,
    payment_method: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    q = db.query(models.Transaction).filter(models.Transaction.store_id == x_store_id)

    if payment_method and isinstance(payment_method, str) and payment_method.upper() != "ALL":
        q = q.filter(models.Transaction.payment_method == payment_method.upper())

    if start_date and isinstance(start_date, str):
        try:
            if len(start_date) == 10:
                sd = datetime.combine(date.fromisoformat(start_date), time.min)
            else:
                sd = datetime.fromisoformat(start_date)
            q = q.filter(models.Transaction.created_at >= sd)
        except Exception:
            pass

    if end_date and isinstance(end_date, str):
        try:
            if len(end_date) == 10:
                ed = datetime.combine(date.fromisoformat(end_date), time.max)
            else:
                ed = datetime.fromisoformat(end_date)
            q = q.filter(models.Transaction.created_at <= ed)
        except Exception:
            pass

    if query and isinstance(query, str) and query.strip():
        search = f"%{query.strip()}%"
        q = q.filter(models.Transaction.invoice_number.ilike(search))

    transactions = q.order_by(models.Transaction.created_at.desc()).offset(offset).limit(limit).all()

    # Pre-fetch store info
    db_store = db.query(models.Store).filter(models.Store.id == x_store_id).first()

    result = []
    for tx in transactions:
        cashier_name = None
        if tx.user_id:
            cashier = db.query(models.User).filter(models.User.id == tx.user_id).first()
            if cashier:
                cashier_name = cashier.name

        items = db.query(models.TransactionItem).filter(
            models.TransactionItem.store_id == x_store_id,
            models.TransactionItem.invoice_number == tx.invoice_number
        ).all()

        result.append(schemas.TransactionResponse(
            store_id=tx.store_id,
            invoice_number=tx.invoice_number,
            shop_name=db_store.name if db_store else "SmartPOS Store",
            shop_address=db_store.address if db_store else None,
            shop_phone=db_store.phone if db_store else None,
            gst_number=db_store.gst_number if db_store else None,
            cashier_name=cashier_name,
            customer_name=tx.customer_name,
            customer_phone=tx.customer_phone,
            payment_method=tx.payment_method,
            payment_status=tx.payment_status or "PAID",
            subtotal=tx.subtotal,
            discount=tx.discount,
            tax=tx.tax,
            total=tx.total,
            created_at=tx.created_at,
            items=[
                schemas.TransactionItemResponse(
                    id=item.id,
                    product_id=item.product_id,
                    product_name=item.product_name,
                    quantity=item.quantity,
                    price=item.price
                ) for item in items
            ]
        ))
    return result

# --- Customer & Credit Ledger Endpoints (khata / udhaar) ---

def _customer_to_response(c: models.Customer, include_entries: bool = False) -> schemas.CustomerResponse:
    entries: List[schemas.CreditEntryResponse] = []
    if include_entries:
        entries = [
            schemas.CreditEntryResponse(
                id=e.id,
                entry_type=e.entry_type,
                amount=e.amount,
                note=e.note,
                invoice_number=e.invoice_number,
                created_at=e.created_at,
            )
            for e in sorted(
                c.entries,
                key=lambda x: (x.created_at or datetime.min, x.id or 0),
                reverse=True,
            )
        ]
    return schemas.CustomerResponse(
        id=c.id,
        store_id=c.store_id,
        name=c.name,
        phone=c.phone,
        credit_balance=c.credit_balance or Decimal("0.00"),
        created_at=c.created_at,
        entries=entries,
    )


@app.get("/api/customers", response_model=List[schemas.CustomerResponse])
def list_customers(
    query: Optional[str] = None,
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    q = db.query(models.Customer).filter(models.Customer.store_id == x_store_id)
    if query and query.strip():
        search = f"%{query.strip()}%"
        q = q.filter(
            (models.Customer.name.ilike(search)) | (models.Customer.phone.ilike(search))
        )
    customers = q.order_by(models.Customer.name.asc()).all()
    return [_customer_to_response(c) for c in customers]


@app.post("/api/customers", response_model=schemas.CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: schemas.CustomerCreate,
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Customer name is required")
    phone = (payload.phone or "").strip() or None

    # Idempotent: return the existing customer instead of erroring on a duplicate
    # name so the "add customer" flow degrades gracefully.
    existing = db.query(models.Customer).filter(
        models.Customer.store_id == x_store_id,
        models.Customer.name == name
    ).first()
    if existing:
        if phone and not existing.phone:
            existing.phone = phone
            db.commit()
            db.refresh(existing)
        return _customer_to_response(existing, include_entries=True)

    db_customer = models.Customer(
        store_id=x_store_id,
        name=name,
        phone=phone,
        credit_balance=Decimal("0.00"),
    )
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return _customer_to_response(db_customer, include_entries=True)


@app.get("/api/customers/{customer_id}", response_model=schemas.CustomerResponse)
def get_customer(
    customer_id: int,
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    db_customer = db.query(models.Customer).filter(
        models.Customer.id == customer_id,
        models.Customer.store_id == x_store_id
    ).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return _customer_to_response(db_customer, include_entries=True)


@app.post("/api/customers/{customer_id}/payment", response_model=schemas.CustomerResponse)
def record_customer_payment(
    customer_id: int,
    payload: schemas.PaymentCreate,
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    db_customer = db.query(models.Customer).filter(
        models.Customer.id == customer_id,
        models.Customer.store_id == x_store_id
    ).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    amount = payload.amount
    if amount is None or amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero")

    db.add(models.CreditEntry(
        store_id=x_store_id,
        customer_id=db_customer.id,
        entry_type="CREDIT",
        amount=amount,
        note=(payload.note or "").strip() or "Payment received",
        created_at=get_now().replace(tzinfo=None)
    ))
    db_customer.credit_balance = (db_customer.credit_balance or Decimal("0.00")) - amount
    db.commit()
    db.refresh(db_customer)
    return _customer_to_response(db_customer, include_entries=True)


# --- Dashboard Analytics Endpoints ---

@app.get("/api/dashboard", response_model=schemas.DashboardMetricsResponse)
def get_dashboard_metrics(
    x_store_id: str = Depends(get_store_id),
    db: Session = Depends(get_db)
):
    start_today, end_today, today = get_today_bounds()

    # 1. Today's Sales total sum for this store
    today_sales_query = db.query(func.sum(models.Transaction.total)).filter(
        models.Transaction.store_id == x_store_id,
        models.Transaction.created_at >= start_today,
        models.Transaction.created_at <= end_today
    ).scalar()
    today_sales = Decimal(str(today_sales_query)) if today_sales_query else Decimal("0.00")

    # 1b. Yesterday's Sales total sum for comparison
    yesterday = today - timedelta(days=1)
    start_yesterday = datetime.combine(yesterday, time.min)
    end_yesterday = datetime.combine(yesterday, time.max)

    yesterday_sales_query = db.query(func.sum(models.Transaction.total)).filter(
        models.Transaction.store_id == x_store_id,
        models.Transaction.created_at >= start_yesterday,
        models.Transaction.created_at <= end_yesterday
    ).scalar()
    yesterday_sales = Decimal(str(yesterday_sales_query)) if yesterday_sales_query else Decimal("0.00")

    if yesterday_sales > Decimal("0.00"):
        sales_growth_percentage = float(round(((today_sales - yesterday_sales) / yesterday_sales) * Decimal("100.0"), 1))
    elif today_sales > Decimal("0.00"):
        sales_growth_percentage = 100.0
    else:
        sales_growth_percentage = 0.0

    # 2. Orders Count today for this store
    orders_count = db.query(models.Transaction).filter(
        models.Transaction.store_id == x_store_id,
        models.Transaction.created_at >= start_today,
        models.Transaction.created_at <= end_today
    ).count()

    # 3. Calculate Today's Profit for this store: sum((sales_price - coalesce(cost_price, 0)) * quantity) - total discounts
    total_discounts_query = db.query(
        func.sum(func.coalesce(models.Transaction.discount, Decimal("0.00")))
    ).filter(
        models.Transaction.store_id == x_store_id,
        models.Transaction.created_at >= start_today,
        models.Transaction.created_at <= end_today
    ).scalar()
    total_discounts = Decimal(str(total_discounts_query)) if total_discounts_query else Decimal("0.00")

    profit_query = db.query(
        func.sum(
            (models.TransactionItem.price - func.coalesce(models.Product.cost_price, Decimal("0.00"))) 
            * models.TransactionItem.quantity
        )
    ).join(
        models.Transaction,
        (models.Transaction.store_id == models.TransactionItem.store_id) & 
        (models.Transaction.invoice_number == models.TransactionItem.invoice_number)
    ).outerjoin(
        models.Product, models.Product.id == models.TransactionItem.product_id
    ).filter(
        models.Transaction.store_id == x_store_id,
        models.Transaction.created_at >= start_today,
        models.Transaction.created_at <= end_today
    ).scalar()
    gross_margin = Decimal(str(profit_query)) if profit_query else Decimal("0.00")
    profit = max(Decimal("0.00"), gross_margin - total_discounts)

    # 4. Low stock alerts (only active products)
    low_stock = db.query(models.Product).filter(
        models.Product.store_id == x_store_id,
        models.Product.is_active == True,
        models.Product.stock <= models.Product.low_stock_alert
    ).order_by(models.Product.stock.asc()).limit(5).all()

    low_stock_alerts = [
        schemas.LowStockAlert(id=p.id, name=p.name, stock=p.stock, unit=p.unit or "pcs")
        for p in low_stock
    ]

    # 5. Recent transactions
    recent_txs = db.query(models.Transaction).filter(
        models.Transaction.store_id == x_store_id
    ).order_by(models.Transaction.created_at.desc()).limit(5).all()

    recent_transactions = []
    for tx in recent_txs:
        items_count = db.query(func.sum(models.TransactionItem.quantity)).filter(
            models.TransactionItem.store_id == x_store_id,
            models.TransactionItem.invoice_number == tx.invoice_number
        ).scalar() or 0
        recent_transactions.append(
            schemas.RecentTransaction(
                store_id=tx.store_id,
                invoice_number=tx.invoice_number,
                created_at=tx.created_at,
                items_count=int(items_count),
                total=tx.total,
                payment_method=tx.payment_method
            )
        )

    # 6. Weekly sales trend (last 7 days)
    weekly_trend = []
    for i in range(6, -1, -1):
        target_date = today - timedelta(days=i)
        start_d = datetime.combine(target_date, time.min)
        end_d = datetime.combine(target_date, time.max)
        day_sales_query = db.query(func.sum(models.Transaction.total)).filter(
            models.Transaction.store_id == x_store_id,
            models.Transaction.created_at >= start_d,
            models.Transaction.created_at <= end_d
        ).scalar()
        day_amt = Decimal(str(day_sales_query)) if day_sales_query else Decimal("0.00")
        weekly_trend.append(
            schemas.DailySalesTrend(
                day=target_date.strftime("%a"),
                date=target_date.isoformat(),
                amount=day_amt
            )
        )

    return schemas.DashboardMetricsResponse(
        today_sales=today_sales,
        yesterday_sales=yesterday_sales,
        sales_growth_percentage=sales_growth_percentage,
        orders_count=orders_count,
        profit=profit,
        low_stock_alerts=low_stock_alerts,
        recent_transactions=recent_transactions,
        weekly_trend=weekly_trend
    )
