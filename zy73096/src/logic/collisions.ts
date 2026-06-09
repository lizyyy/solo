import type {
  CollisionLevel,
  CollisionPoint,
  Conclusion,
  ConclusionSnapshot,
  Filters,
  SourceRow,
  VersionNode,
} from "@/types";
import { ZONE_POS_MAP, ZONE_SIZE_MAP } from "@/data/zones";

export const LEVEL_WEIGHT: Record<CollisionLevel, number> = {
  critical: 3,
  warning: 2,
  info: 1,
};

const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

export const positionHash = (a: string, b: string, rawPos: string) => {
  const [x, y] = [a.trim(), b.trim()].sort();
  return hash(`${x}|${y}|${rawPos.trim()}`).slice(0, 8);
};

const centerOfZones = (
  a: string,
  b: string,
): [number, number, number] => {
  const pa = ZONE_POS_MAP[a] ?? [0, 0, 0];
  const pb = ZONE_POS_MAP[b] ?? [0, 0, 0];
  const sa = ZONE_SIZE_MAP[a] ?? [1, 1, 1];
  const sb = ZONE_SIZE_MAP[b] ?? [1, 1, 1];
  return [
    (pa[0] + sa[0] / 2 + pb[0] + sb[0] / 2) / 2,
    (pa[1] + sa[1] / 2 + pb[1] + sb[1] / 2) / 2 + 0.5,
    (pa[2] + sa[2] / 2 + pb[2] + sb[2] / 2) / 2,
  ];
};

export const normalizeLevel = (raw: string): CollisionLevel => {
  const s = raw.toLowerCase();
  if (s.includes("严重") || s.includes("critical") || s.includes("fail"))
    return "critical";
  if (s.includes("警告") || s.includes("warning") || s.includes("warn"))
    return "warning";
  return "info";
};

export const normalizeZone = (raw: string, fallback?: string) => {
  const t = raw.trim().toUpperCase();
  if (!t) return fallback;
  const m = t.match(/F\d+/);
  return m ? m[0] : t;
};

export const buildCollisionPoints = (rows: SourceRow[]): CollisionPoint[] => {
  const map = new Map<string, CollisionPoint>();
  const sorted = [...rows].sort((a, b) => a.importedAt - b.importedAt);

  for (const r of sorted) {
    const zoneA = r.normalized?.zoneA ?? normalizeZone(r.raw_fire_zone_a);
    const zoneB =
      r.normalized?.zoneB ??
      normalizeZone(r.raw_fire_zone_b, zoneA);
    const level = r.normalized?.level ?? normalizeLevel(r.raw_level);
    const ph =
      r.normalized?.positionHash ??
      positionHash(zoneA ?? "", zoneB ?? "", r.raw_position);

    const pos3d = centerOfZones(zoneA ?? "F1", zoneB ?? "F1");
    const impact = `${zoneA} × ${zoneB} · ${r.raw_position}`;

    const prev = map.get(ph);
    if (!prev) {
      map.set(ph, {
        id: `col-${ph}`,
        positionHash: ph,
        zoneA: zoneA ?? "未知",
        zoneB: zoneB ?? "未知",
        level,
        position3D: pos3d,
        impactZone: impact,
        sourceRows: [r.id],
        firstSeenVersionId: r.versionId,
        lastUpdatedVersionId: r.versionId,
        duplicateCount: 1,
      });
    } else {
      const lvlMax =
        LEVEL_WEIGHT[level] > LEVEL_WEIGHT[prev.level] ? level : prev.level;
      prev.sourceRows.push(r.id);
      prev.duplicateCount += 1;
      prev.lastUpdatedVersionId = r.versionId;
      prev.level = lvlMax;
    }
  }
  return [...map.values()];
};

export const calcVersionConclusion = (
  points: CollisionPoint[],
): Conclusion => {
  if (!points.length) return "pass";
  const lvls = points.map((p) => LEVEL_WEIGHT[p.level]);
  const max = Math.max(...lvls);
  const criticalCount = points.filter((p) => p.level === "critical").length;
  if (max >= 3 || criticalCount >= 2) return "fail";
  if (max >= 2 || criticalCount >= 1) return "doubt";
  return "pass";
};

export const filterSourceRows = (
  rows: SourceRow[],
  collisions: CollisionPoint[],
  filters: Filters,
): { rows: SourceRow[]; collisions: CollisionPoint[] } => {
  const { zones, levels, sourceTypes, keyword } = filters;
  const kw = keyword.trim().toLowerCase();

  const kwHit = (r: SourceRow) => {
    if (!kw) return true;
    return (
      r.raw_source_name.toLowerCase().includes(kw) ||
      r.raw_position.toLowerCase().includes(kw) ||
      (r.raw_note ?? "").toLowerCase().includes(kw) ||
      r.raw_fire_zone_a.toLowerCase().includes(kw) ||
      r.raw_fire_zone_b.toLowerCase().includes(kw)
    );
  };

  const zoneHit = (r: SourceRow) => {
    if (!zones.length) return true;
    const za = (r.normalized?.zoneA ?? normalizeZone(r.raw_fire_zone_a)) ?? "";
    const zb =
      (r.normalized?.zoneB ??
        normalizeZone(r.raw_fire_zone_b, za)) ?? "";
    return zones.includes(za) || zones.includes(zb);
  };

  const lvlHit = (r: SourceRow) => {
    if (!levels.length) return true;
    const lvl = r.normalized?.level ?? normalizeLevel(r.raw_level);
    return levels.includes(lvl);
  };

  const srcHit = (r: SourceRow) => {
    if (!sourceTypes.length) return true;
    return sourceTypes.includes(r.sourceType);
  };

  const rowsOut = rows.filter(
    (r) => zoneHit(r) && lvlHit(r) && srcHit(r) && kwHit(r),
  );
  const rowIds = new Set(rowsOut.map((r) => r.id));
  const colOut = collisions
    .map((c) => ({
      ...c,
      sourceRows: c.sourceRows.filter((id) => rowIds.has(id)),
    }))
    .filter((c) => c.sourceRows.length > 0);
  return { rows: rowsOut, collisions: colOut };
};

export const buildVersionNodes = (
  rows: SourceRow[],
  snapshots: ConclusionSnapshot[],
): VersionNode[] => {
  const map = new Map<string, VersionNode>();
  const sortedRows = [...rows].sort((a, b) => a.importedAt - b.importedAt);
  for (const r of sortedRows) {
    const prev = map.get(r.versionId);
    if (!prev) {
      map.set(r.versionId, {
        id: r.versionId,
        name: r.versionId.startsWith("ver-v1") ? "V1 · 初始导入" : "V2 · 补录附件",
        description: "",
        createdAt: r.importedAt,
        sourceRowIds: [r.id],
        conclusion: "doubt",
      });
    } else {
      prev.sourceRowIds.push(r.id);
      if (r.importedAt > prev.createdAt) prev.createdAt = r.importedAt;
    }
  }
  for (const node of map.values()) {
    const vr = rows.filter((r) => node.sourceRowIds.includes(r.id));
    const cols = buildCollisionPoints(vr);
    node.conclusion = calcVersionConclusion(cols);
    node.description = `${cols.length} 个碰撞点 · ${vr.length} 条来源`;
  }
  for (const snap of snapshots) {
    const node = map.get(snap.versionId);
    if (node) node.conclusion = snap.conclusion;
  }
  return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
};
