# SmartPOS — Deployment Guide

This guide covers redeploying the **FastAPI backend** (Render + Postgres) and rebuilding the
**Expo client** (EAS) for the release that adds the customer/credit (khata) ledger, GST reports,
real printing/PDF, cash-tender/change, and the offline sales queue.

> **Architecture at a glance**
>
> - **Client**: Expo SDK 57 app (`loxico/`), talks to the backend over HTTPS.
> - **Backend**: FastAPI + SQLAlchemy (`loxico/backend/`), deployed on Render at
>   `https://possystem.zynocraftx.dev` (see `constants/config.ts`).
> - **Database**: PostgreSQL on Render. (Local dev defaults to MySQL — see the note at the end.)
> - **Repo**: GitHub `Kaviyarasu24/POS`, default branch `main`.

---

## 0. ⚠️ Do this first — rotate exposed secrets

`backend/.env` is currently **committed to the GitHub repo**, so the live `DATABASE_URL`
(and any `JWT_SECRET_KEY` stored there) must be treated as compromised. Rotate before or
alongside this deploy:

1. **Rotate the database password.**
   Render dashboard → your Postgres instance → **reset/rotate the password** (or create a new DB
   user). Copy the new connection string.

2. **Set a fresh JWT secret.** Generate one:

   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   (Rotating this logs everyone out — the client detects the 401 and routes to login, so it's safe.)

3. **Stop tracking the file** so future pushes don't re-expose it:

   ```bash
   cd loxico
   git rm --cached backend/.env
   git commit -m "Stop tracking backend/.env (secrets moved to env vars)"
   ```

   `.gitignore` already ignores `.env`, so once untracked it stays out.

4. **Scrub it from history** (optional but recommended, since it's already on GitHub). Use
   [`git filter-repo`](https://github.com/newren/git-filter-repo) or the BFG, then force-push.
   Regardless of scrubbing, the **old credentials are burned** — only the rotated ones from steps
   1–2 should be live.

Secrets live **only** in Render's environment variables (below) and in a local, untracked
`backend/.env`. Never commit the real file. `backend/.env.example` documents the shape.

---

## 1. Backend → Render

### 1a. Service settings

If the service already exists, verify these; if creating fresh, set them:

| Setting        | Value                                          |
| -------------- | ---------------------------------------------- |
| Root directory | `backend`                                      |
| Runtime        | Python 3                                       |
| Build command  | `pip install -r requirements.txt`              |
| Start command  | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Auto-deploy    | On push to `main` (or deploy manually)         |

`$PORT` is injected by Render — don't hard-code it.

### 1b. Environment variables

Set these in Render → **Environment** (values from section 0):

| Key               | Required | Notes                                                                                                                  |
| ----------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`    | ✅       | The rotated Postgres URL. `postgres://` is auto-normalized to `postgresql://` in `database.py`.                        |
| `JWT_SECRET_KEY`  | ✅       | The rotated random string. If unset, the server uses an ephemeral key and **all tokens die on every restart**.         |
| `JWT_EXPIRE_DAYS` | optional | Token lifetime in days (default `7`).                                                                                  |
| `ALLOWED_ORIGINS` | web only | Comma-separated browser origins. Native builds ignore CORS; safe to leave at defaults if you only ship the mobile app. |

### 1c. Deploy

Push to `main` (auto-deploy) or click **Manual Deploy → Deploy latest commit**.

### 1d. The database migration runs automatically on boot

On startup `main.py`:

1. `models.Base.metadata.create_all()` — creates the **new** `customers` and `credit_entries` tables.
2. `_ensure_transaction_customer_columns()` — adds `customer_id`, `customer_name`, `customer_phone`
   to the existing `transactions` table via `ALTER TABLE … ADD COLUMN` (guarded by an inspector
   check; **idempotent and non-destructive** — existing rows/data are untouched).

Watch the deploy logs for either `Startup migration: added transactions.<col>` (first boot) or no
migration lines (already applied). If you see `could not add transactions.<col>`, the transactions
endpoints will fail until it's resolved — check the DB user has `ALTER` privileges.

> 💡 **Back up first.** Take a Render Postgres snapshot before deploying, so you can roll back the
> data if anything looks wrong.

### 1e. Verify

```bash
# Health
curl https://pos-x2jt.onrender.com/

# Auth-gated endpoints should 401 without a token (proves they're wired + protected)
curl -i https://pos-x2jt.onrender.com/api/customers
```

Then log in from the app and confirm a credit sale + payment (see section 3).

---

## 2. Client → EAS build

The client already points at the Render URL (`constants/config.ts` → `API_BASE_URL`). No code
change needed unless the backend URL changed.

```bash
cd loxico
npm install

# Internal test APK
eas build --platform android --profile preview

# Production APK (autoIncrement bumps versionCode on EAS)
eas build --platform android --profile production
```

Profiles are defined in `eas.json` (`preview` and `production` both build Android APKs;
`appVersionSource: "remote"` means EAS manages the version numbers).

> If you use EAS Update (OTA) for JS-only changes, publish with `eas update`. This release only
> touches JS/TS on the client (new screens + helpers, no new native modules beyond ones already in
> `package.json`), so an OTA update to an existing dev/preview build with the same native runtime is
> viable — but a fresh build is the safe default.

---

## 3. Post-deploy smoke test

Run through the features shipped in this release:

- [ ] **Login persists across restart** — log in, force-quit, reopen → still logged in.
- [ ] **Credit (khata) sale** — Billing → add items → **Credit** → enter/pick a customer → confirm.
- [ ] **Customers screen** — the customer shows the outstanding balance; open them → ledger shows a
      **DEBIT** for the sale.
- [ ] **Record payment** — record a repayment → balance drops, a **CREDIT** entry appears.
- [ ] **Cash tender / change due** — Cash sale, enter amount received → change due is correct.
- [ ] **Print + PDF** — a completed bill prints and shares as PDF; GSTIN present → receipt shows
      **CGST/SGST** split.
- [ ] **Reports** — Dashboard → Reports → pick a range → **Export CSV** and **Export PDF** both share.
- [ ] **Offline queue** — turn off networking, make a sale (queues), restore network → it syncs.

---

## 4. Rollback

- **Backend**: Render → **Deploys** → roll back to the previous deploy. The migration is additive,
  so old code runs fine against the new columns; restore the DB snapshot only if data is affected.
- **Client**: distribute the previous APK, or roll back the EAS Update channel.

---

## Notes & gotchas

- **`reinit_db.py` is local-only and destructive.** It connects to **MySQL** (via `pymysql`),
  recreates the `smartpossystem` database, and re-runs `schema.sql`. It is **not** compatible with
  the Render Postgres DB and must **never** be run against production. Use it only to reset a local
  MySQL dev database.
- **Local dev** defaults to `mysql+pymysql://root:root@localhost:3306/smartpossystem` when
  `DATABASE_URL` is unset (`database.py`). Point it at a local Postgres if you want parity with prod.
- **First request after a cold start is slow** on Render's free tier (the service spins down when
  idle). The client tolerates this, but expect a delay on the first call after inactivity.
