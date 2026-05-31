from typing import List, Optional, Tuple
from datetime import datetime

from models import DataStore, QARecord, OperationLog, JudgmentStatus


class JudgmentManager:
    def __init__(self, data_store: DataStore):
        self.data_store = data_store
    
    def get_records_for_judgment(
        self,
        status_filter: Optional[List[JudgmentStatus]] = None,
        batch_id: Optional[str] = None,
        has_issues: Optional[bool] = None,
        limit: Optional[int] = None,
    ) -> List[QARecord]:
        records = self.data_store.load_all_qa_records()
        records = [r for r in records if r.is_latest]
        
        if status_filter:
            status_values = [s.value for s in status_filter]
            records = [r for r in records if r.get_final_status().value in status_values]
        
        if batch_id:
            records = [r for r in records if r.import_batch_id == batch_id]
        
        if has_issues is not None:
            if has_issues:
                records = [r for r in records if r.issues]
            else:
                records = [r for r in records if not r.issues]
        
        if limit:
            records = records[:limit]
        
        return records
    
    def manual_judge(
        self,
        qa_id: str,
        judgment: JudgmentStatus,
        reason: str,
        operator: str,
    ) -> Tuple[bool, str]:
        if judgment not in [
            JudgmentStatus.MANUAL_PASS,
            JudgmentStatus.MANUAL_FAIL,
            JudgmentStatus.MANUAL_REVISED,
            JudgmentStatus.PENDING,
        ]:
            return False, "不支持的判断类型"
        
        if not reason.strip():
            return False, "判断理由不能为空"
        
        record = self.data_store.load_qa_record(qa_id)
        if not record:
            return False, f"未找到记录: {qa_id}"
        
        old_status = record.get_final_status().value
        record.set_manual_judgment(judgment, reason, operator)
        
        self.data_store.save_qa_record(record)
        
        log = OperationLog(
            operation_type="人工改判",
            operator=operator,
            details=f"记录: {qa_id}, 原状态: {old_status}, 新状态: {judgment.value}, 理由: {reason}",
        )
        self.data_store.save_operation_log(log)
        
        return True, "改判成功"
    
    def revise_answer(
        self,
        qa_id: str,
        new_answer: str,
        reason: str,
        operator: str,
        new_source: str = "",
        new_source_link: str = "",
    ) -> Tuple[bool, str]:
        if not new_answer.strip():
            return False, "新答案不能为空"
        
        if not reason.strip():
            return False, "修改理由不能为空"
        
        record = self.data_store.load_qa_record(qa_id)
        if not record:
            return False, f"未找到记录: {qa_id}"
        
        old_answer = record.answer
        
        record.answer = new_answer
        if new_source:
            record.source = new_source
        if new_source_link:
            record.source_link = new_source_link
        
        record.set_manual_judgment(JudgmentStatus.MANUAL_REVISED, reason, operator)
        
        self.data_store.save_qa_record(record)
        
        log = OperationLog(
            operation_type="答案修正",
            operator=operator,
            details=f"记录: {qa_id}, 修改答案, 理由: {reason}",
        )
        self.data_store.save_operation_log(log)
        
        return True, "修正成功"
    
    def withdraw_judgment(
        self,
        qa_id: str,
        reason: str,
        operator: str,
    ) -> Tuple[bool, str]:
        if not reason.strip():
            return False, "撤回理由不能为空"
        
        record = self.data_store.load_qa_record(qa_id)
        if not record:
            return False, f"未找到记录: {qa_id}"
        
        if not record.manual_judgment:
            return False, "该记录没有人工判断，无需撤回"
        
        old_judgment = record.manual_judgment.value
        old_reason = record.manual_reason
        
        record.manual_judgment = None
        record.manual_reason = ""
        record.manual_operator = ""
        record.manual_time = None
        
        self.data_store.save_qa_record(record)
        
        log = OperationLog(
            operation_type="撤回改判",
            operator=operator,
            details=f"记录: {qa_id}, 撤回判断: {old_judgment}, 原理由: {old_reason}, 撤回理由: {reason}",
        )
        self.data_store.save_operation_log(log)
        
        return True, "撤回成功"
    
    def add_note(
        self,
        qa_id: str,
        note: str,
        operator: str,
        append: bool = True,
    ) -> Tuple[bool, str]:
        if not note.strip():
            return False, "备注内容不能为空"
        
        record = self.data_store.load_qa_record(qa_id)
        if not record:
            return False, f"未找到记录: {qa_id}"
        
        old_note = record.notes
        
        if append and old_note:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            record.notes = f"{old_note}\n[{operator} {timestamp}] {note}"
        else:
            record.notes = note
        
        self.data_store.save_qa_record(record)
        
        log = OperationLog(
            operation_type="添加备注",
            operator=operator,
            details=f"记录: {qa_id}, 添加备注",
        )
        self.data_store.save_operation_log(log)
        
        return True, "备注添加成功"
    
    def get_judgment_history(self, qa_id: str) -> List[dict]:
        logs = self.data_store.load_all_operation_logs()
        record_logs = []
        
        for log in logs:
            if qa_id in log.details:
                record_logs.append({
                    "time": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "operator": log.operator,
                    "operation": log.operation_type,
                    "details": log.details,
                })
        
        return record_logs
    
    def batch_judge(
        self,
        qa_ids: List[str],
        judgment: JudgmentStatus,
        reason: str,
        operator: str,
    ) -> Tuple[int, List[str]]:
        success_count = 0
        failed_ids = []
        
        for qa_id in qa_ids:
            success, msg = self.manual_judge(qa_id, judgment, reason, operator)
            if success:
                success_count += 1
            else:
                failed_ids.append(f"{qa_id}: {msg}")
        
        return success_count, failed_ids
    
    def get_judgment_statistics(self) -> dict:
        records = self.data_store.load_all_qa_records()
        records = [r for r in records if r.is_latest]
        
        total = len(records)
        status_counts = {}
        ai_accuracy = 0.0
        
        ai_vs_manual = {
            "ai_pass_manual_pass": 0,
            "ai_pass_manual_fail": 0,
            "ai_fail_manual_pass": 0,
            "ai_fail_manual_fail": 0,
        }
        
        for record in records:
            status = record.get_final_status().value
            status_counts[status] = status_counts.get(status, 0) + 1
            
            if record.ai_judgment and record.manual_judgment:
                ai_pass = record.ai_judgment == JudgmentStatus.AI_PASS
                manual_pass = record.manual_judgment in [
                    JudgmentStatus.MANUAL_PASS,
                    JudgmentStatus.MANUAL_REVISED,
                ]
                
                if ai_pass and manual_pass:
                    ai_vs_manual["ai_pass_manual_pass"] += 1
                elif ai_pass and not manual_pass:
                    ai_vs_manual["ai_pass_manual_fail"] += 1
                elif not ai_pass and manual_pass:
                    ai_vs_manual["ai_fail_manual_pass"] += 1
                else:
                    ai_vs_manual["ai_fail_manual_fail"] += 1
        
        manual_judged = (
            ai_vs_manual["ai_pass_manual_pass"]
            + ai_vs_manual["ai_pass_manual_fail"]
            + ai_vs_manual["ai_fail_manual_pass"]
            + ai_vs_manual["ai_fail_manual_fail"]
        )
        
        if manual_judged > 0:
            correct = (
                ai_vs_manual["ai_pass_manual_pass"]
                + ai_vs_manual["ai_fail_manual_fail"]
            )
            ai_accuracy = correct / manual_judged
        
        return {
            "total_records": total,
            "status_breakdown": status_counts,
            "ai_vs_manual": ai_vs_manual,
            "manual_judged_count": manual_judged,
            "ai_accuracy": ai_accuracy,
            "manual_coverage": manual_judged / total if total > 0 else 0.0,
        }
