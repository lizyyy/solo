import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any

from models import CallRecord, AuditLog, ManualJudgment
from storage import DataStorage


class ManualJudgmentManager:
    def __init__(self, storage: DataStorage):
        self.storage = storage

    def update_manual_result(
        self,
        call_id: str,
        new_result: str,
        operator: str,
        reason: Optional[str] = None,
        ip_address: Optional[str] = None
    ) -> Dict[str, Any]:
        call = self.storage.get_call(call_id)
        if not call:
            return {"success": False, "error": f"呼叫记录 {call_id} 不存在"}

        old_result = call.manual_result

        if old_result == new_result:
            return {
                "success": True,
                "unchanged": True,
                "message": "结果未发生变化，无需更新"
            }

        call.manual_result = new_result
        call.manual_operator = operator
        call.manual_judge_time = datetime.now()
        self.storage.update_call(call)

        log_id = str(uuid.uuid4())
        audit_log = AuditLog(
            log_id=log_id,
            call_id=call_id,
            field_name="manual_result",
            old_value=old_result,
            new_value=new_result,
            operator=operator,
            operate_time=datetime.now(),
            reason=reason,
            ip_address=ip_address
        )
        self.storage.add_audit_log(audit_log)

        return {
            "success": True,
            "call_id": call_id,
            "old_result": old_result,
            "new_result": new_result,
            "operator": operator,
            "operate_time": audit_log.operate_time.isoformat(),
            "log_id": log_id
        }

    def batch_update_manual_result(
        self,
        call_ids: List[str],
        new_result: str,
        operator: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        results = []
        success_count = 0
        failed_count = 0

        for call_id in call_ids:
            result = self.update_manual_result(call_id, new_result, operator, reason)
            if result.get("success"):
                success_count += 1
            else:
                failed_count += 1
            results.append(result)

        return {
            "total": len(call_ids),
            "success_count": success_count,
            "failed_count": failed_count,
            "results": results
        }

    def get_call_history(self, call_id: str) -> Dict[str, Any]:
        call = self.storage.get_call(call_id)
        if not call:
            return {"exists": False}

        audit_logs = self.storage.get_audit_logs(call_id)
        change_history = []

        for log in audit_logs:
            change_history.append({
                "operate_time": log.operate_time.strftime("%Y-%m-%d %H:%M:%S"),
                "operator": log.operator,
                "field": log.field_name,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "reason": log.reason
            })

        return {
            "exists": True,
            "call_id": call_id,
            "current_result": call.manual_result,
            "current_operator": call.manual_operator,
            "last_judge_time": call.manual_judge_time.strftime("%Y-%m-%d %H:%M:%S") if call.manual_judge_time else None,
            "change_count": len(change_history),
            "change_history": change_history
        }

    def who_changed(self, call_id: str, field_name: str = "manual_result") -> List[Dict[str, Any]]:
        audit_logs = self.storage.get_audit_logs(call_id)
        changers = []

        for log in audit_logs:
            if log.field_name == field_name:
                changers.append({
                    "operator": log.operator,
                    "operate_time": log.operate_time.strftime("%Y-%m-%d %H:%M:%S"),
                    "old_value": log.old_value,
                    "new_value": log.new_value,
                    "reason": log.reason
                })

        return changers

    def get_manual_judge_summary(self, task_id: Optional[str] = None) -> Dict[str, Any]:
        if task_id:
            calls = self.storage.get_calls_by_task(task_id)
        else:
            calls = self.storage.get_all_calls()

        total_calls = len(calls)
        judged_calls = [c for c in calls if c.manual_result is not None]
        unjudged_calls = [c for c in calls if c.manual_result is None]

        result_distribution = {}
        for call in judged_calls:
            result = call.manual_result
            result_distribution[result] = result_distribution.get(result, 0) + 1

        operators = set()
        for call in judged_calls:
            if call.manual_operator:
                operators.add(call.manual_operator)

        return {
            "total_calls": total_calls,
            "judged_count": len(judged_calls),
            "unjudged_count": len(unjudged_calls),
            "judge_rate": round(len(judged_calls) / total_calls * 100, 2) if total_calls > 0 else 0,
            "result_distribution": result_distribution,
            "operators": sorted(list(operators))
        }

    def get_operator_statistics(self) -> List[Dict[str, Any]]:
        operators = self.storage.get_manual_operators()
        stats = []

        for operator in operators:
            all_logs = self.storage.get_audit_logs()
            operator_logs = [
                log for log in all_logs
                if log.operator == operator and log.field_name == "manual_result"
            ]

            total_changes = len(operator_logs)
            if total_changes == 0:
                continue

            unique_calls = len(set(log.call_id for log in operator_logs))
            last_operation = max(log.operate_time for log in operator_logs)

            stats.append({
                "operator": operator,
                "total_changes": total_changes,
                "unique_calls_handled": unique_calls,
                "last_operation_time": last_operation.strftime("%Y-%m-%d %H:%M:%S")
            })

        stats.sort(key=lambda x: x["total_changes"], reverse=True)
        return stats

    def get_recent_changes(
        self,
        limit: int = 50,
        operator: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        all_logs = self.storage.get_audit_logs()

        if operator:
            logs = [log for log in all_logs if log.operator == operator]
        else:
            logs = all_logs

        result = []
        for log in logs[:limit]:
            call = self.storage.get_call(log.call_id)
            result.append({
                "operate_time": log.operate_time.strftime("%Y-%m-%d %H:%M:%S"),
                "operator": log.operator,
                "call_id": log.call_id,
                "task_name": call.task_name if call else None,
                "customer_name": call.customer_name if call else None,
                "field": log.field_name,
                "old_value": log.old_value,
                "new_value": log.new_value,
                "reason": log.reason
            })

        return result
