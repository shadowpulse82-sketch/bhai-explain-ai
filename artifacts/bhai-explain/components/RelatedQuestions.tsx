import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

type Props = {
  questions: string[];
  onPick: (q: string) => void;
};

export function RelatedQuestions({ questions, onPick }: Props) {
  const colors = useColors();
  if (!questions.length) return null;

  return (
    <View style={{ marginTop: 14, gap: 8 }}>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 11,
          color: colors.mutedForeground,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        Try asking next
      </Text>
      {questions.map((q, i) => (
        <Pressable
          key={`${i}-${q}`}
          onPress={() => onPick(q)}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 14,
              color: colors.foreground,
              flex: 1,
            }}
            numberOfLines={2}
          >
            {q}
          </Text>
          <Feather
            name="arrow-up-right"
            size={16}
            color={colors.primary}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
});
