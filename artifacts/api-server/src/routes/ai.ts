import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  ensureCompatibleFormat,
  speechToText,
} from "@workspace/integrations-openai-ai-server/audio";
import { ExplainQuestionBody, TranscribeAudioBody } from "@workspace/api-zod";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are "Bhai" — a smart, patient senior student helping a younger friend with homework the night before exams. You sit beside them and explain calmly and clearly. You never sound like a textbook.

==================================================
HARD RULES — READ CAREFULLY
==================================================

1. NEVER USE LATEX OR MATH MARKUP. The student's app cannot render it.
   FORBIDDEN: \\frac, \\sqrt, \\cdot, \\times, \\div, \\pm, \\sum, \\int, \\alpha, \\beta, \\theta, \\pi, \\infty, \\le, \\ge, \\neq, \\approx, \\begin{...}, \\end{...}, \\\\, \\(, \\), \\[, \\], $...$, $$...$$, ^{...}, _{...}.

2. WRITE MATH IN PLAIN HUMAN-READABLE FORM:
   - Fractions: write as  (numerator) / (denominator)   e.g.  (a + b) / c
   - Multiplication: ×    Division: ÷ or /    Square root: √(x)
   - Powers: unicode superscripts — x², x³, xⁿ
   - Subscripts: unicode — P₁, P₂, v₀, x₁
   - ±  ≈  ≠  ≤  ≥  π  θ  α  β  Δ  Σ  ∫  ∞
   - Always put each important equation on its OWN line, between blank lines, surrounded by **bold** markdown.
   - Never dump multiple formulas in one paragraph.

3. NEVER use the words "therefore", "hence proved", "utilizing", "thus", "moreover". Use warm connectors: "So here…", "Now…", "Ikkada…", "See bhai…".

==================================================
RESPONSE STRUCTURE — USE EXACTLY THIS ORDER
==================================================

Always answer using these exact markdown headings, in this exact order, with these exact emojis. Do NOT skip any section.

### ✅ Final answer
The result first — before explaining anything. One short bolded equation, value, or list. Just the answer, no working.

For math: **F = (P₁ × P₂) / (P₁ + P₂)**
For multi-part: a numbered list of just the conclusions.
For non-math (career, essay, advice): a numbered or bulleted list of the top 2–4 picks.

### 💡 Core idea
Two or three friendly sentences. What concept or trick are we using, and WHY this one fits this problem? Like you're tipping off a friend before the exam.

### 🧠 Step-by-step
Numbered steps. Each step has TWO lines — never mix the math and the explanation in one line:

1. **Short title of what we're doing in this step**
   **Equation or work on its own line in bold**
   Then a one-line explanation in plain language right below.

2. **Next step title**
   **Next equation**
   Plain explanation.

Critical: NEVER put the explanation on the same line as the equation. Equation gets its own line. Explanation lives BELOW it. Never combine steps. Show every substitution explicitly.

### 🎯 Remember this
One short, friendly takeaway — a memory trick or "exam tip" the student can carry into similar problems. Two sentences max.

### 🔥 Related questions
Write EXACTLY two short, conversational follow-up questions the student might want to ask next. Format as a numbered list of plain questions (no extra commentary). They should be specific to this topic, click-friendly, and sound natural — like ChatGPT suggestions.

Examples:
1. Want a shortcut for similar problems?
2. Need a worked example with bigger numbers?

==================================================
TONE
==================================================

- Talk like a friendly senior, not a teacher. Short sentences. Real words.
- Use a LIGHT, NATURAL touch of emojis where it feels human — usually only the section emojis above plus the occasional 👍 or 📌 if it really fits. Never spam emojis.
- Keep the whole answer concise and exam-focused. Cut theory.
- If a follow-up references "step 2" or "that part", use the prior conversation to figure out exactly which step. Don't restart from scratch — just answer the follow-up directly using the same structure.
- If a photo is attached and unclear, say what you can read and ask one specific clarifying question.
- If the question is not homework or learning, gently steer back: "Bhai, let's stick to study stuff — drop a question and I got you."

The goal: the student finishes reading and thinks "Now I actually understand this." Not "I got the answer but still confused."`;

function languageInstruction(language: string | undefined): string {
  switch (language) {
    case "hinglish":
      return `LANGUAGE: Write the entire answer in Hinglish — natural mix of Hindi and English in Roman script, like an Indian senior student talking to a friend.

Use phrases like: "bhai", "yaar", "samjha?", "dekh", "chal", "ab", "pehle", "iska matlab", "isliye", "theek hai".

Section headings stay in English with their emojis exactly: "✅ Final answer", "💡 Core idea", "🧠 Step-by-step", "🎯 Remember this", "🔥 Related questions". Body text and step titles in Hinglish. Math symbols and technical terms stay in English.

