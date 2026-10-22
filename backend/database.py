import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Database Configuration
# Supports both individual DB_* environment variables and full DATABASE_URL
import urllib.parse

db_host = os.getenv("DB_HOST")
db_user = os.getenv("DB_USER")
db_password = os.getenv("DB_PASSWORD", "")
db_port = os.getenv("DB_PORT", "3306")
db_name = os.getenv("DB_NAME")

if db_host and db_user and db_name:
    encoded_user = urllib.parse.quote_plus(db_user)
    encoded_pass = urllib.parse.quote_plus(db_password)
    raw_db_url = f"mysql+pymysql://{encoded_user}:{encoded_pass}@{db_host}:{db_port}/{db_name}?charset=utf8mb4"
else:
    raw_db_url = os.getenv(
        "DATABASE_URL", 
        "mysql+pymysql://root:root@localhost:3306/Smartpos?charset=utf8mb4"
    )

# Render provides postgres:// which SQLAlchemy 2.0 requires as postgresql://
if raw_db_url.startswith("postgres://"):
    raw_db_url = raw_db_url.replace("postgres://", "postgresql://", 1)

DATABASE_URL = raw_db_url

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get db session in FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
