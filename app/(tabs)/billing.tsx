import {
  LocalizedAlert as Alert,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from "@/components/i18n/LocalizedControls";
import { PRODUCT_CATEGORIES } from "@/constants/config";
import { buildReceiptHtml, formatBillDate } from "@/constants/receipt";
import { Customer, GeneratedBill, Product, store } from "@/constants/store";
import { translatePhrase } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Print from "expo-print";
import { useFocusEffect, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface CartItem {
  product: Product;
  quantity: number;
}

const CATEGORIES = ["All Items", ...PRODUCT_CATEGORIES];

const PAYMENT_METHODS = [
  { id: "CASH", label: "Cash", icon: "payments", desc: "Cash payment" },
  { id: "UPI", label: "UPI / QR", icon: "qr-code-scanner", desc: "Instant QR" },
  { id: "CARD", label: "Card POS", icon: "credit-card", desc: "Debit / Credit" },
  { id: "CREDIT", label: "Khata Book", icon: "account-balance-wallet", desc: "Credit ledger" },
];

const formatNum = (val: any) => {
  const n = typeof val === "number" ? val : parseFloat(val);
  return isNaN(n) ? "0.00" : n.toFixed(2);
};

// Helper check for loose weight / volume items
const isWeightItem = (unit?: string) => ["kg", "g", "l", "ml"].includes(unit || "");

// Fixed item card height in 2-column grid for getItemLayout optimization
const GRID_ITEM_HEIGHT = 207;

interface ProductGridCardProps {
  product: Product;
  qtyInCart: number;
  onPress: (product: Product) => void;
}

const ProductGridCard = React.memo(function ProductGridCard({ product, qtyInCart, onPress }: ProductGridCardProps) {
  const isOutOfStock = product.stock <= 0;
  const isWeight = isWeightItem(product.unit);

  return (
    <TouchableOpacity
      style={[styles.productCard, isOutOfStock && styles.productCardDisabled]}
      activeOpacity={0.7}
      onPress={() => onPress(product)}
      disabled={isOutOfStock}
    >
      <View style={styles.imageWrapper}>
        {product.image ? (
          <Image source={{ uri: product.image }} style={styles.productImage} contentFit="cover" transition={200} />
        ) : (
          <View style={styles.placeholderImage}>
            <MaterialIcons name="shopping-bag" size={32} color="#8e90a0" />
          </View>
        )}
        {qtyInCart > 0 && (
          <View style={styles.quantityBadge}>
            <Text style={styles.quantityBadgeText}>{isWeight ? `${qtyInCart} ${product.unit}` : qtyInCart}</Text>
          </View>
        )}
        {isOutOfStock && (
          <View style={styles.outOfStockBadge}>
            <Text style={styles.outOfStockText}>Out of Stock</Text>
          </View>
        )}
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={styles.productSku}>{product.sku}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.productPrice}>
            ₹{product.price.toFixed(2)}
            <Text style={{ fontSize: 10, color: "#737686" }}>/{product.unit || "pc"}</Text>
          </Text>
          <Text style={styles.productStock}>
            {product.stock} {product.unit || "pcs"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function BillingScreen() {
  const router = useRouter();

  // States
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All Items");
  const [searchQuery, setSearchQuery] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountInput, setDiscountInput] = useState("");
  const [cartOpen, setCartOpen] = useState(false);

  // Weight & Volume Measurement Modal States
  const [weightModalProduct, setWeightModalProduct] = useState<Product | null>(null);
  const [weightInput, setWeightInput] = useState("0.5");
  const [weightUnitMode, setWeightUnitMode] = useState<"kg" | "g">("kg");

  // Payment & Bill Generator States
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("CASH");
  const [isProcessing, setIsProcessing] = useState(false);

  // Cash tendered (CASH) + customer capture (optional for CASH/UPI/CARD,
  // required for CREDIT). customers backs the quick-pick chips for credit sales.
  const [cashReceived, setCashReceived] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Generated Bill State
  const [billModalVisible, setBillModalVisible] = useState(false);
  const [generatedBill, setGeneratedBill] = useState<GeneratedBill | null>(null);

  // Defer search filtering for responsive input performance
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Ingest scanned items from the scanner modal
  const checkScanned = useCallback(() => {
    const scanned = store.consumeScannedItems();
    if (scanned && scanned.length > 0) {
      setCart((prevCart) => {
        const newCart = [...prevCart];
        scanned.forEach(({ product, quantity }) => {
          const pId = product.id.toString();
          const existingIdx = newCart.findIndex((item) => item.product.id.toString() === pId);
          if (existingIdx > -1) {
            newCart[existingIdx].quantity += quantity;
          } else {
            newCart.push({ product, quantity });
          }
        });
        return newCart;
      });
      setCartOpen(true);
    }
  }, []);

  // Automatically check scanned items on focus and dismiss lingering modals when switching away
  useFocusEffect(
    useCallback(() => {
      checkScanned();
      return () => {
        setPaymentModalVisible(false);
        setBillModalVisible(false);
      };
    }, [checkScanned]),
  );

  // Subscribe to store updates
  useEffect(() => {
    setProducts(store.getProducts());
    checkScanned();

    const unsubscribe = store.subscribe(() => {
      setProducts(store.getProducts());
      checkScanned();
    });
    return unsubscribe;
  }, [checkScanned]);

  // Animation for Bottom Sheet
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Open/Close Bottom Sheet Animation
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: cartOpen ? 0 : SCREEN_HEIGHT,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [cartOpen, slideAnim]);

  // Calculations (Single-pass loop for subtotal, totalItems, and proportional tax)
  const cartTotals = useMemo(() => {
    const isTaxEnabled = store.currentUser?.taxEnabled !== false;
    const storeTaxRate = store.currentUser?.taxRate;

    let subtotal = 0;
    let totalItems = 0;

    for (let i = 0; i < cart.length; i++) {
      const item = cart[i];
      subtotal += item.product.price * item.quantity;
      totalItems += isWeightItem(item.product.unit) ? 1 : item.quantity;
    }

    const discountAmount = subtotal * (discountPercent / 100);
    const taxableSubtotal = Math.max(0, subtotal - discountAmount);
    const discountFactor = subtotal > 0 ? taxableSubtotal / subtotal : 0;

    let tax = 0;
    if (isTaxEnabled && subtotal > 0) {
      for (let i = 0; i < cart.length; i++) {
        const item = cart[i];
        const taxableLine = item.product.price * item.quantity * discountFactor;
        const rate = storeTaxRate !== undefined && storeTaxRate !== null ? storeTaxRate : (item.product.taxRate ?? 0);
        tax += taxableLine * (rate / 100);
      }
    }

    const total = taxableSubtotal + tax;

    return {
      subtotal,
      discountAmount,
      tax,
      total,
      totalItems,
      isTaxEnabled,
    };
  }, [cart, discountPercent, store.currentUser?.taxEnabled, store.currentUser?.taxRate]);

  // Filtered Products (using deferred search query)
  const filteredProducts = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = selectedCategory === "All Items" || product.category === selectedCategory;
      const matchesSearch =
        !query || product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, deferredSearchQuery]);

  // Helper dictionary of product quantities in cart
  const cartQuantities = useMemo(() => {
    const quantities: Record<string, number> = {};
    cart.forEach((item) => {
      quantities[item.product.id] = item.quantity;
    });
    return quantities;
  }, [cart]);

  // Cart operations
  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) {
      Alert.alert("Out of Stock", translatePhrase("{{product}} is currently out of stock.", { product: product.name }));
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          Alert.alert(
            "Limit Reached",
            translatePhrase("Only {{qty}} {{unit}} available in stock.", {
              qty: product.stock,
              unit: translatePhrase(product.unit || "units"),
            }),
          );
          return prev;
        }
        return prev.map((item) => (item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  // Handle Product Tap
  const handleProductPress = useCallback(
    (product: Product) => {
      if (product.stock <= 0) {
        Alert.alert(
          "Out of Stock",
          translatePhrase("{{product}} is currently out of stock.", { product: product.name }),
        );
        return;
      }

      if (isWeightItem(product.unit)) {
        setWeightModalProduct(product);
        setCart((currentCart) => {
          const existing = currentCart.find((i) => i.product.id === product.id);
          if (existing) {
            setWeightInput(existing.quantity.toString());
          } else {
            setWeightInput(product.unit === "g" ? "250" : "0.5");
          }
          return currentCart;
        });
        setWeightUnitMode(product.unit === "g" ? "g" : "kg");
      } else {
        addToCart(product);
      }
    },
    [addToCart],
  );

  // Memoized renderItem for product catalog grid
  const renderProductItem = useCallback(
    ({ item }: { item: Product }) => (
      <ProductGridCard product={item} qtyInCart={cartQuantities[item.id] || 0} onPress={handleProductPress} />
    ),
    [cartQuantities, handleProductPress],
  );

  // getItemLayout for instantaneous scroll calculation on 2-column grid
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: GRID_ITEM_HEIGHT,
      offset: GRID_ITEM_HEIGHT * Math.floor(index / 2),
      index,
    }),
    [],
  );

  const handleConfirmWeight = () => {
    if (!weightModalProduct) return;
    let val = parseFloat(weightInput);
    if (isNaN(val) || val <= 0) {
      Alert.alert("Invalid Weight", "Please enter a valid weight or quantity greater than 0.");
      return;
    }

    if (weightUnitMode === "g" && weightModalProduct.unit === "kg") {
      val = val / 1000;
    }

    if (val > weightModalProduct.stock) {
      Alert.alert(
        "Stock Limit",
        translatePhrase("Only {{qty}} {{unit}} available in stock.", {
          qty: weightModalProduct.stock,
          unit: translatePhrase(weightModalProduct.unit || "kg"),
        }),
      );
      return;
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex((i) => i.product.id === weightModalProduct.id);
      if (existingIdx > -1) {
        const newCart = [...prev];
        newCart[existingIdx].quantity = val;
        return newCart;
      }
      return [...prev, { product: weightModalProduct, quantity: val }];
    });

    setWeightModalProduct(null);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const isWeight = isWeightItem(product.unit);
    const step = isWeight ? (product.unit === "g" ? 50 : 0.25) : 1;
    const actualDelta = delta > 0 ? step : -step;

    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = Math.round((item.quantity + actualDelta) * 1000) / 1000;
            if (nextQty > product.stock) {
              Alert.alert(
                "Limit Reached",
                translatePhrase("Only {{qty}} {{unit}} available in stock.", {
                  qty: product.stock,
                  unit: translatePhrase(product.unit || "units"),
                }),
              );
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const handleCustomDiscountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    setDiscountInput(cleaned);
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      setDiscountPercent(parsed);
    } else if (cleaned.trim() === "") {
      setDiscountPercent(0);
    }
  };

  const handleClearDiscount = () => {
    setDiscountPercent(0);
    setDiscountInput("");
  };

  // Load existing customers so credit sales can be attached by quick-pick
  // (find-or-create still happens server-side on checkout by name).
  const loadCustomers = async () => {
    const list = await store.fetchCustomers();
    setCustomers(list);
  };

  // Open Payment Details Modal
  const handleOpenPayment = () => {
    if (cart.length === 0) return;
    setPaymentModalVisible(true);
    if (customers.length === 0) loadCustomers();
  };

  // Process Checkout & Generate Bill
  const handleProcessCheckout = async () => {
    if (cart.length === 0) return;

    const isCredit = selectedPaymentMethod === "CREDIT";
    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();
    const cashProvided = selectedPaymentMethod === "CASH" && cashReceived.trim() !== "";
    const cashNum = parseFloat(cashReceived) || 0;

    // A credit (khata / udhaar) sale must be tied to a named customer.
    if (isCredit && !trimmedName) {
      Alert.alert("Customer Required", "Enter the customer name to record this credit (khata) sale.");
      return;
    }
    // If cash tendered is entered, it must at least cover the total.
    if (cashProvided && cashNum < cartTotals.total) {
      Alert.alert("Insufficient Cash", "Cash received is less than the total amount due.");
      return;
    }

    setIsProcessing(true);
    try {
      const bill = await store.checkoutOrder(
        cartTotals.subtotal,
        cartTotals.discountAmount,
        cartTotals.tax,
        cartTotals.total,
        cart.map((item) => ({
          product_id: item.product.id,
          product_name: item.product.name,
          quantity: item.quantity,
          price: item.product.price,
        })),
        selectedPaymentMethod,
        {
          customerName: trimmedName || undefined,
          customerPhone: trimmedPhone || undefined,
          amountPaid: cashProvided ? cashNum : undefined,
          paymentStatus: isCredit ? "CREDIT" : "PAID",
        },
      );

      setGeneratedBill(bill);
      setPaymentModalVisible(false);
      setCartOpen(false);
      setBillModalVisible(true);
    } catch (err: any) {
      Alert.alert("Checkout Failed", err.message || "Unable to process checkout.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetForNewSale = () => {
    setCart([]);
    setCartOpen(false);
    setDiscountPercent(0);
    setDiscountInput("");
    setPaymentModalVisible(false);
    setBillModalVisible(false);
    setGeneratedBill(null);
    setSelectedPaymentMethod("CASH");
    setCashReceived("");
    setCustomerName("");
    setCustomerPhone("");
  };

  const handleShareBill = async () => {
    if (!generatedBill) return;
    try {
      const html = buildReceiptHtml(generatedBill);

      // Preferred path: render a PDF and hand it to the OS share sheet.
      if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: `Bill ${generatedBill.invoice_number}`,
        });
        return;
      }

      // Fallback (web / no share sheet): share a plain-text summary.
      const itemsText = generatedBill.items
        .map(
          (i) => `• ${i.product_name} x${i.quantity} = ₹${formatNum((parseFloat(i.price as any) || 0) * i.quantity)}`,
        )
        .join("\n");

      const billText =
        `🧾 *${generatedBill.shop_name} - ${translatePhrase("Bill Receipt")}*\n` +
        `${translatePhrase("Invoice")}: ${generatedBill.invoice_number}\n` +
        `${translatePhrase("Date")}: ${formatBillDate(generatedBill.created_at)}\n` +
        `${translatePhrase("Payment")}: ${translatePhrase(generatedBill.payment_method)}\n` +
        `------------------------\n` +
        `${itemsText}\n` +
        `------------------------\n` +
        `${translatePhrase("Subtotal")}: ₹${formatNum(generatedBill.subtotal)}\n` +
        `${translatePhrase("Tax")}: ₹${formatNum(generatedBill.tax)}\n` +
        ((parseFloat(generatedBill.discount as any) || 0) > 0
          ? `${translatePhrase("Discount")}: -₹${formatNum(generatedBill.discount)}\n`
          : "") +
        `*${translatePhrase("Total")}: ₹${formatNum(generatedBill.total)}*\n\n` +
        translatePhrase("Thank you for shopping with us!");

      await Share.share({
        message: billText,
        title: `${translatePhrase("Bill")} ${generatedBill.invoice_number}`,
      });
    } catch (error: any) {
      // A user-cancelled share sheet is not an error worth surfacing.
      if (!/cancel|dismiss/i.test(error?.message || "")) {
        console.warn("Share error:", error?.message);
      }
    }
  };

  const handlePrintBill = async () => {
    if (!generatedBill) return;
    try {
      await Print.printAsync({ html: buildReceiptHtml(generatedBill) });
    } catch (err: any) {
      if (!/cancel|dismiss|did not complete/i.test(err?.message || "")) {
        Alert.alert("Print Failed", err?.message || "Unable to print the receipt.");
      }
    }
  };

  // Derived payment-modal state.
  const paymentBlocked =
    isProcessing ||
    (selectedPaymentMethod === "CREDIT" && customerName.trim().length === 0) ||
    (selectedPaymentMethod === "CASH" &&
      cashReceived.trim() !== "" &&
      (parseFloat(cashReceived) || 0) < cartTotals.total);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>SmartPOS</Text>
          <View style={styles.storeBadge}>
            <Text style={styles.storeBadgeText}>{store.currentUser?.shopName || "Store"}</Text>
          </View>
        </View>
      </View>

      {/* Main Grid View */}
      <View style={styles.mainContent}>
        {/* Search and Action Bar */}
        <View style={styles.searchBarContainer}>
          <View style={styles.searchWrapper}>
            <MaterialIcons name="search" size={20} color="#737686" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products by name or SKU..."
              placeholderTextColor="#737686"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <MaterialIcons name="close" size={18} color="#737686" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.scanButton} onPress={() => router.push("/scanner")}>
            <MaterialIcons name="qr-code-scanner" size={20} color="#ffffff" />
            <Text style={styles.scanButtonText}>Scan</Text>
          </TouchableOpacity>
        </View>

        {/* Category Selector */}
        <View style={styles.categoryContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Product Catalog Grid */}
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productList}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
          getItemLayout={getItemLayout}
          renderItem={renderProductItem}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={48} color="#c3c6d7" />
              <Text style={styles.emptyStateText}>No products found</Text>
            </View>
          }
        />
      </View>

      {/* Floating Cart Bar (Collapsed State) */}
      {!cartOpen && cart.length > 0 && (
        <View style={styles.floatingCartContainer}>
          <TouchableOpacity style={styles.floatingCartBar} activeOpacity={0.9} onPress={() => setCartOpen(true)}>
            <View style={styles.floatingCartLeft}>
              <View style={styles.cartCountPill}>
                <Text style={styles.cartCountPillText}>{cartTotals.totalItems}</Text>
              </View>
              <Text style={styles.floatingCartLabel}>View Cart</Text>
            </View>
            <View style={styles.floatingCartRight}>
              <Text style={styles.floatingCartTotal}>₹{cartTotals.total.toFixed(2)}</Text>
              <MaterialIcons name="keyboard-arrow-up" size={24} color="#ffffff" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Backdrop when cart is open */}
      {cartOpen && (
        <TouchableOpacity style={styles.cartBackdrop} activeOpacity={1} onPress={() => setCartOpen(false)} />
      )}

      {/* Slide-up Cart Bottom Sheet */}
      {cartOpen && (
        <Animated.View style={[styles.cartBottomSheet, { transform: [{ translateY: slideAnim }] }]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            {/* Sheet Handle / Header */}
            <View style={styles.cartHeader}>
              <View style={styles.cartHeaderTop}>
                <View style={styles.sheetHandle} />
              </View>
              <View style={styles.cartHeaderContent}>
                <View>
                  <Text style={styles.cartTitle}>Current Order</Text>
                  <Text style={styles.cartSubtitle}>
                    {cartTotals.totalItems} {cartTotals.totalItems === 1 ? "item" : "items"}
                  </Text>
                </View>
                <View style={styles.cartHeaderActions}>
                  <TouchableOpacity style={styles.clearCartBtn} onPress={() => setCart([])}>
                    <Text style={styles.clearCartText}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.closeCartBtn} onPress={() => setCartOpen(false)}>
                    <MaterialIcons name="close" size={20} color="#434655" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Cart Item List */}
            <ScrollView
              style={styles.cartList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {cart.map((item) => {
                const isWeight = isWeightItem(item.product.unit);
                return (
                  <View key={item.product.id} style={styles.cartItemRow}>
                    <View style={styles.cartItemInfo}>
                      <Text style={styles.cartItemName} numberOfLines={1}>
                        {item.product.name}
                      </Text>
                      <Text style={styles.cartItemPrice}>
                        ₹{item.product.price.toFixed(2)} / {item.product.unit || "pc"}
                      </Text>
                    </View>

                    <View style={styles.cartItemActions}>
                      <View style={styles.qtyControl}>
                        <TouchableOpacity style={styles.cartQtyBtn} onPress={() => updateQuantity(item.product.id, -1)}>
                          <MaterialIcons name="remove" size={16} color="#004ac6" />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => isWeight && handleProductPress(item.product)}
                          disabled={!isWeight}
                        >
                          <Text
                            style={[
                              styles.cartQtyTextVal,
                              isWeight && { color: "#004ac6", textDecorationLine: "underline" },
                            ]}
                          >
                            {item.quantity} {item.product.unit || "pcs"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cartQtyBtn} onPress={() => updateQuantity(item.product.id, 1)}>
                          <MaterialIcons name="add" size={16} color="#004ac6" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.cartItemTotal}>₹{(item.product.price * item.quantity).toFixed(2)}</Text>
                      <TouchableOpacity
                        style={styles.cartDeleteBtn}
                        onPress={() => removeFromCart(item.product.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Remove item"
                      >
                        <MaterialIcons name="delete-outline" size={20} color="#ba1a1a" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
              {cart.length === 0 && (
                <View style={styles.emptyCart}>
                  <MaterialIcons name="remove-shopping-cart" size={40} color="#c3c6d7" />
                  <Text style={styles.emptyCartText}>Your cart is empty</Text>
                </View>
              )}
            </ScrollView>

            {/* Cart Calculations & Charge Bar */}
            <View style={styles.cartFooter}>
              {/* Breakdown */}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>₹{cartTotals.subtotal.toFixed(2)}</Text>
              </View>

              {/* Seamless In-Theme Discount Row */}
              <View style={styles.summaryDiscountRow}>
                <View style={styles.summaryDiscountLeft}>
                  <Text style={styles.summaryLabel}>Discount</Text>
                  <View style={styles.summaryDiscountInputWrap}>
                    <TextInput
                      style={styles.summaryDiscountInput}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#737686"
                      maxLength={5}
                      value={discountInput}
                      onChangeText={handleCustomDiscountChange}
                      returnKeyType="done"
                      onSubmitEditing={Keyboard.dismiss}
                    />
                    <Text style={styles.summaryDiscountPercentSign}>%</Text>
                    {discountPercent > 0 && (
                      <TouchableOpacity
                        style={styles.summaryDiscountClearBtn}
                        onPress={handleClearDiscount}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        accessibilityLabel="Clear discount"
                      >
                        <MaterialIcons name="close" size={13} color="#ba1a1a" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <Text style={[styles.summaryValue, discountPercent > 0 && styles.discountAppliedText]}>
                  {discountPercent > 0 ? `-₹${cartTotals.discountAmount.toFixed(2)}` : "₹0.00"}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>
                  {cartTotals.isTaxEnabled
                    ? `Tax ${store.currentUser?.taxRate !== undefined ? `(${store.currentUser.taxRate}%)` : ""}`
                    : "Tax (Disabled / 0%)"}
                </Text>
                <Text style={styles.summaryValue}>₹{cartTotals.tax.toFixed(2)}</Text>
              </View>

              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Grand Total</Text>
                <Text style={styles.totalValue}>₹{cartTotals.total.toFixed(2)}</Text>
              </View>

              {/* Charge Button */}
              <TouchableOpacity
                style={[styles.chargeButton, cart.length === 0 && styles.chargeButtonDisabled]}
                disabled={cart.length === 0}
                onPress={handleOpenPayment}
              >
                <MaterialIcons name="point-of-sale" size={20} color="#ffffff" />
                <Text style={styles.chargeButtonText}>Proceed to Payment</Text>
                <Text style={styles.chargeButtonAmount}>₹{cartTotals.total.toFixed(2)}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      )}

      {/* Payment & Customer Details Bottom Sheet Modal */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.paymentModalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.paymentModalContainer}
          >
            {/* Sheet Handle */}
            <View style={styles.modalHandle} />

            {/* Header */}
            <View style={styles.paymentModalHeader}>
              <View>
                <Text style={styles.paymentModalTitle}>Complete Payment</Text>
                <Text style={styles.paymentModalSubtitle}>
                  {cartTotals.totalItems} items · Cart Subtotal ₹{cartTotals.subtotal.toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPaymentModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialIcons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              {/* 1. Hero Total Payable Card */}
              <View style={styles.payableHeroCard}>
                <View style={styles.payableHeroLeft}>
                  <Text style={styles.payableHeroLabel}>Total Payable</Text>
                  <Text style={styles.payableHeroSub}>Includes all GST & discounts</Text>
                </View>
                <Text style={styles.payableHeroAmount}>₹{cartTotals.total.toFixed(2)}</Text>
              </View>

              {/* 2. Payment Method 2x2 Grid */}
              <Text style={styles.paymentSectionHeader}>Select Payment Mode</Text>
              <View style={styles.paymentGrid}>
                {PAYMENT_METHODS.map((method) => {
                  const isSelected = selectedPaymentMethod === method.id;
                  return (
                    <TouchableOpacity
                      key={method.id}
                      style={[styles.paymentGridCard, isSelected && styles.paymentGridCardSelected]}
                      onPress={() => {
                        setSelectedPaymentMethod(method.id);
                        if (method.id === "CREDIT" && customers.length === 0) loadCustomers();
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.paymentCardTopRow}>
                        <View style={[styles.paymentCardIconWrap, isSelected && styles.paymentCardIconWrapSelected]}>
                          <MaterialIcons
                            name={method.icon as any}
                            size={22}
                            color={isSelected ? "#004ac6" : "#64748b"}
                          />
                        </View>
                        {isSelected && <MaterialIcons name="check-circle" size={18} color="#004ac6" />}
                      </View>
                      <Text style={[styles.paymentCardTitle, isSelected && styles.paymentCardTitleSelected]}>
                        {method.label}
                      </Text>
                      <Text style={styles.paymentCardDesc}>{method.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 3. Conditional Mode-Specific Helpers */}
              {/* UPI Helper */}
              {selectedPaymentMethod === "UPI" && (
                <View style={[styles.modeHelperCard, { backgroundColor: "#f0f9ff", borderColor: "#bae6fd" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <MaterialIcons name="qr-code" size={24} color="#0284c7" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.helperCardTitle, { color: "#0369a1", marginBottom: 2 }]}>
                        Instant UPI Collection
                      </Text>
                      <Text style={{ fontSize: 12, color: "#0284c7" }}>
                        Customer can scan your store QR code or soundbox. Verify transaction before confirming.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* CARD Helper */}
              {selectedPaymentMethod === "CARD" && (
                <View style={[styles.modeHelperCard, { backgroundColor: "#f5f3ff", borderColor: "#ddd6fe" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <MaterialIcons name="credit-card" size={24} color="#7c3aed" />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.helperCardTitle, { color: "#6d28d9", marginBottom: 2 }]}>
                        Card Terminal Payment
                      </Text>
                      <Text style={{ fontSize: 12, color: "#7c3aed" }}>
                        Swipe, insert chip, or tap customer card on EDC machine.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* CREDIT Helper */}
              {selectedPaymentMethod === "CREDIT" && (
                <View style={[styles.modeHelperCard, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <MaterialIcons name="account-balance-wallet" size={20} color="#b45309" />
                    <Text style={[styles.helperCardTitle, { color: "#b45309", marginBottom: 0 }]}>
                      Khata / Credit Sale
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: "#92400e", marginBottom: 10, lineHeight: 16 }}>
                    This amount will be added as outstanding debt in customer&apos;s ledger.
                  </Text>

                  {/* Customer Quick Select Chips */}
                  {customers.length > 0 && (
                    <View style={{ marginBottom: 10 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: "600", color: "#92400e", marginBottom: 6 }}>
                        Quick Pick Existing Customer:
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {customers.map((c) => {
                          const active = customerName.trim() === c.name;
                          return (
                            <TouchableOpacity
                              key={c.id}
                              style={[styles.customerChip, active && styles.customerChipActive]}
                              onPress={() => {
                                setCustomerName(c.name);
                                setCustomerPhone(c.phone || "");
                              }}
                            >
                              <Text
                                style={[styles.customerChipText, active && { color: "#004ac6", fontWeight: "700" }]}
                                numberOfLines={1}
                              >
                                {c.name}
                              </Text>
                              {c.credit_balance > 0 && (
                                <Text style={styles.customerChipBalance}>Due ₹{c.credit_balance.toFixed(0)}</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.openKhataButton}
                    onPress={() => {
                      setPaymentModalVisible(false);
                      router.push("/customers" as any);
                    }}
                  >
                    <MaterialIcons name="people" size={16} color="#004ac6" />
                    <Text style={styles.openKhataButtonText}>Open Customer Ledger & Khata Book</Text>
                    <MaterialIcons name="chevron-right" size={16} color="#004ac6" />
                  </TouchableOpacity>
                </View>
              )}

              {/* 4. Customer Information Card */}
              <View style={styles.customerFormCard}>
                <View style={styles.customerFormHeader}>
                  <MaterialIcons name="person-outline" size={18} color="#004ac6" />
                  <Text style={styles.customerFormTitle}>
                    Customer Details {selectedPaymentMethod === "CREDIT" ? "(Required *)" : "(Optional for Bill)"}
                  </Text>
                </View>

                <View style={styles.customerFieldGroup}>
                  <Text style={styles.customerFieldLabel}>
                    Customer Name {selectedPaymentMethod === "CREDIT" ? "*" : ""}
                  </Text>
                  <View style={styles.customerInputWrap}>
                    <MaterialIcons name="person" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.customerInput}
                      placeholder="Enter customer full name"
                      placeholderTextColor="#94a3b8"
                      value={customerName}
                      onChangeText={setCustomerName}
                    />
                  </View>
                </View>

                <View style={styles.customerFieldGroup}>
                  <Text style={styles.customerFieldLabel}>Mobile Number (Optional)</Text>
                  <View style={styles.customerInputWrap}>
                    <MaterialIcons name="phone" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.customerInput}
                      placeholder="Enter customer phone number"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      value={customerPhone}
                      onChangeText={setCustomerPhone}
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Confirm & Generate Bill Bottom Button */}
            <TouchableOpacity
              style={[styles.confirmPaymentBtn, paymentBlocked && styles.chargeButtonDisabled]}
              disabled={paymentBlocked}
              onPress={handleProcessCheckout}
              activeOpacity={0.85}
            >
              <MaterialIcons name="receipt-long" size={22} color="#ffffff" />
              <Text style={styles.confirmPaymentText}>
                {isProcessing
                  ? "Generating Bill..."
                  : selectedPaymentMethod === "CREDIT"
                    ? `Confirm Khata Bill (₹${cartTotals.total.toFixed(2)})`
                    : `Confirm & Print Bill (₹${cartTotals.total.toFixed(2)})`}
              </Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Bill / Invoice Receipt Modal */}
      <Modal visible={billModalVisible} transparent animationType="fade" onRequestClose={handleResetForNewSale}>
        <View style={styles.modalOverlay}>
          <View style={styles.billModalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Receipt Header */}
              <View style={styles.receiptHeader}>
                <Text style={styles.receiptShopName}>{generatedBill?.shop_name || "SmartPOS Supermart"}</Text>
                {generatedBill?.shop_address && <Text style={styles.receiptShopSub}>{generatedBill.shop_address}</Text>}
                {generatedBill?.shop_phone && (
                  <Text style={styles.receiptShopSub}>Tel: {generatedBill.shop_phone}</Text>
                )}
                {generatedBill?.gst_number ? (
                  <Text style={styles.receiptShopGst}>GSTIN: {generatedBill.gst_number}</Text>
                ) : null}
              </View>

              <View style={styles.receiptDivider} />

              {/* Invoice Metadata */}
              <View style={styles.receiptMetaGrid}>
                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMetaKey}>Invoice No:</Text>
                  <Text style={[styles.receiptMetaVal, styles.invoiceNoHighlight]}>
                    {generatedBill?.invoice_number}
                  </Text>
                </View>
                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMetaKey}>Date & Time:</Text>
                  <Text style={styles.receiptMetaVal}>
                    {generatedBill ? formatBillDate(generatedBill.created_at) : ""}
                  </Text>
                </View>
                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMetaKey}>Payment Mode:</Text>
                  <Text style={styles.receiptMetaVal}>
                    {generatedBill?.payment_method}
                    {generatedBill?.payment_status && generatedBill.payment_status !== "PAID"
                      ? ` (${generatedBill.payment_status})`
                      : ""}
                  </Text>
                </View>
                {(generatedBill?.customer_name || generatedBill?.customer_phone) && (
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMetaKey}>Customer:</Text>
                    <Text style={styles.receiptMetaVal}>
                      {generatedBill?.customer_name || ""}
                      {generatedBill?.customer_phone ? ` · ${generatedBill.customer_phone}` : ""}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.receiptDivider} />

              {/* Line Items Table */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCol, styles.tableColItem]}>Item</Text>
                <Text style={[styles.tableCol, styles.tableColQty]}>Qty</Text>
                <Text style={[styles.tableCol, styles.tableColRate]}>Rate</Text>
                <Text style={[styles.tableCol, styles.tableColAmt]}>Total</Text>
              </View>

              {generatedBill?.items.map((item, idx) => (
                <View key={idx} style={styles.tableRow}>
                  <Text style={[styles.tableColText, styles.tableColItem]} numberOfLines={1}>
                    {item.product_name}
                  </Text>
                  <Text style={[styles.tableColText, styles.tableColQty]}>{item.quantity}</Text>
                  <Text style={[styles.tableColText, styles.tableColRate]}>₹{formatNum(item.price)}</Text>
                  <Text style={[styles.tableColText, styles.tableColAmt]}>
                    ₹{formatNum((parseFloat(item.price as any) || 0) * item.quantity)}
                  </Text>
                </View>
              ))}

              <View style={styles.receiptDivider} />

              {/* Financial Breakdown */}
              <View style={styles.billSummaryBox}>
                <View style={styles.billSummaryRow}>
                  <Text style={styles.billSummaryLabel}>Subtotal</Text>
                  <Text style={styles.billSummaryVal}>₹{formatNum(generatedBill?.subtotal)}</Text>
                </View>
                {(parseFloat(generatedBill?.discount as any) || 0) > 0 && (
                  <View style={styles.billSummaryRow}>
                    <Text style={styles.billSummaryLabel}>Discount</Text>
                    <Text style={[styles.billSummaryVal, styles.discountAppliedText]}>
                      -₹{formatNum(generatedBill?.discount)}
                    </Text>
                  </View>
                )}
                <View style={styles.billSummaryRow}>
                  <Text style={styles.billSummaryLabel}>Tax</Text>
                  <Text style={styles.billSummaryVal}>₹{formatNum(generatedBill?.tax)}</Text>
                </View>
                <View style={[styles.billSummaryRow, styles.billGrandTotalRow]}>
                  <Text style={styles.billGrandTotalLabel}>Grand Total</Text>
                  <Text style={styles.billGrandTotalVal}>₹{formatNum(generatedBill?.total)}</Text>
                </View>
                {generatedBill?.amount_paid !== undefined && (
                  <>
                    <View style={styles.billSummaryRow}>
                      <Text style={styles.billSummaryLabel}>Cash Received</Text>
                      <Text style={styles.billSummaryVal}>₹{formatNum(generatedBill?.amount_paid)}</Text>
                    </View>
                    <View style={styles.billSummaryRow}>
                      <Text style={styles.billSummaryLabel}>Change Due</Text>
                      <Text style={styles.billSummaryVal}>₹{formatNum(generatedBill?.change_due)}</Text>
                    </View>
                  </>
                )}
                {generatedBill?.payment_status === "CREDIT" && (
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
                    <View style={styles.billSummaryRow}>
                      <Text style={[styles.billSummaryLabel, { color: "#b45309", fontWeight: "600" }]}>
                        Current Bill (Unpaid)
                      </Text>
                      <Text style={[styles.billSummaryVal, { color: "#b45309", fontWeight: "700" }]}>
                        ₹{formatNum(generatedBill?.total)}
                      </Text>
                    </View>
                    {generatedBill?.customer_credit_balance !== undefined && (
                      <View
                        style={[
                          styles.billSummaryRow,
                          { borderTopWidth: 1, borderTopColor: "#fde68a", paddingTop: 4, marginTop: 4 },
                        ]}
                      >
                        <Text style={[styles.billSummaryLabel, { color: "#92400e", fontWeight: "800" }]}>
                          Total Outstanding Due
                        </Text>
                        <Text style={[styles.billSummaryVal, { color: "#92400e", fontWeight: "800", fontSize: 15 }]}>
                          ₹{formatNum(generatedBill?.customer_credit_balance)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {generatedBill?.pending && (
                <Text style={styles.pendingNote}>⏳ Saved offline — will sync automatically when back online.</Text>
              )}

              <Text style={styles.receiptFooterNote}>*** Thank You for Shopping! Please Visit Again ***</Text>
            </ScrollView>

            {/* Bill Actions: Print, Share, New Sale */}
            <View style={styles.receiptActions}>
              <TouchableOpacity style={styles.receiptPrintBtn} onPress={handlePrintBill}>
                <MaterialIcons name="print" size={18} color="#004ac6" />
                <Text style={styles.receiptPrintText}>Print</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.receiptShareBtn} onPress={handleShareBill}>
                <MaterialIcons name="share" size={18} color="#006329" />
                <Text style={styles.receiptShareText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.receiptNewSaleBtn} onPress={handleResetForNewSale}>
                <MaterialIcons name="add-shopping-cart" size={18} color="#ffffff" />
                <Text style={styles.receiptNewSaleText}>New Sale</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Weight / Measurement Quantity Modal */}
      <Modal
        visible={!!weightModalProduct}
        transparent
        animationType="fade"
        onRequestClose={() => setWeightModalProduct(null)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.weightModalContainer}
          >
            {weightModalProduct && (
              <>
                <View style={styles.weightModalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.weightModalTitle}>{weightModalProduct.name}</Text>
                    <Text style={styles.weightModalSubtitle}>
                      Rate: ₹{weightModalProduct.price.toFixed(2)} / {weightModalProduct.unit || "kg"} • Stock:{" "}
                      {weightModalProduct.stock} {weightModalProduct.unit || "kg"}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setWeightModalProduct(null)} style={styles.modalCloseBtn}>
                    <MaterialIcons name="close" size={20} color="#737686" />
                  </TouchableOpacity>
                </View>

                {/* Quick Unit Toggle for Kg vs Grams */}
                {weightModalProduct.unit === "kg" && (
                  <View style={styles.unitToggleRow}>
                    <TouchableOpacity
                      style={[styles.unitToggleBtn, weightUnitMode === "kg" && styles.unitToggleBtnActive]}
                      onPress={() => {
                        if (weightUnitMode !== "kg") {
                          const gVal = parseFloat(weightInput) || 0;
                          setWeightInput((gVal / 1000).toString());
                          setWeightUnitMode("kg");
                        }
                      }}
                    >
                      <Text style={[styles.unitToggleText, weightUnitMode === "kg" && styles.unitToggleTextActive]}>
                        Kilograms (kg)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.unitToggleBtn, weightUnitMode === "g" && styles.unitToggleBtnActive]}
                      onPress={() => {
                        if (weightUnitMode !== "g") {
                          const kgVal = parseFloat(weightInput) || 0;
                          setWeightInput((kgVal * 1000).toString());
                          setWeightUnitMode("g");
                        }
                      }}
                    >
                      <Text style={[styles.unitToggleText, weightUnitMode === "g" && styles.unitToggleTextActive]}>
                        Grams (g)
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Quick Presets */}
                <Text style={styles.presetsLabel}>Quick Presets:</Text>
                <View style={styles.presetChipsRow}>
                  {weightModalProduct.unit === "kg" ? (
                    <>
                      <TouchableOpacity
                        style={styles.presetChip}
                        onPress={() => {
                          setWeightUnitMode("g");
                          setWeightInput("100");
                        }}
                      >
                        <Text style={styles.presetChipText}>100g</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.presetChip}
                        onPress={() => {
                          setWeightUnitMode("g");
                          setWeightInput("250");
                        }}
                      >
                        <Text style={styles.presetChipText}>250g</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.presetChip}
                        onPress={() => {
                          setWeightUnitMode("g");
                          setWeightInput("500");
                        }}
                      >
                        <Text style={styles.presetChipText}>500g</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.presetChip}
                        onPress={() => {
                          setWeightUnitMode("g");
                          setWeightInput("750");
                        }}
                      >
                        <Text style={styles.presetChipText}>750g</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.presetChip}
                        onPress={() => {
                          setWeightUnitMode("kg");
                          setWeightInput("1");
                        }}
                      >
                        <Text style={styles.presetChipText}>1 kg</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.presetChip}
                        onPress={() => {
                          setWeightUnitMode("kg");
                          setWeightInput("2");
                        }}
                      >
                        <Text style={styles.presetChipText}>2 kg</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.presetChip} onPress={() => setWeightInput("0.25")}>
                        <Text style={styles.presetChipText}>0.25</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.presetChip} onPress={() => setWeightInput("0.5")}>
                        <Text style={styles.presetChipText}>0.5</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.presetChip} onPress={() => setWeightInput("1")}>
                        <Text style={styles.presetChipText}>1.0</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.presetChip} onPress={() => setWeightInput("2")}>
                        <Text style={styles.presetChipText}>2.0</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>

                {/* Weight Input Box */}
                <View style={styles.weightInputWrapper}>
                  <TextInput
                    style={styles.weightTextInput}
                    keyboardType="decimal-pad"
                    placeholder="Enter weight or quantity"
                    value={weightInput}
                    onChangeText={setWeightInput}
                    autoFocus
                  />
                  <Text style={styles.weightUnitSuffix}>
                    {weightModalProduct.unit === "kg" ? weightUnitMode : weightModalProduct.unit || "units"}
                  </Text>
                </View>

                {/* Live Subtotal Preview */}
                {(() => {
                  const pInput = parseFloat(weightInput) || 0;
                  const eQty = weightUnitMode === "g" && weightModalProduct.unit === "kg" ? pInput / 1000 : pInput;
                  const calcTotal = weightModalProduct.price * eQty;
                  return (
                    <View style={styles.weightPreviewBox}>
                      <Text style={styles.weightPreviewLabel}>Calculated Amount:</Text>
                      <Text style={styles.weightPreviewTotal}>₹{calcTotal.toFixed(2)}</Text>
                    </View>
                  );
                })()}

                {/* Action Buttons */}
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setWeightModalProduct(null)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalConfirmBtn, { backgroundColor: "#004ac6" }]}
                    onPress={handleConfirmWeight}
                  >
                    <MaterialIcons name="add-shopping-cart" size={18} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.modalConfirmText}>Add to Cart</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </KeyboardAvoidingView>
        </View>
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
    height: 60,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.2)",
    backgroundColor: "#ffffff",
  },
  headerLeft: {
    flexDirection: "column",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#004ac6",
  },
  storeBadge: {
    backgroundColor: "#e6edff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
    alignSelf: "flex-start",
  },
  storeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#004ac6",
  },
  mainContent: {
    flex: 1,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.1)",
    gap: 12,
  },
  searchWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f3fa",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#131b2e",
  },
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#004ac6",
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 10,
    gap: 6,
  },
  scanButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  categoryContainer: {
    backgroundColor: "#ffffff",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.15)",
  },
  categoryScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f3f3fa",
    borderWidth: 1,
    borderColor: "transparent",
  },
  categoryChipActive: {
    backgroundColor: "#004ac6",
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#434655",
  },
  categoryChipTextActive: {
    color: "#ffffff",
    fontWeight: "600",
  },
  productList: {
    padding: 12,
    paddingBottom: 90,
  },
  productCard: {
    flex: 1,
    margin: 6,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  productCardDisabled: {
    opacity: 0.5,
  },
  imageWrapper: {
    width: "100%",
    height: 120,
    backgroundColor: "#f3f3fa",
    position: "relative",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#004ac6",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  quantityBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  outOfStockBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(186, 26, 26, 0.85)",
    paddingVertical: 4,
    alignItems: "center",
  },
  outOfStockText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#131b2e",
    marginBottom: 2,
  },
  productSku: {
    fontSize: 11,
    color: "#737686",
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "700",
    color: "#004ac6",
  },
  productStock: {
    fontSize: 11,
    color: "#737686",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 15,
    color: "#737686",
    marginTop: 12,
  },
  floatingCartContainer: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
  },
  floatingCartBar: {
    backgroundColor: "#004ac6",
    borderRadius: 14,
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    shadowColor: "#004ac6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  floatingCartLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cartCountPill: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  cartCountPillText: {
    color: "#004ac6",
    fontSize: 13,
    fontWeight: "700",
  },
  floatingCartLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  floatingCartRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  floatingCartTotal: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  cartBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 90,
  },
  cartBottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.78,
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 99,
  },
  cartHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.2)",
  },
  cartHeaderTop: {
    alignItems: "center",
    marginBottom: 6,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#c3c6d7",
    borderRadius: 2,
  },
  cartHeaderContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cartTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#131b2e",
  },
  cartSubtitle: {
    fontSize: 12,
    color: "#737686",
  },
  cartHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  clearCartBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearCartText: {
    fontSize: 13,
    color: "#ba1a1a",
    fontWeight: "600",
  },
  closeCartBtn: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: "#f3f3fa",
  },
  cartList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  cartItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.15)",
  },
  cartItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#131b2e",
    marginBottom: 2,
  },
  cartItemPrice: {
    fontSize: 12,
    color: "#737686",
  },
  cartItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f3fa",
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  cartQtyBtn: {
    padding: 6,
  },
  cartQtyTextVal: {
    fontSize: 13,
    fontWeight: "700",
    color: "#131b2e",
    marginHorizontal: 8,
  },
  cartItemTotal: {
    fontSize: 14,
    fontWeight: "700",
    color: "#131b2e",
    minWidth: 65,
    textAlign: "right",
  },
  cartDeleteBtn: {
    padding: 4,
    marginLeft: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCart: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyCartText: {
    fontSize: 14,
    color: "#737686",
    marginTop: 8,
  },
  cartFooter: {
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(195,198,215,0.2)",
    backgroundColor: "#ffffff",
  },
  summaryDiscountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 36,
    marginVertical: 3,
  },
  summaryDiscountLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  summaryDiscountInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f3fa",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c3c6d7",
    paddingHorizontal: 8,
    height: 32,
    minWidth: 70,
  },
  summaryDiscountInput: {
    fontSize: 13,
    fontWeight: "600",
    color: "#131b2e",
    paddingVertical: 0,
    paddingHorizontal: 0,
    minWidth: 28,
    textAlign: "center",
  },
  summaryDiscountPercentSign: {
    fontSize: 12,
    fontWeight: "700",
    color: "#737686",
    marginLeft: 3,
  },
  summaryDiscountClearBtn: {
    marginLeft: 6,
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#434655",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "500",
    color: "#131b2e",
  },
  discountAppliedText: {
    color: "#ba1a1a",
    fontWeight: "600",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: "rgba(195,198,215,0.2)",
    paddingTop: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#131b2e",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#004ac6",
  },
  chargeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    backgroundColor: "#004ac6",
    borderRadius: 10,
    gap: 8,
  },
  chargeButtonDisabled: {
    backgroundColor: "#c3c6d7",
  },
  chargeButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  chargeButtonAmount: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },

  // Modals Overlay & Containers
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    backgroundColor: "#ffffff",
    width: "100%",
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#131b2e",
    marginBottom: 6,
  },
  modalDescription: {
    fontSize: 13,
    color: "#434655",
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#c3c6d7",
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
    color: "#131b2e",
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    fontSize: 14,
    color: "#434655",
  },
  modalConfirmBtn: {
    backgroundColor: "#004ac6",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },

  // Payment Details Modal Styles
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#cbd5e1",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  pendingNote: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400e",
    textAlign: "center",
    marginTop: 10,
  },
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  paymentModalContainer: {
    backgroundColor: "#ffffff",
    width: "100%",
    maxHeight: "92%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  paymentModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  paymentModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  paymentModalSubtitle: {
    fontSize: 12.5,
    color: "#64748b",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
  },
  payableHeroCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1.5,
    borderColor: "#bfdbfe",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  payableHeroLeft: {
    flex: 1,
  },
  payableHeroLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e40af",
  },
  payableHeroSub: {
    fontSize: 11.5,
    color: "#3b82f6",
    marginTop: 2,
  },
  payableHeroAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: "#004ac6",
  },
  paymentSectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 10,
  },
  paymentGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  paymentGridCard: {
    width: "48.5%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  paymentGridCardSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#004ac6",
  },
  paymentCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  paymentCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentCardIconWrapSelected: {
    backgroundColor: "#dbeafe",
  },
  paymentCardTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 2,
  },
  paymentCardTitleSelected: {
    color: "#004ac6",
    fontWeight: "700",
  },
  paymentCardDesc: {
    fontSize: 11,
    color: "#94a3b8",
  },
  modeHelperCard: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  helperCardTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#166534",
    marginBottom: 8,
  },
  customerFormCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  customerFormHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  customerFormTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1e293b",
  },
  customerFieldGroup: {
    marginBottom: 10,
  },
  customerFieldLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
  },
  customerInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  customerInput: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    color: "#0f172a",
  },
  customerChipsRow: {
    gap: 6,
    paddingBottom: 4,
  },
  customerChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  customerChipActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#004ac6",
  },
  customerChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#92400e",
  },
  customerChipBalance: {
    fontSize: 10,
    fontWeight: "600",
    color: "#ba1a1a",
  },
  confirmPaymentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#004ac6",
    height: 50,
    borderRadius: 12,
    marginTop: 10,
    gap: 8,
    shadowColor: "#004ac6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmPaymentText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },

  // Bill Receipt Modal
  billModalContainer: {
    backgroundColor: "#ffffff",
    width: "100%",
    maxWidth: 400,
    maxHeight: "92%",
    borderRadius: 16,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  receiptHeader: {
    alignItems: "center",
    paddingVertical: 6,
  },
  receiptShopName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#131b2e",
    textAlign: "center",
  },
  receiptShopSub: {
    fontSize: 11,
    color: "#737686",
    textAlign: "center",
    marginTop: 1,
  },
  receiptShopGst: {
    fontSize: 11,
    fontWeight: "600",
    color: "#434655",
    textAlign: "center",
    marginTop: 2,
  },
  receiptDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#c3c6d7",
    borderStyle: "dashed",
    marginVertical: 10,
  },
  receiptMetaGrid: {
    gap: 3,
  },
  receiptMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  receiptMetaKey: {
    fontSize: 11,
    color: "#737686",
  },
  receiptMetaVal: {
    fontSize: 11,
    fontWeight: "600",
    color: "#131b2e",
  },
  invoiceNoHighlight: {
    color: "#004ac6",
    fontWeight: "700",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f3fa",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 4,
    marginBottom: 4,
  },
  tableCol: {
    fontSize: 11,
    fontWeight: "700",
    color: "#434655",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(195,198,215,0.2)",
  },
  tableColText: {
    fontSize: 11,
    color: "#131b2e",
  },
  tableColItem: {
    flex: 2.2,
  },
  tableColQty: {
    flex: 0.7,
    textAlign: "center",
  },
  tableColRate: {
    flex: 1.1,
    textAlign: "right",
  },
  tableColAmt: {
    flex: 1.2,
    textAlign: "right",
    fontWeight: "600",
  },
  billSummaryBox: {
    paddingVertical: 4,
    gap: 4,
  },
  billSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  billSummaryLabel: {
    fontSize: 12,
    color: "#434655",
  },
  billSummaryVal: {
    fontSize: 12,
    fontWeight: "600",
    color: "#131b2e",
  },
  billGrandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#131b2e",
    paddingTop: 6,
    marginTop: 4,
    marginBottom: 4,
  },
  billGrandTotalLabel: {
    fontSize: 15,
    fontWeight: "800",
    color: "#131b2e",
  },
  billGrandTotalVal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#004ac6",
  },
  receiptFooterNote: {
    fontSize: 10,
    color: "#737686",
    textAlign: "center",
    marginVertical: 10,
    fontStyle: "italic",
  },
  receiptActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  receiptPrintBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e6edff",
    height: 42,
    borderRadius: 8,
    gap: 6,
  },
  receiptPrintText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#004ac6",
  },
  receiptShareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e6faee",
    height: 42,
    borderRadius: 8,
    gap: 6,
  },
  receiptShareText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#006329",
  },
  receiptNewSaleBtn: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#004ac6",
    height: 42,
    borderRadius: 8,
    gap: 6,
  },
  receiptNewSaleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  // Weight Modal Styles
  weightModalContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    width: "90%",
    maxWidth: 420,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  weightModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
  },
  weightModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#131b2e",
  },
  weightModalSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    fontWeight: "500",
  },
  unitToggleRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
    gap: 4,
  },
  unitToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    borderRadius: 6,
  },
  unitToggleBtnActive: {
    backgroundColor: "#ffffff",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
  },
  unitToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  unitToggleTextActive: {
    color: "#004ac6",
    fontWeight: "700",
  },
  presetsLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#434655",
    marginBottom: 6,
  },
  presetChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 14,
  },
  presetChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  presetChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#004ac6",
  },
  weightInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#004ac6",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 52,
    backgroundColor: "#f8fafc",
    marginBottom: 12,
  },
  weightTextInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    padding: 0,
  },
  weightUnitSuffix: {
    fontSize: 16,
    fontWeight: "700",
    color: "#004ac6",
    marginLeft: 8,
  },
  weightPreviewBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  weightPreviewLabel: {
    fontSize: 13,
    color: "#166534",
    fontWeight: "600",
  },
  weightPreviewTotal: {
    fontSize: 17,
    fontWeight: "800",
    color: "#15803d",
  },
  openKhataButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: -4,
    marginBottom: 12,
  },
  openKhataButtonText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#004ac6",
    flex: 1,
    marginLeft: 6,
  },
});
