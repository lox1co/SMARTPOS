import { store } from "@/constants/store";
import { i18n, i18nReady } from "@/i18n";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { LogBox, StyleSheet, View } from "react-native";
import "react-native-reanimated";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";

LogBox.ignoreLogs([
  "expo-notifications: Android Push notifications",
  "`expo-notifications` functionality is not fully supported in Expo Go",
  "Android Push notifications (remote notifications) functionality provided by expo-notifications was removed",
]);

// Public routes that should never trigger a redirect loop.
const PUBLIC_ROUTES = ["index", "login", "signup"];

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [translationsReady, setTranslationsReady] = useState(i18n.isInitialized);

  useEffect(() => {
    let mounted = true;
    void i18nReady.then(() => {
      if (mounted) setTranslationsReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // ─── Fix 3: Global auth guard ────────────────────────────────────────────
  // Subscribes at the root level so every screen — including non-tab stack
  // screens (transactions, reports, customers) — is protected. When
  // handleUnauthorized() fires notify() from the store (e.g. a 401 response),
  // this listener immediately routes back to /login.
  useEffect(() => {
    const checkAuth = () => {
      const currentRoute = segments[segments.length - 1] ?? "";
      const isPublic = PUBLIC_ROUTES.includes(currentRoute);
      if (!isPublic && !store.currentUser?.token) {
        router.replace("/login");
      }
    };
    const unsubscribe = store.subscribe(checkAuth);
    return unsubscribe;
  }, [router, segments]);

  return (
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View style={styles.root}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="scanner" options={{ presentation: "modal" }} />
            <Stack.Screen name="add_product" options={{ presentation: "modal" }} />
            <Stack.Screen name="transactions" />
            <Stack.Screen name="reports" />
            <Stack.Screen name="customers" />
            <Stack.Screen name="about" />
            <Stack.Screen name="faq" />
            <Stack.Screen name="contact" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="terms" />
            <Stack.Screen name="store_info" />
            <Stack.Screen name="shop_category" />
            <Stack.Screen name="shop_gst" />
            <Stack.Screen name="shop_address" />
            <Stack.Screen name="shop_phone" />
            <Stack.Screen name="shop_email" />
            <Stack.Screen name="settings" />
          </Stack>
          {!translationsReady && <View pointerEvents="none" style={styles.i18nBootstrap} />}
          {/* Dark icons for the app's light backgrounds. */}
          <StatusBar style="dark" />
        </View>
      </SafeAreaProvider>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  i18nBootstrap: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#F8FAFC",
  },
});
