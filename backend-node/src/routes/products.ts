import { Router } from "express";
import type { z } from "zod";
import { authenticate, requireManager } from "../auth.js";
import { prisma } from "../db.js";
import { Prisma } from "../generated/prisma/client.js";
import { HttpError, parse } from "../http.js";
import { bulkProductsSchema, productSchema, productUpdateSchema } from "../schemas.js";
import { productResponse } from "../serializers.js";

export const productsRouter = Router();
productsRouter.use(authenticate);

function productData(input: z.infer<typeof productSchema>) {
  return {
    name: input.name,
    sku: input.sku.toUpperCase(),
    price: new Prisma.Decimal(input.price),
    costPrice: new Prisma.Decimal(input.cost_price),
    stock: new Prisma.Decimal(input.stock),
    lowStockAlert: new Prisma.Decimal(input.low_stock_alert),
    category: input.category,
    unit: input.unit ?? null,
    taxRate: new Prisma.Decimal(input.tax_rate),
    image: input.image ?? null,
    isActive: input.is_active,
  };
}

productsRouter.get("/products", async (request, response) => {
  const category = typeof request.query["category"] === "string" ? request.query["category"] : undefined;
  const query = typeof request.query["query"] === "string" ? request.query["query"].trim() : undefined;
  const products = await prisma.product.findMany({
    where: {
      storeId: request.auth!.storeId,
      isActive: true,
      ...(category && !["All", "All Items"].includes(category)
        ? { category: { equals: category, mode: "insensitive" } }
        : {}),
      ...(query
        ? {
            OR: [{ name: { contains: query, mode: "insensitive" } }, { sku: { contains: query, mode: "insensitive" } }],
          }
        : {}),
    },
    orderBy: { id: "asc" },
  });
  response.json(products.map(productResponse));
});

productsRouter.post("/products", requireManager, async (request, response) => {
  const input = parse(productSchema, request.body);
  const sku = input.sku.toUpperCase();
  const existing = await prisma.product.findFirst({ where: { storeId: request.auth!.storeId, sku, isActive: true } });
  if (existing) throw new HttpError(400, "SKU code already exists in your store catalog");
  const product = await prisma.product.create({ data: { ...productData(input), storeId: request.auth!.storeId } });
  response.status(201).json(productResponse(product));
});

productsRouter.post("/products/bulk", requireManager, async (request, response) => {
  const input = parse(bulkProductsSchema, request.body);
  const errors: string[] = [];
  let added = 0;
  for (const [index, item] of input.products.entries()) {
    const sku = item.sku.toUpperCase();
    const existing = await prisma.product.findFirst({ where: { storeId: request.auth!.storeId, sku } });
    if (existing) {
      errors.push(`Row ${index + 1}: SKU '${sku}' already exists.`);
      continue;
    }
    try {
      await prisma.product.create({ data: { ...productData({ ...item, sku }), storeId: request.auth!.storeId } });
      added += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        errors.push(`Row ${index + 1}: SKU '${sku}' already exists.`);
        continue;
      }
      throw error;
    }
  }
  response.status(201).json({ message: `Successfully imported ${added} products.`, added, errors });
});

productsRouter.put("/products/:product_id", requireManager, async (request, response) => {
  const productId = Number(request.params["product_id"]);
  const input = parse(productUpdateSchema, request.body);
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: request.auth!.storeId, isActive: true },
  });
  if (!product) throw new HttpError(404, "Product not found");
  const sku = input.sku?.toUpperCase();
  if (
    sku &&
    sku !== product.sku &&
    (await prisma.product.findFirst({ where: { storeId: request.auth!.storeId, sku, isActive: true } }))
  ) {
    throw new HttpError(400, "SKU code already exists in your store catalog");
  }
  const data = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(sku !== undefined ? { sku } : {}),
    ...(input.price !== undefined ? { price: new Prisma.Decimal(input.price) } : {}),
    ...(input.cost_price !== undefined ? { costPrice: new Prisma.Decimal(input.cost_price) } : {}),
    ...(input.stock !== undefined ? { stock: new Prisma.Decimal(input.stock) } : {}),
    ...(input.low_stock_alert !== undefined ? { lowStockAlert: new Prisma.Decimal(input.low_stock_alert) } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    ...(input.unit !== undefined ? { unit: input.unit } : {}),
    ...(input.tax_rate !== undefined ? { taxRate: new Prisma.Decimal(input.tax_rate) } : {}),
    ...(input.image !== undefined ? { image: input.image } : {}),
    ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
  };
  response.json(productResponse(await prisma.product.update({ where: { id: product.id }, data })));
});

productsRouter.delete("/products/clear-all", requireManager, async (request, response) => {
  const active = await prisma.product.findMany({
    where: { storeId: request.auth!.storeId, isActive: true },
    select: { id: true, sku: true },
  });
  const timestamp = Math.floor(Date.now() / 1000);
  await prisma.$transaction(
    active.map((product) =>
      prisma.product.update({
        where: { id: product.id },
        data: { isActive: false, sku: `${product.sku.slice(0, 75)}#DEL_${timestamp}_${product.id}` },
      }),
    ),
  );
  response.json({ message: `Successfully removed ${active.length} products from catalog` });
});

productsRouter.delete("/products/:product_id", requireManager, async (request, response) => {
  const productId = Number(request.params["product_id"]);
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: request.auth!.storeId, isActive: true },
  });
  if (!product) throw new HttpError(404, "Product not found");
  await prisma.product.update({
    where: { id: product.id },
    data: { isActive: false, sku: `${product.sku.slice(0, 80)}#DEL_${Math.floor(Date.now() / 1000)}` },
  });
  response.status(204).end();
});

productsRouter.post("/products/:product_id/restock", requireManager, async (request, response) => {
  const productId = Number(request.params["product_id"]);
  const quantity = Number(request.query["qty"]);
  if (!Number.isInteger(quantity) || quantity <= 0) throw new HttpError(422, "qty must be a positive integer");
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId: request.auth!.storeId, isActive: true },
  });
  if (!product) throw new HttpError(404, "Product not found");
  const updated = await prisma.product.update({ where: { id: product.id }, data: { stock: { increment: quantity } } });
  response.json(productResponse(updated));
});
