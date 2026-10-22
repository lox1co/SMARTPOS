import {
  LocalizedAlert as Alert,
  LocalizedText as Text,
  LocalizedTouchableOpacity as TouchableOpacity,
} from "@/components/i18n/LocalizedControls";
import { store } from "@/constants/store";
import { changeAppLanguage, getAppLocale, type AppLanguage } from "@/i18n";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, ScrollView, StyleSheet, Switch, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userSession = store.currentUser;
  const { t, i18n } = useTranslation();
  const selectedLanguage: AppLanguage = i18n.resolvedLanguage?.split("-")[0] === "es" ? "es" : "en";

  // Printer Settings
  const [printerType, setPrinterType] = useState("Bluetooth");
  const [paperSize, setPaperSize] = useState("80mm");
  const [autoPrint, setAutoPrint] = useState(true);

  // Backup & Language
  const [lastBackup, setLastBackup] = useState("Never");
  const [pushNotifications, setPushNotifications] = useState(true);

  // Modals
  const [printerModalVisible, setPrinterModalVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);

  const handleLanguageChange = async (language: AppLanguage) => {
    setIsChangingLanguage(true);
    try {
      await changeAppLanguage(language);
      setLanguageModalVisible(false);
    } catch {
      Alert.alert(t("common.status.error"));
    } finally {
      setIsChangingLanguage(false);
    }
  };

  const executeBackup = () => {
    try {
      const backupData = {
        timestamp: new Date().toISOString(),
        products: store.getProducts(),
        shopName: userSession?.shopName || "SmartPOS Store",
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
          await store.logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>App & Hardware</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, 24) + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hardware & Printing */}
        <Text style={styles.sectionTitle}>Hardware & Printing</Text>
        <View style={styles.cardContainer}>
          <TouchableOpacity style={styles.cardRow} onPress={() => setPrinterModalVisible(true)} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: "#ede9fe" }]}>
                <MaterialIcons name="print" size={20} color="#6366f1" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Thermal Printer</Text>
                <Text style={styles.rowSubLabel}>
                  {printerType} • {paperSize} roll
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
          </TouchableOpacity>

          <View style={[styles.cardRow, styles.lastCardRow]}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: "#e0f2fe" }]}>
                <MaterialIcons name="receipt" size={20} color="#0284c7" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Auto-Print Receipts</Text>
                <Text style={styles.rowSubLabel}>Print automatically upon checkout</Text>
              </View>
            </View>
            <Switch
              value={autoPrint}
              onValueChange={setAutoPrint}
              trackColor={{ false: "#e2e8f0", true: "#bfdbfe" }}
              thumbColor={autoPrint ? "#004ac6" : "#94a3b8"}
            />
          </View>
        </View>

        {/* System & Data */}
        <Text style={styles.sectionTitle}>System & Data</Text>
        <View style={styles.cardContainer}>
          <View style={styles.cardRow}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: "#fef2f2" }]}>
                <MaterialIcons name="notifications-active" size={20} color="#ef4444" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Low Stock Alerts</Text>
                <Text style={styles.rowSubLabel}>Get notified when item inventory is low</Text>
              </View>
            </View>
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: "#e2e8f0", true: "#bfdbfe" }}
              thumbColor={pushNotifications ? "#004ac6" : "#94a3b8"}
            />
          </View>
          <TouchableOpacity style={styles.cardRow} onPress={() => setBackupModalVisible(true)} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: "#cffafe" }]}>
                <MaterialIcons name="cloud-sync" size={20} color="#0891b2" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>Backup & Restore</Text>
                <Text style={styles.rowSubLabel}>Last archive: {lastBackup}</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
          </TouchableOpacity>
          {/* de momento solo es visual */}
          <TouchableOpacity style={styles.cardRow} onPress={() => {}} activeOpacity={0.7}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: "#cffafe" }]}>
                <MaterialIcons name="colorize" size={20} color="#0891b2" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>App Theme</Text>
                <Text style={styles.rowSubLabel}>Current theme: </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cardRow, styles.lastCardRow]}
            onPress={() => setLanguageModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: "#f8fafc" }]}>
                <MaterialIcons name="language" size={20} color="#475569" />
              </View>
              <View style={styles.rowTextCol}>
                <Text style={styles.rowLabel}>{t("settings.language.title")}</Text>
                <Text style={styles.rowSubLabel}>
                  {t(selectedLanguage === "es" ? "settings.language.spanish" : "settings.language.english")}
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#94a3b8" />
          </TouchableOpacity>
        </View>

        {/* Account & Session */}
        <Text style={styles.sectionTitle}>Account Session</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <MaterialIcons name="logout" size={18} color="#ba1a1a" />
          <Text style={styles.logoutBtnText}>Sign Out from Device</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>SmartPOS v1.0.0 • Build 2026</Text>
      </ScrollView>

      {/* --- MODALS --- */}

      {/* Printer Modal */}
      <Modal
        visible={printerModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPrinterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Thermal Printer Setup</Text>

            <Text style={styles.fieldLabel}>Connection Interface</Text>
            <View style={styles.optionRow}>
              {["Bluetooth", "Wi-Fi", "USB"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.choicePill, printerType === type && styles.choicePillActive]}
                  onPress={() => setPrinterType(type)}
                >
                  <Text style={[styles.choicePillText, printerType === type && styles.choicePillTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Paper Roll Size</Text>
            <View style={styles.optionRow}>
              {["58mm", "80mm"].map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[styles.choicePill, paperSize === size && styles.choicePillActive]}
                  onPress={() => setPaperSize(size)}
                >
                  <Text style={[styles.choicePillText, paperSize === size && styles.choicePillTextActive]}>
                    {size} ({size === "58mm" ? "2-inch" : "3-inch"})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.saveBtn} onPress={() => setPrinterModalVisible(false)}>
                <Text style={styles.saveBtnText}>Save Preferences</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Backup Modal */}
      <Modal
        visible={backupModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setBackupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Database Cloud Backup</Text>
            <Text style={styles.modalSubtitle}>
              Export your catalog, customers and settings to a local safety JSON archive.
            </Text>

            <TouchableOpacity style={styles.backupActionCard} onPress={executeBackup}>
              <MaterialIcons name="cloud-upload" size={24} color="#004ac6" />
              <View style={{ flex: 1 }}>
                <Text style={styles.backupCardTitle}>Create New Backup</Text>
                <Text style={styles.backupCardSub}>Export products, inventory quantities and shop profile</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.backupActionCard} onPress={executeRestore}>
              <MaterialIcons name="cloud-download" size={24} color="#16a34a" />
              <View style={{ flex: 1 }}>
                <Text style={styles.backupCardTitle}>Sync & Restore</Text>
                <Text style={styles.backupCardSub}>Fetch latest catalog from centralized FastAPI cloud database</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setBackupModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Language Modal */}
      <Modal
        visible={languageModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("settings.language.select")}</Text>

            {(
              [
                { code: "en", label: t("settings.language.english") },
                { code: "es", label: t("settings.language.spanish") },
              ] satisfies { code: AppLanguage; label: string }[]
            ).map(({ code, label }) => (
              <TouchableOpacity
                key={code}
                style={[styles.langRow, selectedLanguage === code && styles.langRowActive]}
                onPress={() => void handleLanguageChange(code)}
                disabled={isChangingLanguage}
              >
                <Text style={[styles.langText, selectedLanguage === code && styles.langTextActive]}>{label}</Text>
                {selectedLanguage === code && <MaterialIcons name="check" size={18} color="#004ac6" />}
              </TouchableOpacity>
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setLanguageModalVisible(false)}>
                <Text style={styles.cancelBtnText}>{t("common.actions.cancel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  scroll: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 10,
    marginLeft: 4,
  },
  cardContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    marginBottom: 16,
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
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 6,
  },
  logoutBtnText: {
    color: "#ba1a1a",
    fontSize: 14,
    fontWeight: "700",
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 20,
  },
  // Modals
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
    elevation: 10,
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
