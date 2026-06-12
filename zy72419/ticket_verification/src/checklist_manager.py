from typing import List, Dict, Optional
from datetime import datetime
from collections import defaultdict

from .models import (
    TicketRecord, RepertoireChecklist, ChecklistItem,
    TicketStatus, AudioRemark, normalize_status,
    are_statuses_equivalent, AuditTrail
)


class ChecklistManager:
    def __init__(self):
        self.checklists: Dict[str, RepertoireChecklist] = {}

    def create_checklist_from_tickets(
        self,
        tickets: List[TicketRecord],
        performance_date: str = ""
    ) -> RepertoireChecklist:
        if not performance_date and tickets:
            performance_date = tickets[0].performance_date

        checklist = RepertoireChecklist(
            performance_date=performance_date
        )

        for ticket in tickets:
            item = ChecklistItem(
                ticket_id=ticket.ticket_id,
                student_name=ticket.student_name,
                repertoire=ticket.repertoire
            )
            if ticket.verification_status == TicketStatus.CONFIRMED:
                item.is_checked = True
                item.checked_by = "系统自动（状态映射后核对通过）"
                item.checked_time = datetime.now()
            checklist.items.append(item)

        checklist_id = performance_date or checklist.checklist_id
        self.checklists[checklist_id] = checklist

        return checklist

    def update_checklist_from_audio_remarks(
        self,
        checklist: RepertoireChecklist,
        audio_remarks: List[AudioRemark],
        operator: str,
        audit: AuditTrail = None
    ) -> RepertoireChecklist:
        remarks_by_ticket: Dict[str, List[AudioRemark]] = defaultdict(list)
        for remark in audio_remarks:
            if remark.ticket_id:
                remarks_by_ticket[remark.ticket_id].append(remark)

        updated_count = 0
        for item in checklist.items:
            remarks = remarks_by_ticket.get(item.ticket_id, [])
            if remarks:
                raw_remarks_text = "\n".join([r.raw_remark for r in remarks])
                old_remarks = item.remarks
                if item.remarks:
                    item.remarks += "\n" + raw_remarks_text
                else:
                    item.remarks = raw_remarks_text

                for remark in remarks:
                    if remark.parsed_repertoire and remark.parsed_repertoire != item.repertoire:
                        item.remarks += f"\n[曲目差异] 票务表: {item.repertoire} | 音频解析: {remark.parsed_repertoire}"

                updated_count += 1

                if audit:
                    audit.add_entry(
                        action="音频备注补充到核对表",
                        operator=operator,
                        details=f"补充 {len(remarks)} 条音频备注到核对表",
                        before_value=old_remarks,
                        after_value=item.remarks,
                        affected_field="remarks",
                        affected_ticket_id=item.ticket_id
                    )

        checklist.updated_time = datetime.now()
        return checklist

    def mark_item_checked(
        self,
        checklist: RepertoireChecklist,
        ticket_id: str,
        operator: str,
        remarks: str = ""
    ) -> bool:
        for item in checklist.items:
            if item.ticket_id == ticket_id:
                item.is_checked = True
                item.checked_by = operator
                item.checked_time = datetime.now()
                if remarks:
                    if item.remarks:
                        item.remarks += "\n" + remarks
                    else:
                        item.remarks = remarks
                checklist.updated_time = datetime.now()
                return True
        return False

    def get_checklist_summary(self, checklist: RepertoireChecklist) -> Dict:
        total = len(checklist.items)
        checked = sum(1 for item in checklist.items if item.is_checked)
        with_remarks = sum(1 for item in checklist.items if item.remarks)

        return {
            "checklist_id": checklist.checklist_id,
            "performance_date": checklist.performance_date,
            "total_items": total,
            "checked_count": checked,
            "unchecked_count": total - checked,
            "checked_percentage": (checked / total * 100) if total > 0 else 0,
            "with_remarks_count": with_remarks,
            "created_time": checklist.created_time.isoformat(),
            "updated_time": checklist.updated_time.isoformat()
        }

    def validate_checklist_against_history(
        self,
        checklist: RepertoireChecklist,
        historical_tickets: List[TicketRecord]
    ) -> List[Dict]:
        issues = []
        historical_by_id = {t.ticket_id: t for t in historical_tickets}

        for item in checklist.items:
            hist_ticket = historical_by_id.get(item.ticket_id)
            if hist_ticket:
                if hist_ticket.repertoire != item.repertoire:
                    issues.append({
                        "ticket_id": item.ticket_id,
                        "type": "历史曲目不符",
                        "current_repertoire": item.repertoire,
                        "historical_repertoire": hist_ticket.repertoire,
                        "student_name": item.student_name
                    })

                hist_conflicts = [c for c in hist_ticket.conflicts if not c.resolved]
                if hist_conflicts:
                    issues.append({
                        "ticket_id": item.ticket_id,
                        "type": "历史未解决冲突",
                        "conflict_count": len(hist_conflicts),
                        "conflicts": [c.description for c in hist_conflicts]
                    })

        return issues

    def export_checklist(self, checklist: RepertoireChecklist, file_path: str):
        import csv
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '票号', '学员姓名', '曲目', '是否核对', '核对人',
                '核对时间', '备注'
            ])
            for item in checklist.items:
                writer.writerow([
                    item.ticket_id,
                    item.student_name,
                    item.repertoire,
                    '是' if item.is_checked else '否',
                    item.checked_by,
                    item.checked_time.isoformat() if item.checked_time else '',
                    item.remarks
                ])
