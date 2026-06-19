from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

from .models import (
    AttrResult,
    AttrStatus,
    AttributionRecord,
    Note,
    ParamVersion,
    SourceType,
)
from .decomposition import MatrixDecomposer
from .sources import FusionContext, SourceFusion
from .audit import AuditTrail


def _chart_aggregate(weights: Dict[str, float]) -> Dict[str, float]:
    buckets: Dict[str, float] = {}
    for k, v in weights.items():
        prefix = k.split("::")[0] if "::" in k else k
        buckets[prefix] = buckets.get(prefix, 0.0) + v
    return buckets


def _detail_sum(weights: Dict[str, float]) -> Dict[str, float]:
    return dict(weights)


@dataclass
class RecalcResult:
    original: AttributionRecord
    recalculated: AttributionRecord
    consistency_ok: bool
    diff_weights: Dict[str, float]
    chart_detail_consistent: bool
    chart_agg: Dict[str, float]
    detail_agg: Dict[str, float]


class RecalcEngine:
    def __init__(self, decomposer: MatrixDecomposer, audit: AuditTrail) -> None:
        self.decomposer = decomposer
        self.fusion = SourceFusion()
        self.audit = audit

    def rerun_with_note(
        self,
        record: AttributionRecord,
        base_ctx: FusionContext,
        extra_note: Note,
        operator: str,
    ) -> RecalcResult:
        original = copy.deepcopy(record)

        new_ctx = copy.deepcopy(base_ctx)
        new_ctx.add_note(extra_note)

        fresh = AttributionRecord(
            record_id=record.record_id + "-recalc",
            question_id=record.question_id,
            student_id=record.student_id,
        )
        recalculated = self.fusion.apply(fresh, new_ctx, self.decomposer)

        diff: Dict[str, float] = {}
        all_keys = set(original.knowledge_weights) | set(recalculated.knowledge_weights)
        for k in all_keys:
            diff[k] = recalculated.knowledge_weights.get(k, 0.0) - original.knowledge_weights.get(k, 0.0)

        consistency_ok = abs(sum(diff.values())) < 1e-6 or any(abs(v) > 1e-6 for v in diff.values())

        chart_agg = _chart_aggregate(recalculated.knowledge_weights)
        detail_agg = _detail_sum(recalculated.knowledge_weights)
        chart_detail_consistent = abs(sum(chart_agg.values()) - sum(detail_agg.values())) < 1e-6

        self.audit.log(
            recalculated,
            operator=operator,
            source_ref=f"recalc:{extra_note.note_id}",
            note=f"复算使用备注 {extra_note.note_id}，来源{extra_note.source_type.value}",
        )

        return RecalcResult(
            original=original,
            recalculated=recalculated,
            consistency_ok=consistency_ok,
            diff_weights=diff,
            chart_detail_consistent=chart_detail_consistent,
            chart_agg=chart_agg,
            detail_agg=detail_agg,
        )

    def make_attr_result(
        self,
        record: AttributionRecord,
        applied_sources: List[Tuple[SourceType, str]],
    ) -> AttrResult:
        weights = record.knowledge_weights
        chart_agg = _chart_aggregate(weights)
        detail_agg = _detail_sum(weights)
        chart_detail_consistent = abs(sum(chart_agg.values()) - sum(detail_agg.values())) < 1e-6

        csv_rows = []
        for kp, w in sorted(weights.items(), key=lambda x: -x[1]):
            csv_rows.append(
                {
                    "record_id": record.record_id,
                    "question_id": record.question_id,
                    "student_id": record.student_id,
                    "knowledge_point": kp,
                    "weight": round(w, 6),
                    "primary_cause": kp == record.primary_cause,
                    "status": record.status.value,
                    "confidence": round(record.confidence, 6),
                    "suspend_reason": record.suspend_reason or "",
                }
            )

        if record.status == AttrStatus.SUSPENDED:
            hint = "已挂起，需排班同事确认后再放行"
        elif record.status == AttrStatus.NEED_MATERIAL:
            hint = "材料不齐，先补料再算"
        elif record.confidence < 0.5:
            hint = "置信度偏低，建议人工复核主因"
        elif record.revision_count >= 3:
            hint = "改判次数较多，建议核对所有来源后再放行"
        else:
            hint = "口径稳定，可放行"

        return AttrResult(
            record=record,
            applied_sources=applied_sources,
            is_consistent=chart_detail_consistent,
            chart_aggregable=True,
            csv_rows=csv_rows,
            teacher_hint=hint,
        )
