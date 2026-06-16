import { OutdoorStall, ImportData } from '@/types';

export interface MatchReason {
  type: 'name' | 'coordinate' | 'location' | 'combined';
  description: string;
}

export interface StallMatchResult {
  stall: OutdoorStall;
  score: number;
  reasons: MatchReason[];
}

const GEO_THRESHOLD_METERS = 80;

function haversineDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function normalizeName(s: string): string {
  return s.replace(/[\s（）()（）【】\[\]""''·\-—]/g, '').toLowerCase();
}

export function namesMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na.length < 2 || nb.length < 2) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function normalizeLocation(s: string): string {
  return s
    .replace(/[，,。\.]/g, '')
    .replace(/号|弄|门|层|栋|单元|室/g, '')
    .replace(/\s/g, '')
    .toLowerCase();
}

export function locationsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalizeLocation(a);
  const nb = normalizeLocation(b);
  if (na.length < 3 || nb.length < 3) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function findBestMatch(
  data: ImportData,
  stalls: OutdoorStall[]
): StallMatchResult | null {
  let best: StallMatchResult | null = null;

  for (const stall of stalls) {
    const reasons: MatchReason[] = [];
    let score = 0;

    if (namesMatch(stall.name, data.name)) {
      reasons.push({ type: 'name', description: `商户名匹配：${stall.name} ≈ ${data.name}` });
      score += 100;
    }

    if (data.lat !== undefined && data.lng !== undefined) {
      const dist = haversineDistanceMeters(stall.lat, stall.lng, data.lat, data.lng);
      if (dist <= GEO_THRESHOLD_METERS) {
        reasons.push({
          type: 'coordinate',
          description: `GIS坐标距离 ${Math.round(dist)} 米，阈值 ${GEO_THRESHOLD_METERS} 米内`,
        });
        score += Math.max(80, 80 - Math.floor(dist / 2));
      }
    }

    if (locationsMatch(stall.location, data.location)) {
      reasons.push({ type: 'location', description: `位置描述匹配：${stall.location} ≈ ${data.location}` });
      score += 60;
    }

    if (score >= 60) {
      if (!best || score > best.score) {
        if (reasons.length > 1) {
          reasons.unshift({
            type: 'combined',
            description: `综合匹配（${reasons.length}项证据）`,
          });
        }
        best = { stall, score, reasons };
      }
    }
  }

  return best;
}
