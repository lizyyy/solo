import type {
  CollisionPoint,
  Conclusion,
  ConclusionSnapshot,
  SourceRow,
  VersionNode,
} from "@/types";
import { CONCLUSION_LABEL, LEVEL_LABEL, SOURCE_LABEL } from "@/types";

export const toCSV = (
  rows: SourceRow[],
  collisions: CollisionPoint[],
  version: VersionNode | undefined,
  conclusion: Conclusion,
  filtersLabel: string,
): { filename: string; content: string; rowCount: number } => {
  const colMap = new Map(collisions.map((c) => [c.id, c]));
  const phToColId = new Map(collisions.map((c) => [c.positionHash, c.id]));
  const rowColMap = new Map<string, CollisionPoint>();
  for (const c of collisions) {
    for (const rid of c.sourceRows) rowColMap.set(rid, c);
  }

  const header = [
    "碰撞ID",
    "位置Hash",
    "影响范围",
    "碰撞等级",
    "重复来源数",
    "首次出现版本",
    "最近更新版本",
    "来源行ID",
    "来源类型",
    "原始来源名(raw)",
    "原始分区A(raw)",
    "原始分区B(raw)",
    "原始位置(raw)",
    "原始等级(raw)",
    "原始备注(raw)",
    "对齐参考_分区A",
    "对齐参考_分区B",
    "对齐参考_等级",
    "导入时间",
    "版本节点",
    "版本结论",
    "当前预审结论",
    "筛选条件",
  ];

  const lines: string[] = [header.map(escapeCsv).join(",")];
  const orderedRows = [...rows].sort((a, b) => a.importedAt - b.importedAt);
  for (const r of orderedRows) {
    const col = rowColMap.get(r.id);
    const col_id = col?.id ?? "";
    const ph =
      r.normalized?.positionHash ??
      (col ? col.positionHash : phToColId.get(col_id) ?? "");
    const c = col ?? colMap.get(col_id);
    lines.push(
      [
        col_id,
        ph,
        c?.impactZone ?? `${r.raw_fire_zone_a.trim() || "?"} × ${r.raw_fire_zone_b.trim() || "?"}`,
        c ? LEVEL_LABEL[c.level] : LEVEL_LABEL[r.normalized?.level ?? "info"],
        c ? String(c.duplicateCount) : "1",
        c?.firstSeenVersionId ?? r.versionId,
        c?.lastUpdatedVersionId ?? r.versionId,
        r.id,
        SOURCE_LABEL[r.sourceType],
        r.raw_source_name,
        r.raw_fire_zone_a,
        r.raw_fire_zone_b,
        r.raw_position,
        r.raw_level,
        r.raw_note ?? "",
        r.normalized?.zoneA ?? "",
        r.normalized?.zoneB ?? "",
        r.normalized?.level ? LEVEL_LABEL[r.normalized.level] : "",
        new Date(r.importedAt).toLocaleString("zh-CN", { hour12: false }),
        version?.name ?? r.versionId,
        version ? CONCLUSION_LABEL[version.conclusion] : "",
        CONCLUSION_LABEL[conclusion],
        filtersLabel || "全部",
      ]
        .map(escapeCsv)
        .join(","),
    );
  }

  const ts = version
    ? new Date(version.createdAt)
    : new Date();
  const tsStr =
    ts.getFullYear().toString() +
    String(ts.getMonth() + 1).padStart(2, "0") +
    String(ts.getDate()).padStart(2, "0") +
    "-" +
    String(ts.getHours()).padStart(2, "0") +
    String(ts.getMinutes()).padStart(2, "0");
  const verTag = version?.name.replace(/ · /g, "-").replace(/\s/g, "") ?? "ALL";
  return {
    filename: `消防分区碰撞预审_${verTag}_${tsStr}.csv`,
    content: "\uFEFF" + lines.join("\n"),
    rowCount: orderedRows.length,
  };
};

const escapeCsv = (v: unknown) => {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
};

export const triggerDownload = (filename: string, content: string) => {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
};

export const buildFiltersLabel = (f: {
  zones: string[];
  levels: string[];
  sourceTypes: string[];
  keyword: string;
}) => {
  const parts: string[] = [];
  if (f.zones.length) parts.push(`分区:${f.zones.join("/")}`);
  if (f.levels.length)
    parts.push(
      `等级:${f.levels
        .map((l) => LEVEL_LABEL[l as keyof typeof LEVEL_LABEL])
        .join("/")}`,
    );
  if (f.sourceTypes.length)
    parts.push(
      `来源:${f.sourceTypes
        .map((t) => SOURCE_LABEL[t as keyof typeof SOURCE_LABEL])
        .join("/")}`,
    );
  if (f.keyword) parts.push(`关键词:"${f.keyword}"`);
  return parts.join(" · ");
};

export const buildSnapshotDiff = (snap: ConclusionSnapshot) => {
  const prevIds = new Set(snap.previousMaterialsSnapshot.map((r) => r.id));
  const addedIds = new Set(snap.newMaterialsAdded.map((r) => r.id));
  return {
    kept: snap.previousMaterialsSnapshot.filter(
      (r) => !addedIds.has(r.id) && prevIds.has(r.id),
    ),
    added: snap.newMaterialsAdded,
  };
};
