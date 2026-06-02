import json
import os
from datetime import datetime
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional


@dataclass
class RunSnapshot:
    run_id: str
    timestamp: str
    total_records: int
    overall_metrics: Dict[str, Any]
    judgments_summary: Dict[str, int]
    remarks: List[Dict[str, str]] = field(default_factory=list)
    record_judgments: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "timestamp": self.timestamp,
            "total_records": self.total_records,
            "overall_metrics": self.overall_metrics,
            "judgments_summary": self.judgments_summary,
            "remarks": self.remarks,
            "record_judgments": self.record_judgments,
        }


@dataclass
class DiffResult:
    metric_changes: Dict[str, Any] = field(default_factory=dict)
    sample_changes: Dict[str, Any] = field(default_factory=dict)
    new_remarks: List[Dict[str, str]] = field(default_factory=list)
    explanation: str = ""

    def summary(self) -> str:
        lines = ["[重跑差异分析]"]
        lines.append(f"  指标变化:")
        for k, v in self.metric_changes.items():
            lines.append(f"    {k}: {v}")
        lines.append(f"  样本变化:")
        for k, v in self.sample_changes.items():
            lines.append(f"    {k}: {v}")
        if self.new_remarks:
            lines.append(f"  补录备注:")
            for r in self.new_remarks:
                lines.append(f"    ID={r.get('id', '?')}, 备注={r.get('remark', '?')}, 时间={r.get('timestamp', '?')}")
        lines.append(f"  解释: {self.explanation}")
        return "\n".join(lines)


class ChangeTracker:
    def __init__(self, history_dir: Optional[str] = None):
        self.history_dir = history_dir or os.path.join(os.getcwd(), ".audit_history")
        self.history: List[RunSnapshot] = []

    def save_snapshot(
        self,
        audit_result,
        remarks: Optional[Dict[str, str]] = None,
    ) -> RunSnapshot:
        run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        timestamp = datetime.now().isoformat()

        judgments_summary: Dict[str, int] = {}
        record_judgments: Dict[str, str] = {}
        for j in audit_result.judgments:
            judgments_summary[j.judgment] = judgments_summary.get(j.judgment, 0) + 1
            record_judgments[j.record_id] = j.judgment

        remarks_list = []
        if remarks:
            for rid, remark_text in remarks.items():
                remarks_list.append({
                    "id": rid,
                    "remark": remark_text,
                    "timestamp": timestamp,
                })

        snapshot = RunSnapshot(
            run_id=run_id,
            timestamp=timestamp,
            total_records=audit_result.overall_metrics.get("总记录数", 0),
            overall_metrics=audit_result.overall_metrics,
            judgments_summary=judgments_summary,
            remarks=remarks_list,
            record_judgments=record_judgments,
        )

        self.history.append(snapshot)
        self._persist(snapshot)
        return snapshot

    def _persist(self, snapshot: RunSnapshot):
        os.makedirs(self.history_dir, exist_ok=True)
        filepath = os.path.join(self.history_dir, f"run_{snapshot.run_id}.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(snapshot.to_dict(), f, ensure_ascii=False, indent=2)

    def load_history(self):
        if not os.path.exists(self.history_dir):
            return
        for fname in sorted(os.listdir(self.history_dir)):
            if fname.startswith("run_") and fname.endswith(".json"):
                filepath = os.path.join(self.history_dir, fname)
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                snapshot = RunSnapshot(
                    run_id=data["run_id"],
                    timestamp=data["timestamp"],
                    total_records=data["total_records"],
                    overall_metrics=data["overall_metrics"],
                    judgments_summary=data["judgments_summary"],
                    remarks=data.get("remarks", []),
                    record_judgments=data.get("record_judgments", {}),
                )
                self.history.append(snapshot)

    def diff(self, prev: RunSnapshot, curr: RunSnapshot) -> DiffResult:
        result = DiffResult()

        for key in set(list(prev.overall_metrics.keys()) + list(curr.overall_metrics.keys())):
            old_val = prev.overall_metrics.get(key)
            new_val = curr.overall_metrics.get(key)
            if old_val != new_val:
                result.metric_changes[key] = {"old": old_val, "new": new_val}

        prev_ids = set(prev.record_judgments.keys())
        curr_ids = set(curr.record_judgments.keys())

        added = curr_ids - prev_ids
        removed = prev_ids - curr_ids
        common = prev_ids & curr_ids

        judgment_changed = {}
        for rid in common:
            if prev.record_judgments[rid] != curr.record_judgments[rid]:
                judgment_changed[rid] = {
                    "old": prev.record_judgments[rid],
                    "new": curr.record_judgments[rid],
                }

        result.sample_changes = {
            "新增样本": sorted(added),
            "移除样本": sorted(removed),
            "判断变化样本": judgment_changed,
        }

        prev_remark_ids = {r["id"] for r in prev.remarks}
        for r in curr.remarks:
            if r["id"] not in prev_remark_ids:
                result.new_remarks.append(r)

        explanations = []
        if result.metric_changes:
            explanations.append(
                f"指标变化涉及: {', '.join(result.metric_changes.keys())}"
            )
        if added:
            explanations.append(f"新增 {len(added)} 条样本")
        if removed:
            explanations.append(f"移除 {len(removed)} 条样本")
        if judgment_changed:
            explanations.append(f"{len(judgment_changed)} 条样本判断发生变化")
        if result.new_remarks:
            explanations.append(f"新增 {len(result.new_remarks)} 条补录备注")

        if not explanations:
            result.explanation = "本次重跑与上次无差异"
        else:
            result.explanation = "; ".join(explanations)

        return result

    def add_remark(
        self,
        snapshot: RunSnapshot,
        record_id: str,
        remark_text: str,
    ) -> RunSnapshot:
        timestamp = datetime.now().isoformat()
        snapshot.remarks.append({
            "id": record_id,
            "remark": remark_text,
            "timestamp": timestamp,
        })
        self._persist(snapshot)
        return snapshot
