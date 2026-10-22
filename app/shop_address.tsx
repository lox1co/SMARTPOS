import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { store } from '@/constants/store';

export default function ShopAddressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userSession = store.currentUser;

  const [businessAddress, setBusinessAddress] = useState(userSession?.businessAddress || '');
  const [shopName] = useState(userSession?.shopName || 'SmartPOS Store');
  const [phone] = useState(userSession?.phone || '');
  const [gstNumber] = useState(userSession?.gstNumber || '');
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (userSession?.businessAddress) {
      setBusinessAddress(userSession.businessAddress);
    }
  }, [userSession]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    setSaving(true);
    try {
      await store.updateUserProfile({
        businessAddress: businessAddress.trim(),
      });
      showToast('Store address updated!');
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update address.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Toast */}
      {toastMsg && (
        <View style={styles.floatingToast}>
          <MaterialIcons name="check-circle" size={18} color="#22c55e" />
          <Text style={styles.floatingToastText}>{toastMsg}</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Store Location</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[styles.headerSaveBtn, saving && { opacity: 0.6 }]}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#004ac6" />
          ) : (
            <Text style={styles.headerSaveText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.contentWrapper}
        >
          <View style={styles.body}>
            {/* Banner */}
            <View style={styles.banner}>
              <View style={styles.iconCircle}>
                <MaterialIcons name="location-on" size={26} color="#e11d48" />
              </View>
              <View style={styles.bannerTextCol}>
                <Text style={styles.bannerTitle}>Physical Store Address</Text>
                <Text style={styles.bannerSub}>
                  Printed in receipt headers and visible on shared invoices.
                </Text>
              </View>
            </View>

            {/* Address Input */}
            <Text style={styles.sectionHeading}>Enter Store Address</Text>
            <View style={styles.card}>
              <View style={styles.fieldLabelRow}>
                <MaterialIcons name="business" size={16} color="#004ac6" />
                <Text style={styles.fieldLabel}>Business Location & Full Address</Text>
              </View>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder="e.g. Shop #12, 1st Floor, Royal Arcade, Anna Salai, Chennai, Tamil Nadu - 600002"
                placeholderTextColor="#94a3b8"
                value={businessAddress}
                onChangeText={setBusinessAddress}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            {/* Live Thermal Receipt Header Preview */}
            <Text style={styles.sectionHeading}>Receipt Preview</Text>
            <View style={styles.receiptPreviewCard}>
              <Text style={styles.receiptStoreName}>{shopName.toUpperCase()}</Text>
              <Text style={styles.receiptAddressText} numberOfLines={2}>
                {businessAddress.trim() || 'No. 123, Main Market Road, City, State - 000000'}
              </Text>
              <View style={styles.receiptMetaRow}>
                {phone ? <Text style={styles.receiptMetaText}>Ph: {phone}</Text> : null}
                {gstNumber ? <Text style={styles.receiptMetaText}>GSTIN: {gstNumber}</Text> : null}
              </View>
            </View>
          </View>

          {/* Bottom Fixed Save Button */}
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.75 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <MaterialIcons name="save" size={20} color="#ffffff" />
                  <Text style={styles.saveButtonText}>Save Store Address</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#004ac6',
  },
  contentWrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  body: {
    padding: 16,
    flex: 1,
  },
  floatingToast: {
    position: 'absolute',
    top: 64,
    left: 20,
    right: 20,
    zIndex: 999,
    backgroundColor: '#1e293b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    elevation: 8,
    gap: 10,
  },
  floatingToastText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9f1239',
  },
  bannerSub: {
    fontSize: 12,
    color: '#be123c',
    marginTop: 2,
    lineHeight: 16,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  textArea: {
    height: 72,
  },
  receiptPreviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    padding: 12,
    alignItems: 'center',
  },
  receiptStoreName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  receiptAddressText: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 15,
  },
  receiptMetaRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  receiptMetaText: {
    fontSize: 10,
    color: '#64748b',
  },
  bottomBar: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  saveButton: {
    backgroundColor: '#004ac6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#004ac6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
