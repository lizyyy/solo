from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .anomaly import AnomalyDetector
from .audit import AuditTrail
from .exporter import ReportExporter
from .models import BladeReport


@dataclass
class AnomalySummary:
    blade_id: str = ""
    metric_name: str = ""
    detail: str = ""


@dataclass
class HandoverInfo:
    report_id: str = ""
    status: str = ""
    conclusion: str = ""
    sample_location: str = ""
    anomalies: list[AnomalySummary] = field(default_factory=list)
    export_command: str = ""
    pending_suspensions: int = 0
    recent_judgment_changes: int = 0


class HandoverSummary:
    def __init__(
        self,
        audit_trail: Optional[AuditTrail] = None,
        anomaly_detector: Optional[AnomalyDetector] = None,
        exporter: Optional[ReportExporter] = None,
        gap_hours: float = 24.0,
    ) -> None:
        self.audit = audit_trail or AuditTrail()
        self.anomaly = anomaly_detector or AnomalyDetector()
        self.exporter = exporter or ReportExporter(
            anomaly_detector=self.anomaly,
            audit_trail=self.audit,
            gap_hours=gap_hours,
        )
        self.gap_hours = gap_hours

    def generate(self, report: BladeReport, export_command: str = "blade-review export --report <ID>") -> str:
        info = self.build_info(report, export_command=export_command)
        return self._format(info)

    def build_info(
        self, report: BladeReport, export_command: str
    ) -> HandoverInfo:
        anomaly_report = self.anomaly.detect(report, gap_hours=self.gap_hours)
        anomalies: list[AnomalySummary] = []
        for a in anomaly_report.anomalies:
            anomalies.append(
                AnomalySummary(
                    blade_id=a.blade_id,
                    metric_name=a.metric_name,
                    detail=f"[{a.severity}] {a.kind} | {a.explanation}",
                )
            )
        for mat in report.materials:
            if mat.stance_changed:
                anomalies.append(
                    AnomalySummary(
                        detail=(
                            f"[major] material_stance_changed | {mat.current_name} "
                            f"(v{mat.version}): '{mat.previous_stance}' -> '{mat.content}'"
                        ),
                    )
                )
            if mat.name_changed:
                anomalies.append(
                    AnomalySummary(
                        detail=(
                            f"[minor] material_renamed | "
                            f"'{mat.original_name}' -> '{mat.current_name}'"
                        ),
                    )
                )
        for susp in report.suspensions:
            if not susp.resolved:
                anomalies.append(
                    AnomalySummary(
                        detail=f"[critical] suspended | {susp.reason}，待现场老师确认后再形成稳定结论"
                    )
                )

        suspensions = [s for s in report.suspensions if not s.resolved]
        recent_changes = self.audit.get_judgment_diff(report.report_id)

        sample_location = (
            f"blade_ids={report.blade_ids} | "
            f"records={len(report.records)} | materials={len(report.materials)}"
        )

        return HandoverInfo(
            report_id=report.report_id,
            status=report.status.value,
            conclusion=anomaly_report.conclusion,
            sample_location=sample_location,
            anomalies=anomalies,
            export_command=export_command,
            pending_suspensions=len(suspensions),
            recent_judgment_changes=len(recent_changes),
        )

    def _format(self, info: HandoverInfo) -> str:
        lines = [
            "== 交接班摘要 ==",
            f"报告: {info.report_id}",
            f"状态: {info.status}",
            f"复核结论: {info.conclusion}",
            f"样例位置: {info.sample_location}",
            f"导出方式: {info.export_command}",
        ]
        if info.anomalies:
            lines.append("异常点 / 口径变更 / 挂起:")
            for a in info.anomalies:
                lines.append(f"  - {a.detail}")
        else:
            lines.append("异常点 / 口径变更 / 挂起: 无")
        if info.pending_suspensions > 0:
            lines.append(f"待处理挂起: {info.pending_suspensions}（需现场老师确认）")
        if info.recent_judgment_changes > 0:
            lines.append(f"近期改判: {info.recent_judgment_changes}条，见导出文件的改判前后差异")
        return "\n".join(lines)

    def export_handover(
        self, report: BladeReport, out_path: str
    ) -> str:
        return self.exporter.export_json(report, out_path=out_path, audit_trail=self.audit)
