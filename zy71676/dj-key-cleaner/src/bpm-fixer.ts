import type { ChangeRecord, RawTrack } from './models.js';

export interface BpmFixResult {
  originalBpm: number | null;
  fixedBpm: number | null;
  isHalfSpeed: boolean;
  isDoubleSpeed: boolean;
  wasRounded: boolean;
  reason: string;
}

const TYPICAL_BPM_RANGE = { min: 60, max: 200 };
const HALF_SPEED_THRESHOLD = 85;
const DOUBLE_SPEED_THRESHOLD = 190;

function parseBpm(raw: string | number | undefined | null): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    return isNaN(raw) ? null : raw;
  }
  const s = String(raw).trim();
  if (s === '' || s === '-' || s === 'N/A') return null;

  const numMatch = s.match(/(\d+\.?\d*)/);
  if (numMatch) {
    const val = parseFloat(numMatch[1]);
    return isNaN(val) ? null : val;
  }
  return null;
}

export function detectBpmFix(
  rawBpm: string | number | undefined | null,
  key?: string | null,
  genre?: string | null,
): BpmFixResult {
  const bpm = parseBpm(rawBpm);

  if (bpm === null) {
    return {
      originalBpm: null,
      fixedBpm: null,
      isHalfSpeed: false,
      isDoubleSpeed: false,
      wasRounded: false,
      reason: 'BPM值为空或无法解析',
    };
  }

  const genreLower = (genre || '').toLowerCase();
  const isHalfTimeGenre =
    genreLower.includes('dubstep') ||
    genreLower.includes('drum and bass') ||
    genreLower.includes('dnb') ||
    genreLower.includes('trap') ||
    genreLower.includes('hip hop') ||
    genreLower.includes('hiphop');

  if (isHalfTimeGenre && bpm < HALF_SPEED_THRESHOLD) {
    return {
      originalBpm: bpm,
      fixedBpm: bpm,
      isHalfSpeed: false,
      isDoubleSpeed: false,
      wasRounded: false,
      reason: `曲风"${genre}"的${bpm} BPM属于半速表达(正常范围)，不修正`,
    };
  }

  if (bpm < HALF_SPEED_THRESHOLD) {
    const doubled = Math.round(bpm * 2 * 10) / 10;
    return {
      originalBpm: bpm,
      fixedBpm: doubled,
      isHalfSpeed: true,
      isDoubleSpeed: false,
      wasRounded: false,
      reason: `BPM ${bpm} 低于 ${HALF_SPEED_THRESHOLD}，疑似半速，修正为 ×2 = ${doubled}`,
    };
  }

  if (bpm > DOUBLE_SPEED_THRESHOLD) {
    const halved = Math.round(bpm / 2 * 10) / 10;
    return {
      originalBpm: bpm,
      fixedBpm: halved,
      isHalfSpeed: false,
      isDoubleSpeed: true,
      wasRounded: false,
      reason: `BPM ${bpm} 超过 ${DOUBLE_SPEED_THRESHOLD}，疑似双速，修正为 ÷2 = ${halved}`,
    };
  }

  const rounded = Math.round(bpm * 10) / 10;
  const wasRounded = bpm !== rounded;

  return {
    originalBpm: bpm,
    fixedBpm: rounded,
    isHalfSpeed: false,
    isDoubleSpeed: false,
    wasRounded,
    reason: wasRounded ? `BPM ${bpm} 四舍五入为 ${rounded}` : `BPM ${bpm} 在正常范围内`,
  };
}

export function makeBpmChange(
  trackId: string,
  trackTitle: string,
  trackArtist: string,
  result: BpmFixResult,
): ChangeRecord | null {
  if (result.originalBpm === null) return null;
  if (!result.isHalfSpeed && !result.isDoubleSpeed && !result.wasRounded && result.fixedBpm === result.originalBpm) return null;

  const changeType: ChangeRecord['changeType'] =
    result.isHalfSpeed ? 'bpm_halfspeed' :
    result.isDoubleSpeed ? 'bpm_halfspeed' :
    'bpm_round';

  return {
    trackId,
    trackTitle,
    trackArtist,
    changeType,
    field: 'bpm',
    oldValue: String(result.originalBpm),
    newValue: String(result.fixedBpm),
    reason: result.reason,
    timestamp: new Date().toISOString(),
    source: 'auto',
    superseded: false,
  };
}
