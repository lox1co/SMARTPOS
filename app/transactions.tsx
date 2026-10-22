import {
  LocalizedAlert as Alert,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from "@/components/i18n/LocalizedControls";
import { GeneratedBill, store } from "@/constants/store";
import { translatePhrase } from "@/i18n";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const PAYMENT_FILTERS = [
  { id: "ALL", label: "All", icon: "filter-list" },
  { id: "CASH", label: "Cash", icon: "payments" },
  { id: "UPI", label: "UPI / QR", icon: "qr-code-scanner" },
  { id: "CARD", label: "Card", icon: "credit-card" },
];

const DATE_FILTERS = [
  { id: "ALL", label: "All Time" },
  { id: "TODAY", label: "Today" },
  { id: "YESTERDAY", label: "Yesterday" },
  { id: "WEEK", label: "Last 7 Days" },
  { id: "MONTH", label: "This Month" },
];

const formatCurrency = (val: any) => {
  const n = typeof val === "number" ? val : parseFloat(val);
  return isNaN(n) ? "0.00" : n.toFixed(2);
};

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n: number) => String(n).padStart(2, "0");

// Show formatted compact date with 12-hour AM/PM time on list cards.
const formatDate = (isoStr: string) => {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    let hours = d.getHours();
    const ampm = translatePhrase(hours >= 12 ? "PM" : "AM");
    hours = hours % 12 || 12;
    return `${pad2(d.getDate())} ${translatePhrase(SHORT_MONTHS[d.getMonth()])} ${d.getFullYear()}, ${pad2(hours)}:${pad2(d.getMinutes())} ${ampm}`;
  } catch {
    return isoStr;
  }
};

