import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  StoredMessage,
  MasteryEntry,
  Session,
  TeacherModule,
  AssessmentResult,
  Profile,
  ProgressEntry,
} from "@/types";

interface OffLearnDB extends DBSchema {
  sessions: {
    key: string;
    value: Session;
  };
  messages: {
    key: string;
    value: StoredMessage;
    indexes: { "by-session": string };
  };
  mastery: {
    key: string;
    value: MasteryEntry;
  };
  meta: {
    key: string;
    value: { key: string; value: string };
  };
  teacherModules: {
    key: string;
    value: TeacherModule;
  };
  assessmentResults: {
    key: string;
    value: AssessmentResult;
  };
  profiles: {
    key: string;
    value: Profile;
  };
  progress: {
    key: string;
    value: ProgressEntry;
    indexes: { "by-profile": string };
  };
}

const DB_NAME = "offlearn";
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase<OffLearnDB>> | null = null;

function getDB(): Promise<IDBPDatabase<OffLearnDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OffLearnDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("sessions", { keyPath: "id" });
          const msgStore = db.createObjectStore("messages", { keyPath: "id" });
          msgStore.createIndex("by-session", "sessionId");
          db.createObjectStore("mastery", { keyPath: "concept" });
          db.createObjectStore("meta", { keyPath: "key" });
        }
        if (oldVersion < 2) {
          db.createObjectStore("teacherModules", { keyPath: "id" });
        }
        if (oldVersion < 3) {
          db.createObjectStore("assessmentResults", { keyPath: "assessmentId" });
        }
        if (oldVersion < 4) {
          db.createObjectStore("profiles", { keyPath: "id" });
          const progStore = db.createObjectStore("progress", { keyPath: "id" });
          progStore.createIndex("by-profile", "profileId");
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Ask the browser to keep our IndexedDB data from being evicted under storage
 * pressure. Best-effort and safe to call repeatedly — the whole point of the
 * app is that a student's profiles/progress survive offline indefinitely.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.storage &&
      typeof navigator.storage.persist === "function"
    ) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* ignore — non-critical */
  }
  return false;
}

// --- Sessions ---

export async function createSession(session: Session): Promise<void> {
  const db = await getDB();
  await db.put("sessions", session);
}

export async function getSession(id: string): Promise<Session | undefined> {
  const db = await getDB();
  return db.get("sessions", id);
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDB();
  return db.getAll("sessions");
}

export async function updateSession(
  id: string,
  updates: Partial<Omit<Session, "id">>
): Promise<void> {
  const db = await getDB();
  const existing = await db.get("sessions", id);
  if (existing) {
    await db.put("sessions", { ...existing, ...updates });
  }
}

// --- Messages ---

export async function addMessage(msg: StoredMessage): Promise<void> {
  const db = await getDB();
  await db.put("messages", msg);
}

export async function getSessionMessages(
  sessionId: string
): Promise<StoredMessage[]> {
  const db = await getDB();
  return db.getAllFromIndex("messages", "by-session", sessionId);
}

export async function deleteSession(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("sessions", id);
}

export async function deleteSessionMessages(sessionId: string): Promise<void> {
  const db = await getDB();
  const msgs = await db.getAllFromIndex("messages", "by-session", sessionId);
  const tx = db.transaction("messages", "readwrite");
  await Promise.all(msgs.map((m) => tx.store.delete(m.id)));
  await tx.done;
}

// --- Mastery ---

export async function upsertMastery(entry: MasteryEntry): Promise<void> {
  const db = await getDB();
  await db.put("mastery", entry);
}

export async function getMastery(
  concept: string
): Promise<MasteryEntry | undefined> {
  const db = await getDB();
  return db.get("mastery", concept);
}

export async function getAllMastery(): Promise<MasteryEntry[]> {
  const db = await getDB();
  return db.getAll("mastery");
}

// --- Meta (generic key-value for flags like "model_cached") ---

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.put("meta", { key, value });
}

export async function getMeta(key: string): Promise<string | undefined> {
  const db = await getDB();
  const record = await db.get("meta", key);
  return record?.value;
}

// --- Teacher Modules ---

export async function saveTeacherModule(module: TeacherModule): Promise<void> {
  const db = await getDB();
  await db.put("teacherModules", module);
}

export async function getTeacherModules(): Promise<TeacherModule[]> {
  const db = await getDB();
  return db.getAll("teacherModules");
}

export async function getTeacherModule(
  id: string
): Promise<TeacherModule | undefined> {
  const db = await getDB();
  return db.get("teacherModules", id);
}

