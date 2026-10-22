// export const API_BASE_URL = 'https://possystem.zynocraftx.dev';
export const API_BASE_URL = "http://192.168.100.9:5007";
export const SUPPORT_EMAIL = "zynocraftx@gmail.com";

// Single source of truth for product categories. Used by the Add/Edit Product
// form, the Products filter, and the Billing category tabs so a product saved
// under any category stays filterable everywhere.
export const PRODUCT_CATEGORIES = [
  "Grocery",
  "Snacks",
  "Beverages",
  "Dairy",
  "Produce",
  "Apparel",
  "Electronics",
  "Other",
] as const;

// Unit values accepted by the Add/Edit Product form and bulk import. Kept in
// sync with UNIT_OPTIONS in app/add_product.tsx.
export const PRODUCT_UNITS = ["pcs", "kg", "g", "pack", "box", "l", "ml"] as const;

export interface ShopCategoryItem {
  label: string;
  value: string;
  code: string;
  icon: string;
}

export const SHOP_CATEGORIES: readonly ShopCategoryItem[] = [
  { label: "Retail / Apparel", value: "Retail / Apparel", code: "retail", icon: "shopping-bag" },
  { label: "Food & Beverage", value: "Food & Beverage", code: "fnb", icon: "restaurant" },
  { label: "Grocery / Market", value: "Grocery / Market", code: "grocery", icon: "local-grocery-store" },
  { label: "Electronics / Tech", value: "Electronics / Tech", code: "electronics", icon: "devices" },
  { label: "Services & Repair", value: "Services", code: "services", icon: "build" },
  { label: "Pharmacy & Healthcare", value: "Pharmacy & Healthcare", code: "pharmacy", icon: "local-pharmacy" },
  { label: "Wholesale & Distribution", value: "Wholesale & Distribution", code: "wholesale", icon: "inventory" },
  { label: "Other Business", value: "Other", code: "other", icon: "storefront" },
] as const;

export const getShopCategoryLabel = (val?: string): string => {
  if (!val) return "Retail / Apparel";
  const found = SHOP_CATEGORIES.find(
    (c) =>
      c.value.toLowerCase() === val.toLowerCase() ||
      c.code.toLowerCase() === val.toLowerCase() ||
      c.label.toLowerCase() === val.toLowerCase(),
  );
  return found ? found.label : val;
};
