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

export type HistoryItem = {
  id: string;
  question: string;
  subject?: string;
  gradeLevel?: string;
  hasImage: boolean;
  answer: string;
  createdAt: number;
  bookmarked?: boolean;
};

const STORAGE_KEY = "@bhai-explain/history/v1";

type Ctx = {
  items: HistoryItem[];
  loaded: boolean;
  add: (item: HistoryItem) => Promise<void>;
  update: (id: string, patch: Partial<HistoryItem>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  toggleBookmark: (id: string) => Promise<void>;
  getById: (id: string) => HistoryItem | undefined;
};

const HistoryContext = createContext<Ctx | null>(null);

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as HistoryItem[];
          if (Array.isArray(parsed)) setItems(parsed);
        }
      } catch {
        // ignore
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback((next: HistoryItem[]) => {
    const write = AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    persistQueueRef.current = persistQueueRef.current.then(() => write, () => write);
  }, []);

  const add = useCallback(
    async (item: HistoryItem) => {
      setItems((prev) => {
        const next = [item, ...prev].slice(0, 200);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const update = useCallback(
    async (id: string, patch: Partial<HistoryItem>) => {
      setItems((prev) => {
        const next = prev.map((i) => (i.id === id ? { ...i, ...patch } : i));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const remove = useCallback(
    async (id: string) => {
      setItems((prev) => {
        const next = prev.filter((i) => i.id !== id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const clear = useCallback(async () => {
    setItems([]);
    const write = AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    persistQueueRef.current = persistQueueRef.current.then(() => write, () => write);
  }, []);

  const toggleBookmark = useCallback(
    async (id: string) => {
      setItems((prev) => {
        const next = prev.map((i) =>
          i.id === id ? { ...i, bookmarked: !i.bookmarked } : i
        );
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const getById = useCallback(
    (id: string) => items.find((i) => i.id === id),
    [items]
  );

  const value = useMemo(
    () => ({ items, loaded, add, update, remove, clear, toggleBookmark, getById }),
    [items, loaded, add, update, remove, clear, toggleBookmark, getById]
  );

  return (
    <HistoryContext.Provider value={value}>{children}</HistoryContext.Provider>
  );
}

export function useHistory() {
  const ctx = useContext(HistoryContext);
  if (!ctx) throw new Error("useHistory must be used inside HistoryProvider");
  return ctx;
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
