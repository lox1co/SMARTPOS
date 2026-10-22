import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { errorHandler } from "./http.js";
import { authRouter } from "./routes/auth.js";
import { customersRouter } from "./routes/customers.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { productsRouter } from "./routes/products.js";
import { storesRouter } from "./routes/stores.js";
import { transactionsRouter } from "./routes/transactions.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.NODE_ENV === "production" ? 1 : false);
  app.use(helmet());
  app.use(
    cors({
      origin: config.allowedOrigins,
      credentials: false,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type"],
    }),
  );
  app.use(express.json({ limit: "5mb" }));
  app.use(pinoHttp({ level: config.LOG_LEVEL, redact: ["req.headers.authorization", "req.headers.cookie"] }));
  app.use("/api", rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));

  app.get("/", (_request, response) =>
    response.json({ status: "online", service: "SmartPOS Backend API", version: "3.0.0", docs: "/docs" }),
  );
  app.get("/health/live", (_request, response) => response.json({ status: "ok" }));
  app.get("/health/ready", async (_request, response) => {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: "ok", database: "connected" });
  });
  app.get("/docs", (_request, response) =>
    response.json({
      service: "SmartPOS API",
      authentication: "Authorization: Bearer <token>",
      endpoints: [
        "GET /api/stores/verify/:store_id",
        "POST /api/signup",
        "POST /api/login",
        "GET|POST /api/stores/:store_id/staff",
        "PUT /api/stores/:store_id",
        "GET|PUT /api/users/:user_id",
        "GET|POST /api/products",
        "POST /api/products/bulk",
        "PUT|DELETE /api/products/:product_id",
        "DELETE /api/products/clear-all",
        "POST /api/products/:product_id/restock",
        "POST /api/checkout",
        "GET /api/bills/:invoice_number",
        "GET /api/transactions",
        "GET|POST /api/customers",
        "GET /api/customers/:customer_id",
        "POST /api/customers/:customer_id/payment",
        "GET /api/dashboard",
      ],
    }),
  );
  app.use("/api", authRouter);
  app.use("/api", storesRouter);
  app.use("/api", productsRouter);
  app.use("/api", transactionsRouter);
  app.use("/api", customersRouter);
  app.use("/api", dashboardRouter);
  app.use((_request, response) => response.status(404).json({ detail: "Not found" }));
  app.use(errorHandler);
  return app;
}
