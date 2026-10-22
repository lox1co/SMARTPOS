import { Router } from "express";
import { authenticate } from "../auth.js";
import { prisma } from "../db.js";
import { Prisma } from "../generated/prisma/client.js";
import { businessDate, dayBounds } from "../time.js";

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get("/dashboard", async (request, response) => {
  const storeId = request.auth!.storeId;
  const today = businessDate();
  const yesterdayDate = new Date(`${today}T12:00:00.000Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = businessDate(yesterdayDate);
  const todayBounds = dayBounds(today);
  const yesterdayBounds = dayBounds(yesterday);

  const [todayAggregate, yesterdayAggregate, todayTransactions, lowStock, recent] = await Promise.all([
    prisma.transaction.aggregate({
      where: { storeId, createdAt: { gte: todayBounds.start, lte: todayBounds.end } },
      _sum: { total: true, discount: true },
      _count: { _all: true },
    }),
    prisma.transaction.aggregate({
      where: { storeId, createdAt: { gte: yesterdayBounds.start, lte: yesterdayBounds.end } },
      _sum: { total: true },
    }),
    prisma.transaction.findMany({
      where: { storeId, createdAt: { gte: todayBounds.start, lte: todayBounds.end } },
      include: { items: { include: { product: { select: { costPrice: true } } } } },
    }),
    prisma.product.findMany({
      where: { storeId, isActive: true, stock: { lte: prisma.product.fields.lowStockAlert } },
      orderBy: { stock: "asc" },
      take: 5,
    }),
    prisma.transaction.findMany({
      where: { storeId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: { select: { quantity: true } } },
    }),
  ]);

  const zero = new Prisma.Decimal(0);
  const todaySales = todayAggregate._sum.total ?? zero;
  const yesterdaySales = yesterdayAggregate._sum.total ?? zero;
  const growth = yesterdaySales.greaterThan(0)
    ? Number(todaySales.sub(yesterdaySales).div(yesterdaySales).mul(100).toDecimalPlaces(1))
    : todaySales.greaterThan(0)
      ? 100
      : 0;
  const grossMargin = todayTransactions.reduce(
    (sum, transaction) =>
      sum.add(
        transaction.items.reduce((lineSum, item) => {
          const cost = item.product?.costPrice ?? zero;
          return lineSum.add(item.price.sub(cost).mul(item.quantity));
        }, zero),
      ),
    zero,
  );
  const profit = Prisma.Decimal.max(zero, grossMargin.sub(todayAggregate._sum.discount ?? zero));

  const trend = await Promise.all(
    Array.from({ length: 7 }, async (_unused, index) => {
      const date = new Date(`${today}T12:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() - (6 - index));
      const day = businessDate(date);
      const bounds = dayBounds(day);
      const [aggregate, label] = await Promise.all([
        prisma.transaction.aggregate({
          where: { storeId, createdAt: { gte: bounds.start, lte: bounds.end } },
          _sum: { total: true },
        }),
        Promise.resolve(new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short" }).format(date)),
      ]);
      return { day: label, date: day, amount: aggregate._sum.total ?? zero };
    }),
  );

  response.json({
    today_sales: todaySales,
    yesterday_sales: yesterdaySales,
    sales_growth_percentage: growth,
    orders_count: todayAggregate._count._all,
    profit,
    low_stock_alerts: lowStock.map((product) => ({
      id: product.id,
      name: product.name,
      stock: product.stock,
      unit: product.unit ?? "pcs",
    })),
    recent_transactions: recent.map((transaction) => ({
      store_id: transaction.storeId,
      invoice_number: transaction.invoiceNumber,
      created_at: transaction.createdAt,
      items_count: Number(transaction.items.reduce((sum, item) => sum + Number(item.quantity), 0)),
      total: transaction.total,
      payment_method: transaction.paymentMethod,
    })),
    weekly_trend: trend,
  });
});
