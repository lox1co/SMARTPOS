import { LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, Animated, Dimensions, Modal, Platform, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { store, Product } from '@/constants/store';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const ALL_BARCODE_TYPES = [
  'qr',
  'ean13',
  'ean8',
  'code128',
  'code39',
  'code93',
  'upc_a',
  'upc_e',
  'itf14',
  'codabar',
  'pdf417',
  'aztec',
  'datamatrix',
] as any;

const BOX_WIDTH = 270;
const BOX_HEIGHT = 220;

interface ScannedItemState {
  product: Product;
  quantity: number;
}

export default function ScannerScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItemState[]>([]);
  const [manualInputVisible, setManualInputVisible] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [notFoundSku, setNotFoundSku] = useState<string | null>(null);

  // Scanning box tracking & success flash state
  const [frameLayout, setFrameLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [cameraLayout, setCameraLayout] = useState<{ width: number; height: number } | null>(null);
  const [isSuccessScan, setIsSuccessScan] = useState(false);

  // Animation for the scanning laser line
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Debounce guard for repeat barcode frames (see handleBarcodeScanned).
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  useEffect(() => {
    store.syncProducts();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: BOX_HEIGHT - 6,
          duration: 1800,
          useNativeDriver: false,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 2,
          duration: 1800,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [scanLineAnim]);

  // Request camera permission on mount
  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const totalItems = scannedItems.reduce((acc, item) => acc + item.quantity, 0);

  const findProductByBarcode = (barcode: string): Product | undefined => {
    const clean = barcode.trim();
    const cleanLower = clean.toLowerCase();
    const noLeadingZeros = clean.replace(/^0+/, '');

    return store.getProducts().find((p) => {
      const sku = (p.sku || '').trim();
      const skuLower = sku.toLowerCase();
      const skuNoZeros = sku.replace(/^0+/, '');
      const id = (p.id || '').toString();
      return (
        skuLower === cleanLower ||
        id === clean ||
        (noLeadingZeros.length > 0 && skuNoZeros === noLeadingZeros)
      );
    });
  };

  /**
   * Evaluates if the detected barcode center coordinate falls inside
   * the visible target scanning box frame.
   */
  const isBarcodeInsideFrame = (result: BarcodeScanningResult): boolean => {
    // If layout not yet available, fallback to allow scan
    if (!frameLayout || !cameraLayout) {
      return true;
    }

    let barcodeCenterX: number | null = null;
    let barcodeCenterY: number | null = null;

    // 1. Check bounds if provided by camera driver
    if (result.bounds && result.bounds.origin && result.bounds.size) {
      const { origin, size } = result.bounds;
      barcodeCenterX = origin.x + size.width / 2;
      barcodeCenterY = origin.y + size.height / 2;
    }
    // 2. Check cornerPoints if provided
    else if (result.cornerPoints && result.cornerPoints.length > 0) {
      const sumX = result.cornerPoints.reduce((acc, p) => acc + p.x, 0);
      const sumY = result.cornerPoints.reduce((acc, p) => acc + p.y, 0);
      barcodeCenterX = sumX / result.cornerPoints.length;
      barcodeCenterY = sumY / result.cornerPoints.length;
    }

    // If coordinates are not provided by platform driver, allow scan
    if (barcodeCenterX === null || barcodeCenterY === null) {
      return true;
    }

    // Frame boundaries with generous tolerance margin (35px) for smooth scanning ergonomics
    const toleranceX = 35;
    const toleranceY = 35;

    const minX = frameLayout.x - toleranceX;
    const maxX = frameLayout.x + frameLayout.width + toleranceX;
    const minY = frameLayout.y - toleranceY;
    const maxY = frameLayout.y + frameLayout.height + toleranceY;

    const isInside =
      barcodeCenterX >= minX &&
      barcodeCenterX <= maxX &&
      barcodeCenterY >= minY &&
      barcodeCenterY <= maxY;

    return isInside;
  };

  const handleBarcodeScanned = (scanningResult: BarcodeScanningResult) => {
    const rawData = scanningResult?.data || '';
    const barcodeStr = rawData.trim();
    if (!barcodeStr) return;

    // Filter: ONLY scan if barcode is positioned inside the viewfinder target box
    if (!isBarcodeInsideFrame(scanningResult)) {
      return;
    }

    // Debounce: ignore same code seen again within 1.5s so quantity increments cleanly
    const now = Date.now();
    if (barcodeStr === lastScanRef.current.code && now - lastScanRef.current.time < 1500) {
      return;
    }
    lastScanRef.current = { code: barcodeStr, time: now };

    // Trigger visual feedback flash
    setIsSuccessScan(true);
    setTimeout(() => setIsSuccessScan(false), 600);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    if (mode === 'add_product') {
      router.replace({ pathname: '/add_product', params: { scannedSku: barcodeStr } });
      return;
    }

    // Look up product in local store
    const product = findProductByBarcode(barcodeStr);

    if (product) {
      setScannedItems((prevItems) => {
        const existingIdx = prevItems.findIndex((item) => item.product.id === product.id);
        if (existingIdx > -1) {
          const updated = [...prevItems];
          updated[existingIdx].quantity += 1;
          return updated;
        } else {
          return [...prevItems, { product, quantity: 1 }];
        }
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      setNotFoundSku(barcodeStr);
    }
  };

  const handleDone = () => {
    if (scannedItems.length > 0) {
      scannedItems.forEach((item) => {
        store.addScannedItem(item.product, item.quantity);
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    if (mode === 'add_product') {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/add_product');
      }
      return;
    }

    // Return to POS Terminal Billing screen
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate('/(tabs)/billing' as any);
    }
  };

  const onCameraContainerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCameraLayout({ width, height });
  };

  const onFrameLayout = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setFrameLayout({ x, y, width, height });
  };

  const renderCameraView = () => {
    if (!permission) {
      return <View style={styles.simulatedCameraContainer} />;
    }

    if (!permission.granted) {
      return (
        <View style={styles.simulatedCameraContainer}>
          <Text style={styles.permissionText}>
            Camera permission is required to scan barcodes.
          </Text>
          <TouchableOpacity style={styles.permissionRequestBtn} onPress={requestPermission}>
            <Text style={styles.permissionRequestText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ALL_BARCODE_TYPES,
        }}
      />
    );
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Viewfinder background */}
      <View
        style={styles.viewfinderContainer}
        pointerEvents="box-none"
        onLayout={onCameraContainerLayout}
      >
        {renderCameraView()}

        {/* Viewfinder Target Framing with Dark Mask */}
        <View style={styles.overlayContainer} pointerEvents="none">
          <View
            style={[
              styles.targetFrame,
              isSuccessScan && styles.targetFrameSuccess,
            ]}
            onLayout={onFrameLayout}
          >
            {/* Corner Brackets */}
            <View style={[styles.cornerBracket, styles.topLeftCorner, isSuccessScan && styles.cornerSuccess]} />
            <View style={[styles.cornerBracket, styles.topRightCorner, isSuccessScan && styles.cornerSuccess]} />
            <View style={[styles.cornerBracket, styles.bottomLeftCorner, isSuccessScan && styles.cornerSuccess]} />
            <View style={[styles.cornerBracket, styles.bottomRightCorner, isSuccessScan && styles.cornerSuccess]} />

            {/* Laser Line */}
            <Animated.View
              style={[
                styles.scanLine,
                isSuccessScan && styles.scanLineSuccess,
                { top: scanLineAnim },
              ]}
            />
          </View>
          <Text style={[styles.alignmentLabel, isSuccessScan && { color: '#4ade80', fontWeight: '700' }]}>
            {isSuccessScan ? '✓ Barcode Scanned!' : 'Place barcode inside the box to scan'}
          </Text>
        </View>
      </View>

      {/* Top Header App Bar */}
      <View style={[styles.header, { height: 64 + insets.top, paddingTop: insets.top }]}>
        <TouchableOpacity
          aria-label="Back"
          style={styles.headerButton}
          onPress={handleDone}
        >
          <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Barcode</Text>
        <TouchableOpacity
          aria-label="Flashlight toggle"
          style={[styles.headerButton, torch && styles.flashlightOn]}
          onPress={() => setTorch(!torch)}
        >
          <MaterialIcons
            name={torch ? 'flashlight-on' : 'flashlight-off'}
            size={24}
            color="#ffffff"
          />
        </TouchableOpacity>
      </View>

      {/* Bottom Scanned List Drawer Card */}
      <View style={[styles.drawerCard, { paddingBottom: insets.bottom + 16 }]}>
        {/* Drag Handle Illustration */}
        <View style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        <View style={styles.drawerContent}>
          <Text style={styles.drawerTitle}>Recently Scanned</Text>

          <ScrollView style={styles.scannedList} showsVerticalScrollIndicator={false}>
            {scannedItems.map((item) => (
              <View key={item.product.id} style={styles.scannedItem}>
                <View style={styles.itemIconContainer}>
                  <MaterialIcons name="inventory" size={20} color="#434655" />
                </View>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.product.name}
                  </Text>
                  <Text style={styles.itemSku}>SKU: {item.product.sku}</Text>
                </View>
                <View style={styles.itemActions}>
                  <Text style={styles.itemPrice}>₹{(item.product.price * item.quantity).toFixed(2)}</Text>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => {
                        const newQty = item.quantity - 1;
                        setScannedItems((prev) =>
                          prev
                            .map((p) => (p.product.id === item.product.id ? { ...p, quantity: newQty } : p))
                            .filter((p) => p.quantity > 0)
                        );
                      }}
                    >
                      <MaterialIcons name="remove" size={14} color="#434655" />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => {
                        setScannedItems((prev) =>
                          prev.map((p) =>
                            p.product.id === item.product.id ? { ...p, quantity: p.quantity + 1 } : p
                          )
                        );
                      }}
                    >
                      <MaterialIcons name="add" size={14} color="#434655" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
            {scannedItems.length === 0 && (
              <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                <MaterialIcons name="qr-code-scanner" size={44} color="#c3c6d7" />
                <Text style={{ fontSize: 14, color: '#737686', marginTop: 8 }}>
                  Align barcode inside the target viewfinder frame
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                setManualBarcode('');
                setManualInputVisible(true);
              }}
            >
              <MaterialIcons name="keyboard" size={20} color="#131b2e" />
              <Text style={styles.secondaryBtnText}>Manual Entry</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.primaryBtn, totalItems === 0 && { opacity: 0.8 }]}
              onPress={handleDone}
            >
              <MaterialIcons name="check-circle" size={20} color="#ffffff" />
              <Text style={styles.primaryBtnText}>
                {totalItems > 0 ? `Add to Cart (${totalItems})` : 'Done'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Manual Entry Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={manualInputVisible}
        onRequestClose={() => setManualInputVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="keyboard" size={24} color="#004ac6" />
              <Text style={styles.modalTitle}>Manual Entry</Text>
            </View>
            <Text style={styles.modalDescription}>
              Enter the product barcode or SKU code below to add it.
            </Text>
            
            <TextInput
              style={styles.modalInput}
              placeholder="Enter barcode / SKU code"
              placeholderTextColor="#9ca3af"
              value={manualBarcode}
              onChangeText={setManualBarcode}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus={true}
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setManualInputVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={() => {
                  const barcode = manualBarcode.trim();
                  if (barcode) {
                    setManualInputVisible(false);
                    handleBarcodeScanned({
                      data: barcode,
                      type: 'manual',
                      cornerPoints: [],
                      bounds: { origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } },
                    } as any);
                  } else {
                    alert('Please enter a valid barcode or SKU.');
                  }
                }}
              >
                <Text style={styles.modalSubmitText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Product Not Found Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={!!notFoundSku}
        onRequestClose={() => setNotFoundSku(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="inventory-2" size={24} color="#ba1a1a" />
              <Text style={[styles.modalTitle, { color: '#ba1a1a' }]}>Product Not Found</Text>
            </View>
            <Text style={styles.modalDescription}>
              No product found with barcode / SKU:
            </Text>
            <View style={{ backgroundColor: '#f1f5f9', padding: 12, borderRadius: 8, marginVertical: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b', textAlign: 'center', letterSpacing: 1 }}>
                {notFoundSku}
              </Text>
            </View>
            <Text style={[styles.modalDescription, { fontSize: 12, color: '#64748b' }]}>
              Would you like to register this as a new product in your inventory?
            </Text>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setNotFoundSku(null)}
              >
                <Text style={styles.modalCancelText}>Dismiss</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: '#004ac6' }]}
                onPress={() => {
                  const skuToRegister = notFoundSku;
                  setNotFoundSku(null);
                  if (skuToRegister) {
                    router.replace({ pathname: '/add_product', params: { scannedSku: skuToRegister } });
                  }
                }}
              >
                <Text style={styles.modalSubmitText}>Create Product</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  viewfinderContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  simulatedCameraContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionText: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  permissionRequestBtn: {
    backgroundColor: '#004ac6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    zIndex: 5,
  },
  permissionRequestText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  targetFrame: {
    width: BOX_WIDTH,
    height: BOX_HEIGHT,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 12,
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  targetFrameSuccess: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
  },
  cornerBracket: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#004ac6',
  },
  cornerSuccess: {
    borderColor: '#22c55e',
  },
  topLeftCorner: {
    top: -3,
    left: -3,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRightCorner: {
    top: -3,
    right: -3,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeftCorner: {
    bottom: -3,
    left: -3,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRightCorner: {
    bottom: -3,
    right: -3,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    height: 3,
    backgroundColor: '#ba1a1a',
    borderRadius: 2,
    shadowColor: '#ba1a1a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  scanLineSuccess: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
  },
  alignmentLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 18,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashlightOn: {
    backgroundColor: '#004ac6',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  drawerCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(250,248,255,0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    zIndex: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  dragHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  dragHandle: {
    width: 48,
    height: 6,
    backgroundColor: '#c3c6d7',
    borderRadius: 3,
  },
  drawerContent: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#131b2e',
    marginBottom: 16,
  },
  scannedList: {
    maxHeight: SCREEN_HEIGHT * 0.25,
    marginBottom: 16,
  },
  scannedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(195,198,215,0.3)',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: 'rgba(0,0,0,0.02)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  itemIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#faf8ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#131b2e',
  },
  itemSku: {
    fontSize: 12,
    color: '#434655',
    marginTop: 2,
  },
  itemActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#131b2e',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eaedff',
    borderRadius: 9999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  qtyBtn: {
    padding: 4,
  },
  qtyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#131b2e',
    marginHorizontal: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(195,198,215,0.3)',
    paddingTop: 16,
  },
  secondaryBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#737686',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#131b2e',
  },
  primaryBtn: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#004ac6',
    borderRadius: 8,
    shadowColor: 'rgba(37,99,235,0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#131b2e',
  },
  modalDescription: {
    fontSize: 14,
    color: '#434655',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: '#c3c6d7',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#131b2e',
    backgroundColor: '#faf8ff',
    marginBottom: 20,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#737686',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#131b2e',
  },
  modalSubmitBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#004ac6',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    shadowColor: 'rgba(37,99,235,0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  modalSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});
