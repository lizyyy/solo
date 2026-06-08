import type { SampleRecord } from "@/types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const AUDIO_EXTENSIONS = new Set([
  ".wav", ".mp3", ".flac", ".aiff", ".ogg", ".aac", ".wma", ".m4a",
]);

function parseTimecode(tc: string | null): number | null {
  if (!tc) return null;
  const clean = tc.replace(/^-/, "");
  const parts = clean.split(":").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function extractTrackName(fileName: string): string {
  let name = fileName;
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx > 0) name = name.slice(0, dotIdx);
  name = name
    .replace(/_master_v\d+$/i, "")
    .replace(/_未授权$/i, "")
    .replace(/_take\d+$/i, "")
    .replace(/_final_mix$/i, "")
    .replace(/_exp_\d{4}-\d{2}-\d{2}$/i, "")
    .replace(/_/g, " ")
    .trim();
  return name || fileName;
}

function inferAuthStatus(fileName: string): {
  status: SampleRecord["authorizationStatus"];
  expiry: string | null;
} {
  if (/_未授权/i.test(fileName)) {
    return { status: "missing", expiry: null };
  }

  const expMatch = fileName.match(/_exp_(\d{4}-\d{2}-\d{2})/i);
  if (expMatch) {
    const expiryDate = expMatch[1];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    if (exp < now) {
      return { status: "expired", expiry: expiryDate };
    }
    return { status: "valid", expiry: expiryDate };
  }

  return { status: "unknown", expiry: null };
}

function detectTimecodeIssue(start: string | null, end: string | null, duration: number | null): boolean {
  const startSec = parseTimecode(start);
  const endSec = parseTimecode(end);

  if (start && start.startsWith("-")) return true;
  if (startSec !== null && endSec !== null && endSec < startSec) return true;
  if (duration !== null && endSec !== null && endSec > duration + 1) return true;
  return false;
}

export function parseFilesToRecords(
  files: File[],
  existingRecords: SampleRecord[]
): { records: SampleRecord[]; duplicateGroupMap: Map<string, string> } {
  const batch = `batch-${Date.now()}`;
  const now = new Date().toISOString();
  const existingByName = new Map<string, { record: SampleRecord; index: number }>();
  const duplicateGroupMap = new Map<string, string>();
  const newByName = new Map<string, number>();

  for (const r of existingRecords) {
    existingByName.set(r.trackName.toLowerCase(), { record: r, index: -1 });
  }

  const records: SampleRecord[] = [];

  for (const file of files) {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!AUDIO_EXTENSIONS.has(ext)) continue;

    const trackName = extractTrackName(file.name);
    const isManualRename = trackName.toLowerCase() !== file.name.replace(/\.[^.]+$/, "").toLowerCase();
    const isOldMaster = /_master_v\d+/i.test(file.name) || /旧版母带/.test(trackName);

    const { status: authStatus, expiry: authExpiry } = inferAuthStatus(file.name);

    const key = trackName.toLowerCase();
    const existingEntry = existingByName.get(key);
    const newBatchIndex = newByName.get(key);
    const isDuplicate = !!(existingEntry || newBatchIndex !== undefined);
    let duplicateGroupId: string | null = null;

    if (isDuplicate) {
      if (duplicateGroupMap.has(key)) {
        duplicateGroupId = duplicateGroupMap.get(key)!;
      } else {
        duplicateGroupId = "dup-" + generateId();
        duplicateGroupMap.set(key, duplicateGroupId);
        if (existingEntry && !existingEntry.record.duplicateGroupId) {
          existingEntry.record = { ...existingEntry.record, isDuplicate: true, duplicateGroupId };
        }
        if (newBatchIndex !== undefined && records[newBatchIndex]) {
          records[newBatchIndex] = { ...records[newBatchIndex], isDuplicate: true, duplicateGroupId };
        }
      }
    }

    const currentIdx = records.length;
    newByName.set(key, currentIdx);

    records.push({
      id: generateId(),
      originalFileName: file.name,
      trackName,
      sourcePath: file.webkitRelativePath || file.name,
      authorizationStatus: authStatus,
      authorizationExpiry: authExpiry,
      timecodeStart: null,
      timecodeEnd: null,
      duration: null,
      isDuplicate,
      duplicateGroupId,
      isOldMaster,
      isManualRename,
      hasTimecodeIssue: false,
      userNote: "",
      originalImportBatch: batch,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { records, duplicateGroupMap };
}

export { extractTrackName, detectTimecodeIssue, inferAuthStatus };
