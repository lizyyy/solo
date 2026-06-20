import type { DraftEntry, Anomaly } from "@/types";
import { similarityScore } from "./similarity";

export interface DuplicateSubmissionResult {
  keptDrafts: DraftEntry[];
  anomalies: Anomaly[];
}

export function detectDuplicateSubmissions(
  drafts: DraftEntry[]
): DuplicateSubmissionResult {
  const seen = new Map<string, DraftEntry>();
  const kept: DraftEntry[] = [];
  const anomalies: Anomaly[] = [];

  const sorted = [...drafts].sort((a, b) => a.submittedAt - b.submittedAt);
  for (const draft of sorted) {
    const existing = seen.get(draft.submissionFingerprint);
    if (existing) {
      anomalies.push({
        id: `dup-sub-${existing.id}-${draft.id}`,
        type: "duplicate_submission",
        relatedDraftIds: [existing.id, draft.id],
        sourceDescription: `草稿 ${existing.id.slice(0, 6)} 与 ${draft.id.slice(
          0,
          6
        )} 内容+备注指纹一致（${draft.submissionFingerprint}）`,
        impactScope: `题号 ${draft.questionNo} 的后补备注仅保留首份，后到的提交不计入汇总`,
        explanation:
          "同一请求两次提交时，后补备注只能记一次。工具按提交时间取最早一份保留，其余标记为重复。",
        resolved: false,
      });
    } else {
      seen.set(draft.submissionFingerprint, draft);
      kept.push(draft);
    }
  }
  return { keptDrafts: kept, anomalies };
}

export function detectDuplicateSamples(
  drafts: DraftEntry[],
  threshold = 0.92
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const byQuestion = new Map<string, DraftEntry[]>();
  for (const d of drafts) {
    if (!byQuestion.has(d.questionNo)) byQuestion.set(d.questionNo, []);
    byQuestion.get(d.questionNo)!.push(d);
  }

  for (const [q, list] of byQuestion.entries()) {
    const flagged = new Set<string>();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const score = similarityScore(
          list[i].answerContent,
          list[j].answerContent
        );
        if (score >= threshold) {
          flagged.add(list[i].id);
          flagged.add(list[j].id);
          const ids = [list[i].id, list[j].id];
          anomalies.push({
            id: `dup-sample-${q}-${i}-${j}`,
            type: "duplicate_sample",
            relatedDraftIds: ids,
            sourceDescription: `题号 ${q} 草稿 ${ids
              .map((x) => x.slice(0, 6))
              .join(" / ")} 内容相似度 ${(score * 100).toFixed(0)}%`,
            impactScope: `该组重复样本不纳入正常汇总，需人工确认是否为同源抄袭或误提交`,
            explanation: `答案内容 Jaccard 相似度 ${(
              score * 100
            ).toFixed(0)}%，超过阈值 ${(threshold * 100).toFixed(
              0
            )}%，判定为重复样本。`,
            resolved: false,
          });
        }
      }
    }
  }
  return anomalies;
}
