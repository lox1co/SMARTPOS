import templateAsset from "@/assets/products-template.xlsx";
import {
  LocalizedAlert as Alert,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from "@/components/i18n/LocalizedControls";
import { PRODUCT_CATEGORIES } from "@/constants/config";
import { Product, store } from "@/constants/store";
import { translatePhrase } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { Asset } from "expo-asset";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import Papa from "papaparse";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as XLSX from "xlsx";

import { CategoryFilters, CategoryFilterState } from "@/components/category_filter";
import { Palette } from "@/constants/theme";

interface SortOption {
  id: string;
  label: string;
  shortLabel: string;
  icon: string;
}

const SORT_OPTIONS: SortOption[] = [
  { id: "name_asc", label: "Name (A to Z)", shortLabel: "A to Z", icon: "sort-by-alpha" },
  { id: "name_desc", label: "Name (Z to A)", shortLabel: "Z to A", icon: "sort-by-alpha" },
  { id: "price_asc", label: "Price (Low to High)", shortLabel: "Price ↑", icon: "trending-up" },
  { id: "price_desc", label: "Price (High to Low)", shortLabel: "Price ↓", icon: "trending-down" },
  { id: "stock_asc", label: "Stock (Low to High)", shortLabel: "Stock ↑", icon: "inventory-2" },
  { id: "stock_desc", label: "Stock (High to Low)", shortLabel: "Stock ↓", icon: "inventory" },
];

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function ProductsScreen() {
  const router = useRouter();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryFilterState, setCategoryFilterState] = useState<CategoryFilterState>({
    enabled: false,
    operator: "is",
    values: [],
  });
  const [categoryFilterModalOpen, setCategoryFilterModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSortId, setSelectedSortId] = useState("name_asc");
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);

  const refreshCatalog = useCallback(async () => {
    setRefreshing(true);
    await store.syncProducts().catch(() => {});
    setProducts(store.getProducts());
    setRefreshing(false);
  }, []);

  // Refresh whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      store.syncProducts().catch(() => {});
      setProducts(store.getProducts());
    }, []),
  );

  // Subscribe to store updates
  useEffect(() => {
    setProducts(store.getProducts());
    const unsubscribe = store.subscribe(() => {
      setProducts(store.getProducts());
    });
    return unsubscribe;
  }, []);

  const activeSort = SORT_OPTIONS.find((s) => s.id === selectedSortId) || SORT_OPTIONS[0];

  // Category counts map for the combobox badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    PRODUCT_CATEGORIES.forEach((cat) => {
      counts[cat] = products.filter((p) => (p.category || "").toLowerCase() === cat.toLowerCase()).length;
    });
    return counts;
  }, [products]);

  // Filtering & Sorting products logic
  const processedProducts = useMemo(() => {
    // 1. Filter
    let result = products.filter((product) => {
      const prodCategory = (product.category || "").toLowerCase();

      // Advanced Category Filter Check
      let matchesCategory = true;
      if (categoryFilterState.enabled && categoryFilterState.values.length > 0) {
        const filterVals = categoryFilterState.values.map((v) => v.toLowerCase());
        if (categoryFilterState.operator === "is") {
          matchesCategory = prodCategory === filterVals[0];
        } else if (categoryFilterState.operator === "is not") {
          matchesCategory = !filterVals.includes(prodCategory);
        } else if (categoryFilterState.operator === "is any of") {
          matchesCategory = filterVals.includes(prodCategory);
        }
      }

      const matchesSearch =
        (product.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.sku || "").toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesSearch;
    });

    // 2. Sort
    result.sort((a, b) => {
      if (selectedSortId === "name_asc") return (a.name || "").localeCompare(b.name || "");
      if (selectedSortId === "name_desc") return (b.name || "").localeCompare(a.name || "");
      if (selectedSortId === "price_asc") return a.price - b.price;
      if (selectedSortId === "price_desc") return b.price - a.price;
      if (selectedSortId === "stock_asc") return a.stock - b.stock;
      if (selectedSortId === "stock_desc") return b.stock - a.stock;
      return 0;
    });

    return result;
  }, [products, categoryFilterState, searchQuery, selectedSortId]);

  const handleDownloadTemplate = async () => {
    try {
      // The template (with Category/Unit dropdowns) is pre-built by
      // scripts/generate-template.js and bundled as a static asset.
      const asset = Asset.fromModule(templateAsset);

      if (Platform.OS === "web") {
        const link = document.createElement("a");
        link.setAttribute("href", asset.uri);
        link.setAttribute("download", "products-template.xlsx");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        await asset.downloadAsync();
        if (!asset.localUri) {
          Alert.alert("Error", "Template file could not be loaded.");
          return;
        }
        // Copy into the document directory under a friendly name, then share.
        // copy() refuses to overwrite an existing file, so remove it first.
        const file = new File(Paths.document, "products-template.xlsx");
        if (file.exists) {
          file.delete();
        }
        new File(asset.localUri).copy(file);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, {
            mimeType: XLSX_MIME,
            dialogTitle: translatePhrase("Download Bulk Import Template"),
          });
        } else {
          Alert.alert("Sharing not available", "Cannot download template on this device.");
        }
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to download template");
    }
  };

  /** Map parsed rows (CSV or XLSX) to products and push them in bulk. */
  const importProductRows = async (rows: Record<string, string>[]) => {
    const newProducts: Omit<Product, "id">[] = [];
    for (const row of rows) {
      if (!row["Name"] || !row["Price"] || !row["Stock"] || !row["Category"]) {
        Alert.alert("Validation Error", "Name, Price, Stock, and Category are required for all products.");
        return;
      }
      const rawImage = (
        row["Image URL"] ||
        row["Image"] ||
        row["Image Url"] ||
        row["image_url"] ||
        row["image"] ||
        ""
      ).trim();

      newProducts.push({
        name: row["Name"],
        sku: row["SKU"] || "",
        price: parseFloat(row["Price"]),
        costPrice: parseFloat(row["Cost Price"]) || 0,
        stock: parseFloat(row["Stock"]),
        category: row["Category"],
        unit: row["Unit"] || "pcs",
        taxRate: parseFloat(row["Tax Rate"]) || 8,
        lowStockAlert: parseFloat(row["Low Stock Alert"]) || 5,
        image: rawImage || undefined,
      });
    }

    if (newProducts.length === 0) {
      Alert.alert("Empty File", "No valid products found in the file.");
      return;
    }

    try {
      setRefreshing(true);
      const res = await store.bulkAddProducts(newProducts);
      Alert.alert("Success", res.message || `Imported ${res.added} products.`);
      refreshCatalog();
    } catch (err: any) {
      Alert.alert("Import Failed", err.message || "Could not import products.");
    } finally {
      setRefreshing(false);
    }
  };

  /** Read the first worksheet of an .xlsx file into header-keyed rows. */
  const readXlsxRows = async (uri: string): Promise<Record<string, string>[]> => {
    const buffer = await new File(uri).arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { raw: false, defval: "" });
  };

  const handleImportProducts = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "application/vnd.ms-excel", "text/comma-separated-values", XLSX_MIME],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (asset.uri.toLowerCase().endsWith(".xlsx") || asset.mimeType === XLSX_MIME) {
        importProductRows(await readXlsxRows(asset.uri));
        return;
      }

      const fileContent = await new File(asset.uri).text();

      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors && results.errors.length > 0) {
            Alert.alert("CSV Parse Error", results.errors[0].message);
            return;
          }
          importProductRows(results.data as Record<string, string>[]);
        },
        error: (error: any) => {
          Alert.alert("CSV Error", error.message);
        },
      });
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to pick or read file.");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Products Catalog</Text>
      </View>

      {/* Main List */}
      <FlatList
        data={processedProducts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContainer}
        stickyHeaderIndices={[0]}
        refreshing={refreshing}
        onRefresh={refreshCatalog}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        ListHeaderComponent={
          /* Search & Filter Sticky Bar */
          <View style={styles.toolbarWrapper}>
            {/* 1. Search Bar */}
            <View style={styles.searchWrapper}>
              <MaterialIcons name="search" size={20} color="#737686" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search products by name or SKU..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4, marginRight: 4 }}>
                  <MaterialIcons name="close" size={18} color="#737686" />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.filterIconBtn,
                  categoryFilterState.enabled && categoryFilterState.values.length > 0 && styles.filterIconBtnActive,
                ]}
                onPress={() => setCategoryFilterModalOpen(true)}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="tune"
                  size={20}
                  color={categoryFilterState.enabled && categoryFilterState.values.length > 0 ? "#004ac6" : "#434655"}
                />
                {categoryFilterState.enabled && categoryFilterState.values.length > 0 && (
                  <View style={styles.filterIconDot} />
                )}
              </TouchableOpacity>
            </View>

            {/* 2. Advanced Dynamic Category Filter */}
            <CategoryFilters
              categoryFilter={categoryFilterState}
              onFilterChange={setCategoryFilterState}
              categoryCounts={categoryCounts}
              isModalOpen={categoryFilterModalOpen}
              onOpenModalChange={setCategoryFilterModalOpen}
            />

            {/* 3. Sub-bar: Item Count & Dedicated Sort Modal Trigger */}
            <View style={styles.metaRow}>
              <Text style={styles.resultsCount}>
                Showing <Text style={{ fontWeight: "700", color: "#131b2e" }}>{processedProducts.length}</Text>{" "}
                {processedProducts.length === 1 ? "item" : "items"}
                {categoryFilterState.enabled && categoryFilterState.values.length > 0
                  ? ` (Category ${categoryFilterState.operator} ${categoryFilterState.values.join(", ")})`
                  : ""}
              </Text>

              <TouchableOpacity
                style={styles.sortPillButton}
                onPress={() => setSortModalVisible(true)}
                activeOpacity={0.7}
              >
                <View style={styles.sortPillTag}>
                  <MaterialIcons name="sort" size={13} color={Palette.primary} />
                  <Text style={styles.sortPillTagText}>Sort</Text>
                </View>
                <View style={styles.sortPillValue}>
                  <MaterialIcons name={activeSort.icon as any} size={13} color={Palette.text} />
                  <Text style={styles.sortPillText} numberOfLines={1}>
                    {activeSort.shortLabel}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={14} color={Palette.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isOutOfStock = item.stock === 0;
          const isLowStock = item.stock > 0 && item.stock <= item.lowStockAlert;

          return (
            <TouchableOpacity
              style={styles.productItemCard}
              onPress={() => router.push(`/add_product?id=${item.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.productThumbnailWrapper}>
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={[styles.productThumbnail, isOutOfStock && styles.grayscaleImage]}
                    contentFit="cover"
                  />
                ) : (
                  <MaterialIcons name="inventory" size={24} color="#c3c6d7" />
                )}
              </View>

              <View style={styles.productDetails}>
                <Text style={[styles.productName, isOutOfStock && styles.textSecondary]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.productSku}>SKU: {item.sku}</Text>
              </View>

              <View style={styles.productMeta}>
                <Text style={[styles.productPrice, isOutOfStock && styles.textSecondary]}>
                  ₹{item.price.toFixed(2)}
                  {item.unit ? <Text style={styles.unitText}>/{item.unit}</Text> : null}
                </Text>

                {/* Stock status badge */}
                {isOutOfStock ? (
                  <View style={[styles.badge, styles.badgeError]}>
                    <View style={[styles.badgeDot, styles.dotError]} />
                    <Text style={styles.badgeTextError}>Out of Stock</Text>
                  </View>
                ) : isLowStock ? (
                  <View style={[styles.badge, styles.badgeWarning]}>
                    <View style={[styles.badgeDot, styles.dotWarning]} />
                    <Text style={styles.badgeTextWarning}>{item.stock} Low Stock</Text>
                  </View>
                ) : (
                  <View style={[styles.badge, styles.badgeSuccess]}>
                    <View style={[styles.badgeDot, styles.dotSuccess]} />
                    <Text style={styles.badgeTextSuccess}>{item.stock} In Stock</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="search-off" size={48} color="#c3c6d7" />
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptyText}>
              {searchQuery || (categoryFilterState.enabled && categoryFilterState.values.length > 0)
                ? "Try clearing your filters or search terms."
                : 'Your catalog is empty. Tap "+ Add Product" to get started!'}
            </Text>
            {searchQuery || (categoryFilterState.enabled && categoryFilterState.values.length > 0) ? (
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={() => {
                  setSearchQuery("");
                  setCategoryFilterState({
                    enabled: false,
                    operator: "is",
                    values: [],
                  });
                }}
              >
                <Text style={styles.resetFilterBtnText}>Clear Filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
      />

      {/* Floating Action Buttons */}
      {isFabOpen && (
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9 }]}
          activeOpacity={1}
          onPress={() => setIsFabOpen(false)}
        />
      )}

      {isFabOpen && (
        <View style={styles.fabMenu}>
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              setIsFabOpen(false);
              handleDownloadTemplate();
            }}
          >
            <Text style={styles.fabMenuLabel}>Download Template</Text>
            <View style={[styles.fab, styles.fabSecondary]}>
              <MaterialIcons name="file-download" size={24} color="#004ac6" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              setIsFabOpen(false);
              handleImportProducts();
            }}
          >
            <Text style={styles.fabMenuLabel}>Bulk Import</Text>
            <View style={[styles.fab, styles.fabSecondary]}>
              <MaterialIcons name="upload-file" size={24} color="#004ac6" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fabMenuItem}
            onPress={() => {
              setIsFabOpen(false);
              router.push("/add_product");
            }}
          >
            <Text style={styles.fabMenuLabel}>Add Product</Text>
            <View style={[styles.fab, styles.fabSecondary]}>
              <MaterialIcons name="add" size={24} color="#004ac6" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.fab, { zIndex: 10 }]}
        onPress={() => setIsFabOpen(!isFabOpen)}
        activeOpacity={0.85}
      >
        <MaterialIcons name={isFabOpen ? "close" : "add"} size={28} color="#ffffff" />
      </TouchableOpacity>

      {/* Sort Options Modal Sheet */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSortModalVisible(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Sort Products</Text>
              <TouchableOpacity onPress={() => setSortModalVisible(false)}>
                <MaterialIcons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.sortList}>
              {SORT_OPTIONS.map((opt) => {
                const isSelected = selectedSortId === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.sortOptionRow, isSelected && styles.sortOptionRowActive]}
                    onPress={() => {
                      setSelectedSortId(opt.id);
                      setSortModalVisible(false);
                    }}
                  >
                    <View style={styles.sortOptionLeft}>
                      <MaterialIcons name={opt.icon as any} size={20} color={isSelected ? "#004ac6" : "#64748b"} />
                      <Text style={[styles.sortOptionLabel, isSelected && styles.sortOptionLabelActive]}>
                        {opt.label}
                      </Text>
                    </View>
                    {isSelected && <MaterialIcons name="check" size={20} color="#004ac6" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
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
    padding: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#004ac6",
  },
  scrollContainer: {
    paddingBottom: 90,
  },
  toolbarWrapper: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.2)",
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: "#131b2e",
    paddingVertical: 0,
  },
  filterIconBtn: {
    padding: 6,
    borderRadius: 8,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  filterIconBtnActive: {
    backgroundColor: "#eaedff",
  },
  filterIconDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#004ac6",
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: 16,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterChipActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#004ac6",
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: "500",
    color: "#475569",
  },
  filterChipTextActive: {
    color: "#004ac6",
    fontWeight: "700",
  },
  filterBadge: {
    backgroundColor: "#e2e8f0",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  filterBadgeActive: {
    backgroundColor: "#004ac6",
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  filterBadgeTextActive: {
    color: "#ffffff",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  resultsCount: {
    fontSize: 12.5,
    color: "#64748b",
    fontWeight: "500",
  },
  sortPillButton: {
    flexDirection: "row",
    alignItems: "center",
    height: 30,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  sortPillTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    height: "100%",
    backgroundColor: "#eaedff",
  },
  sortPillTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#004ac6",
  },
  sortPillValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    height: "100%",
    backgroundColor: "#f8fafc",
  },
  sortPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#131b2e",
    maxWidth: 90,
  },
  productItemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  productThumbnailWrapper: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  productThumbnail: {
    width: "100%",
    height: "100%",
  },
  grayscaleImage: {
    opacity: 0.7,
  },
  productDetails: {
    flex: 1,
    justifyContent: "center",
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#131b2e",
    marginBottom: 4,
  },
  productSku: {
    fontSize: 12,
    color: "#737686",
  },
  productMeta: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  productPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: "#131b2e",
    marginBottom: 4,
  },
  unitText: {
    fontSize: 11,
    fontWeight: "400",
    color: "#434655",
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
    backgroundColor: "#fff8e6",
  },
  badgeError: {
    backgroundColor: "#ffdad6",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotSuccess: {
    backgroundColor: "#166534",
  },
  dotWarning: {
    backgroundColor: "#d97706",
  },
  dotError: {
    backgroundColor: "#ba1a1a",
  },
  badgeTextSuccess: {
    fontSize: 11,
    color: "#166534",
    fontWeight: "500",
  },
  badgeTextWarning: {
    fontSize: 11,
    color: "#d97706",
    fontWeight: "500",
  },
  badgeTextError: {
    fontSize: 11,
    color: "#ba1a1a",
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#131b2e",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13.5,
    color: "#737686",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
  },
  resetFilterBtn: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  resetFilterBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#004ac6",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#004ac6",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#004ac6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  fabMenu: {
    position: "absolute",
    bottom: 96,
    right: 24,
    alignItems: "flex-end",
    zIndex: 10,
    gap: 16,
  },
  fabMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fabMenuLabel: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#131b2e",
    overflow: "hidden",
  },
  fabSecondary: {
    position: "relative",
    bottom: 0,
    right: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ffffff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(19, 27, 46, 0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#cbd5e1",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e6e8f2",
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#131b2e",
  },
  sortList: {
    gap: 4,
  },
  sortOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  sortOptionRowActive: {
    backgroundColor: "#eaedff",
  },
  sortOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sortOptionLabel: {
    fontSize: 13.5,
    color: "#131b2e",
    fontWeight: "500",
  },
  sortOptionLabelActive: {
    color: "#004ac6",
    fontWeight: "700",
  },
});
