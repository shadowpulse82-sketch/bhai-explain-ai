/**
 * Splits the assistant's markdown reply into the main body and the trailing
 * "Related questions" suggestions, so the UI can render them as clickable chips.
 */

const RELATED_HEADING = /^#{1,4}\s*(?:🔥\s*)?related\s+questions?\s*$/im;

function cleanListItem(text: string): string {
  return text
    .replace(/^\*+|\*+$/g, "")
    .replace(/^"|"$/g, "")
    .replace(/^\s*[-*•]\s+/, "")
    .trim();
}

export type ParsedAnswer = {
  body: string;
  related: string[];
};

export function parseAnswer(source: string): ParsedAnswer {
  if (!source) return { body: "", related: [] };

  const match = source.match(RELATED_HEADING);
  if (!match || match.index === undefined) {
    return { body: source.trimEnd(), related: [] };
  }

  const body = source.slice(0, match.index).trimEnd();
  const tail = source.slice(match.index + match[0].length).trim();

  const related: string[] = [];
  const lines = tail.split("\n");
  let foundFirstItem = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) break;
    const numbered = line.match(/^(?:\d+[.)]|[-*•])\s+(.+)$/);
    if (numbered && numbered[1]) {
      foundFirstItem = true;
      const cleaned = cleanListItem(numbered[1]);
      if (cleaned) related.push(cleaned);
    } else if (!foundFirstItem && related.length === 0) {
      const cleaned = cleanListItem(line);
      if (cleaned) related.push(cleaned);
    }
    if (related.length >= 4) break;
  }

  return { body, related: related.slice(0, 4) };
}
