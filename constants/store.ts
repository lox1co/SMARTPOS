import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';
import { notifyLowStockIfNeeded } from './notifications';

// Keys used for on-device persistence (SecureStore for the token, AsyncStorage
// for the rest).
const TOKEN_KEY = 'smartpos_token';
const SESSION_KEY = 'smartpos_user_session';
const LOCAL_TXNS_KEY = 'smartpos_local_transactions';
const PENDING_CHECKOUTS_KEY = 'smartpos_pending_checkouts';

export interface Product {
  id: string;
  storeId?: string;
  name: string;
  price: number;
  costPrice: number;
  stock: number;
  lowStockAlert: number;
  sku: string;
  category: string;
  unit?: string; // e.g. "lb", "ea"
  taxRate: number; // e.g. 8%
  image?: string;
  isActive?: boolean;
}

export interface UserSession {
  id: string; // user_id
  storeId: string; // store_id
  userName: string;
  role: string; // 'owner' | 'manager' | 'cashier'
  shopName: string;
  shopCategory: string;
  phone: string;
  email: string;
  image?: string; // Profile Avatar (Base64 / URL)
  gstNumber?: string;
  businessAddress?: string;
  storePhone?: string;
  taxEnabled?: boolean;
  taxRate?: number;
  token?: string; // JWT bearer token issued by the backend on login
}

export interface BillItem {
  id?: number;
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
}

export interface GeneratedBill {
  store_id: string;
  invoice_number: string;
  shop_name: string;
  shop_address?: string;
  shop_phone?: string;
  gst_number?: string;
  cashier_name?: string;
  payment_method: string;
  payment_status: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  created_at: string;
  customer_name?: string;
  customer_phone?: string;
  customer_credit_balance?: number; // total outstanding balance owed by customer
  amount_paid?: number; // cash tendered by the customer (CASH sales)
  change_due?: number; // amount_paid - total, shown on the receipt
  pending?: boolean; // true if this sale hasn't reached the server yet
  client_id?: string; // local id used to reconcile a pending sale after sync
  items: BillItem[];
}

export interface CreditEntry {
  id: number;
  entry_type: 'DEBIT' | 'CREDIT'; // DEBIT = bought on credit (owes more); CREDIT = repayment
  amount: number;
  note?: string;
  invoice_number?: string;
  created_at: string;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  credit_balance: number; // positive => the customer owes the shop
  created_at?: string;
  entries?: CreditEntry[];
}

// Internal shape of a checkout request; also what we queue when offline.
interface CheckoutPayload {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method: string;
  payment_status: string;
  customer_name?: string;
  customer_phone?: string;
  items: { product_id: number; quantity: number; price: number }[];
}

interface PendingCheckout {
  clientId: string;
  payload: CheckoutPayload;
}

export interface ScannedItemPayload {
  product: Product;
  quantity: number;
}

class ProductStore {
  private products: Product[] = [];
  private listeners: (() => void)[] = [];
  private isSynced = false;
  public scannedItems: ScannedItemPayload[] = [];
  // No default session: identity comes only from a real login (or a previously
  // persisted real session in localStorage). Enforces backend authentication.
  private _currentUser: UserSession | null = null;

  // Resolves once any persisted session has been restored from device storage.
  // The splash screen awaits this before deciding where to route.
  public sessionReady: Promise<void>;

  // --- Token storage -------------------------------------------------------
  // The JWT is small and sensitive, so on native it lives in the OS keychain
  // via expo-secure-store. SecureStore isn't available on web, so fall back to
  // AsyncStorage there. The larger user object (may carry a base64 avatar that
  // can exceed SecureStore's ~2KB limit) always goes to AsyncStorage.
  private async saveToken(token: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
  }

