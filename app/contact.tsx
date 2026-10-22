import { LocalizedText as Text, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import React from 'react';
import { StyleSheet, View, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { store } from '@/constants/store';

export default function ContactScreen() {
  const router = useRouter();
  const storeId = store.currentUser?.storeId || '—';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Support</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroIconCircle}>
            <MaterialIcons name="headset-mic" size={32} color="#ea580c" />
          </View>
          <View style={styles.heroBannerText}>
            <Text style={styles.heroBannerTitle}>We are here to help</Text>
            <Text style={styles.heroBannerSub}>Our team typically responds within 24 hours</Text>
          </View>
        </View>

        {/* Contact Channels */}
        <Text style={styles.sectionTitle}>Reach Us</Text>

        <TouchableOpacity
          style={styles.contactCard}
          onPress={() => Linking.openURL('mailto:zynocraftx@gmail.com?subject=SmartPOS%20Support%20Request')}
          activeOpacity={0.8}
        >
          <View style={[styles.contactIconCircle, { backgroundColor: '#dbeafe' }]}>
            <MaterialIcons name="email" size={24} color="#2563eb" />
          </View>
          <View style={styles.contactCardText}>
            <Text style={styles.contactCardTitle}>Email Support</Text>
            <Text style={styles.contactCardSub}>zynocraftx@gmail.com</Text>
            <Text style={styles.contactCardHint}>Tap to open mail app</Text>
          </View>
          <MaterialIcons name="open-in-new" size={18} color="#94a3b8" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.contactCard}
          onPress={() => Linking.openURL('https://wa.me/?text=SmartPOS%20Support%20Request').catch(() => {})}
          activeOpacity={0.8}
        >
          <View style={[styles.contactIconCircle, { backgroundColor: '#dcfce7' }]}>
            <MaterialIcons name="chat" size={24} color="#16a34a" />
          </View>
          <View style={styles.contactCardText}>
            <Text style={styles.contactCardTitle}>WhatsApp Chat</Text>
            <Text style={styles.contactCardSub}>Quick responses via chat</Text>
            <Text style={styles.contactCardHint}>Tap to open WhatsApp</Text>
          </View>
          <MaterialIcons name="open-in-new" size={18} color="#94a3b8" />
        </TouchableOpacity>

        {/* Info Cards */}
        <Text style={styles.sectionTitle}>Support Info</Text>

        <View style={styles.infoBox}>
          <MaterialIcons name="schedule" size={18} color="#004ac6" />
          <View style={styles.infoBoxText}>
            <Text style={styles.infoBoxTitle}>Support Hours</Text>
            <Text style={styles.infoBoxBody}>Monday – Saturday, 9 AM – 6 PM IST</Text>
          </View>
        </View>

        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={18} color="#004ac6" />
          <View style={styles.infoBoxText}>
            <Text style={styles.infoBoxTitle}>Before Contacting Us</Text>
            <Text style={styles.infoBoxBody}>
              Please include your Store ID ({storeId}), a clear description of the issue, and screenshots if available.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.faqLink}
          onPress={() => router.push('/faq')}
          activeOpacity={0.8}
        >
          <MaterialIcons name="help-outline" size={18} color="#7c3aed" />
          <Text style={styles.faqLinkText}>Check our FAQ first — your answer might be there</Text>
          <MaterialIcons name="arrow-forward" size={16} color="#7c3aed" />
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
    backgroundColor: '#fff7ed', borderRadius: 16, padding: 18,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: '#fed7aa',
  },
  heroIconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#fde8d0',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBannerText: { flex: 1 },
  heroBannerTitle: { fontSize: 16, fontWeight: '700', color: '#9a3412' },
  heroBannerSub: { fontSize: 12.5, color: '#c2410c', marginTop: 3, lineHeight: 18 },
  sectionTitle: {
    fontSize: 11.5, fontWeight: '700', color: '#64748b',
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4,
  },
  contactCard: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: 'rgba(195,198,215,0.3)',
  },
  contactIconCircle: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
  },
  contactCardText: { flex: 1 },
  contactCardTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  contactCardSub: { fontSize: 13, color: '#334155', marginTop: 2 },
  contactCardHint: { fontSize: 11.5, color: '#94a3b8', marginTop: 2 },
  infoBox: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: 1, borderColor: 'rgba(195,198,215,0.3)',
  },
  infoBoxText: { flex: 1 },
  infoBoxTitle: { fontSize: 13.5, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  infoBoxBody: { fontSize: 13, color: '#475569', lineHeight: 19 },
  faqLink: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#faf5ff', padding: 14, borderRadius: 14,
    borderWidth: 1, borderColor: '#e9d5ff',
  },
  faqLinkText: { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#7c3aed' },
});
