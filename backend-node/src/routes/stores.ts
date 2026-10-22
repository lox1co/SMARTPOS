import bcrypt from "bcryptjs";
import { Router } from "express";
import { authenticate, requireManager } from "../auth.js";
import { prisma } from "../db.js";
import { HttpError, parse } from "../http.js";
import { staffSchema, storeUpdateSchema, userUpdateSchema } from "../schemas.js";
import { storeResponse, userResponse } from "../serializers.js";

export const storesRouter = Router();
storesRouter.use(authenticate);

storesRouter.post("/stores/:store_id/staff", requireManager, async (request, response) => {
  const storeId = request.params["store_id"]!;
  if (storeId !== request.auth!.storeId) throw new HttpError(403, "Unauthorized access to this store");
  const input = parse(staffSchema, request.body);
  const emailOrUsername = input.email_or_username.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { emailOrUsername } }))
    throw new HttpError(400, "Username or email is already in use");
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new HttpError(404, "Store not found");
  const user = await prisma.user.create({
    data: {
      storeId,
      name: input.name.trim(),
      emailOrUsername,
      password: await bcrypt.hash(input.password, 12),
      role: input.role,
      phone: input.phone?.trim() || null,
    },
    include: { store: true },
  });
  response.status(201).json(userResponse(user));
});

storesRouter.get("/stores/:store_id/staff", requireManager, async (request, response) => {
  const storeId = request.params["store_id"]!;
  if (storeId !== request.auth!.storeId) throw new HttpError(403, "Unauthorized access to this store");
  const users = await prisma.user.findMany({ where: { storeId }, include: { store: true }, orderBy: { id: "asc" } });
  response.json(users.map((user) => userResponse(user)));
});

storesRouter.put("/stores/:store_id", requireManager, async (request, response) => {
  const storeId = request.params["store_id"]!;
  if (storeId !== request.auth!.storeId) throw new HttpError(403, "Unauthorized access to this store");
  const input = parse(storeUpdateSchema, request.body);
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw new HttpError(404, "Store not found");
  const data = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.gst_number !== undefined ? { gstNumber: input.gst_number } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.tax_enabled !== undefined ? { taxEnabled: input.tax_enabled } : {}),
    ...(input.tax_rate !== undefined ? { taxRate: input.tax_rate } : {}),
  };
  response.json(storeResponse(await prisma.store.update({ where: { id: storeId }, data })));
});

storesRouter.get("/users/:user_id", async (request, response) => {
  const userId = Number(request.params.user_id);
  if (userId !== request.auth!.userId) throw new HttpError(404, "User not found in this store");
  const user = await prisma.user.findFirst({
    where: { id: userId, storeId: request.auth!.storeId },
    include: { store: true },
  });
  if (!user) throw new HttpError(404, "User not found in this store");
  response.json(userResponse(user));
});

storesRouter.put("/users/:user_id", async (request, response) => {
  const userId = Number(request.params.user_id);
  if (userId !== request.auth!.userId) throw new HttpError(403, "Cannot update another user's profile");
  const input = parse(userUpdateSchema, request.body);
  const emailOrUsername = input.email_or_username?.trim().toLowerCase();
  const user = await prisma.user.findFirst({ where: { id: userId, storeId: request.auth!.storeId } });
  if (!user) throw new HttpError(404, "User not found in this store");
  if (
    emailOrUsername &&
    emailOrUsername !== user.emailOrUsername &&
    (await prisma.user.findUnique({ where: { emailOrUsername } }))
  ) {
    throw new HttpError(400, "Username or Email already registered");
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.image !== undefined ? { image: input.image } : {}),
      ...(emailOrUsername !== undefined ? { emailOrUsername } : {}),
    },
    include: { store: true },
  });
  response.json(userResponse(updated));
});