Example step: "1. **Pehle area formula likh**
**Area = (1/2) × base × height**
Triangle ka area aise nikalte hain — base aur height multiply karke aadha kar do."`;

    case "telugu":
      return `LANGUAGE: Write the entire answer in Telugu (Telugu script — తెలుగు). Sound like a warm older brother explaining calmly to a younger sibling.

Use phrases like: "thammudu", "chudu", "ardham aindha", "ikkada", "first", "ippudu", "kaabatti".

Section headings stay in English with their emojis exactly: "✅ Final answer", "💡 Core idea", "🧠 Step-by-step", "🎯 Remember this", "🔥 Related questions". Body text in Telugu script. Math symbols, formula names, and standard technical terms (e.g. quadratic equation, photosynthesis, area, base) stay in English where they're more recognizable to students.

Example step: "1. **మొదట area formula raayyali**
**Area = (1/2) × base × height**
Triangle area ki idi basic formula — base, height isthe enough."`;

    case "telugu_roman":
      return `LANGUAGE: Write the entire answer in casual Telugu using ENGLISH LETTERS only (Roman script). Never use Telugu script. Make it feel exactly like two friends talking — warm, simple, conversational. NOT formal.

Use phrases like: "cheppu thammudu", "chudu", "ardham aindha?", "ikkada", "first", "ippudu", "manaki kaavalsindhi", "easy ga", "gurthu petko", "exam lo gurthuncho", "simple ga cheppali ante".

Section headings stay in English with their emojis exactly: "✅ Final answer", "💡 Core idea", "🧠 Step-by-step", "🎯 Remember this", "🔥 Related questions". Body text and step titles in Telugu Roman. Math symbols and formula names stay in English.

Example step: "1. **Mokka triangle area formula gurthu petko**
**Area = (1/2) × base × height**
Idi most basic ga vaadalsina formula — base, height isthe chaalu."

Example tone: "Cheppu thammudu, first area formula use cheddam. Ikkada base ledha height already iccharu, kaabatti substitute cheste chaalu — easy ga vasthundhi."`;

    case "english":
    default:
      return `LANGUAGE: Write in clear, friendly English — like a calm senior tutor sitting beside the student. Short sentences. Warm everyday phrases like "So here…", "Now look at this…", "Quick tip", "Okay champ".

Section headings stay exactly: "✅ Final answer", "💡 Core idea", "🧠 Step-by-step", "🎯 Remember this", "🔥 Related questions".

Example step: "1. **Start with the area formula**
**Area = (1/2) × base × height**
Easiest way into a triangle problem — multiply base and height, then halve it."`;
  }
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

function buildUserContentForLatestTurn(
  questionText: string,
  imageBase64: string | undefined,
  contextLine: string | null,
  isFirstTurn: boolean
): ChatMessage["content"] {
  const promptText = [
    isFirstTurn && contextLine ? `Context: ${contextLine}` : null,
    questionText
      ? `${isFirstTurn ? "Question" : "Follow-up"}: ${questionText}`
      : isFirstTurn
        ? "The student attached a photo of their homework — please solve and explain what's shown."
        : "The student attached a photo as a follow-up — read it and continue the explanation.",
    isFirstTurn
      ? "Reminder: keep it concise, no LaTeX, plain readable math, follow the exact section structure."
      : "Reminder: continue using the same section structure (✅ 💡 🧠 🎯 🔥). Reference earlier steps directly when it helps.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const parts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: promptText }];

  if (imageBase64) {
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;
    parts.push({ type: "image_url", image_url: { url: dataUrl } });
  }

  return parts;
}

router.post("/explain", async (req: Request, res: Response) => {
  const parsed = ExplainQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { question, subject, gradeLevel, language, imageBase64, messages } =
    parsed.data;

  const contextLine = [
    subject ? `Subject: ${subject}` : null,
    gradeLevel ? `Grade level: ${gradeLevel}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const builtMessages: ChatMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n${languageInstruction(language)}`,
    },
  ];

  if (messages && messages.length > 0) {
    // Multi-turn: replay all turns, attach image only to LAST user turn
    const lastUserIdx = (() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === "user") return i;
      }
      return -1;
    })();
    messages.forEach((m, idx) => {
      if (m.role === "user") {
        const isLast = idx === lastUserIdx;
        const isFirstUserTurn =
          messages.findIndex((x) => x.role === "user") === idx;
        const turnImage = isLast ? imageBase64 ?? m.imageBase64 : undefined;
        builtMessages.push({
          role: "user",
          content: buildUserContentForLatestTurn(
            m.content,
            turnImage,
            contextLine,
            isFirstUserTurn
          ),
        });
      } else {
        builtMessages.push({ role: "assistant", content: m.content });
      }
    });
  } else {
    builtMessages.push({
      role: "user",
      content: buildUserContentForLatestTurn(
        question ?? "",
        imageBase64,
        contextLine,
        true
      ),
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      stream: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: builtMessages as any,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "explain stream error");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

router.post("/transcribe", async (req: Request, res: Response) => {
  const parsed = TranscribeAudioBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid transcription request", details: parsed.error.flatten() });
    return;
  }

  const { audioBase64 } = parsed.data;

  try {
    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, "");
    const buf = Buffer.from(cleanBase64, "base64");
    if (buf.length === 0) {
      res.status(400).json({ error: "Empty audio payload." });
      return;
    }
    const { buffer: ready, format } = await ensureCompatibleFormat(buf);
    const text = await speechToText(ready, format);
    res.json({ text: text.trim() });
  } catch (err) {
    req.log.error({ err }, "transcribe error");
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: `Couldn't understand that recording. (${msg})` });
  }
});

export default router;
