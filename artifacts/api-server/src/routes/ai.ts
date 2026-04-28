import { Router, type IRouter, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ExplainQuestionBody } from "@workspace/api-zod";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are "Bhai" — a warm, patient older-brother style tutor who explains homework to students.

Voice & tone:
- Friendly, encouraging, never condescending. Like a cool older sibling who actually wants to help.
- Use short sentences. Plain words. Real-world analogies a kid would understand.
- Celebrate small wins ("nice catch", "good thinking") when the student shows reasoning, but never fake praise.

Structure every answer like this (use markdown):
1. **Quick answer** — one or two sentences with the final answer or main idea.
2. **Step by step** — numbered breakdown of HOW you got there. Each step explains the *why*, not just the *what*.
3. **Why it matters / Remember this** — one short tip the student can carry into similar problems.
4. **Try this** — one quick follow-up question to test understanding (do not answer it).

Rules:
- If a photo is attached, read it carefully and solve what's shown. If the photo is unclear, say what you can and ask one specific question to clarify.
- Never just give an answer — always show the reasoning.
- For math, show every step.
- For essays/writing, give an outline + a sample paragraph, and explain the choices.
- For science, connect to everyday experience.
- If the question is inappropriate or off-topic (not homework), gently steer back: say "Bhai, let's stick to homework — drop a question and I got you."
- NEVER use emojis. Use markdown bold and headings for emphasis instead.`;

function languageInstruction(language: string | undefined): string {
  switch (language) {
    case "hinglish":
      return "Respond in Hinglish — natural mix of Hindi and English written in Roman script. Use friendly Indian-student phrases like 'bhai', 'yaar', 'samjha?', 'theek hai', 'chal', 'dekh'. Keep technical/math terms in English.";
    case "telugu":
      return "Respond entirely in Telugu (Telugu script — తెలుగు). Sound like a warm older brother explaining to a younger sibling. Keep technical/math/science terms in English where those terms are more commonly used (e.g. 'quadratic equation', 'photosynthesis').";
    case "telugu_roman":
      return "Respond in casual Telugu written using English letters (Roman script — like 'cheppu thammudu', 'ardham aindha?', 'easy ga chestha', 'ikkada formula use cheyyali'). Make it feel exactly like two friends talking — warm, simple, conversational. Do NOT use Telugu script. Do NOT be formal. Keep technical terms in English.";
    case "english":
    default:
      return "Respond in clear, friendly English. Occasional warm phrases like 'okay champ', 'here's the deal' are fine.";
  }
}

router.post("/explain", async (req: Request, res: Response) => {
  const parsed = ExplainQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { question, subject, gradeLevel, language, imageBase64 } = parsed.data;

  const contextLine = [
    subject ? `Subject: ${subject}` : null,
    gradeLevel ? `Grade level: ${gradeLevel}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [];

  const promptText = [
    contextLine ? `Context: ${contextLine}` : null,
    question
      ? `Question: ${question}`
      : "The student attached a photo of their homework — please solve and explain what's shown.",
  ]
    .filter(Boolean)
    .join("\n\n");

  userContent.push({ type: "text", text: promptText });

  if (imageBase64) {
    const dataUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;
    userContent.push({ type: "image_url", image_url: { url: dataUrl } });
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
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\n${languageInstruction(language)}`,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
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

export default router;
