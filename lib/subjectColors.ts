const SUBJECT_COLORS: Record<string, string> = {
  "algebra": "#6366F1",    // indigo — distinct from the blue accent
  "science": "#10B981",    // emerald
  "history": "#F59E0B",    // amber
  "english": "#EC4899",    // pink
  "economics": "#8B5CF6",  // violet
  "cs": "#06B6D4",         // cyan
  "ap-calc-ab": "#3B82F6", // blue
  "ap-biology": "#22C55E", // green (distinct from emerald science)
  "ap-world-history": "#F97316", // orange-500
};

export function getSubjectColor(subjectId: string): string {
  return SUBJECT_COLORS[subjectId] ?? "#60A5FA";
}

export function subjectColorAlpha(subjectId: string, alpha = 0.15): string {
  const hex = getSubjectColor(subjectId).replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
