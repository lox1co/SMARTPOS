import { LocalizedText as Text } from '@/components/i18n/LocalizedControls';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Dimensions, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { store } from '@/constants/store';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dot1Anim = useRef(new Animated.Value(1)).current;
  const dot2Anim = useRef(new Animated.Value(1)).current;
  const dot3Anim = useRef(new Animated.Value(1)).current;

  // Set up animations & redirect
  useEffect(() => {
    // 1. Entrance Fade-in and Slide-up
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Continuous Logo Pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.96,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 3. Continuous Dot Pulse sequence
    const createDotLoop = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: 0.25,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    Animated.parallel([
      createDotLoop(dot1Anim, 0),
      createDotLoop(dot2Anim, 150),
      createDotLoop(dot3Anim, 300),
    ]).start();

    // 4. Once the persisted session (if any) is restored, route accordingly.
    let cancelled = false;
    const minDelay = new Promise<void>((resolve) => setTimeout(resolve, 2200));
    (async () => {
      const [loggedIn] = await Promise.all([store.isLoggedIn(), minDelay]);
      if (cancelled) return;
      router.replace(loggedIn ? '/(tabs)/dashboard' : '/login');
    })();

    return () => {
      cancelled = true;
    };
  }, [fadeAnim, slideAnim, pulseAnim, dot1Anim, dot2Anim, dot3Anim, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar style="dark" />

      {/* Decorative Light Background Glows */}
      <View style={styles.backgroundContainer} pointerEvents="none">
        <View style={styles.glowTopRight} />
        <View style={styles.glowBottomLeft} />
      </View>

      <Animated.View
        style={[
          styles.mainContent,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Brand Logo Image Card */}
        <Animated.View
          style={[
            styles.logoCard,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Brand Name matching Login Page */}
        <Text style={styles.brandTitle}>
          Smart<Text style={styles.brandTitleAccent}>POS</Text>
        </Text>

        {/* Tagline */}
        <Text style={styles.tagline}>Simple • Fast • Smart</Text>
      </Animated.View>

      {/* Loading Indicator */}
      <View style={styles.loadingContainer}>
        <View style={styles.dotsRow}>
          <Animated.View style={[styles.dot, { opacity: dot1Anim }]} />
          <Animated.View style={[styles.dot, { opacity: dot2Anim }]} />
          <Animated.View style={[styles.dot, { opacity: dot3Anim }]} />
        </View>
        <Text style={styles.loadingText}>Initializing System</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    zIndex: 0,
  },
  glowTopRight: {
    position: 'absolute',
    top: -SCREEN_HEIGHT * 0.08,
    right: -SCREEN_WIDTH * 0.15,
    width: SCREEN_WIDTH * 0.85,
    height: SCREEN_WIDTH * 0.85,
    borderRadius: SCREEN_WIDTH * 0.45,
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -SCREEN_HEIGHT * 0.08,
    left: -SCREEN_WIDTH * 0.15,
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75,
    borderRadius: SCREEN_WIDTH * 0.4,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
  },
  mainContent: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  logoCard: {
    width: 176,
    height: 176,
    backgroundColor: '#ffffff',
    borderRadius: 42,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 26,
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    fontSize: 40,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  brandTitleAccent: {
    color: '#0F172A',
    fontWeight: '800',
  },
  tagline: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.2,
    paddingHorizontal: 32,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 64,
    alignItems: 'center',
    zIndex: 10,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563EB',
  },
  loadingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
});
