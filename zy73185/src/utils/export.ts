import type {
  DraftEntry,
  ParamVersion,
  CalculationRun,
  Anomaly,
} from "@/types";

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

const ANOMALY_LABEL: Record<Anomaly["type"], string> = {
  answer_version_conflict: "答案版本冲突",
  duplicate_submission: "重复提交",
  duplicate_sample: "重复样本",
  missing_note: "后补备注缺失",
};

export function anomalyLabel(t: Anomaly["type"]): string {
  return ANOMALY_LABEL[t];
}

export function buildDeliveryMarkdown(opts: {
  drafts: DraftEntry[];
  runs: CalculationRun[];
  paramVersions: ParamVersion[];
  currentAnomalies: Anomaly[];
  globalSummary: string;
}): string {
  const { drafts, runs, paramVersions, currentAnomalies, globalSummary } = opts;
  const pvMap = new Map(paramVersions.map((p) => [p.id, p]));

  const lines: string[] = [];
  lines.push("# 误差传播批量验算 · 交付摘要");
  lines.push("");
  lines.push(`> 导出时间：${formatTime(Date.now())}`);
  lines.push("");

  lines.push("## 一、页面摘要");
  lines.push("");
  lines.push(globalSummary);
  lines.push("");
  if (currentAnomalies.length > 0) {
    lines.push("### 未解决异常清单");
    lines.push("");
    for (const a of currentAnomalies.filter((x) => !x.resolved)) {
      lines.push(
        `- **${anomalyLabel(a.type)}**：${a.sourceDescription}　影响：${
          a.impactScope
        }`
      );
    }
    lines.push("");
  }

  lines.push("## 二、学生草稿");
  lines.push("");
  lines.push("| 题号 | 答案内容 | 版本 | 后补备注 | 状态 |");
  lines.push("|---|---|---|---|---|");
  const anomalyByDraft = new Map<string, Anomaly[]>();
  for (const a of currentAnomalies) {
    for (const id of a.relatedDraftIds) {
      if (!anomalyByDraft.has(id)) anomalyByDraft.set(id, []);
      anomalyByDraft.get(id)!.push(a);
    }
  }
  for (const d of drafts) {
    const issues = anomalyByDraft.get(d.id) || [];
    const status =
      issues.length > 0
        ? issues.map((i) => anomalyLabel(i.type)).join("、")
        : "正常";
    lines.push(
      `| ${d.questionNo} | ${d.answerContent.replace(
        /\|/g,
        "｜"
      )} | ${d.answerVersion || "-"} | ${d.supplementaryNote || "（待补）"} | ${status} |`
    );
  }
  lines.push("");

  lines.push("## 三、处理记录");
  lines.push("");
  if (runs.length === 0) {
    lines.push("_暂无验算运行记录。_");
  } else {
    for (const r of runs) {
      const pv = pvMap.get(r.paramVersionId);
      lines.push(`### 运行 @ ${formatTime(r.startedAt)}`);
      lines.push("");
      lines.push(`- **参数版本**：${pv?.name || r.paramVersionId}`);
      lines.push(`- **草稿条数**：总 ${r.allDraftIds.length} / 有效 ${r.validDraftIds.length}`);
      lines.push(`- **异常数**：${r.anomalies.length}`);
      lines.push(`- **自动摘要**：${r.summary}`);
      if (r.editorNote) {
        lines.push(`- **阿宁备注**：${r.editorNote}`);
      }
      lines.push("");
    }
  }

  lines.push("## 四、参数版本档案");
  lines.push("");
  for (const p of paramVersions) {
    lines.push(
      `- **${p.name}** (${p.isActive ? "当前激活" : "历史"})：容忍阈值 ${
        p.tolerance
      }，有效数字 ${p.sigFigs} 位，舍入规则 ${p.roundingRule}，建档于 ${formatTime(
        p.createdAt
      )}`
    );
  }

  return lines.join("\n");
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function downloadText(filename: string, text: string, mime = "text/markdown") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
