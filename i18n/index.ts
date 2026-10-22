import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";

const LANGUAGE_STORAGE_KEY = "smartpos_language";

export const SUPPORTED_LANGUAGES = ["en", "es"] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

function isSupportedLanguage(value: string | null | undefined): value is AppLanguage {
  return SUPPORTED_LANGUAGES.some((language) => language === value);
}

function getDeviceLanguage(): AppLanguage {
  try {
    const locale = getLocales()[0];
    const language = (locale?.languageCode ?? locale?.languageTag ?? "en").toLowerCase().split(/[-_]/)[0];

    return isSupportedLanguage(language) ? language : "en";
  } catch {
    return "en";
  }
}

async function getInitialLanguage(): Promise<AppLanguage> {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(savedLanguage)) {
      return savedLanguage;
    }
  } catch {
    // Device locale and English remain available if local storage is unavailable.
  }

  return getDeviceLanguage();
}

export const i18n = createInstance();

export function getAppLocale(): string {
  return i18n.resolvedLanguage?.startsWith("es") ? "es-IN" : "en-IN";
}

export function translatePhrase(value: string, values?: Record<string, string | number>): string {
  return i18n.t(value, {
    ns: "phrases",
    keySeparator: false,
    defaultValue: value,
    ...values,
  });
}

export const i18nReady = (async () => {
  const language = await getInitialLanguage();

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en, phrases: {} },
      es: { translation: es, phrases: es.phrases },
    },
    lng: language,
    fallbackLng: "en",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    defaultNS: "translation",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
})();

export async function changeAppLanguage(language: AppLanguage): Promise<void> {
  await i18nReady;
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  await i18n.changeLanguage(language);
}
