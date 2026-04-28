import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useHistory, type HistoryItem } from "@/contexts/HistoryContext";

export default function HistoryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, remove, clear, toggleBookmark } = useHistory();
  const [query, setQuery] = useState("");
  const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);

  const filtered = useMemo(() => {
    return items
      .filter((i) => (showOnlyBookmarks ? i.bookmarked : true))
      .filter((i) => {
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          i.question.toLowerCase().includes(q) ||
          i.answer.toLowerCase().includes(q) ||
          (i.subject ?? "").toLowerCase().includes(q)
        );
      });
  }, [items, query, showOnlyBookmarks]);

  const topPad = Platform.OS === "web" ? Math.max(insets.top, 24) : insets.top;

  const onClear = () => {
    Alert.alert("Clear all history?", "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => clear() },
    ]);
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        <Feather name="book-open" size={28} color={colors.mutedForeground} />
      </View>
      <Text
        style={{
          fontFamily: "Poppins_600SemiBold",
          fontSize: 17,
          color: colors.foreground,
          marginTop: 16,
        }}
      >
        No history yet
      </Text>
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 14,
          color: colors.mutedForeground,
          textAlign: "center",
          marginTop: 6,
          paddingHorizontal: 40,
        }}
      >
        Your asked questions and Bhai's explanations will live here.
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: topPad + 8, paddingHorizontal: 20 }}>
        <View style={styles.headerRow}>
          <Text
            style={{
              fontFamily: "Poppins_700Bold",
              fontSize: 28,
              color: colors.foreground,
            }}
          >
            History
          </Text>
          {items.length > 0 ? (
            <Pressable
              onPress={onClear}
              style={({ pressed }) => [
                styles.clearBtn,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="trash-2" size={14} color={colors.destructive} />
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 12,
                  color: colors.destructive,
                }}
              >
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View
          style={[
            styles.searchRow,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search questions"
            placeholderTextColor={colors.mutedForeground}
            style={{
              flex: 1,
              fontFamily: "Inter_400Regular",
              fontSize: 14,
              color: colors.foreground,
            }}
          />
        </View>

        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setShowOnlyBookmarks(false)}
            style={[
              styles.filterChip,
              {
                backgroundColor: !showOnlyBookmarks ? colors.foreground : colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 12,
                color: !showOnlyBookmarks ? colors.background : colors.foreground,
              }}
            >
              All
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowOnlyBookmarks(true)}
            style={[
              styles.filterChip,
              {
                backgroundColor: showOnlyBookmarks ? colors.foreground : colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather
              name="bookmark"
              size={12}
              color={showOnlyBookmarks ? colors.background : colors.foreground}
            />
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 12,
                color: showOnlyBookmarks ? colors.background : colors.foreground,
              }}
            >
              Saved
            </Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 120 + insets.bottom,
          flexGrow: 1,
        }}
        ListEmptyComponent={renderEmpty}
        renderItem={({ item }) => (
          <HistoryRow
            item={item}
            onOpen={() =>
              router.push({ pathname: "/answer", params: { historyId: item.id } })
            }
            onDelete={() => remove(item.id)}
            onBookmark={() => toggleBookmark(item.id)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

function HistoryRow({
  item,
  onOpen,
  onDelete,
  onBookmark,
}: {
  item: HistoryItem;
  onOpen: () => void;
  onDelete: () => void;
  onBookmark: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        rowStyles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {item.subject ? (
            <View
              style={[
                rowStyles.tag,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 10,
                  color: colors.secondaryForeground,
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                }}
              >
                {item.subject}
              </Text>
            </View>
          ) : null}
          <Text
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 11,
              color: colors.mutedForeground,
            }}
          >
            {new Date(item.createdAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>
        <Text
          style={{
            fontFamily: "Inter_600SemiBold",
            fontSize: 15,
            color: colors.foreground,
          }}
          numberOfLines={2}
        >
          {item.question || "Photo question"}
        </Text>
        <Text
          style={{
            fontFamily: "Inter_400Regular",
            fontSize: 13,
            color: colors.mutedForeground,
          }}
          numberOfLines={2}
        >
          {item.answer.replace(/[#*`>]/g, "").slice(0, 140)}
        </Text>
      </View>
      <View style={{ alignItems: "center", gap: 12 }}>
        <Pressable onPress={onBookmark} hitSlop={10}>
          <Feather
            name={item.bookmarked ? "bookmark" : "bookmark"}
            size={18}
            color={item.bookmarked ? colors.accent : colors.mutedForeground}
          />
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={10}>
          <Feather name="x" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});

const rowStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
});
