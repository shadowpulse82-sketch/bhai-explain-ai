import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { useSettings, type Language } from "@/contexts/SettingsContext";

export const LANGUAGE_OPTIONS: {
  value: Language;
  label: string;
  short: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  description: string;
}[] = [
  {
    value: "english",
    label: "English",
    short: "EN",
    icon: "type",
    description: "Clear, friendly English.",
  },
  {
    value: "hinglish",
    label: "Hinglish",
    short: "HI",
    icon: "message-circle",
    description: "Bhai yaha samjhata hu — Hindi-English mix.",
  },
  {
    value: "telugu",
    label: "Telugu",
    short: "తె",
    icon: "globe",
    description: "తెలుగు script lo full explanation.",
  },
  {
    value: "telugu_roman",
    label: "Telugu Roman",
    short: "Te",
    icon: "message-square",
    description: "Cheppu thammudu — Telugu in English letters.",
  },
];

export function LanguagePillRow() {
  const colors = useColors();
  const { settings, update } = useSettings();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {LANGUAGE_OPTIONS.map((opt) => {
        const selected = settings.language === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => update({ language: opt.value })}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: selected ? colors.primary : colors.card,
                borderColor: selected ? colors.primary : colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 11,
                color: selected ? colors.primaryForeground : colors.mutedForeground,
                letterSpacing: 0.5,
              }}
            >
              {opt.short}
            </Text>
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 13,
                color: selected ? colors.primaryForeground : colors.foreground,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
});
