from datetime import datetime
from typing import Dict, List, Optional

from .models import (
    ImputationResult,
    MetricSnapshot,
    MetricDiff,
    AuditEntry,
    RecordStatus,
)


class MetricsComparator:
    def __init__(self, audit_log: Optional[List[AuditEntry]] = None, run_id: str = ""):
        self.audit_log = audit_log if audit_log is not None else []
        self.run_id = run_id

    def _log(self, record_id: str, action: str, details: Dict):
        self.audit_log.append(
            AuditEntry(
                run_id=self.run_id,
                record_id=record_id,
                action=action,
                actor="MetricsComparator",
                details=details,
                timestamp=datetime.now().isoformat(),
            )
        )

    def compute_snapshot(self, results: List[ImputationResult]) -> MetricSnapshot:
        total = len(results)
        missing_count = sum(1 for r in results if r.evidences)
        imputed_count = sum(
            1 for r in results
            if r.status in (RecordStatus.IMPUTED, RecordStatus.REVIEWED, RecordStatus.APPROVED)
        )

        all_confidences = [e.confidence for r in results for e in r.evidences]
        avg_conf = sum(all_confidences) / len(all_confidences) if all_confidences else 1.0

        fields_imputed: Dict[str, int] = {}
        by_missing_type: Dict[str, int] = {}
        for r in results:
            for e in r.evidences:
                fields_imputed[e.field_name] = fields_imputed.get(e.field_name, 0) + 1
                mt = e.missing_type.value
                by_missing_type[mt] = by_missing_type.get(mt, 0) + 1

        snapshot = MetricSnapshot(
            run_id=self.run_id,
            total_records=total,
            missing_count=missing_count,
            imputed_count=imputed_count,
            avg_confidence=round(avg_conf, 4),
            fields_imputed=fields_imputed,
            by_missing_type=by_missing_type,
            computed_at=datetime.now().isoformat(),
        )
        self._log("ALL", "snapshot_computed", {"snapshot": snapshot.__dict__})
        return snapshot

    def diff_snapshots(
        self,
        previous: Optional[MetricSnapshot],
        current: MetricSnapshot,
        prev_results: Optional[List[ImputationResult]] = None,
        curr_results: Optional[List[ImputationResult]] = None,
    ) -> List[MetricDiff]:
        diffs = []

        if previous is None:
            diffs.append(MetricDiff(
                metric_name="baseline",
                previous_value=None,
                current_value=current.total_records,
                delta=current.total_records,
                cause="首次运行，无历史快照对比",
            ))
            return diffs

        metric_comparisons = [
            ("total_records", previous.total_records, current.total_records),
            ("missing_count", previous.missing_count, current.missing_count),
            ("imputed_count", previous.imputed_count, current.imputed_count),
            ("avg_confidence", previous.avg_confidence, current.avg_confidence),
        ]

        for name, prev_val, curr_val in metric_comparisons:
            if prev_val != curr_val:
                if name == "total_records":
                    cause = (
                        f"样本总数变化: {prev_val} → {curr_val}（"
                        f"{'新增样本' if curr_val > prev_val else '减少样本'}）"
                    )
                    if prev_results is not None and curr_results is not None:
                        prev_ids = {r.record_id for r in prev_results}
                        curr_ids = {r.record_id for r in curr_results}
                        added = curr_ids - prev_ids
                        removed = prev_ids - curr_ids
                        parts = []
                        if added:
                            parts.append(f"新增: {sorted(added)}")
                        if removed:
                            parts.append(f"移除: {sorted(removed)}")
                        if parts:
                            cause += "；" + "；".join(parts)
                elif name == "missing_count":
                    cause = (
                        f"缺失记录数变化: {prev_val} → {curr_val}，"
                        f"可能因样本增减或数据源修复导致"
                    )
                elif name == "imputed_count":
                    cause = (
                        f"修补成功数变化: {prev_val} → {curr_val}，"
                        f"需结合缺失记录数变化判断是修补能力变化还是样本变化"
                    )
                elif name == "avg_confidence":
                    cause = (
                        f"平均置信度变化: {prev_val:.4f} → {curr_val:.4f}，"
                        f"反映参考数据充足程度变化"
                    )
                else:
                    cause = f"{name} 从 {prev_val} 变为 {curr_val}"

                diffs.append(MetricDiff(
                    metric_name=name,
                    previous_value=prev_val,
                    current_value=curr_val,
                    delta=curr_val - prev_val if isinstance(curr_val, (int, float)) and isinstance(prev_val, (int, float)) else None,
                    cause=cause,
                ))

        for field_name in set(list(previous.fields_imputed.keys()) + list(current.fields_imputed.keys())):
            prev_count = previous.fields_imputed.get(field_name, 0)
            curr_count = current.fields_imputed.get(field_name, 0)
            if prev_count != curr_count:
                diffs.append(MetricDiff(
                    metric_name=f"field_imputed:{field_name}",
                    previous_value=prev_count,
                    current_value=curr_count,
                    delta=curr_count - prev_count,
                    cause=f"字段 {field_name} 修补次数变化: {prev_count} → {curr_count}",
                ))

        self._log("ALL", "diff_computed", {"diff_count": len(diffs)})
        return diffs
