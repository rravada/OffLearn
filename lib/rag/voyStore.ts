import type { Chunk } from "@/types";

interface VoyInstance {
  search: (
    query: Float32Array,
    k: number
  ) => { neighbors: { id: string; title: string; url: string }[] };
  clear: () => void;
  size: () => number;
}

interface EmbeddedResource {
  id: string;
  title: string;
  url: string;
  embeddings: number[];
}

type FeatureExtractor = (texts: string[], opts: Record<string, unknown>) => Promise<{ tolist: () => number[][] }>;

let voyInstance: VoyInstance | null = null;
let embeddingPipeline: FeatureExtractor | null = null;
let chunkMap: Map<string, string> = new Map();

async function getEmbeddingPipeline(): Promise<FeatureExtractor> {
  if (embeddingPipeline) return embeddingPipeline;

  const { pipeline } = await import("@xenova/transformers");
  embeddingPipeline = (await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
  )) as FeatureExtractor;

  return embeddingPipeline;
}

async function embed(texts: string[]): Promise<number[][]> {
  const extractor = await getEmbeddingPipeline();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  return output.tolist() as number[][];
}

export async function indexChunks(chunks: Chunk[]): Promise<void> {
  const { Voy: VoyClass } = await import("voy-search");

  const batchSize = 8;
  const embeddedResources: EmbeddedResource[] = [];

  chunkMap = new Map();
  for (const chunk of chunks) {
    chunkMap.set(chunk.id, chunk.text);
  }

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const texts = batch.map((c) => c.text);
    const embeddings = await embed(texts);

    for (let j = 0; j < batch.length; j++) {
      embeddedResources.push({
        id: batch[j].id,
        title: batch[j].text.slice(0, 60),
        url: `/chunk/${batch[j].id}`,
        embeddings: embeddings[j],
      });
    }
  }

  voyInstance = new VoyClass({ embeddings: embeddedResources });
}

export async function queryRelevant(
  userMessage: string,
  k = 3
): Promise<string[]> {
  if (!voyInstance) return [];

  const [queryEmbedding] = await embed([userMessage]);
  const results = voyInstance.search(new Float32Array(queryEmbedding), k);

  return results.neighbors
    .map((n) => chunkMap.get(n.id))
    .filter((text): text is string => text !== undefined);
}

export function clearIndex(): void {
  voyInstance?.clear();
  voyInstance = null;
  chunkMap.clear();
}

export function isIndexReady(): boolean {
  return voyInstance !== null && voyInstance.size() > 0;
}
