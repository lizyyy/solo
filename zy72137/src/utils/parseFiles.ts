import type { SampleRecord } from "@/types";

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const AUDIO_EXTENSIONS = new Set([
  ".wav", ".mp3", ".flac", ".aiff", ".ogg", ".aac", ".wma", ".m4a",
]);

export function parseTimecode(tc: string | null): number | null {
  if (!tc) return null;
  const clean = tc.replace(/^-/, "");
  const parts = clean.split(":").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

function formatHMS(h: number, m: number, s: number, negative = false): string {
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return (negative ? "-" : "") + `${hh}:${mm}:${ss}`;
}

function digits6ToHMS(digits: string, negative = false): string | null {
  if (digits.length !== 6) return null;
  const h = parseInt(digits.slice(0, 2), 10);
  const m = parseInt(digits.slice(2, 4), 10);
  const s = parseInt(digits.slice(4, 6), 10);
  if (m > 59 || s > 59) return null;
  return formatHMS(h, m, s, negative);
}

export function extractTimecode(fileName: string): {
  start: string | null;
  end: string | null;
  duration: number | null;
  rawSegments: string[];
} {
  let name = fileName;
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx > 0) name = name.slice(0, dotIdx);

  const rawSegments: string[] = [];

  const patterns: Array<{ re: RegExp; groupNames: [number, number, number?]; format: "hms" | "digits6" }> = [
    { re: /TC_(-?\d{6})[-_](\d{6})/, groupNames: [1, 2], format: "digits6" },
    { re: /TC_(-?\d{2}:\d{2}:\d{2})[-_](\d{2}:\d{2}:\d{2})/, groupNames: [1, 2], format: "hms" },
    { re: /_(-?\d{6})-(\d{6})(?=[._-]|$)/, groupNames: [1, 2], format: "digits6" },
    { re: /\[(-?\d{6})[-_](\d{6})\]/, groupNames: [1, 2], format: "digits6" },
    { re: /start[-_]?(-?\d{6})[-_]end[-_]?(\d{6})/i, groupNames: [1, 2], format: "digits6" },
    { re: /from[-_](-?\d{6})[-_]to[-_](\d{6})/i, groupNames: [1, 2], format: "digits6" },
  ];

  let start: string | null = null;
  let end: string | null = null;

  for (const p of patterns) {
    const m = name.match(p.re);
    if (m) {
      rawSegments.push(m[0]);
      const sRaw = m[p.groupNames[0]];
      const eRaw = m[p.groupNames[1]];
      if (p.format === "digits6") {
        const sNeg = sRaw.startsWith("-");
        start = digits6ToHMS(sNeg ? sRaw.slice(1) : sRaw, sNeg);
        end = digits6ToHMS(eRaw, false);
      } else {
        start = sRaw;
        end = eRaw;
      }
      break;
    }
  }

  const durPatterns: RegExp[] = [
    /(?:_dur_|_D)(\d+)s(?=[._-]|$)/i,
    /_(\d{2,4})s(?=[._-]|$)/,
  ];

  let duration: number | null = null;
  const mmssMatch = name.match(/_(\d+)m(\d+)s(?=[._-]|$)/i);
  if (mmssMatch) {
    rawSegments.push(mmssMatch[0]);
    duration = parseInt(mmssMatch[1], 10) * 60 + parseInt(mmssMatch[2], 10);
  } else {
    for (const re of durPatterns) {
      const m = name.match(re);
      if (m) {
        rawSegments.push(m[0]);
        duration = parseInt(m[1], 10);
        break;
      }
    }
  }

  if (start && end && duration === null) {
    const sSec = parseTimecode(start);
    const eSec = parseTimecode(end);
    if (sSec !== null && eSec !== null && eSec > sSec) {
      duration = eSec - sSec;
    }
  }

  return { start, end, duration, rawSegments };
}

export function extractTrackName(fileName: string): string {
  let name = fileName;
  const dotIdx = name.lastIndexOf(".");
  if (dotIdx > 0) name = name.slice(0, dotIdx);

  const { rawSegments } = extractTimecode(fileName);
  for (const seg of rawSegments) {
    name = name.split(seg).join("_");
  }

  name = name
    .replace(/_master_v\d+(?=_|$)/gi, "")
    .replace(/_未授权(?=_|$)/gi, "")
    .replace(/_take\d+(?=_|$)/gi, "")
    .replace(/_final_mix(?=_|$)/gi, "")
    .replace(/_exp_\d{4}-\d{2}-\d{2}(?=_|$)/gi, "")
    .replace(/(_+)/g, "_")
    .replace(/_/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (name.endsWith(" -")) name = name.slice(0, -2).trim();
  if (name.startsWith("- ")) name = name.slice(2).trim();

  return name || fileName;
}

export function inferAuthStatus(fileName: string): {
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

export function detectTimecodeIssue(start: string | null, end: string | null, duration: number | null): boolean {
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
  const existingByName = new Map<string, { record: SampleRecord }>();
  const duplicateGroupMap = new Map<string, string>();
  const newByName = new Map<string, number>();

  for (const r of existingRecords) {
    existingByName.set(r.trackName.toLowerCase(), { record: r });
  }

  const records: SampleRecord[] = [];

  for (const file of files) {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!AUDIO_EXTENSIONS.has(ext)) continue;

    const trackName = extractTrackName(file.name);
    const isManualRename = trackName.toLowerCase() !== file.name.replace(/\.[^.]+$/, "").toLowerCase();
    const isOldMaster = /_master_v\d+/i.test(file.name) || /旧版母带/.test(trackName);

    const { status: authStatus, expiry: authExpiry } = inferAuthStatus(file.name);
    const { start: tcStart, end: tcEnd, duration } = extractTimecode(file.name);
    const hasTcIssue = detectTimecodeIssue(tcStart, tcEnd, duration);

    const key = trackName.toLowerCase();
    const existingEntry = existingByName.get(key);
    const newBatchIndex = newByName.get(key);
    const isDuplicate = newBatchIndex !== undefined || !!(existingEntry?.record?.isDuplicate);
    let duplicateGroupId: string | null = null;

    if (newBatchIndex !== undefined) {
      if (!duplicateGroupMap.has(key)) {
        duplicateGroupId = "dup-" + generateId();
        duplicateGroupMap.set(key, duplicateGroupId);
        if (records[newBatchIndex]) {
          records[newBatchIndex] = { ...records[newBatchIndex], isDuplicate: true, duplicateGroupId };
        }
      } else {
        duplicateGroupId = duplicateGroupMap.get(key)!;
      }
    } else if (existingEntry?.record?.duplicateGroupId) {
      duplicateGroupId = existingEntry.record.duplicateGroupId;
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
      timecodeStart: tcStart,
      timecodeEnd: tcEnd,
      duration,
      isDuplicate,
      duplicateGroupId,
      isOldMaster,
      isManualRename,
      hasTimecodeIssue: hasTcIssue,
      userNote: "",
      originalImportBatch: batch,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { records, duplicateGroupMap };
}
