interface VoyInstance {
  search: (
    query: Float32Array,
    k: number
  ) => { neighbors: { id: string; title: string; url: string }[] };
}

const indexes = new Map<string, VoyInstance>();

export async function buildIndex(
  moduleId: string,
  embeddings: { id: string; text: string; embedding: number[] }[]
) {
  const { Voy } = await import("voy-search");

  const resource = {
    embeddings: embeddings.map((e) => ({
      id: e.id,
      title: e.text.slice(0, 60),
      url: e.id,
      embeddings: e.embedding,
    })),
  };
  indexes.set(moduleId, new Voy(resource));
}

export function searchModule(
  moduleId: string,
  queryEmbedding: number[],
  k = 3
): string[] {
  const index = indexes.get(moduleId);
  if (!index) return [];
  const results = index.search(new Float32Array(queryEmbedding), k);
  return results.neighbors.map((n) => n.title);
}

export function isModuleIndexed(moduleId: string): boolean {
  return indexes.has(moduleId);
}
