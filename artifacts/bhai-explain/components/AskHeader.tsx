import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  greeting: string;
  subtitle: string;
};

export function AskHeader({ greeting, subtitle }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPadding =
    Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPadding + 8 }]}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: colors.accent }]} />
        <Text
          style={{
            fontFamily: "Inter_500Medium",
            fontSize: 12,
            color: colors.mutedForeground,
            letterSpacing: 1.4,
            textTransform: "uppercase",
          }}
        >
          Bhai Explain
        </Text>
      </View>
      <Text
        style={{
          fontFamily: "Poppins_700Bold",
          fontSize: 30,
          color: colors.foreground,
          marginTop: 8,
        }}
      >
        {greeting}
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 15,
          color: colors.mutedForeground,
          marginTop: 4,
          lineHeight: 21,
        }}
      >
        {subtitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
