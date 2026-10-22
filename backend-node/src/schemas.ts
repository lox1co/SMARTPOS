import { z } from "zod";

const optionalString = z.string().trim().nullable().optional();
const decimal = z.coerce.number().finite();
const newPassword = z
  .string()
  .min(6)
  .max(72)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Password must not exceed 72 bytes");

export const signupSchema = z.object({
  owner_name: z.string().trim().min(1).max(255),
  email_or_username: z.string().trim().min(3).max(255),
  password: newPassword,
  phone: z.string().trim().min(1).max(50),
  store_id: optionalString,
  role: z.string().optional(),
  shop_name: optionalString,
  shop_category: optionalString,
  gst_number: optionalString,
  business_address: optionalString,
});

export const loginSchema = z.object({
  email_or_username: z.string().trim().min(1).max(255),
  password: z.string().min(1).max(128),
});

export const staffSchema = z.object({
  name: z.string().trim().min(1).max(255),
  email_or_username: z.string().trim().min(3).max(255),
  password: newPassword,
  role: z.enum(["cashier", "manager"]).default("cashier"),
  phone: optionalString,
});

export const storeUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(1).max(50).optional(),
  email: optionalString,
  gst_number: optionalString,
  address: optionalString,
  tax_enabled: z.boolean().optional(),
  tax_rate: decimal.min(0).max(100).optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  phone: optionalString,
  email_or_username: z.string().trim().min(3).max(255).optional(),
  image: optionalString,
});

export const productSchema = z.object({
  name: z.string().trim().min(1).max(255),
  sku: z.string().trim().min(1).max(100),
  price: decimal.min(0),
  cost_price: decimal.min(0),
  stock: decimal,
  low_stock_alert: decimal.default(5),
  category: z.string().trim().min(1).max(100),
  unit: z.string().trim().max(50).nullable().optional(),
  tax_rate: decimal.min(0).max(100).default(8),
  image: optionalString,
  is_active: z.boolean().default(true),
});

export const productUpdateSchema = productSchema.partial();
export const bulkProductsSchema = z.object({ products: z.array(productSchema).max(1000) });

export const checkoutSchema = z.object({
  subtotal: decimal,
  discount: decimal,
  tax: decimal,
  total: decimal,
  payment_method: z.string().trim().min(1).max(50).default("CASH"),
  payment_status: z.string().trim().min(1).max(50).default("PAID"),
  customer_name: optionalString,
  customer_phone: optionalString,
  items: z
    .array(z.object({ product_id: z.coerce.number().int().positive(), quantity: decimal.positive(), price: decimal }))
    .min(1)
    .max(500),
});

export const customerSchema = z.object({ name: z.string().trim().min(1).max(255), phone: optionalString });
export const paymentSchema = z.object({ amount: decimal.positive(), note: optionalString });
