from datetime import datetime
from typing import Dict, Any, List
import json
from sla_models import SLAReport, SLAStatus, PauseType, TimeSegment


class ReportExporter:
    def __init__(self):
        self.segment_type_labels = {
            "working": "⏱️ 工作时间",
            "holiday": "🎊 节假日",
            "weekend": "🌴 周末",
            "paused": "⏸️ 暂停",
            "customer_pending": "👤 等待客户",
            "other": "➖ 其他扣除"
        }

        self.status_icons = {
            SLAStatus.PENDING: "📋",
            SLAStatus.RUNNING: "🔄",
            SLAStatus.PAUSED: "⏸️",
            SLAStatus.WAITING_CUSTOMER: "👤",
            SLAStatus.COMPLETED: "✅",
            SLAStatus.BREACHED: "🚨",
        }

    def _format_duration(self, seconds: float) -> str:
        if seconds < 60:
            return f"{seconds:.1f}秒"
        elif seconds < 3600:
            return f"{seconds / 60:.1f}分钟"
        elif seconds < 86400:
            return f"{seconds / 3600:.1f}小时"
        else:
            return f"{seconds / 86400:.1f}天"

    def _format_datetime(self, dt: datetime) -> str:
        if dt.tzinfo:
            dt = dt.astimezone()
        return dt.strftime("%Y-%m-%d %H:%M:%S")

    def to_markdown(self, report: SLAReport) -> str:
        lines = []

        lines.append(f"# SLA 巡检报告 - {report.ticket_title}")
        lines.append("")
        lines.append(f"**生成时间**: {self._format_datetime(report.generated_at)}")
        lines.append(f"**工单ID**: {report.ticket_id}")
        lines.append(f"**SLA规则**: {report.sla_rule_name}")
        status_icon = self.status_icons.get(report.current_status, "❓")
        lines.append(f"**当前状态**: {status_icon} {report.current_status.value}")

        if report.is_breached:
            lines.append("")
            lines.append("## 🚨 SLA 违规警告")
            for breach in report.breaches:
                lines.append("")
                lines.append(f"### 违规类型: {breach.breach_type}")
                lines.append(f"- **阈值**: {self._format_duration(breach.threshold_seconds)}")
                lines.append(f"- **实际用时**: {self._format_duration(breach.actual_seconds)}")
                lines.append(f"- **超出时间**: {self._format_duration(breach.exceeded_seconds)}")
                lines.append(f"- **发生时间**: {self._format_datetime(breach.breach_time)}")
                lines.append(f"- **详细说明**: {breach.explanation}")
                if breach.contributing_factors:
                    lines.append("- **影响因素**:")
                    for factor in breach.contributing_factors:
                        lines.append(f"  - {factor}")

        lines.append("")
        lines.append("## 📊 时间统计摘要")
        lines.append("")
        td = report.time_details
        lines.append("| 项目 | 时长 | 占比 |")
        lines.append("|------|------|------|")
        lines.append(f"| 总耗时 | {self._format_duration(td.total_seconds)} | 100% |")
        lines.append(f"| ✅ 有效工作时间 | **{self._format_duration(td.effective_elapsed_seconds)}** | "
                     f"{td.effective_elapsed_seconds / td.total_seconds * 100:.1f}% |")
        lines.append(f"| ⏸️ 手动暂停 | {self._format_duration(td.paused_seconds)} | "
                     f"{td.paused_seconds / td.total_seconds * 100:.1f}% |")
        lines.append(f"| 🎊 节假日 | {self._format_duration(td.holiday_seconds)} | "
                     f"{td.holiday_seconds / td.total_seconds * 100:.1f}% |")
        lines.append(f"| 🌴 周末 | {self._format_duration(td.weekend_seconds)} | "
                     f"{td.weekend_seconds / td.total_seconds * 100:.1f}% |")
        lines.append(f"| 👤 等待客户 | {self._format_duration(td.customer_pending_seconds)} | "
                     f"{td.customer_pending_seconds / td.total_seconds * 100:.1f}% |")

        if td.remaining_seconds > 0:
            lines.append(f"| ⏳ 剩余时间 | **{self._format_duration(td.remaining_seconds)}** | - |")

        lines.append("")
        lines.append("## 📝 巡检摘要")
        lines.append("")
        lines.append("```")
        lines.append(report.summary)
        lines.append("```")

        if report.time_segments:
            lines.append("")
            lines.append("## 📈 时间分段明细")
            lines.append("")
            lines.append("| 类型 | 开始时间 | 结束时间 | 持续时间 | 说明 |")
            lines.append("|------|----------|----------|----------|------|")
            for seg in report.time_segments:
                label = self.segment_type_labels.get(seg.segment_type, seg.segment_type)
                lines.append(
                    f"| {label} | {self._format_datetime(seg.start_time)} | "
                    f"{self._format_datetime(seg.end_time)} | "
                    f"{self._format_duration(seg.duration_seconds)} | {seg.description} |"
                )

        if report.pause_history:
            lines.append("")
            lines.append("## ⏸️ 暂停记录")
            lines.append("")
            lines.append("| 类型 | 开始时间 | 结束时间 | 持续时间 | 原因 | 操作人 |")
            lines.append("|------|----------|----------|----------|------|--------|")
            for pause in report.pause_history:
                duration = ""
                if pause.end_time:
                    duration = self._format_duration((pause.end_time - pause.start_time).total_seconds())
                end_time = self._format_datetime(pause.end_time) if pause.end_time else "进行中"
                lines.append(
                    f"| {pause.pause_type.value} | {self._format_datetime(pause.start_time)} | "
                    f"{end_time} | {duration} | {pause.reason} | {pause.operator or '-'} |"
                )

        if report.customer_replies:
            lines.append("")
            lines.append("## 💬 客户回复记录")
            lines.append("")
            lines.append("| 回复时间 | 内容 | 需要跟进 |")
            lines.append("|----------|------|----------|")
            for reply in report.customer_replies:
                content = reply.content[:50] + "..." if len(reply.content) > 50 else reply.content
                requires = "是" if reply.requires_followup else "否"
                lines.append(
                    f"| {self._format_datetime(reply.reply_time)} | {content} | {requires} |"
                )

        lines.append("")
        lines.append("---")
        lines.append(f"*本报告由SLA时钟系统自动生成于 {self._format_datetime(report.generated_at)}*")

        return "\n".join(lines)

    def to_json(self, report: SLAReport, indent: int = 2) -> str:
        report_dict = self._report_to_dict(report)
        return json.dumps(report_dict, indent=indent, ensure_ascii=False, default=str)

    def _report_to_dict(self, report: SLAReport) -> Dict[str, Any]:
        return {
            "ticket_id": report.ticket_id,
            "ticket_title": report.ticket_title,
            "sla_rule_name": report.sla_rule_name,
            "current_status": report.current_status.value,
            "is_breached": report.is_breached,
            "summary": report.summary,
            "generated_at": report.generated_at.isoformat(),
            "time_details": {
                "total_seconds": report.time_details.total_seconds,
                "working_seconds": report.time_details.working_seconds,
                "paused_seconds": report.time_details.paused_seconds,
                "holiday_seconds": report.time_details.holiday_seconds,
                "weekend_seconds": report.time_details.weekend_seconds,
                "customer_pending_seconds": report.time_details.customer_pending_seconds,
                "remaining_seconds": report.time_details.remaining_seconds,
                "effective_elapsed_seconds": report.time_details.effective_elapsed_seconds,
                "total_formatted": self._format_duration(report.time_details.total_seconds),
                "effective_formatted": self._format_duration(report.time_details.effective_elapsed_seconds),
                "remaining_formatted": self._format_duration(report.time_details.remaining_seconds),
            },
            "breaches": [
                {
                    "breach_type": b.breach_type,
                    "threshold_seconds": b.threshold_seconds,
                    "actual_seconds": b.actual_seconds,
                    "exceeded_seconds": b.exceeded_seconds,
                    "breach_time": b.breach_time.isoformat(),
                    "explanation": b.explanation,
                    "contributing_factors": b.contributing_factors,
                    "threshold_formatted": self._format_duration(b.threshold_seconds),
                    "actual_formatted": self._format_duration(b.actual_seconds),
                    "exceeded_formatted": self._format_duration(b.exceeded_seconds),
                }
                for b in report.breaches
            ],
            "time_segments": [
                {
                    "segment_type": s.segment_type,
                    "start_time": s.start_time.isoformat(),
                    "end_time": s.end_time.isoformat(),
                    "duration_seconds": s.duration_seconds,
                    "description": s.description,
                    "duration_formatted": self._format_duration(s.duration_seconds),
                }
                for s in report.time_segments
            ],
            "pause_history": [
                {
                    "id": p.id,
                    "pause_type": p.pause_type.value,
                    "start_time": p.start_time.isoformat(),
                    "end_time": p.end_time.isoformat() if p.end_time else None,
                    "reason": p.reason,
                    "operator": p.operator,
                    "is_active": p.is_active,
                    "duration_seconds": (p.end_time - p.start_time).total_seconds() if p.end_time else None,
                    "duration_formatted": self._format_duration((p.end_time - p.start_time).total_seconds()) if p.end_time else None,
                }
                for p in report.pause_history
            ],
            "customer_replies": [
                {
                    "id": r.id,
                    "reply_time": r.reply_time.isoformat(),
                    "content": r.content,
                    "requires_followup": r.requires_followup,
                    "auto_resume_sla": r.auto_resume_sla,
                }
                for r in report.customer_replies
            ],
        }

    def export_human_readable_summary(self, report: SLAReport) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("                    SLA 巡检摘要")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"工单: {report.ticket_title}")
        lines.append(f"ID: {report.ticket_id}")
        status_icon = self.status_icons.get(report.current_status, "❓")
        lines.append(f"状态: {status_icon} {report.current_status.value}")
        lines.append(f"规则: {report.sla_rule_name}")
        lines.append("")
        lines.append("-" * 60)
        lines.append(report.summary)
        lines.append("-" * 60)

        if report.is_breached:
            lines.append("")
            lines.append("🚨 违规项:")
            for i, breach in enumerate(report.breaches, 1):
                lines.append(f"  {i}. {breach.explanation}")
                for factor in breach.contributing_factors:
                    lines.append(f"     - {factor}")

        lines.append("")
        lines.append(f"生成时间: {self._format_datetime(report.generated_at)}")
        lines.append("=" * 60)

        return "\n".join(lines)

    def export_structured_data(self, report: SLAReport) -> Dict[str, Any]:
        return self._report_to_dict(report)
