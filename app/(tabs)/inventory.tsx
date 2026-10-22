import {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from "@/components/i18n/LocalizedControls";
import { Product, store } from "@/constants/store";
import { getAppLocale } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FILTERS = ["All Stock", "Low Stock", "Out of Stock"];
const RESTOCK_PRESETS = [5, 10, 25, 50, 100];

export default function InventoryScreen() {
  const router = useRouter();

  // State
  const [inventory, setInventory] = useState<Product[]>([]);
  const [selectedFilter, setSelectedFilter] = useState("All Stock");
  const [searchQuery, setSearchQuery] = useState("");

  // Quick Restock Modal State
  const [restockModalVisible, setRestockModalVisible] = useState(false);
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState(10);

  // Floating Toast State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2200);
  };

  // Subscribe to store updates
  useEffect(() => {
    setInventory(store.getProducts());
    const unsubscribe = store.subscribe(() => {
      setInventory(store.getProducts());
    });
    return unsubscribe;
  }, []);

  // Calculations
  const metrics = useMemo(() => {
    const totalValue = inventory.reduce((acc, item) => acc + item.price * item.stock, 0);
    const totalCount = inventory.length; // count of distinct products, not total stock
    return {
      totalValue,
      totalCount,
    };
  }, [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch = item.name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      // Status filter
      if (selectedFilter === "Low Stock") {
        return item.stock > 0 && item.stock <= item.lowStockAlert;
      }
      if (selectedFilter === "Out of Stock") {
        return item.stock === 0;
      }
      return true;
    });
  }, [inventory, selectedFilter, searchQuery]);

  // Actions
  const openRestockModal = (item: Product, defaultAdd = 10) => {
    setTargetProduct(item);
    setRestockQty(defaultAdd);
    setRestockModalVisible(true);
  };

  const handleConfirmRestock = async () => {
    if (!targetProduct || restockQty <= 0) return;
    await store.restockProduct(targetProduct.id, restockQty);
    setRestockModalVisible(false);
    showToast(`✓ Added +${restockQty} ${targetProduct.unit || "pcs"} to ${targetProduct.name}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Floating Toast Notification */}
      {toastVisible && (
        <View style={styles.floatingToast}>
          <MaterialIcons name="check-circle" size={18} color="#22c55e" />
          <Text style={styles.floatingToastText}>{toastMsg}</Text>
        </View>
      )}

      {/* Top Bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SmartPOS</Text>
      </View>

      <FlatList
        data={filteredInventory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContainer}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        ListHeaderComponent={
          <View>
            <Text style={styles.pageTitle}>Inventory</Text>

            {/* Metrics Bento Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total Stock Value</Text>
                <Text style={styles.metricValuePrimary} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  ₹
                  {metrics.totalValue.toLocaleString(getAppLocale(), {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Total Products</Text>
                <Text style={styles.metricValue}>{metrics.totalCount.toLocaleString(getAppLocale())}</Text>
              </View>
            </View>

            {/* Search Box */}
            <View style={styles.searchRow}>
              <MaterialIcons name="search" size={18} color="#737686" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or SKU..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.searchClear}>
                  <MaterialIcons name="close" size={16} color="#737686" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Chips */}
            <View style={styles.tabsRow}>
              {FILTERS.map((filter) => {
                const active = selectedFilter === filter;
                return (
                  <TouchableOpacity
                    key={filter}
                    style={[styles.tabChip, active && styles.tabChipActive]}
                    onPress={() => setSelectedFilter(filter)}
                  >
                    <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{filter}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isOutOfStock = item.stock === 0;
          const isLowStock = item.stock > 0 && item.stock <= item.lowStockAlert;

          return (
            <TouchableOpacity
              style={[
                styles.itemCard,
                isOutOfStock && styles.itemCardOutOfStock,
                isLowStock && styles.itemCardLowStock,
              ]}
              onPress={() => router.push(`/add_product?id=${item.id}`)}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeaderRow}>
                {/* Thumbnail */}
                <View style={styles.thumbnailWrapper}>
                  {item.image ? (
                    <Image source={{ uri: item.image }} style={styles.thumbnail} contentFit="cover" />
                  ) : (
                    <MaterialIcons name="inventory-2" size={20} color="#737686" />
                  )}
                </View>

                {/* Details */}
                <View style={styles.itemDetails}>
                  <Text style={[styles.itemName, isOutOfStock && styles.textSecondary]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemSku}>SKU: {item.sku}</Text>
                  <View style={styles.itemMetaRow}>
                    <Text style={[styles.itemPrice, isOutOfStock && styles.textSecondary]}>
                      ₹{item.price.toFixed(2)}
                      <Text style={{ fontSize: 10, fontWeight: "500", color: "#64748b" }}>/{item.unit || "pc"}</Text>
                    </Text>
                    {isOutOfStock ? (
                      <View style={[styles.badge, styles.badgeError]}>
                        <MaterialIcons name="error" size={11} color="#ba1a1a" />
                        <Text style={styles.badgeTextError}>Out of stock</Text>
                      </View>
                    ) : isLowStock ? (
                      <View style={[styles.badge, styles.badgeWarning]}>
                        <MaterialIcons name="warning" size={11} color="#854d0e" />
                        <Text style={styles.badgeTextWarning}>
                          {item.stock} {item.unit || "pcs"} left
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, styles.badgeSuccess]}>
                        <MaterialIcons name="check-circle" size={11} color="#166534" />
                        <Text style={styles.badgeTextSuccess}>
                          {item.stock} {item.unit || "pcs"}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Quick Restock — compact icon button on the right */}
                <TouchableOpacity
                  style={[styles.restockIconBtn, isOutOfStock && styles.restockIconBtnDanger]}
                  onPress={(e) => {
                    e.stopPropagation();
                    openRestockModal(item, isOutOfStock ? 25 : 10);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="add" size={18} color="#ffffff" />
                  <Text style={styles.restockIconBtnText}>{isOutOfStock ? "Reorder" : "Restock"}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="search-off" size={48} color="#c3c6d7" />
            <Text style={styles.emptyText}>No items found in this category.</Text>
          </View>
        }
      />

      {/* Quick Restock — Bottom Sheet Drawer */}
      <Modal
        visible={restockModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setRestockModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          {/* Dim backdrop — tap to dismiss */}
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setRestockModalVisible(false)}
          />

          {/* Sheet card anchored to the bottom */}
          <View style={styles.sheetCard}>
            {/* Drag handle */}
            <View style={styles.sheetHandle} />

            {/* Sheet header */}
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={styles.modalIconCircle}>
                  <MaterialIcons name="add-business" size={20} color="#004ac6" />
                </View>
                <Text style={styles.modalTitle}>Quick Restock</Text>
              </View>
              <TouchableOpacity onPress={() => setRestockModalVisible(false)} style={styles.modalCloseBtn}>
                <MaterialIcons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Product info card */}
            {targetProduct && (
              <View style={styles.restockProductHeader}>
                <View style={styles.restockThumbnailWrapper}>
                  {targetProduct.image ? (
                    <Image source={{ uri: targetProduct.image }} style={styles.thumbnail} contentFit="cover" />
                  ) : (
                    <MaterialIcons name="inventory-2" size={24} color="#004ac6" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.restockProductName} numberOfLines={1}>
                    {targetProduct.name}
                  </Text>
                  <Text style={styles.restockProductMeta}>
                    SKU: {targetProduct.sku} • Current:{" "}
                    <Text
                      style={{
                        fontWeight: "700",
                        color: targetProduct.stock <= targetProduct.lowStockAlert ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {targetProduct.stock} {targetProduct.unit || "pcs"}
                    </Text>
                  </Text>
                </View>
              </View>
            )}

            {/* Quantity label */}
            <Text style={styles.restockLabel}>Restock Quantity to Add</Text>

            {/* Stepper */}
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => setRestockQty((prev) => Math.max(1, prev - 1))}
              >
                <MaterialIcons name="remove" size={20} color="#004ac6" />
              </TouchableOpacity>
              <TextInput
                style={styles.stepperInput}
                value={restockQty.toString()}
                onChangeText={(val) => {
                  const num = parseInt(val.replace(/[^0-9]/g, ""), 10);
                  setRestockQty(isNaN(num) ? 0 : num);
                }}
                keyboardType="number-pad"
                textAlign="center"
              />
              <TouchableOpacity style={styles.stepperBtn} onPress={() => setRestockQty((prev) => prev + 1)}>
                <MaterialIcons name="add" size={20} color="#004ac6" />
              </TouchableOpacity>
            </View>

            {/* Preset chips */}
            <View style={styles.presetChipsRow}>
              {RESTOCK_PRESETS.map((qty) => (
                <TouchableOpacity
                  key={qty}
                  style={[styles.presetChip, restockQty === qty && styles.presetChipActive]}
                  onPress={() => setRestockQty(qty)}
                >
                  <Text style={[styles.presetChipText, restockQty === qty && styles.presetChipTextActive]}>+{qty}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Live preview */}
            {targetProduct && (
              <View style={styles.previewBox}>
                <Text style={styles.previewBoxLabel}>Stock After Restock:</Text>
                <Text style={styles.previewBoxValue}>
                  {targetProduct.stock + restockQty} {targetProduct.unit || "pcs"}
                </Text>
              </View>
            )}

            {/* Action buttons — full width in sheet */}
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRestockModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmRestockBtn, { flex: 1 }]} onPress={handleConfirmRestock}>
                <MaterialIcons name="check" size={18} color="#ffffff" />
                <Text style={styles.confirmRestockBtnText}>Confirm Restock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#faf8ff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.2)",
    backgroundColor: "#ffffff",
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 9999,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#004ac6",
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 90,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#131b2e",
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#f2f3ff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
    justifyContent: "center",
  },
  metricLabel: {
    fontSize: 13,
    color: "#434655",
    fontWeight: "500",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 26,
    fontWeight: "700",
    color: "#131b2e",
  },
  metricValuePrimary: {
    fontSize: 26,
    fontWeight: "700",
    color: "#004ac6",
  },
  tabsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  tabChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9999,
    backgroundColor: "#eaedff",
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
  },
  tabChipActive: {
    backgroundColor: "#004ac6",
    borderColor: "#004ac6",
  },
  tabChipText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#434655",
  },
  tabChipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  // Search box
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c3c6d7",
    paddingHorizontal: 10,
    marginBottom: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#131b2e",
    height: "100%",
  },
  searchClear: {
    padding: 4,
  },
  itemCard: {
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.4)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
    marginBottom: 8,
  },
  itemCardOutOfStock: {
    borderColor: "#ba1a1a",
    opacity: 0.85,
  },
  itemCardLowStock: {
    borderColor: "#fef08a",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  thumbnailWrapper: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#f2f3ff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  itemDetails: {
    flex: 1,
    justifyContent: "space-between",
  },
  itemName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#131b2e",
  },
  itemSku: {
    fontSize: 11,
    color: "#737686",
    marginTop: 1,
  },
  itemMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 5,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: "#131b2e",
  },
  textSecondary: {
    color: "#737686",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    gap: 4,
  },
  badgeSuccess: {
    backgroundColor: "#dcfce7",
  },
  badgeWarning: {
    backgroundColor: "#fef08a",
  },
  badgeError: {
    backgroundColor: "#ffdad6",
  },
  badgeTextSuccess: {
    fontSize: 11,
    color: "#166534",
    fontWeight: "600",
  },
  badgeTextWarning: {
    fontSize: 11,
    color: "#854d0e",
    fontWeight: "600",
  },
  badgeTextError: {
    fontSize: 11,
    color: "#ba1a1a",
    fontWeight: "600",
  },
  // Compact side restock button
  restockIconBtn: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#004ac6",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
    minWidth: 60,
    alignSelf: "center",
  },
  restockIconBtnDanger: {
    backgroundColor: "#dc2626",
  },
  restockIconBtnText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 14,
    color: "#737686",
    marginTop: 12,
    textAlign: "center",
  },
  // Floating Toast
  floatingToast: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 20,
    alignSelf: "center",
    zIndex: 99999,
    backgroundColor: "#0f172a",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  floatingToastText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  // Bottom-sheet drawer styles
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "transparent",
  },
  sheetCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
    paddingTop: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 9999,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalCloseBtn: {
    padding: 4,
  },
  restockProductHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  restockThumbnailWrapper: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  restockProductName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  restockProductMeta: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  restockLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#004ac6",
    marginBottom: 8,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 12,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperInput: {
    width: 100,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#faf8ff",
    borderWidth: 1.5,
    borderColor: "#004ac6",
    fontSize: 20,
    fontWeight: "700",
    color: "#004ac6",
  },
  presetChipsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 16,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  presetChipActive: {
    backgroundColor: "#004ac6",
    borderColor: "#004ac6",
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  presetChipTextActive: {
    color: "#ffffff",
  },
  previewBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginBottom: 16,
  },
  previewBoxLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#166534",
  },
  previewBoxValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#15803d",
  },
  cancelBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  confirmRestockBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#004ac6",
    justifyContent: "center",
  },
  confirmRestockBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
});
