import pandas as pd
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import Ticket, SLARule, PauseRecord, EscalationRecord, ApprovalRecord, SLATimeline


class ReportExporter:
    EXPORT_COLUMNS = [
        {"field": "ticket_no", "display_name": "工单编号", "description": "系统生成的唯一工单号"},
        {"field": "title", "display_name": "工单标题", "description": "工单的简要描述"},
        {"field": "priority", "display_name": "优先级", "description": "工单处理优先级"},
        {"field": "status", "display_name": "工单状态", "description": "当前工单处理状态"},
        {"field": "assignee", "display_name": "处理人", "description": "负责处理该工单的人员"},
        {"field": "creator", "display_name": "创建人", "description": "提交工单的人员"},
        {"field": "sla_rule_name", "display_name": "SLA规则", "description": "应用的SLA服务等级协议"},
        {"field": "current_sla_status", "display_name": "SLA状态", "description": "SLA时钟当前状态"},
        {"field": "total_used_hours", "display_name": "已用工时(小时)", "description": "工单已消耗的有效工时"},
        {"field": "remaining_hours", "display_name": "剩余工时(小时)", "description": "SLA剩余可用工时"},
        {"field": "sla_deadline", "display_name": "SLA截止时间", "description": "SLA要求的最晚完成时间"},
        {"field": "total_pause_hours", "display_name": "暂停总时长(小时)", "description": "SLA暂停累计时长"},
        {"field": "pause_count", "display_name": "暂停次数", "description": "SLA暂停总次数"},
        {"field": "escalation_count", "display_name": "升级次数", "description": "工单升级次数"},
        {"field": "approval_count", "display_name": "审批次数", "description": "相关审批流程次数"},
        {"field": "created_at", "display_name": "创建时间", "description": "工单创建时间"},
        {"field": "resolved_at", "display_name": "解决时间", "description": "工单标记解决的时间"},
        {"field": "closed_at", "display_name": "关闭时间", "description": "工单最终关闭时间"},
        {"field": "resolution_days", "display_name": "解决用时(天)", "description": "从创建到解决的天数"},
        {"field": "sla_result", "display_name": "SLA结果", "description": "是否在SLA内完成"},
    ]

    TIMELINE_COLUMNS = [
        {"field": "happened_at", "display_name": "时间", "description": "事件发生时间"},
        {"field": "event_type", "display_name": "事件类型", "description": "事件的分类"},
        {"field": "event_title", "display_name": "事件标题", "description": "事件的简要描述"},
        {"field": "event_detail", "display_name": "事件详情", "description": "事件的详细信息"},
        {"field": "operator", "display_name": "操作人", "description": "执行该操作的人员"},
        {"field": "sla_impact_hours", "display_name": "对SLA影响(小时)", "description": "该事件对剩余工时的影响"},
        {"field": "remaining_before", "display_name": "操作前剩余工时", "description": "事件发生前的SLA剩余工时"},
        {"field": "remaining_after", "display_name": "操作后剩余工时", "description": "事件发生后的SLA剩余工时"},
    ]

    PAUSE_RECORD_COLUMNS = [
        {"field": "pause_reason_name", "display_name": "暂停原因", "description": "SLA暂停的原因"},
        {"field": "paused_by", "display_name": "暂停操作人", "description": "执行暂停操作的人员"},
        {"field": "paused_at", "display_name": "暂停时间", "description": "SLA暂停开始时间"},
        {"field": "resumed_at", "display_name": "恢复时间", "description": "SLA恢复计时时间"},
        {"field": "pause_duration_hours", "display_name": "暂停时长(小时)", "description": "本次暂停累计时长"},
        {"field": "remarks", "display_name": "备注", "description": "暂停相关备注信息"},
    ]

    ESCALATION_COLUMNS = [
        {"field": "escalation_type", "display_name": "升级类型", "description": "工单升级的类型"},
        {"field": "escalation_level", "display_name": "升级级别", "description": "当前升级级别"},
        {"field": "escalated_by", "display_name": "升级操作人", "description": "执行升级操作的人员"},
        {"field": "escalated_to", "display_name": "升级至", "description": "升级后的处理人或团队"},
        {"field": "escalated_at", "display_name": "升级时间", "description": "执行升级操作的时间"},
        {"field": "reason", "display_name": "升级原因", "description": "工单升级的原因说明"},
        {"field": "status", "display_name": "处理状态", "description": "升级请求的处理状态"},
        {"field": "handled_at", "display_name": "处理时间", "description": "升级请求被处理的时间"},
    ]

    APPROVAL_COLUMNS = [
        {"field": "approval_type", "display_name": "审批类型", "description": "审批流程的类型"},
        {"field": "applicant", "display_name": "申请人", "description": "提交审批申请的人员"},
        {"field": "approver", "display_name": "审批人", "description": "负责审批的人员"},
        {"field": "status", "display_name": "审批状态", "description": "当前审批状态"},
        {"field": "requested_at", "display_name": "申请时间", "description": "提交审批申请的时间"},
        {"field": "approved_at", "display_name": "审批通过时间", "description": "审批被通过的时间"},
        {"field": "reason", "display_name": "申请原因", "description": "提交审批的原因说明"},
        {"field": "approval_remarks", "display_name": "审批意见", "description": "审批人给出的意见"},
    ]

    def __init__(self, db: Session):
        self.db = db

    def format_datetime(self, dt) -> str:
        if dt is None:
            return ""
        if isinstance(dt, str):
            return dt
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    def calculate_resolution_days(self, created_at, resolved_at) -> float:
        if not created_at or not resolved_at:
            return 0.0
        delta = resolved_at - created_at
        return round(delta.total_seconds() / 86400, 2)

    def determine_sla_result(self, ticket) -> str:
        if ticket.status not in ["resolved", "closed"]:
            return "处理中"
        if ticket.remaining_hours > 0:
            return "达标"
        return "超时"

    def get_ticket_report_data(self, ticket: Ticket) -> Dict[str, Any]:
        total_pause_hours = sum(
            p.pause_duration_hours for p in ticket.pause_records if p.resumed_at
        )
        pause_count = len(ticket.pause_records)
        escalation_count = len(ticket.escalation_records)
        approval_count = len(ticket.approval_records)

        return {
            "ticket_no": ticket.ticket_no,
            "title": ticket.title,
            "priority": self._translate_priority(ticket.priority),
            "status": self._translate_status(ticket.status),
            "assignee": ticket.assignee or "未分配",
            "creator": ticket.creator,
            "sla_rule_name": ticket.sla_rule.name if ticket.sla_rule else "无规则",
            "current_sla_status": self._translate_sla_status(ticket.current_sla_status),
            "total_used_hours": ticket.total_used_hours,
            "remaining_hours": ticket.remaining_hours,
            "sla_deadline": self.format_datetime(ticket.sla_deadline),
            "total_pause_hours": round(total_pause_hours, 2),
            "pause_count": pause_count,
            "escalation_count": escalation_count,
            "approval_count": approval_count,
            "created_at": self.format_datetime(ticket.created_at),
            "resolved_at": self.format_datetime(ticket.resolved_at),
            "closed_at": self.format_datetime(ticket.closed_at),
            "resolution_days": self.calculate_resolution_days(ticket.created_at, ticket.resolved_at),
            "sla_result": self.determine_sla_result(ticket),
        }

    def _translate_priority(self, priority: str) -> str:
        mapping = {
            "low": "低",
            "normal": "普通",
            "high": "高",
            "critical": "紧急"
        }
        return mapping.get(priority, priority)

    def _translate_status(self, status: str) -> str:
        mapping = {
            "open": "新建",
            "in_progress": "处理中",
            "pending": "待确认",
            "resolved": "已解决",
            "closed": "已关闭"
        }
        return mapping.get(status, status)

    def _translate_sla_status(self, status: str) -> str:
        mapping = {
            "running": "运行中",
            "paused": "已暂停",
            "warning": "即将超时",
            "breached": "已超时",
            "completed": "已完成",
            "no_rule": "无规则"
        }
        return mapping.get(status, status)

    def get_timeline_data(self, ticket: Ticket) -> List[Dict[str, Any]]:
        timeline_data = []
        for event in ticket.sla_timeline:
            timeline_data.append({
                "happened_at": self.format_datetime(event.happened_at),
                "event_type": self._translate_event_type(event.event_type),
                "event_title": event.event_title,
                "event_detail": event.event_detail or "",
                "operator": event.operator or "系统",
                "sla_impact_hours": event.sla_impact_hours,
                "remaining_before": event.remaining_before or 0,
                "remaining_after": event.remaining_after or 0,
            })
        return sorted(timeline_data, key=lambda x: x["happened_at"], reverse=True)

    def _translate_event_type(self, event_type: str) -> str:
        mapping = {
            "create": "创建",
            "pause": "暂停",
            "resume": "恢复",
            "escalation": "升级",
            "approval": "审批",
            "compensation": "补偿",
            "sla_recalculation": "SLA重算",
            "resolve": "解决",
            "close": "关闭"
        }
        return mapping.get(event_type, event_type)

    def get_pause_records_data(self, ticket: Ticket) -> List[Dict[str, Any]]:
        records = []
        for pause in ticket.pause_records:
            records.append({
                "pause_reason_name": pause.pause_reason_name or "",
                "paused_by": pause.paused_by,
                "paused_at": self.format_datetime(pause.paused_at),
                "resumed_at": self.format_datetime(pause.resumed_at),
                "pause_duration_hours": pause.pause_duration_hours,
                "remarks": pause.remarks or "",
            })
        return records

    def get_escalation_data(self, ticket: Ticket) -> List[Dict[str, Any]]:
        records = []
        for esc in ticket.escalation_records:
            records.append({
                "escalation_type": esc.escalation_type,
                "escalation_level": esc.escalation_level,
                "escalated_by": esc.escalated_by or "",
                "escalated_to": esc.escalated_to or "",
                "escalated_at": self.format_datetime(esc.escalated_at),
                "reason": esc.reason or "",
                "status": self._translate_escalation_status(esc.status),
                "handled_at": self.format_datetime(esc.handled_at),
            })
        return records

    def _translate_escalation_status(self, status: str) -> str:
        mapping = {
            "pending": "待处理",
            "handled": "已处理",
            "rejected": "已拒绝"
        }
        return mapping.get(status, status)

    def get_approval_data(self, ticket: Ticket) -> List[Dict[str, Any]]:
        records = []
        for app in ticket.approval_records:
            records.append({
                "approval_type": app.approval_type,
                "applicant": app.applicant,
                "approver": app.approver or "",
                "status": self._translate_approval_status(app.status),
                "requested_at": self.format_datetime(app.requested_at),
                "approved_at": self.format_datetime(app.approved_at),
                "reason": app.reason or "",
                "approval_remarks": app.approval_remarks or "",
            })
        return records

    def _translate_approval_status(self, status: str) -> str:
        mapping = {
            "pending": "待审批",
            "approved": "已通过",
            "rejected": "已拒绝"
        }
        return mapping.get(status, status)

    def export_tickets_to_excel(self, tickets: List[Ticket], filepath: str) -> None:
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            ticket_data = [self.get_ticket_report_data(t) for t in tickets]
            df_tickets = pd.DataFrame(ticket_data)
            df_tickets = df_tickets[[col["field"] for col in self.EXPORT_COLUMNS]]
            df_tickets.columns = [col["display_name"] for col in self.EXPORT_COLUMNS]
            df_tickets.to_excel(writer, sheet_name="SLA汇总报表", index=False)

            for ticket in tickets:
                sheet_name = f"{ticket.ticket_no}_时间线"[:31]
                timeline_data = self.get_timeline_data(ticket)
                if timeline_data:
                    df_timeline = pd.DataFrame(timeline_data)
                    df_timeline = df_timeline[[col["field"] for col in self.TIMELINE_COLUMNS]]
                    df_timeline.columns = [col["display_name"] for col in self.TIMELINE_COLUMNS]
                    df_timeline.to_excel(writer, sheet_name=sheet_name, index=False)

            df_summary = pd.DataFrame([{
                "统计项": "总工单数",
                "数值": len(tickets)
            }, {
                "统计项": "SLA达标数",
                "数值": sum(1 for t in tickets if self.determine_sla_result(t) == "达标")
            }, {
                "统计项": "SLA超时数",
                "数值": sum(1 for t in tickets if self.determine_sla_result(t) == "超时")
            }, {
                "统计项": "处理中工单数",
                "数值": sum(1 for t in tickets if self.determine_sla_result(t) == "处理中")
            }, {
                "统计项": "平均暂停次数",
                "数值": round(sum(len(t.pause_records) for t in tickets) / len(tickets), 2) if tickets else 0
            }, {
                "统计项": "报表生成时间",
                "数值": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }])
            df_summary.to_excel(writer, sheet_name="统计概览", index=False)

    def export_single_ticket_report(self, ticket: Ticket, filepath: str) -> None:
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            ticket_data = [self.get_ticket_report_data(ticket)]
            df_ticket = pd.DataFrame(ticket_data)
            df_ticket = df_ticket[[col["field"] for col in self.EXPORT_COLUMNS]]
            df_ticket.columns = [col["display_name"] for col in self.EXPORT_COLUMNS]
            df_ticket.to_excel(writer, sheet_name="工单详情", index=False)

            timeline_data = self.get_timeline_data(ticket)
            if timeline_data:
                df_timeline = pd.DataFrame(timeline_data)
                df_timeline = df_timeline[[col["field"] for col in self.TIMELINE_COLUMNS]]
                df_timeline.columns = [col["display_name"] for col in self.TIMELINE_COLUMNS]
                df_timeline.to_excel(writer, sheet_name="时间线记录", index=False)

            pause_data = self.get_pause_records_data(ticket)
            if pause_data:
                df_pause = pd.DataFrame(pause_data)
                df_pause = df_pause[[col["field"] for col in self.PAUSE_RECORD_COLUMNS]]
                df_pause.columns = [col["display_name"] for col in self.PAUSE_RECORD_COLUMNS]
                df_pause.to_excel(writer, sheet_name="暂停记录", index=False)

            escalation_data = self.get_escalation_data(ticket)
            if escalation_data:
                df_esc = pd.DataFrame(escalation_data)
                df_esc = df_esc[[col["field"] for col in self.ESCALATION_COLUMNS]]
                df_esc.columns = [col["display_name"] for col in self.ESCALATION_COLUMNS]
                df_esc.to_excel(writer, sheet_name="升级记录", index=False)

            approval_data = self.get_approval_data(ticket)
            if approval_data:
                df_app = pd.DataFrame(approval_data)
                df_app = df_app[[col["field"] for col in self.APPROVAL_COLUMNS]]
                df_app.columns = [col["display_name"] for col in self.APPROVAL_COLUMNS]
                df_app.to_excel(writer, sheet_name="审批记录", index=False)
