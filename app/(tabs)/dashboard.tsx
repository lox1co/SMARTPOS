import {
  LocalizedText as Text,
  LocalizedTouchableOpacity as TouchableOpacity,
} from "@/components/i18n/LocalizedControls";
import { API_BASE_URL } from "@/constants/config";
import { store } from "@/constants/store";
import { translatePhrase } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

export default function DashboardScreen() {
  const router = useRouter();

  // Dashboard metrics state
  const [metrics, setMetrics] = useState({
    today_sales: 0,
    yesterday_sales: 0,
    sales_growth_percentage: 0,
    orders_count: 0,
    profit: 0,
    low_stock_alerts: [] as any[],
    recent_transactions: [] as any[],
    weekly_trend: [] as { day: string; date: string; amount: number }[],
  });

  const fetchDashboardMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
        headers: store.getHeaders(),
      });
      // ─── Fix 1: Explicit 401 guard ─────────────────────────────────────────
      // The dashboard calls fetch() directly (bypassing store.* methods), so a
      // 401 would previously be swallowed as a generic error and the user would
      // stay on screen seeing stale zeroes. We now detect the 401 explicitly,
      // call store.logout() to clear the session + fire notify(), which triggers
      // the root layout guard to redirect to /login.
      if (response.status === 401) {
        await store.logout();
        return;
      }
      if (!response.ok) throw new Error("Failed to fetch dashboard metrics");
      const data = await response.json();
      setMetrics({
        today_sales: parseFloat(data.today_sales || 0),
        yesterday_sales: parseFloat(data.yesterday_sales || 0),
        sales_growth_percentage: Number(data.sales_growth_percentage || 0),
        orders_count: Number(data.orders_count || 0),
        profit: parseFloat(data.profit || 0),
        low_stock_alerts: data.low_stock_alerts || [],
        recent_transactions: data.recent_transactions || [],
        weekly_trend: (data.weekly_trend || []).map((item: any) => ({
          day: translatePhrase(item.day),
          date: item.date,
          amount: parseFloat(item.amount || 0),
        })),
      });
    } catch (err) {
      console.warn("Could not load backend metrics, using dashboard mock fallbacks:", err);
    }
  };

  useEffect(() => {
    fetchDashboardMetrics();
    // Subscribe to store updates to auto-refresh metrics on checkouts/edits
    const unsubscribe = store.subscribe(() => {
      fetchDashboardMetrics();
    });
    return unsubscribe;
  }, []);

  // Generate SVG paths for dynamic 7-day revenue trend
  const generateChartPaths = () => {
    const data = metrics.weekly_trend || [];
    if (data.length === 0) {
      return {
        areaPath: "M 0 100 L 350 100 L 350 120 L 0 120 Z",
        linePath: "M 0 100 L 350 100",
      };
    }
    const amounts = data.map((d) => Number(d.amount) || 0);
    const maxVal = Math.max(...amounts, 1);
    const width = 350;
    const paddingBottom = 20;
    const paddingTop = 15;
    const chartHeight = 120 - paddingBottom - paddingTop;

    const stepX = data.length > 1 ? width / (data.length - 1) : width;
    const points = amounts.map((val, idx) => {
      const x = idx * stepX;
      const normalizedY = maxVal === 0 ? 0 : val / maxVal;
      const y = 120 - paddingBottom - normalizedY * chartHeight;
      return { x, y };
    });

    const linePath = points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}` : `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    }, "");

    const areaPath = `${linePath} L ${width} 120 L 0 120 Z`;
    return { areaPath, linePath };
  };

  const { areaPath, linePath } = generateChartPaths();
  const isPositiveGrowth = metrics.sales_growth_percentage >= 0;

  return (
    <SafeAreaView style={styles.outerContainer} edges={["top"]}>
      {/* Top App Bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SmartPOS</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIconButton} onPress={() => router.push("/scanner")}>
            <MaterialIcons name="qr-code-scanner" size={24} color="#004ac6" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.mainContainer}>
          {/* Summary Bento Grid */}
          <View style={styles.bentoGrid}>
            <View style={[styles.bentoCard, styles.salesCard]}>
              <Text style={styles.bentoLabel}>{"Today's Sales"}</Text>
              <Text style={styles.salesValue}>₹{metrics.today_sales.toFixed(2)}</Text>
              <View style={styles.trendContainer}>
                <MaterialIcons
                  name={isPositiveGrowth ? "trending-up" : "trending-down"}
                  size={16}
                  color={isPositiveGrowth ? "#006329" : "#ba1a1a"}
                />
                <Text style={[styles.trendText, { color: isPositiveGrowth ? "#006329" : "#ba1a1a" }]}>
                  {isPositiveGrowth && metrics.sales_growth_percentage > 0 ? "+" : ""}
                  {metrics.sales_growth_percentage.toFixed(1)}% vs yesterday
                </Text>
              </View>
            </View>

            <View style={styles.bentoRow}>
              <View style={[styles.bentoCard, styles.halfCard]}>
                <Text style={styles.bentoLabel}>Orders</Text>
                <Text style={styles.bentoValue}>{metrics.orders_count}</Text>
              </View>
              <View style={[styles.bentoCard, styles.halfCard]}>
                <Text style={styles.bentoLabel}>Profit</Text>
                <Text style={styles.bentoValue}>₹{metrics.profit.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Quick Actions Section */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionLabel}>Quick Actions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsScroll}>
              <TouchableOpacity
                style={[styles.actionButton, styles.primaryActionButton]}
                onPress={() => router.push("/billing")}
              >
                <MaterialIcons name="point-of-sale" size={24} color="#ffffff" style={styles.actionIcon} />
                <Text style={styles.primaryActionText}>New Sale</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/add_product")}>
                <MaterialIcons name="add-box" size={24} color="#131b2e" style={styles.actionIcon} />
                <Text style={styles.actionText}>Add Product</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/inventory")}>
                <MaterialIcons name="inventory" size={24} color="#131b2e" style={styles.actionIcon} />
                <Text style={styles.actionText}>Stock Entry</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/transactions" as any)}>
                <MaterialIcons name="receipt-long" size={24} color="#131b2e" style={styles.actionIcon} />
                <Text style={styles.actionText}>History</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/customers" as any)}>
                <MaterialIcons name="account-balance-wallet" size={24} color="#004ac6" style={styles.actionIcon} />
                <Text style={[styles.actionText, { color: "#004ac6", fontWeight: "600" }]}>Khata / Credit</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/reports" as any)}>
                <MaterialIcons name="assessment" size={24} color="#131b2e" style={styles.actionIcon} />
                <Text style={styles.actionText}>Reports</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Low Stock Alerts Card */}
          <View style={styles.alertsCard}>
            <View style={styles.alertsHeader}>
              <View style={styles.alertsTitleContainer}>
                <MaterialIcons name="warning" size={20} color="#ba1a1a" />
                <Text style={styles.alertsTitle}>Low Stock Alerts</Text>
              </View>
              <View style={styles.alertsBadge}>
                <Text style={styles.alertsBadgeText}>{metrics.low_stock_alerts.length} Items</Text>
              </View>
            </View>

            <View style={styles.alertList}>
              {metrics.low_stock_alerts.map((item, idx) => (
                <View
                  key={item.id}
                  style={[styles.alertItem, idx === metrics.low_stock_alerts.length - 1 && styles.lastAlertItem]}
                >
                  <Text style={styles.alertItemName}>{item.name}</Text>
                  <Text style={styles.alertItemQty}>{item.stock} left</Text>
                </View>
              ))}
              {metrics.low_stock_alerts.length === 0 && <Text style={styles.emptyAlertText}>No low stock alerts</Text>}
            </View>
          </View>

          {/* Revenue Trend Card */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Revenue Trend</Text>
            <View style={styles.chartContainer}>
              <Svg
                width="100%"
                height="100%"
                viewBox="0 0 350 120"
                preserveAspectRatio="none"
                style={{ overflow: "visible" }}
              >
                <Defs>
                  <LinearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#004ac6" stopOpacity="0.25" />
                    <Stop offset="1" stopColor="#004ac6" stopOpacity="0" />
                  </LinearGradient>
                </Defs>
                {/* Area under the line */}
                <Path d={areaPath} fill="url(#chartGrad)" />
                {/* Line Path */}
                <Path d={linePath} fill="none" stroke="#004ac6" strokeWidth="3" />
              </Svg>
            </View>
            <View style={styles.chartLabelsRow}>
              {metrics.weekly_trend.length > 0
                ? metrics.weekly_trend.map((trendItem, idx) => (
                    <Text key={idx} style={styles.chartLabel}>
                      {trendItem.day}
                    </Text>
                  ))
                : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, idx) => (
                    <Text key={idx} style={styles.chartLabel}>
                      {d}
                    </Text>
                  ))}
            </View>
          </View>

          {/* Recent Transactions Section */}
          <View style={styles.transactionsCard}>
            <View style={styles.transactionsHeader}>
              <Text style={styles.transactionsTitle}>Recent Transactions</Text>
              <TouchableOpacity onPress={() => router.push("/transactions" as any)}>
                <Text style={styles.seeAllLink}>See All</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.transactionList}>
              {metrics.recent_transactions.map((tx, idx) => {
                const dateObj = new Date(tx.created_at);
                const timeString = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <TouchableOpacity
                    key={tx.invoice_number || idx}
                    style={[
                      styles.transactionItem,
                      idx === metrics.recent_transactions.length - 1 && styles.lastTransactionItem,
                    ]}
                    onPress={() =>
                      router.push({ pathname: "/transactions" as any, params: { invoice: tx.invoice_number } })
                    }
                  >
                    <View style={styles.transactionIconContainer}>
                      <MaterialIcons name="receipt-long" size={20} color="#004ac6" />
                    </View>
                    <View style={styles.transactionDetails}>
                      <Text style={styles.transactionOrder}>{tx.invoice_number || `Order #${tx.id}`}</Text>
                      <Text style={styles.transactionTime}>
                        {timeString} • {tx.items_count} items {tx.payment_method ? `• ${tx.payment_method}` : ""}
                      </Text>
                    </View>
                    <Text style={styles.transactionAmount}>₹{parseFloat(tx.total).toFixed(2)}</Text>
                  </TouchableOpacity>
                );
              })}
              {metrics.recent_transactions.length === 0 && (
                <Text style={styles.emptyTransactionsText}>No recent transactions</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating Action Button (FAB) */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push("/add_product")}>
        <MaterialIcons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#faf8ff",
  },
  header: {
    height: 64,
    backgroundColor: "rgba(250, 248, 255, 0.8)",
    borderBottomWidth: 1,
    borderBottomColor: "#f2f3ff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  notificationBtn: {
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    backgroundColor: "#ba1a1a",
    borderRadius: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#004ac6",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingBottom: 130, // Safe padding so all content remains visible and clear of the FAB
  },
  mainContainer: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    gap: 16, // Consistent spacing matching bentoGrid gap (16px)
  },
  bentoGrid: {
    width: "100%",
    gap: 16,
  },
  bentoCard: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
    borderRadius: 12,
    padding: 16,
    shadowColor: "rgba(0,0,0,0.04)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  salesCard: {
    width: "100%",
  },
  bentoLabel: {
    fontSize: 14,
    color: "#434655",
    marginBottom: 4,
    fontWeight: "500",
  },
  salesValue: {
    fontSize: 36,
    fontWeight: "700",
    color: "#004ac6",
    letterSpacing: -0.5,
  },
  trendContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  trendText: {
    fontSize: 14,
    color: "#006329",
    fontWeight: "500",
    marginLeft: 4,
  },
  bentoRow: {
    flexDirection: "row",
    gap: 16,
    width: "100%",
  },
  halfCard: {
    flex: 1,
  },
  bentoValue: {
    fontSize: 32,
    fontWeight: "600",
    color: "#131b2e",
  },
  actionsSection: {
    width: "100%",
  },
  sectionLabel: {
    fontSize: 14,
    color: "#434655",
    fontWeight: "500",
    marginBottom: 8,
    paddingLeft: 4,
  },
  actionsScroll: {
    gap: 16,
    paddingBottom: 4,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#eaedff",
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.5)",
    paddingHorizontal: 16,
  },
  primaryActionButton: {
    backgroundColor: "#004ac6",
    borderColor: "#004ac6",
    shadowColor: "rgba(37,99,235,0.2)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 2,
  },
  actionIcon: {
    marginRight: 6,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#131b2e",
  },
  alertsCard: {
    width: "100%",
    backgroundColor: "rgba(250,218,214,0.3)",
    borderWidth: 1,
    borderColor: "#ffdad6",
    borderRadius: 12,
    padding: 16,
  },
  alertsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  alertsTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  alertsTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#ba1a1a",
  },
  alertsBadge: {
    backgroundColor: "#ba1a1a",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  alertsBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#ffffff",
  },
  alertList: {
    width: "100%",
  },
  alertItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,218,214,0.5)",
    paddingVertical: 8,
  },
  lastAlertItem: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  alertItemName: {
    fontSize: 16,
    color: "#131b2e",
  },
  alertItemQty: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ba1a1a",
  },
  emptyAlertText: {
    fontSize: 13,
    color: "#ba1a1a",
    paddingVertical: 8,
    fontWeight: "500",
  },
  chartCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
    borderRadius: 12,
    padding: 16,
    shadowColor: "rgba(0,0,0,0.04)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#131b2e",
    marginBottom: 16,
  },
  chartContainer: {
    width: "100%",
    height: 120,
  },
  chartLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingHorizontal: 4,
  },
  chartLabel: {
    fontSize: 12,
    color: "#737686",
  },
  transactionsCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
    borderRadius: 12,
    padding: 16,
    shadowColor: "rgba(0,0,0,0.04)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 2,
  },
  transactionsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  transactionsTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#131b2e",
  },
  seeAllLink: {
    fontSize: 14,
    color: "#004ac6",
    fontWeight: "600",
  },
  transactionList: {
    width: "100%",
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f3ff",
  },
  lastTransactionItem: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  transactionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#dae2fd",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionOrder: {
    fontSize: 14,
    fontWeight: "600",
    color: "#131b2e",
  },
  transactionTime: {
    fontSize: 12,
    color: "#434655",
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#131b2e",
  },
  emptyTransactionsText: {
    fontSize: 13,
    color: "#737686",
    paddingVertical: 12,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    bottom: 24, // Positioned 24px above bottom navigation bar
    right: 24, // 24px margin from right screen edge
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#004ac6",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "rgba(37,99,235,0.4)",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 6,
    zIndex: 999,
  },
});
