import {
  LocalizedAlert as Alert,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from "@/components/i18n/LocalizedControls";
import { CreditEntry, Customer, store } from "@/constants/store";
import { getAppLocale } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const money = (n: number) => `₹${(n || 0).toFixed(2)}`;

function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString(getAppLocale());
}

export default function CustomersScreen() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  // Add-customer modal
  const [addVisible, setAddVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);

  // Detail / ledger modal
  const [selected, setSelected] = useState<Customer | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Payment modal
  const [payVisible, setPayVisible] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [recording, setRecording] = useState(false);

  const load = useCallback(async () => {
    const list = await store.fetchCustomers();
    setCustomers(list);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const totalOutstanding = useMemo(
    () => customers.reduce((sum, c) => sum + (c.credit_balance > 0 ? c.credit_balance : 0), 0),
    [customers],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q));
  }, [customers, search]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      Alert.alert("Name Required", "Please enter the customer name.");
      return;
    }
    setCreating(true);
    try {
      const created = await store.createCustomer(name, newPhone.trim() || undefined);
      if (!created) {
        Alert.alert(
          "Could Not Save",
          "The customer could not be saved. The server may be unavailable — please try again.",
        );
        return;
      }
      setNewName("");
      setNewPhone("");
      setAddVisible(false);
      await load();
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (c: Customer) => {
    setSelected(c);
    setLedgerLoading(true);
    try {
      const full = await store.fetchCustomerLedger(c.id);
      if (full) setSelected(full);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!selected) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Invalid Amount", "Enter a payment amount greater than zero.");
      return;
    }
    setRecording(true);
    try {
      const ok = await store.recordCustomerPayment(selected.id, amount, payNote.trim() || undefined);
      if (!ok) {
        Alert.alert("Failed", "Could not record the payment. Please try again.");
        return;
      }
      setPayVisible(false);
      setPayAmount("");
      setPayNote("");
      // Refresh both the open ledger and the list balances.
      const full = await store.fetchCustomerLedger(selected.id);
      if (full) setSelected(full);
      await load();
    } finally {
      setRecording(false);
    }
  };

  const renderCustomer = ({ item }: { item: Customer }) => {
    const owes = item.credit_balance > 0;
    return (
      <TouchableOpacity style={styles.customerRow} onPress={() => openDetail(item)} activeOpacity={0.7}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.name}</Text>
          {!!item.phone && <Text style={styles.customerPhone}>{item.phone}</Text>}
        </View>
        <View style={styles.balanceCol}>
          <Text style={[styles.balanceValue, owes ? styles.balanceOwed : styles.balanceClear]}>
            {money(item.credit_balance)}
          </Text>
          <Text style={styles.balanceCaption}>{owes ? "owes" : "settled"}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color="#c3c6d7" />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color="#131b2e" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customers</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setAddVisible(true)}>
          <MaterialIcons name="person-add" size={22} color="#004ac6" />
        </TouchableOpacity>
      </View>

      {/* Outstanding summary */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Total Outstanding Credit</Text>
        <Text style={styles.summaryValue}>{money(totalOutstanding)}</Text>
        <Text style={styles.summarySub}>
          {customers.length} customer{customers.length === 1 ? "" : "s"}
        </Text>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={20} color="#737686" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by customer name or phone..."
          placeholderTextColor="#9a9db0"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#004ac6" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => String(c.id)}
          renderItem={renderCustomer}
          contentContainerStyle={styles.listContent}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="people-outline" size={48} color="#c3c6d7" />
              <Text style={styles.emptyTitle}>No customers yet</Text>
              <Text style={styles.emptyText}>
                Add a customer or record a credit sale from the billing screen. If your backend doesn&apos;t have the
                customer feature yet, redeploy it first.
              </Text>
            </View>
          }
        />
      )}

      {/* Add customer modal */}
      <Modal visible={addVisible} transparent animationType="slide" onRequestClose={() => setAddVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>New Customer</Text>
            <Text style={styles.inputLabel}>Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter customer full name"
              placeholderTextColor="#9a9db0"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <Text style={styles.inputLabel}>Phone (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter 10-digit mobile number"
              placeholderTextColor="#9a9db0"
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setAddVisible(false)}
                disabled={creating}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.primaryBtn, creating && styles.btnDisabled]}
                onPress={handleAdd}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail / ledger modal */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.detailSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>{selected?.name}</Text>
                {!!selected?.phone && <Text style={styles.detailPhone}>{selected.phone}</Text>}
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} style={styles.iconBtn}>
                <MaterialIcons name="close" size={22} color="#434655" />
              </TouchableOpacity>
            </View>

            <View style={styles.detailBalanceBox}>
              <Text style={styles.detailBalanceLabel}>Outstanding Balance</Text>
              <Text
                style={[
                  styles.detailBalanceValue,
                  (selected?.credit_balance || 0) > 0 ? styles.balanceOwed : styles.balanceClear,
                ]}
              >
                {money(selected?.credit_balance || 0)}
              </Text>
            </View>

            <Text style={styles.ledgerTitle}>Ledger</Text>
            {ledgerLoading ? (
              <View style={styles.ledgerLoading}>
                <ActivityIndicator color="#004ac6" />
              </View>
            ) : (
              <ScrollView style={styles.ledgerScroll} showsVerticalScrollIndicator={false}>
                {(selected?.entries || []).length === 0 ? (
                  <Text style={styles.emptyText}>No ledger entries yet.</Text>
                ) : (
                  (selected?.entries || []).map((e: CreditEntry) => {
                    const isDebit = e.entry_type === "DEBIT";
                    return (
                      <View key={e.id} style={styles.ledgerRow}>
                        <View style={[styles.ledgerIcon, { backgroundColor: isDebit ? "#fde8e8" : "#e6faee" }]}>
                          <MaterialIcons
                            name={isDebit ? "arrow-upward" : "arrow-downward"}
                            size={16}
                            color={isDebit ? "#ba1a1a" : "#006329"}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.ledgerType}>{isDebit ? "Credit Sale" : "Payment Received"}</Text>
                          <Text style={styles.ledgerMeta}>
                            {formatDate(e.created_at)}
                            {e.invoice_number ? ` · ${e.invoice_number}` : ""}
                          </Text>
                          {!!e.note && <Text style={styles.ledgerNote}>{e.note}</Text>}
                        </View>
                        <Text style={[styles.ledgerAmount, { color: isDebit ? "#ba1a1a" : "#006329" }]}>
                          {isDebit ? "+" : "−"}
                          {money(e.amount)}
                        </Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.recordBtn, (selected?.credit_balance || 0) <= 0 && styles.btnDisabled]}
              onPress={() => setPayVisible(true)}
              disabled={(selected?.credit_balance || 0) <= 0}
            >
              <MaterialIcons name="payments" size={18} color="#fff" />
              <Text style={styles.recordBtnText}>Record Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Record payment modal */}
      <Modal visible={payVisible} transparent animationType="fade" onRequestClose={() => setPayVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Record Payment</Text>
            <Text style={styles.paySub}>
              {selected?.name} · owes {money(selected?.credit_balance || 0)}
            </Text>
            <Text style={styles.inputLabel}>Amount Received *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter received amount (₹)"
              placeholderTextColor="#9a9db0"
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.inputLabel}>Note (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter payment reference or remarks"
              placeholderTextColor="#9a9db0"
              value={payNote}
              onChangeText={setPayNote}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setPayVisible(false)}
                disabled={recording}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.primaryBtn, recording && styles.btnDisabled]}
                onPress={handleRecordPayment}
                disabled={recording}
              >
                {recording ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#131b2e" },
  summaryCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: "#004ac6",
    borderRadius: 14,
    padding: 18,
  },
  summaryLabel: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: "500" },
  summaryValue: { fontSize: 30, fontWeight: "800", color: "#ffffff", marginTop: 4, letterSpacing: -0.5 },
  summarySub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#131b2e" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#e8eefc",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#004ac6" },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 15, fontWeight: "600", color: "#131b2e" },
  customerPhone: { fontSize: 12, color: "#737686", marginTop: 2 },
  balanceCol: { alignItems: "flex-end" },
  balanceValue: { fontSize: 15, fontWeight: "700" },
  balanceOwed: { color: "#ba1a1a" },
  balanceClear: { color: "#006329" },
  balanceCaption: { fontSize: 11, color: "#9a9db0", marginTop: 1 },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#434655", marginTop: 8 },
  emptyText: { fontSize: 13, color: "#737686", textAlign: "center", lineHeight: 19 },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e0e0ea",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#131b2e", marginBottom: 12 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: "#434655", marginBottom: 6, marginTop: 8 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.5)",
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#131b2e",
    backgroundColor: "#fafafe",
  },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cancelBtn: { backgroundColor: "#f3f3fa" },
  cancelBtnText: { fontSize: 15, fontWeight: "600", color: "#434655" },
  primaryBtn: { backgroundColor: "#004ac6" },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
  btnDisabled: { opacity: 0.5 },
  // Detail sheet
  detailSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    maxHeight: "85%",
  },
  detailHeader: { flexDirection: "row", alignItems: "flex-start" },
  detailName: { fontSize: 20, fontWeight: "700", color: "#131b2e" },
  detailPhone: { fontSize: 13, color: "#737686", marginTop: 2 },
  detailBalanceBox: {
    backgroundColor: "#faf8ff",
    borderRadius: 12,
    padding: 16,
    marginVertical: 14,
    alignItems: "center",
  },
  detailBalanceLabel: { fontSize: 13, color: "#737686" },
  detailBalanceValue: { fontSize: 28, fontWeight: "800", marginTop: 4 },
  ledgerTitle: { fontSize: 15, fontWeight: "700", color: "#131b2e", marginBottom: 8 },
  ledgerLoading: { paddingVertical: 24, alignItems: "center" },
  ledgerScroll: { maxHeight: 280 },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.2)",
  },
  ledgerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  ledgerType: { fontSize: 14, fontWeight: "600", color: "#131b2e" },
  ledgerMeta: { fontSize: 11, color: "#9a9db0", marginTop: 1 },
  ledgerNote: { fontSize: 12, color: "#737686", marginTop: 2, fontStyle: "italic" },
  ledgerAmount: { fontSize: 15, fontWeight: "700" },
  recordBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#004ac6",
    height: 50,
    borderRadius: 12,
    marginTop: 16,
  },
  recordBtnText: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
  paySub: { fontSize: 13, color: "#737686", marginBottom: 8 },
});
