import { translatePhrase } from "@/i18n";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

const isExpoGo = Constants?.executionEnvironment === ExecutionEnvironment.StoreClient;

let Notifications: typeof import("expo-notifications") | null = null;
if (Platform.OS !== "web" && !isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require("expo-notifications");
    Notifications?.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Suppress errors if notifications cannot be initialized in this runtime
  }
}

// Structural type kept local so this module doesn't import from store.ts
// (which imports this file — importing back would create a cycle).
type StockItem = { id: string; name: string; stock: number; lowStockAlert: number };

const LOW_STOCK_CHANNEL = "low-stock";

// Cache the permission handshake so we only run it once per app session.
let permissionReady: Promise<boolean> | null = null;

// Product ids already alerted this session, so a repeated catalog sync doesn't
// re-notify. An item that gets restocked above its threshold is removed here so
// it can alert again if it later runs low.
const notified = new Set<string>();

async function ensurePermission(): Promise<boolean> {
  // expo-notifications local notifications are Android/iOS only and push was removed in Expo Go.
  if (Platform.OS === "web" || isExpoGo || !Notifications) return false;
  if (!permissionReady) {
    permissionReady = (async () => {
      try {
        if (!Notifications) return false;
        // Android 13+ needs a channel to exist before the prompt will appear.
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync(LOW_STOCK_CHANNEL, {
            name: translatePhrase("Low stock alerts"),
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing === "granted") return true;
        const { status } = await Notifications.requestPermissionsAsync();
        return status === "granted";
      } catch (e) {
        console.warn("Notification permission setup failed:", e);
        return false;
      }
    })();
  }
  return permissionReady;
}

/**
 * Fire a single local notification for any products that have *newly* dropped
 * to/below their low-stock threshold. Safe to call after every catalog sync;
 * it dedupes per session and no-ops on web or when permission is denied.
 */
export async function notifyLowStockIfNeeded(products: StockItem[]): Promise<void> {
  try {
    if (!Notifications) return;

    // Anything restocked above its threshold becomes eligible to alert again.
    products.forEach((p) => {
      if (p.stock > p.lowStockAlert) notified.delete(p.id);
    });

    const fresh = products.filter((p) => p.stock <= p.lowStockAlert && !notified.has(p.id));
    if (fresh.length === 0) return;

    const granted = await ensurePermission();
    if (!granted || !Notifications) return;

    fresh.forEach((p) => notified.add(p.id));

    const title =
      fresh.length === 1
        ? translatePhrase("Low stock: {{name}}", { name: fresh[0].name })
        : translatePhrase("{{number}} items low on stock", { number: fresh.length });
    const names = fresh
      .slice(0, 5)
      .map((p) =>
        p.stock <= 0
          ? translatePhrase("{{name}} — out of stock", { name: p.name })
          : translatePhrase("{{name}} — {{qty}} left", { name: p.name, qty: p.stock }),
      );
    const body =
      names.join("\n") +
      (fresh.length > 5 ? `\n${translatePhrase("+{{number}} more", { number: fresh.length - 5 })}` : "");

    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: null, // present immediately
    });
  } catch (e) {
    console.warn("Low-stock notification failed:", e);
  }
}
