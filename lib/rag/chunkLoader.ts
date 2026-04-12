import type { KnowledgePack, Chunk } from "@/types";

const CHUNK_CHAR_LIMIT = 800;

export async function loadPack(packId: string): Promise<KnowledgePack> {
  const res = await fetch(`/knowledge-packs/${packId}.json`);
  if (!res.ok) {
    throw new Error(`Failed to load knowledge pack: ${packId}`);
  }
  return res.json() as Promise<KnowledgePack>;
}

export function chunkText(pack: KnowledgePack): Chunk[] {
  const result: Chunk[] = [];

  for (const section of pack.chunks) {
    const text = section.text.trim();
    if (text.length <= CHUNK_CHAR_LIMIT) {
      result.push({ id: section.id, text, packId: pack.id });
      continue;
    }

    const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text];
    let buffer = "";
    let partIdx = 0;

    for (const sentence of sentences) {
      if (buffer.length + sentence.length > CHUNK_CHAR_LIMIT && buffer.length > 0) {
        result.push({
          id: `${section.id}_p${partIdx}`,
          text: buffer.trim(),
          packId: pack.id,
        });
        partIdx++;
        buffer = "";
      }
      buffer += sentence;
    }

    if (buffer.trim().length > 0) {
      result.push({
        id: `${section.id}_p${partIdx}`,
        text: buffer.trim(),
        packId: pack.id,
      });
    }
  }

  return result;
}

export function getAvailablePacks(): { id: string; title: string; subject: string }[] {
  return [
    { id: "biology-krebs", title: "The Krebs Cycle", subject: "Biology" },
    { id: "physics-newton", title: "Newton's Laws of Motion", subject: "Physics" },
  ];
}
