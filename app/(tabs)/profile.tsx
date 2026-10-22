import {
  LocalizedAlert as Alert,
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from "@/components/i18n/LocalizedControls";
import { getShopCategoryLabel } from "@/constants/config";
import { store } from "@/constants/store";
import { getAppLocale } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type ProfileTab = "shop_info" | "business" | "support";

export default function ProfileScreen() {
  const router = useRouter();

  // Tab State: 'shop_info' (Services), 'business' (Products), 'support' (Reviews)
  const [activeTab, setActiveTab] = useState<ProfileTab>("shop_info");

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateYAnim]);

  // Load session or defaults
  const userSession = store.currentUser;
  const [shopName, setShopName] = useState(userSession?.shopName || "SmartPOS Store");
  const [ownerName, setOwnerName] = useState(userSession?.userName || "Store User");
  const [storeId, setStoreId] = useState(userSession?.storeId || "");
  const [phone, setPhone] = useState(userSession?.phone || "");
  const [email, setEmail] = useState(userSession?.email || "");
  const [avatarImage, setAvatarImage] = useState<string | null>(userSession?.image || null);

  // Shop Info Details
  const [shopCategory, setShopCategory] = useState(userSession?.shopCategory || "Retail");
  const [gstNumber, setGstNumber] = useState(userSession?.gstNumber || "");
  const [businessAddress, setBusinessAddress] = useState(userSession?.businessAddress || "");

  // Printer Settings
  const [printerType, setPrinterType] = useState("Bluetooth");
  const [paperSize, setPaperSize] = useState("80mm");
  const [autoPrint, setAutoPrint] = useState(true);

  // Backup state
  const [lastBackup, setLastBackup] = useState("Never");

  // Toggle Settings States
  const [pushNotifications, setPushNotifications] = useState(true);
  const [taxEnabled, setTaxEnabled] = useState(userSession?.taxEnabled !== false);
  const [taxRate, setTaxRate] = useState<number>(userSession?.taxRate ?? 8);

  // Modal Visibility States
  const [appHardwareVisible, setAppHardwareVisible] = useState(false);
  const [taxModalVisible, setTaxModalVisible] = useState(false);
  const [printerSettingsVisible, setPrinterSettingsVisible] = useState(false);
  const [backupRestoreVisible, setBackupRestoreVisible] = useState(false);

  // Tax percentage input state
  const [tempTaxRate, setTempTaxRate] = useState((userSession?.taxRate ?? 8).toString());

  // Floating Toast Notification State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [copiedStoreId, setCopiedStoreId] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 2200);
  };

  // Sync shop and credentials when store currentUser changes
  useEffect(() => {
    const updateFromStore = () => {
      if (store.currentUser) {
        setShopName(store.currentUser.shopName);
        setOwnerName(store.currentUser.userName);
        setStoreId(store.currentUser.storeId || "");
        setPhone(store.currentUser.phone);
        setEmail(store.currentUser.email);
        setAvatarImage(store.currentUser.image || null);
        setShopCategory(store.currentUser.shopCategory);
        setGstNumber(store.currentUser.gstNumber || "");
        setBusinessAddress(store.currentUser.businessAddress || "");
        setTaxEnabled(store.currentUser.taxEnabled !== false);
        setTaxRate(store.currentUser.taxRate ?? 8);
      }
    };

    updateFromStore();

    const unsubscribe = store.subscribe(() => {
      updateFromStore();
    });
    return unsubscribe;
  }, []);

  const handleCopyStoreId = () => {
    const code = storeId;
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
    }
    setCopiedStoreId(true);
    showToast("Store ID (Join Code) copied to clipboard");
    setTimeout(() => setCopiedStoreId(false), 2500);
  };

  // Tax settings handlers
  const handleToggleTax = async (value: boolean) => {
    setTaxEnabled(value);
    try {
      await store.updateUserProfile({ taxEnabled: value });
      showToast(value ? `Tax enabled (${taxRate}% default in billing)` : "Tax disabled in billing (0%)");
    } catch (e) {
      showToast("Failed to update tax setting");
    }
  };

  const openTaxModal = () => {
    setTempTaxRate(taxRate.toString());
    setTaxModalVisible(true);
  };

  const saveTaxRate = async () => {
    const val = parseFloat(tempTaxRate);
    if (isNaN(val) || val < 0 || val > 100) {
      Alert.alert("Invalid Tax Rate", "Please enter a percentage between 0 and 100.");
      return;
    }
    setTaxRate(val);
    setTaxModalVisible(false);
    try {
      await store.updateUserProfile({ taxRate: val, taxEnabled: true });
      showToast(`Default tax set to ${val}%`);
    } catch (e) {
      showToast("Failed to save tax rate");
    }
  };

  // Backup catalog data to local JSON structure
  const executeBackup = () => {
    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        products: store.getProducts(),
        shopName,
      };
      const timeStr = new Date().toLocaleString(getAppLocale());
      setLastBackup(timeStr);
      Alert.alert(
        "Backup Successful",
        `Database backup created!\nTimestamp: ${timeStr}\nRecords Exported: ${backupData.products.length} products`,
      );
    } catch {
      Alert.alert("Backup Failed", "Could not compile database backup.");
    }
  };

  const executeRestore = () => {
    Alert.alert("Restore Successful", "Product quantities and catalog schemas are synchronized with the server.");
  };

  const handleLogout = async () => {
    Alert.alert("Confirm Logout", "Are you sure you want to log out from this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          setAppHardwareVisible(false);
          await store.logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.outerContainer} edges={["top"]}>
      {/* Sleek Floating Toast Feedback */}
      {toastVisible && (
        <View style={styles.floatingToast}>
          <MaterialIcons name="check-circle" size={18} color="#22c55e" />
          <Text style={styles.floatingToastText}>{toastMsg}</Text>
        </View>
      )}

      {/* Top Header: Title on Left, Settings Gear on Right */}
      <View style={styles.topHeader}>
        <Text style={styles.topHeaderTitle}>Profile</Text>
        <TouchableOpacity style={styles.settingsIconBtn} onPress={() => router.push("/settings")} activeOpacity={0.7}>
          <MaterialIcons name="settings" size={24} color="#0f172a" />
        </TouchableOpacity>
      </View>

      {/* Main Content Scroll List */}
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.mainContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateYAnim }],
            },
          ]}
        >
          {/* Centered Hero Section (Matches Mock Design) */}
          <View style={styles.heroSection}>
            <TouchableOpacity
              style={styles.heroAvatarWrapper}
              onPress={() => router.push("/store_info")}
              activeOpacity={0.85}
            >
              <View style={styles.heroAvatarCircle}>
                {avatarImage ? (
                  <Image style={styles.heroAvatarImage} source={avatarImage} contentFit="cover" />
                ) : (
                  <View style={styles.defaultAvatarContainer}>
                    <Text style={styles.defaultAvatarText}>
                      {ownerName ? ownerName.trim().substring(0, 2).toUpperCase() : "SP"}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Name */}
            <Text style={styles.heroNameText} numberOfLines={1}>
              {ownerName || shopName}
            </Text>

            {/* Email / ID + Verified Green Checkmark */}
            <View style={styles.heroEmailRow}>
              <Text style={styles.heroEmailText} numberOfLines={1}>
                {email || phone || shopName}
              </Text>
              <MaterialIcons name="check-circle" size={16} color="#16a34a" />
            </View>

            {/* Edit Profile Outline Button */}
            <TouchableOpacity
              style={styles.editProfileOutlineBtn}
              onPress={() => router.push("/store_info")}
              activeOpacity={0.7}
            >
              <Text style={styles.editProfileOutlineBtnText}>Edit Profile</Text>
              <MaterialIcons name="keyboard-arrow-down" size={18} color="#475569" />
            </TouchableOpacity>
          </View>

          {/* Segmented Tab Selector (Services -> Shop Info, Products -> Business, Reviews -> Support) */}
          <View style={styles.segmentedTabContainer}>
            <TouchableOpacity
              style={[styles.segmentedTabBtn, activeTab === "shop_info" && styles.segmentedTabBtnActive]}
              onPress={() => setActiveTab("shop_info")}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.segmentedTabText, activeTab === "shop_info" && styles.segmentedTabTextActive]}
                numberOfLines={1}
              >
                Shop Information
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentedTabBtn, activeTab === "business" && styles.segmentedTabBtnActive]}
              onPress={() => setActiveTab("business")}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.segmentedTabText, activeTab === "business" && styles.segmentedTabTextActive]}
                numberOfLines={1}
              >
                Business & Tax
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.segmentedTabBtn, activeTab === "support" && styles.segmentedTabBtnActive]}
              onPress={() => setActiveTab("support")}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.segmentedTabText, activeTab === "support" && styles.segmentedTabTextActive]}
                numberOfLines={1}
              >
                Support & Legal
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: Shop Information (Services) */}
          {activeTab === "shop_info" && (
            <View style={styles.tabSection}>
              <View style={styles.cardContainer}>
                {/* Store ID / Join Code */}
                <TouchableOpacity style={styles.cardRow} onPress={handleCopyStoreId} activeOpacity={0.7}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#eff6ff" }]}>
                      <MaterialIcons
                        name={copiedStoreId ? "check" : "vpn-key"}
                        size={20}
                        color={copiedStoreId ? "#16a34a" : "#004ac6"}
                      />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowLabel}>Store ID (Join Code)</Text>
                      <Text
                        style={[
                          styles.rowSubLabel,
                          { fontWeight: "700", color: copiedStoreId ? "#16a34a" : "#004ac6" },
                        ]}
                      >
                        {copiedStoreId ? "Copied to clipboard!" : `${storeId || "-"} • Tap to copy`}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.rowBadgeChip}>
                    <MaterialIcons
                      name={copiedStoreId ? "check-circle" : "content-copy"}
                      size={15}
                      color={copiedStoreId ? "#16a34a" : "#004ac6"}
                    />
                    <Text style={[styles.rowBadgeChipText, copiedStoreId && { color: "#16a34a" }]}>
                      {copiedStoreId ? "Copied" : "Copy"}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Category */}
                <TouchableOpacity
                  style={styles.cardRow}
                  onPress={() => router.push("/shop_category")}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#f3e8ff" }]}>
                      <MaterialIcons name="category" size={20} color="#7c3aed" />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowLabel}>Shop Category</Text>
                      <Text style={styles.rowSubLabel}>{getShopCategoryLabel(shopCategory)}</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>

                {/* GST Number */}
                <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/shop_gst")} activeOpacity={0.7}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#e0e7ff" }]}>
                      <MaterialIcons name="receipt-long" size={20} color="#4f46e5" />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowLabel}>GST Number (GSTIN)</Text>
                      <Text style={styles.rowSubLabel}>{gstNumber || "Not Provided (Tap to add)"}</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>

                {/* Phone */}
                <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/shop_phone")} activeOpacity={0.7}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#ccfbf1" }]}>
                      <MaterialIcons name="phone" size={20} color="#0d9488" />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowLabel}>Registered Phone</Text>
                      <Text style={styles.rowSubLabel}>{phone || "Not Provided"}</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>

                {/* Email */}
                <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/shop_email")} activeOpacity={0.7}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#e0f2fe" }]}>
                      <MaterialIcons name="email" size={20} color="#0284c7" />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowLabel}>Contact Email</Text>
                      <Text style={styles.rowSubLabel}>{email || "Not Provided"}</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>

                {/* Address */}
                <TouchableOpacity
                  style={[styles.cardRow, styles.lastCardRow]}
                  onPress={() => router.push("/shop_address")}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#ffe4e6" }]}>
                      <MaterialIcons name="location-on" size={20} color="#e11d48" />
                    </View>
                    <View style={[styles.rowTextCol, { flex: 1 }]}>
                      <Text style={styles.rowLabel}>Business Address</Text>
                      <Text style={styles.rowSubLabel} numberOfLines={1}>
                        {businessAddress || "Not Provided (Tap to set)"}
                      </Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* TAB 2: Business Management & Tax (Products) */}
          {activeTab === "business" && (
            <View style={styles.tabSection}>
              <View style={styles.cardContainer}>
                {/* Customers & Credit Ledger */}
                <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/customers")} activeOpacity={0.7}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#dcfce7" }]}>
                      <MaterialIcons name="people-alt" size={20} color="#16a34a" />
                    </View>
                    <View style={[styles.rowTextCol, { flex: 1, paddingRight: 8 }]}>
                      <Text style={styles.rowLabel}>Customer Khata (Credit Book)</Text>
                      <Text style={styles.rowSubLabel}>Manage balances, credit debts & record repayments</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>

                {/* Reports & Analytics */}
                <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/reports")} activeOpacity={0.7}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#dbeafe" }]}>
                      <MaterialIcons name="analytics" size={20} color="#2563eb" />
                    </View>
                    <View style={[styles.rowTextCol, { flex: 1, paddingRight: 8 }]}>
                      <Text style={styles.rowLabel}>Reports & GST Breakdown</Text>
                      <Text style={styles.rowSubLabel}>Daily sales summary, tax reports & PDF exports</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>

                {/* Transactions History */}
                <TouchableOpacity
                  style={styles.cardRow}
                  onPress={() => router.push("/transactions")}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#fef3c7" }]}>
                      <MaterialIcons name="receipt" size={20} color="#d97706" />
                    </View>
                    <View style={[styles.rowTextCol, { flex: 1, paddingRight: 8 }]}>
                      <Text style={styles.rowLabel}>Transaction Invoices</Text>
                      <Text style={styles.rowSubLabel}>Search historical bills & reprint receipts</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>

                {/* Enable/Disable Tax Switch */}
                <View style={[styles.cardRow, !taxEnabled && styles.lastCardRow]}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#fef3c7" }]}>
                      <MaterialIcons name="request-quote" size={20} color="#d97706" />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowLabel}>Tax / GST in Billing</Text>
                      <Text style={styles.rowSubLabel}>
                        {taxEnabled ? `Active • ${taxRate}% default rate` : "Disabled • 0% tax in billing"}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={taxEnabled}
                    onValueChange={handleToggleTax}
                    trackColor={{ false: "#e2e8f0", true: "#bfdbfe" }}
                    thumbColor={taxEnabled ? "#004ac6" : "#94a3b8"}
                  />
                </View>

                {/* Configure Tax Rate Percentage */}
                {taxEnabled && (
                  <TouchableOpacity
                    style={[styles.cardRow, styles.lastCardRow]}
                    onPress={openTaxModal}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowLeft}>
                      <View style={[styles.iconBox, { backgroundColor: "#e0f2fe" }]}>
                        <MaterialIcons name="percent" size={20} color="#0284c7" />
                      </View>
                      <View style={styles.rowTextCol}>
                        <Text style={styles.rowLabel}>Default Tax Rate (%)</Text>
                        <Text style={styles.rowSubLabel}>Currently set to {taxRate}% in billing</Text>
                      </View>
                    </View>
                    <View style={styles.taxBadgeWrapper}>
                      <View style={styles.taxRateBadge}>
                        <Text style={styles.taxRateBadgeText}>{taxRate}%</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* TAB 3: Support & Legal (Reviews) */}
          {activeTab === "support" && (
            <View style={styles.tabSection}>
              <View style={styles.cardContainer}>
                <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/about")} activeOpacity={0.7}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#eff6ff" }]}>
                      <MaterialIcons name="info" size={20} color="#004ac6" />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowLabel}>About SmartPOS</Text>
                      <Text style={styles.rowSubLabel}>Version, developer info & credits</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/faq")} activeOpacity={0.7}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#ecfdf5" }]}>
                      <MaterialIcons name="help-outline" size={20} color="#16a34a" />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowLabel}>FAQ & Help Center</Text>
                      <Text style={styles.rowSubLabel}>Answers to common questions</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/contact")} activeOpacity={0.7}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#fff7ed" }]}>
                      <MaterialIcons name="headset-mic" size={20} color="#ea580c" />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowLabel}>Contact Support</Text>
                      <Text style={styles.rowSubLabel}>Get help from our team</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.cardRow} onPress={() => router.push("/privacy")} activeOpacity={0.7}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#f0fdf4" }]}>
                      <MaterialIcons name="privacy-tip" size={20} color="#15803d" />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowLabel}>Privacy Policy</Text>
                      <Text style={styles.rowSubLabel}>How we handle your data</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cardRow, styles.lastCardRow]}
                  onPress={() => router.push("/terms")}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconBox, { backgroundColor: "#faf5ff" }]}>
                      <MaterialIcons name="gavel" size={20} color="#7c3aed" />
                    </View>
                    <View style={styles.rowTextCol}>
                      <Text style={styles.rowLabel}>Terms & Conditions</Text>
                      <Text style={styles.rowSubLabel}>Usage rights & responsibilities</Text>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Direct Sign Out Button on Profile */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <MaterialIcons name="logout" size={18} color="#ba1a1a" />
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={styles.footerVersionText}>SmartPOS v1.0.0</Text>
        </Animated.View>
      </ScrollView>

      {/* --- MODALS --- */}

      {/* Tax Rate Modal */}
      <Modal
        visible={taxModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setTaxModalVisible(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Default Tax Rate (%)</Text>
              <Text style={styles.modalSubtitle}>
                Set the default tax percentage applied to billing items and invoices
              </Text>

              <Text style={styles.fieldLabel}>Quick Presets</Text>
              <View style={styles.taxPresetsRow}>
                {[0, 5, 8, 12, 18, 28].map((pct) => (
                  <TouchableOpacity
                    key={pct}
                    style={[styles.taxPresetChip, tempTaxRate === pct.toString() && styles.taxPresetChipActive]}
                    onPress={() => setTempTaxRate(pct.toString())}
                  >
                    <Text
                      style={[
                        styles.taxPresetChipText,
                        tempTaxRate === pct.toString() && styles.taxPresetChipTextActive,
                      ]}
                    >
                      {pct}%
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Tax Percentage (0 - 100%)</Text>
              <TextInput
                style={styles.inputField}
                placeholder="e.g. 18 or 5"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={tempTaxRate}
                onChangeText={setTempTaxRate}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setTaxModalVisible(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={saveTaxRate}>
                  <Text style={styles.saveBtnText}>Save Tax Rate</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  scrollContainer: {
    paddingBottom: 40,
  },
  mainContainer: {
    paddingHorizontal: 16,
  },
  // Top Header (Title on left, Settings gear on right)
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
  },
  topHeaderTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  settingsIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  // Centered Hero Section
  heroSection: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 20,
  },
  heroAvatarWrapper: {
    marginBottom: 12,
  },
  heroAvatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#eff4fe",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroAvatarImage: {
    width: "100%",
    height: "100%",
  },
  defaultAvatarContainer: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff4fe",
  },
  defaultAvatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#004ac6",
  },
  heroNameText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
    textAlign: "center",
  },
  heroEmailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  heroEmailText: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  editProfileOutlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 9,
    width: "100%",
    backgroundColor: "#ffffff",
    gap: 4,
  },
  editProfileOutlineBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  // Segmented Tabs
  segmentedTabContainer: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  segmentedTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  segmentedTabBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentedTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  segmentedTabTextActive: {
    color: "#004ac6",
    fontWeight: "700",
  },
  // Tab Section
  tabSection: {
    marginBottom: 16,
  },
  cardContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  lastCardRow: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTextCol: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  rowSubLabel: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  rowBadgeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  rowBadgeChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#004ac6",
  },
  taxBadgeWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  taxRateBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  taxRateBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#004ac6",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
    marginTop: 12,
  },
  logoutBtnText: {
    color: "#ba1a1a",
    fontSize: 14,
    fontWeight: "700",
  },
  footerVersionText: {
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 16,
    marginBottom: 8,
  },
  // Floating Toast
  floatingToast: {
    position: "absolute",
    top: 64,
    left: 20,
    right: 20,
    zIndex: 999,
    backgroundColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 8,
    gap: 10,
  },
  floatingToastText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  // Modals & Bottom Sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 16,
    lineHeight: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
    marginTop: 10,
  },
  inputField: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  taxPresetsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  taxPresetChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  taxPresetChipActive: {
    borderColor: "#004ac6",
    backgroundColor: "#eff6ff",
  },
  taxPresetChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  taxPresetChipTextActive: {
    color: "#004ac6",
    fontWeight: "700",
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  choicePill: {
    flex: 1,
    paddingVertical: 9,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  choicePillActive: {
    borderColor: "#004ac6",
    backgroundColor: "#eff6ff",
  },
  choicePillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  choicePillTextActive: {
    color: "#004ac6",
    fontWeight: "700",
  },
  backupActionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 10,
  },
  backupCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  backupCardSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  langRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  langRowActive: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  langText: {
    fontSize: 14,
    color: "#334155",
  },
  langTextActive: {
    fontWeight: "700",
    color: "#004ac6",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#004ac6",
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
