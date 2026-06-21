from __future__ import annotations
from collections import defaultdict
from typing import Dict, List

from .dedupe import AnomalyLite, DraftLite


def detect_answer_version_conflicts(drafts: List[DraftLite]) -> List[AnomalyLite]:
    anomalies: List[AnomalyLite] = []
    by_q: Dict[str, List[DraftLite]] = defaultdict(list)
    for d in drafts:
        by_q[d.question_no].append(d)

    for q, lst in by_q.items():
        versions: Dict[str, List[DraftLite]] = defaultdict(list)
        for d in lst:
            v = d.answer_version or "未标注版本"
            versions[v].append(d)
        if len(versions) > 1:
            ids = [d.id for d in lst]
            version_list = list(versions.keys())
            anomalies.append(
                AnomalyLite(
                    type="answer_version_conflict",
                    related_draft_ids=ids,
                    source_description=(
                        f"题号 {q} 被 {len(version_list)} 个版本答案覆盖："
                        f"{'、'.join(version_list)}"
                    ),
                    impact_scope=(
                        f"该题号共 {len(ids)} 条草稿，"
                        f"汇总结果取决于人工选定版本，当前全部保留供复核"
                    ),
                    explanation=(
                        "同一题号出现多个答案版本（如 v1 与 v2 同时存在），"
                        "最耽误人的问题——教研编辑必须人工选定采用哪一版。"
                    ),
                )
            )
    return anomalies


def detect_missing_notes(drafts: List[DraftLite]) -> List[AnomalyLite]:
    anomalies: List[AnomalyLite] = []
    for d in drafts:
        if not d.supplementary_note or not d.supplementary_note.strip():
            anomalies.append(
                AnomalyLite(
                    type="missing_note",
                    related_draft_ids=[d.id],
                    source_description=(
                        f"草稿 {d.id[:6]}（题号 {d.question_no}）后补备注为空"
                    ),
                    impact_scope="本条标记为不齐整材料，不阻塞验算但需补填备注",
                    explanation=(
                        "学生草稿中的后补备注缺失，属于不齐整材料，"
                        "工具仍放行参与验算，但在摘要中提示待补。"
                    ),
                )
            )
    return anomalies
