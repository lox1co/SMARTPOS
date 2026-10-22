import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { store } from '@/constants/store';

export default function ShopGstScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userSession = store.currentUser;

  const [gstNumber, setGstNumber] = useState(userSession?.gstNumber || '');
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (userSession?.gstNumber) {
      setGstNumber(userSession.gstNumber);
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
        gstNumber: gstNumber.trim().toUpperCase(),
      });
      showToast('GST Number updated!');
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update GST Number.');
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
        <Text style={styles.headerTitle}>GST & Tax Details</Text>
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
                <MaterialIcons name="receipt-long" size={26} color="#4f46e5" />
              </View>
              <View style={styles.bannerTextCol}>
                <Text style={styles.bannerTitle}>Goods & Services Tax (GSTIN)</Text>
                <Text style={styles.bannerSub}>
                  Printed on thermal customer receipts and invoice exports.
                </Text>
              </View>
            </View>

            {/* Input Card */}
            <Text style={styles.sectionHeading}>GST Identification Number</Text>
            <View style={styles.card}>
              <View style={styles.fieldLabelRow}>
                <MaterialIcons name="verified-user" size={16} color="#004ac6" />
                <Text style={styles.fieldLabel}>15-Digit GSTIN Number</Text>
              </View>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 29AAAAA0000A1Z5"
                  placeholderTextColor="#94a3b8"
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  autoCapitalize="characters"
                  maxLength={15}
                />
              </View>

              <View style={styles.formatInfoBox}>
                <MaterialIcons name="info-outline" size={15} color="#64748b" />
                <Text style={styles.formatInfoText}>
                  Format: 2-digit State + 10-digit PAN + 1 Entity + 'Z' + 1 Check
                </Text>
              </View>
            </View>

            {/* Benefits Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <MaterialIcons name="print" size={18} color="#004ac6" />
                <Text style={styles.infoRowText}>Printed on POS thermal receipt header</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <MaterialIcons name="picture-as-pdf" size={18} color="#004ac6" />
                <Text style={styles.infoRowText}>Included in PDF invoices & GST summaries</Text>
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
                  <Text style={styles.saveButtonText}>Save GST Number</Text>
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
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 20,
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
    color: '#312e81',
  },
  bannerSub: {
    fontSize: 12,
    color: '#4338ca',
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
    padding: 16,
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
  inputBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textInput: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    padding: 0,
  },
  formatInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  formatInfoText: {
    fontSize: 11,
    color: '#64748b',
    flex: 1,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  infoRowText: {
    fontSize: 13,
    color: '#334155',
    flex: 1,
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
