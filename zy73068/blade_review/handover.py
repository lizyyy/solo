from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from .audit import AuditTrail
from .models import BladeReport, ReviewStatus


@dataclass
class AnomalySummary:
    blade_id: str = ""
    metric_name: str = ""
    detail: str = ""


@dataclass
class HandoverInfo:
    report_id: str = ""
    status: str = ""
    sample_location: str = ""
    anomalies: list[AnomalySummary] = field(default_factory=list)
    export_method: str = ""
    pending_suspensions: int = 0
    recent_judgment_changes: int = 0


class HandoverSummary:
    def __init__(self, audit_trail: AuditTrail) -> None:
        self.audit = audit_trail

    def generate(self, report: BladeReport) -> str:
        anomalies = self._collect_anomalies(report)
        suspensions = [s for s in report.suspensions if not s.resolved]
        recent_changes = self.audit.get_judgment_diff(report.report_id)

        info = HandoverInfo(
            report_id=report.report_id,
            status=report.status.value,
            sample_location=self._locate_samples(report),
            anomalies=anomalies,
            export_method="report.export_json()",
            pending_suspensions=len(suspensions),
            recent_judgment_changes=len(recent_changes),
        )
        return self._format(info)

    def _collect_anomalies(self, report: BladeReport) -> list[AnomalySummary]:
        anomalies: list[AnomalySummary] = []
        for mat in report.materials:
            if mat.stance_changed:
                anomalies.append(
                    AnomalySummary(
                        detail=f"material_stance_changed: {mat.current_name} (v{mat.version})",
                    )
                )
            if mat.name_changed:
                anomalies.append(
                    AnomalySummary(
                        detail=f"material_renamed: {mat.original_name} -> {mat.current_name}",
                    )
                )
        for susp in report.suspensions:
            if not susp.resolved:
                anomalies.append(
                    AnomalySummary(detail=f"suspended: {susp.reason}")
                )
        return anomalies

    def _locate_samples(self, report: BladeReport) -> str:
        blade_ids = ",".join(report.blade_ids) if report.blade_ids else "none"
        return f"blade_ids=[{blade_ids}]"

    def _format(self, info: HandoverInfo) -> str:
        lines = [
            f"== 交接班摘要 ==",
            f"报告: {info.report_id}",
            f"状态: {info.status}",
            f"样例位置: {info.sample_location}",
            f"导出方式: {info.export_method}",
        ]
        if info.anomalies:
            lines.append("异常:")
            for a in info.anomalies:
                lines.append(f"  - {a.detail}")
        else:
            lines.append("异常: 无")
        if info.pending_suspensions > 0:
            lines.append(f"待处理挂起: {info.pending_suspensions}")
        if info.recent_judgment_changes > 0:
            lines.append(f"近期改判: {info.recent_judgment_changes}条")
        return "\n".join(lines)