export default function TransactionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ invoice?: string }>();

  // Data States
  const [transactions, setTransactions] = useState<GeneratedBill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayment, setSelectedPayment] = useState("ALL");
  const [selectedDateFilter, setSelectedDateFilter] = useState("ALL");

  // Selected Bill for Receipt Modal
  const [selectedBill, setSelectedBill] = useState<GeneratedBill | null>(null);
  const [billModalVisible, setBillModalVisible] = useState(false);

  // Load Transactions
  const loadTransactions = useCallback(
    async (showIndicator = true) => {
      if (showIndicator) setIsLoading(true);
      try {
        const data = await store.fetchTransactions({
          paymentMethod: selectedPayment === "ALL" ? undefined : selectedPayment,
        });
        setTransactions(data || []);

        // Auto-open receipt if invoice query param was supplied
        if (params.invoice) {
          const match = (data || []).find((t) => t.invoice_number === params.invoice);
          if (match) {
            setSelectedBill(match);
            setBillModalVisible(true);
          }
        }
      } catch (err) {
        console.warn("Failed to load transactions:", err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [selectedPayment, params.invoice],
  );

  useFocusEffect(
    useCallback(() => {
      loadTransactions(true);
    }, [loadTransactions]),
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      loadTransactions(false);
    });
    return unsubscribe;
  }, [loadTransactions]);

  const onRefresh = () => {
    setIsRefreshing(true);
    loadTransactions(false);
  };

  const handleOpenBill = async (bill: GeneratedBill) => {
    setSelectedBill(bill);
    setBillModalVisible(true);
    // If bill items need to be hydrated, fetch detailed bill
    if (!bill.items || bill.items.length === 0) {
      try {
        const fullBill = await store.fetchBill(bill.invoice_number);
        if (fullBill) {
          setSelectedBill(fullBill);
        }
      } catch {}
    }
  };

  // Filter Transactions by Search & Date
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return transactions.filter((t) => {
      // 1. Payment Method
      if (selectedPayment !== "ALL" && (t.payment_method || "").toUpperCase() !== selectedPayment.toUpperCase()) {
        return false;
      }

      // 2. Date Filter
      if (selectedDateFilter !== "ALL" && t.created_at) {
        const txDate = new Date(t.created_at);
        if (selectedDateFilter === "TODAY" && txDate < startOfToday) return false;
        if (selectedDateFilter === "YESTERDAY") {
          if (txDate < startOfYesterday || txDate >= startOfToday) return false;
        }
        if (selectedDateFilter === "WEEK" && txDate < startOfWeek) return false;
        if (selectedDateFilter === "MONTH" && txDate < startOfMonth) return false;
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesInvoice = (t.invoice_number || "").toLowerCase().includes(q);
        const matchesCashier = (t.cashier_name || "").toLowerCase().includes(q);
        const matchesCustomer = (t.customer_name || "").toLowerCase().includes(q);
        const matchesItem = (t.items || []).some((i) => (i.product_name || "").toLowerCase().includes(q));
        if (!matchesInvoice && !matchesCashier && !matchesCustomer && !matchesItem) return false;
      }

      return true;
    });
  }, [transactions, selectedPayment, selectedDateFilter, searchQuery]);

  // Aggregate Metrics for Filtered Data
  const summaryMetrics = useMemo(() => {
    const totalSales = filteredTransactions.reduce((acc, t) => acc + t.total, 0);
    const count = filteredTransactions.length;
    const avgOrder = count > 0 ? totalSales / count : 0;
    return { totalSales, count, avgOrder };
  }, [filteredTransactions]);

  // Handle Share Receipt
  const handleShareReceipt = async (bill: GeneratedBill) => {
    try {
      const itemsList = bill.items
        .map((i) => `• ${i.product_name} (x${i.quantity}) - ₹${formatCurrency(i.price * i.quantity)}`)
        .join("\n");

      const message =
        `🧾 *${translatePhrase("Receipt")} - ${bill.shop_name}*\n` +
        `${translatePhrase("Invoice")}: ${bill.invoice_number}\n` +
        `${translatePhrase("Date")}: ${formatDate(bill.created_at)}\n` +
        `${translatePhrase("Cashier")}: ${bill.cashier_name || translatePhrase("Counter")}\n` +
        `--------------------------------\n` +
        `${itemsList}\n` +
        `--------------------------------\n` +
        `${translatePhrase("Subtotal")}: ₹${formatCurrency(bill.subtotal)}\n` +
        (bill.discount > 0 ? `${translatePhrase("Discount")}: -₹${formatCurrency(bill.discount)}\n` : "") +
        `${translatePhrase("Tax (GST {{rate}}%)", { rate: bill.subtotal > 0 ? ((bill.tax / bill.subtotal) * 100).toFixed(0) : 0 })}: ₹${formatCurrency(bill.tax)}\n` +
        `*${translatePhrase("Grand Total")}: ₹${formatCurrency(bill.total)}*\n` +
        `${translatePhrase("Paid Via")}: ${translatePhrase(bill.payment_method)} (${translatePhrase(bill.payment_status)})\n` +
        `--------------------------------\n` +
        translatePhrase("Thank you for your business!");

      await Share.share({
        message,
        title: `${translatePhrase("Receipt")} ${bill.invoice_number}`,
      });
    } catch (err: any) {
      Alert.alert("Share Error", err.message || "Could not share receipt");
    }
  };

  // Handle WhatsApp Receipt
  const handleWhatsAppReceipt = async (bill: GeneratedBill) => {
    try {
      const itemsList = bill.items
        .map((i) => `• ${i.product_name} (x${i.quantity}) - ₹${formatCurrency(i.price * i.quantity)}`)
        .join("\n");

      const message =
        `🧾 ${translatePhrase("Receipt")} - ${bill.shop_name}\n` +
        `${translatePhrase("Invoice")}: ${bill.invoice_number}\n` +
        `${translatePhrase("Date")}: ${formatDate(bill.created_at)}\n` +
        `--------------------------------\n` +
        `${itemsList}\n` +
        `--------------------------------\n` +
        `${translatePhrase("Subtotal")}: ₹${formatCurrency(bill.subtotal)}\n` +
        (bill.discount > 0 ? `${translatePhrase("Discount")}: -₹${formatCurrency(bill.discount)}\n` : "") +
        `${translatePhrase("Tax (GST {{rate}}%)", { rate: bill.subtotal > 0 ? ((bill.tax / bill.subtotal) * 100).toFixed(0) : 0 })}: ₹${formatCurrency(bill.tax)}\n` +
        `${translatePhrase("Total")}: ₹${formatCurrency(bill.total)}\n` +
        `${translatePhrase("Payment")}: ${translatePhrase(bill.payment_method)} (${translatePhrase(bill.payment_status)})\n` +
        translatePhrase("Thank you for shopping with us!");

      const encodedMessage = encodeURIComponent(message);
      // Use universal https://wa.me/ URL — works on Android & iOS without URL scheme registration.
      // If customer phone is known, pre-fill the recipient; otherwise open WhatsApp chat list.
      const phone = bill.customer_phone ? bill.customer_phone.replace(/\D/g, "") : "";
      const url = phone ? `https://wa.me/${phone}?text=${encodedMessage}` : `https://wa.me/?text=${encodedMessage}`;

      await Linking.openURL(url);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not open WhatsApp");
    }
  };

  // Handle Print Receipt
  const handlePrintReceipt = (bill: GeneratedBill) => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.print();
    } else {
      Alert.alert(
        "Thermal Print Sent",
        translatePhrase("Invoice {{invoice}} sent to Bluetooth Thermal Printer (80mm).\n\nTotal: ₹{{total}}", {
          invoice: bill.invoice_number,
          total: formatCurrency(bill.total),
        }),
      );
    }
  };

  const getPaymentIcon = (method: string) => {
    const m = (method || "").toUpperCase();
    if (m === "UPI") return "qr-code-scanner";
    if (m === "CARD") return "credit-card";
    return "payments";
  };

  const getPaymentColor = (method: string) => {
    const m = (method || "").toUpperCase();
    if (m === "UPI") return { bg: "#eef2ff", text: "#3730a3", icon: "#4f46e5" };
    if (m === "CARD") return { bg: "#faf5ff", text: "#6b21a8", icon: "#9333ea" };
    return { bg: "#ecfdf5", text: "#065f46", icon: "#059669" };
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <MaterialIcons name="arrow-back" size={24} color="#131b2e" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Transaction History</Text>
          <Text style={styles.headerSubtitle}>
            {store.currentUser?.shopName || "SmartPOS"} • Store #{store.currentUser?.storeId || "—"}
          </Text>
        </View>

        <TouchableOpacity style={styles.headerIconButton} onPress={onRefresh} accessibilityLabel="Refresh">
          <MaterialIcons name="refresh" size={24} color="#004ac6" />
        </TouchableOpacity>
      </View>

      {/* Main Content Area */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.invoice_number}
        contentContainerStyle={styles.listContent}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        ListHeaderComponent={
          <View>
            {/* Search Input Bar */}
            <View style={styles.searchWrapper}>
              <MaterialIcons name="search" size={22} color="#737686" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by invoice #, customer, or cashier..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearBtn}>
                  <MaterialIcons name="close" size={18} color="#737686" />
                </TouchableOpacity>
              )}
            </View>

            {/* Date Range Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {DATE_FILTERS.map((df) => {
                const active = selectedDateFilter === df.id;
                return (
                  <TouchableOpacity
                    key={df.id}
                    style={[styles.dateChip, active && styles.dateChipActive]}
                    onPress={() => setSelectedDateFilter(df.id)}
                  >
                    <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>{df.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Payment Method Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {PAYMENT_FILTERS.map((pf) => {
                const active = selectedPayment === pf.id;
                return (
                  <TouchableOpacity
                    key={pf.id}
                    style={[styles.paymentChip, active && styles.paymentChipActive]}
                    onPress={() => setSelectedPayment(pf.id)}
                  >
                    <MaterialIcons name={pf.icon as any} size={16} color={active ? "#ffffff" : "#475569"} />
                    <Text style={[styles.paymentChipText, active && styles.paymentChipTextActive]}>{pf.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* KPI Summary Banner */}
            <View style={styles.kpiContainer}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total Revenue</Text>
                <Text style={styles.kpiValuePrimary}>₹{formatCurrency(summaryMetrics.totalSales)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Invoices</Text>
                <Text style={styles.kpiValue}>{summaryMetrics.count}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Avg. Bill</Text>
                <Text style={styles.kpiValue}>₹{formatCurrency(summaryMetrics.avgOrder)}</Text>
              </View>
            </View>

            {/* Section Header */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Transactions ({filteredTransactions.length})</Text>
              {selectedPayment !== "ALL" || selectedDateFilter !== "ALL" || searchQuery ? (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedPayment("ALL");
                    setSelectedDateFilter("ALL");
                    setSearchQuery("");
                  }}
                >
                  <Text style={styles.resetFiltersText}>Reset Filters</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#004ac6" />
              <Text style={styles.emptyText}>Loading transactions...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <MaterialIcons name="receipt-long" size={48} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>No Transactions Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || selectedPayment !== "ALL" || selectedDateFilter !== "ALL"
                  ? "Try adjusting your filters or search term"
                  : "Completed sales and generated bills will appear here"}
              </Text>
              <TouchableOpacity style={styles.newSaleBtn} onPress={() => router.push("/billing")}>
                <MaterialIcons name="add-shopping-cart" size={18} color="#ffffff" />
                <Text style={styles.newSaleBtnText}>Create New Sale</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => {
          const pStyle = getPaymentColor(item.payment_method);
          const itemsList = item.items || [];
          const firstItem = itemsList[0]?.product_name || "Item";
          const itemsSummary =
            itemsList.length > 1
              ? `${itemsList.length} items • ${firstItem} +${itemsList.length - 1} more`
              : `${itemsList.length} item • ${firstItem}`;

          return (
            <TouchableOpacity style={styles.transactionCard} activeOpacity={0.7} onPress={() => handleOpenBill(item)}>
              {/* Card Top Row */}
              <View style={styles.cardTopRow}>
                <View style={styles.invoiceWrapper}>
                  <MaterialIcons name="receipt" size={18} color="#004ac6" />
                  <Text style={styles.invoiceNumber}>{item.invoice_number}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>{item.payment_status || "PAID"}</Text>
                </View>
              </View>

              {/* Card Middle Row */}
              <View style={styles.cardMiddleRow}>
                <Text style={styles.itemSummaryText} numberOfLines={1}>
                  {itemsSummary}
                </Text>
              </View>

              {/* Card Bottom Row */}
              <View style={styles.cardBottomRow}>
                <View style={styles.metaLeft}>
                  <View style={[styles.paymentBadge, { backgroundColor: pStyle.bg }]}>
                    <MaterialIcons name={getPaymentIcon(item.payment_method) as any} size={13} color={pStyle.icon} />
                    <Text style={[styles.paymentBadgeText, { color: pStyle.text }]}>{item.payment_method}</Text>
                  </View>
                  <Text style={styles.txDate} numberOfLines={1} ellipsizeMode="tail">
                    {formatDate(item.created_at)}
                  </Text>
                </View>

                <View style={styles.amountWrapper}>
                  <Text style={styles.txAmount}>₹{formatCurrency(item.total)}</Text>
                  <MaterialIcons name="chevron-right" size={18} color="#94a3b8" />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Digital Thermal Receipt Modal */}
      <Modal
        visible={billModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBillModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.receiptModalCard}>
            {/* Modal Top Close Bar */}
            <View style={styles.receiptModalHeader}>
              <Text style={styles.receiptModalTitle}>Bill Details</Text>
              <TouchableOpacity onPress={() => setBillModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialIcons name="close" size={22} color="#131b2e" />
              </TouchableOpacity>
            </View>

            {selectedBill ? (
              <ScrollView
                style={styles.receiptScroll}
                contentContainerStyle={styles.receiptScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Thermal Receipt Paper Card */}
                <View style={styles.receiptPaper}>
                  {/* Shop Branding Header */}
                  <View style={styles.receiptHeaderSection}>
                    <View style={styles.receiptLogoIcon}>
                      <MaterialIcons name="point-of-sale" size={28} color="#004ac6" />
                    </View>
                    <Text style={styles.receiptShopName}>{selectedBill.shop_name}</Text>
                    {selectedBill.shop_address ? (
                      <Text style={styles.receiptShopSub}>{selectedBill.shop_address}</Text>
                    ) : null}
                    {selectedBill.shop_phone ? (
                      <Text style={styles.receiptShopSub}>Tel: {selectedBill.shop_phone}</Text>
                    ) : null}
                    {selectedBill.gst_number ? (
                      <Text style={styles.receiptGstNumber}>GSTIN: {selectedBill.gst_number}</Text>
                    ) : null}
                  </View>

                  <View style={styles.dashedDivider} />

                  {/* Invoice & Cashier Meta */}
                  <View style={styles.receiptMetaGrid}>
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMetaKey}>Invoice No:</Text>
                      <Text style={styles.receiptMetaVal}>{selectedBill.invoice_number}</Text>
                    </View>
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMetaKey}>Date & Time:</Text>
                      <Text style={styles.receiptMetaVal}>{formatDate(selectedBill.created_at)}</Text>
                    </View>
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMetaKey}>Cashier:</Text>
                      <Text style={styles.receiptMetaVal}>{selectedBill.cashier_name || "Counter Staff"}</Text>
                    </View>
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMetaKey}>Payment Mode:</Text>
                      <Text style={[styles.receiptMetaVal, { fontWeight: "700", color: "#004ac6" }]}>
                        {selectedBill.payment_method} ({selectedBill.payment_status || "PAID"})
                      </Text>
                    </View>
                  </View>

                  <View style={styles.dashedDivider} />

                  {/* Itemized Table */}
                  <View style={styles.itemTable}>
                    <View style={styles.itemTableHeader}>
                      <Text style={[styles.tableColHeader, { flex: 2 }]}>Item</Text>
                      <Text style={[styles.tableColHeader, { flex: 1, textAlign: "center" }]}>Qty</Text>
                      <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Price</Text>
                      <Text style={[styles.tableColHeader, { flex: 1, textAlign: "right" }]}>Total</Text>
                    </View>

                    {(selectedBill.items || []).map((item, idx) => (
                      <View key={idx} style={styles.itemTableRow}>
                        <Text style={[styles.tableColItem, { flex: 2 }]} numberOfLines={2}>
                          {item.product_name}
                        </Text>
                        <Text style={[styles.tableColQty, { flex: 1, textAlign: "center" }]}>{item.quantity}</Text>
                        <Text style={[styles.tableColPrice, { flex: 1, textAlign: "right" }]}>
                          ₹{formatCurrency(item.price)}
                        </Text>
                        <Text style={[styles.tableColTotal, { flex: 1, textAlign: "right" }]}>
                          ₹{formatCurrency(item.price * item.quantity)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.dashedDivider} />

                  {/* Totals Section */}
                  <View style={styles.receiptTotals}>
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Subtotal</Text>
                      <Text style={styles.totalValue}>₹{formatCurrency(selectedBill.subtotal)}</Text>
                    </View>

                    {selectedBill.discount && selectedBill.discount > 0 ? (
                      <View style={styles.totalRow}>
                        <Text style={[styles.totalLabel, { color: "#ba1a1a" }]}>Discount</Text>
                        <Text style={[styles.totalValue, { color: "#ba1a1a" }]}>
                          -₹{formatCurrency(selectedBill.discount)}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Tax (GST 8%)</Text>
                      <Text style={styles.totalValue}>₹{formatCurrency(selectedBill.tax)}</Text>
                    </View>

                    <View style={[styles.totalRow, styles.grandTotalRow]}>
                      <Text style={styles.grandTotalLabel}>TOTAL AMOUNT</Text>
                      <Text style={styles.grandTotalValue}>₹{formatCurrency(selectedBill.total)}</Text>
                    </View>

                    {selectedBill.payment_status === "CREDIT" ? (
                      <View
                        style={{
                          backgroundColor: "#fffbeb",
                          borderWidth: 1,
                          borderColor: "#fde68a",
                          borderRadius: 8,
                          padding: 8,
                          marginTop: 8,
                        }}
                      >
                        <View style={styles.totalRow}>
                          <Text style={[styles.totalLabel, { color: "#b45309", fontWeight: "600" }]}>
                            Current Bill (Unpaid)
                          </Text>
                          <Text style={[styles.totalValue, { color: "#b45309", fontWeight: "700" }]}>
                            ₹{formatCurrency(selectedBill.total)}
                          </Text>
                        </View>
                        {selectedBill.customer_credit_balance !== undefined ? (
                          <View
                            style={[
                              styles.totalRow,
                              { borderTopWidth: 1, borderTopColor: "#fde68a", paddingTop: 4, marginTop: 4 },
                            ]}
                          >
                            <Text style={[styles.totalLabel, { color: "#92400e", fontWeight: "800" }]}>
                              Total Outstanding Due
                            </Text>
                            <Text style={[styles.totalValue, { color: "#92400e", fontWeight: "800", fontSize: 15 }]}>
                              ₹{formatCurrency(selectedBill.customer_credit_balance)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {/* Receipt Footer Message */}
                  <View style={styles.receiptFooter}>
                    <Text style={styles.footerThanks}>Thank you for your visit!</Text>
                    <Text style={styles.footerTagline}>Generated by SmartPOS</Text>
                  </View>
                </View>
              </ScrollView>
            ) : null}

            {/* Receipt Modal Action Buttons */}
            {selectedBill ? (
              <View style={styles.modalActionButtons}>
                <TouchableOpacity
                  style={[styles.modalActionBtn, styles.whatsappBtn]}
                  onPress={() => handleWhatsAppReceipt(selectedBill)}
                >
                  <FontAwesome5 name="whatsapp" size={20} color="#ffffff" />
                  <Text style={styles.printBtnText}>WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalActionBtn, styles.shareBtn]}
                  onPress={() => handleShareReceipt(selectedBill)}
                >
                  <MaterialIcons name="share" size={20} color="#004ac6" />
                  <Text style={styles.shareBtnText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalActionBtn, styles.printBtn]}
                  onPress={() => handlePrintReceipt(selectedBill)}
                >
                  <MaterialIcons name="print" size={20} color="#ffffff" />
                  <Text style={styles.printBtnText}>Print</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  whatsappBtn: {
    backgroundColor: "#25D366",
    borderColor: "#25D366",
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  listContent: {
    paddingBottom: 40,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    height: "100%",
  },
  clearBtn: {
    padding: 4,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 10,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dateChipActive: {
    backgroundColor: "#004ac6",
    borderColor: "#004ac6",
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  dateChipTextActive: {
    color: "#ffffff",
  },
  paymentChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  paymentChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  paymentChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  paymentChipTextActive: {
    color: "#ffffff",
  },
  kpiContainer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  kpiLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  kpiValuePrimary: {
    fontSize: 16,
    fontWeight: "700",
    color: "#004ac6",
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  resetFiltersText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#004ac6",
  },
  transactionCard: {
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  invoiceWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  statusBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  cardMiddleRow: {
    marginBottom: 10,
  },
  itemSummaryText: {
    fontSize: 13,
    color: "#64748b",
  },
  cardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    gap: 8,
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    flexShrink: 0,
  },
  paymentBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  txDate: {
    fontSize: 11.5,
    color: "#94a3b8",
    flexShrink: 1,
  },
  amountWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  txAmount: {
    fontSize: 15.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
  },
  newSaleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#004ac6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  newSaleBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  receiptModalCard: {
    width: "100%",
    maxWidth: 440,
    height: Math.min(SCREEN_HEIGHT * 0.82, 650),
    backgroundColor: "#ffffff",
    borderRadius: 20,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  receiptModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  receiptModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalCloseBtn: {
    padding: 4,
  },
  receiptScroll: {
    flex: 1,
    width: "100%",
    backgroundColor: "#f8fafc",
  },
  receiptScrollContent: {
    padding: 16,
  },
  receiptPaper: {
    backgroundColor: "#ffffff",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  receiptHeaderSection: {
    alignItems: "center",
    marginBottom: 12,
  },
  receiptLogoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#eef2ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  receiptShopName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 4,
  },
  receiptShopSub: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 16,
  },
  receiptGstNumber: {
    fontSize: 12,
    fontWeight: "700",
    color: "#004ac6",
    marginTop: 4,
  },
  dashedDivider: {
    height: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderStyle: "dashed",
    marginVertical: 12,
  },
  receiptMetaGrid: {
    gap: 6,
  },
  receiptMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  receiptMetaKey: {
    fontSize: 12,
    color: "#64748b",
  },
  receiptMetaVal: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  itemTable: {
    marginVertical: 4,
  },
  itemTableHeader: {
    flexDirection: "row",
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    marginBottom: 6,
  },
  tableColHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
  },
  itemTableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  tableColItem: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  tableColQty: {
    fontSize: 12,
    color: "#64748b",
  },
  tableColPrice: {
    fontSize: 12,
    color: "#64748b",
  },
  tableColTotal: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  receiptTotals: {
    gap: 6,
    paddingTop: 4,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: {
    fontSize: 13,
    color: "#64748b",
  },
  totalValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  grandTotalRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1.5,
    borderTopColor: "#0f172a",
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#004ac6",
  },
  receiptFooter: {
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  footerThanks: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  footerTagline: {
    fontSize: 11,
    color: "#94a3b8",
  },
  modalActionButtons: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  modalActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 12,
  },
  shareBtn: {
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#004ac6",
  },
  printBtn: {
    backgroundColor: "#004ac6",
  },
  printBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
