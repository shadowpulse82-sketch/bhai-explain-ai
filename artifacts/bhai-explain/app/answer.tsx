import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Markdown } from "@/components/Markdown";
import { PressableScale } from "@/components/PressableScale";
import { useColors } from "@/hooks/useColors";
import { useHistory, newId } from "@/contexts/HistoryContext";
import { streamExplain } from "@/lib/api";

type Status = "streaming" | "done" | "error" | "idle";

export default function AnswerScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    question?: string;
    subject?: string;
    gradeLevel?: string;
    language?: "english" | "hinglish" | "hindi";
    imageBase64?: string;
    historyId?: string;
  }>();
  const { add, getById, toggleBookmark } = useHistory();
  const scrollRef = useRef<ScrollView>(null);
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const dotAnim = useRef(new Animated.Value(0)).current;

  const existingItem = params.historyId ? getById(params.historyId) : undefined;

  const [answer, setAnswer] = useState<string>(existingItem?.answer ?? "");
  const [status, setStatus] = useState<Status>(
    existingItem ? "done" : "streaming"
  );
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(
    existingItem?.id ?? null
  );

  const question = (params.question as string) ?? existingItem?.question ?? "";
  const subject = (params.subject as string) ?? existingItem?.subject ?? "";
  const gradeLevel =
    (params.gradeLevel as string) ?? existingItem?.gradeLevel ?? "";

  const item = savedId ? getById(savedId) : undefined;
  const bookmarked = item?.bookmarked ?? existingItem?.bookmarked ?? false;

  // Typing dots animation
  useEffect(() => {
    if (status !== "streaming" || answer.length > 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dotAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status, answer, dotAnim]);

  // Kick off the stream once
  useEffect(() => {
    if (existingItem) return;
    if (startedRef.current) return;
    startedRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    let buffer = "";
    streamExplain(
      {
        question,
        subject: subject || undefined,
        gradeLevel: gradeLevel || undefined,
        language: (params.language as "english" | "hinglish" | "hindi") || "english",
        imageBase64: (params.imageBase64 as string) || undefined,
      },
      (e) => {
        if (e.type === "chunk") {
          buffer += e.content;
          setAnswer(buffer);
        } else if (e.type === "done") {
          setStatus("done");
          if (Platform.OS !== "web") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => {}
            );
          }
          if (buffer.trim().length > 0) {
            const id = newId();
            add({
              id,
              question,
              subject: subject || undefined,
              gradeLevel: gradeLevel || undefined,
              hasImage: !!(params.imageBase64 as string),
              answer: buffer,
              createdAt: Date.now(),
            }).then(() => setSavedId(id));
          }
        } else if (e.type === "error") {
          setStatus("error");
          setError(e.error);
        }
      },
      controller.signal
    );

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll on new content
  useEffect(() => {
    if (status === "streaming") {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [answer, status]);

  const onCopy = async () => {
    if (!answer) return;
    await Clipboard.setStringAsync(answer);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const onClose = () => {
    abortRef.current?.abort();
    router.back();
  };

  const handleBookmark = async () => {
    const id = savedId;
    if (!id) return;
    await toggleBookmark(id);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const meta = useMemo(
    () => [subject, gradeLevel].filter(Boolean).join(" · "),
    [subject, gradeLevel]
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Platform.OS === "ios" ? 16 : insets.top + 12,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.headerBtn,
            {
              backgroundColor: colors.muted,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          hitSlop={8}
        >
          <Feather name="chevron-down" size={20} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text
            style={{
              fontFamily: "Inter_600SemiBold",
              fontSize: 13,
              color: colors.mutedForeground,
              letterSpacing: 1.4,
              textTransform: "uppercase",
            }}
          >
            Bhai's Take
          </Text>
        </View>
        <Pressable
          onPress={handleBookmark}
          disabled={!savedId}
          style={({ pressed }) => [
            styles.headerBtn,
            {
              backgroundColor: colors.muted,
              opacity: !savedId ? 0.4 : pressed ? 0.7 : 1,
            },
          ]}
          hitSlop={8}
        >
          <Feather
            name="bookmark"
            size={18}
            color={bookmarked ? colors.accent : colors.foreground}
          />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 120 + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Question card */}
        <View
          style={[
            styles.questionCard,
            { backgroundColor: colors.bubbleUser },
          ]}
        >
          {meta ? (
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 11,
                color: colors.bubbleUserForeground,
                opacity: 0.8,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {meta}
            </Text>
          ) : null}
          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 16,
              color: colors.bubbleUserForeground,
              lineHeight: 23,
            }}
          >
            {question || "Photo question"}
          </Text>
          {(params.imageBase64 as string) ? (
            <View style={[styles.attached, { borderColor: "rgba(255,255,255,0.3)" }]}>
              <Feather
                name="image"
                size={12}
                color={colors.bubbleUserForeground}
              />
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 11,
                  color: colors.bubbleUserForeground,
                }}
              >
                Photo attached
              </Text>
            </View>
          ) : null}
        </View>

        {/* Streaming dots before content arrives */}
        {status === "streaming" && answer.length === 0 ? (
          <View style={styles.thinkingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 14,
                color: colors.mutedForeground,
              }}
            >
              Bhai is thinking…
            </Text>
          </View>
        ) : null}

        {/* Error state */}
        {status === "error" ? (
          <View
            style={[
              styles.errorCard,
              { backgroundColor: colors.card, borderColor: colors.destructive },
            ]}
          >
            <Feather name="alert-circle" size={20} color={colors.destructive} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Poppins_600SemiBold",
                  fontSize: 15,
                  color: colors.destructive,
                }}
              >
                Bhai got stuck
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: colors.mutedForeground,
                  marginTop: 4,
                }}
              >
                {error ?? "Something went wrong. Try again in a sec."}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Answer content */}
        {answer.length > 0 ? (
          <View
            style={[
              styles.answerCard,
              {
                backgroundColor: colors.bubbleAssistant,
                borderColor: colors.border,
              },
            ]}
          >
            <Markdown source={answer} color={colors.bubbleAssistantForeground} />
            {status === "streaming" ? (
              <View style={{ flexDirection: "row", marginTop: 8, gap: 4 }}>
                <Animated.View
                  style={[
                    styles.cursor,
                    {
                      backgroundColor: colors.primary,
                      opacity: dotAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.3, 1],
                      }),
                    },
                  ]}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Action bar */}
        {status === "done" && answer.length > 0 ? (
          <View style={styles.actionRow}>
            <PressableScale
              onPress={onCopy}
              style={[
                styles.actionBtn,
                { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
              ]}
            >
              <Feather name="copy" size={14} color={colors.foreground} />
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                  color: colors.foreground,
                }}
              >
                Copy
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => router.back()}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={14} color={colors.primaryForeground} />
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                  color: colors.primaryForeground,
                }}
              >
                New question
              </Text>
            </PressableScale>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  questionCard: {
    padding: 16,
    borderRadius: 18,
    borderTopRightRadius: 6,
    alignSelf: "flex-end",
    maxWidth: "92%",
    marginBottom: 16,
  },
  attached: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 4,
  },
  errorCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  answerCard: {
    padding: 18,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cursor: {
    width: 8,
    height: 16,
    borderRadius: 2,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
});
