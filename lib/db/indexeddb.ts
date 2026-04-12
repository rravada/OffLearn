import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { StoredMessage, MasteryEntry, Session } from "@/types";

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
}

const DB_NAME = "offlearn";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<OffLearnDB>> | null = null;

function getDB(): Promise<IDBPDatabase<OffLearnDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OffLearnDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("sessions", { keyPath: "id" });

        const msgStore = db.createObjectStore("messages", { keyPath: "id" });
        msgStore.createIndex("by-session", "sessionId");

        db.createObjectStore("mastery", { keyPath: "concept" });
        db.createObjectStore("meta", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
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
