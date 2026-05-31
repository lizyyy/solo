import { openDB, type IDBPDatabase } from "idb";
import type {
  OrbitalElement,
  TelemetrySegment,
  WindowTable,
  OcclusionEvent,
  MissingFrameAlert,
  ReviewRecord,
  ReviewHistory,
} from "@/types";

const DB_NAME = "star-sensor-occlusion";
const DB_VERSION = 1;

type DBSchema = {
  orbital_elements: OrbitalElement;
  telemetry_segments: TelemetrySegment;
  window_tables: WindowTable;
  occlusion_events: OcclusionEvent;
  missing_frame_alerts: MissingFrameAlert;
  review_records: ReviewRecord;
  review_history: ReviewHistory;
};

const STORE_NAMES = [
  "orbital_elements",
  "telemetry_segments",
  "window_tables",
  "occlusion_events",
  "missing_frame_alerts",
  "review_records",
  "review_history",
] as const;

type StoreName = (typeof STORE_NAMES)[number];

let dbInstance: IDBPDatabase<DBSchema> | null = null;

export async function getDB(): Promise<IDBPDatabase<DBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<DBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("orbital_elements")) {
        const s = db.createObjectStore("orbital_elements", { keyPath: "id" });
        s.createIndex("epochTime", "epochTime");
      }
      if (!db.objectStoreNames.contains("telemetry_segments")) {
        const s = db.createObjectStore("telemetry_segments", { keyPath: "id" });
        s.createIndex("startTime", "startTime");
        s.createIndex("starSensorId", "starSensorId");
      }
      if (!db.objectStoreNames.contains("window_tables")) {
        const s = db.createObjectStore("window_tables", { keyPath: "id" });
        s.createIndex("startTime", "startTime");
      }
      if (!db.objectStoreNames.contains("occlusion_events")) {
        const s = db.createObjectStore("occlusion_events", { keyPath: "id" });
        s.createIndex("startTime", "startTime");
        s.createIndex("status", "status");
      }
      if (!db.objectStoreNames.contains("missing_frame_alerts")) {
        const s = db.createObjectStore("missing_frame_alerts", { keyPath: "id" });
        s.createIndex("occlusionEventId", "occlusionEventId");
        s.createIndex("source", "source");
      }
      if (!db.objectStoreNames.contains("review_records")) {
        const s = db.createObjectStore("review_records", { keyPath: "id" });
        s.createIndex("occlusionEventId", "occlusionEventId");
        s.createIndex("status", "status");
      }
      if (!db.objectStoreNames.contains("review_history")) {
        const s = db.createObjectStore("review_history", { keyPath: "id" });
        s.createIndex("reviewRecordId", "reviewRecordId");
      }
    },
  });

  return dbInstance;
}

export async function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  const db = await getDB();
  return db.getAll(storeName) as Promise<T[]>;
}

export async function putToStore<T>(storeName: StoreName, item: T): Promise<void> {
  const db = await getDB();
  await db.put(storeName, item);
}

export async function putBatchToStore<T>(storeName: StoreName, items: T[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  for (const item of items) {
    await tx.store.put(item);
  }
  await tx.done;
}

export async function deleteFromStore(storeName: StoreName, id: string): Promise<void> {
  const db = await getDB();
  await db.delete(storeName, id);
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await getDB();
  await db.clear(storeName);
}

export async function getFromStore<T>(storeName: StoreName, id: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get(storeName, id) as Promise<T | undefined>;
}

export async function getByIndex<T>(
  storeName: StoreName,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await getDB();
  return db.getAllFromIndex(storeName, indexName, value) as Promise<T[]>;
}
