import { Router } from "express";
import { authenticate } from "../auth.js";
import { prisma } from "../db.js";
import { Prisma } from "../generated/prisma/client.js";
import { HttpError, parse } from "../http.js";
import { checkoutSchema } from "../schemas.js";
import { businessDate, businessDateTime } from "../time.js";

export const transactionsRouter = Router();
transactionsRouter.use(authenticate);

const transactionInclude = { items: true, cashier: true, store: true, customer: true } as const;

function serializeTransaction(
  transaction: Awaited<ReturnType<typeof prisma.transaction.findFirst>> & {
    items: {
      id: number;
      productId: number | null;
      productName: string;
      quantity: Prisma.Decimal;
      price: Prisma.Decimal;
    }[];
    cashier: { name: string } | null;
    store: { name: string; address: string | null; phone: string; gstNumber: string | null } | null;
    customer: { creditBalance: Prisma.Decimal } | null;
  },
) {
  if (!transaction) throw new HttpError(404, "Bill / Invoice not found");
  return {
    store_id: transaction.storeId,
    invoice_number: transaction.invoiceNumber,
    shop_name: transaction.store?.name ?? "SmartPOS Store",
    shop_address: transaction.store?.address ?? null,
    shop_phone: transaction.store?.phone ?? null,
    gst_number: transaction.store?.gstNumber ?? null,
    cashier_name: transaction.cashier?.name ?? null,
    customer_name: transaction.customerName,
    customer_phone: transaction.customerPhone,
    ...(transaction.customer ? { customer_credit_balance: transaction.customer.creditBalance } : {}),
    payment_method: transaction.paymentMethod,
    payment_status: transaction.paymentStatus || "PAID",
    subtotal: transaction.subtotal,
    discount: transaction.discount,
    tax: transaction.tax,
    total: transaction.total,
    created_at: transaction.createdAt,
    items: transaction.items.map((item) => ({
      id: item.id,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      price: item.price,
    })),
  };
}

