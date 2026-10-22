import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5007),
  DATABASE_URL: z.url(),
  JWT_SECRET_KEY: z.string().min(32),
  JWT_EXPIRE_DAYS: z.coerce.number().int().min(1).max(365).default(7),
  ALLOWED_ORIGINS: z.string().default("http://localhost:8081,http://localhost:19006,http://localhost:3000"),
  APP_TIMEZONE: z.string().default("Asia/Kolkata"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

const parsed = environmentSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration: ${z.treeifyError(parsed.error).properties?.DATABASE_URL ? "DATABASE_URL is invalid" : parsed.error.message}`,
  );
}

export const config = {
  ...parsed.data,
  allowedOrigins: parsed.data.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
};
