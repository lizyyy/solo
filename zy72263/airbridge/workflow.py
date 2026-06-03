import json
from datetime import datetime
from typing import Dict, List, Any, Optional, Callable
from .models import CoordinateOrigin, InspectionPhoto


class WorkflowEngine:
    def __init__(self, preflight_manager, review_manager, visualizer):
        self.preflight_manager = preflight_manager
        self.review_manager = review_manager
        self.visualizer = visualizer
        self._workflow_log: List[Dict[str, Any]] = []

    def run_three_step_workflow(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        self._log("workflow_started", {"steps": ["import_origins", "review_photos", "update_report"]})

        result = {
            "step1_import": self._step1_import_origins(test_data),
            "step2_review_photos": self._step2_review_photos(test_data),
            "step3_update_report": self._step3_update_report(test_data),
            "workflow_complete": True,
        }

        self._log("workflow_completed", result)
        return result

    def _step1_import_origins(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        origins_data = test_data.get("coordinate_origins", [])
        origins = [CoordinateOrigin(**o) for o in origins_data]

        created, skipped = self.preflight_manager.import_coordinate_origins(
            origins, actor="system_initial"
        )

        result = {
            "imported_count": len(created),
            "skipped_count": len(skipped),
            "created_records": [r.id for r in created],
            "skipped_origins": skipped,
        }

        self._log("step1_import", result)
        return result

    def _step2_review_photos(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        photos_data = test_data.get("inspection_photos", [])
        photos = [InspectionPhoto(**p) for p in photos_data]

        added_records = []
        blocked_count = 0
        for photo in photos:
            record = self.preflight_manager.add_inspection_photo(
                photo, actor="designer_ajing"
            )
            if record:
                added_records.append(record.id)
                if photo.is_alert_label_blocked():
                    blocked_count += 1

        result = {
            "photos_added": len(added_records),
            "records_affected": added_records,
            "blocked_alerts_detected": blocked_count,
            "photos_with_issue": [
                p.id for p in photos if p.is_alert_label_blocked()
            ],
        }

        self._log("step2_review_photos", result)
        return result

    def _step3_update_report(self, test_data: Dict[str, Any]) -> Dict[str, Any]:
        safety_distances = test_data.get("safety_distance_report", {})
        remark_updates = test_data.get("remark_updates", [])

        updated_remarks = []
        for update in remark_updates:
            result = self.preflight_manager.update_photo_remark(
                update["photo_id"],
                update["new_remark"],
                actor="designer_ajing"
            )
            if result and result["changed"]:
                updated_remarks.append(update["photo_id"])

        records_need_review = self.review_manager.get_records_needing_review()
        for record in records_need_review:
            photos = self.preflight_manager.get_photos_by_origin_id(record.coordinate_origin_id)
            for photo in photos:
                if photo.is_alert_label_blocked():
                    self.review_manager.submit_for_manager_review(
                        record.id, photo.id, submitter="designer_ajing"
                    )

        result = {
            "safety_distances_applied": safety_distances,
            "remarks_updated": updated_remarks,
            "records_submitted_for_manager_review": len(records_need_review),
            "pending_review_count": len(self.review_manager.get_records_needing_review()),
        }

        self._log("step3_update_report", result)
        return result

    def export_workflow_log(self, format_type: str = "json") -> str:
        log_data = {
            "generated_at": datetime.now().isoformat(),
            "total_entries": len(self._workflow_log),
            "entries": self._workflow_log,
        }

        if format_type == "json":
            return json.dumps(log_data, indent=2, ensure_ascii=False)
        return str(log_data)

    def _log(self, action: str, details: Dict[str, Any]):
        self._workflow_log.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "details": details,
        })

    def generate_replay_script(self) -> str:
        commands = self.visualizer.get_replay_commands()
        script_content = [
            "#!/usr/bin/env python3",
            "# 机场廊桥停靠预演 - 重放脚本",
            "# 生成时间: " + datetime.now().isoformat(),
            "",
            "import sys",
            "sys.path.insert(0, '.')",
            "",
            "from airbridge import PreflightManager, ReviewManager, Visualizer, WorkflowEngine",
            "from airbridge.models import CoordinateOrigin, InspectionPhoto",
            "",
            "def replay():",
            "    pm = PreflightManager()",
            "    rm = ReviewManager(pm)",
            "    vz = Visualizer(pm)",
            "    we = WorkflowEngine(pm, rm, vz)",
            "    ",
            "    print('开始重放机场廊桥停靠预演流程...')",
            "    print()",
            "",
        ]

        for i, cmd in enumerate(commands, 1):
            if cmd:
                script_content.append(f"    # 步骤 {i}")
                script_content.append(f"    print('执行: {cmd}')")
                script_content.append(f"    # {cmd}")
                script_content.append("")

        script_content.extend([
            "    print()",
            "    print('重放完成！')",
            "    print(f'预演记录总数: {len(pm.get_all_preflight_records())}')",
            "    print(f'待复核记录数: {len(rm.get_records_needing_review())}')",
            "",
            "if __name__ == '__main__':",
            "    replay()",
            "",
        ])

        return "\n".join(script_content)

    def verify_history_diff(self, record_id: str) -> Optional[Dict[str, Any]]:
        history = self.preflight_manager.get_record_history(record_id)
        if not history:
            return None

        diffs = []
        for i in range(1, len(history)):
            prev = history[i - 1]
            curr = history[i]

            if curr["action"] == "remark_updated":
                diffs.append({
                    "timestamp": curr["timestamp"],
                    "actor": curr["actor"],
                    "type": "remark_change",
                    "photo_id": curr["details"]["photo_id"],
                    "old_value": curr["details"]["old_remark"],
                    "new_value": curr["details"]["new_remark"],
                })

        return {
            "record_id": record_id,
            "total_history_entries": len(history),
            "remark_changes": diffs,
        }
