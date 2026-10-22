import {
  LocalizedAlert as Alert,
  LocalizedText as Text,
  LocalizedTouchableOpacity as TouchableOpacity,
} from "@/components/i18n/LocalizedControls";
import { shareHtmlAsPdf, shareTextFile, toCsv } from "@/constants/export";
import { gstSplit } from "@/constants/receipt";
import { GeneratedBill, store } from "@/constants/store";
import { i18n, translatePhrase } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type RangeId = "today" | "7d" | "30d" | "month";

const RANGES: { id: RangeId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 Days" },
  { id: "30d", label: "30 Days" },
  { id: "month", label: "This Month" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const money = (n: number) => `₹${(n || 0).toFixed(2)}`;

// Resolve a preset into an inclusive local start/end of day.
function computeRange(id: RangeId): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let start: Date;
  if (id === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  } else if (id === "7d") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
  } else if (id === "30d") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }
  return { start, end };
}

export default function ReportsScreen() {
  const router = useRouter();
  const [rangeId, setRangeId] = useState<RangeId>("today");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [txns, setTxns] = useState<GeneratedBill[]>([]);

  const { start, end } = useMemo(() => computeRange(rangeId), [rangeId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Backend narrows by date; we still filter client-side so the totals are
      // exact regardless of how the server interprets the date bounds.
      const list = await store.fetchTransactions({
        startDate: ymd(start),
        endDate: ymd(end),
        limit: 1000,
      });
      const startMs = start.getTime();
      const endMs = end.getTime();
      const filtered = list.filter((t) => {
        const ms = new Date(t.created_at).getTime();
        return !isNaN(ms) && ms >= startMs && ms <= endMs;
      });
      setTxns(filtered);
    } catch {
      setTxns([]);
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    load();
  }, [load]);

  // Aggregate totals for the Z-report summary.
  const summary = useMemo(() => {
    let sales = 0;
    let sub = 0;
    let discount = 0;
    let tax = 0;
    let credit = 0;
    const byMethod: Record<string, { count: number; amount: number }> = {};
    txns.forEach((t) => {
      sales += t.total;
      sub += t.subtotal;
      discount += t.discount;
      tax += t.tax;
      if (t.payment_status === "CREDIT") credit += t.total;
      const key = t.payment_method || "OTHER";
      if (!byMethod[key]) byMethod[key] = { count: 0, amount: 0 };
      byMethod[key].count += 1;
      byMethod[key].amount += t.total;
    });
    const { cgst, sgst } = gstSplit(tax);
    return { sales, sub, discount, tax, cgst, sgst, credit, orders: txns.length, byMethod };
  }, [txns]);

  const rangeLabel = `${ymd(start)} → ${ymd(end)}`;

  const buildCsv = () => {
    const header = [
      translatePhrase("Invoice"),
      translatePhrase("Date"),
      translatePhrase("Customer"),
      translatePhrase("Payment"),
      translatePhrase("Status"),
      translatePhrase("Subtotal"),
      translatePhrase("Discount"),
      translatePhrase("Tax"),
      "CGST",
      "SGST",
      "Total",
    ];
    const rows: (string | number)[][] = [header];
    txns.forEach((t) => {
      const { cgst, sgst } = gstSplit(t.tax);
      rows.push([
        t.invoice_number,
        new Date(t.created_at).toLocaleString(i18n.resolvedLanguage || "en"),
        t.customer_name || "",
        translatePhrase(t.payment_method),
        translatePhrase(t.payment_status),
        t.subtotal.toFixed(2),
        t.discount.toFixed(2),
        t.tax.toFixed(2),
        cgst.toFixed(2),
        sgst.toFixed(2),
        t.total.toFixed(2),
      ]);
    });
    rows.push([]);
    rows.push([
      translatePhrase("TOTALS"),
      "",
      "",
      "",
      "",
      summary.sub.toFixed(2),
      summary.discount.toFixed(2),
      summary.tax.toFixed(2),
      summary.cgst.toFixed(2),
      summary.sgst.toFixed(2),
      summary.sales.toFixed(2),
    ]);
    return toCsv(rows);
  };

  const buildHtml = () => {
    const shop = store.currentUser?.shopName || "SmartPOS Store";
    const gstin = store.currentUser?.gstNumber;
    const methodRows = Object.entries(summary.byMethod)
      .map(
        ([m, v]) =>
          `<tr><td>${translatePhrase(m)}</td><td class="num">${v.count}</td><td class="num">${money(v.amount)}</td></tr>`,
      )
      .join("");
    const txnRows = txns
      .map((t) => {
        const { cgst, sgst } = gstSplit(t.tax);
        return `<tr>
          <td>${t.invoice_number}</td>
          <td>${new Date(t.created_at).toLocaleString(i18n.resolvedLanguage || "en")}</td>
          <td>${translatePhrase(t.payment_method)}${t.payment_status !== "PAID" ? ` (${translatePhrase(t.payment_status)})` : ""}</td>
          <td class="num">${money(cgst)}</td>
          <td class="num">${money(sgst)}</td>
          <td class="num">${money(t.total)}</td>
        </tr>`;
      })
      .join("");
    return `<!DOCTYPE html><html><head><meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Roboto, Arial, sans-serif; color: #111; padding: 24px; }
        h1 { font-size: 20px; margin: 0; }
        .muted { color: #555; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { text-align: left; font-size: 12px; padding: 6px 4px; border-bottom: 1px solid #ddd; }
        .num { text-align: right; white-space: nowrap; }
        .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 14px 0; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 10px 14px; min-width: 120px; }
        .card .k { font-size: 11px; color: #555; }
        .card .v { font-size: 18px; font-weight: 700; }
        h2 { font-size: 14px; margin: 18px 0 4px; }
      </style></head><body>
      <h1>${shop} — ${translatePhrase("Sales Report")}</h1>
      <div class="muted">${rangeLabel}${gstin ? ` · GSTIN: ${gstin}` : ""}</div>
      <div class="cards">
        <div class="card"><div class="k">${translatePhrase("Total Sales")}</div><div class="v">${money(summary.sales)}</div></div>
        <div class="card"><div class="k">${translatePhrase("Orders")}</div><div class="v">${summary.orders}</div></div>
        <div class="card"><div class="k">${translatePhrase("GST Collected")}</div><div class="v">${money(summary.tax)}</div></div>
        <div class="card"><div class="k">${translatePhrase("On Credit")}</div><div class="v">${money(summary.credit)}</div></div>
      </div>
      <h2>${translatePhrase("GST Summary")}</h2>
      <table><tr><td>CGST</td><td class="num">${money(summary.cgst)}</td></tr>
      <tr><td>SGST</td><td class="num">${money(summary.sgst)}</td></tr>
      <tr><td>${translatePhrase("Taxable Value")}</td><td class="num">${money(summary.sub - summary.discount)}</td></tr></table>
      <h2>${translatePhrase("By Payment Method")}</h2>
      <table><tr><th>${translatePhrase("Method")}</th><th class="num">${translatePhrase("Orders")}</th><th class="num">${translatePhrase("Amount")}</th></tr>${methodRows}</table>
      <h2>${translatePhrase("Transactions ({{number}})", { number: txns.length })}</h2>
      <table><tr><th>${translatePhrase("Invoice")}</th><th>${translatePhrase("Date")}</th><th>${translatePhrase("Payment")}</th><th class="num">CGST</th><th class="num">SGST</th><th class="num">${translatePhrase("Total")}</th></tr>${txnRows}</table>
      </body></html>`;
  };

  const handleExportCsv = async () => {
    if (txns.length === 0) {
      Alert.alert("Nothing to Export", "There are no sales in the selected range.");
      return;
    }
    setExporting(true);
    try {
      const uri = await shareTextFile(`sales-report-${ymd(start)}_to_${ymd(end)}.csv`, buildCsv(), "text/csv");
      if (!uri) Alert.alert("Not Available", "Sharing files is not supported on this platform.");
    } catch (e: any) {
      if (!/cancel|dismiss/i.test(e?.message || ""))
        Alert.alert("Export Failed", e?.message || "Could not export CSV.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (txns.length === 0) {
      Alert.alert("Nothing to Export", "There are no sales in the selected range.");
      return;
    }
    setExporting(true);
    try {
      const uri = await shareHtmlAsPdf(buildHtml(), translatePhrase("Sales Report"));
      if (!uri) Alert.alert("Not Available", "Sharing files is not supported on this platform.");
    } catch (e: any) {
      if (!/cancel|dismiss/i.test(e?.message || ""))
        Alert.alert("Export Failed", e?.message || "Could not export PDF.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#131b2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Range selector */}
      <View style={styles.rangeRow}>
        {RANGES.map((r) => {
          const active = rangeId === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.rangeChip, active && styles.rangeChipActive]}
              onPress={() => setRangeId(r.id)}
            >
              <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.rangeLabel}>{rangeLabel}</Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#004ac6" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Summary cards */}
          <View style={styles.cardsGrid}>
            <View style={[styles.summaryCard, styles.salesCard]}>
              <Text style={styles.summaryLabel}>Total Sales</Text>
              <Text style={styles.salesValue}>{money(summary.sales)}</Text>
              <Text style={styles.summarySub}>{summary.orders} orders</Text>
            </View>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, styles.halfCard]}>
                <Text style={styles.summaryLabel}>GST Collected</Text>
                <Text style={styles.summaryValue}>{money(summary.tax)}</Text>
              </View>
              <View style={[styles.summaryCard, styles.halfCard]}>
                <Text style={styles.summaryLabel}>On Credit</Text>
                <Text style={[styles.summaryValue, summary.credit > 0 && { color: "#ba1a1a" }]}>
                  {money(summary.credit)}
                </Text>
              </View>
            </View>
          </View>

          {/* GST split */}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>GST Summary</Text>
            <View style={styles.line}>
              <Text style={styles.lineKey}>CGST</Text>
              <Text style={styles.lineVal}>{money(summary.cgst)}</Text>
            </View>
            <View style={styles.line}>
              <Text style={styles.lineKey}>SGST</Text>
              <Text style={styles.lineVal}>{money(summary.sgst)}</Text>
            </View>
            <View style={styles.line}>
              <Text style={styles.lineKey}>Taxable Value</Text>
              <Text style={styles.lineVal}>{money(summary.sub - summary.discount)}</Text>
            </View>
          </View>

          {/* Payment method breakdown */}
          <View style={styles.block}>
            <Text style={styles.blockTitle}>By Payment Method</Text>
            {Object.entries(summary.byMethod).length === 0 ? (
              <Text style={styles.emptyText}>No sales in this range.</Text>
            ) : (
              Object.entries(summary.byMethod).map(([m, v]) => (
                <View key={m} style={styles.line}>
                  <Text style={styles.lineKey}>
                    {m} · {v.count}
                  </Text>
                  <Text style={styles.lineVal}>{money(v.amount)}</Text>
                </View>
              ))
            )}
          </View>

          {/* Export actions */}
          <View style={styles.exportRow}>
            <TouchableOpacity style={[styles.exportBtn, styles.csvBtn]} onPress={handleExportCsv} disabled={exporting}>
              <MaterialIcons name="table-chart" size={18} color="#006329" />
              <Text style={styles.csvBtnText}>Export CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.exportBtn, styles.pdfBtn]} onPress={handleExportPdf} disabled={exporting}>
              <MaterialIcons name="picture-as-pdf" size={18} color="#ffffff" />
              <Text style={styles.pdfBtnText}>Export PDF</Text>
            </TouchableOpacity>
          </View>
          {exporting && <Text style={styles.exportingNote}>Preparing file…</Text>}
          {Platform.OS === "web" && <Text style={styles.webNote}>File export/share requires the mobile app.</Text>}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#faf8ff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.25)",
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#131b2e" },
  rangeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  rangeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f3f3fa",
    alignItems: "center",
  },
  rangeChipActive: { backgroundColor: "#004ac6" },
  rangeChipText: { fontSize: 12, fontWeight: "600", color: "#434655" },
  rangeChipTextActive: { color: "#ffffff" },
  rangeLabel: {
    fontSize: 12,
    color: "#737686",
    textAlign: "center",
    marginTop: 8,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  cardsGrid: { gap: 12 },
  summaryCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
  },
  salesCard: { width: "100%" },
  summaryRow: { flexDirection: "row", gap: 12 },
  halfCard: { flex: 1 },
  summaryLabel: { fontSize: 13, color: "#434655", fontWeight: "500", marginBottom: 4 },
  salesValue: { fontSize: 32, fontWeight: "800", color: "#004ac6", letterSpacing: -0.5 },
  summarySub: { fontSize: 12, color: "#737686", marginTop: 4 },
  summaryValue: { fontSize: 20, fontWeight: "700", color: "#131b2e" },
  block: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
  },
  blockTitle: { fontSize: 15, fontWeight: "700", color: "#131b2e", marginBottom: 10 },
  line: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  lineKey: { fontSize: 13, color: "#434655" },
  lineVal: { fontSize: 13, fontWeight: "600", color: "#131b2e" },
  emptyText: { fontSize: 13, color: "#737686" },
  exportRow: { flexDirection: "row", gap: 12 },
  exportBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 10,
    gap: 8,
  },
  csvBtn: { backgroundColor: "#e6faee", borderWidth: 1, borderColor: "#bbf7d0" },
  csvBtnText: { fontSize: 14, fontWeight: "700", color: "#006329" },
  pdfBtn: { backgroundColor: "#004ac6" },
  pdfBtnText: { fontSize: 14, fontWeight: "700", color: "#ffffff" },
  exportingNote: { fontSize: 12, color: "#737686", textAlign: "center" },
  webNote: { fontSize: 12, color: "#92400e", textAlign: "center" },
});
