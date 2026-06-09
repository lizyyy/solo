type WeightUnit = 'kg' | 'g' | '斤' | 'lb';

type PetCategory = 'reptile' | 'bird' | 'smallMammal' | 'other';

interface TempControlRecord {
  id: string;
  petName: string;
  petCategory: PetCategory;
  species: string;
  ownerName: string;
  ownerPhone: string;
  ownerWechatNote: string;
  weight: number;
  weightUnit: WeightUnit;
  weightNormalizedKg: number;
  weightUnitAbnormal: boolean;
  temperature: number;
  measureTime: string;
}

interface MergeCandidate {
  groupId: string;
  recordIds: string[];
  confidence: number;
  matchReasons: string[];
}

const WEIGHT_UNIT_FACTORS: Record<WeightUnit, number> = {
  kg: 1,
  g: 0.001,
  斤: 0.5,
  lb: 0.453592,
};

export function normalizeWeight(weight: number, unit: WeightUnit): number {
  const factor = WEIGHT_UNIT_FACTORS[unit];
  if (factor === undefined) return weight;
  return Number((weight * factor).toFixed(4));
}

export function isWeightUnitAbnormal(unit: WeightUnit): boolean {
  return unit !== 'kg';
}

export function detectWeightAnomalies(
  records: Array<{ weight: number; weightUnit: WeightUnit }>
): Array<{ weightNormalizedKg: number; weightUnitAbnormal: boolean }> {
  return records.map((r) => ({
    weightNormalizedKg: normalizeWeight(r.weight, r.weightUnit),
    weightUnitAbnormal: isWeightUnitAbnormal(r.weightUnit),
  }));
}

const PINYIN_MAP: Record<string, string[]> = {
  小: ['xiao'],
  绿: ['lv', 'lu'],
  哥: ['ge'],
  团: ['tuan'],
  圆: ['yuan'],
  汤: ['tang'],
  豆: ['dou'],
  花: ['hua'],
  雪: ['xue'],
  球: ['qiu'],
  毛: ['mao'],
  灰: ['hui'],
  皮: ['pi'],
  蛋: ['dan'],
  糖: ['tang'],
  鹦: ['ying'],
  鹉: ['wu'],
  阿: ['a'],
  黑: ['hei'],
  眼: ['yan'],
  先: ['xian'],
  生: ['sheng'],
  蜥: ['xi'],
  啾: ['jiu'],
  胖: ['pang'],
  墩: ['dun'],
  金: ['jin'],
  黄: ['huang'],
  贝: ['bei'],
  塔: ['ta'],
  暖: ['nuan'],
  宝: ['bao'],
  冰: ['bing'],
  火: ['huo'],
};

function getPinyinInitials(name: string): string[] {
  const results: string[] = [''];
  for (const ch of name) {
    const pinyins = PINYIN_MAP[ch];
    if (pinyins && pinyins.length > 0) {
      const newResults: string[] = [];
      for (const existing of results) {
        for (const py of pinyins) {
          newResults.push(existing + py.charAt(0));
        }
      }
      results.length = 0;
      results.push(...newResults);
    } else {
      const code = ch.charCodeAt(0);
      const char = ((code >= 65 && code <= 90) || (code >= 97 && code <= 122))
        ? ch.toLowerCase()
        : ch;
      for (let i = 0; i < results.length; i++) {
        results[i] += char;
      }
    }
  }
  return results.length > 0 ? results : [name];
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev: number[] = new Array(b.length + 1);
  const curr: number[] = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return curr[b.length];
}

export function namePinyinEditDistance(nameA: string, nameB: string): number {
  if (nameA === nameB) return 0;
  const initialsA = getPinyinInitials(nameA);
  const initialsB = getPinyinInitials(nameB);
  let minDist = Infinity;
  for (const ia of initialsA) {
    for (const ib of initialsB) {
      const dist = levenshteinDistance(ia, ib);
      if (dist < minDist) minDist = dist;
    }
  }
  const directDist = levenshteinDistance(nameA, nameB);
  return Math.min(minDist, directDist);
}

export function isNameSimilar(nameA: string, nameB: string, threshold = 2): boolean {
  return namePinyinEditDistance(nameA, nameB) <= threshold;
}

export interface DuplicateMatch {
  recordIds: [string, string];
  confidence: number;
  matchReasons: string[];
  editDistance: number;
}

export function detectDuplicatePets(records: TempControlRecord[]): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  const n = records.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = records[i];
      const b = records[j];

      const reasons: string[] = [];
      let score = 0;

      if (a.ownerPhone && b.ownerPhone && a.ownerPhone === b.ownerPhone) {
        reasons.push('主人手机号完全一致');
        score += 40;
      }

      if (a.species && b.species && a.species === b.species) {
        reasons.push(`品种均为${a.species}`);
        score += 30;
      } else if (a.petCategory === b.petCategory) {
        score += 10;
      }

      const editDist = namePinyinEditDistance(a.petName, b.petName);
      if (editDist <= 2) {
        reasons.push(`名字拼音近似（编辑距离=${editDist}，阈值≤2）`);
        score += 30;
      }

      if (a.weightNormalizedKg && b.weightNormalizedKg) {
        const avgWeight = (a.weightNormalizedKg + b.weightNormalizedKg) / 2;
        if (avgWeight > 0) {
          const diffRatio = Math.abs(a.weightNormalizedKg - b.weightNormalizedKg) / avgWeight;
          if (diffRatio <= 0.1) {
            reasons.push(`体重接近（${a.weightNormalizedKg}kg vs ${b.weightNormalizedKg}kg）`);
            score += 10;
          }
        }
      }

      if (score >= 70 && reasons.length >= 2) {
        matches.push({
          recordIds: [a.id, b.id],
          confidence: Math.min(score, 100) / 100,
          matchReasons: reasons,
          editDistance: editDist,
        });
      }
    }
  }

  return matches;
}

export function groupDuplicateMatches(matches: DuplicateMatch[]): MergeCandidate[] {
  const parent: Record<string, string> = {};

  function find(x: string): string {
    if (parent[x] === undefined) parent[x] = x;
    if (parent[x] !== x) parent[x] = find(parent[x]);
    return parent[x];
  }

  function union(x: string, y: string): void {
    parent[find(x)] = find(y);
  }

  for (const m of matches) {
    union(m.recordIds[0], m.recordIds[1]);
  }

  const groups: Record<string, { recordIds: string[]; confidenceSum: number; reasons: Set<string> }> = {};

  for (const m of matches) {
    const root = find(m.recordIds[0]);
    if (!groups[root]) {
      groups[root] = { recordIds: [], confidenceSum: 0, reasons: new Set() };
    }
  }

  for (const m of matches) {
    const root = find(m.recordIds[0]);
    const g = groups[root];
    for (const rid of m.recordIds) {
      if (!g.recordIds.includes(rid)) g.recordIds.push(rid);
    }
    g.confidenceSum += m.confidence;
    for (const r of m.matchReasons) g.reasons.add(r);
  }

  const candidates: MergeCandidate[] = [];
  let idx = 0;
  for (const root in groups) {
    idx += 1;
    const g = groups[root];
    candidates.push({
      groupId: `MG-AUTO-${String(idx).padStart(3, '0')}`,
      recordIds: g.recordIds.sort(),
      confidence: Number((g.confidenceSum / g.recordIds.length).toFixed(2)),
      matchReasons: Array.from(g.reasons),
    });
  }
  return candidates;
}
