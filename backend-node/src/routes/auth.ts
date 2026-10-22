import bcrypt from "bcryptjs";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createHash, randomInt } from "node:crypto";
import { signAccessToken } from "../auth.js";
import { prisma } from "../db.js";
import { HttpError, parse } from "../http.js";
import { loginSchema, signupSchema } from "../schemas.js";
import { userResponse } from "../serializers.js";

export const authRouter = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const normalizeLogin = (value: string) => value.trim().toLowerCase();

authRouter.get("/stores/verify/:store_id", async (request, response) => {
  const storeId = request.params.store_id!.trim();
  const store = await prisma.store.findFirst({ where: { id: { in: [storeId, storeId.toUpperCase()] } } });
  if (!store) throw new HttpError(404, "No store found with this Join Code / Store ID");
  response.json({ id: store.id, name: store.name, category: store.category, phone: store.phone });
});

authRouter.post("/signup", authLimiter, async (request, response) => {
  const input = parse(signupSchema, request.body);
  const emailOrUsername = normalizeLogin(input.email_or_username);
  const existing = await prisma.user.findUnique({ where: { emailOrUsername } });
  if (existing) throw new HttpError(400, "Username or Email already registered");

  const result = await prisma.$transaction(async (tx) => {
    let storeId: string;
    let role: string;
    let store: Awaited<ReturnType<typeof tx.store.findUnique>>;

    if (input.store_id?.trim()) {
      store = await tx.store.findFirst({
        where: { id: { in: [input.store_id.trim(), input.store_id.trim().toUpperCase()] } },
      });
      if (!store)
        throw new HttpError(
          404,
          `Store not found with Join Code '${input.store_id.trim()}'. Please check with your store owner/manager.`,
        );
      storeId = store.id;
      role = "cashier";
    } else {
      const name = input.shop_name?.trim();
      const category = input.shop_category?.trim();
      if (!name) throw new HttpError(400, "Shop Name is required to register a new store");
      if (!category) throw new HttpError(400, "Shop Category is required to register a new store");
      const cleanPrefix = name
        .toUpperCase()
        .replace(/[^A-Z]/g, "")
        .slice(0, 4);
      const prefix = cleanPrefix.length < 3 ? `${cleanPrefix}STR`.slice(0, 3) : cleanPrefix;
      let candidate = "";
      for (let attempt = 0; attempt < 12; attempt += 1) {
        candidate = `${prefix}${Array.from({ length: 3 }, () => String.fromCharCode(randomInt(65, 91))).join("")}`;
        if (!(await tx.store.findUnique({ where: { id: candidate } }))) break;
      }
      if (await tx.store.findUnique({ where: { id: candidate } }))
        throw new HttpError(409, "Could not allocate a unique store ID");
      store = await tx.store.create({
        data: {
          id: candidate,
          name,
          category,
          phone: input.phone.trim(),
          email: emailOrUsername,
          gstNumber: input.gst_number?.trim() || null,
          address: input.business_address?.trim() || null,
        },
      });
      storeId = store.id;
      role = "owner";
    }

    const user = await tx.user.create({
      data: {
        storeId,
        name: input.owner_name.trim(),
        emailOrUsername,
        password: await bcrypt.hash(input.password, 12),
        role,
        phone: input.phone.trim() || null,
      },
      include: { store: true },
    });
    return { user, store };
  });

  response
    .status(201)
    .json(
      userResponse(
        result.user,
        signAccessToken({ userId: result.user.id, storeId: result.user.storeId, role: result.user.role }),
      ),
    );
});

authRouter.post("/login", authLimiter, async (request, response) => {
  const input = parse(loginSchema, request.body);
  const user = await prisma.user.findUnique({
    where: { emailOrUsername: normalizeLogin(input.email_or_username) },
    include: { store: true },
  });
  let isValid = false;
  let legacyHash = false;
  if (user) {
    if (/^[0-9a-f]{64}$/i.test(user.password)) {
      isValid = createHash("sha256").update(input.password).digest("hex") === user.password.toLowerCase();
      legacyHash = isValid;
    } else {
      isValid = await bcrypt.compare(input.password, user.password).catch(() => false);
    }
  }
  if (!user || !isValid) throw new HttpError(401, "Invalid username/email or password");
  if (legacyHash)
    await prisma.user.update({ where: { id: user.id }, data: { password: await bcrypt.hash(input.password, 12) } });
  if (!user.store) throw new HttpError(404, "Store associated with this account not found");
  response.json(userResponse(user, signAccessToken({ userId: user.id, storeId: user.storeId, role: user.role })));
});
