import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: "By downloading, installing, or using SmartPOS, you agree to be bound by these Terms & Conditions. If you do not agree, please do not use this application.",
  },
  {
    title: "2. License to Use",
    body: "loxico grants you a limited, non-exclusive, non-transferable, revocable license to use SmartPOS solely for your personal or internal business purposes. You may not copy, modify, distribute, sell, or lease any part of SmartPOS.",
  },
  {
    title: "3. User Responsibilities",
    body: "You are responsible for maintaining the confidentiality of your account credentials. You agree not to share your login details with unauthorized persons. You are responsible for all activity that occurs under your account.",
  },
  {
    title: "4. Acceptable Use",
    body: "You agree to use SmartPOS only for lawful business purposes. You must not use the application to process fraudulent transactions, to evade taxes, or for any illegal activity.",
  },
  {
    title: "5. Data Accuracy",
    body: "You are solely responsible for the accuracy of the data you enter into SmartPOS, including product prices, GST rates, and customer records. loxico is not liable for financial or tax errors resulting from incorrect data entry.",
  },
  {
    title: "6. Intellectual Property",
    body: "SmartPOS and all its content, features, and functionality are owned by loxico and are protected by intellectual property laws. You must not reproduce, duplicate, or exploit any part of the application without express written permission.",
  },
  {
    title: "7. Service Availability",
    body: "We strive to provide reliable service but do not guarantee 100% uptime. SmartPOS may occasionally be unavailable due to maintenance or factors beyond our control. The offline-first billing feature mitigates disruption during outages.",
  },
  {
    title: "8. Limitation of Liability",
    body: "loxico shall not be liable for any indirect, incidental, or consequential damages arising from your use of SmartPOS, including but not limited to loss of revenue, data loss, or business interruption.",
  },
  {
    title: "9. Termination",
    body: "We reserve the right to terminate or suspend your account at any time for violations of these Terms. You may also terminate your account by contacting support.",
  },
  {
    title: "10. Governing Law",
    body: "These Terms are governed by the laws of India. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of courts in India.",
  },
  { title: "11. Contact", body: "For questions regarding these Terms, please contact us at zynocraftx@gmail.com." },
];

export default function TermsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroIconCircle}>
            <MaterialIcons name="gavel" size={30} color="#7c3aed" />
          </View>
          <View style={styles.heroBannerText}>
            <Text style={styles.heroBannerTitle}>Terms & Conditions</Text>
            <Text style={styles.heroBannerDate}>Last updated: September 2025</Text>
          </View>
        </View>

        {SECTIONS.map((section, i) => (
          <View key={i} style={styles.sectionCard}>
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
    backgroundColor: "#faf5ff",
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#e9d5ff",
  },
  heroIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#ede9fe",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBannerText: { flex: 1 },
  heroBannerTitle: { fontSize: 16, fontWeight: "700", color: "#5b21b6" },
  heroBannerDate: { fontSize: 12, color: "#a78bfa", marginTop: 3 },
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
