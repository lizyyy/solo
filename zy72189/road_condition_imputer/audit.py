from datetime import datetime
from typing import Dict, List, Optional

from .models import (
    AuditEntry,
    MetricSnapshot,
    MetricDiff,
    RecordStatus,
)


class AuditTrail:
    def __init__(self):
        self.entries: List[AuditEntry] = []
        self.snapshots: List[MetricSnapshot] = []
        self._run_index: Dict[str, int] = {}

    def add_entries(self, entries: List[AuditEntry]):
        self.entries.extend(entries)

    def add_snapshot(self, snapshot: MetricSnapshot):
        self._run_index[snapshot.run_id] = len(self.snapshots)
        self.snapshots.append(snapshot)

    def get_entries_for_record(self, record_id: str) -> List[AuditEntry]:
        return [e for e in self.entries if e.record_id == record_id]

    def get_entries_for_run(self, run_id: str) -> List[AuditEntry]:
        return [e for e in self.entries if e.run_id == run_id]

    def get_snapshot(self, run_id: str) -> Optional[MetricSnapshot]:
        idx = self._run_index.get(run_id)
        if idx is not None:
            return self.snapshots[idx]
        return None

    def explain_run_diff(self, prev_run_id: str, curr_run_id: str) -> Dict:
        prev_snapshot = self.get_snapshot(prev_run_id)
        curr_snapshot = self.get_snapshot(curr_run_id)

        if not prev_snapshot or not curr_snapshot:
            return {"error": "缺少对比快照", "prev": prev_run_id, "curr": curr_run_id}

        sample_diff = {
            "prev_total": prev_snapshot.total_records,
            "curr_total": curr_snapshot.total_records,
            "delta": curr_snapshot.total_records - prev_snapshot.total_records,
        }

        metric_diff = {
            "prev_missing": prev_snapshot.missing_count,
            "curr_missing": curr_snapshot.missing_count,
            "prev_imputed": prev_snapshot.imputed_count,
            "curr_imputed": curr_snapshot.imputed_count,
            "prev_confidence": prev_snapshot.avg_confidence,
            "curr_confidence": curr_snapshot.avg_confidence,
        }

        prev_ids = set()
        curr_ids = set()
        for e in self.entries:
            if e.run_id == prev_run_id and e.action == "loaded":
                prev_ids.add(e.record_id)
            if e.run_id == curr_run_id and e.action == "loaded":
                curr_ids.add(e.record_id)

        added = curr_ids - prev_ids
        removed = prev_ids - curr_ids
        common = prev_ids & curr_ids

        return {
            "sample_change": {
                "total_delta": sample_diff["delta"],
                "added_records": sorted(added),
                "removed_records": sorted(removed),
                "common_records": sorted(common),
            },
            "metric_change": metric_diff,
            "explanation": (
                f"样本变化: {len(added)} 条新增, {len(removed)} 条移除, {len(common)} 条不变; "
                f"指标变化: 缺失 {metric_diff['prev_missing']}→{metric_diff['curr_missing']}, "
                f"修补成功 {metric_diff['prev_imputed']}→{metric_diff['curr_imputed']}, "
                f"置信度 {metric_diff['prev_confidence']:.4f}→{metric_diff['curr_confidence']:.4f}"
            ),
        }

    def format_audit_for_record(self, record_id: str) -> str:
        entries = self.get_entries_for_record(record_id)
        if not entries:
            return f"记录 {record_id} 无审计日志"

        lines = [f"=== 审计追踪: {record_id} ==="]
        for e in entries:
            detail_str = ", ".join(f"{k}={v}" for k, v in e.details.items()) if e.details else ""
            lines.append(f"  [{e.timestamp}] run={e.run_id} | {e.actor} | {e.action} | {detail_str}")
        return "\n".join(lines)
