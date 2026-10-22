# SmartPOS System 🛍️

A modern, multi-tenant **Point of Sale (POS)**, **Inventory**, and **Khata (Credit Ledger)** management system built for retail stores, supermarkets, restaurants, and wholesale businesses.

Built with **React Native (Expo SDK 57)** for cross-platform mobile and web, backed by a **FastAPI** Python service with **PostgreSQL**.

---

## 🌟 Key Features

### 🛒 Point of Sale & Billing Register

- **Fast Checkout Register**: Interactive product grid with category filtering, real-time search, and instant cart management.
- **Barcode & QR Scanner**: Integrated camera barcode scanner (`expo-camera`) for rapid scanning and automatic item addition.
- **Fractional / Loose Units**: Full support for weighted and liquid items (`kg`, `g`, `l`, `ml`) with quick increment/decrement buttons.
- **Multi-Payment Modes**: Supports **Cash**, **UPI / QR Code**, **Card POS**, and **Khata Book (Credit)**.
- **Cash Tender & Change Due**: Real-time cash calculator displaying exact change due on receipt.
- **Discounts & Taxes**: Flexible percentage or flat discount calculations with automatic intra-state GST splits (CGST & SGST).

### 🖨️ Thermal Receipt Printing & PDF Export

- **Thermal Receipt Layout**: Formats receipts tailored for standard 58mm / 80mm thermal receipt printers.
- **Direct Printing & PDF**: Seamless Bluetooth/network printer integration via `expo-print` and instant PDF sharing via `expo-sharing`.
- **Custom Shop Header & Footer**: Displays store name, address, phone, GST number, cashier name, customer info, and custom greeting.

### 📶 Offline-First Sales Queue

- **Seamless Offline Billing**: When network drops or server is unreachable, sales continue locally without blocking the register.
- **Automatic Replay Sync**: Sales are queued in local persistent storage (`AsyncStorage`) with `OFFLINE-...` identifiers and automatically synchronized chronologically when internet reconnects.

### 📦 Inventory & Catalog Management

- **Live Stock Tracking**: Real-time stock counts, out-of-stock badges, and customizable low-stock threshold alerts.
- **Background Push Notifications**: Automated local notifications (`expo-notifications`) alerting store staff when items run low.
- **Quick Restock Modal**: Instant stock replenishment with preset unit increments (+5, +10, +25, +50, +100).
- **Soft Delete & SKU Tombstoning**: Deleted products preserve historical invoice links and prevent foreign-key constraints.

### 📥 Bulk Excel / CSV Import & Export

