from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional, Set

from .similarity import similarity_score


@dataclass
class DraftLite:
    id: str
    question_no: str
    answer_content: str
    answer_version: Optional[str]
    supplementary_note: Optional[str]
    fingerprint: str


@dataclass
class AnomalyLite:
    type: str
    related_draft_ids: List[str]
    source_description: str
    impact_scope: str
    explanation: str


@dataclass
class DedupResult:
    kept: List[DraftLite]
    anomalies: List[AnomalyLite] = field(default_factory=list)


def detect_duplicate_submissions(drafts: List[DraftLite]) -> DedupResult:
    seen: Dict[str, DraftLite] = {}
    kept: List[DraftLite] = []
    anomalies: List[AnomalyLite] = []

    for d in sorted(drafts, key=lambda x: x.id):
        existing = seen.get(d.fingerprint)
        if existing is not None:
            anomalies.append(
                AnomalyLite(
                    type="duplicate_submission",
                    related_draft_ids=[existing.id, d.id],
                    source_description=(
                        f"草稿 {existing.id[:6]} 与 {d.id[:6]} "
                        f"内容+备注指纹一致（{d.fingerprint}）"
                    ),
                    impact_scope=(
                        f"题号 {d.question_no} 的后补备注仅保留首份，"
                        f"后到的提交不计入有效汇总"
                    ),
                    explanation=(
                        "同一请求两次提交时，后补备注只能计一次。"
                        "工具按提交顺序取最早一份保留，其余标记为重复。"
                    ),
                )
            )
        else:
            seen[d.fingerprint] = d
            kept.append(d)
    return DedupResult(kept=kept, anomalies=anomalies)


def detect_duplicate_samples(
    drafts: List[DraftLite], threshold: float = 0.92
) -> List[AnomalyLite]:
    anomalies: List[AnomalyLite] = []
    by_q: Dict[str, List[DraftLite]] = {}
    for d in drafts:
        by_q.setdefault(d.question_no, []).append(d)

    for q, lst in by_q.items():
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                score = similarity_score(
                    lst[i].answer_content, lst[j].answer_content
                )
                if score >= threshold:
                    ids = [lst[i].id, lst[j].id]
                    anomalies.append(
                        AnomalyLite(
                            type="duplicate_sample",
                            related_draft_ids=ids,
                            source_description=(
                                f"题号 {q} 草稿 {ids[0][:6]} / {ids[1][:6]} "
                                f"内容相似度 {int(score * 100)}%"
                            ),
                            impact_scope=(
                                "该组重复样本不纳入正常汇总，"
                                "需人工确认是否为同源抄袭或误提交"
                            ),
                            explanation=(
                                f"答案内容 Jaccard 相似度 {int(score * 100)}%，"
                                f"超过阈值 {int(threshold * 100)}%，判定为重复样本。"
                            ),
                        )
                    )
    return anomalies


def duplicate_sample_ids(drafts: List[DraftLite], threshold: float = 0.92) -> Set[str]:
    """Return draft ids that are detected as duplicate samples (all but the first)."""
    excluded: Set[str] = set()
    by_q: Dict[str, List[DraftLite]] = {}
    for d in drafts:
        by_q.setdefault(d.question_no, []).append(d)
    for _, lst in by_q.items():
        for i in range(len(lst)):
            if lst[i].id in excluded:
                continue
            for j in range(i + 1, len(lst)):
                if lst[j].id in excluded:
                    continue
                if similarity_score(lst[i].answer_content, lst[j].answer_content) >= threshold:
                    excluded.add(lst[j].id)
    return excluded
