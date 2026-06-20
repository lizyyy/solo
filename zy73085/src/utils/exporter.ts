import { useMinutesStore } from "@/stores/useMinutesStore";
import { useModelStore } from "@/stores/useModelStore";
import { useMaterialsStore } from "@/stores/useMaterialsStore";
import { useAnomaliesStore } from "@/stores/useAnomaliesStore";
import { Snapshot, Note, Anomaly, ModelAnnotation, MaterialBatch, MeetingMinutes } from "@/types";

export interface ExportConfig {
  includeSnapshots: boolean;
  includeNotes: boolean;
  includeRawMinutes: boolean;
  format: "json" | "markdown";
  scope: "all" | "open" | "critical";
}

interface ExportMeta {
  generatedAt: string;
  systemVersion: string;
  scope: string;
  counts: {
    anomalies: number;
    annotations: number;
    materials: number;
    minutes: number;
    snapshots: number;
    notes: number;
  };
}

interface ExportData {
  exportMeta: ExportMeta;
  anomalies: Anomaly[];
  annotations: ModelAnnotation[];
  materials: MaterialBatch[];
  minutes: MeetingMinutes[];
  snapshots: Snapshot[];
  notes: Note[];
}

export function generateExport(config: ExportConfig): { filename: string; content: string; type: string } {
  const minutes = useMinutesStore.getState().minutes;
  const annotations = useModelStore.getState().annotations;
  const batches = useMaterialsStore.getState().batches;
  const anomalies = useAnomaliesStore.getState().anomalies;
  const allSnapshots = useAnomaliesStore.getState().snapshots;
  const allNotes = useAnomaliesStore.getState().notes;

  const filtered = anomalies.filter((a) => {
    if (config.scope === "all") return true;
    if (config.scope === "open") return ["open", "processing", "suspended"].includes(a.status);
    if (config.scope === "critical") return a.severity === "critical";
    return true;
  });

  const relatedAnnoIds = new Set(filtered.map((a) => a.annotationId));
  const relatedMinutesIds = new Set(
    annotations.filter((a) => relatedAnnoIds.has(a.id) && a.minutesId).map((a) => a.minutesId!)
  );

  const data = {
    exportMeta: {
      generatedAt: new Date().toISOString(),
      systemVersion: "STR-GRID v1.0",
      scope: config.scope,
      counts: {
        anomalies: filtered.length,
        annotations: annotations.filter((a) => relatedAnnoIds.has(a.id)).length,
        materials: batches.filter((b) => relatedAnnoIds.has(b.annotationId)).length,
        minutes: minutes.filter((m) => relatedMinutesIds.has(m.id)).length,
        snapshots: config.includeSnapshots
          ? allSnapshots.filter((s) => filtered.some((a) => a.id === s.anomalyId)).length
          : 0,
        notes: config.includeNotes
          ? allNotes.filter((n) => filtered.some((a) => a.id === n.anomalyId)).length
          : 0,
      },
    },
    anomalies: filtered,
    annotations: annotations.filter((a) => relatedAnnoIds.has(a.id)),
    materials: batches.filter((b) => relatedAnnoIds.has(b.annotationId)),
    minutes: minutes
      .filter((m) => relatedMinutesIds.has(m.id))
      .map((m) => ({
        ...m,
        rawContent: config.includeRawMinutes ? m.rawContent : undefined,
        rawData: config.includeRawMinutes ? m.rawData : undefined,
      })),
    snapshots: config.includeSnapshots
      ? allSnapshots.filter((s) => filtered.some((a) => a.id === s.anomalyId))
      : ([] as Snapshot[]),
    notes: config.includeNotes
      ? allNotes.filter((n) => filtered.some((a) => a.id === n.anomalyId))
      : ([] as Note[]),
  };

  if (config.format === "json") {
    return {
      filename: `STR-GRID-复核报告-${Date.now()}.json`,
      content: JSON.stringify(data, null, 2),
      type: "application/json",
    };
  }

  const md = buildMarkdown(data);
  return {
    filename: `STR-GRID-复核报告-${Date.now()}.md`,
    content: md,
    type: "text/markdown",
  };
}

