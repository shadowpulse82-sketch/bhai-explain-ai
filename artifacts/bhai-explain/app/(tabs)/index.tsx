import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AskHeader } from "@/components/AskHeader";
import { Chip } from "@/components/Chip";
import { LanguagePillRow } from "@/components/LanguagePicker";
import { PressableScale } from "@/components/PressableScale";
import { useColors } from "@/hooks/useColors";
import { useHistory } from "@/contexts/HistoryContext";
import { useSettings } from "@/contexts/SettingsContext";
import { compressForUpload } from "@/lib/imageCompress";
import { setPendingRequest } from "@/lib/pendingRequest";

const SUBJECTS = [
  "Math",
  "Science",
  "English",
  "Social Studies",
  "Hindi",
  "Computer",
  "Other",
];

const GRADES = [
  "Grade 1-2",
  "Grade 3-5",
  "Grade 6-8",
  "Grade 9-10",
  "Grade 11-12",
  "College",
];

const STARTER_PROMPTS = [
  { label: "Solve this equation", text: "Solve: 2x + 5 = 17 and explain each step." },
  { label: "Explain a concept", text: "What is photosynthesis? Explain it like I'm 12." },
  { label: "Help with an essay", text: "Help me write an opening paragraph about climate change." },
  { label: "Translate & explain", text: "What does \"ubiquitous\" mean? Use it in a sentence." },
];

function greetingFor(name: string): string {
  const hour = new Date().getHours();
  const base =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return name ? `${base}, ${name}` : `${base}, champ`;
}

export default function AskScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { items: historyItems } = useHistory();

  const [question, setQuestion] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>(settings.defaultSubject);
  const [grade, setGrade] = useState<string>(settings.defaultGrade);
  const [pickingImage, setPickingImage] = useState(false);

  const recent = useMemo(() => historyItems.slice(0, 3), [historyItems]);

  const canSend = question.trim().length > 0 || !!imageBase64;

  const pickImage = async (source: "camera" | "library") => {
    setPickingImage(true);
    try {
      let perm;
      if (source === "camera") {
        perm = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      if (!perm.granted) {
        Alert.alert(
          "Permission needed",
          source === "camera"
            ? "Bhai needs camera access to read your homework."
            : "Bhai needs photo access to read your homework."
        );
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 1,
              allowsEditing: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 1,
              allowsEditing: true,
            });

      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert("Bhai", "Couldn't read that image. Try another one?");
        return;
      }

      const compressed = await compressForUpload(asset.uri);
      setImageBase64(compressed.base64);
      setImagePreview(compressed.uri);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      Alert.alert(
        "Bhai",
        msg.toLowerCase().includes("permission")
          ? msg
          : "That photo couldn't be processed. Try a smaller one or snap a fresh picture."
      );
    } finally {
      setPickingImage(false);
    }
  };

  const send = () => {
    if (!canSend) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    setPendingRequest({
      question: question.trim(),
      subject: subject || undefined,
      gradeLevel: grade || undefined,
      language: settings.language,
      imageBase64: imageBase64 ?? undefined,
    });
    router.push({
      pathname: "/answer",
      params: { hasImage: imageBase64 ? "1" : "0" },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollView
        bottomOffset={140}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 160 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <AskHeader
          greeting={greetingFor(settings.studentName)}
          subtitle="Drop a question or snap a photo. I'll break it down step by step."
        />

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="What's the question, bhai?"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={{
              minHeight: 90,
              fontFamily: "Inter_400Regular",
              fontSize: 16,
              color: colors.foreground,
              textAlignVertical: "top",
            }}
          />

          {imagePreview ? (
            <View style={[styles.imageWrap, { borderColor: colors.border }]}>
              <Image
                source={{ uri: imagePreview }}
                style={{ width: "100%", height: 160 }}
                contentFit="cover"
              />
              <Pressable
                onPress={() => {
                  setImageBase64(null);
                  setImagePreview(null);
                }}
                style={[styles.removeImage, { backgroundColor: colors.foreground }]}
                hitSlop={10}
              >
                <Feather name="x" size={14} color={colors.background} />
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.actionsRow}>
            <View style={styles.actionsLeft}>
              <Pressable
                onPress={() => pickImage("camera")}
                disabled={pickingImage}
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="camera" size={18} color={colors.foreground} />
              </Pressable>
              <Pressable
                onPress={() => pickImage("library")}
                disabled={pickingImage}
                style={({ pressed }) => [
                  styles.iconBtn,
                  { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="image" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <PressableScale
              onPress={send}
              disabled={!canSend}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: canSend ? colors.primary : colors.muted,
                  opacity: canSend ? 1 : 0.6,
                },
              ]}
            >
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 15,
                  color: canSend ? colors.primaryForeground : colors.mutedForeground,
                }}
              >
                Ask Bhai
              </Text>
              <Feather
                name="arrow-up-right"
                size={16}
                color={canSend ? colors.primaryForeground : colors.mutedForeground}
              />
            </PressableScale>
          </View>
        </View>

        <Section title="Bhai's language">
          <LanguagePillRow />
        </Section>

        <Section title="Subject" >
          <ChipsRow
            options={SUBJECTS}
            value={subject}
            onChange={(v) => setSubject(v === subject ? "" : v)}
          />
        </Section>

        <Section title="Grade level">
          <ChipsRow
            options={GRADES}
            value={grade}
            onChange={(v) => setGrade(v === grade ? "" : v)}
          />
        </Section>

        <Section title="Try one of these">
          <View style={{ gap: 10, paddingHorizontal: 20 }}>
            {STARTER_PROMPTS.map((p) => (
              <Pressable
                key={p.label}
                onPress={() => setQuestion(p.text)}
                style={({ pressed }) => [
                  styles.starter,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: "Poppins_600SemiBold",
                      fontSize: 14,
                      color: colors.foreground,
                    }}
                  >
                    {p.label}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Inter_400Regular",
                      fontSize: 13,
                      color: colors.mutedForeground,
                      marginTop: 2,
                    }}
                    numberOfLines={1}
                  >
                    {p.text}
                  </Text>
                </View>
                <Feather
                  name="arrow-up-left"
                  size={18}
                  color={colors.mutedForeground}
                  style={{ transform: [{ rotate: "270deg" }] }}
                />
              </Pressable>
            ))}
          </View>
        </Section>

        {recent.length > 0 ? (
          <Section title="Recent">
            <View style={{ gap: 10, paddingHorizontal: 20 }}>
              {recent.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push({
                      pathname: "/answer",
                      params: { historyId: item.id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.starter,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: "Inter_500Medium",
                        fontSize: 14,
                        color: colors.foreground,
                      }}
                      numberOfLines={2}
                    >
                      {item.question || "Photo question"}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "Inter_400Regular",
                        fontSize: 12,
                        color: colors.mutedForeground,
                        marginTop: 4,
                      }}
                    >
                      {[item.subject, item.gradeLevel].filter(Boolean).join(" · ") || "Saved"}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </View>
          </Section>
        ) : null}

        {pickingImage ? (
          <View style={{ marginTop: 16, alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ marginTop: 24 }}>
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

function ChipsRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
    >
      {options.map((opt) => (
        <Chip
          key={opt}
          label={opt}
          selected={value === opt}
          onPress={() => onChange(opt)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  card: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  imageWrap: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  removeImage: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionsLeft: {
    flexDirection: "row",
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  starter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
});
