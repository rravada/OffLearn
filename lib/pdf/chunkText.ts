export interface PDFChunk {
  id: string;
  text: string;
  index: number;
}

export function chunkText(
  text: string,
  chunkSize = 400,
  overlap = 80
): PDFChunk[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: PDFChunk[] = [];
  let i = 0;
  while (i < words.length) {
    const slice = words.slice(i, i + chunkSize).join(" ");
    chunks.push({ id: `chunk-${i}`, text: slice, index: chunks.length });
    i += chunkSize - overlap;
  }
  return chunks;
}