- **Excel & CSV Import**: Bulk add products with SheetJS (`xlsx`) and `papaparse`.
- **Download Template / Catalog**: Pre-built Excel template download with data validations and support for **`Image URL`**.
- **Wireless Barcode Scanning Guide**: Complete guide on preparing Excel sheets using your smartphone or handheld scanner: [BULK_IMPORT_GUIDE.md](file:///d:/zynocraft/POS/BULK_IMPORT_GUIDE.md).

### 📒 Customer Khata Book (Udhaar / Credit Ledger)

- **Credit Customer Accounts**: Maintain customer profiles with cumulative outstanding balances.
- **Automated Ledger Entries**: Credit purchases automatically record `DEBIT` entries; payments record `CREDIT` entries.
- **Repayment Tracking**: Record partial or full cash/UPI repayments with custom payment notes.

### 📊 Dashboard & Business Reports

- **Real-Time KPIs**: Today's revenue, yesterday's comparison, percentage growth, order volume, and net profit margin.
- **7-Day Trend Chart**: Interactive revenue visualization using smooth SVG bezier curves (`react-native-svg`).
- **GST & Sales Reports**: Date range presets (_Today_, _7 Days_, _30 Days_, _This Month_), CGST/SGST tax breakdown, and CSV/PDF export.

### 👥 Multi-Tenancy & Access Control

- **Store Join Codes**: Each store has a unique alphanumeric ID (e.g., `TGMAEX`). Staff can join using the store join code.
- **Role-Based Access**: Multi-user support with `owner`, `manager`, and `cashier` permissions.
- **Secure Authentication**: JWT bearer tokens stored securely via `expo-secure-store` on native devices. Passwords hashed with **Bcrypt**.

---

## 🛠️ Technology Stack

| Layer                   | Technologies                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Mobile & Web Client** | React Native 0.86.3, Expo SDK 57, React 19.2, TypeScript, Expo Router                                      |
| **Native Modules**      | `expo-print`, `expo-sharing`, `expo-camera`, `expo-notifications`, `expo-secure-store`, `expo-file-system` |
| **Backend API**         | Python 3.11+, FastAPI, Uvicorn, SQLAlchemy ORM, Pydantic v2                                                |
| **Database**            | PostgreSQL (Production on Render) / SQLite (Local development)                                             |
| **Authentication**      | JWT (HS256) with Bearer token authentication, Passlib (Bcrypt)                                             |
| **Spreadsheets**        | SheetJS (`xlsx`), `papaparse`, `exceljs`                                                                   |

---

## 📂 Project Structure

```
loxico/
├── app/                           # Expo Router screens (file-based navigation)
│   ├── _layout.tsx                # Root stack navigator with global auth guard
│   ├── index.tsx                  # Animated splash / bootstrap screen
│   ├── login.tsx                  # User login screen
│   ├── signup.tsx                 # Store registration & staff join-store
│   ├── scanner.tsx                # Fullscreen camera barcode scanner modal
│   ├── add_product.tsx            # Add / edit product modal
│   ├── customers.tsx              # Khata book & customer credit ledger
│   ├── reports.tsx                # GST tax and sales report generator
│   ├── transactions.tsx           # Order transaction history & receipts
│   └── (tabs)/                    # Main bottom-tab navigation
│       ├── _layout.tsx            # Tab bar navigation & theme styling
│       ├── dashboard.tsx          # Real-time KPIs, profit & 7-day revenue trend
│       ├── billing.tsx            # Core POS register, cart & checkout
│       ├── inventory.tsx          # Stock management & quick restock
│       ├── products.tsx           # Catalog list, search & bulk import/export
│       └── profile.tsx            # Shop profile, GST, staff & avatars
├── backend/                       # FastAPI Python backend
│   ├── main.py                    # REST API routes, auth, business logic & migrations
│   ├── models.py                  # SQLAlchemy relational database models
│   ├── schemas.py                 # Pydantic request/response schemas
│   ├── database.py                # Database connection & session lifecycle
│   ├── schema.sql                 # SQL schema reference
│   └── requirements.txt           # Python backend dependencies
├── constants/                     # Core app state, configs & utilities
│   ├── store.ts                   # Central ProductStore state, API layer & offline queue
│   ├── config.ts                  # API base URL, categories, units & presets
│   ├── receipt.ts                 # 58mm/80mm HTML thermal receipt builder & GST split
│   ├── export.ts                  # CSV & PDF report generator with file sharing
│   ├── notifications.ts           # Expo local notification scheduler for low stock
│   └── theme.ts                   # Design tokens, typography & color palette
├── assets/                        # Icons, logo, and pre-built templates
│   ├── images/                    # Launcher icons, splash screens & brand logo
│   └── products-template.xlsx     # Bundled Excel import template
└── scripts/                       # Build and generation utilities
    └── generate-template.js       # Generates products-template.xlsx with dropdowns
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or later
- **npm** or **yarn**
- **Python**: v3.10 or later (for backend)
- **Expo Go** app on Android/iOS (or Android Studio / Xcode simulator)

---

### 1. Frontend Setup (Client)

1. Navigate to the project directory:

   ```bash
   cd loxico
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the Expo development server:

   ```bash
   npx expo start
   ```

4. Run on your target platform:
   - Scan the QR code using the **Expo Go** app (Android) or Camera app (iOS).
   - Press **`a`** for Android emulator.
   - Press **`w`** for Web browser.

---

### 2. Backend Setup (API Service)

1. Open a new terminal and navigate to the `backend/` directory:

   ```bash
   cd loxico/backend
   ```

2. Create and activate a Python virtual environment:

   ```bash
   # Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables (create a `.env` file from `.env.example`):

   ```ini
   DATABASE_URL=sqlite:///./pos_database.db
   JWT_SECRET_KEY=your-super-secure-random-secret-key
   JWT_EXPIRE_DAYS=7
   ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006,http://localhost:3000
   APP_TIMEZONE=Asia/Kolkata
   ```

5. Run the FastAPI development server:

   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

6. Access the interactive API documentation at:
   - **Swagger UI**: `http://localhost:8000/docs`
   - **ReDoc**: `http://localhost:8000/redoc`

---

## ⚙️ Configuration & Environment

### Frontend Configuration ([`constants/config.ts`](constants/config.ts))

Configure the backend server URL for the client:

```typescript
export const API_BASE_URL = "https://possystem.zynocraftx.dev";
```

### Backend Environment Variables

| Variable          | Required   | Description                                  | Default                         |
| ----------------- | ---------- | -------------------------------------------- | ------------------------------- |
| `DATABASE_URL`    | Yes        | PostgreSQL connection string or SQLite path  | `sqlite:///./pos_database.db`   |
| `JWT_SECRET_KEY`  | Yes (Prod) | Secret key used to sign JWT bearer tokens    | Ephemeral dev key               |
| `JWT_EXPIRE_DAYS` | No         | Token lifetime in days                       | `7`                             |
| `ALLOWED_ORIGINS` | No         | Comma-separated CORS origins for web clients | `localhost:8081,localhost:3000` |
| `APP_TIMEZONE`    | No         | Business timezone for daily sales/metrics    | `Asia/Kolkata`                  |

---

## 📦 Useful Scripts

| Script                | Command                     | Description                                                        |
| --------------------- | --------------------------- | ------------------------------------------------------------------ |
| **Start Expo**        | `npm start`                 | Launches Metro bundler for Expo                                    |
| **Android**           | `npm run android`           | Launches app on connected Android device/emulator                  |
| **iOS**               | `npm run ios`               | Launches app on iOS simulator                                      |
| **Web**               | `npm run web`               | Launches web application in browser                                |
| **Lint**              | `npm run lint`              | Runs ESLint checks                                                 |
| **Generate Template** | `npm run generate:template` | Rebuilds `assets/products-template.xlsx` with dropdown validations |

---

## 📄 License

This project is proprietary and confidential. Developed by **loxico**. All rights reserved.
