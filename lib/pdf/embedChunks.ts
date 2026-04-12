import { pipeline } from "@xenova/transformers";

type Embedder = (
  texts: string,
  opts: Record<string, unknown>
) => Promise<{ data: Float32Array }>;

let embedder: Embedder | null = null;

async function getEmbedder(): Promise<Embedder> {
  if (!embedder) {
    embedder = (await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    )) as unknown as Embedder;
  }
  return embedder;
}

export async function embedText(text: string): Promise<number[]> {
  const embed = await getEmbedder();
  const output = await embed(text, { pooling: "mean", normalize: true });
  return Array.from(output.data as Float32Array);
}

export async function embedChunks(
  chunks: { id: string; text: string }[],
  onProgress?: (pct: number) => void
): Promise<{ id: string; text: string; embedding: number[] }[]> {
  const embed = await getEmbedder();
  const results: { id: string; text: string; embedding: number[] }[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const output = await embed(chunks[i].text, {
      pooling: "mean",
      normalize: true,
    });
    results.push({
      id: chunks[i].id,
      text: chunks[i].text,
      embedding: Array.from(output.data as Float32Array),
    });
    onProgress?.(Math.round(((i + 1) / chunks.length) * 100));
  }
  return results;
}
