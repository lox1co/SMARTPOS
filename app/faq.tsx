import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

const FAQ_ITEMS = [
  { q: 'How do I add a new product?', a: 'Go to the Products tab and tap the + button in the top right corner. Fill in the product name, SKU, price, cost price, stock, category and tax rate, then save.' },
  { q: 'How does offline billing work?', a: 'If your internet drops during a sale, SmartPOS automatically saves the bill locally with an OFFLINE invoice number. Once you reconnect, it syncs all pending sales to the server automatically.' },
  { q: 'What is the Store ID / Join Code?', a: 'Every store gets a unique alphanumeric code (e.g. TGMAEX). Staff can enter this code during signup to join your store as a cashier or manager.' },
  { q: 'How do I record a credit (Khata) sale?', a: 'During billing, select "Khata / Credit" as the payment method, then enter the customer name. The outstanding amount is automatically added to that customer\'s credit balance.' },
  { q: 'How do I print a receipt?', a: 'After completing a checkout, the receipt preview appears. Tap "Print Receipt" to send it to a connected Bluetooth or network thermal printer (58mm/80mm). You can also export as PDF.' },
  { q: 'How do I import products in bulk?', a: 'Go to Products, tap the import icon, download the Excel template, fill it in with your product data, then upload it back. The system imports all valid rows automatically.' },
  { q: 'How can I scan barcodes into the Excel template quickly?', a: 'You can leave the SKU column blank for auto-generated codes, or use a free app like "Barcode to PC" to turn your phone into a wireless scanner that types barcodes straight into Excel on your laptop.' },
  { q: 'Can multiple staff use the same store?', a: 'Yes. Share your Store ID with staff members. They sign up with the Store ID and are assigned a cashier or manager role. Each user logs in with their own credentials.' },
  { q: 'How does GST calculation work?', a: 'Each product has a tax rate %. At checkout the tax is split into CGST & SGST (50/50) for intra-state sales, which appears on receipts and GST reports.' },
  { q: 'How do I restock a product?', a: 'Go to the Inventory tab, find the product, tap the + restock button, then select a preset quantity (+5, +10, +25, +50, +100). Stock is updated immediately.' },
  { q: 'What should I do if the app shows wrong data?', a: 'Try logging out and back in. If the issue persists, contact our support team at zynocraftx@gmail.com with a description of the problem.' },
];

export default function FaqScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQ & Help Center</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBanner}>
          <View style={styles.heroIconCircle}>
            <MaterialIcons name="help-outline" size={30} color="#16a34a" />
          </View>
          <Text style={styles.heroText}>Find answers to the most common questions about SmartPOS.</Text>
        </View>

        {FAQ_ITEMS.map((item, i) => (
          <View key={i} style={styles.faqItem}>
            <View style={styles.faqQuestion}>
              <View style={styles.qBadge}><Text style={styles.qBadgeText}>Q</Text></View>
              <Text style={styles.questionText}>{item.q}</Text>
            </View>
            <View style={styles.faqAnswer}>
              <Text style={styles.answerText}>{item.a}</Text>
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.contactBtn}
          onPress={() => router.push('/contact')}
          activeOpacity={0.8}
        >
          <MaterialIcons name="headset-mic" size={18} color="#ea580c" />
          <Text style={styles.contactBtnText}>Still have questions? Contact Support</Text>
          <MaterialIcons name="arrow-forward" size={16} color="#ea580c" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, backgroundColor: '#ffffff',
    borderBottomWidth: 1, borderBottomColor: 'rgba(195,198,215,0.25)',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center',
    justifyContent: 'center', backgroundColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  heroBanner: {
    backgroundColor: '#ecfdf5', borderRadius: 14, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  heroIconCircle: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: '#dcfce7',
    alignItems: 'center', justifyContent: 'center',
  },
  heroText: { flex: 1, fontSize: 13.5, color: '#166534', lineHeight: 20, fontWeight: '500' },
  faqItem: {
    backgroundColor: '#ffffff', borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(195,198,215,0.3)',
  },
  faqQuestion: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#f8fafc', paddingHorizontal: 14, paddingVertical: 12,
  },
  qBadge: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#004ac6',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  qBadgeText: { fontSize: 11, fontWeight: '800', color: '#ffffff' },
  questionText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a', lineHeight: 20 },
  faqAnswer: { paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  answerText: { fontSize: 13.5, color: '#475569', lineHeight: 21 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, backgroundColor: '#fff7ed', borderRadius: 14,
    borderWidth: 1, borderColor: '#fed7aa', marginTop: 4,
  },
  contactBtnText: { fontSize: 14, fontWeight: '600', color: '#ea580c' },
});
