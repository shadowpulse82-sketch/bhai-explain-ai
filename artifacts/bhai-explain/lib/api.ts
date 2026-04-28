/**
 * Lightweight client for the streaming /api/ai/explain endpoint.
 *
 * Expo bundles run outside the web proxy so we hit the absolute domain
 * exposed via EXPO_PUBLIC_DOMAIN (or fall back to a relative URL on web).
 */

import "@stardazed/streams-text-encoding";

export type ExplainParams = {
  question: string;
  subject?: string;
  gradeLevel?: string;
  language?: "english" | "hinglish" | "telugu" | "telugu_roman";
  imageBase64?: string;
};

function friendlyHttpError(status: number, body: string): string {
  if (status === 413) {
    return "That photo is too big to send. Try snapping a smaller picture or zooming in on just the question.";
  }
  if (status === 408 || status === 504) {
    return "Network took too long. Check your connection and try again.";
  }
  if (status === 429) {
    return "Bhai is getting too many questions right now. Take a breath and try again in a sec.";
  }
  if (status >= 500) {
    return "Bhai's brain hiccuped. Try again — it usually works the second time.";
  }
  if (status === 400) {
    try {
      const parsed = JSON.parse(body);
      if (parsed?.error) return String(parsed.error);
    } catch {
      // ignore
    }
    return "That question couldn't be sent. Try rewriting it or removing the photo.";
  }
  return "Something didn't work. Try again in a moment.";
}

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain && domain.length > 0) {
    return `https://${domain}`;
  }
  return "";
}

export type ExplainEvent =
  | { type: "chunk"; content: string }
  | { type: "done" }
  | { type: "error"; error: string };

export async function streamExplain(
  params: ExplainParams,
  onEvent: (e: ExplainEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/api/ai/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal,
  });

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      // ignore
    }
    onEvent({ type: "error", error: friendlyHttpError(res.status, detail) });
    return;
  }

  if (!res.body) {
    onEvent({ type: "error", error: "No response body from server." });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const evt of events) {
        const line = evt.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) {
            onEvent({ type: "error", error: String(parsed.error) });
            return;
          }
          if (parsed.done) {
            onEvent({ type: "done" });
            return;
          }
          if (typeof parsed.content === "string") {
            onEvent({ type: "chunk", content: parsed.content });
          }
        } catch {
          // ignore malformed event
        }
      }
    }
    onEvent({ type: "done" });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      return;
    }
    const raw = err instanceof Error ? err.message : "";
    const lower = raw.toLowerCase();
    let friendly = "Connection dropped. Try again in a sec.";
    if (lower.includes("network") || lower.includes("fetch")) {
      friendly = "Weak internet detected. Check your connection and try again.";
    } else if (lower.includes("timeout")) {
      friendly = "That took too long. Try again with a stronger signal.";
    }
    onEvent({ type: "error", error: friendly });
  }
}
