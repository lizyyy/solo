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
    .replace(/_/g, " ")
    .trim();
  return name || fileName;
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
  const existingByName = new Map<string, SampleRecord>();
  const duplicateGroupMap = new Map<string, string>();

  for (const r of existingRecords) {
    existingByName.set(r.trackName.toLowerCase(), r);
  }

  const records: SampleRecord[] = [];

  for (const file of files) {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!AUDIO_EXTENSIONS.has(ext)) continue;

    const trackName = extractTrackName(file.name);
    const isManualRename = trackName.toLowerCase() !== file.name.replace(/\.[^.]+$/, "").toLowerCase();
    const isOldMaster = /_master_v\d+/i.test(file.name) || /旧版母带/.test(trackName);

    const existing = existingByName.get(trackName.toLowerCase());
    const isDuplicate = !!existing;
    let duplicateGroupId: string | null = null;

    if (isDuplicate) {
      if (existing.duplicateGroupId) {
        duplicateGroupId = existing.duplicateGroupId;
      } else {
        duplicateGroupId = "dup-" + generateId();
        duplicateGroupMap.set(trackName.toLowerCase(), duplicateGroupId);
      }
    }

    const hasTimecodeIssue = detectTimecodeIssue(null, null, null);

    records.push({
      id: generateId(),
      originalFileName: file.name,
      trackName,
      sourcePath: file.webkitRelativePath || file.name,
      authorizationStatus: "unknown",
      authorizationExpiry: null,
      timecodeStart: null,
      timecodeEnd: null,
      duration: null,
      isDuplicate,
      duplicateGroupId,
      isOldMaster,
      isManualRename,
      hasTimecodeIssue,
      userNote: "",
      originalImportBatch: batch,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { records, duplicateGroupMap };
}

export { extractTrackName, detectTimecodeIssue };
