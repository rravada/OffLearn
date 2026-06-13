import type { LessonData } from "@/types";

/**
 * Lightweight, fully-offline grounding for the tutor.
 *
 * Real embedding RAG (voyStore) needs the MiniLM model, which would break the
 * "copy the app onto a thumb drive and run with no wifi" requirement unless that
 * model is also bundled. The lesson JSON, by contrast, is already precached and
 * held in memory, so we ground the tutor on it directly with deterministic
 * keyword retrieval — no models, no network, instant.
 */

interface KnowledgeChunk {
  heading: string;
  text: string;
  /** Summary chunks (keypoints / "remember") are always worth including. */
  priority: boolean;
}

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "your", "with", "this",
  "that", "what", "why", "how", "does", "did", "was", "were", "can", "could",
  "would", "should", "from", "into", "about", "they", "them", "their", "which",
  "when", "where", "who", "whom", "his", "her", "its", "our", "out", "use",
  "used", "using", "have", "has", "had", "been", "being", "than", "then",
  "there", "here", "some", "any", "all", "one", "two", "more", "most", "such",
  "also", "between", "explain", "tell", "give", "help", "understand", "mean",
  "means", "difference", "example", "examples", "question", "answer",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function truncate(text: string, max = 600): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max).trimEnd()}…`;
}

/** Flatten a lesson's sections into retrievable text chunks. */
function buildLessonChunks(lesson: LessonData): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  const sections = Array.isArray(lesson.sections) ? lesson.sections : [];

  for (const s of sections) {
    switch (s.type) {
      case "explanation":
      case "deepdive":
      case "example":
        chunks.push({ heading: s.heading ?? lesson.title, text: s.content, priority: false });
        break;
      case "callout":
        chunks.push({
          heading: s.heading ?? "Note",
          text: s.content,
          priority: s.variant === "remember",
        });
        break;
      case "keypoint":
        chunks.push({ heading: "Key point", text: s.content, priority: true });
        break;
      case "steps":
        chunks.push({
          heading: s.heading ?? "Steps",
          text: s.steps.map((st) => `${st.title}: ${st.content}`).join(" "),
          priority: false,
        });
        break;
      case "quiz":
        chunks.push({
          heading: "Check question",
          text: `${s.question} Correct answer: ${s.options[s.correctIndex]}. ${s.explanation}`,
          priority: false,
        });
        break;
      case "table":
        chunks.push({
          heading: s.heading ?? "Reference table",
          text: s.rows.map((r) => r.join(" — ")).join("; "),
          priority: false,
        });
        break;
    }
  }
  return chunks;
}

/**
 * Return the most relevant lesson material for a question, as a plain-text block
 * bounded by `budget` characters. Priority (summary) chunks are always seeded so
 * generic questions ("explain this", "I'm confused") still get grounded.
 */
export function retrieveLessonContext(
  lesson: LessonData,
  query: string,
  budget = 1500
): string {
  const chunks = buildLessonChunks(lesson);
  if (chunks.length === 0) return "";

  const qWords = new Set(tokenize(query));
  const scored = chunks.map((c, idx) => {
    let score = 0;
    for (const w of tokenize(`${c.heading} ${c.text}`)) {
      if (qWords.has(w)) score++;
    }
    return { c, idx, score };
  });

  // Best keyword matches first; ties keep lesson order.
  const byScore = [...scored].sort((a, b) => b.score - a.score || a.idx - b.idx);

  const picked: KnowledgeChunk[] = [];
  const seen = new Set<number>();

  const tryAdd = (idx: number, c: KnowledgeChunk) => {
    if (seen.has(idx)) return;
    seen.add(idx);
    picked.push(c);
  };

  // Always seed one summary chunk for grounding.
  const prioritySeed = scored.find((s) => s.c.priority);
  if (prioritySeed) tryAdd(prioritySeed.idx, prioritySeed.c);

  for (const { c, idx, score } of byScore) {
    if (picked.length >= 4) break;
    // Once matches run out, stop adding noise (but we always kept the seed).
    if (score === 0 && picked.length > 0) break;
    tryAdd(idx, c);
  }

  // Fallback: nothing matched and no priority chunk — use the first section.
  if (picked.length === 0) tryAdd(0, chunks[0]);

  let used = 0;
  const blocks: string[] = [];
  for (const c of picked) {
    const block = `${c.heading}: ${truncate(c.text)}`;
    if (used + block.length > budget && blocks.length > 0) break;
    blocks.push(block);
    used += block.length;
  }

  return blocks.join("\n\n");
}

/** Build the tutor persona prompt for a lesson (non-Socratic, plain text). */
export function buildLessonSystemPrompt(lesson: LessonData): string {
  return `You are a friendly, clear tutor helping a high school student with the lesson "${lesson.title}" (${lesson.subject} — ${lesson.unit}).

How to respond:
- Answer the question directly and correctly first, explained simply.
- Base every answer on the lesson material provided below. If the lesson does not cover something, say so briefly instead of guessing.
- Ask at most one short follow-up question, and only when it truly helps. Do NOT end every reply with a question.
- Keep replies concise: usually 2 to 5 sentences. Stop once the question is answered.
- Write in plain English sentences only — no markdown, asterisks, headings, bullet symbols, or LaTeX.
- Respond only in English. Reply once as the tutor and stop; never write the student's side.
- If the question is unrelated to this lesson, gently steer back to "${lesson.title}".`;
}

/** Generic persona used when no specific lesson is open (e.g. browsing). */
export const GENERIC_TUTOR_PROMPT = `You are a friendly, clear study tutor for a high school student.
Answer directly and correctly, explained simply, in 2 to 5 sentences. Ask at most one follow-up question and only when it helps. Write in plain English only — no markdown, asterisks, headings, or LaTeX. Respond only in English, and reply once without writing the student's side.`;
