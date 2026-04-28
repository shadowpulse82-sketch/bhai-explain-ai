import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

/**
 * Tiny markdown renderer for the assistant's reply.
 *
 * Supports:
 *   - # / ## / ### headings
 *   - **bold** inline
 *   - `code` inline
 *   - 1. / - / * lists
 *   - blockquotes (> ...)
 *   - paragraphs
 *
 * No external deps; intentionally minimal.
 */

type Token =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "li"; text: string; ordered: boolean; index: number }
  | { type: "quote"; text: string }
  | { type: "p"; text: string }
  | { type: "code"; text: string };

function tokenize(src: string): Token[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const tokens: Token[] = [];
  let paragraph: string[] = [];
  let codeBuf: string[] | null = null;
  let orderedIndex = 0;

  const flushParagraph = () => {
    if (paragraph.length) {
      tokens.push({ type: "p", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (codeBuf) {
      if (line.trim().startsWith("```")) {
        tokens.push({ type: "code", text: codeBuf.join("\n") });
        codeBuf = null;
      } else {
        codeBuf.push(raw);
      }
      continue;
    }

    if (line.trim().startsWith("```")) {
      flushParagraph();
      codeBuf = [];
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      orderedIndex = 0;
      continue;
    }

    if (line.startsWith("### ")) {
      flushParagraph();
      tokens.push({ type: "h3", text: line.slice(4).trim() });
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      tokens.push({ type: "h2", text: line.slice(3).trim() });
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      tokens.push({ type: "h1", text: line.slice(2).trim() });
      continue;
    }
    if (line.trim().startsWith("> ")) {
      flushParagraph();
      tokens.push({ type: "quote", text: line.trim().slice(2) });
      continue;
    }

    const orderedMatch = line.match(/^\s*(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      orderedIndex += 1;
      tokens.push({
        type: "li",
        text: orderedMatch[2] ?? "",
        ordered: true,
        index: orderedIndex,
      });
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph();
      tokens.push({
        type: "li",
        text: line.replace(/^\s*[-*]\s+/, ""),
        ordered: false,
        index: 0,
      });
      continue;
    }

    paragraph.push(line);
  }

  if (codeBuf) tokens.push({ type: "code", text: codeBuf.join("\n") });
  flushParagraph();
  return tokens;
}

function Inline({
  text,
  style,
}: {
  text: string;
  style?: { color?: string; fontFamily?: string; fontSize?: number };
}) {
  const colors = useColors();
  const parts = useMemo(() => {
    const out: Array<{ text: string; bold?: boolean; code?: boolean }> = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push({ text: text.slice(last, m.index) });
      const tok = m[0];
      if (tok.startsWith("**")) {
        out.push({ text: tok.slice(2, -2), bold: true });
      } else {
        out.push({ text: tok.slice(1, -1), code: true });
      }
      last = m.index + tok.length;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out;
  }, [text]);

  return (
    <Text style={style}>
      {parts.map((p, i) => {
        if (p.code) {
          return (
            <Text
              key={i}
              style={{
                fontFamily: "Inter_500Medium",
                backgroundColor: colors.muted,
                color: colors.foreground,
                paddingHorizontal: 4,
                borderRadius: 4,
              }}
            >
              {p.text}
            </Text>
          );
        }
        if (p.bold) {
          return (
            <Text
              key={i}
              style={{ fontFamily: "Inter_700Bold", color: style?.color }}
            >
              {p.text}
            </Text>
          );
        }
        return <Text key={i}>{p.text}</Text>;
      })}
    </Text>
  );
}

export function Markdown({
  source,
  color,
}: {
  source: string;
  color?: string;
}) {
  const colors = useColors();
  const tokens = useMemo(() => tokenize(source), [source]);
  const textColor = color ?? colors.foreground;

  return (
    <View style={{ gap: 10 }}>
      {tokens.map((t, i) => {
        if (t.type === "h1") {
          return (
            <Inline
              key={i}
              text={t.text}
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 22,
                color: textColor,
              }}
            />
          );
        }
        if (t.type === "h2") {
          return (
            <Inline
              key={i}
              text={t.text}
              style={{
                fontFamily: "Poppins_700Bold",
                fontSize: 18,
                color: textColor,
              }}
            />
          );
        }
        if (t.type === "h3") {
          return (
            <Inline
              key={i}
              text={t.text}
              style={{
                fontFamily: "Poppins_600SemiBold",
                fontSize: 16,
                color: textColor,
              }}
            />
          );
        }
        if (t.type === "li") {
          return (
            <View
              key={i}
              style={{ flexDirection: "row", gap: 8, paddingLeft: 4 }}
            >
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 15,
                  color: colors.primary,
                  lineHeight: 22,
                  minWidth: 18,
                }}
              >
                {t.ordered ? `${t.index}.` : "•"}
              </Text>
              <Inline
                text={t.text}
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 15,
                  color: textColor,
                  lineHeight: 22,
                  flex: 1,
                }}
              />
            </View>
          );
        }
        if (t.type === "quote") {
          return (
            <View
              key={i}
              style={{
                borderLeftWidth: 3,
                borderLeftColor: colors.accent,
                paddingLeft: 10,
                paddingVertical: 2,
              }}
            >
              <Inline
                text={t.text}
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 15,
                  color: colors.mutedForeground,
                  lineHeight: 22,
                }}
              />
            </View>
          );
        }
        if (t.type === "code") {
          return (
            <View
              key={i}
              style={{
                backgroundColor: colors.muted,
                borderRadius: 10,
                padding: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: "Inter_500Medium",
                  fontSize: 13,
                  color: textColor,
                }}
              >
                {t.text}
              </Text>
            </View>
          );
        }
        return (
          <Inline
            key={i}
            text={t.text}
            style={{
              fontFamily: "Inter_400Regular",
              fontSize: 15,
              color: textColor,
              lineHeight: 22,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({});
