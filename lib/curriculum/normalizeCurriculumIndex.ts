import type {
  CurriculumIndex,
  CurriculumLesson,
  CurriculumSubject,
  CurriculumTrack,
  CurriculumUnit,
} from "@/types";

function isTrack(v: unknown): v is CurriculumTrack {
  return v === "standard" || v === "ap" || v === "college-prep";
}

function normalizeLesson(raw: unknown): CurriculumLesson | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const title = typeof o.title === "string" ? o.title : id || "Lesson";
  const duration = typeof o.duration === "string" ? o.duration : "";
  if (!id) return null;
  return { id, title, duration };
}

function normalizeUnit(raw: unknown): CurriculumUnit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const title = typeof o.title === "string" ? o.title : id || "Unit";
  if (!id) return null;
  const lessonsRaw = Array.isArray(o.lessons) ? o.lessons : [];
  const lessons = lessonsRaw
    .map(normalizeLesson)
    .filter((l): l is CurriculumLesson => l !== null);
  return { id, title, lessons };
}

function normalizeSubject(raw: unknown): CurriculumSubject | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const title = typeof o.title === "string" ? o.title : id || "Subject";
  const icon = typeof o.icon === "string" ? o.icon : "book";
  if (!id) return null;
  const track = isTrack(o.track) ? o.track : undefined;
  const unitsRaw = Array.isArray(o.units) ? o.units : [];
  const units = unitsRaw
    .map(normalizeUnit)
    .filter((u): u is CurriculumUnit => u !== null);
  return { id, title, icon, track, units };
}

/** Ensures curriculum JSON always matches runtime expectations (offline errors, partial data). */
export function normalizeCurriculumIndex(raw: unknown): CurriculumIndex | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if ("error" in o && typeof o.error === "string") return null;
  if (!Array.isArray(o.subjects)) return null;
  const subjects = o.subjects
    .map(normalizeSubject)
    .filter((s): s is CurriculumSubject => s !== null);
  return { subjects };
}
