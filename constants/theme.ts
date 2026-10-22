/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#004ac6'; // primary
const tintColorDark = '#6366f1';

export const Colors = {
  light: {
    text: '#131b2e', // on-surface
    textSecondary: '#434655', // on-surface-variant
    background: '#faf8ff', // surface / background
    cardBackground: '#ffffff', // surface-container-lowest
    border: '#c3c6d7', // outline-variant
    tint: '#2563eb', // primary-container
    icon: '#434655', // on-surface-variant
    tabIconDefault: '#737686', // outline
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#f8fafc',
    textSecondary: '#94a3b8',
    background: '#0b0f19',
    cardBackground: '#111827',
    border: '#1e293b',
    tint: tintColorDark,
    icon: '#94a3b8',
    tabIconDefault: '#94a3b8',
    tabIconSelected: tintColorDark,
  },
};

/**
 * ---------------------------------------------------------------------------
 * Design tokens
 * ---------------------------------------------------------------------------
 * A single source of truth for the app's visual language so every screen
 * shares the same primary color, spacing rhythm, corner radii, elevation and
 * type scale. Prefer these over hard-coded values in new/edited styles.
 */

/** Canonical brand + semantic colors. Primary is locked to #004ac6. */
export const Palette = {
  // Brand
  primary: '#004ac6',
  primaryDark: '#003ea8',
  primaryPressed: '#00368f',
  primarySurface: '#eaedff', // tinted container behind primary content
  primarySurfaceStrong: '#d0e1fb',
  onPrimary: '#ffffff',

  // Neutrals / surfaces
  background: '#faf8ff',
  surface: '#ffffff',
  surfaceMuted: '#f2f3ff',
  surfaceSubtle: '#f6f7fb',

  // Text
  text: '#131b2e',
  textSecondary: '#434655',
  textTertiary: '#737686',
  textPlaceholder: '#9ca3af',

  // Lines
  border: '#c3c6d7',
  borderLight: '#e6e8f2',

  // Status — success
  success: '#166534',
  successSurface: '#dcfce7',
  // Status — warning
  warning: '#854d0e',
  warningSurface: '#fef08a',
  // Status — error
  error: '#ba1a1a',
  errorSurface: '#ffdad6',
} as const;

/** 4px-based spacing scale. */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Corner radii. `pill` for fully rounded chips/toggles. */
export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 9999,
} as const;

/**
 * Cross-platform elevation presets. Spread into a style object:
 *   { ...Shadows.card }
 * iOS reads shadow*, Android reads elevation — both are set.
 */
export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  // Subtle resting elevation for list/content cards.
  card: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  // Raised surfaces: headers, sticky bars.
  raised: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  // Floating elements: FABs, action buttons.
  floating: {
    shadowColor: '#004ac6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 6,
  },
  // Modals / bottom sheets.
  overlay: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
  },
} as const;

/** Type scale: size + matching lineHeight + weight. */
export const Typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' as const },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  subheading: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const },
  body: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
