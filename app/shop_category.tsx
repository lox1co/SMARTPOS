import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { store } from '@/constants/store';
import { SHOP_CATEGORIES, getShopCategoryLabel } from '@/constants/config';

export default function ShopCategoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userSession = store.currentUser;

  const [selectedCategory, setSelectedCategory] = useState(userSession?.shopCategory || 'Retail / Apparel');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (userSession?.shopCategory) {
      const current = userSession.shopCategory;
      const isPreset = SHOP_CATEGORIES.some(
        (c) =>
          c.label.toLowerCase() === current.toLowerCase() ||
          c.value.toLowerCase() === current.toLowerCase() ||
          c.code.toLowerCase() === current.toLowerCase()
      );
      if (isPreset) {
        setSelectedCategory(current);
        setIsCustomMode(false);
      } else {
        setSelectedCategory('Other');
        setCustomCategory(current);
        setIsCustomMode(true);
      }
    }
  }, [userSession]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSelectPreset = (catLabel: string) => {
    Keyboard.dismiss();
    setSelectedCategory(catLabel);
    setIsCustomMode(false);
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    const finalCategory = isCustomMode
      ? customCategory.trim()
      : selectedCategory.trim();

    if (!finalCategory) {
      Alert.alert('Category Required', 'Please select or enter a shop category.');
      return;
    }

    setSaving(true);
    try {
      await store.updateUserProfile({
        shopCategory: finalCategory,
      });
      showToast('Shop category updated!');
      setTimeout(() => {
        router.back();
      }, 500);
    } catch (err: any) {
      Alert.alert('Update Failed', err.message || 'Could not update category.');
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
        <Text style={styles.headerTitle}>Shop Category</Text>
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
            {/* Active Category Banner */}
            <View style={styles.activeBanner}>
              <View style={styles.activeIconCircle}>
                <MaterialIcons name="storefront" size={22} color="#004ac6" />
              </View>
              <View style={styles.activeBannerText}>
                <Text style={styles.activeBannerLabel}>Current Category</Text>
                <Text style={styles.activeBannerValue} numberOfLines={1}>
                  {isCustomMode && customCategory.trim()
                    ? customCategory.trim()
                    : getShopCategoryLabel(selectedCategory)}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionHeading}>Select Business Type</Text>

            {/* 2-Column Preset Grid */}
            <View style={styles.categoryGrid}>
              {SHOP_CATEGORIES.map((cat) => {
                const isSelected =
                  !isCustomMode &&
                  (selectedCategory.toLowerCase() === cat.label.toLowerCase() ||
                    selectedCategory.toLowerCase() === cat.value.toLowerCase() ||
                    selectedCategory.toLowerCase() === cat.code.toLowerCase());

                return (
                  <TouchableOpacity
                    key={cat.code}
                    style={[
                      styles.categoryTile,
                      isSelected && styles.categoryTileActive,
                    ]}
                    onPress={() => handleSelectPreset(cat.label)}
                    activeOpacity={0.75}
                  >
                    <View
                      style={[
                        styles.categoryIconCircle,
                        isSelected && styles.categoryIconCircleActive,
                      ]}
                    >
                      <MaterialIcons
                        name={cat.icon as any}
                        size={17}
                        color={isSelected ? '#ffffff' : '#004ac6'}
                      />
                    </View>
                    <Text
                      style={[
                        styles.categoryTileText,
                        isSelected && styles.categoryTileTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {cat.label}
                    </Text>
                    {isSelected && (
                      <View style={styles.selectedCheck}>
                        <MaterialIcons name="check" size={10} color="#ffffff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Category Input */}
            <View
              style={[
                styles.customCard,
                isCustomMode && styles.customCardActive,
              ]}
            >
              <View style={styles.customCardHeader}>
                <MaterialIcons
                  name="edit-note"
                  size={18}
                  color={isCustomMode ? '#004ac6' : '#64748b'}
                />
                <Text style={styles.customCardTitle}>Custom Business Category</Text>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Specialty Organic Bakery"
                placeholderTextColor="#94a3b8"
                value={customCategory}
                onChangeText={(text) => {
                  setCustomCategory(text);
                  if (text.trim()) {
                    setIsCustomMode(true);
                  }
                }}
                onFocus={() => {
                  if (customCategory.trim()) {
                    setIsCustomMode(true);
                  }
                }}
              />
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
                  <Text style={styles.saveButtonText}>Save Category</Text>
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
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 14,
  },
  activeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBannerText: {
    flex: 1,
  },
  activeBannerLabel: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeBannerValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#004ac6',
    marginTop: 1,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  categoryTile: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 8,
    gap: 6,
    position: 'relative',
  },
  categoryTileActive: {
    borderColor: '#004ac6',
    backgroundColor: '#eff6ff',
  },
  categoryIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconCircleActive: {
    backgroundColor: '#004ac6',
  },
  categoryTileText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  categoryTileTextActive: {
    color: '#004ac6',
    fontWeight: '700',
  },
  selectedCheck: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#004ac6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  customCardActive: {
    borderColor: '#004ac6',
    backgroundColor: '#f8faff',
  },
  customCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  customCardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
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
