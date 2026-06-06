from typing import List, Dict, Tuple
from pathlib import Path

from .models import (
    TicketRecord, ImportBatch, SelfCheckResult,
    LeaveStatus, VerificationReport, Conflict, ConflictType,
    RepertoireChecklist, AudioRemark
)
from .ticket_importer import TicketImporter


class SelfChecker:
    def __init__(self):
        self.importer = TicketImporter()

    def run_all_checks(
        self,
        tickets: List[TicketRecord],
        import_batches: List[ImportBatch],
        checklists: List[RepertoireChecklist] = None
    ) -> List[SelfCheckResult]:
        results = []

        results.append(self.check_duplicate_imports(import_batches))
        results.append(self.check_leave_counted(tickets))
        results.append(self.check_duplicate_records(tickets))
        results.append(self.check_incomplete_fields(tickets))

        if checklists:
            results.append(self.check_checklist_consistency(tickets, checklists))

        return results

    def check_duplicate_imports(self, batches: List[ImportBatch]) -> SelfCheckResult:
        issues = []
        duplicate_batches = [b for b in batches if b.is_duplicate]

        for batch in duplicate_batches:
            issues.append({
                "batch_id": batch.batch_id,
                "file_name": batch.file_name,
                "duplicate_of": batch.duplicate_of,
                "record_count": batch.record_count
            })

        return SelfCheckResult(
            check_name="重复导入检测",
            passed=len(issues) == 0,
            details=f"检测到 {len(issues)} 个重复导入批次" if issues else "无重复导入",
            issues=issues
        )

    def check_leave_counted(self, tickets: List[TicketRecord]) -> SelfCheckResult:
        issues = []

        for ticket in tickets:
            if ticket.leave_status == LeaveStatus.LEAVE and ticket.is_consumed:
                issues.append({
                    "ticket_id": ticket.ticket_id,
                    "student_name": ticket.student_name,
                    "repertoire": ticket.repertoire,
                    "performance_date": ticket.performance_date,
                    "leave_status": ticket.leave_status.value,
                    "is_consumed": ticket.is_consumed
                })

        return SelfCheckResult(
            check_name="请假课时被算进已消耗检测",
            passed=len(issues) == 0,
            details=f"检测到 {len(issues)} 条请假课时被算进已消耗，需巡演统筹复核" if issues else "无请假课时被错误计算",
            issues=issues
        )

    def check_duplicate_records(self, tickets: List[TicketRecord]) -> SelfCheckResult:
        issues = []
        duplicates = self.importer.find_duplicate_records(tickets)

        for t1, t2 in duplicates:
            issues.append({
                "ticket_id": t1.ticket_id,
                "student_name": t1.student_name,
                "repertoire": t1.repertoire,
                "duplicate_batch_1": t1.import_batch,
                "duplicate_batch_2": t2.import_batch
            })

        return SelfCheckResult(
            check_name="重复记录检测",
            passed=len(issues) == 0,
            details=f"检测到 {len(issues)} 组重复记录" if issues else "无重复记录",
            issues=issues
        )

    def check_incomplete_fields(self, tickets: List[TicketRecord]) -> SelfCheckResult:
        issues = []
        required_fields = ['ticket_id', 'student_name', 'repertoire', 'performance_date']

        for ticket in tickets:
            missing = []
            if not ticket.ticket_id:
                missing.append('票号')
            if not ticket.student_name:
                missing.append('学员姓名')
            if not ticket.repertoire:
                missing.append('曲目')
            if not ticket.performance_date:
                missing.append('演出日期')

            if missing:
                issues.append({
                    "ticket_id": ticket.ticket_id or "未知",
                    "student_name": ticket.student_name or "未知",
                    "missing_fields": missing
                })

        return SelfCheckResult(
            check_name="必填字段完整性检测",
            passed=len(issues) == 0,
            details=f"检测到 {len(issues)} 条记录缺少必填字段" if issues else "所有必填字段完整",
            issues=issues
        )

    def check_checklist_consistency(
        self,
        tickets: List[TicketRecord],
        checklists: List[RepertoireChecklist]
    ) -> SelfCheckResult:
        issues = []
        ticket_by_id = {t.ticket_id: t for t in tickets}

        for checklist in checklists:
            for item in checklist.items:
                ticket = ticket_by_id.get(item.ticket_id)
                if not ticket:
                    issues.append({
                        "checklist_id": checklist.checklist_id,
                        "ticket_id": item.ticket_id,
                        "issue": "核对表中的票号在票务数据中不存在"
                    })
                elif ticket.repertoire != item.repertoire:
                    issues.append({
                        "checklist_id": checklist.checklist_id,
                        "ticket_id": item.ticket_id,
                        "issue": "核对表曲目与票务表不一致",
                        "ticket_repertoire": ticket.repertoire,
                        "checklist_repertoire": item.repertoire
                    })

        return SelfCheckResult(
            check_name="核对表与票务表一致性检测",
            passed=len(issues) == 0,
            details=f"检测到 {len(issues)} 处不一致" if issues else "核对表与票务表一致",
            issues=issues
        )

    def check_export_consistency(
        self,
        original_tickets: List[TicketRecord],
        exported_file_path: str
    ) -> SelfCheckResult:
        issues = []

        try:
            exported_tickets, _ = self.importer.import_from_csv(exported_file_path)

            if len(original_tickets) != len(exported_tickets):
                issues.append({
                    "issue": "记录数量不一致",
                    "original_count": len(original_tickets),
                    "exported_count": len(exported_tickets)
                })

            original_by_id = {t.ticket_id: t for t in original_tickets}
            for ext in exported_tickets:
                orig = original_by_id.get(ext.ticket_id)
                if not orig:
                    issues.append({
                        "ticket_id": ext.ticket_id,
                        "issue": "导出文件中存在原始数据没有的票号"
                    })
                else:
                    if orig.repertoire != ext.repertoire:
                        issues.append({
                            "ticket_id": ext.ticket_id,
                            "issue": "曲目不一致",
                            "original": orig.repertoire,
                            "exported": ext.repertoire
                        })
                    if orig.student_name != ext.student_name:
                        issues.append({
                            "ticket_id": ext.ticket_id,
                            "issue": "学员姓名不一致",
                            "original": orig.student_name,
                            "exported": ext.student_name
                        })

        except Exception as e:
            issues.append({
                "issue": "导出文件读取失败",
                "error": str(e)
            })

        return SelfCheckResult(
            check_name="导出一致性检测",
            passed=len(issues) == 0,
            details=f"检测到 {len(issues)} 处导出不一致" if issues else "导出数据与原始数据一致",
            issues=issues
        )

    def recalculate_after_supplement(
        self,
        original_tickets: List[TicketRecord],
        supplement_tickets: List[TicketRecord]
    ) -> Tuple[List[TicketRecord], List[Dict]]:
        recalculated = []
        changes = []
        original_by_id = {t.ticket_id: t for t in original_tickets}

        for sup in supplement_tickets:
            orig = original_by_id.get(sup.ticket_id)
            if orig:
                if sup.leave_status != orig.leave_status or sup.is_consumed != orig.is_consumed:
                    changes.append({
                        "ticket_id": sup.ticket_id,
                        "student_name": sup.student_name,
                        "change_type": "状态更新",
                        "old_leave_status": orig.leave_status.value,
                        "new_leave_status": sup.leave_status.value,
                        "old_is_consumed": orig.is_consumed,
                        "new_is_consumed": sup.is_consumed
                    })
                recalculated.append(sup)
            else:
                changes.append({
                    "ticket_id": sup.ticket_id,
                    "student_name": sup.student_name,
                    "change_type": "新增记录"
                })
                recalculated.append(sup)

        for orig in original_tickets:
            if orig.ticket_id not in original_by_id:
                continue
            if orig.ticket_id not in {t.ticket_id for t in supplement_tickets}:
                recalculated.append(orig)

        return recalculated, changes
