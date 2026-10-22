import type { NextFunction, Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { config } from "./config.js";

export interface AuthClaims {
  userId: number;
  storeId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

export function signAccessToken(claims: AuthClaims): string {
  return jwt.sign({ user_id: claims.userId, store_id: claims.storeId, role: claims.role }, config.JWT_SECRET_KEY, {
    algorithm: "HS256",
    subject: String(claims.userId),
    expiresIn: `${config.JWT_EXPIRE_DAYS}d`,
  });
}

export function authenticate(request: Request, response: Response, next: NextFunction): void {
  const authorization = request.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    response.status(401).set("WWW-Authenticate", "Bearer").json({ detail: "Missing or invalid Authorization header" });
    return;
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET_KEY, { algorithms: ["HS256"] }) as JwtPayload;
    const userId = Number(payload["user_id"] ?? payload.sub);
    const storeId = payload["store_id"];
    if (!Number.isSafeInteger(userId) || userId < 1 || typeof storeId !== "string" || !storeId) {
      response.status(401).json({ detail: "Invalid authentication token" });
      return;
    }
    const role = payload["role"];
    request.auth = { userId, storeId, role: typeof role === "string" ? role : "cashier" };
    next();
  } catch (error) {
    const detail =
      error instanceof jwt.TokenExpiredError ? "Session expired. Please log in again." : "Invalid authentication token";
    response.status(401).json({ detail });
  }
}

export function requireManager(request: Request, response: Response, next: NextFunction): void {
  if (!request.auth || !["owner", "manager"].includes(request.auth.role)) {
    response.status(403).json({ detail: "Insufficient permissions" });
    return;
  }
  next();
}
