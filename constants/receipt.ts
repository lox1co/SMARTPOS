import { translatePhrase } from "@/i18n";
import type { GeneratedBill } from "./store";

/**
 * India GST split: for an intra-state sale the total GST is split evenly into
 * CGST + SGST. Inter-state IGST isn't modeled here (single-store retail
 * default). Rounded so the two halves always sum back to the original tax.
 */
export function gstSplit(tax: number): { cgst: number; sgst: number } {
  const safe = tax || 0;
  const half = Math.round((safe / 2) * 100) / 100;
  return { cgst: half, sgst: Math.round((safe - half) * 100) / 100 };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Deterministic bill date format: "DD <Full Month> YYYY, HH:MM AM/PM",
 * e.g. "08 September 2026, 02:30 PM". Built by hand instead of
 * toLocaleString so the output is identical on Android, iOS and web.
 */
export function formatBillDate(iso?: string | Date): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return String(iso);
  let hours = d.getHours();
  const ampm = translatePhrase(hours >= 12 ? "PM" : "AM");
  hours = hours % 12 || 12;
  return `${pad2(d.getDate())} ${translatePhrase(MONTH_NAMES[d.getMonth()])} ${d.getFullYear()}, ${pad2(hours)}:${pad2(d.getMinutes())} ${ampm}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return escapeHtml(iso);
  return escapeHtml(formatBillDate(d));
}

export interface ReceiptOptions {
  /** Currency symbol to render amounts with. Defaults to the rupee sign. */
  currency?: string;
}

/**
 * Build a self-contained HTML receipt for expo-print (print dialog or PDF).
 * No external assets/images — iOS WKWebView can't load local asset URLs when
 * printing HTML, so everything is inline text/CSS.
 */
export function buildReceiptHtml(bill: GeneratedBill, opts: ReceiptOptions = {}): string {
  const currency = opts.currency ?? "₹";
  const money = (n: number) => `${currency}${(n || 0).toFixed(2)}`;
  const hasGst = !!(bill.gst_number && String(bill.gst_number).trim());

  const itemRows = (bill.items || [])
    .map((it) => {
      const lineTotal = (it.price || 0) * (it.quantity || 0);
      return `
        <tr>
          <td class="name">${escapeHtml(it.product_name)}</td>
          <td class="num">${it.quantity ?? 0}</td>
          <td class="num">${money(it.price)}</td>
          <td class="num">${money(lineTotal)}</td>
        </tr>`;
    })
    .join("");

  const customerBlock =
    bill.customer_name || bill.customer_phone
      ? `<div class="row"><span>${escapeHtml(translatePhrase("Customer"))}</span><span>${escapeHtml(
          bill.customer_name || "",
        )}${bill.customer_phone ? ` · ${escapeHtml(bill.customer_phone)}` : ""}</span></div>`
      : "";

  const taxBlock =
    bill.tax && bill.tax > 0
      ? `<div class="row"><span>${escapeHtml(translatePhrase("Tax"))}</span><span>${money(bill.tax)}</span></div>`
      : "";

  const tenderedBlock =
    bill.amount_paid !== undefined
      ? `<div class="row"><span>${escapeHtml(translatePhrase("Cash tendered"))}</span><span>${money(bill.amount_paid)}</span></div>
        <div class="row"><span>${escapeHtml(translatePhrase("Change due"))}</span><span>${money(bill.change_due ?? 0)}</span></div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #111; margin: 0; padding: 24px; }
  .receipt { max-width: 380px; margin: 0 auto; }
  .center { text-align: center; }
  .shop { font-size: 20px; font-weight: 700; }
  .muted { color: #555; font-size: 12px; }
  .divider { border: none; border-top: 1px dashed #999; margin: 12px 0; }
  .row { display: flex; justify-content: space-between; font-size: 13px; margin: 3px 0; }
  .row span:last-child { text-align: right; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { text-align: left; font-size: 11px; color: #555; text-transform: uppercase; border-bottom: 1px solid #ccc; padding: 4px 0; }
  td { font-size: 13px; padding: 5px 0; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td.name { padding-right: 8px; }
  .total { font-size: 16px; font-weight: 700; }
  .badge { display: inline-block; font-size: 11px; padding: 2px 8px; border: 1px solid #999; border-radius: 999px; }
  .footer { margin-top: 16px; font-size: 12px; }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center">
      <div class="shop">${escapeHtml(bill.shop_name || "SmartPOS Store")}</div>
      ${bill.shop_address ? `<div class="muted">${escapeHtml(bill.shop_address)}</div>` : ""}
      ${bill.shop_phone ? `<div class="muted">${escapeHtml(translatePhrase("Ph:"))} ${escapeHtml(bill.shop_phone)}</div>` : ""}
      ${hasGst ? `<div class="muted">${escapeHtml(translatePhrase("GSTIN:"))} ${escapeHtml(bill.gst_number)}</div>` : ""}
    </div>
    <hr class="divider" />
    <div class="row"><span>${escapeHtml(translatePhrase("Invoice"))}</span><span>${escapeHtml(bill.invoice_number)}</span></div>
    <div class="row"><span>${escapeHtml(translatePhrase("Date"))}</span><span>${formatDate(bill.created_at)}</span></div>
    ${customerBlock}
    <table>
      <thead>
        <tr>
          <th>${escapeHtml(translatePhrase("Item"))}</th>
          <th class="num">${escapeHtml(translatePhrase("Qty"))}</th>
          <th class="num">${escapeHtml(translatePhrase("Unit Price"))}</th>
          <th class="num">${escapeHtml(translatePhrase("Amount"))}</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <hr class="divider" />
    <div class="row"><span>${escapeHtml(translatePhrase("Subtotal"))}</span><span>${money(bill.subtotal)}</span></div>
    ${bill.discount ? `<div class="row"><span>${escapeHtml(translatePhrase("Discount"))}</span><span>- ${money(bill.discount)}</span></div>` : ""}
    ${taxBlock}
    <div class="row total"><span>${escapeHtml(translatePhrase("Total"))}</span><span>${money(bill.total)}</span></div>
    ${tenderedBlock}
    ${
      bill.payment_method === "CREDIT" || bill.payment_status === "CREDIT" || bill.customer_credit_balance !== undefined
        ? `
    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 8px 10px; margin: 10px 0;">
      <div class="row" style="font-weight: 600; color: #b45309; margin: 2px 0;">
        <span>${escapeHtml(translatePhrase("Current Bill (Unpaid)"))}</span>
        <span>${money(bill.total)}</span>
      </div>
      ${
        bill.customer_credit_balance !== undefined
          ? `
      <div class="row" style="font-weight: 800; font-size: 14px; color: #92400e; margin-top: 5px; border-top: 1px dashed #fde68a; padding-top: 5px;">
        <span>${escapeHtml(translatePhrase("Total Outstanding Due"))}</span>
        <span>${money(bill.customer_credit_balance)}</span>
      </div>`
          : ""
      }
    </div>`
        : ""
    }
    <hr class="divider" />
    <div class="row">
      <span>${escapeHtml(translatePhrase("Payment"))}</span>
      <span><span class="badge">${escapeHtml(bill.payment_method)}</span> ${escapeHtml(bill.payment_status || "")}</span>
    </div>
    <div class="center footer">
      <div>${escapeHtml(translatePhrase("Thank you for your business!"))}</div>
      ${bill.pending ? `<div class="muted">${escapeHtml(translatePhrase("* Offline sale — pending sync"))}</div>` : ""}
    </div>
  </div>
</body>
</html>`;
}
