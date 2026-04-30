import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Markdown } from "@/components/Markdown";
import { PressableScale } from "@/components/PressableScale";
import { RelatedQuestions } from "@/components/RelatedQuestions";
import { VoiceListeningOverlay } from "@/components/VoiceListeningOverlay";
import { useColors } from "@/hooks/useColors";
import { useHistory, newId } from "@/contexts/HistoryContext";
import { streamExplain, transcribeAudio, type ChatTurn } from "@/lib/api";
import { parseAnswer } from "@/lib/parseAnswer";
import { takePendingRequest, type PendingRequest } from "@/lib/pendingRequest";
import { useVoiceRecorder } from "@/lib/voiceRecorder";

type Status = "streaming" | "done" | "error" | "idle";

type LocalTurn = ChatTurn & { id: string };

export default function AnswerScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    historyId?: string;
    hasImage?: string;
  }>();
  const { add, update, getById, toggleBookmark } = useHistory();
  const scrollRef = useRef<ScrollView>(null);
  const startedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const dotAnim = useRef(new Animated.Value(0)).current;
  const pendingRef = useRef<PendingRequest | null>(null);
  if (!pendingRef.current && !params.historyId) {
    pendingRef.current = takePendingRequest();
  }
  const pending = pendingRef.current;

  const existingItem = params.historyId ? getById(params.historyId) : undefined;

  const initialMessages: LocalTurn[] = useMemo(() => {
    if (existingItem) {
      return [
        {
          id: "h-q",
          role: "user",
          content: existingItem.question || "Photo question",
          hasImage: existingItem.hasImage,
        },
        { id: "h-a", role: "assistant", content: existingItem.answer },
      ];
    }
    if (pending) {
      return [
        {
          id: "p-q",
          role: "user",
          content: pending.question,
          hasImage: !!pending.imageBase64,
        },
        { id: "p-a", role: "assistant", content: "" },
      ];
    }
    return [];
  }, [existingItem, pending]);

  const [messages, setMessages] = useState<LocalTurn[]>(initialMessages);
  const [status, setStatus] = useState<Status>(
    existingItem ? "done" : "streaming"
  );
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(
    existingItem?.id ?? null
  );
  const [followUp, setFollowUp] = useState("");
  const [transcribing, setTranscribing] = useState(false);

  const subject = pending?.subject ?? existingItem?.subject ?? "";
  const gradeLevel = pending?.gradeLevel ?? existingItem?.gradeLevel ?? "";
  const language = pending?.language ?? "english";

  const item = savedId ? getById(savedId) : undefined;
  const bookmarked = item?.bookmarked ?? existingItem?.bookmarked ?? false;

  const isLastAssistantStreaming =
    status === "streaming" &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "assistant";

  // Typing dots animation
  useEffect(() => {
    const lastAssistant = messages[messages.length - 1];
    if (
      status !== "streaming" ||
      !lastAssistant ||
      lastAssistant.role !== "assistant" ||
      lastAssistant.content.length > 0
    ) {
      return;
    }
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
  }, [status, messages, dotAnim]);

  // Stream a turn (initial or follow-up). Mutates `messages` to append assistant content.
  const runStream = useCallback(
    (params: { messages: ChatTurn[]; imageBase64?: string }) => {
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      setStatus("streaming");
      setError(null);

      let buffer = "";
      let assistantId = "";

      streamExplain(
        {
          subject: subject || undefined,
          gradeLevel: gradeLevel || undefined,
          language,
          messages: params.messages,
          imageBase64: params.imageBase64,
        },
        (e) => {
          if (e.type === "chunk") {
            buffer += e.content;
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last && last.role === "assistant") {
                assistantId = last.id;
                next[next.length - 1] = { ...last, content: buffer };
              }
              return next;
            });
          } else if (e.type === "done") {
            if (buffer.trim().length === 0) {
              setStatus("error");
              setError(
                "Bhai didn't reply. Try rephrasing or send the question again."
              );
              return;
            }
            setStatus("done");
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              ).catch(() => {});
            }
            const firstUser = params.messages.find((m) => m.role === "user");
            const firstQuestion = firstUser?.content ?? "";
            const latestAnswer = buffer;
            if (!savedId) {
              const id = newId();
              add({
                id,
                question: firstQuestion,
                subject,
                gradeLevel,
                hasImage: !!params.imageBase64 || !!firstUser?.hasImage,
                answer: latestAnswer,
                createdAt: Date.now(),
              }).then(() => setSavedId(id));
            } else {
              update(savedId, { answer: latestAnswer });
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
    },
    [add, update, gradeLevel, language, savedId, subject]
  );

  // Kick off the initial stream once
  useEffect(() => {
    if (existingItem) return;
    if (startedRef.current) return;
    startedRef.current = true;

    if (!pending) {
      setStatus("error");
      setError("Question expired. Head back and ask again.");
      return;
    }

    const cleanup = runStream({
      messages: [
        {
          role: "user",
          content: pending.question,
          hasImage: !!pending.imageBase64,
        },
      ],
      imageBase64: pending.imageBase64,
    });

    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll on new content
  useEffect(() => {
    if (status === "streaming") {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages, status]);

  const onCopy = async (text: string) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
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

  const sendFollowUp = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (status === "streaming") return;
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }

      // Build outbound history of completed turns (strip ids)
      const history: ChatTurn[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
        hasImage: m.hasImage,
      }));
      const outbound: ChatTurn[] = [
        ...history,
        { role: "user", content: trimmed },
      ];

      // Append visually
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", content: trimmed },
        { id: `a-${Date.now() + 1}`, role: "assistant", content: "" },
      ]);
      setFollowUp("");

      runStream({ messages: outbound });
    },
    [messages, runStream, status]
  );

  // Voice input for follow-ups
  const recorder = useVoiceRecorder();
  const onMicPress = async () => {
    if (recorder.state === "recording") return;
    if (status === "streaming") return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await recorder.start();
  };
  const onMicStop = async () => {
    const result = await recorder.stop();
    if (!result || !result.base64) return;
    setTranscribing(true);
    try {
      const text = await transcribeAudio({
        audioBase64: result.base64,
        format: result.format,
        language,
      });
      if (text) {
        sendFollowUp(text);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Couldn't transcribe.";
      setError(msg);
    } finally {
      setTranscribing(false);
    }
  };
  const onMicCancel = async () => {
    await recorder.cancel();
  };

  // Parse latest assistant body / related questions for chip rendering
  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const parsedLatest = useMemo(
    () => parseAnswer(latestAssistant?.content ?? ""),
    [latestAssistant?.content]
  );
  const showRelated =
    status === "done" && parsedLatest.related.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
      keyboardVerticalOffset={0}
    >
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
            paddingBottom: 24,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.map((m, idx) => {
            if (m.role === "user") {
              const isFirst = idx === 0;
              return (
                <View
                  key={m.id}
                  style={[
                    styles.questionCard,
                    {
                      backgroundColor: colors.bubbleUser,
                      marginTop: isFirst ? 0 : 14,
                    },
                  ]}
                >
                  {isFirst && meta ? (
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
                    {m.content || "Photo question"}
                  </Text>
                  {m.hasImage ? (
                    <View
                      style={[
                        styles.attached,
                        { borderColor: "rgba(255,255,255,0.3)" },
                      ]}
                    >
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
              );
            }

            // Assistant message
            const isLastMessage = idx === messages.length - 1;
            const parsed = parseAnswer(m.content);
            const showCursor = isLastMessage && isLastAssistantStreaming;
            const showThinking = showCursor && m.content.length === 0;
            const showActions = isLastMessage && status === "done" && m.content.length > 0;

            return (
              <View key={m.id} style={{ marginTop: 14 }}>
                {showThinking ? (
                  <ThinkingIndicator language={language} />
                ) : (
                  <View
                    style={[
                      styles.answerCard,
                      {
                        backgroundColor: colors.bubbleAssistant,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Markdown
                      source={parsed.body || m.content}
                      color={colors.bubbleAssistantForeground}
                    />
                    {showCursor ? (
                      <View
                        style={{ flexDirection: "row", marginTop: 8, gap: 4 }}
                      >
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
                )}

                {showActions ? (
                  <View style={styles.actionRow}>
                    <PressableScale
                      onPress={() => onCopy(m.content)}
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.border,
                        },
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
                  </View>
                ) : null}

                {/* Related questions chips — only on the latest completed assistant message */}
                {isLastMessage && showRelated ? (
                  <RelatedQuestions
                    questions={parsedLatest.related}
                    onPick={(q) => sendFollowUp(q)}
                  />
                ) : null}
              </View>
            );
          })}

          {/* Error state */}
          {status === "error" ? (
            <View
              style={[
                styles.errorCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.destructive,
                  marginTop: 14,
                },
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
        </ScrollView>

        {/* Follow-up input bar — only when in a live (non-history) session and ready */}
        {!existingItem ? (
          <View
            style={[
              styles.composer,
              {
                paddingBottom: Math.max(insets.bottom, 12),
                borderTopColor: colors.border,
                backgroundColor: colors.background,
              },
            ]}
          >
            <View
              style={[
                styles.composerCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <TextInput
                value={followUp}
                onChangeText={setFollowUp}
                placeholder={
                  transcribing
                    ? "Transcribing…"
                    : status === "streaming"
                      ? "Bhai is replying…"
                      : "Ask a follow-up…"
                }
                placeholderTextColor={colors.mutedForeground}
                editable={status !== "streaming" && !transcribing}
                multiline
                style={{
                  flex: 1,
                  fontFamily: "Inter_400Regular",
                  fontSize: 15,
                  color: colors.foreground,
                  maxHeight: 120,
                  paddingTop: 4,
                  paddingBottom: 4,
                }}
                onSubmitEditing={() => sendFollowUp(followUp)}
              />
              <Pressable
                onPress={onMicPress}
                disabled={status === "streaming" || transcribing}
                style={({ pressed }) => [
                  styles.micBtn,
                  {
                    backgroundColor: colors.muted,
                    opacity:
                      status === "streaming" || transcribing
                        ? 0.4
                        : pressed
                          ? 0.7
                          : 1,
                  },
                ]}
              >
                <Feather name="mic" size={18} color={colors.foreground} />
              </Pressable>
              <Pressable
                onPress={() => sendFollowUp(followUp)}
                disabled={
                  status === "streaming" || transcribing || !followUp.trim()
                }
                style={({ pressed }) => [
                  styles.sendBtn,
                  {
                    backgroundColor:
                      followUp.trim() && status !== "streaming" && !transcribing
                        ? colors.primary
                        : colors.muted,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                {transcribing ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primaryForeground}
                  />
                ) : (
                  <Feather
                    name="arrow-up"
                    size={18}
                    color={
                      followUp.trim() && status !== "streaming"
                        ? colors.primaryForeground
                        : colors.mutedForeground
                    }
                  />
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        <VoiceListeningOverlay
          visible={recorder.state === "recording" || recorder.state === "preparing"}
          durationMs={recorder.durationMs}
          onStop={onMicStop}
          onCancel={onMicCancel}
          hint="Speak your follow-up. Tap Done when you're finished."
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const LOADING_MESSAGES: Record<
  "english" | "hinglish" | "telugu" | "telugu_roman",
  string[]
> = {
  english: [
    "Bhai is reading your question…",
    "Working through the steps…",
    "Almost there — putting it in plain words…",
    "Double-checking the answer…",
  ],
  hinglish: [
    "Bhai solve kar raha hu…",
    "Thoda ruk, samjha raha hu…",
    "Steps likh raha hu, bas ek second…",
    "Final answer check kar raha hu…",
  ],
  telugu: [
    "Bhaiyya ఆలోచిస్తున్నాడు…",
    "Steps రాస్తున్నా, కాస్త ఆగు…",
    "సింపుల్ గా చెప్పేస్తా…",
    "Final answer check చేస్తున్నా…",
  ],
  telugu_roman: [
    "Aagu thammudu, chestha…",
    "Steps rastunna, kaasta time…",
    "Easy ga ardham ayyela cheppestha…",
    "Final answer check chestunna…",
  ],
};

function ThinkingIndicator({
  language,
}: {
  language: "english" | "hinglish" | "telugu" | "telugu_roman";
}) {
  const colors = useColors();
  const messages = LOADING_MESSAGES[language] ?? LOADING_MESSAGES.english;
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(fade, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fade, {
          toValue: 1,
          duration: 320,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
      setTimeout(() => {
        setIndex((i) => (i + 1) % messages.length);
      }, 220);
    }, 1900);
    return () => clearInterval(interval);
  }, [fade, messages.length]);

  return (
    <View style={styles.thinkingRow}>
      <ActivityIndicator color={colors.primary} />
      <Animated.Text
        style={{
          fontFamily: "Inter_500Medium",
          fontSize: 14,
          color: colors.mutedForeground,
          opacity: fade,
          flex: 1,
        }}
        numberOfLines={1}
      >
        {messages[index]}
      </Animated.Text>
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
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  composer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerCard: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 1,
  },
  micBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
