import { LocalizedAlert as Alert, LocalizedText as Text, LocalizedTextInput as TextInput, LocalizedTouchableOpacity as TouchableOpacity } from '@/components/i18n/LocalizedControls';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Pressable, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Easing, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path, Circle, Ellipse, Defs, LinearGradient, Stop } from 'react-native-svg';
import { API_BASE_URL } from '@/constants/config';
import { store } from '@/constants/store';

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

const TerminalIllustration = () => (
  <Svg width={110} height={100} viewBox="0 0 110 100">
    <Ellipse cx={55} cy={82} rx={32} ry={6} fill="rgba(37, 99, 235, 0.1)" />
    <Path d="M 42 62 L 68 62 L 62 80 L 48 80 Z" fill="#cbd5e1" />
    <Path d="M 42 62 L 48 80 L 45 80 L 39 62 Z" fill="#94a3b8" />
    <Path d="M 36 38 L 74 38 L 70 65 L 40 65 Z" fill="#1e293b" />
    <Path d="M 68 25 L 82 25 L 78 40 L 64 40 Z" fill="#0f172a" />
    <Path d="M 69 12 C 69 12, 70 8, 73 8 H 83 C 86 8, 87 12, 87 12 V 25 H 69 Z" fill="#ffffff" />
    <Path d="M 72 15 H 84" stroke="#e2e8f0" strokeWidth={1} />
    <Path d="M 72 19 H 80" stroke="#e2e8f0" strokeWidth={1} />
    <Path d="M 28 32 C 28 30, 30 28, 33 28 H 77 C 80 28, 82 30, 82 32 V 62 C 82 64, 80 66, 77 66 H 33 C 30 66, 28 64, 28 62 Z" fill="#2563eb" />
    <Path d="M 31 34 H 79 V 60 H 31 Z" fill="#0f172a" />
    <Path d="M 33 36 H 77 V 57 H 33 Z" fill="#eff6ff" />
    <Circle cx={55} cy={46} r={6} fill="#dbeafe" />
    <Path d="M 52 43 H 53.5 L 55 47.5 H 58.5 L 59.5 45" stroke="#2563eb" strokeWidth={1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={55} cy={49.5} r={0.8} fill="#2563eb" />
    <Circle cx={57.5} cy={49.5} r={0.8} fill="#2563eb" />
    <Path d="M 18 20 L 23 24" stroke="#2563eb" strokeWidth={2.5} strokeLinecap="round" />
    <Path d="M 14 31 H 21" stroke="#2563eb" strokeWidth={2.5} strokeLinecap="round" />
    <Path d="M 18 42 L 23 38" stroke="#2563eb" strokeWidth={2.5} strokeLinecap="round" />
  </Svg>
);

export default function LoginScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const fadeContent = useRef(new Animated.Value(0)).current;
  const translateContentY = useRef(new Animated.Value(20)).current;
  const fadeHeader = useRef(new Animated.Value(0)).current;
  const translateHeaderY = useRef(new Animated.Value(-15)).current;

  const emailFocusAnim = useRef(new Animated.Value(0)).current;
  const passwordFocusAnim = useRef(new Animated.Value(0)).current;

  const buttonPressScale = useRef(new Animated.Value(1)).current;
  const errorOpacityAnim = useRef(new Animated.Value(0)).current;
  const errorTranslateY = useRef(new Animated.Value(-8)).current;
  const errorShakeAnim = useRef(new Animated.Value(0)).current;

  const successOpacityAnim = useRef(new Animated.Value(0)).current;
  const successScaleAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeHeader, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(translateHeaderY, {
        toValue: 0,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fadeContent, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateContentY, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeContent, fadeHeader, translateContentY, translateHeaderY]);

  const triggerErrorShake = () => {
    errorShakeAnim.setValue(0);
    errorTranslateY.setValue(-8);
    errorOpacityAnim.setValue(0);

    Animated.parallel([
      Animated.timing(errorTranslateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(errorOpacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      Animated.sequence([
        Animated.timing(errorShakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
        Animated.timing(errorShakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
        Animated.timing(errorShakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
        Animated.timing(errorShakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
        Animated.timing(errorShakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    });
  };

  const showError = (message: string) => {
    setErrorMessage(message);
    triggerErrorShake();
  };

  const triggerSuccessSequence = (callback: () => void) => {
    setIsSuccess(true);
    Animated.parallel([
      Animated.timing(successOpacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(successScaleAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        Animated.timing(fadeContent, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(callback);
      }, 600);
    });
  };

  const animateInputFocus = (anim: Animated.Value, isFocused: boolean) => {
    Animated.timing(anim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleLogin = async () => {
    setErrorMessage('');
    if (!email || !password) {
      showError('Please fill in all fields.');
      return;
    }
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email) && email.length < 3) {
      showError('Please enter a valid email address or username.');
      return;
    }
    if (password.length < 6) {
      showError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_or_username: email.trim().toLowerCase(),
          password: password,
        }),
      });

      setIsLoading(false);

      if (!response.ok) {
        const errData = await response.json();
        showError(errData.detail || 'Login failed. Please check credentials.');
        return;
      }

      const data = await response.json();
      await store.login({
        id: data.id.toString(),
        storeId: data.store_id.toString(),
        userName: data.name,
        role: data.role || 'owner',
        shopName: data.shop_name || 'SmartPOS Store',
        shopCategory: data.shop_category || 'Retail',
        phone: data.phone || '',
        email: data.email_or_username,
        image: data.image || undefined,
        gstNumber: data.gst_number || undefined,
        businessAddress: data.business_address || undefined,
        storePhone: data.store_phone || data.phone || undefined,
        token: data.token,
      });

      triggerSuccessSequence(() => {
        router.replace('/(tabs)/dashboard');
      });
    } catch (err) {
      console.warn("Login request failed:", err);
      setIsLoading(false);
      showError('Unable to reach the server. Check your connection and try again.');
    }
  };

  const emailBorderColor = emailFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#dbeafe', THEME.primary],
  });

  const passwordBorderColor = passwordFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#dbeafe', THEME.primary],
  });

  const buttonScale = buttonPressScale.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.97],
  });

  return (
    <SafeAreaView style={styles.outerContainer} edges={['top', 'bottom']}>
      
      {/* Decorative Wave Background (100% Matching mockup gradients) */}
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
          scrollEnabled={true}
        >
          {/* Brand Logo & Visual Terminal Illustration */}
          <Animated.View
            style={[
              styles.headerRow,
              {
                opacity: fadeHeader,
                transform: [{ translateY: translateHeaderY }],
              },
            ]}
          >
            <View style={styles.logoAndTag}>
              <View style={styles.logoRow}>
                <Svg width={32} height={32} viewBox="0 0 28 28" style={{ marginRight: 8 }}>
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
                <Text style={styles.logoText}>
                  Smart<Text style={{ color: '#1e293b', fontWeight: '800' }}>POS</Text>
                </Text>
              </View>
              <Text style={styles.tagline}>Simple • Fast • Smart</Text>
            </View>

            {!isKeyboardVisible && <TerminalIllustration />}
          </Animated.View>

          {/* Form Content - Clean, borderless layout directly on background (like Mockup) */}
          <Animated.View
            style={[
              styles.formBlock,
              {
                opacity: fadeContent,
                transform: [{ translateY: translateContentY }],
              },
            ]}
          >
            {/* Header Text */}
            <View style={styles.formHeader}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Login to manage your store</Text>
            </View>

            {/* Error shakes banner */}
            {errorMessage ? (
              <Animated.View
                style={[
                  styles.errorContainer,
                  {
                    opacity: errorOpacityAnim,
                    transform: [
                      { translateY: errorTranslateY },
                      { translateX: errorShakeAnim },
                    ],
                  },
                ]}
                accessibilityRole="alert"
              >
                <MaterialIcons name="error-outline" size={20} color={THEME.errorText} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </Animated.View>
            ) : null}

            {/* Form Fields */}
            <View style={styles.formFields}>
              {/* Username field */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email or Username</Text>
                <Animated.View
                  style={[
                    styles.inputWrapper,
                    { borderColor: emailBorderColor },
                  ]}
                >
                  <MaterialIcons
                    name="mail-outline"
                    size={20}
                    color={isEmailFocused ? THEME.primary : THEME.textSecondary}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                    placeholder="Enter email or username"
                    placeholderTextColor={THEME.textSecondary}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errorMessage) setErrorMessage('');
                    }}
                    onFocus={() => {
                      animateInputFocus(emailFocusAnim, true);
                      setIsEmailFocused(true);
                    }}
                    onBlur={() => {
                      animateInputFocus(emailFocusAnim, false);
                      setIsEmailFocused(false);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                  />
                  {email.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => {
                        setEmail('');
                        setErrorMessage('');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Clear input"
                    >
                      <MaterialIcons name="cancel" size={18} color={THEME.textSecondary} />
                    </TouchableOpacity>
                  )}
                </Animated.View>
              </View>

              {/* Password field */}
              <View style={styles.inputGroup}>
                <View style={styles.passwordLabelRow}>
                  <Text style={styles.inputLabel}>Password</Text>
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        'Reset Password',
                        'To reset your password, contact your store owner or manager. They can update it for you from staff profiles.',
                        [{ text: 'OK' }]
                      )
                    }
                    accessibilityRole="link"
                    accessibilityLabel="Forgot Password Link"
                  >
                    <Text style={styles.forgotPassword}>Forgot Password?</Text>
                  </Pressable>
                </View>

                <Animated.View
                  style={[
                    styles.inputWrapper,
                    { borderColor: passwordBorderColor },
                  ]}
                >
                  <MaterialIcons
                    name="lock-outline"
                    size={20}
                    color={isPasswordFocused ? THEME.primary : THEME.textSecondary}
                    style={{ marginRight: 10 }}
                  />
                  <TextInput
                    style={[styles.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as any)]}
                    placeholder="Enter your password"
                    placeholderTextColor={THEME.textSecondary}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errorMessage) setErrorMessage('');
                    }}
                    onFocus={() => {
                      animateInputFocus(passwordFocusAnim, true);
                      setIsPasswordFocused(true);
                    }}
                    onBlur={() => {
                      animateInputFocus(passwordFocusAnim, false);
                      setIsPasswordFocused(false);
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />

                  <TouchableOpacity
                    onPress={toggleShowPassword}
                    style={styles.eyeIcon}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <MaterialIcons
                      name={showPassword ? 'visibility' : 'visibility-off'}
                      size={20}
                      color={THEME.textSecondary}
                    />
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* Sign In Button (Pill Blue button with Arrow Icon on the left) */}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Sign In"
                disabled={isLoading || isSuccess}
                onPress={handleLogin}
                activeOpacity={0.8}
              >
                <Animated.View
                  style={[
                    styles.primaryButton,
                    { transform: [{ scale: buttonScale }] },
                    (isLoading || isSuccess) && styles.primaryButtonDisabled,
                  ]}
                >
                  {isSuccess ? (
                    <Animated.View
                      style={{
                        transform: [{ scale: successScaleAnim }],
                        opacity: successOpacityAnim,
                      }}
                    >
                      <MaterialIcons name="check" size={24} color="#FFFFFF" />
                    </Animated.View>
                  ) : isLoading ? (
                    <View style={styles.loadingButtonContent}>
                      <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryButtonText}>Signing in...</Text>
                    </View>
                  ) : (
                    <View style={styles.buttonContent}>
                      <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.primaryButtonText}>Sign In</Text>
                    </View>
                  )}
                </Animated.View>
              </TouchableOpacity>

              {/* Sign Up Redirect with lines divider */}
              <View style={styles.signUpDividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.footerText}>
                  Don&apos;t have an account?{' '}
                  <Text style={styles.footerLink} onPress={() => router.push('/signup')}>
                    Create Account
                  </Text>
                </Text>
                <View style={styles.dividerLine} />
              </View>
            </View>
          </Animated.View>

          {/* Secure & Trusted bottom banner with SVG outline check checkmark shield */}
          {!isKeyboardVisible && (
            <View style={styles.secureFooter} pointerEvents="none">
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
                <Path d="M 12 2 L 4 5 V 11 C 4 16.5 7.4 21.7 12 23 C 16.6 21.7 20 16.5 20 11 V 5 L 12 2 Z" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M 9 11 L 11 13 L 15 9" stroke="#2563eb" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <View style={styles.secureTextWrapper}>
                <Text style={styles.secureTitle}>Secure & Trusted</Text>
                <Text style={styles.secureSubtitle}>Your data is safe with us</Text>
              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
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
  avoidingContainer: {
    flex: 1,
    zIndex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 420,
    marginTop: 10,
    marginBottom: 15,
  },
  logoAndTag: {
    flex: 1,
    justifyContent: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563eb',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  formBlock: {
    width: '100%',
    maxWidth: 420,
    marginVertical: 10,
  },
  formHeader: {
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: THEME.textPrimary,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: THEME.textSecondary,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.errorBackground,
    borderWidth: 1,
    borderColor: THEME.errorBorder,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  errorText: {
    color: THEME.errorText,
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  formFields: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 12,
    width: '100%',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: 8,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  forgotPassword: {
    fontSize: 14,
    fontWeight: '600',
    color: THEME.primary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dbeafe', // Mockup light blue border by default
    borderRadius: 12,
    height: 48, // Compact height for perfect page fitting
    backgroundColor: '#f5f8ff', // Match mockup background input tint
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 15,
    color: THEME.textPrimary,
    padding: 0,
    borderWidth: 0,
  },
  clearButton: {
    padding: 4,
  },
  eyeIcon: {
    padding: 4,
  },
  primaryButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
    shadowColor: 'rgba(37, 99, 235, 0.25)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  primaryButtonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signUpDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 12,
    opacity: 0.6,
  },
  footerText: {
    fontSize: 14,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.primary,
  },
  secureFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 6,
    width: '100%',
  },
  secureTextWrapper: {
    justifyContent: 'center',
  },
  secureTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  secureSubtitle: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 1,
  },
});
