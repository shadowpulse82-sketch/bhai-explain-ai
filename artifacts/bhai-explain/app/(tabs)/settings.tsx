import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useSettings, type Language } from "@/contexts/SettingsContext";

const SUBJECTS = ["Math", "Science", "English", "Social Studies", "Hindi", "Computer"];
const GRADES = ["Grade 1-2", "Grade 3-5", "Grade 6-8", "Grade 9-10", "Grade 11-12", "College"];
const LANGUAGES: { value: Language; label: string; description: string }[] = [
  { value: "english", label: "English", description: "Clear, friendly English." },
  {
    value: "hinglish",
    label: "Hinglish",
    description: "Hindi-English mix in Roman script. Yaar, samjha?",
  },
  { value: "hindi", label: "Hindi", description: "Devanagari script with English terms." },
];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const topPad = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: topPad + 8,
          paddingBottom: 140 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20 }}>
          <Text
            style={{
              fontFamily: "Poppins_700Bold",
              fontSize: 28,
              color: colors.foreground,
              marginBottom: 4,
            }}
          >
            Settings
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.mutedForeground,
            }}
          >
            Tune Bhai to your style.
          </Text>
        </View>

        <Section title="Your Name">
          <View style={{ paddingHorizontal: 20 }}>
            <View
              style={[
                styles.input,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Feather name="user" size={16} color={colors.mutedForeground} />
              <TextInput
                value={settings.studentName}
                onChangeText={(v) => update({ studentName: v })}
                placeholder="What should Bhai call you?"
                placeholderTextColor={colors.mutedForeground}
                style={{
                  flex: 1,
                  fontFamily: "Inter_500Medium",
                  fontSize: 15,
                  color: colors.foreground,
                }}
              />
            </View>
          </View>
        </Section>

        <Section title="Language Style">
          <View style={{ gap: 10, paddingHorizontal: 20 }}>
            {LANGUAGES.map((lang) => {
              const selected = settings.language === lang.value;
              return (
                <Pressable
                  key={lang.value}
                  onPress={() => update({ language: lang.value })}
                  style={({ pressed }) => [
                    styles.langCard,
                    {
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: "Poppins_600SemiBold",
                        fontSize: 15,
                        color: selected ? colors.primaryForeground : colors.foreground,
                      }}
                    >
                      {lang.label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 13,
                        color: selected
                          ? colors.primaryForeground
                          : colors.mutedForeground,
                        marginTop: 2,
                      }}
                    >
                      {lang.description}
                    </Text>
                  </View>
                  {selected ? (
                    <Feather name="check" size={20} color={colors.primaryForeground} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Default Subject">
          <PillRow
            options={SUBJECTS}
            value={settings.defaultSubject}
            onChange={(v) =>
              update({ defaultSubject: v === settings.defaultSubject ? "" : v })
            }
          />
        </Section>

        <Section title="Default Grade">
          <PillRow
            options={GRADES}
            value={settings.defaultGrade}
            onChange={(v) =>
              update({ defaultGrade: v === settings.defaultGrade ? "" : v })
            }
          />
        </Section>

        <Section title="About">
          <View
            style={[
              styles.aboutCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={[styles.aboutDot, { backgroundColor: colors.primary }]} />
              <Text
                style={{
                  fontFamily: "Poppins_700Bold",
                  fontSize: 16,
                  color: colors.foreground,
                }}
              >
                Bhai Explain
              </Text>
            </View>
            <Text
              style={{
                fontFamily: "Inter_400Regular",
                fontSize: 13,
                color: colors.mutedForeground,
                marginTop: 8,
                lineHeight: 19,
              }}
            >
              Your AI homework helper. Snap a question or type it out — Bhai
              breaks it down step by step like a friendly older sibling.
              Conversations stay on this device.
            </Text>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ marginTop: 28 }}>
      <Text
        style={{
          fontFamily: "Inter_600SemiBold",
          fontSize: 12,
          color: colors.mutedForeground,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          paddingHorizontal: 20,
          marginBottom: 10,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function PillRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
        paddingHorizontal: 20,
      }}
    >
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: selected ? colors.foreground : colors.card,
                borderColor: selected ? colors.foreground : colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: selected ? colors.background : colors.foreground,
              }}
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  langCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  aboutCard: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  aboutDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
