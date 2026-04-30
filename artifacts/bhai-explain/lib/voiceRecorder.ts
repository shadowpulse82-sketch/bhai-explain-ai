import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";

export type RecorderState = "idle" | "preparing" | "recording" | "processing";

export type FinishedRecording = {
  base64: string;
  format: string;
  durationMs: number;
};

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 100);
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // Mirror native recorder state into our coarse-grained UI state
  useEffect(() => {
    if (recState.isRecording && state !== "recording") {
      setState("recording");
    }
  }, [recState.isRecording, state]);

  const start = useCallback(async () => {
    setError(null);
    cancelledRef.current = false;
    setState("preparing");
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setState("idle");
        setError("Mic permission denied. Enable it in settings to use voice.");
        return false;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState("recording");
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't start recording.";
      setError(msg);
      setState("idle");
      return false;
    }
  }, [recorder]);

  const stop = useCallback(async (): Promise<FinishedRecording | null> => {
    if (state !== "recording" && state !== "preparing") return null;
    setState("processing");
    try {
      const durationMs = recState.durationMillis ?? 0;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      const uri = recorder.uri;
      if (!uri || cancelledRef.current) {
        if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        setState("idle");
        return null;
      }
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      const format = guessFormatFromUri(uri);
      setState("idle");
      return { base64, format, durationMs };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't save the recording.";
      setError(msg);
      setState("idle");
      return null;
    }
  }, [recorder, recState.durationMillis, state]);

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    let uri: string | null = null;
    try {
      uri = recorder.uri;
      if (recState.isRecording) {
        await recorder.stop();
      }
    } catch {
      // ignore
    }
    if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    setState("idle");
  }, [recorder, recState.isRecording]);

  return {
    state,
    error,
    durationMs: recState.durationMillis ?? 0,
    metering: recState.metering,
    start,
    stop,
    cancel,
  };
}

function guessFormatFromUri(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "m4a";
  if (lower.endsWith(".webm")) return "webm";
  if (lower.endsWith(".wav")) return "wav";
  if (lower.endsWith(".mp3")) return "mp3";
  if (lower.endsWith(".caf")) return "caf";
  if (lower.endsWith(".aac")) return "aac";
  if (lower.endsWith(".ogg")) return "ogg";
  return Platform.OS === "ios" ? "m4a" : "webm";
}
