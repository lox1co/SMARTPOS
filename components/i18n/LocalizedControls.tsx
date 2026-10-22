import { translatePhrase } from "@/i18n";
import { Children, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TextInputProps, TextProps, TouchableOpacityProps } from "react-native";
import {
  Alert as NativeAlert,
  Text as NativeText,
  TextInput as NativeTextInput,
  TouchableOpacity as NativeTouchableOpacity,
} from "react-native";

function translateChildren(children: ReactNode, translate: (value: string) => string): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child !== "string") return child;
    const normalized = child.replace(/\s+/g, " ").trim();
    if (!normalized) return child;

    const leadingSpace = /^\s/.test(child);
    const trailingSpace = /\s$/.test(child);
    return `${leadingSpace ? " " : ""}${translate(normalized)}${trailingSpace ? " " : ""}`;
  });
}

export function LocalizedText({ accessibilityHint, accessibilityLabel, children, ...props }: TextProps) {
  const { t } = useTranslation();
  const translate = (value: string) => t(value, { ns: "phrases", keySeparator: false, defaultValue: value });

  return (
    <NativeText
      {...props}
      accessibilityHint={accessibilityHint ? translate(accessibilityHint) : accessibilityHint}
      accessibilityLabel={accessibilityLabel ? translate(accessibilityLabel) : accessibilityLabel}
    >
      {translateChildren(children, translate)}
    </NativeText>
  );
}

export function LocalizedTextInput({ accessibilityHint, accessibilityLabel, placeholder, ...props }: TextInputProps) {
  const { t } = useTranslation();
  const translate = (value: string | undefined) =>
    value ? t(value, { ns: "phrases", keySeparator: false, defaultValue: value }) : value;

  return (
    <NativeTextInput
      {...props}
      accessibilityHint={translate(accessibilityHint)}
      accessibilityLabel={translate(accessibilityLabel)}
      placeholder={translate(placeholder)}
    />
  );
}

export function LocalizedTouchableOpacity({ accessibilityHint, accessibilityLabel, ...props }: TouchableOpacityProps) {
  const { t } = useTranslation();
  const translate = (value: string | undefined) =>
    value ? t(value, { ns: "phrases", keySeparator: false, defaultValue: value }) : value;

  return (
    <NativeTouchableOpacity
      {...props}
      accessibilityHint={translate(accessibilityHint)}
      accessibilityLabel={translate(accessibilityLabel)}
    />
  );
}

type NativeAlertButton = NonNullable<Parameters<typeof NativeAlert.alert>[2]>[number];

export const LocalizedAlert = {
  alert(
    title: string,
    message?: string,
    buttons?: NativeAlertButton[],
    options?: Parameters<typeof NativeAlert.alert>[3],
  ) {
    NativeAlert.alert(
      translatePhrase(title),
      message ? translatePhrase(message) : undefined,
      buttons?.map((button) => ({
        ...button,
        text: button.text ? translatePhrase(button.text) : button.text,
      })),
      options,
    );
  },
};
