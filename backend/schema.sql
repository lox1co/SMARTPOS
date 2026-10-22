-- Target database (uncomment if creating a fresh database, or import directly into your DB like autorevive_hr)
-- CREATE DATABASE IF NOT EXISTS autorevive_hr;
-- USE autorevive_hr;

create database Smartpos;
use Smartpos;
-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS credit_entries;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS transaction_items;
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS stores;

-- 1. Create stores table (id is VARCHAR alphanumeric)
CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NULL,
    gst_number VARCHAR(100) NULL,
    address TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create users table (multiple users/cashiers per store)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email_or_username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'cashier',
    phone VARCHAR(50) NULL,
    image TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
);

-- 3. Create customers table (Khata / Credit ledger accounts)
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    credit_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    UNIQUE KEY unique_store_customer_name (store_id, name)
);

-- 4. Create products table (multi-tenant per store) - No default sample products
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    cost_price DECIMAL(10, 2) NOT NULL,
    stock DECIMAL(10, 3) NOT NULL DEFAULT 0.000,
    low_stock_alert DECIMAL(10, 3) NOT NULL DEFAULT 5.000,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(50) DEFAULT 'pcs',
    tax_rate DECIMAL(5, 2) NOT NULL DEFAULT 8.00,
    image TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    UNIQUE KEY unique_store_sku (store_id, sku)
);

-- 5. Create transactions table (Composite Primary Key: store_id, invoice_number)
CREATE TABLE IF NOT EXISTS transactions (
    store_id VARCHAR(100) NOT NULL,
    invoice_number VARCHAR(100) NOT NULL,
    user_id INT NULL,
    customer_id INT NULL,
    customer_name VARCHAR(255) NULL,
    customer_phone VARCHAR(50) NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'CASH',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'PAID',
    subtotal DECIMAL(10, 2) NOT NULL,
    discount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tax DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (store_id, invoice_number),
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
);

-- 6. Create transaction_items table (Composite Foreign Key: store_id, invoice_number)
CREATE TABLE IF NOT EXISTS transaction_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,
    invoice_number VARCHAR(100) NOT NULL,
    product_id INT NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (store_id, invoice_number) REFERENCES transactions(store_id, invoice_number) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 7. Create credit_entries table (Audit ledger for Debits and Payments)
CREATE TABLE IF NOT EXISTS credit_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id VARCHAR(100) NOT NULL,
    customer_id INT NOT NULL,
    entry_type VARCHAR(10) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    note TEXT NULL,
    invoice_number VARCHAR(100) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

-- Seed Default Store (ID = 'DEMO-1001')
INSERT INTO stores (id, name, category, phone, email, gst_number, address)
VALUES ('DEMO-1001', 'Demo Supermart', 'Retail & Grocery', '+91 90000 00000', 'demo@example.com', '00AAAAA0000A1Z0', '1 Demo Street, Sample City, 000001')
ON DUPLICATE KEY UPDATE id=id;

-- Seed Store Owner and Cashier Users
-- Demo password for both accounts: "password"
INSERT INTO users (id, store_id, name, email_or_username, password, role, phone)
VALUES
(1, 'DEMO-1001', 'Demo Owner', 'owner@example.com', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'owner', '+91 90000 00001'),
(2, 'DEMO-1001', 'Demo Cashier', 'cashier@example.com', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 'cashier', '+91 90000 00002')
ON DUPLICATE KEY UPDATE id=id;
