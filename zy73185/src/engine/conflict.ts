import type { DraftEntry, Anomaly } from "@/types";

export function detectAnswerVersionConflicts(drafts: DraftEntry[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const byQuestion = new Map<string, DraftEntry[]>();
  for (const d of drafts) {
    if (!byQuestion.has(d.questionNo)) byQuestion.set(d.questionNo, []);
    byQuestion.get(d.questionNo)!.push(d);
  }

  for (const [q, list] of byQuestion.entries()) {
    const versions = new Map<string, DraftEntry[]>();
    for (const d of list) {
      const v = d.answerVersion || "未标注版本";
      if (!versions.has(v)) versions.set(v, []);
      versions.get(v)!.push(d);
    }
    if (versions.size > 1) {
      const ids = list.map((d) => d.id);
      const versionList = [...versions.keys()];
      anomalies.push({
        id: `ver-conflict-${q}`,
        type: "answer_version_conflict",
        relatedDraftIds: ids,
        sourceDescription: `题号 ${q} 被 ${versionList.length} 个版本答案覆盖：${versionList.join(
          "、"
        )}`,
        impactScope: `该题号共 ${ids.length} 条草稿，汇总结果取决于人工选定版本，当前默认全部保留供复核`,
        explanation:
          "同一题号出现多个答案版本（如 v1 与 v2 同时存在），最耽误人的问题——教研编辑必须人工选定采用哪一版。",
        resolved: false,
      });
    }
  }
  return anomalies;
}

export function detectMissingNotes(drafts: DraftEntry[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  for (const d of drafts) {
    if (!d.supplementaryNote || d.supplementaryNote.trim().length === 0) {
      anomalies.push({
        id: `miss-note-${d.id}`,
        type: "missing_note",
        relatedDraftIds: [d.id],
        sourceDescription: `草稿 ${d.id.slice(
          0,
          6
        )}（题号 ${d.questionNo}）后补备注为空`,
        impactScope: "本条标记为不齐整材料，不阻塞验算但需阿宁补填备注",
        explanation:
          "学生草稿中的后补备注缺失，属于不齐整材料，工具仍放行参与验算，但在摘要中提示待补。",
        resolved: false,
      });
    }
  }
  return anomalies;
}
