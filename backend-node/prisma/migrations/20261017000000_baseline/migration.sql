CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "stores" (
  "id" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "phone" VARCHAR(50) NOT NULL,
  "email" VARCHAR(255),
  "gst_number" VARCHAR(100),
  "address" TEXT,
  "tax_enabled" BOOLEAN NOT NULL DEFAULT true,
  "tax_rate" DECIMAL(5,2) DEFAULT 8.00,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "store_id" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "email_or_username" VARCHAR(255) NOT NULL,
  "password" VARCHAR(255) NOT NULL,
  "role" VARCHAR(50) NOT NULL DEFAULT 'cashier',
  "phone" VARCHAR(50),
  "image" TEXT,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
  "id" SERIAL NOT NULL,
  "store_id" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "cost_price" DECIMAL(10,2) NOT NULL,
  "stock" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "low_stock_alert" DECIMAL(10,3) NOT NULL DEFAULT 5,
  "category" VARCHAR(100) NOT NULL,
  "unit" VARCHAR(50) DEFAULT 'pcs',
  "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 8.00,
  "image" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "transactions" (
  "store_id" VARCHAR(100) NOT NULL,
  "invoice_number" VARCHAR(100) NOT NULL,
  "user_id" INTEGER,
  "customer_id" INTEGER,
  "customer_name" VARCHAR(255),
  "customer_phone" VARCHAR(50),
  "payment_method" VARCHAR(50) NOT NULL DEFAULT 'CASH',
  "payment_status" VARCHAR(50) NOT NULL DEFAULT 'PAID',
  "subtotal" DECIMAL(10,2) NOT NULL,
  "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "tax" DECIMAL(10,2) NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transactions_pkey" PRIMARY KEY ("store_id", "invoice_number")
);

CREATE TABLE "transaction_items" (
  "id" SERIAL NOT NULL,
  "store_id" VARCHAR(100) NOT NULL,
  "invoice_number" VARCHAR(100) NOT NULL,
  "product_id" INTEGER,
  "product_name" VARCHAR(255) NOT NULL,
  "quantity" DECIMAL(10,3) NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "transaction_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "customers" (
  "id" SERIAL NOT NULL,
  "store_id" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(50),
  "credit_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "credit_entries" (
  "id" SERIAL NOT NULL,
  "store_id" VARCHAR(100) NOT NULL,
  "customer_id" INTEGER NOT NULL,
  "entry_type" VARCHAR(10) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "note" TEXT,
  "invoice_number" VARCHAR(100),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_or_username_key" ON "users"("email_or_username");
CREATE INDEX "users_store_id_idx" ON "users"("store_id");
CREATE UNIQUE INDEX "unique_store_sku" ON "products"("store_id", "sku");
CREATE INDEX "products_store_id_is_active_idx" ON "products"("store_id", "is_active");
CREATE INDEX "transactions_store_id_created_at_idx" ON "transactions"("store_id", "created_at");
CREATE INDEX "transaction_items_store_id_invoice_number_idx" ON "transaction_items"("store_id", "invoice_number");
CREATE UNIQUE INDEX "unique_store_customer_name" ON "customers"("store_id", "name");
CREATE INDEX "customers_store_id_idx" ON "customers"("store_id");
CREATE INDEX "credit_entries_customer_id_created_at_idx" ON "credit_entries"("customer_id", "created_at");

ALTER TABLE "users" ADD CONSTRAINT "users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_store_id_invoice_number_fkey" FOREIGN KEY ("store_id", "invoice_number") REFERENCES "transactions"("store_id", "invoice_number") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_entries" ADD CONSTRAINT "credit_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
