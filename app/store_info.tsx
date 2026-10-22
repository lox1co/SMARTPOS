import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Platform, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { store } from '@/constants/store';

// Curated preset avatars for store profiles
const PRESET_AVATARS = [
  { id: 'av-1', name: 'Alex', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Alex&backgroundColor=b6e3f4' },
  { id: 'av-2', name: 'Sophia', url: 'https://api.dicebear.com/7.x/personas/png?seed=Sophia&backgroundColor=ffd5dc' },
  { id: 'av-3', name: 'Oliver', url: 'https://api.dicebear.com/7.x/personas/png?seed=Oliver&backgroundColor=d1d4f9' },
  { id: 'av-4', name: 'Aneka', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Aneka&backgroundColor=c0aede' },
  { id: 'av-5', name: 'Leo', url: 'https://api.dicebear.com/7.x/personas/png?seed=Leo&backgroundColor=ffdfbf' },
  { id: 'av-6', name: 'Emma', url: 'https://api.dicebear.com/7.x/personas/png?seed=Emma&backgroundColor=b6e3f4' },
  { id: 'av-7', name: 'Felix', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Felix&backgroundColor=d1d4f9' },
  { id: 'av-8', name: 'Zack', url: 'https://api.dicebear.com/7.x/adventurer/png?seed=Zack&backgroundColor=c0aede' },
  { id: 'av-9', name: 'POS Bot', url: 'https://api.dicebear.com/7.x/bottts/png?seed=POSBot&backgroundColor=b6e3f4' },
  { id: 'av-10', name: 'Happy Boss', url: 'https://api.dicebear.com/7.x/fun-emoji/png?seed=HappyBoss' },
  { id: 'av-11', name: 'Cool Merchant', url: 'https://api.dicebear.com/7.x/fun-emoji/png?seed=CoolMerchant' },
  { id: 'av-12', name: 'Super Star', url: 'https://api.dicebear.com/7.x/fun-emoji/png?seed=SuperStar' },
];

export default function StoreInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userSession = store.currentUser;

  // Form State - Avatar & Basic Information only
  const [shopName, setShopName] = useState(userSession?.shopName || '');
  const [userName, setUserName] = useState(userSession?.userName || '');
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(userSession?.image || null);
  const [storeId] = useState(userSession?.storeId || '');

  // UI state
  const [saving, setSaving] = useState(false);
  const [copiedStoreId, setCopiedStoreId] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (userSession) {
      setShopName(userSession.shopName || '');
      setUserName(userSession.userName || '');
      setSelectedAvatar(userSession.image || null);
    }
  }, [userSession]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleCopyStoreId = () => {
    if (!storeId) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(storeId);
    }
    setCopiedStoreId(true);
    showToast('Store ID copied to clipboard');
    setTimeout(() => setCopiedStoreId(false), 2500);
  };

  const handlePickCustomImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Permission to access photo gallery is required.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const base64Data = asset.base64
          ? `data:image/jpeg;base64,${asset.base64}`
          : asset.uri;
        setSelectedAvatar(base64Data);
      }
    } catch (err) {
      console.warn('Image picker error:', err);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
              setSelectedAvatar(reader.result as string);
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      }
    }
  };

  const handleSave = async () => {
    if (!shopName.trim()) {
      Alert.alert('Validation Error', 'Shop Name cannot be empty.');
      return;
    }
    if (!userName.trim()) {
      Alert.alert('Validation Error', 'Owner / Merchant name cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      await store.updateUserProfile({
        shopName: shopName.trim(),
        userName: userName.trim(),
        image: selectedAvatar || '',
      });

      showToast('Profile updated successfully!');
      setTimeout(() => {
        router.back();
      }, 400);
    } catch (error: any) {
      Alert.alert('Save Failed', error.message || 'Could not update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Toast Notification */}
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
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Main Avatar Preview Card */}
          <View style={styles.avatarHeroCard}>
            <View style={styles.avatarMainWrapper}>
              {selectedAvatar ? (
                <Image style={styles.avatarMainImg} source={selectedAvatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarMainPlaceholder}>
                  <Text style={styles.avatarMainPlaceholderText}>
                    {userName ? userName.trim().substring(0, 2).toUpperCase() : 'SP'}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.avatarCameraBadge}
                onPress={handlePickCustomImage}
                activeOpacity={0.8}
              >
                <MaterialIcons name="photo-camera" size={14} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.avatarHeroTitle}>{shopName || 'Store Profile'}</Text>
            <Text style={styles.avatarHeroSub}>{userName || 'Owner Name'}</Text>
          </View>

          {/* Avatar Selection Grid */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <MaterialIcons name="palette" size={18} color="#004ac6" />
              <Text style={styles.sectionHeaderTitle}>Choose Avatar or Upload Photo</Text>
            </View>

            <View style={styles.presetGrid}>
              {/* Default Initials Option */}
              <TouchableOpacity
                style={[
                  styles.presetItem,
                  selectedAvatar === null && styles.presetItemActive,
                ]}
                onPress={() => setSelectedAvatar(null)}
                activeOpacity={0.7}
              >
                <View style={[styles.presetThumbCircle, { backgroundColor: '#eff6ff' }]}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#004ac6' }}>
                    {userName ? userName.trim().substring(0, 2).toUpperCase() : 'SP'}
                  </Text>
                </View>
                <Text style={styles.presetLabel} numberOfLines={1}>Initials</Text>
                {selectedAvatar === null && (
                  <View style={styles.presetCheckBadge}>
                    <MaterialIcons name="check" size={10} color="#ffffff" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Curated Presets */}
              {PRESET_AVATARS.map((av) => {
                const isSelected = selectedAvatar === av.url;
                return (
                  <TouchableOpacity
                    key={av.id}
                    style={[
                      styles.presetItem,
                      isSelected && styles.presetItemActive,
                    ]}
                    onPress={() => setSelectedAvatar(av.url)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.presetThumbCircle}>
                      <Image style={styles.presetThumbImg} source={av.url} contentFit="cover" />
                    </View>
                    <Text style={styles.presetLabel} numberOfLines={1}>{av.name}</Text>
                    {isSelected && (
                      <View style={styles.presetCheckBadge}>
                        <MaterialIcons name="check" size={10} color="#ffffff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Photo Button */}
            <TouchableOpacity
              style={styles.customUploadBtn}
              onPress={handlePickCustomImage}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add-photo-alternate" size={18} color="#004ac6" />
              <Text style={styles.customUploadText}>Upload Photo from Gallery</Text>
            </TouchableOpacity>
          </View>

          {/* Section: Basic Information */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <MaterialIcons name="badge" size={18} color="#004ac6" />
              <Text style={styles.sectionHeaderTitle}>Basic Information</Text>
            </View>

            {/* Shop Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Shop / Store Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Metro Supermarket"
                placeholderTextColor="#94a3b8"
                value={shopName}
                onChangeText={setShopName}
                autoFocus={false}
              />
            </View>

            {/* Owner Full Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Owner / Merchant Full Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. John Doe"
                placeholderTextColor="#94a3b8"
                value={userName}
                onChangeText={setUserName}
                autoFocus={false}
              />
            </View>

            {/* Store ID / Join Code (Read-Only) */}
            <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
              <Text style={styles.fieldLabel}>Store ID (Staff Join Code)</Text>
              <View style={styles.storeIdRow}>
                <Text style={styles.storeIdText}>{storeId || '—'}</Text>
                <TouchableOpacity
                  style={[styles.copyCodeBtn, copiedStoreId && styles.copyCodeBtnCopied]}
                  onPress={handleCopyStoreId}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name={copiedStoreId ? 'check' : 'content-copy'}
                    size={14}
                    color={copiedStoreId ? '#15803d' : '#004ac6'}
                  />
                  <Text style={[styles.copyCodeBtnText, copiedStoreId && { color: '#15803d' }]}>
                    {copiedStoreId ? 'Copied' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.fieldHint}>
                Cashiers and store staff use this ID during signup to join this store.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom Docked Save Action Button with Safe Area Insets */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <MaterialIcons name="check" size={20} color="#ffffff" />
              <Text style={styles.saveBtnText}>Save Profile</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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
    width: 40,
    height: 40,
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
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    gap: 10,
  },
  floatingToastText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  // Hero Avatar Card
  avatarHeroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarMainWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarMainImg: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#f1f5f9',
    borderWidth: 3,
    borderColor: '#004ac6',
  },
  avatarMainPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#eff6ff',
    borderWidth: 3,
    borderColor: '#004ac6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMainPlaceholderText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#004ac6',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#004ac6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  avatarHeroSub: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  // Section Card
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  // Preset Grid
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  presetItem: {
    width: 60,
    alignItems: 'center',
    padding: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  presetItemActive: {
    borderColor: '#004ac6',
    backgroundColor: '#eff6ff',
  },
  presetThumbCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  presetThumbImg: {
    width: '100%',
    height: '100%',
  },
  presetLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
    marginTop: 4,
  },
  presetCheckBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#004ac6',
    borderRadius: 7,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  customUploadText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#004ac6',
  },
  // Fields
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  storeIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  storeIdText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#004ac6',
    letterSpacing: 0.5,
  },
  copyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  copyCodeBtnCopied: {
    backgroundColor: '#dcfce7',
  },
  copyCodeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#004ac6',
  },
  fieldHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    marginLeft: 2,
  },
  // Bottom Action Bar
  bottomBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  saveBtn: {
    backgroundColor: '#004ac6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#004ac6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
