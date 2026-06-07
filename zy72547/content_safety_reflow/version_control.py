from datetime import datetime
from typing import Dict, List, Optional
import copy
import json
import os

from .models import UnifiedResult, ReflowStatus, EvaluationReport, ChangeLogEntry
from .reflow_engine import ReflowEngine


class VersionSnapshot:
    def __init__(
        self,
        version_id: str,
        timestamp: datetime,
        operator: str,
        results: Dict[str, UnifiedResult],
        description: str,
    ):
        self.version_id = version_id
        self.timestamp = timestamp
        self.operator = operator
        self.results_snapshot = {
            sid: copy.deepcopy(result.model_dump()) for sid, result in results.items()
        }
        self.description = description


class VersionController:
    def __init__(self, engine: ReflowEngine, data_dir: str = "./data"):
        self.engine = engine
        self.data_dir = data_dir
        self.snapshots: List[VersionSnapshot] = []
        self.report_history: List[EvaluationReport] = []
        self.version_counter = 0
        os.makedirs(data_dir, exist_ok=True)

    def create_snapshot(self, operator: str, description: str) -> VersionSnapshot:
        self.version_counter += 1
        version_id = f"snap_{self.version_counter:04d}_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        snapshot = VersionSnapshot(
            version_id=version_id,
            timestamp=datetime.now(),
            operator=operator,
            results=self.engine._results,
            description=description,
        )
        self.snapshots.append(snapshot)
        self._save_snapshot(snapshot)
        return snapshot

    def rollback_to_snapshot(self, version_id: str, operator: str) -> Dict:
        target_snapshot = None
        for snap in reversed(self.snapshots):
            if snap.version_id == version_id:
                target_snapshot = snap
                break

        if not target_snapshot:
            raise ValueError(f"找不到版本快照: {version_id}")

        self.engine._results.clear()

        for sid, data in target_snapshot.results_snapshot.items():
            self.engine._results[sid] = UnifiedResult(**data)

        for result in self.engine._results.values():
            result.change_history.append(
                ChangeLogEntry(
                    operator=operator,
                    action="rollback",
                    reason=f"回滚到版本 {version_id}: {target_snapshot.description}",
                )
            )
            result.status = ReflowStatus.ROLLBACKED
            result.last_updated = datetime.now()

        return {
            "rollback_complete": True,
            "target_version_id": version_id,
            "target_description": target_snapshot.description,
            "target_timestamp": target_snapshot.timestamp.isoformat(),
            "restored_samples_count": len(self.engine._results),
            "operator": operator,
            "rollback_time": datetime.now().isoformat(),
        }

    def rollback_last_report(self, operator: str) -> Dict:
        if len(self.report_history) < 2:
            raise ValueError("报告历史不足，无法回滚")

        current_report = self.report_history[-1]
        previous_report = self.report_history[-2]

        self.report_history.pop()

        for result in self.engine._results.values():
            result.change_history.append(
                ChangeLogEntry(
                    operator=operator,
                    action="report_rollback",
                    field_name="report_version",
                    old_value=f"{current_report.report_id}_v{current_report.version}",
                    new_value=f"{previous_report.report_id}_v{previous_report.version}",
                    reason=f"撤回评测报告 {current_report.report_id}，恢复到上一版",
                )
            )
            result.last_updated = datetime.now()

        return {
            "rollback_complete": True,
            "withdrawn_report_id": current_report.report_id,
            "withdrawn_version": current_report.version,
            "restored_report_id": previous_report.report_id,
            "restored_version": previous_report.version,
            "operator": operator,
            "rollback_time": datetime.now().isoformat(),
        }

    def register_report(self, report: EvaluationReport) -> None:
        self.report_history.append(report)

    def get_snapshot_list(self) -> List[Dict]:
        return [
            {
                "version_id": s.version_id,
                "timestamp": s.timestamp.isoformat(),
                "operator": s.operator,
                "description": s.description,
                "samples_count": len(s.results_snapshot),
            }
            for s in self.snapshots
        ]

    def get_report_history(self) -> List[Dict]:
        return [
            {
                "report_id": r.report_id,
                "version": r.version,
                "generated_time": r.generated_time.isoformat(),
                "generated_by": r.generated_by,
                "total_samples": r.total_samples,
                "parent_report_id": r.parent_report_id,
            }
            for r in self.report_history
        ]

    def _save_snapshot(self, snapshot: VersionSnapshot) -> None:
        snap_dir = os.path.join(self.data_dir, "snapshots")
        os.makedirs(snap_dir, exist_ok=True)
        snap_path = os.path.join(snap_dir, f"{snapshot.version_id}.json")

        data = {
            "version_id": snapshot.version_id,
            "timestamp": snapshot.timestamp.isoformat(),
            "operator": snapshot.operator,
            "description": snapshot.description,
            "results_snapshot": snapshot.results_snapshot,
        }

        with open(snap_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
