ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "tax_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "tax_rate" DECIMAL(5,2) DEFAULT 8.00;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "customer_id" INTEGER;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(255);
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "customer_phone" VARCHAR(50);

CREATE TABLE IF NOT EXISTS "customers" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "store_id" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(50),
  "credit_balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "unique_store_customer_name" UNIQUE ("store_id", "name"),
  CONSTRAINT "customers_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "credit_entries" (
  "id" SERIAL NOT NULL PRIMARY KEY,
  "store_id" VARCHAR(100) NOT NULL,
  "customer_id" INTEGER NOT NULL,
  "entry_type" VARCHAR(10) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "note" TEXT,
  "invoice_number" VARCHAR(100),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credit_entries_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "credit_entries_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "customers_store_id_idx" ON "customers"("store_id");
CREATE INDEX IF NOT EXISTS "credit_entries_customer_id_created_at_idx" ON "credit_entries"("customer_id", "created_at");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_customer_id_fkey') THEN
    ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
