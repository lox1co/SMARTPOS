import type { Customer, Product, Store, User } from "./generated/prisma/client.js";

type UserWithStore = User & { store?: Store | null };

export function storeResponse(store: Store) {
  return {
    id: store.id,
    name: store.name,
    category: store.category,
    phone: store.phone,
    email: store.email,
    gst_number: store.gstNumber,
    address: store.address,
    tax_enabled: store.taxEnabled,
    tax_rate: store.taxRate,
    created_at: store.createdAt,
  };
}

export function userResponse(user: UserWithStore, token?: string) {
  return {
    id: user.id,
    store_id: user.storeId,
    name: user.name,
    email_or_username: user.emailOrUsername,
    role: user.role,
    phone: user.phone,
    image: user.image,
    shop_name: user.store?.name ?? null,
    shop_category: user.store?.category ?? null,
    gst_number: user.store?.gstNumber ?? null,
    business_address: user.store?.address ?? null,
    store_phone: user.store?.phone ?? null,
    tax_enabled: user.store?.taxEnabled ?? true,
    tax_rate: user.store?.taxRate ?? "8.00",
    ...(token ? { token } : {}),
  };
}

export function productResponse(product: Product) {
  return {
    id: product.id,
    store_id: product.storeId,
    name: product.name,
    sku: product.sku,
    price: product.price,
    cost_price: product.costPrice,
    stock: product.stock,
    low_stock_alert: product.lowStockAlert,
    category: product.category,
    unit: product.unit,
    tax_rate: product.taxRate,
    image: product.image,
    is_active: product.isActive,
  };
}

export function customerResponse(customer: Customer, entries: unknown[] = []) {
  return {
    id: customer.id,
    store_id: customer.storeId,
    name: customer.name,
    phone: customer.phone,
    credit_balance: customer.creditBalance,
    created_at: customer.createdAt,
    entries,
  };
}
