# SmartPOS API (Node.js + TypeScript)

Alternative implementation of `../backend` using Node.js 22+, Express 5, strict TypeScript, Zod, Prisma 7, PostgreSQL, JWT and bcryptjs. It keeps the mobile app's `/api/...` routes, snake_case request/response fields, `Authorization: Bearer` header, HS256 claims, and legacy SHA-256 password upgrade. The Python backend remains untouched and can be used as rollback during migration.

## Backend analysis

The Python API has 24 routes: store-code verification; signup/login; staff and store/profile management; product listing, create, bulk import, update, restock and soft-delete; checkout, bills and transaction history; customers, credit payments; and dashboard metrics. The business domain is multi-tenant around `store_id`, with decimal money/stock values, timezone-aware business-day reporting, and a credit ledger.

Notable issues addressed here:

- Signup into an existing store accepted a client-supplied role, including `owner`; profile updates also allowed role changes. The new API always assigns `cashier` when joining and never accepts role in self-profile updates.
- Any authenticated staff member could edit store settings and products. Store/product/staff writes are restricted to owners/managers; a user may only edit their own non-role profile.
- Checkout trusted client-calculated totals in the old request model and concurrent requests could oversell stock or collide on invoice IDs. The new checkout recalculates prices/tax/discount from the catalog and reserves stock conditionally inside a transaction with a per-store invoice lock.
- Credit payments could exceed the balance and make it negative. The new ledger rejects overpayment atomically.
- Dashboard/transaction listing performed repeated queries per row/day. This version batches the primary reads and uses aggregates where practical.
- `reinit_db.py` and `schema.sql` drop application tables and should never be used against production. The Node version uses additive Prisma migrations only.

The deployment guide says the old `backend/.env` was committed; assume any secrets in it are compromised. Rotate the database password and JWT secret independently of this migration.

## Run locally

Requires Node.js >=22.13 and PostgreSQL. From this directory:

```sh
npm install
Copy-Item .env.example .env
# Set DATABASE_URL and a random JWT_SECRET_KEY of at least 32 characters in .env
npm run db:dev -- --name baseline
npm run dev
```

The API listens on `http://localhost:5007` by default. `GET /` and `/health/live` are liveness checks, `/health/ready` checks PostgreSQL, and `/docs` returns the route catalog. Configure `ALLOWED_ORIGINS`, `APP_TIMEZONE`, and `PORT` through environment variables.

## Existing PostgreSQL database migration

Back up the production database first. Do not run `reinit_db.py` or import the destructive legacy `schema.sql`.

1. Set `DATABASE_URL` to the existing PostgreSQL database and verify it points to the intended environment.
2. Check the current columns/tables and run the additive SQL in `prisma/migrations/20261017000100_legacy_schema_compat/migration.sql` as a database migration. It adds only missing columns/tables and preserves existing rows.
3. Mark the baseline as already applied; it describes the complete model and must **not** execute against existing tables:

```sh
npx prisma migrate resolve --applied 20261017000000_baseline
npx prisma migrate deploy
```

4. Deploy with `npm run build` / `npm start`, check `/health/ready`, then exercise login, product list, a paid sale, a credit sale, and repayment against a staging copy before switching the client URL.

The existing and new APIs share the JWT secret and HS256 user/store/role claims, so existing tokens can be accepted during a controlled rolling migration if the secret and database user records are unchanged. Keep the same stable secret set in both deployments. SHA-256 legacy password hashes are upgraded to bcrypt on successful login. Existing bcrypt hashes remain verifiable.

For a fresh database, use `npm run db:dev` during development or `npm run db:migrate` for deploys. The baseline migration creates a complete schema. Never run `migrate dev` against production.

## Scripts

- `npm run dev`: watch mode via tsx.
- `npm run typecheck`: generate Prisma Client and run strict TypeScript checking.
- `npm run build`: generate client and compile to `dist/`.
- `npm test`: API/auth/schema smoke tests; no live database required.
- `npm run db:migrate`: apply committed migrations.

## Environment

See `.env.example`. Production requires `DATABASE_URL` and a stable random `JWT_SECRET_KEY` of at least 32 characters. Configuration is validated at process startup; missing or invalid settings stop the service rather than silently using a development secret.
