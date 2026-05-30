import { CAMELOT_TO_MUSICAL, MUSICAL_TO_CAMELOT, KEY_ALIASES, CAMELOT_WHEEL } from './models.js';
import type { ChangeRecord, ChangeType } from './models.js';

export interface KeyNormalizationResult {
  camelot: string | null;
  musical: string | null;
  original: string;
  changed: boolean;
  reason: string;
}

function normalizeCamelot(raw: string): { camelot: string; confidence: number } | null {
  const s = raw.trim().toUpperCase();

  const directMatch = s.match(/^(\d{1,2})\s*([AB])$/);
  if (directMatch) {
    const num = parseInt(directMatch[1], 10);
    const letter = directMatch[2];
    if (num >= 1 && num <= 12) {
      return { camelot: `${num}${letter}`, confidence: 1.0 };
    }
  }

  const withDash = s.match(/^(\d{1,2})\s*[-/\\|]\s*([AB])$/);
  if (withDash) {
    const num = parseInt(withDash[1], 10);
    const letter = withDash[2];
    if (num >= 1 && num <= 12) {
      return { camelot: `${num}${letter}`, confidence: 0.95 };
    }
  }

  const withSpace = s.match(/^(\d{1,2})\s+([AB])$/);
  if (withSpace) {
    const num = parseInt(withSpace[1], 10);
    const letter = withSpace[2];
    if (num >= 1 && num <= 12) {
      return { camelot: `${num}${letter}`, confidence: 0.95 };
    }
  }

  return null;
}

function normalizeOpenKey(raw: string): { camelot: string; confidence: number } | null {
  const s = raw.trim();
  const openKeyMatch = s.match(/^(\d{1,2})(d|m)$/i);
  if (openKeyMatch) {
    const num = parseInt(openKeyMatch[1], 10);
    const mode = openKeyMatch[2].toLowerCase();
    if (num >= 1 && num <= 12) {
      const letter = mode === 'd' ? 'B' : 'A';
      return { camelot: `${num}${letter}`, confidence: 0.95 };
    }
  }
  return null;
}

function normalizeMusicalNotation(raw: string): { camelot: string; confidence: number } | null {
  let s = raw.trim().toLowerCase();

  for (const [alias, musical] of Object.entries(KEY_ALIASES)) {
    if (s === alias) {
      const camelot = MUSICAL_TO_CAMELOT[musical.toLowerCase()];
      if (camelot) return { camelot, confidence: 0.95 };
    }
  }

  s = s.replace(/\s+/g, ' ').replace(/^([a-g])#/, '$1♯').replace(/^([a-g])b(?!m)/, '$1♭');

  if (MUSICAL_TO_CAMELOT[s]) {
    return { camelot: MUSICAL_TO_CAMELOT[s], confidence: 1.0 };
  }

  const withMinor = s.match(/^([a-g][♯♭#]?)(?:\s*)(m(?:inor)?)$/);
  if (withMinor) {
    const root = withMinor[1];
    const minorKey = `${root} minor`;
    if (MUSICAL_TO_CAMELOT[minorKey]) {
      return { camelot: MUSICAL_TO_CAMELOT[minorKey], confidence: 0.9 };
    }
  }

  const withMajor = s.match(/^([a-g][♯♭#]?)(?:\s*)(maj(?:or)?)$/);
  if (withMajor) {
    const root = withMajor[1];
    const majorKey = `${root} major`;
    if (MUSICAL_TO_CAMELOT[majorKey]) {
      return { camelot: MUSICAL_TO_CAMELOT[majorKey], confidence: 0.9 };
    }
  }

  const bareNote = s.match(/^([a-g][♯♭#]?)$/);
  if (bareNote) {
    const majorKey = `${bareNote[1]} major`;
    if (MUSICAL_TO_CAMELOT[majorKey]) {
      return { camelot: MUSICAL_TO_CAMELOT[majorKey], confidence: 0.7 };
    }
  }

  return null;
}

export function normalizeKey(rawKey: string | null | undefined): KeyNormalizationResult {
  if (!rawKey || rawKey.trim() === '') {
    return { camelot: null, musical: null, original: rawKey || '', changed: false, reason: '空值' };
  }

  const original = rawKey.trim();

  let result = normalizeCamelot(original);

  if (!result) result = normalizeOpenKey(original);

  if (!result) result = normalizeMusicalNotation(original);

  if (!result) {
    const withoutParens = original.replace(/[()[\]{}]/g, '').trim();
    if (withoutParens !== original) {
      result = normalizeCamelot(withoutParens) ||
        normalizeOpenKey(withoutParens) ||
        normalizeMusicalNotation(withoutParens);
    }
  }

  if (!result) {
    const parts = original.split(/[/|,]+/).map(p => p.trim());
    for (const part of parts) {
      const r = normalizeCamelot(part) || normalizeOpenKey(part) || normalizeMusicalNotation(part);
      if (r) { result = r; break; }
    }
  }

  if (result) {
    const camelot = result.camelot;
    const musical = CAMELOT_TO_MUSICAL[camelot] || null;
    const changed = original !== camelot && original !== musical;
    const reason = changed
      ? `调性格式标准化: "${original}" → ${camelot} (${musical})，置信度 ${(result.confidence * 100).toFixed(0)}%`
      : `调性格式已标准: ${camelot} (${musical})`;

    return { camelot, musical, original, changed, reason };
  }

  return { camelot: null, musical: null, original, changed: false, reason: `无法识别调性格式: "${original}"` };
}

export function makeKeyChange(
  trackId: string,
  trackTitle: string,
  trackArtist: string,
  result: KeyNormalizationResult,
): ChangeRecord | null {
  if (!result.changed) return null;

  const changeType: ChangeType = result.camelot ? 'key_normalized' : 'key_mapped';

  return {
    trackId,
    trackTitle,
    trackArtist,
    changeType,
    field: 'key',
    oldValue: result.original,
    newValue: result.camelot ? `${result.camelot} (${result.musical})` : '',
    reason: result.reason,
    timestamp: new Date().toISOString(),
    source: 'auto',
    superseded: false,
  };
}