export async function deleteTeacherModule(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("teacherModules", id);
}

// --- Assessment Results ---

export async function saveAssessmentResult(result: AssessmentResult): Promise<void> {
  const db = await getDB();
  await db.put("assessmentResults", result);
}

export async function getAssessmentResult(
  assessmentId: string
): Promise<AssessmentResult | null> {
  const db = await getDB();
  return (await db.get("assessmentResults", assessmentId)) ?? null;
}

// --- Profiles (local-first, per-device) ---

export async function createProfile(profile: Profile): Promise<void> {
  const db = await getDB();
  await db.put("profiles", profile);
  void requestPersistentStorage();
}

export async function getAllProfiles(): Promise<Profile[]> {
  const db = await getDB();
  const all = await db.getAll("profiles");
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getProfile(id: string): Promise<Profile | undefined> {
  const db = await getDB();
  return db.get("profiles", id);
}

export async function updateProfile(
  id: string,
  updates: Partial<Omit<Profile, "id">>
): Promise<void> {
  const db = await getDB();
  const existing = await db.get("profiles", id);
  if (existing) {
    await db.put("profiles", { ...existing, ...updates });
  }
}

/**
 * Delete a profile and every record namespaced to it — progress, tutor
 * sessions (vaultId prefixed `${profileId}:`) and their messages — so no
 * orphaned data is left behind on the device.
 */
export async function deleteProfile(id: string): Promise<void> {
  const db = await getDB();

  // Progress entries for this profile.
  const progressKeys = await db.getAllKeysFromIndex(
    "progress",
    "by-profile",
    id
  );
  {
    const tx = db.transaction("progress", "readwrite");
    await Promise.all(progressKeys.map((k) => tx.store.delete(k)));
    await tx.done;
  }

  // Tutor sessions + messages namespaced to this profile.
  const sessions = await db.getAll("sessions");
  const owned = sessions.filter((s) => s.vaultId?.startsWith(`${id}:`));
  for (const s of owned) {
    const msgs = await db.getAllFromIndex("messages", "by-session", s.id);
    const tx = db.transaction("messages", "readwrite");
    await Promise.all(msgs.map((m) => tx.store.delete(m.id)));
    await tx.done;
    await db.delete("sessions", s.id);
  }

  await db.delete("profiles", id);
}

// --- Progress (per-profile lesson completion + activity) ---

function progressId(
  profileId: string,
  subjectId: string,
  unitId: string,
  lessonId: string
): string {
  return `${profileId}:${subjectId}/${unitId}/${lessonId}`;
}

export async function markLessonComplete(
  profileId: string,
  subjectId: string,
  unitId: string,
  lessonId: string
): Promise<void> {
  const db = await getDB();
  await db.put("progress", {
    id: progressId(profileId, subjectId, unitId, lessonId),
    profileId,
    subjectId,
    unitId,
    lessonId,
    completedAt: Date.now(),
  });
}

export async function isLessonComplete(
  profileId: string,
  subjectId: string,
  unitId: string,
  lessonId: string
): Promise<boolean> {
  const db = await getDB();
  const entry = await db.get(
    "progress",
    progressId(profileId, subjectId, unitId, lessonId)
  );
  return !!entry;
}

export async function getProgressForProfile(
  profileId: string
): Promise<ProgressEntry[]> {
  const db = await getDB();
  return db.getAllFromIndex("progress", "by-profile", profileId);
}

function todayKey(): string {
  // Local-date 'YYYY-MM-DD' so a streak follows the student's own day.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Record that a profile was active (opened a lesson) and remember it for the
 * dashboard "resume" button. Updates the activity day set for streaks.
 */
export async function recordActivity(
  profileId: string,
  lesson: NonNullable<Profile["lastLesson"]>
): Promise<void> {
  const db = await getDB();
  const profile = await db.get("profiles", profileId);
  if (!profile) return;
  const days = new Set(profile.activeDays ?? []);
  days.add(todayKey());
  await db.put("profiles", {
    ...profile,
    activeDays: Array.from(days).sort(),
    lastLesson: lesson,
  });
}

/** Consecutive-day streak ending today or yesterday. */
export function computeStreak(activeDays: string[] | undefined): number {
  if (!activeDays || activeDays.length === 0) return 0;
  const set = new Set(activeDays);
  const cursor = new Date();
  // Allow the streak to "hold" if they haven't studied yet today.
  if (!set.has(formatDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(formatDate(cursor))) return 0;
  }
  let streak = 0;
  while (set.has(formatDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
