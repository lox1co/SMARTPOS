import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SECTIONS = [
  {
    title: "1. Information We Collect",
    body: "SmartPOS collects business information you provide during registration, including store name, owner name, email address, phone number, and business address. We also store product catalog data, transaction records, customer names, and credit ledger entries that you create within the app.",
  },
  {
    title: "2. How We Use Your Information",
    body: "Your data is used solely to operate the SmartPOS service — to enable billing, inventory management, customer ledger tracking, and GST reporting for your business. We do not sell, rent, or share your personal or business data with any third parties for marketing purposes.",
  },
  {
    title: "3. Data Storage & Security",
    body: "Your data is stored on secure cloud servers (PostgreSQL on Render). Authentication tokens are stored securely on your device using the operating system keychain (iOS Keychain / Android Keystore). All API communication is encrypted over HTTPS.",
  },
  {
    title: "4. Offline Data",
    body: "When you use SmartPOS offline, sales data is temporarily stored on your device in encrypted local storage. This data is automatically synced to our secure servers when your internet connection is restored.",
  },
  {
    title: "5. Multi-Tenant Isolation",
    body: "Each store's data is strictly isolated. Staff members of one store cannot access data belonging to another store. Access within a store is further restricted by user roles (Owner, Manager, Cashier).",
  },
  {
    title: "6. Data Retention",
    body: "Your data is retained for as long as your account is active. If you wish to delete your store data or account, please contact us at zynocraftx@gmail.com. We will process your request within 30 days.",
  },
  {
    title: "7. Changes to This Policy",
    body: "We may update this Privacy Policy from time to time. Significant changes will be communicated through in-app notifications. Continued use of SmartPOS after any changes constitutes your acceptance of the updated policy.",
  },
  { title: "8. Contact", body: "For any privacy-related questions or concerns, contact us at zynocraftx@gmail.com." },
];

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroIconCircle}>
            <MaterialIcons name="privacy-tip" size={30} color="#15803d" />
          </View>
          <View style={styles.heroBannerText}>
            <Text style={styles.heroBannerTitle}>Your Privacy Matters</Text>
            <Text style={styles.heroBannerDate}>Last updated: September 2026</Text>
          </View>
        </View>

        {SECTIONS.map((section, i) => (
          <View key={i} style={[styles.sectionCard, i === SECTIONS.length - 1 && { marginBottom: 0 }]}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(195,198,215,0.25)",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  scroll: { padding: 16, paddingBottom: 48, gap: 10 },
  heroBanner: {
    backgroundColor: "#f0fdf4",
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  heroIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBannerText: { flex: 1 },
  heroBannerTitle: { fontSize: 16, fontWeight: "700", color: "#166534" },
  heroBannerDate: { fontSize: 12, color: "#4ade80", marginTop: 3 },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  sectionBody: { fontSize: 13.5, color: "#475569", lineHeight: 21 },
});