transactionsRouter.post("/checkout", async (request, response) => {
  const input = parse(checkoutSchema, request.body);
  const storeId = request.auth!.storeId;
  const instant = new Date();
  const day = businessDate(instant).replaceAll("-", "");
  const now = businessDateTime(instant);
  const prefix = `INV-${day}-`;
  const normalizedName = input.customer_name?.trim() || "";
  const normalizedPhone = input.customer_phone?.trim() || "";

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${storeId}))`;
      const recentInvoices = await tx.transaction.findMany({
        where: { storeId, invoiceNumber: { startsWith: prefix } },
        select: { invoiceNumber: true },
      });
      const maxSequence = recentInvoices.reduce((max, item) => {
        const sequence = Number(item.invoiceNumber.slice(prefix.length));
        return Number.isSafeInteger(sequence) ? Math.max(max, sequence) : max;
      }, 0);
      const invoiceNumber = `${prefix}${String(maxSequence + 1).padStart(4, "0")}`;

      const store = await tx.store.findUnique({ where: { id: storeId } });
      if (!store) throw new HttpError(404, "Store not found");
      const cashier = await tx.user.findFirst({ where: { id: request.auth!.userId, storeId } });
      let customer = normalizedName ? await tx.customer.findFirst({ where: { storeId, name: normalizedName } }) : null;
      if (normalizedName && !customer) {
        customer = await tx.customer.create({
          data: { storeId, name: normalizedName, phone: normalizedPhone || null },
        });
      } else if (customer && normalizedPhone && !customer.phone) {
        customer = await tx.customer.update({ where: { id: customer.id }, data: { phone: normalizedPhone } });
      }

      let subtotal = new Prisma.Decimal(0);
      let tax = new Prisma.Decimal(0);
      const verifiedItems: {
        productId: number;
        productName: string;
        quantity: Prisma.Decimal;
        price: Prisma.Decimal;
      }[] = [];

      for (const item of input.items) {
        const product = await tx.product.findFirst({ where: { id: item.product_id, storeId, isActive: true } });
        if (!product) throw new HttpError(404, `Product ID ${item.product_id} not found in active store catalog`);
        const quantity = new Prisma.Decimal(item.quantity);
        const reserved = await tx.product.updateMany({
          where: { id: product.id, storeId, isActive: true, stock: { gte: quantity } },
          data: { stock: { decrement: quantity } },
        });
        if (reserved.count !== 1)
          throw new HttpError(400, `Insufficient stock for ${product.name}. Available: ${product.stock}`);

        const price = product.price;
        const lineSubtotal = price.mul(quantity);
        const taxRate = store.taxEnabled ? (store.taxRate ?? product.taxRate) : new Prisma.Decimal(0);
        subtotal = subtotal.add(lineSubtotal);
        tax = tax.add(lineSubtotal.mul(taxRate).div(100).toDecimalPlaces(2));
        verifiedItems.push({ productId: product.id, productName: product.name, quantity, price });
      }

      const discount = new Prisma.Decimal(input.discount);
      if (discount.isNegative()) throw new HttpError(422, "Discount cannot be negative.");
      if (discount.greaterThan(subtotal))
        throw new HttpError(422, `Discount (${discount}) exceeds order subtotal (${subtotal}).`);
      subtotal = subtotal.toDecimalPlaces(2);
      tax = tax.toDecimalPlaces(2);
      const total = subtotal.sub(discount).add(tax).toDecimalPlaces(2);

      const transaction = await tx.transaction.create({
        data: {
          storeId,
          invoiceNumber,
          userId: cashier?.id ?? null,
          customerId: customer?.id ?? null,
          customerName: normalizedName || null,
          customerPhone: normalizedPhone || null,
          paymentMethod: input.payment_method.toUpperCase(),
          paymentStatus: input.payment_status.toUpperCase(),
          subtotal,
          discount,
          tax,
          total,
          createdAt: now,
          items: {
            create: verifiedItems.map((item) => ({
              storeId,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              price: item.price,
            })),
          },
        },
        include: transactionInclude,
      });

      if (customer && transaction.paymentStatus === "CREDIT") {
        await tx.creditEntry.create({
          data: {
            storeId,
            customerId: customer.id,
            entryType: "DEBIT",
            amount: total,
            invoiceNumber,
            note: "Credit sale",
            createdAt: now,
          },
        });
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: { creditBalance: { increment: total } },
        });
      }
      return { transaction, customer };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10_000, timeout: 20_000 },
  );

  const payload = serializeTransaction(result.transaction);
  response
    .status(201)
    .json({ ...payload, ...(result.customer ? { customer_credit_balance: result.customer.creditBalance } : {}) });
});

transactionsRouter.get("/bills/:invoice_number", async (request, response) => {
  const transaction = await prisma.transaction.findUnique({
    where: {
      storeId_invoiceNumber: { storeId: request.auth!.storeId, invoiceNumber: request.params["invoice_number"]! },
    },
    include: transactionInclude,
  });
  if (!transaction) throw new HttpError(404, "Bill / Invoice not found");
  response.json(serializeTransaction(transaction));
});

transactionsRouter.get("/transactions", async (request, response) => {
  const query = typeof request.query["query"] === "string" ? request.query["query"].trim() : "";
  const paymentMethod =
    typeof request.query["payment_method"] === "string" ? request.query["payment_method"].toUpperCase() : "";
  const limit = Math.min(200, Math.max(1, Number(request.query["limit"] ?? 50) || 50));
  const offset = Math.max(0, Number(request.query["offset"] ?? 0) || 0);
  const startRaw = typeof request.query["start_date"] === "string" ? request.query["start_date"] : "";
  const endRaw = typeof request.query["end_date"] === "string" ? request.query["end_date"] : "";
  const start = startRaw
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(startRaw) ? `${startRaw}T00:00:00.000Z` : startRaw)
    : null;
  const end = endRaw ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(endRaw) ? `${endRaw}T23:59:59.999Z` : endRaw) : null;
  const where = {
    storeId: request.auth!.storeId,
    ...(paymentMethod && paymentMethod !== "ALL" ? { paymentMethod } : {}),
    ...(query ? { invoiceNumber: { contains: query, mode: "insensitive" as const } } : {}),
    ...(start && !Number.isNaN(start.getTime()) ? { createdAt: { gte: start } } : {}),
    ...(end && !Number.isNaN(end.getTime()) ? { createdAt: { lte: end } } : {}),
  };
  const transactions = await prisma.transaction.findMany({
    where,
    include: transactionInclude,
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
  });
  response.json(transactions.map(serializeTransaction));
});
