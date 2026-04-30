import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type Language = "english" | "hinglish" | "telugu" | "telugu_roman";

const VALID_LANGUAGES: Language[] = ["english", "hinglish", "telugu", "telugu_roman"];

export type Settings = {
  defaultSubject: string;
  defaultGrade: string;
  language: Language;
  studentName: string;
};

const DEFAULTS: Settings = {
  defaultSubject: "",
  defaultGrade: "",
  language: "english",
  studentName: "",
};

const STORAGE_KEY = "@bhai-explain/settings/v1";

type Ctx = {
  settings: Settings;
  loaded: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
};

const SettingsContext = createContext<Ctx | null>(null);

function validateSettings(parsed: Record<string, unknown>): Partial<Settings> {
  const result: Partial<Settings> = {};
  if (typeof parsed.defaultSubject === "string") result.defaultSubject = parsed.defaultSubject;
  if (typeof parsed.defaultGrade === "string") result.defaultGrade = parsed.defaultGrade;
  if (typeof parsed.studentName === "string") result.studentName = parsed.studentName;
  if (
    typeof parsed.language === "string" &&
    VALID_LANGUAGES.includes(parsed.language as Language)
  ) {
    result.language = parsed.language as Language;
  }
  return result;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          const validated = validateSettings(parsed);
          setSettings({ ...DEFAULTS, ...validated });
        }
      } catch {
        // ignore
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const update = useCallback(async (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      const write = AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      persistQueueRef.current = persistQueueRef.current.then(() => write, () => write);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ settings, loaded, update }), [settings, loaded, update]);

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
