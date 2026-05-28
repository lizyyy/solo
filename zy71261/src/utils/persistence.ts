import type {
  PositionRecord,
  ExportRecord,
  ValidationResult,
  FilterState,
} from "@/types/index";

const DB_NAME = "termwall-db";
const DB_VERSION = 1;

const STORE_POSITIONS = "positions";
const STORE_EXPORTS = "exports";
const STORE_VALIDATIONS = "validations";

const UI_STATE_KEY = "termwall_ui";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_POSITIONS)) {
        db.createObjectStore(STORE_POSITIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_EXPORTS)) {
        db.createObjectStore(STORE_EXPORTS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_VALIDATIONS)) {
        db.createObjectStore(STORE_VALIDATIONS, { keyPath: "id" });
      }
    };
  });

  return dbPromise;
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putToStore<T>(storeName: string, value: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function savePositions(records: PositionRecord[]): Promise<void> {
  for (const r of records) {
    await putToStore(STORE_POSITIONS, r);
  }
}

export async function loadPositions(): Promise<PositionRecord[]> {
  return getAllFromStore<PositionRecord>(STORE_POSITIONS);
}

export async function saveExportRecord(record: ExportRecord): Promise<void> {
  await putToStore(STORE_EXPORTS, record);
}

export async function loadExportRecords(): Promise<ExportRecord[]> {
  return getAllFromStore<ExportRecord>(STORE_EXPORTS);
}

export async function saveValidationResult(
  result: ValidationResult
): Promise<void> {
  await putToStore(STORE_VALIDATIONS, result);
}

export async function loadLatestValidation(): Promise<ValidationResult | null> {
  const all = await getAllFromStore<ValidationResult>(STORE_VALIDATIONS);
  if (all.length === 0) return null;
  return all.reduce((latest, val) =>
    val.timestamp > latest.timestamp ? val : latest
  );
}

export async function clearDatabase(): Promise<void> {
  try {
    indexedDB.deleteDatabase(DB_NAME);
    dbPromise = null;
    await new Promise((resolve) => setTimeout(resolve, 50));
  } catch {}
}

export function saveUIState(state: {
  filter: FilterState;
  cameraPreset: string;
}): void {
  localStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
}

export function loadUIState(): {
  filter: FilterState;
  cameraPreset: string;
} | null {
  const raw = localStorage.getItem(UI_STATE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
