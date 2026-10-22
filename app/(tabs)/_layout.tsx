import { store } from "@/constants/store";
import { Palette } from "@/constants/theme";
import { MaterialIcons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // ─── Fix 2: Auth guard with immediate mount check ────────────────────────
  // The root _layout.tsx handles the reactive (notify-driven) redirect for all
  // screens. This useEffect adds an *immediate* check on mount so the tab UI
  // never flashes for a split second before the first notify fires.
  useEffect(() => {
    // Immediate check: if the token is already gone when the tabs mount, bail
    // straight to /login without waiting for the next store notification.
    if (!store.currentUser?.token) {
      router.replace("/login");
      return;
    }
    // Reactive check: keep watching for mid-session expiry / logout events.
    const checkAuth = () => {
      if (!store.currentUser?.token) {
        router.replace("/login");
      }
    };
    const unsubscribe = store.subscribe(checkAuth);
    return unsubscribe;
  }, [router]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Palette.primary,
        tabBarInactiveTintColor: Palette.textTertiary,
        headerShown: false,
        tabBarStyle: {
          height: 60 + insets.bottom,
          backgroundColor: Palette.surface,
          borderTopWidth: 1,
          borderTopColor: Palette.surfaceMuted,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: t("nav.dashboard"),
          tabBarIcon: ({ color, focused }) => <MaterialIcons name="dashboard" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: t("nav.billing"),
          tabBarIcon: ({ color }) => <MaterialIcons name="point-of-sale" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: t("nav.products"),
          tabBarIcon: ({ color }) => <MaterialIcons name="inventory" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inventory"
        options={{
          title: t("nav.inventory"),
          tabBarIcon: ({ color }) => <MaterialIcons name="reorder" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: ({ color }) => <MaterialIcons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
