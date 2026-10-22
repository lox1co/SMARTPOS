import { LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, ScrollView, ActivityIndicator, Modal, Pressable, Platform, Animated, Easing, KeyboardAvoidingView, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { API_BASE_URL, SHOP_CATEGORIES } from '@/constants/config';

const categories = SHOP_CATEGORIES;

const countryCodes = [
  { name: 'India', code: '+91', flag: '🇮🇳' },
  { name: 'United States', code: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
  { name: 'Australia', code: '+61', flag: '🇦🇺' },
  { name: 'Singapore', code: '+65', flag: '🇸🇬' },
  { name: 'United Arab Emirates', code: '+971', flag: '🇦🇪' },
];

const THEME = {
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: '#EFF6FF',
  background: '#F8FAFC',
  card: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  border: '#E2E8F0',
  errorBackground: '#FEF2F2',
  errorBorder: '#FECACA',
  errorText: '#DC2626',
  success: '#16A34A',
};

// Step progress dots and lines component
const StepProgress = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { num: 1, label: 'Account\nType' },
    { num: 2, label: 'Shop\nInformation' },
    { num: 3, label: 'Owner\nDetails' },
    { num: 4, label: 'Password\nSetup' },
    { num: 5, label: 'Complete' },
  ];

  return (
    <View style={styles.stepProgressContainer}>
      <View style={styles.stepLinesRow}>
        {/* Background base grey line */}
        <View style={styles.stepLineBg} />
        {/* Foreground active blue line overlay */}
        <View style={[styles.stepLineActive, { width: `${((Math.min(5, currentStep) - 1) / 4) * 88 + 6}%` }]} />
        
        {steps.map((s) => {
          const isActive = s.num === currentStep;
          const isCompleted = s.num < currentStep;
          return (
            <View key={s.num} style={styles.stepCircleWrapper}>
              <View style={[
                styles.stepCircle,
                isActive && styles.stepCircleActive,
                isCompleted && styles.stepCircleCompleted
              ]}>
                {isCompleted ? (
                  <MaterialIcons name="check" size={14} color="#ffffff" />
                ) : (
                  <Text style={[
                    styles.stepCircleText,
                    isActive && styles.stepCircleTextActive,
                    isCompleted && styles.stepCircleTextCompleted
                  ]}>{s.num}</Text>
                )}
              </View>
              <Text style={[
                styles.stepLabel,
                isActive && styles.stepLabelActive,
                isCompleted && styles.stepLabelCompleted
              ]}>{s.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export default function SignupScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, []);

  // Wizard state: ranges from 1 to 5
  const [currentStep, setCurrentStep] = useState(1);

  // Signup Mode: 'new_store' | 'join_store'
  const [signupMode, setSignupMode] = useState<'new_store' | 'join_store'>('new_store');

  // Step 2: New Store Form states
  const [shopName, setShopName] = useState('');
  const [shopCategory, setShopCategory] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');

  // Step 2: Join Existing Store Form states
  const [joinStoreId, setJoinStoreId] = useState('');
  const [joinRole, setJoinRole] = useState<'cashier' | 'manager'>('cashier');
  const [verifiedStore, setVerifiedStore] = useState<{ id: string; name: string; category: string } | null>(null);
  const [isVerifyingStore, setIsVerifyingStore] = useState(false);
  const [storeVerifyError, setStoreVerifyError] = useState('');

  // Step 3: Owner Details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+91');

  // Step 4: Security
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Modals & navigation loader states
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Animation values for content slides
  const contentFadeAnim = useRef(new Animated.Value(1)).current;
  const contentTranslateX = useRef(new Animated.Value(0)).current;

  // Real-time verify Join Code / Store ID
  const handleVerifyJoinCode = async (code: string) => {
    const clean = code.trim().toUpperCase();
    setJoinStoreId(clean);
    setStoreVerifyError('');
    setVerifiedStore(null);

    if (!clean || clean.length < 3) return;

    setIsVerifyingStore(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/stores/verify/${encodeURIComponent(clean)}`);
      if (response.ok) {
        const data = await response.json();
        setVerifiedStore(data);
        setStoreVerifyError('');
      } else {
        setVerifiedStore(null);
        setStoreVerifyError('No store found with this Join Code');
      }
    } catch {
      setVerifiedStore(null);
      setStoreVerifyError('Unable to verify store code. Check your connection.');
    } finally {
      setIsVerifyingStore(false);
    }
  };

  // Animate step transition
  const animateStepTransition = (nextStep: number) => {
    // Slide left and fade out
    Animated.parallel([
      Animated.timing(contentFadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(contentTranslateX, {
        toValue: -30,
        duration: 150,
        useNativeDriver: true,
      })
    ]).start(() => {
      setCurrentStep(nextStep);
      setErrorMessage('');
      
      // Reset position to right and slide back in
      contentTranslateX.setValue(30);
      Animated.parallel([
        Animated.timing(contentFadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateX, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      ]).start();
    });
  };

  // Custom step validation before continuing
  const handleContinue = async () => {
    setErrorMessage('');

    if (currentStep === 1) {
      animateStepTransition(2);
      return;
    }

    if (currentStep === 2) {
      if (signupMode === 'new_store') {
        if (!shopName.trim()) {
          setErrorMessage('Please enter your Shop Name.');
          return;
        }
        if (!shopCategory) {
          setErrorMessage('Please select a Shop Category.');
          return;
        }
      } else {
        if (!joinStoreId.trim()) {
          setErrorMessage('Please enter the Store ID / Join Code.');
          return;
        }
        if (!verifiedStore) {
          setErrorMessage('Please enter a valid, verified Store ID.');
          return;
        }
      }
      animateStepTransition(3);
      return;
    }

    if (currentStep === 3) {
      if (!fullName.trim()) {
        setErrorMessage('Please enter your Full Name.');
        return;
      }
      if (!email.trim()) {
        setErrorMessage('Please enter your Email Address.');
        return;
      }
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email.trim())) {
        setErrorMessage('Please enter a valid Email Address.');
        return;
      }
      if (!phone.trim() || phone.trim().length !== 10) {
        setErrorMessage('Phone number must be exactly 10 digits.');
        return;
      }
      animateStepTransition(4);
      return;
    }

    if (currentStep === 4) {
      if (!password || !confirmPassword) {
        setErrorMessage('Please fill in both password fields.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      // Execute signup submission
      await submitSignup();
    }
  };

  const handleBack = () => {
    if (currentStep === 5) return; // Complete page cannot go back
    if (currentStep > 1) {
      // Slide right and fade out
      Animated.parallel([
        Animated.timing(contentFadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(contentTranslateX, {
          toValue: 30,
          duration: 150,
          useNativeDriver: true,
        })
      ]).start(() => {
        setCurrentStep(currentStep - 1);
        setErrorMessage('');
        
        // Reset position to left and slide back in
        contentTranslateX.setValue(-30);
        Animated.parallel([
          Animated.timing(contentFadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(contentTranslateX, {
            toValue: 0,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          })
        ]).start();
      });
    } else {
      router.back();
    }
  };

  const submitSignup = async () => {
    setIsLoading(true);
    try {
      const payload: any = {
        owner_name: fullName.trim(),
        phone: `${countryCode} ${phone.trim()}`,
        email_or_username: email.trim().toLowerCase(),
        password: password,
      };

      if (signupMode === 'new_store') {
        payload.shop_name = shopName.trim();
        payload.shop_category = shopCategory;
        if (gstNumber.trim()) payload.gst_number = gstNumber.trim();
        if (businessAddress.trim()) payload.business_address = businessAddress.trim();
      } else {
        payload.store_id = joinStoreId.trim().toUpperCase();
        payload.role = joinRole;
      }

      const response = await fetch(`${API_BASE_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setIsLoading(false);

      if (!response.ok) {
        const errData = await response.json();
        setErrorMessage(errData.detail || 'Signup failed. Please try again.');
        return;
      }

      // Successful signup, move to complete screen
      animateStepTransition(5);
    } catch (err) {
      console.warn("Signup request failed:", err);
      setIsLoading(false);
      setErrorMessage('Unable to reach the server. Check your connection.');
    }
  };

  // Render Wizard Pages
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <View style={styles.stepBlock}>
            <Text style={styles.stepTitle}>Choose Account Type</Text>
            <Text style={styles.stepSubtitle}>Select how you want to start with SmartPOS</Text>

            {/* Register new store card */}
            <TouchableOpacity
              style={[styles.radioCard, signupMode === 'new_store' && styles.radioCardActive]}
              onPress={() => setSignupMode('new_store')}
              activeOpacity={0.8}
            >
              <View style={[styles.radioIconBox, signupMode === 'new_store' && styles.radioIconBoxActive]}>
                <MaterialIcons name="storefront" size={24} color={signupMode === 'new_store' ? '#2563eb' : '#64748b'} />
              </View>
              <View style={styles.radioTextBox}>
                <Text style={[styles.radioTitle, signupMode === 'new_store' && styles.radioTitleActive]}>Register New Store</Text>
                <Text style={styles.radioDescription}>Create a new store and start managing your business</Text>
              </View>
              <MaterialIcons
                name={signupMode === 'new_store' ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={signupMode === 'new_store' ? '#2563eb' : '#cbd5e1'}
              />
            </TouchableOpacity>

            {/* Join existing store card */}
            <TouchableOpacity
              style={[styles.radioCard, signupMode === 'join_store' && styles.radioCardActive]}
              onPress={() => setSignupMode('join_store')}
              activeOpacity={0.8}
            >
              <View style={[styles.radioIconBox, signupMode === 'join_store' && styles.radioIconBoxActive]}>
                <MaterialIcons name="people-outline" size={24} color={signupMode === 'join_store' ? '#2563eb' : '#64748b'} />
              </View>
              <View style={styles.radioTextBox}>
                <Text style={[styles.radioTitle, signupMode === 'join_store' && styles.radioTitleActive]}>Join with Store ID</Text>
                <Text style={styles.radioDescription}>Already have a store? Join with your store ID</Text>
              </View>
              <MaterialIcons
                name={signupMode === 'join_store' ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={signupMode === 'join_store' ? '#2563eb' : '#cbd5e1'}
              />
            </TouchableOpacity>
          </View>
        );

      case 2:
        return signupMode === 'new_store' ? (
          <View style={styles.stepBlock}>
            <Text style={styles.stepTitle}>Shop Information</Text>
            <Text style={styles.stepSubtitle}>Enter details of the shop you want to register</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Shop Name *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                  placeholder="Enter business / shop name"
                  placeholderTextColor="#94a3b8"
                  value={shopName}
                  onChangeText={(text) => {
                    setShopName(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Category *</Text>
              <TouchableOpacity
                style={[styles.inputWrapper, styles.dropdownTrigger]}
                onPress={() => setShowCategoryModal(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.dropdownText, { color: shopCategory ? THEME.textPrimary : '#94a3b8' }]}>
                  {shopCategory
                    ? categories.find((c) => c.value === shopCategory)?.label
                    : 'Select Shop Category'}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>GST Number (Optional)</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                  placeholder="Enter GSTIN (optional)"
                  placeholderTextColor="#94a3b8"
                  value={gstNumber}
                  onChangeText={setGstNumber}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Business Address (Optional)</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                  placeholder="Enter street, area, city"
                  placeholderTextColor="#94a3b8"
                  value={businessAddress}
                  onChangeText={setBusinessAddress}
                />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.stepBlock}>
            <Text style={styles.stepTitle}>Enter Store ID</Text>
            <Text style={styles.stepSubtitle}>Provide the join code issued by your store owner</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Store ID / Join Code *</Text>
              <View style={[styles.inputWrapper, verifiedStore && styles.inputWrapperSuccess]}>
                <TextInput
                  style={[styles.input, { letterSpacing: 1.5, fontWeight: '700' }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                  placeholder="Enter store ID / join code"
                  placeholderTextColor="#94a3b8"
                  value={joinStoreId}
                  onChangeText={handleVerifyJoinCode}
                  autoCapitalize="characters"
                />
                {isVerifyingStore ? (
                  <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 8 }} />
                ) : verifiedStore ? (
                  <MaterialIcons name="check-circle" size={22} color="#16a34a" style={{ marginRight: 8 }} />
                ) : null}
              </View>

              {verifiedStore ? (
                <View style={styles.verifiedBadge}>
                  <MaterialIcons name="store" size={16} color="#16a34a" />
                  <Text style={styles.verifiedBadgeText}>
                    Verified: <Text style={{ fontWeight: '700' }}>{verifiedStore.name}</Text>
                  </Text>
                </View>
              ) : storeVerifyError && joinStoreId.length >= 3 ? (
                <Text style={styles.verifyErrorText}>⚠️ {storeVerifyError}</Text>
              ) : null}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Select Your Role</Text>
              <View style={styles.rolePickerRow}>
                <TouchableOpacity
                  style={[styles.roleChip, joinRole === 'cashier' && styles.roleChipActive]}
                  onPress={() => setJoinRole('cashier')}
                >
                  <MaterialIcons
                    name="point-of-sale"
                    size={16}
                    color={joinRole === 'cashier' ? '#2563eb' : '#64748b'}
                  />
                  <Text style={[styles.roleChipText, joinRole === 'cashier' && styles.roleChipTextActive]}>
                    Cashier
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleChip, joinRole === 'manager' && styles.roleChipActive]}
                  onPress={() => setJoinRole('manager')}
                >
                  <MaterialIcons
                    name="manage-accounts"
                    size={16}
                    color={joinRole === 'manager' ? '#2563eb' : '#64748b'}
                  />
                  <Text style={[styles.roleChipText, joinRole === 'manager' && styles.roleChipTextActive]}>
                    Manager
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepBlock}>
            <Text style={styles.stepTitle}>Owner Details</Text>
            <Text style={styles.stepSubtitle}>Provide personal details to secure your profile</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                  placeholder="Enter your full name"
                  placeholderTextColor="#94a3b8"
                  value={fullName}
                  onChangeText={(text) => {
                    setFullName(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                  placeholder="Enter your email address"
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Phone Number *</Text>
              <View style={[styles.inputWrapper, { paddingHorizontal: 0 }]}>
                <TouchableOpacity
                  style={styles.countryCodeSelector}
                  onPress={() => setShowCountryModal(true)}
                >
                  <Text style={styles.countryCodeText}>{countryCode}</Text>
                  <MaterialIcons name="arrow-drop-down" size={20} color="#64748b" />
                </TouchableOpacity>
                <View style={styles.verticalDivider} />
                <TextInput
                  style={[styles.input, { paddingHorizontal: 12 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                  placeholder="Enter 10-digit mobile number"
                  placeholderTextColor="#94a3b8"
                  value={phone}
                  onChangeText={(text) => {
                    const clean = text.replace(/[^0-9]/g, '').slice(0, 10);
                    setPhone(clean);
                    if (errorMessage) setErrorMessage('');
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepBlock}>
            <Text style={styles.stepTitle}>Password Setup</Text>
            <Text style={styles.stepSubtitle}>Create a secure password for logging in</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Password *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                  placeholder="Create a secure password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm Password *</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                  placeholder="Confirm your password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errorMessage) setErrorMessage('');
                  }}
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>
        );

      case 5:
        return (
          <View style={[styles.stepBlock, styles.successBlock]}>
            <View style={styles.successIconOuter}>
              <View style={styles.successIconInner}>
                <MaterialIcons name="check" size={48} color="#ffffff" />
              </View>
            </View>
            <Text style={styles.successTitle}>Account Created!</Text>
            <Text style={styles.successSubtitle}>
              {signupMode === 'new_store'
                ? `Your store "${shopName}" is registered. You are logged as Owner.`
                : `You joined store successfully. Profile role: ${joinRole.toUpperCase()}`}
            </Text>
            <Text style={styles.successMeta}>
              Please return to the login screen and log in with your email or username to start.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      
      {/* Decorative Wave Background (100% matching mockup gradients) */}
      <View style={styles.waveBackground} pointerEvents="none">
        <Svg width="100%" height={240} viewBox="0 0 375 240" fill="none" style={styles.topWave} preserveAspectRatio="none">
          <Path d="M 0 0 H 375 V 170 Q 250 240 120 180 T 0 160 Z" fill="url(#top-grad)" opacity={0.8} />
          <Defs>
            <LinearGradient id="top-grad" x1="0.5" y1="0" x2="1" y2="1">
              <Stop offset="0%" stopColor="#dbeafe" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="#eff6ff" stopOpacity="0.9" />
            </LinearGradient>
          </Defs>
        </Svg>
        <Svg width="100%" height={140} viewBox="0 0 375 240" fill="none" style={styles.bottomWave} preserveAspectRatio="none">
          <Path d="M 0 240 H 375 V 70 Q 250 0 120 60 T 0 80 Z" fill="url(#bottom-grad)" opacity={0.8} />
          <Defs>
            <LinearGradient id="bottom-grad" x1="0.5" y1="1" x2="0.5" y2="0">
              <Stop offset="0%" stopColor="#dbeafe" stopOpacity="0.65" />
              <Stop offset="100%" stopColor="#eff6ff" stopOpacity="0.85" />
            </LinearGradient>
          </Defs>
        </Svg>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.avoidingContainer}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        >
        <View style={styles.formContainer}>
          
          {/* Top Bar with Floating Back Arrow and Centered Logo */}
          <View style={styles.topBarContainer}>
            {currentStep < 5 && (
              <TouchableOpacity
                style={styles.backArrowButton}
                onPress={handleBack}
                accessibilityLabel="Go back"
              >
                <MaterialIcons name="chevron-left" size={32} color={THEME.textPrimary} />
              </TouchableOpacity>
            )}
            
            {currentStep < 5 && (
              <View style={styles.brandingHeader}>
                <View style={styles.logoRow}>
                  <Svg width={28} height={28} viewBox="0 0 28 28" style={{ marginRight: 6 }}>
                    <Path
                      d="M 3 6 H 7.5 L 9.8 17.5 H 21.5 L 23.5 9 H 8.5"
                      stroke="#2563eb"
                      strokeWidth={2.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                    <Circle cx={11.5} cy={22.5} r={2.2} fill="#2563eb" />
                    <Circle cx={19.5} cy={22.5} r={2.2} fill="#2563eb" />
                  </Svg>
                  <Text style={styles.logoText}>Smart<Text style={{ color: '#1e293b', fontWeight: '800' }}>POS</Text></Text>
                </View>
                <Text style={styles.brandPrompt}>Create your account to get started</Text>
              </View>
            )}
          </View>

          {/* 5-step Horizontal Progress bar */}
          <StepProgress currentStep={currentStep} />

          {/* Inline shakeable error banner */}
          {errorMessage ? (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Wizard Card containing content & buttons inside (mockup alignment) */}
          <Animated.View
            style={[
              styles.wizardCard,
              {
                opacity: contentFadeAnim,
                transform: [{ translateX: contentTranslateX }],
              },
            ]}
          >
            {renderStepContent()}

            {/* Step navigation triggers moved inside the card box container */}
            <View style={styles.actionAreaInside}>
              {currentStep < 5 ? (
                <TouchableOpacity
                  style={[styles.primaryButton, isLoading && { opacity: 0.8 }]}
                  onPress={handleContinue}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <View style={styles.btnContent}>
                      <Text style={styles.primaryButtonText}>
                        {currentStep === 4 ? 'Submit Details' : 'Continue'}
                      </Text>
                      <MaterialIcons name="arrow-forward" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
                    </View>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => router.replace('/login')}
                  activeOpacity={0.8}
                >
                  <View style={styles.btnContent}>
                    <Text style={styles.primaryButtonText}>Go to Sign In</Text>
                    <MaterialIcons name="login" size={18} color="#ffffff" style={{ marginLeft: 6 }} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Category Selection Modal */}
      <Modal
        visible={showCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCategoryModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="category" size={22} color="#2563eb" />
                <Text style={styles.modalTitle}>Select Shop Category</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCategoryModal(false)} style={styles.modalCloseBtn}>
                <MaterialIcons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {categories.map((item) => {
                const isSelected = shopCategory === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                    onPress={() => {
                      setShopCategory(item.value);
                      setShowCategoryModal(false);
                      if (errorMessage) setErrorMessage('');
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={[styles.modalOptionIconBox, isSelected && styles.modalOptionIconBoxSelected]}>
                        <MaterialIcons
                          name={item.icon as any}
                          size={18}
                          color={isSelected ? '#2563eb' : '#64748b'}
                        />
                      </View>
                      <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                        {item.label}
                      </Text>
                    </View>
                    {isSelected && (
                      <MaterialIcons name="check-circle" size={20} color="#2563eb" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Country Code Modal Selection */}
      <Modal
        visible={showCountryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCountryModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCountryModal(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MaterialIcons name="flag" size={22} color="#2563eb" />
                <Text style={styles.modalTitle}>Select Country Code</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCountryModal(false)} style={styles.modalCloseBtn}>
                <MaterialIcons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {countryCodes.map((item) => {
                const isSelected = countryCode === item.code;
                return (
                  <TouchableOpacity
                    key={item.code}
                    style={[styles.modalOption, isSelected && styles.modalOptionSelected]}
                    onPress={() => {
                      setCountryCode(item.code);
                      setShowCountryModal(false);
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Text style={{ fontSize: 20 }}>{item.flag}</Text>
                      <Text style={[styles.modalOptionText, isSelected && styles.modalOptionTextSelected]}>
                        {item.name} ({item.code})
                      </Text>
                    </View>
                    {isSelected && (
                      <MaterialIcons name="check-circle" size={20} color="#2563eb" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#ffffff', // Clean white background matching design
  },
  waveBackground: {
    ...StyleSheet.absoluteFill,
    zIndex: 0,
  },
  topWave: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomWave: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  formContainer: {
    width: '100%',
    maxWidth: 500,
    gap: 16,
  },
  topBarContainer: {
    flexDirection: 'row',
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 5,
  },
  backArrowButton: {
    position: 'absolute',
    left: -8,
    top: -2,
    padding: 4,
    zIndex: 2,
  },
  brandingHeader: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 26,
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: -0.5,
  },
  brandPrompt: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 4,
  },
  stepProgressContainer: {
    width: '100%',
    paddingVertical: 8,
    marginBottom: 8,
  },
  stepLinesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    width: '100%',
  },
  stepLineBg: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    height: 2,
    backgroundColor: '#e2e8f0',
    top: 14,
    zIndex: 1,
  },
  stepLineActive: {
    position: 'absolute',
    left: '8%',
    height: 2,
    backgroundColor: '#2563eb',
    top: 14,
    zIndex: 2,
  },
  stepCircleWrapper: {
    alignItems: 'center',
    zIndex: 3,
    width: '18%',
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    borderColor: '#2563eb',
    backgroundColor: '#ffffff',
  },
  stepCircleCompleted: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  stepCircleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  stepCircleTextActive: {
    color: '#2563eb',
  },
  stepCircleTextCompleted: {
    color: '#ffffff',
  },
  stepLabel: {
    fontSize: 10,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 12,
    fontWeight: '600',
  },
  stepLabelActive: {
    color: '#2563eb',
    fontWeight: '700',
  },
  stepLabelCompleted: {
    color: '#0f172a',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.errorBackground,
    borderWidth: 1,
    borderColor: THEME.errorBorder,
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  errorText: {
    color: THEME.errorText,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  wizardCard: {
    width: '100%',
    marginVertical: 10,
  },
  stepBlock: {
    width: '100%',
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  stepSubtitle: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginBottom: 24,
    fontWeight: '500',
  },
  radioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 18,
    backgroundColor: '#ffffff',
    marginBottom: 14,
  },
  radioCardActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  radioIconBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#eff6ff', // Mockup light blue-grey background tint
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  radioIconBoxActive: {
    backgroundColor: '#dbeafe',
  },
  radioTextBox: {
    flex: 1,
    paddingRight: 6,
  },
  radioTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 2,
  },
  radioTitleActive: {
    color: '#2563eb',
  },
  radioDescription: {
    fontSize: 12.5,
    color: THEME.textSecondary,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 16,
    width: '100%',
  },
  inputLabel: {
    fontSize: 13,
    color: THEME.textPrimary,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    height: 48,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
  },
  inputWrapperSuccess: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: THEME.textPrimary,
    padding: 0,
    borderWidth: 0,
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
    textAlignVertical: 'center',
  },
  dropdownTrigger: {
    justifyContent: 'space-between',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
    paddingHorizontal: 4,
  },
  verifiedBadgeText: {
    fontSize: 12,
    color: '#16a34a',
    fontWeight: '600',
  },
  verifyErrorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
  rolePickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  roleChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    gap: 6,
  },
  roleChipActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  roleChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  roleChipTextActive: {
    color: '#2563eb',
  },
  countryCodeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: '100%',
  },
  countryCodeText: {
    fontSize: 15,
    color: THEME.textPrimary,
    marginRight: 2,
    fontWeight: '600',
  },
  verticalDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e2e8f0',
  },
  eyeIcon: {
    padding: 4,
  },
  successBlock: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  successIconOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successIconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  successMeta: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 12,
  },
  actionAreaInside: {
    width: '100%',
    marginTop: 18,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: 'rgba(37, 99, 235, 0.25)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 3,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  loginLink: {
    paddingVertical: 6,
  },
  loginLinkLabel: {
    fontSize: 14,
    color: THEME.textSecondary,
  },
  loginLinkText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    backgroundColor: '#f8fafc',
  },
  modalOptionSelected: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  modalOptionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionIconBoxSelected: {
    backgroundColor: '#dbeafe',
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#475569',
  },
  modalOptionTextSelected: {
    color: '#2563eb',
    fontWeight: '700',
  },
  avoidingContainer: {
    flex: 1,
    zIndex: 1,
  },
});