function buildMarkdown(d: ExportData): string {
  const lines: string[] = [];
  lines.push(`# 结构加固图纸复核报告`);
  lines.push("");
  lines.push(`> 生成时间：${new Date(d.exportMeta.generatedAt).toLocaleString("zh-CN")}  `);
  lines.push(`> 系统版本：${d.exportMeta.systemVersion}`);
  lines.push("");
  lines.push(`## 复核概览`);
  lines.push("");
  lines.push(`| 维度 | 数量 |`);
  lines.push(`|------|------|`);
  lines.push(`| 异常记录 | ${d.exportMeta.counts.anomalies} |`);
  lines.push(`| 关联标注 | ${d.exportMeta.counts.annotations} |`);
  lines.push(`| 材料批次 | ${d.exportMeta.counts.materials} |`);
  lines.push(`| 会议纪要 | ${d.exportMeta.counts.minutes} |`);
  if (d.exportMeta.counts.snapshots) lines.push(`| 历史快照 | ${d.exportMeta.counts.snapshots} |`);
  if (d.exportMeta.counts.notes) lines.push(`| 备注记录 | ${d.exportMeta.counts.notes} |`);
  lines.push("");

  lines.push(`## 异常详情`);
  lines.push("");
  for (const a of d.anomalies) {
    const ann = d.annotations.find((x: ModelAnnotation) => x.id === a.annotationId);
    const mats = d.materials.filter((x: MaterialBatch) => x.annotationId === a.annotationId);
    const mins = ann ? d.minutes.find((x: MeetingMinutes) => x.id === ann.minutesId) : null;
    lines.push(`### ${a.title} · \`${a.id}\``);
    lines.push("");
    lines.push(`- **严重程度**：${a.severity}  `);
    lines.push(`- **当前状态**：${a.status}  `);
    lines.push(`- **挂起决策**：${a.holdDecision || "未判定"}  `);
    if (a.holdReason) lines.push(`- **决策理由**：${a.holdReason}  `);
    lines.push(`- **异常描述**：${a.description}  `);
    if (ann) {
      lines.push(`- **空间位置**：${ann.floor} / ${ann.area} / 编码 ${ann.locationCode}  `);
      lines.push(`- **结构重要性**：${ann.structuralImportance}  `);
    }
    if (mins) {
      lines.push(`- **纪要来源**：${mins.source}  `);
      lines.push(`- **纪要状态**：${mins.status}  `);
    }
    if (mats.length) {
      lines.push("");
      lines.push(`**材料清单**：`);
      lines.push("");
      lines.push(`| 类型 | 批次号 | 检测报告 | 是否缺失 |`);
      lines.push(`|------|--------|----------|----------|`);
      for (const m of mats) {
        lines.push(`| ${m.materialType} | ${m.batchNumber || "—"} | ${m.testReport || "—"} | ${m.isMissing ? "❌ 缺失" : "✅ 齐全"} |`);
      }
    }
    if (d.snapshots?.length) {
      const snaps = d.snapshots.filter((s) => s.anomalyId === a.id);
      if (snaps.length) {
        lines.push("");
        lines.push(`**结论追溯（时间胶囊）**：`);
        lines.push("");
        for (const s of snaps) {
          lines.push(`- **[${new Date(s.createdAt).toLocaleString("zh-CN")}]** \`${s.fieldName}\`：\`${s.oldValue || "空"}\` → \`${s.newValue || "空"}\`  _${s.operator}_${s.note ? ` · ${s.note}` : ""}`);
        }
      }
    }
    if (d.notes?.length) {
      const notes = d.notes.filter((n) => n.anomalyId === a.id);
      if (notes.length) {
        lines.push("");
        lines.push(`**历史备注（受保护，重跑不覆盖）**：`);
        lines.push("");
        for (const n of notes) {
          lines.push(`> **[${n.author}]** ${new Date(n.createdAt).toLocaleString("zh-CN")}  \n> ${n.content}  `);
          lines.push("");
        }
      }
    }
    lines.push("");
    lines.push(`---`);
    lines.push("");
  }

  return lines.join("\n");
}

export function triggerDownload(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
