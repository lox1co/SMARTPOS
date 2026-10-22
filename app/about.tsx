import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AboutScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About SmartPOS</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroIconCircle}>
            <MaterialIcons name="point-of-sale" size={40} color="#004ac6" />
          </View>
          <Text style={styles.heroAppName}>SmartPOS</Text>
          <Text style={styles.heroVersion}>Version 1.0.0</Text>
          <View style={styles.heroDivider} />
          <Text style={styles.heroTagline}>Modern Point of Sale & Business Management</Text>
        </View>

        {/* Developer Info */}
        <Text style={styles.sectionTitle}>Developer Info</Text>
        <View style={styles.infoCard}>
          {[
            { icon: "business", label: "Developer", value: "loxico" },
            { icon: "code", label: "Framework", value: "React Native (Expo SDK 57) & FastAPI" },
            { icon: "storage", label: "Database", value: "PostgreSQL (Cloud) / SQLite (Local)" },
            { icon: "security", label: "Auth", value: "JWT Bearer Tokens + Bcrypt" },
            { icon: "copyright", label: "License", value: "© 2026 loxico. All rights reserved." },
          ].map((row, i) => (
            <View key={i} style={[styles.infoRow, i === 4 && { borderBottomWidth: 0 }]}>
              <View style={styles.infoIconBox}>
                <MaterialIcons name={row.icon as any} size={17} color="#004ac6" />
              </View>
              <View style={styles.infoTextCol}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Key Features */}
        <Text style={styles.sectionTitle}>Key Features</Text>
        <View style={styles.featuresGrid}>
          {[
            { icon: "shopping-cart", label: "Fast POS Billing", color: "#004ac6", bg: "#eff6ff" },
            { icon: "inventory", label: "Inventory Tracking", color: "#16a34a", bg: "#dcfce7" },
            { icon: "book", label: "Khata Book", color: "#ea580c", bg: "#fff7ed" },
            { icon: "analytics", label: "GST Reports", color: "#7c3aed", bg: "#faf5ff" },
            { icon: "print", label: "Thermal Printing", color: "#0891b2", bg: "#cffafe" },
            { icon: "wifi-off", label: "Offline Mode", color: "#db2777", bg: "#fce7f3" },
            { icon: "group", label: "Multi-User Roles", color: "#d97706", bg: "#fef3c7" },
            { icon: "upload-file", label: "Bulk Import", color: "#059669", bg: "#d1fae5" },
          ].map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <View style={[styles.featureIconCircle, { backgroundColor: f.bg }]}>
                <MaterialIcons name={f.icon as any} size={20} color={f.color} />
              </View>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* Contact */}
        <Text style={styles.sectionTitle}>Get in Touch</Text>
        <TouchableOpacity
          style={styles.emailBtn}
          onPress={() => Linking.openURL("mailto:zynocraftx@gmail.com")}
          activeOpacity={0.8}
        >
          <MaterialIcons name="email" size={20} color="#004ac6" />
          <Text style={styles.emailBtnText}>zynocraftx@gmail.com</Text>
          <MaterialIcons name="open-in-new" size={16} color="#94a3b8" />
        </TouchableOpacity>

        <Text style={styles.footer}>Made with ❤️ by loxico</Text>
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
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
  },
  heroIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroAppName: { fontSize: 28, fontWeight: "800", color: "#004ac6", letterSpacing: 0.5 },
  heroVersion: { fontSize: 13, color: "#64748b", marginTop: 4 },
  heroDivider: { width: 40, height: 2, backgroundColor: "#e2e8f0", borderRadius: 2, marginVertical: 14 },
  heroTagline: { fontSize: 14, color: "#475569", textAlign: "center", lineHeight: 21 },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  infoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTextCol: { flex: 1 },
  infoLabel: {
    fontSize: 10.5,
    color: "#94a3b8",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  infoValue: { fontSize: 13, color: "#0f172a", fontWeight: "500", marginTop: 1 },
  featuresGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  featureCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(195,198,215,0.3)",
  },
  featureIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  featureLabel: { fontSize: 12, fontWeight: "600", color: "#334155", textAlign: "center" },
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  emailBtnText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#004ac6" },
  footer: { textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 8 },
});
