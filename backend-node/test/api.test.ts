import jwt from "jsonwebtoken";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { signAccessToken } from "../src/auth.js";
import { config } from "../src/config.js";
import { checkoutSchema, productSchema } from "../src/schemas.js";

test("health route is public and returns service status", async (context) => {
  const server = createServer(createApp());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(
    () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(`http://127.0.0.1:${address.port}/`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "online",
    service: "SmartPOS Backend API",
    version: "3.0.0",
    docs: "/docs",
  });
});

test("protected routes reject missing bearer tokens", async (context) => {
  const server = createServer(createApp());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(
    () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  );
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(`http://127.0.0.1:${address.port}/api/products`);
  assert.equal(response.status, 401);
  assert.equal(((await response.json()) as { detail: string }).detail, "Missing or invalid Authorization header");
});

test("new JWTs retain Python backend claims and HS256 signing", () => {
  const token = signAccessToken({ userId: 42, storeId: "STORE-1", role: "manager" });
  const payload = jwt.verify(token, config.JWT_SECRET_KEY, { algorithms: ["HS256"] });
  assert.equal(typeof payload, "object");
  if (typeof payload === "string") throw new Error("Unexpected JWT payload");
  assert.equal(payload["user_id"], 42);
  assert.equal(payload["store_id"], "STORE-1");
  assert.equal(payload["role"], "manager");
  assert.equal(payload.sub, "42");
});

test("validation rejects invalid inventory and checkout quantities", () => {
  const validProduct = productSchema.safeParse({
    name: "Tea",
    sku: "TEA-1",
    price: "12.50",
    cost_price: "8.00",
    stock: "3.000",
    category: "Grocery",
  });
  assert.equal(validProduct.success, true);

  const invalidCheckout = checkoutSchema.safeParse({
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    items: [{ product_id: 1, quantity: 0, price: 12 }],
  });
  assert.equal(invalidCheckout.success, false);
});
