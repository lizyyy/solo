import type { DraftEntry, Anomaly, CalculationRun, ParamVersion } from "@/types";
import { detectDuplicateSubmissions, detectDuplicateSamples } from "./dedupe";
import { detectAnswerVersionConflicts, detectMissingNotes } from "./conflict";

export interface RunResult {
  run: CalculationRun;
  anomalies: Anomaly[];
  summary: string;
}

export function buildSummary(
  anomalies: Anomaly[],
  draftsCount: number,
  paramVersionName: string
): string {
  const conflict = anomalies.filter((a) => a.type === "answer_version_conflict")
    .length;
  const dupSub = anomalies.filter((a) => a.type === "duplicate_submission")
    .length;
  const dupSample = anomalies.filter((a) => a.type === "duplicate_sample")
    .length;
  const missing = anomalies.filter((a) => a.type === "missing_note").length;
  const unresolved = anomalies.filter((a) => !a.resolved).length;

  return `参数版本【${paramVersionName}】共处理 ${draftsCount} 条学生草稿；检测到答案版本冲突 ${conflict} 处、重复提交 ${dupSub} 处、重复样本 ${dupSample} 处、不齐整（待补备注）${missing} 条，未解决异常 ${unresolved} 项。`;
}

export function runCalculation(
  drafts: DraftEntry[],
  paramVersion: ParamVersion
): RunResult {
  const startedAt = Date.now();

  const { keptDrafts, anomalies: dupSub } = detectDuplicateSubmissions(drafts);
  const versionConflicts = detectAnswerVersionConflicts(keptDrafts);
  const dupSamples = detectDuplicateSamples(keptDrafts);
  const missingNotes = detectMissingNotes(keptDrafts);

  const anomalies: Anomaly[] = [
    ...dupSub,
    ...versionConflicts,
    ...dupSamples,
    ...missingNotes,
  ];

  const summary = buildSummary(
    anomalies,
    drafts.length,
    paramVersion.name
  );

  const run: CalculationRun = {
    id: `run-${startedAt}`,
    paramVersionId: paramVersion.id,
    startedAt,
    finishedAt: Date.now(),
    draftIds: keptDrafts.map((d) => d.id),
    anomalies,
    summary,
  };

  return { run, anomalies, summary };
}
