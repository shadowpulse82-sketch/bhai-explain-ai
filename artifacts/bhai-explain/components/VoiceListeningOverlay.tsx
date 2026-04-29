import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";

type Props = {
  visible: boolean;
  durationMs: number;
  onStop: () => void;
  onCancel: () => void;
  hint?: string;
};

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(1, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/**
 * Bottom-sheet style overlay shown while the mic is active.
 * Pulsing ring around the mic, "Listening…" label, live timer, send + cancel.
 */
export function VoiceListeningOverlay({
  visible,
  durationMs,
  onStop,
  onCancel,
  hint,
}: Props) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(0)).current;
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const wave3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    const makeWave = (val: Animated.Value, delay: number, range: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 480,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 480,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
    const w1 = makeWave(wave1, 0, 30);
    const w2 = makeWave(wave2, 120, 50);
    const w3 = makeWave(wave3, 240, 35);
    w1.start();
    w2.start();
    w3.start();

    return () => {
      loop.stop();
      w1.stop();
      w2.stop();
      w3.stop();
    };
  }, [visible, pulse, wave1, wave2, wave3]);

  if (!visible) return null;

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.8],
  });
  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0],
  });

  const renderBar = (val: Animated.Value, base: number) => {
    const scaleY = val.interpolate({
      inputRange: [0, 1],
      outputRange: [0.4, 1.4],
    });
    return (
      <Animated.View
        style={{
          width: 4,
          height: base,
          borderRadius: 2,
          backgroundColor: colors.primary,
          transform: [{ scaleY }],
        }}
      />
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={{
              fontFamily: "Poppins_600SemiBold",
              fontSize: 16,
              color: colors.foreground,
            }}
          >
            Listening…
          </Text>
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 13,
              color: colors.mutedForeground,
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {hint ?? "Speak your question, then tap send."}
          </Text>

          <View style={styles.micWrap}>
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  borderColor: colors.primary,
                  opacity: ringOpacity,
                  transform: [{ scale: ringScale }],
                },
              ]}
            />
            <View style={[styles.micCircle, { backgroundColor: colors.primary }]}>
              <Feather name="mic" size={32} color={colors.primaryForeground} />
            </View>
          </View>

          <View style={styles.waveRow}>
            {renderBar(wave1, 18)}
            {renderBar(wave2, 28)}
            {renderBar(wave3, 22)}
            {renderBar(wave2, 32)}
            {renderBar(wave1, 20)}
            {renderBar(wave3, 26)}
            {renderBar(wave2, 18)}
          </View>

          <Text
            style={{
              fontFamily: "Inter_500Medium",
              fontSize: 14,
              color: colors.mutedForeground,
              marginTop: 8,
            }}
          >
            {formatTime(durationMs)}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: colors.muted,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Feather name="x" size={18} color={colors.foreground} />
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: colors.foreground,
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onStop}
              style={({ pressed }) => [
                styles.actionBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather name="check" size={18} color={colors.primaryForeground} />
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 14,
                  color: colors.primaryForeground,
                }}
              >
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    alignItems: "center",
  },
  micWrap: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  pulseRing: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
  },
  micCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  waveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    height: 38,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
    width: "100%",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
});
