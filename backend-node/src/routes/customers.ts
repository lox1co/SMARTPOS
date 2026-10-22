import { Router } from "express";
import { authenticate } from "../auth.js";
import { prisma } from "../db.js";
import { Prisma } from "../generated/prisma/client.js";
import { HttpError, parse } from "../http.js";
import { customerSchema, paymentSchema } from "../schemas.js";

export const customersRouter = Router();
customersRouter.use(authenticate);

function serializeCustomer(customer: {
  id: number;
  storeId: string;
  name: string;
  phone: string | null;
  creditBalance: Prisma.Decimal;
  createdAt: Date;
  entries?: {
    id: number;
    entryType: string;
    amount: Prisma.Decimal;
    note: string | null;
    invoiceNumber: string | null;
    createdAt: Date;
  }[];
}) {
  return {
    id: customer.id,
    store_id: customer.storeId,
    name: customer.name,
    phone: customer.phone,
    credit_balance: customer.creditBalance,
    created_at: customer.createdAt,
    entries:
      customer.entries?.map((entry) => ({
        id: entry.id,
        entry_type: entry.entryType,
        amount: entry.amount,
        note: entry.note,
        invoice_number: entry.invoiceNumber,
        created_at: entry.createdAt,
      })) ?? [],
  };
}

customersRouter.get("/customers", async (request, response) => {
  const query = typeof request.query["query"] === "string" ? request.query["query"].trim() : "";
  const customers = await prisma.customer.findMany({
    where: {
      storeId: request.auth!.storeId,
      ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { phone: { contains: query } }] } : {}),
    },
    orderBy: { name: "asc" },
  });
  response.json(customers.map((customer) => serializeCustomer(customer)));
});

customersRouter.post("/customers", async (request, response) => {
  const input = parse(customerSchema, request.body);
  const storeId = request.auth!.storeId;
  let customer = await prisma.customer.findFirst({ where: { storeId, name: input.name } });
  if (!customer) {
    try {
      customer = await prisma.customer.create({
        data: { storeId, name: input.name, phone: input.phone?.trim() || null },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      customer = await prisma.customer.findFirst({ where: { storeId, name: input.name } });
    }
  } else if (input.phone?.trim() && !customer.phone) {
    customer = await prisma.customer.update({ where: { id: customer.id }, data: { phone: input.phone.trim() } });
  }
  if (!customer) throw new HttpError(500, "Could not create customer");
  const ledger = await prisma.customer.findUnique({
    where: { id: customer.id },
    include: { entries: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] } },
  });
  response.status(201).json(serializeCustomer(ledger!));
});

customersRouter.get("/customers/:customer_id", async (request, response) => {
  const customerId = Number(request.params["customer_id"]);
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId: request.auth!.storeId },
    include: { entries: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] } },
  });
  if (!customer) throw new HttpError(404, "Customer not found");
  response.json(serializeCustomer(customer));
});

customersRouter.post("/customers/:customer_id/payment", async (request, response) => {
  const customerId = Number(request.params["customer_id"]);
  const input = parse(paymentSchema, request.body);
  const storeId = request.auth!.storeId;
  const amount = new Prisma.Decimal(input.amount);
  const customer = await prisma.$transaction(async (tx) => {
    const found = await tx.customer.findFirst({ where: { id: customerId, storeId } });
    if (!found) throw new HttpError(404, "Customer not found");
    const update = await tx.customer.updateMany({
      where: { id: customerId, storeId, creditBalance: { gte: amount } },
      data: { creditBalance: { decrement: amount } },
    });
    if (update.count !== 1) throw new HttpError(400, "Payment amount exceeds the outstanding balance");
    await tx.creditEntry.create({
      data: {
        storeId,
        customerId,
        entryType: "CREDIT",
        amount,
        note: input.note?.trim() || "Payment received",
      },
    });
    return tx.customer.findUnique({
      where: { id: customerId },
      include: { entries: { orderBy: [{ createdAt: "desc" }, { id: "desc" }] } },
    });
  });
  if (!customer) throw new HttpError(404, "Customer not found");
  response.json(serializeCustomer(customer));
});
