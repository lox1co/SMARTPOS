import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { store } from '@/constants/store';
import { PRODUCT_CATEGORIES } from '@/constants/config';

const CATEGORIES = PRODUCT_CATEGORIES;

const UNIT_OPTIONS = [
  { label: 'Piece (pcs)', value: 'pcs', type: 'count', icon: 'check-box-outline-blank' },
  { label: 'Kilogram (kg)', value: 'kg', type: 'weight', icon: 'scale' },
  { label: 'Gram (g)', value: 'g', type: 'weight', icon: 'scale' },
  { label: 'Packet (pkt)', value: 'pack', type: 'count', icon: 'inventory' },
  { label: 'Box (box)', value: 'box', type: 'count', icon: 'all-inbox' },
  { label: 'Litre (L)', value: 'l', type: 'volume', icon: 'water-drop' },
  { label: 'MilliLitre (ml)', value: 'ml', type: 'volume', icon: 'opacity' },
];

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  iconLeft?: string;
  iconRight?: string;
  onIconRightPress?: () => void;
  editable?: boolean;
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  iconLeft,
  iconRight,
  onIconRightPress,
  editable = true,
}: FormFieldProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel} numberOfLines={1}>
        {label}
      </Text>
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          !editable && styles.inputWrapperDisabled,
        ]}
      >
        {iconLeft && <Text style={styles.iconLeftText}>{iconLeft}</Text>}
        <TextInput
          style={[styles.input, !editable && { color: '#737686' }]}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder || ''}
          placeholderTextColor="#94a3b8"
          editable={editable}
          numberOfLines={1}
        />
        {iconRight && (
          <TouchableOpacity
            style={styles.iconRightButton}
            onPress={onIconRightPress}
            disabled={!onIconRightPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialIcons name={iconRight as any} size={20} color="#434655" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function AddProductScreen() {
  const router = useRouter();
  const { id, scannedSku } = useLocalSearchParams<{ id?: string; scannedSku?: string }>();
  const isEdit = !!id;
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [sku, setSku] = useState(scannedSku || '');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [taxRate, setTaxRate] = useState('8');
  const [initialStock, setInitialStock] = useState('');
  const [lowStock, setLowStock] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [error, setError] = useState('');

  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const isWeightOrVolume = ['kg', 'g', 'l', 'ml'].includes(unit);

  useEffect(() => {
    if (scannedSku && !isEdit) {
      setSku(scannedSku);
    }
  }, [scannedSku, isEdit]);

  useEffect(() => {
    if (isEdit && id) {
      const loadProduct = () => {
        const product = store.getProductById(id);
        if (product) {
          setName(product.name);
          setSku(product.sku);
          setCategory(product.category);
          setUnit(product.unit || 'pcs');
          setCostPrice(product.costPrice.toString());
          setSellingPrice(product.price.toString());
          setTaxRate(product.taxRate.toString());
          setInitialStock(product.stock.toString());
          setLowStock(product.lowStockAlert.toString());
          const img = product.image || '';
          setImageUrl(img);
          setImageError(false);
          setImageLoading(!!img.trim());
        }
      };

      loadProduct();
      const unsubscribe = store.subscribe(loadProduct);
      return unsubscribe;
    }
  }, [isEdit, id]);

  const handleImageUrlChange = (text: string) => {
    setImageUrl(text);
    setImageError(false);
    if (text.trim()) {
      setImageLoading(true);
    } else {
      setImageLoading(false);
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveProduct = async () => {
    setError('');

    if (!name.trim() || !sku.trim() || !category || !sellingPrice.trim() || !initialStock.trim()) {
      setError('Please fill in all required fields marked with *');
      return;
    }

    const priceNum = parseFloat(sellingPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Please enter a valid selling price greater than ₹0.');
      return;
    }

    const costNum = costPrice.trim() ? parseFloat(costPrice) : 0;
    if (isNaN(costNum) || costNum < 0) {
      setError('Cost price must be a valid non-negative number.');
      return;
    }

    const stockNum = parseFloat(initialStock);
    if (isNaN(stockNum) || stockNum < 0) {
      setError(`Stock level must be a valid non-negative ${isWeightOrVolume ? 'number' : 'integer'}.`);
      return;
    }

    const lowStockAlertNum = lowStock.trim() ? parseFloat(lowStock) : (isWeightOrVolume ? 2.0 : 5);
    if (isNaN(lowStockAlertNum) || lowStockAlertNum < 0) {
      setError('Low stock alert must be a valid non-negative number.');
      return;
    }

    const taxRateNum = taxRate.trim() ? parseFloat(taxRate) : 8;
    if (isNaN(taxRateNum) || taxRateNum < 0 || taxRateNum > 100) {
      setError('Please enter a valid tax rate percentage (0-100).');
      return;
    }

    const currentProducts = store.getProducts();
    const skuExists = currentProducts.some(
      (item) => item.sku.toLowerCase() === sku.trim().toLowerCase() && item.id !== id
    );

    if (skuExists) {
      setError('Product SKU already exists in catalog.');
      return;
    }

    const productData = {
      name: name.trim(),
      sku: sku.trim().toUpperCase(),
      category,
      unit,
      costPrice: costNum,
      price: priceNum,
      taxRate: taxRateNum,
      stock: stockNum,
      lowStockAlert: lowStockAlertNum,
      image: imageUrl.trim() || undefined,
    };

    setIsSaving(true);
    try {
      if (isEdit && id) {
        await store.updateProduct(id, {
          ...productData,
          image: imageUrl.trim() || '',
        });
      } else {
        await store.addProduct(productData);
      }
      router.replace('/(tabs)/products');
    } catch (err: any) {
      setError(err?.message || 'Failed to save product in database.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = () => {
    if (!isEdit || !id) return;

    const performDelete = async () => {
      try {
        await store.deleteProduct(id);
        alert('Product deleted successfully.');
        router.replace('/(tabs)/products');
      } catch {
        alert('Failed to delete product.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Product',
        `Are you sure you want to delete "${name}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIconButton} onPress={() => router.back()}>
          <MaterialIcons name="close" size={24} color="#004ac6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEdit ? 'Edit Product' : 'Add Product'}
        </Text>
        {isEdit ? (
          <TouchableOpacity style={styles.headerIconButton} onPress={handleDeleteProduct}>
            <MaterialIcons name="delete" size={24} color="#ba1a1a" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
          {error ? (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={18} color="#ba1a1a" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Product Image Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeader}>Product Image</Text>
              {imageUrl.trim() ? (
                <TouchableOpacity
                  style={styles.clearImageBtn}
                  onPress={() => {
                    setImageUrl('');
                    setImageError(false);
                    setImageLoading(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons name="delete-outline" size={16} color="#ba1a1a" />
                  <Text style={styles.clearImageBtnText}>Remove Image</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {imageUrl.trim() ? (
              <View style={styles.imagePreviewWrapper}>
                <Image
                  source={{ uri: imageUrl.trim() }}
                  style={styles.imagePreview}
                  contentFit="contain"
                  transition={200}
                  onLoadStart={() => {
                    setImageLoading(true);
                    setImageError(false);
                  }}
                  onLoad={() => {
                    setImageLoading(false);
                    setImageError(false);
                  }}
                  onError={() => {
                    setImageLoading(false);
                    setImageError(true);
                  }}
                />

                {imageLoading && (
                  <View style={styles.imageLoadingOverlay}>
                    <ActivityIndicator size="small" color="#004ac6" />
                    <Text style={styles.imageLoadingText}>Fetching image...</Text>
                  </View>
                )}

                {imageError && (
                  <View style={styles.imageErrorOverlay}>
                    <MaterialIcons name="broken-image" size={32} color="#ba1a1a" />
                    <Text style={styles.imageErrorTitle}>Unable to load image</Text>
                    <Text style={styles.imageErrorSub}>Check URL or try a direct image link</Text>
                  </View>
                )}

                {!imageLoading && !imageError && (
                  <View style={styles.imageSuccessBadge}>
                    <MaterialIcons name="check-circle" size={13} color="#16a34a" />
                    <Text style={styles.imageSuccessBadgeText}>Image Loaded</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.imagePlaceholderArea}>
                <View style={styles.placeholderIconCircle}>
                  <MaterialIcons name="image" size={26} color="#737686" />
                </View>
                <Text style={styles.placeholderTitle}>No Image Provided</Text>
                <Text style={styles.placeholderSub}>Enter an image URL below to fetch and preview</Text>
              </View>
            )}

            <View style={{ marginTop: 12 }}>
              <FormField
                label="Image URL (Optional)"
                value={imageUrl}
                onChangeText={handleImageUrlChange}
                placeholder="https://example.com/product.jpg"
                iconRight={imageUrl ? 'close' : undefined}
                onIconRightPress={
                  imageUrl
                    ? () => {
                        setImageUrl('');
                        setImageError(false);
                        setImageLoading(false);
                      }
                    : undefined
                }
              />
            </View>
          </View>

          {/* Basic Info Section */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Basic Info</Text>

            <FormField
              label="Product Name *"
              value={name}
              onChangeText={setName}
              placeholder="Enter product name"
            />

            <FormField
              label="SKU / Barcode *"
              value={sku}
              onChangeText={setSku}
              placeholder="Enter or scan SKU"
              iconRight="qr-code-scanner"
              onIconRightPress={() => router.push({ pathname: '/scanner', params: { mode: 'add_product' } })}
            />

            {/* Custom Category Dropdown Trigger */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category *</Text>
              <TouchableOpacity
                style={[styles.inputWrapper, styles.selectTrigger]}
                onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                activeOpacity={0.8}
              >
                <Text style={[styles.selectText, !category && { color: '#94a3b8' }]} numberOfLines={1}>
                  {category || 'Select category'}
                </Text>
                <MaterialIcons name={showCategoryDropdown ? "arrow-drop-up" : "arrow-drop-down"} size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Category Dropdown List */}
            {showCategoryDropdown && (
              <View style={styles.categoryDropdown}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={styles.categoryOption}
                    onPress={() => {
                      setCategory(cat);
                      setShowCategoryDropdown(false);
                    }}
                  >
                    <Text style={styles.categoryOptionText}>{cat}</Text>
                    {category === cat && (
                      <MaterialIcons name="check" size={18} color="#004ac6" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Pricing & Unit Measurement Section */}
          <View style={styles.sectionCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.sectionHeader}>Pricing & Unit Type</Text>
              <View style={styles.unitTypeBadge}>
                <MaterialIcons
                  name={isWeightOrVolume ? 'scale' : 'check-box-outline-blank'}
                  size={14}
                  color="#004ac6"
                />
                <Text style={styles.unitTypeBadgeText}>
                  {isWeightOrVolume ? 'Sold by Weight / Volume' : 'Sold by Piece'}
                </Text>
              </View>
            </View>

            {/* Measurement Unit Selector Chips */}
            <Text style={styles.subLabel}>Select Measurement Unit *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitChipsContainer}>
              {UNIT_OPTIONS.map((opt) => {
                const isSelected = unit === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.unitChip, isSelected && styles.unitChipSelected]}
                    onPress={() => setUnit(opt.value)}
                  >
                    <MaterialIcons
                      name={opt.icon as any}
                      size={16}
                      color={isSelected ? '#ffffff' : '#434655'}
                    />
                    <Text style={[styles.unitChipText, isSelected && styles.unitChipTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.rowInputs, { marginTop: 16 }]}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <FormField
                  label={`Cost (${unit})`}
                  value={costPrice}
                  onChangeText={setCostPrice}
                  placeholder="Cost (₹)"
                  keyboardType="decimal-pad"
                  iconLeft="₹"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label={`Price (${unit}) *`}
                  value={sellingPrice}
                  onChangeText={setSellingPrice}
                  placeholder="Price (₹)"
                  keyboardType="decimal-pad"
                  iconLeft="₹"
                />
              </View>
            </View>

            <FormField
              label="GST / Tax Rate (%)"
              value={taxRate}
              onChangeText={setTaxRate}
              placeholder="Tax % (e.g. 8)"
              keyboardType="decimal-pad"
              iconRight="percent"
            />
          </View>

          {/* Inventory Section */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>Inventory</Text>
            <View style={styles.rowInputs}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <FormField
                  label={`Stock (${unit}) *`}
                  value={initialStock}
                  onChangeText={setInitialStock}
                  placeholder="Quantity"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <FormField
                  label={`Low Stock Alert`}
                  value={lowStock}
                  onChangeText={setLowStock}
                  placeholder="Alert qty"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save Button Fixed Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {isEdit && (
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: '#ba1a1a', flex: 1 }]}
              onPress={handleDeleteProduct}
            >
              <MaterialIcons name="delete" size={20} color="#ffffff" />
              <Text style={styles.saveButtonText}>Delete</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.saveButton, { flex: isEdit ? 2 : 1 }, isSaving && { opacity: 0.7 }]}
            onPress={handleSaveProduct}
            disabled={isSaving}
          >
            <MaterialIcons name="save" size={20} color="#ffffff" />
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Product'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#faf8ff',
  },
  keyboardContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(195,198,215,0.2)',
    backgroundColor: '#ffffff',
  },
  headerIconButton: {
    padding: 8,
    borderRadius: 9999,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#131b2e',
  },
  formScroll: {
    padding: 16,
    paddingBottom: 110,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffdad6',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#ba1a1a',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(195,198,215,0.3)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#131b2e',
    marginBottom: 12,
  },
  subLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#434655',
    marginBottom: 8,
  },
  unitTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitTypeBadgeText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#004ac6',
  },
  unitChipsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  unitChipSelected: {
    backgroundColor: '#004ac6',
    borderColor: '#004ac6',
  },
  unitChipText: {
    fontSize: 12.5,
    fontWeight: '500',
    color: '#334155',
  },
  unitChipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  clearImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
  },
  clearImageBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ba1a1a',
  },
  imagePreviewWrapper: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(248, 250, 252, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imageLoadingText: {
    fontSize: 12,
    color: '#004ac6',
    fontWeight: '500',
  },
  imageErrorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  imageErrorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ba1a1a',
    marginTop: 4,
  },
  imageErrorSub: {
    fontSize: 11,
    color: '#991b1b',
    textAlign: 'center',
    marginTop: 2,
  },
  imageSuccessBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  imageSuccessBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16a34a',
  },
  imagePlaceholderArea: {
    height: 110,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#c3c6d7',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#faf8ff',
    paddingHorizontal: 16,
  },
  placeholderIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  placeholderTitle: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  placeholderSub: {
    fontSize: 11.5,
    color: '#737686',
    marginTop: 2,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 5,
  },
  inputWrapper: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  inputWrapperFocused: {
    borderColor: '#004ac6',
    backgroundColor: '#ffffff',
  },
  inputWrapperDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 13.5,
    color: '#0f172a',
  },
  iconLeftText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
    marginRight: 6,
  },
  iconRightButton: {
    paddingLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowInputs: {
    flexDirection: 'row',
  },
  selectTrigger: {
    justifyContent: 'space-between',
  },
  selectText: {
    fontSize: 13.5,
    color: '#0f172a',
    flex: 1,
  },
  categoryDropdown: {
    marginTop: -4,
    marginBottom: 12,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryOptionText: {
    fontSize: 13.5,
    color: '#131b2e',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(195,198,215,0.2)',
  },
  saveButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#004ac6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
