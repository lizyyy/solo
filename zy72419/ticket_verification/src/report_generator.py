from typing import List, Dict
from pathlib import Path
from datetime import datetime
import json

from .models import (
    VerificationReport, TicketRecord, Conflict,
    RepertoireChecklist, SelfCheckResult, ConflictType,
    TicketStatus, LeaveStatus
)


class ReportGenerator:
    def generate_report(
        self,
        tickets: List[TicketRecord],
        conflicts: List[Conflict],
        checklists: List[RepertoireChecklist],
        self_check_results: List[SelfCheckResult]
    ) -> VerificationReport:
        total = len(tickets)
        confirmed = sum(1 for t in tickets if t.verification_status == TicketStatus.CONFIRMED)
        rejected = sum(1 for t in tickets if t.verification_status == TicketStatus.REJECTED)
        conflict_count = sum(1 for t in tickets if t.verification_status == TicketStatus.CONFLICT)
        need_review = sum(1 for t in tickets if t.verification_status == TicketStatus.NEED_REVIEW)
        leave_counted = sum(
            1 for t in tickets
            if t.leave_status == LeaveStatus.LEAVE and t.is_consumed
        )

        checklist_summary = {}
        for cl in checklists:
            from .checklist_manager import ChecklistManager
            mgr = ChecklistManager()
            checklist_summary[cl.checklist_id] = mgr.get_checklist_summary(cl)

        report = VerificationReport(
            total_tickets=total,
            confirmed_count=confirmed,
            rejected_count=rejected,
            conflict_count=conflict_count,
            need_review_count=need_review,
            leave_counted_count=leave_counted,
            conflicts=conflicts,
            checklist_summary=checklist_summary,
            self_check_results=self_check_results
        )
        report._tickets = tickets
        return report

    def export_report_text(self, report: VerificationReport, output_path: str):
        lines = []
        lines.append("=" * 60)
        lines.append("演出票务赠票核销报告")
        lines.append(f"生成时间: {report.generated_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"报告编号: {report.report_id}")
        lines.append("=" * 60)
        lines.append("")

        lines.append("一、总体统计")
        lines.append("-" * 40)
        lines.append(f"总票数: {report.total_tickets}")
        lines.append(f"已确认: {report.confirmed_count}")
        lines.append(f"已驳回: {report.rejected_count}")
        lines.append(f"存在冲突: {report.conflict_count}")
        lines.append(f"待巡演统筹复核: {report.need_review_count}")
        lines.append(f"请假课时被算进已消耗: {report.leave_counted_count}")
        lines.append("")

        lines.append("二、冲突详情")
        lines.append("-" * 40)
        tickets = getattr(report, '_tickets', [])
        ticket_by_id = {t.ticket_id: t for t in tickets}
        conflicts_by_ticket: Dict[str, List[Conflict]] = {}
        for c in report.conflicts:
            if c.ticket_id not in conflicts_by_ticket:
                conflicts_by_ticket[c.ticket_id] = []
            conflicts_by_ticket[c.ticket_id].append(c)

        total_conflict_tickets = len(conflicts_by_ticket)
        lines.append(f"冲突总数: {len(report.conflicts)} 条，涉及 {total_conflict_tickets} 张票")
        lines.append("")

        if report.conflicts and total_conflict_tickets > 0:
            for idx, tid in enumerate(sorted(conflicts_by_ticket.keys()), 1):
                t_conflicts = conflicts_by_ticket[tid]
                ticket = ticket_by_id.get(tid)
                lines.append(f"【票 {idx}】票号: {tid}"
                             + (f" | 学员: {ticket.student_name}" if ticket else ""))
                if ticket:
                    lines.append(f"  映射后状态: 票务原始={ticket.status} → 映射={ticket.normalized_status}")
                    lines.append(f"  当前核验状态: {ticket.verification_status.value}")
                for j, c in enumerate(t_conflicts, 1):
                    lines.append(f"  冲突 {j}: {c.description}")
                    lines.append(f"    类型: {c.conflict_type.value}")
                    lines.append(f"    字段: {c.field_name}")
                    lines.append(f"    票务表值: {c.ticket_value}")
                    lines.append(f"    音频备注值: {c.audio_value}")
                    if c.normalized_ticket_status or c.normalized_audio_status:
                        lines.append(f"    映射值对比: 票务={c.normalized_ticket_status} vs 音频={c.normalized_audio_status}")
                    lines.append(f"    当前判断: {c.current_verdict}")
                    lines.append(f"    负责人可处理状态: {c.handler_status}")
                    lines.append(f"    冲突状态: {'已解决' if c.resolved else '未解决'}")
                    if c.resolution:
                        lines.append(f"    处理结论: {c.resolution} (by {c.resolved_by})")
                    if c.evidence:
                        lines.append(f"    证据:")
                        for k, v in c.evidence.items():
                            v_str = str(v)
                            if len(v_str) > 160:
                                v_str = v_str[:160] + "..."
                            lines.append(f"      - {k}: {v_str}")
                if ticket and ticket.history:
                    lines.append(f"  历史记录:")
                    for h in ticket.history:
                        h_line = f"    [{h.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {h.action} by {h.operator}"
                        if h.affected_field:
                            h_line += f" | {h.affected_field}: {h.before_value} → {h.after_value}"
                        if h.details:
                            h_line += f" | {h.details}"
                        lines.append(h_line)
                lines.append("")
        else:
            lines.append("无冲突")
            lines.append("")

        lines.append("三、自检结果")
        lines.append("-" * 40)
        for result in report.self_check_results:
            status = "通过" if result.passed else "未通过"
            lines.append(f"[{status}] {result.check_name}: {result.details}")
            if result.issues:
                for issue in result.issues:
                    lines.append(f"  - {json.dumps(issue, ensure_ascii=False)}")
        lines.append("")

        lines.append("四、曲目核对表摘要")
        lines.append("-" * 40)
        for cl_id, summary in report.checklist_summary.items():
            lines.append(f"核对表 {summary.get('performance_date', cl_id)}:")
            lines.append(f"  总项数: {summary.get('total_items', 0)}")
            lines.append(f"  已核对: {summary.get('checked_count', 0)} ({summary.get('checked_percentage', 0):.1f}%)")
            lines.append(f"  含备注: {summary.get('with_remarks_count', 0)}")
            lines.append("")

        lines.append("五、状态映射结果")
        lines.append("-" * 40)
        if report.status_mapping_log:
            for entry in report.status_mapping_log:
                lines.append(f"  票号{entry.get('ticket_id', '')} | "
                             f"原始={entry.get('raw_status', '')} → "
                             f"映射={entry.get('normalized_status', '')} | "
                             f"核验={entry.get('verification_status', '')}")
        else:
            lines.append("  无映射记录")
        lines.append("")

        lines.append("六、变更溯源")
        lines.append("-" * 40)
        if report.audit_entries:
            for entry in report.audit_entries[:20]:
                lines.append(f"  [{entry.get('timestamp', '')[:19]}] "
                             f"{entry.get('action', '')} | "
                             f"操作人={entry.get('operator', '')} | "
                             f"票号={entry.get('affected_ticket_id', '')} | "
                             f"字段={entry.get('affected_field', '')} | "
                             f"改前={entry.get('before', '')} → 改后={entry.get('after', '')}")
            if len(report.audit_entries) > 20:
                lines.append(f"  ... 还有 {len(report.audit_entries) - 20} 条变更记录")
        else:
            lines.append("  无变更记录")
        lines.append("")

        lines.append("=" * 60)
        lines.append("报告结束")
        lines.append("=" * 60)

        Path(output_path).write_text("\n".join(lines), encoding='utf-8')

    def export_report_json(self, report: VerificationReport, output_path: str):
        data = {
            "report_id": report.report_id,
            "generated_time": report.generated_time.isoformat(),
            "statistics": {
                "total_tickets": report.total_tickets,
                "confirmed_count": report.confirmed_count,
                "rejected_count": report.rejected_count,
                "conflict_count": report.conflict_count,
                "need_review_count": report.need_review_count,
                "leave_counted_count": report.leave_counted_count
            },
            "conflicts": [
                {
                    "conflict_id": c.conflict_id,
                    "conflict_type": c.conflict_type.value,
                    "ticket_id": c.ticket_id,
                    "field_name": c.field_name,
                    "ticket_value": c.ticket_value,
                    "audio_value": c.audio_value,
                    "description": c.description,
                    "evidence": c.evidence,
                    "resolved": c.resolved,
                    "resolution": c.resolution,
                    "resolved_by": c.resolved_by,
                    "resolved_time": c.resolved_time.isoformat() if c.resolved_time else None
                }
                for c in report.conflicts
            ],
            "checklist_summary": report.checklist_summary,
            "self_check_results": [
                {
                    "check_name": r.check_name,
                    "passed": r.passed,
                    "details": r.details,
                    "issues": r.issues
                }
                for r in report.self_check_results
            ],
            "status_mapping_log": report.status_mapping_log,
            "audit_entries": report.audit_entries
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