  private async loadToken(): Promise<string | null> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return null;
      return AsyncStorage.getItem(TOKEN_KEY);
    }
    return SecureStore.getItemAsync(TOKEN_KEY);
  }

  private async clearToken(): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return;
      await AsyncStorage.removeItem(TOKEN_KEY);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  }

  private async loadSavedSession(): Promise<UserSession | null> {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return null;
    }
    try {
      const [token, userJson] = await Promise.all([
        this.loadToken(),
        AsyncStorage.getItem(SESSION_KEY),
      ]);
      if (userJson) {
        const user: UserSession = JSON.parse(userJson);
        if (token) user.token = token;
        // Only a session that still carries a token counts as logged in.
        if (user.token) return user;
      }
    } catch (e) {
      console.warn('Could not read saved session:', e);
    }
    return null;
  }

  private async persistSession(user: UserSession | null): Promise<void> {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }
    try {
      if (user) {
        const { token, ...rest } = user;
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(rest));
        if (token) await this.saveToken(token);
      } else {
        await AsyncStorage.removeItem(SESSION_KEY);
        await this.clearToken();
      }
    } catch (e) {
      console.warn('Could not persist session:', e);
    }
  }

  constructor() {
    this.sessionReady = this.bootstrap();
  }

  // Restore the persisted session + offline data, then kick off network syncs.
  // sessionReady resolves after local state is restored (not after the network
  // calls), so the UI can route immediately without waiting on connectivity.
  private async bootstrap(): Promise<void> {
    const [saved] = await Promise.all([
      this.loadSavedSession(),
      this.loadLocalTransactions(),
    ]);
    if (saved) {
      this._currentUser = saved;
    }
    this.notify();
    // Fire-and-forget network work; failures fall back to local state.
    this.syncProducts();
    this.syncUserProfile();
    this.flushPendingCheckouts();
  }

  // Convenience for callers that just want a boolean after restore completes.
  async isLoggedIn(): Promise<boolean> {
    await this.sessionReady;
    return !!this._currentUser?.token;
  }

  get currentUser(): UserSession | null {
    return this._currentUser;
  }

  set currentUser(user: UserSession | null) {
    this._currentUser = user;
    // Fire-and-forget persistence. Callers that must guarantee the write has
    // landed before navigating (login) should use login()/logout() instead.
    this.persistSession(user);
    this.isSynced = false; // reset sync state
    this.syncProducts(); // auto-sync products when user changes
    this.notify();
  }

  // Explicit login: persists the session (awaited) before returning, so a cold
  // start immediately after login still finds the token on disk.
  async login(user: UserSession): Promise<void> {
    if (this._currentUser?.storeId !== user.storeId) {
      // Store switched: clean out previous store's cached local transactions
      this.localTransactions = [];
      this.pendingCheckouts = [];
      await AsyncStorage.removeItem(LOCAL_TXNS_KEY).catch(() => {});
      await AsyncStorage.removeItem(PENDING_CHECKOUTS_KEY).catch(() => {});
    }
    this._currentUser = user;
    await this.persistSession(user);
    this.isSynced = false;
    this.notify();
    await this.syncProducts();
    this.flushPendingCheckouts();
  }

  // Explicit logout: clears the persisted session (awaited), cached transactions, and local catalog.
  async logout(): Promise<void> {
    this._currentUser = null;
    this.localTransactions = [];
    this.pendingCheckouts = [];
    await AsyncStorage.removeItem(LOCAL_TXNS_KEY).catch(() => {});
    await AsyncStorage.removeItem(PENDING_CHECKOUTS_KEY).catch(() => {});
    await this.persistSession(null);
    this.isSynced = false;
    this.products = [];
    this.notify();
  }

  async syncUserProfile() {
    if (!this._currentUser?.token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${this._currentUser.id}`, {
        headers: this.getHeaders(),
      });
      if (response.status === 401) {
        this.handleUnauthorized();
        return;
      }
      if (!response.ok) return;
      const data = await response.json();
      const updatedUser: UserSession = {
        id: data.id.toString(),
        storeId: data.store_id.toString(),
        userName: data.name,
        role: data.role,
        shopName: data.shop_name || this._currentUser?.shopName || 'SmartPOS Store',
        shopCategory: data.shop_category || this._currentUser?.shopCategory || 'Retail',
        phone: data.phone || this._currentUser?.phone || '',
        email: data.email_or_username,
        image: data.image !== undefined ? data.image : this._currentUser?.image,
        gstNumber: data.gst_number !== undefined ? data.gst_number : this._currentUser?.gstNumber,
        businessAddress: data.business_address !== undefined ? data.business_address : this._currentUser?.businessAddress,
        storePhone: data.store_phone !== undefined ? data.store_phone : this._currentUser?.storePhone,
        taxEnabled: data.tax_enabled !== undefined ? Boolean(data.tax_enabled) : (this._currentUser?.taxEnabled ?? true),
        taxRate: data.tax_rate !== undefined && data.tax_rate !== null ? parseFloat(data.tax_rate) : (this._currentUser?.taxRate ?? 8),
        token: this._currentUser.token,
      };
      this._currentUser = updatedUser;
      await this.persistSession(updatedUser);
      this.notify();
    } catch (err) {
      console.warn('User profile sync failed:', err);
    }
  }

  // Force logout when the backend rejects our token (missing/expired/invalid),
  // so the UI returns to login instead of silently showing stale data.
  // Sets the private field directly (not the setter) to avoid re-triggering a sync loop.
  private handleUnauthorized() {
    this._currentUser = null;
    this.localTransactions = [];
    this.pendingCheckouts = [];
    AsyncStorage.removeItem(LOCAL_TXNS_KEY).catch(() => {});
    AsyncStorage.removeItem(PENDING_CHECKOUTS_KEY).catch(() => {});
    this.persistSession(null);
    this.isSynced = false;
    this.products = [];
    this.notify();
  }

  getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    // Real auth: send the JWT bearer token. Identity (store_id / user_id) is derived
    // server-side from the verified token, not from client-supplied headers.
    if (this._currentUser?.token) {
      headers['Authorization'] = `Bearer ${this._currentUser.token}`;
    }
    return headers;
  }

  // Trigger API Sync
  async syncProducts() {
    if (!this._currentUser?.token) {
      // Not authenticated: nothing to sync. Clear any stale catalog.
      this.products = [];
      this.isSynced = true;
      this.notify();
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`, {
        headers: this.getHeaders(),
      });
      if (response.status === 401) {
        this.handleUnauthorized();
        return;
      }
      if (!response.ok) throw new Error('API fetch error');
      const data = await response.json();

      this.products = data.map((p: any) => ({
        id: p.id.toString(),
        storeId: p.store_id ? p.store_id.toString() : undefined,
        name: p.name,
        price: parseFloat(p.price),
        costPrice: parseFloat(p.cost_price),
        stock: parseFloat(p.stock),
        lowStockAlert: parseFloat(p.low_stock_alert),
        sku: p.sku,
        category: p.category,
        unit: p.unit || undefined,
        taxRate: parseFloat(p.tax_rate),
        image: p.image || undefined,
        isActive: p.is_active !== undefined ? Boolean(p.is_active) : true,
      }));
      
      this.isSynced = true;
      notifyLowStockIfNeeded(this.products);
      this.notify();
    } catch (err) {
      console.warn('API sync failed, using local store:', err);
    }
  }

  getProducts() {
    if (!this.isSynced) {
      this.syncProducts();
    }
    return this.products;
  }

  getProductById(id: string): Product | undefined {
    return this.products.find((p) => p.id === id);
  }

  async addProduct(product: Omit<Product, 'id'>) {
    const response = await fetch(`${API_BASE_URL}/api/products`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        name: product.name,
        sku: product.sku.toUpperCase(),
        price: product.price,
        cost_price: product.costPrice,
        stock: product.stock,
        low_stock_alert: product.lowStockAlert,
        category: product.category,
        unit: product.unit || null,
        tax_rate: product.taxRate,
        image: product.image || null,
      }),
    });

    if (response.status === 401) {
      this.handleUnauthorized();
      throw new Error('Session expired or unauthorized. Please log in again.');
    }

    if (!response.ok) {
      const errorDetail = await response.json().catch(() => ({}));
      throw new Error(errorDetail.detail || 'Failed to save product in database');
    }

    await this.syncProducts();
  }

  async bulkAddProducts(products: Omit<Product, 'id'>[]) {
    const payload = products.map((p) => ({
      name: p.name,
      sku: p.sku.toUpperCase(),
      price: p.price,
      cost_price: p.costPrice,
      stock: p.stock,
      low_stock_alert: p.lowStockAlert,
      category: p.category,
      unit: p.unit || null,
      tax_rate: p.taxRate,
      image: p.image || null,
    }));

    const response = await fetch(`${API_BASE_URL}/api/products/bulk`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ products: payload }),
    });

    if (response.status === 401) {
      this.handleUnauthorized();
      throw new Error('Session expired or unauthorized. Please log in again.');
    }

    if (!response.ok) {
      const errorDetail = await response.json().catch(() => ({}));
      throw new Error(errorDetail.detail || 'Failed to bulk import products in database');
    }

    const data = await response.json();
    await this.syncProducts();
    return data;
  }

  async updateProduct(id: string, updatedFields: Partial<Product>) {
    const bodyPayload: any = {};
    if (updatedFields.name !== undefined) bodyPayload.name = updatedFields.name;
    if (updatedFields.sku !== undefined) bodyPayload.sku = updatedFields.sku;
    if (updatedFields.price !== undefined) bodyPayload.price = updatedFields.price;
    if (updatedFields.costPrice !== undefined) bodyPayload.cost_price = updatedFields.costPrice;
    if (updatedFields.stock !== undefined) bodyPayload.stock = updatedFields.stock;
    if (updatedFields.lowStockAlert !== undefined) bodyPayload.low_stock_alert = updatedFields.lowStockAlert;
    if (updatedFields.category !== undefined) bodyPayload.category = updatedFields.category;
    if (updatedFields.unit !== undefined) bodyPayload.unit = updatedFields.unit || null;
    if (updatedFields.taxRate !== undefined) bodyPayload.tax_rate = updatedFields.taxRate;
    if (updatedFields.image !== undefined) bodyPayload.image = updatedFields.image || null;

    const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(bodyPayload),
    });

    if (response.status === 401) {
      this.handleUnauthorized();
      throw new Error('Session expired or unauthorized. Please log in again.');
    }

    if (!response.ok) {
      const errorDetail = await response.json().catch(() => ({}));
      throw new Error(errorDetail.detail || 'Failed to update product in database');
    }

    await this.syncProducts();
  }

  async deleteProduct(id: string) {
    const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (response.status === 401) {
      this.handleUnauthorized();
      throw new Error('Session expired or unauthorized. Please log in again.');
    }

    if (!response.ok) {
      const errorDetail = await response.json().catch(() => ({}));
      throw new Error(errorDetail.detail || 'Failed to delete product in database');
    }

    await this.syncProducts();
  }

  async updateUserProfile(updatedFields: Partial<UserSession>) {
    if (!this._currentUser) return;

    try {
      // 1. Update Store Details
      const storePayload: any = {};
      if (updatedFields.shopName !== undefined) storePayload.name = updatedFields.shopName;
      if (updatedFields.shopCategory !== undefined) storePayload.category = updatedFields.shopCategory;
      if (updatedFields.storePhone !== undefined || updatedFields.phone !== undefined) {
        storePayload.phone = updatedFields.storePhone || updatedFields.phone;
      }
      if (updatedFields.gstNumber !== undefined) storePayload.gst_number = updatedFields.gstNumber;
      if (updatedFields.businessAddress !== undefined) storePayload.address = updatedFields.businessAddress;
      if (updatedFields.taxEnabled !== undefined) storePayload.tax_enabled = updatedFields.taxEnabled;
      if (updatedFields.taxRate !== undefined) storePayload.tax_rate = updatedFields.taxRate;

      await fetch(`${API_BASE_URL}/api/stores/${this._currentUser.storeId}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(storePayload),
      });

      // 2. Update User Details
      const userPayload: any = {};
      if (updatedFields.userName !== undefined) userPayload.name = updatedFields.userName;
      if (updatedFields.phone !== undefined) userPayload.phone = updatedFields.phone;
      if (updatedFields.email !== undefined) userPayload.email_or_username = updatedFields.email;
      if (updatedFields.image !== undefined) userPayload.image = updatedFields.image;

      const userRes = await fetch(`${API_BASE_URL}/api/users/${this._currentUser.id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(userPayload),
      });

      if (userRes.ok) {
        const data = await userRes.json();
        const updatedUser: UserSession = {
          ...this._currentUser,
          id: data.id.toString(),
          storeId: data.store_id.toString(),
          userName: data.name,
          role: data.role,
          shopName: data.shop_name || updatedFields.shopName || this._currentUser.shopName || 'SmartPOS Store',
          shopCategory: data.shop_category || updatedFields.shopCategory || this._currentUser.shopCategory || 'Retail',
          phone: data.phone || updatedFields.phone || this._currentUser.phone || '',
          email: data.email_or_username || updatedFields.email || this._currentUser.email,
          image: data.image !== undefined ? data.image : (updatedFields.image !== undefined ? updatedFields.image : this._currentUser.image),
          gstNumber: data.gst_number !== undefined ? data.gst_number : (updatedFields.gstNumber !== undefined ? updatedFields.gstNumber : this._currentUser.gstNumber),
          businessAddress: data.business_address !== undefined ? data.business_address : (updatedFields.businessAddress !== undefined ? updatedFields.businessAddress : this._currentUser.businessAddress),
          storePhone: data.store_phone !== undefined ? data.store_phone : (updatedFields.storePhone !== undefined ? updatedFields.storePhone : this._currentUser.storePhone),
          taxEnabled: updatedFields.taxEnabled !== undefined ? updatedFields.taxEnabled : (data.tax_enabled !== undefined ? Boolean(data.tax_enabled) : this._currentUser.taxEnabled),
          taxRate: updatedFields.taxRate !== undefined ? updatedFields.taxRate : (data.tax_rate !== undefined && data.tax_rate !== null ? parseFloat(data.tax_rate) : this._currentUser.taxRate),
          token: this._currentUser.token,
        };
        this.currentUser = updatedUser;
      } else {
        this.currentUser = {
          ...this._currentUser,
          ...updatedFields,
          token: this._currentUser.token,
        };
      }
    } catch (err) {
      console.warn('API user update failed, falling back to local simulation:', err);
      this.currentUser = {
        ...this._currentUser,
        ...updatedFields,
        token: this._currentUser.token,
      };
    }
  }

  async restockProduct(id: string, qtyToAdd: number) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${id}/restock?qty=${qtyToAdd}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('API restock error');
      await this.syncProducts();
    } catch (err) {
      console.warn('API restock failed, falling back to local simulation:', err);
      this.products = this.products.map((p) =>
        p.id === id ? { ...p, stock: p.stock + qtyToAdd } : p
      );
      this.notify();
    }
  }

  private localTransactions: GeneratedBill[] = [];
  private pendingCheckouts: PendingCheckout[] = [];
  private isFlushing = false;

  // Normalize a raw bill/transaction payload from the API into a GeneratedBill.
  private mapBill(raw: any): GeneratedBill {
    return {
      store_id: raw.store_id,
      invoice_number: raw.invoice_number,
      shop_name: raw.shop_name || this._currentUser?.shopName || 'SmartPOS Store',
      shop_address: raw.shop_address || this._currentUser?.businessAddress,
      shop_phone: raw.shop_phone || this._currentUser?.phone,
      gst_number: raw.gst_number || this._currentUser?.gstNumber,
      cashier_name: raw.cashier_name || this._currentUser?.userName || 'Cashier',
      customer_name: raw.customer_name || undefined,
      customer_phone: raw.customer_phone || undefined,
      customer_credit_balance:
        raw.customer_credit_balance !== undefined && raw.customer_credit_balance !== null
          ? parseFloat(raw.customer_credit_balance)
          : undefined,
      payment_method: raw.payment_method,
      payment_status: raw.payment_status || 'PAID',
      subtotal: parseFloat(raw.subtotal) || 0,
      discount: parseFloat(raw.discount) || 0,
      tax: parseFloat(raw.tax) || 0,
      total: parseFloat(raw.total) || 0,
      created_at: raw.created_at,
      items: (raw.items || []).map((i: any) => ({
        id: i.id,
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: parseFloat(i.quantity) || 1,
        price: parseFloat(i.price) || 0,
      })),
    };
  }

  // --- Offline sales queue -------------------------------------------------
  // localTransactions is the recent-bill cache (survives restarts).
  // pendingCheckouts holds sales made while offline that still need to sync.
  private async loadLocalTransactions(): Promise<void> {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }
    try {
      const [txnsJson, pendingJson] = await Promise.all([
        AsyncStorage.getItem(LOCAL_TXNS_KEY),
        AsyncStorage.getItem(PENDING_CHECKOUTS_KEY),
      ]);
      if (txnsJson) this.localTransactions = JSON.parse(txnsJson);
      if (pendingJson) this.pendingCheckouts = JSON.parse(pendingJson);
    } catch (e) {
      console.warn('Could not load offline transactions:', e);
    }
  }

  private async saveLocalTransactions(): Promise<void> {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }
    try {
      // Cap the cache so device storage can't grow without bound.
      const trimmed = this.localTransactions.slice(0, 100);
      await AsyncStorage.setItem(LOCAL_TXNS_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Could not persist offline transactions:', e);
    }
  }

  private async savePendingCheckouts(): Promise<void> {
    if (Platform.OS === 'web' && typeof window === 'undefined') {
      return;
    }
    try {
      await AsyncStorage.setItem(PENDING_CHECKOUTS_KEY, JSON.stringify(this.pendingCheckouts));
    } catch (e) {
      console.warn('Could not persist pending checkouts:', e);
    }
  }

  // Number of offline sales still waiting to reach the server.
  getPendingCheckoutCount(): number {
    return this.pendingCheckouts.length;
  }

  // Replay queued offline sales. Safe to call repeatedly; no-ops while already
  // running, offline, or logged out. Stops at the first failure so ordering and
  // sequential invoice numbers are preserved.
  async flushPendingCheckouts(): Promise<void> {
    if (this.isFlushing) return;
    if (!this._currentUser?.token) return;
    if (this.pendingCheckouts.length === 0) return;
    this.isFlushing = true;
    try {
      const queue = [...this.pendingCheckouts];
      for (const pending of queue) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/checkout`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(pending.payload),
          });
          if (response.status === 401) {
            this.handleUnauthorized();
            break;
          }
          if (!response.ok) break; // transient/server error — retry later
          const synced = this.mapBill(await response.json());
          // Swap the local placeholder for the server's authoritative bill.
          this.localTransactions = this.localTransactions.map((b) =>
            b.client_id && b.client_id === pending.clientId
              ? { ...synced, client_id: pending.clientId, pending: false }
              : b
          );
          this.pendingCheckouts = this.pendingCheckouts.filter((p) => p.clientId !== pending.clientId);
          await Promise.all([this.savePendingCheckouts(), this.saveLocalTransactions()]);
        } catch {
          break; // still offline — try again on next trigger
        }
      }
      this.notify();
    } finally {
      this.isFlushing = false;
    }
  }

  // Fetch all or filtered transactions
  async fetchTransactions(filters?: {
    query?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<GeneratedBill[]> {
    const currentStoreId = this._currentUser?.storeId;
    try {
      const params = new URLSearchParams();
      if (filters?.query) params.append('query', filters.query);
      if (filters?.paymentMethod && filters.paymentMethod !== 'ALL') params.append('payment_method', filters.paymentMethod);
      if (filters?.startDate) params.append('start_date', filters.startDate);
      if (filters?.endDate) params.append('end_date', filters.endDate);
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const url = `${API_BASE_URL}/api/transactions${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) throw new Error('Failed to fetch transactions from server');
      const data = await response.json();

      const serverList: GeneratedBill[] = data.map((t: any) => this.mapBill(t));

      // Combine only with pending unsynced transactions that belong to the current store
      const existingInvoices = new Set(serverList.map((s) => s.invoice_number));
      const unsynced = this.localTransactions.filter(
        (l) => l.pending && (!currentStoreId || l.store_id === currentStoreId) && !existingInvoices.has(l.invoice_number)
      );
      return [...unsynced, ...serverList];
    } catch (err) {
      console.warn('API transactions fetch failed, using local in-memory fallback:', err);
      let results = this.localTransactions.filter(
        (t) => !currentStoreId || t.store_id === currentStoreId
      );
      if (filters?.paymentMethod && filters.paymentMethod !== 'ALL') {
        results = results.filter(
          (t) => t.payment_method.toUpperCase() === filters.paymentMethod?.toUpperCase()
        );
      }
      if (filters?.query) {
        const q = filters.query.toLowerCase();
        results = results.filter(
          (t) =>
            t.invoice_number.toLowerCase().includes(q) ||
            t.items.some((i) => i.product_name.toLowerCase().includes(q))
        );
      }
      return results;
    }
  }

  async fetchBill(invoiceNumber: string): Promise<GeneratedBill | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/bills/${encodeURIComponent(invoiceNumber)}`, {
        headers: this.getHeaders(),
      });
      if (response.ok) {
        return this.mapBill(await response.json());
      }
    } catch (e) {
      console.warn('Fetch bill API error:', e);
    }
    const currentStoreId = this._currentUser?.storeId;
    return this.localTransactions.find((t) => (!currentStoreId || t.store_id === currentStoreId) && t.invoice_number === invoiceNumber) || null;
  }

  // Unified Checkout & Bill Generator API call
  async checkoutOrder(
    subtotal: number,
    discount: number,
    tax: number,
    total: number,
    items: { product_id: string; product_name?: string; quantity: number; price: number }[],
    paymentMethod: string = 'CASH',
    options?: {
      customerName?: string;
      customerPhone?: string;
      amountPaid?: number; // cash tendered (CASH)
      paymentStatus?: string;
    }
  ): Promise<GeneratedBill> {
    const paymentStatus =
      options?.paymentStatus || (paymentMethod === 'CREDIT' ? 'CREDIT' : 'PAID');
    const payload: CheckoutPayload = {
      subtotal,
      discount,
      tax,
      total,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      customer_name: options?.customerName || undefined,
      customer_phone: options?.customerPhone || undefined,
      items: items.map(item => ({
        product_id: parseInt(item.product_id, 10),
        quantity: item.quantity,
        price: item.price,
      })),
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/checkout`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        this.handleUnauthorized();
        throw new Error('Session expired. Please log in again.');
      }
      if (!response.ok) {
        const errorDetail = await response.json().catch(() => ({}));
        throw new Error(errorDetail.detail || 'API checkout error');
      }

      const billData = this.mapBill(await response.json());
      if (options?.amountPaid !== undefined) {
        billData.amount_paid = options.amountPaid;
        billData.change_due = Math.max(0, options.amountPaid - total);
      }
      this.localTransactions.unshift(billData);
      await this.saveLocalTransactions();
      await this.syncProducts();
      this.notify();
      return billData;
    } catch (err) {
      // A rejected token is a real auth failure, not an offline condition —
      // surface it so the cashier re-authenticates instead of silently queuing.
      if (err instanceof Error && err.message.includes('Session expired')) {
        throw err;
      }
      console.warn('API checkout failed, queuing sale offline:', err);

      // Fallback: decrement stock locally and queue the sale for later sync.
      items.forEach(item => {
        this.products = this.products.map(p =>
          p.id === item.product_id ? { ...p, stock: Math.max(0, p.stock - item.quantity) } : p
        );
      });

      const clientId = `local-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const invoiceNumber = `OFFLINE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const fallbackBill: GeneratedBill = {
        store_id: this._currentUser?.storeId || 'DEMO-1001',
        invoice_number: invoiceNumber,
        shop_name: this._currentUser?.shopName || 'SmartPOS Store',
        shop_address: this._currentUser?.businessAddress || '',
        shop_phone: this._currentUser?.phone || '',
        gst_number: this._currentUser?.gstNumber || '',
        cashier_name: this._currentUser?.userName || 'Store Cashier',
        customer_name: options?.customerName || undefined,
        customer_phone: options?.customerPhone || undefined,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        subtotal,
        discount,
        tax,
        total,
        amount_paid: options?.amountPaid,
        change_due:
          options?.amountPaid !== undefined ? Math.max(0, options.amountPaid - total) : undefined,
        created_at: new Date().toISOString(),
        pending: true,
        client_id: clientId,
        items: items.map(i => ({
          product_id: parseInt(i.product_id, 10),
          product_name: i.product_name || `Product #${i.product_id}`,
          quantity: i.quantity,
          price: i.price,
        })),
      };
      this.localTransactions.unshift(fallbackBill);
      this.pendingCheckouts.push({ clientId, payload });
      await Promise.all([this.saveLocalTransactions(), this.savePendingCheckouts()]);
      this.notify();
      return fallbackBill;
    }
  }

  // --- Customers & credit (khata / udhaar) --------------------------------
  async fetchCustomers(): Promise<Customer[]> {
    if (!this._currentUser?.token) return [];
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers`, { headers: this.getHeaders() });
      if (response.status === 401) {
        this.handleUnauthorized();
        return [];
      }
      if (!response.ok) throw new Error('Failed to fetch customers');
      const data = await response.json();
      return data.map((c: any) => this.mapCustomer(c));
    } catch (err) {
      console.warn('Fetch customers failed:', err);
      return [];
    }
  }

  async createCustomer(name: string, phone?: string): Promise<Customer | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ name, phone: phone || null }),
      });
      if (!response.ok) {
        const e = await response.json().catch(() => ({}));
        throw new Error(e.detail || 'Failed to create customer');
      }
      const created = this.mapCustomer(await response.json());
      this.notify();
      return created;
    } catch (err) {
      console.warn('Create customer failed:', err);
      return null;
    }
  }

  async fetchCustomerLedger(id: number): Promise<Customer | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${id}`, { headers: this.getHeaders() });
      if (!response.ok) throw new Error('Failed to fetch customer');
      return this.mapCustomer(await response.json());
    } catch (err) {
      console.warn('Fetch customer ledger failed:', err);
      return null;
    }
  }

  // Record a repayment against a customer's outstanding credit.
  async recordCustomerPayment(id: number, amount: number, note?: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/customers/${id}/payment`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ amount, note: note || null }),
      });
      if (!response.ok) throw new Error('Failed to record payment');
      this.notify();
      return true;
    } catch (err) {
      console.warn('Record payment failed:', err);
      return false;
    }
  }

  private mapCustomer(c: any): Customer {
    return {
      id: c.id,
      name: c.name,
      phone: c.phone || undefined,
      credit_balance: parseFloat(c.credit_balance) || 0,
      created_at: c.created_at,
      entries: (c.entries || []).map((e: any) => ({
        id: e.id,
        entry_type: e.entry_type,
        amount: parseFloat(e.amount) || 0,
        note: e.note || undefined,
        invoice_number: e.invoice_number || undefined,
        created_at: e.created_at,
      })),
    };
  }

  addScannedItem(product: Product, quantity: number = 1) {
    const pId = product.id.toString();
    const existing = this.scannedItems.find((item) => item.product.id.toString() === pId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      this.scannedItems.push({ product, quantity });
    }
    this.notify();
  }

  consumeScannedItems(): ScannedItemPayload[] {
    if (this.scannedItems.length === 0) return [];
    const items = [...this.scannedItems];
    this.scannedItems = [];
    return items;
  }

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }
}

export const store = new ProductStore();
