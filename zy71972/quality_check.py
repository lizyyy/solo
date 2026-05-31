import uuid
import difflib
from datetime import datetime
from typing import List, Dict, Any, Optional

from models import QualityCheckRecord
from storage import DataStorage


class QualityCheckManager:
    def __init__(self, storage: DataStorage):
        self.storage = storage

    def submit_quality_check(
        self,
        call_id: str,
        task_id: str,
        checker: str,
        original_result: str,
        checked_result: str,
        comments: Optional[str] = None
    ) -> Dict[str, Any]:
        is_modified = original_result != checked_result

        qc = QualityCheckRecord(
            check_id=str(uuid.uuid4()),
            call_id=call_id,
            task_id=task_id,
            checker=checker,
            check_time=datetime.now(),
            original_result=original_result,
            checked_result=checked_result,
            check_comments=comments,
            is_modified=is_modified
        )

        self.storage.save_quality_check(qc)

        if is_modified:
            call = self.storage.get_call(call_id)
            if call:
                old_value = call.manual_result
                call.manual_result = checked_result
                self.storage.update_call(call)

                from models import AuditLog
                audit_log = AuditLog(
                    log_id=str(uuid.uuid4()),
                    call_id=call_id,
                    field_name="manual_result",
                    old_value=old_value,
                    new_value=checked_result,
                    operator=f"质检-{checker}",
                    operate_time=datetime.now(),
                    reason=f"质检修正: {comments or '无备注'}"
                )
                self.storage.add_audit_log(audit_log)

        return {
            "success": True,
            "check_id": qc.check_id,
            "call_id": call_id,
            "is_modified": is_modified,
            "diff": self._generate_diff(original_result, checked_result) if is_modified else None
        }

    def batch_import_quality_checks(
        self,
        qc_data_list: List[Dict[str, Any]],
        importer: str
    ) -> Dict[str, Any]:
        results = []
        modified_count = 0
        unchanged_count = 0

        for qc_data in qc_data_list:
            result = self.submit_quality_check(
                call_id=qc_data["call_id"],
                task_id=qc_data["task_id"],
                checker=qc_data.get("checker", importer),
                original_result=qc_data["original_result"],
                checked_result=qc_data["checked_result"],
                comments=qc_data.get("comments")
            )
            results.append(result)
            if result.get("is_modified"):
                modified_count += 1
            else:
                unchanged_count += 1

        return {
            "total": len(qc_data_list),
            "modified_count": modified_count,
            "unchanged_count": unchanged_count,
            "results": results
        }

    def _generate_diff(self, old: str, new: str) -> str:
        diff = difflib.unified_diff(
            [old],
            [new],
            fromfile='原始结果',
            tofile='质检结果',
            lineterm=''
        )
        return '\n'.join(list(diff))

    def get_call_quality_history(self, call_id: str) -> Dict[str, Any]:
        checks = self.storage.get_quality_checks(call_id)
        call = self.storage.get_call(call_id)

        if not call and not checks:
            return {"exists": False}

        history = []
        for qc in checks:
            history.append({
                "check_id": qc.check_id,
                "check_time": qc.check_time.strftime("%Y-%m-%d %H:%M:%S"),
                "checker": qc.checker,
                "original_result": qc.original_result,
                "checked_result": qc.checked_result,
                "is_modified": qc.is_modified,
                "comments": qc.check_comments,
                "diff": self._generate_diff(qc.original_result, qc.checked_result) if qc.is_modified else None
            })

        return {
            "exists": True,
            "call_id": call_id,
            "current_result": call.manual_result if call else None,
            "check_count": len(checks),
            "modified_count": len([c for c in checks if c.is_modified]),
            "quality_history": history
        }

    def compare_weekly_reports(
        self,
        week_start: str,
        week_end: str,
        task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        if task_id:
            calls = self.storage.get_calls_by_task(task_id)
        else:
            calls = self.storage.get_all_calls()

        start_dt = datetime.fromisoformat(week_start)
        end_dt = datetime.fromisoformat(week_end)

        qc_checks = self.storage.get_quality_checks()
        weekly_checks = [
            qc for qc in qc_checks
            if start_dt <= qc.check_time <= end_dt
        ]

        manual_changes = self.storage.get_audit_logs()
        weekly_manual_changes = [
            log for log in manual_changes
            if start_dt <= log.operate_time <= end_dt and log.field_name == "manual_result"
        ]

        inconsistencies = []
        qc_call_map = {qc.call_id: qc for qc in weekly_checks}

        for log in weekly_manual_changes:
            if log.call_id in qc_call_map:
                qc = qc_call_map[log.call_id]
                if log.new_value != qc.checked_result:
                    if not log.operator.startswith("质检-"):
                        inconsistencies.append({
                            "call_id": log.call_id,
                            "manual_operator": log.operator,
                            "manual_time": log.operate_time.strftime("%Y-%m-%d %H:%M:%S"),
                            "manual_result": log.new_value,
                            "qc_checker": qc.checker,
                            "qc_time": qc.check_time.strftime("%Y-%m-%d %H:%M:%S"),
                            "qc_result": qc.checked_result,
                            "issue": "人工改判覆盖了质检结果"
                        })

        return {
            "week_range": f"{week_start} 至 {week_end}",
            "total_checks": len(weekly_checks),
            "total_manual_changes": len(weekly_manual_changes),
            "inconsistencies": inconsistencies,
            "inconsistency_count": len(inconsistencies)
        }

    def get_quality_summary(
        self,
        task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        if task_id:
            calls = self.storage.get_calls_by_task(task_id)
        else:
            calls = self.storage.get_all_calls()

        all_checks = self.storage.get_quality_checks()
        if task_id:
            all_checks = [qc for qc in all_checks if qc.task_id == task_id]

        modified_checks = [qc for qc in all_checks if qc.is_modified]

        checker_stats = {}
        for qc in all_checks:
            checker = qc.checker
            if checker not in checker_stats:
                checker_stats[checker] = {"total": 0, "modified": 0}
            checker_stats[checker]["total"] += 1
            if qc.is_modified:
                checker_stats[checker]["modified"] += 1

        for checker in checker_stats:
            stats = checker_stats[checker]
            stats["modify_rate"] = round(stats["modified"] / stats["total"] * 100, 2) if stats["total"] > 0 else 0

        return {
            "total_calls": len(calls),
            "checked_count": len(all_checks),
            "modified_count": len(modified_checks),
            "check_coverage": round(len(set(qc.call_id for qc in all_checks)) / len(calls) * 100, 2) if len(calls) > 0 else 0,
            "modify_rate": round(len(modified_checks) / len(all_checks) * 100, 2) if len(all_checks) > 0 else 0,
            "checker_statistics": checker_stats
        }
