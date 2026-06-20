from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any, Optional

from .anomaly import Anomaly, AnomalyDetector, AnomalyReport
from .audit import AuditTrail
from .gap_detector import GapDetector
from .models import BladeReport, JudgmentChange, ReviewStatus


@dataclass
class ExportPayload:
    report_id: str = ""
    title: str = ""
    status: str = ""
    operator: str = ""
    sample_location: dict[str, Any] = field(default_factory=dict)
    conclusion: str = ""
    is_stable: bool = True
    anomalies: list[dict[str, Any]] = field(default_factory=list)
    suspensions: list[dict[str, Any]] = field(default_factory=list)
    manual_notes: list[dict[str, Any]] = field(default_factory=list)
    judgment_changes: list[dict[str, Any]] = field(default_factory=list)
    materials: list[dict[str, Any]] = field(default_factory=list)
    generated_at: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ReportExporter:
    def __init__(
        self,
        anomaly_detector: Optional[AnomalyDetector] = None,
        audit_trail: Optional[AuditTrail] = None,
        gap_hours: float = 24.0,
    ) -> None:
        self.anomaly = anomaly_detector or AnomalyDetector()
        self.audit = audit_trail or AuditTrail()
        self.gap_hours = gap_hours

    def build_payload(
        self,
        report: BladeReport,
        audit_trail: Optional[AuditTrail] = None,
    ) -> ExportPayload:
        audit = audit_trail or self.audit
        anomaly_report = self.anomaly.detect(report, gap_hours=self.gap_hours)

        payload = ExportPayload(
            report_id=report.report_id,
            title=report.title,
            status=report.status.value,
            operator=report.operator,
            sample_location=self._locate_samples(report),
            conclusion=anomaly_report.conclusion,
            is_stable=anomaly_report.is_stable,
            anomalies=[self._anomaly_to_dict(a) for a in anomaly_report.anomalies],
            suspensions=self._collect_suspensions(report),
            manual_notes=self._collect_manual_notes(report),
            judgment_changes=self._collect_judgment_changes(report, audit),
            materials=self._collect_materials(report),
            generated_at=datetime.now().isoformat(),
        )
        return payload

    def export_json(
        self,
        report: BladeReport,
        out_path: Optional[str] = None,
        audit_trail: Optional[AuditTrail] = None,
    ) -> str:
        payload = self.build_payload(report, audit_trail=audit_trail)
        text = json.dumps(payload.to_dict(), ensure_ascii=False, indent=2)
        if out_path:
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(text)
        return text

    def export_text(
        self,
        report: BladeReport,
        audit_trail: Optional[AuditTrail] = None,
    ) -> str:
        payload = self.build_payload(report, audit_trail=audit_trail)
        lines: list[str] = []
        lines.append("== 风机叶片报告复核导出 ==")
        lines.append(f"报告ID: {payload.report_id}")
        lines.append(f"标题: {payload.title}")
        lines.append(f"状态: {payload.status}")
        lines.append(f"操作人: {payload.operator}")
        blades = payload.sample_location.get("blade_ids", [])
        lines.append(f"样例位置: blade_ids={blades}")
        lines.append(f"复核结论: {payload.conclusion}")
        lines.append(f"是否稳定: {'是' if payload.is_stable else '否（待现场确认）'}")

        lines.append("异常点:")
        if payload.anomalies:
            for a in payload.anomalies:
                lines.append(
                    f"  - [{a['severity']}] {a['kind']} | blade={a['blade_id']} "
                    f"metric={a['metric_name']} | {a['explanation']}"
                )
        else:
            lines.append("  无")

        lines.append("挂起项:")
        if payload.suspensions:
            for s in payload.suspensions:
                state = "已解决" if s["resolved"] else "待确认"
                lines.append(
                    f"  - {s['suspension_id']} [{state}] {s['reason']}"
                    + (f" | 备注: {s['resolution_note']}" if s["resolved"] else "")
                )
        else:
            lines.append("  无")

        lines.append("人工备注:")
        if payload.manual_notes:
            for n in payload.manual_notes:
                lines.append(
                    f"  - blade={n['blade_id']} metric={n['metric_name']} "
                    f"ts={n['timestamp']} | {n['note']}"
                )
        else:
            lines.append("  无")

        lines.append("改判前后差异:")
        if payload.judgment_changes:
            for c in payload.judgment_changes:
                lines.append(
                    f"  - {c['field_name']}: '{c['old_value']}' -> '{c['new_value']}'"
                    + (f" | by {c['changed_by']}" if c["changed_by"] else "")
                    + (f" | 原因: {c['reason']}" if c["reason"] else "")
                )
        else:
            lines.append("  无")

        return "\n".join(lines)

    def _locate_samples(self, report: BladeReport) -> dict[str, Any]:
        return {
            "blade_ids": list(report.blade_ids),
            "record_count": len(report.records),
            "material_count": len(report.materials),
        }

    @staticmethod
    def _anomaly_to_dict(a: Anomaly) -> dict[str, Any]:
        return {
            "kind": a.kind,
            "blade_id": a.blade_id,
            "metric_name": a.metric_name,
            "timestamp": a.timestamp.isoformat() if a.timestamp else "",
            "value": a.value,
            "explanation": a.explanation,
            "severity": a.severity,
        }

    def _collect_suspensions(self, report: BladeReport) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for s in report.suspensions:
            out.append(
                {
                    "suspension_id": s.suspension_id,
                    "reason": s.reason,
                    "gap_start": s.gap_start.isoformat() if s.gap_start else "",
                    "gap_end": s.gap_end.isoformat() if s.gap_end else "",
                    "resolved": s.resolved,
                    "resolved_by": s.resolved_by,
                    "resolution_note": s.resolution_note,
                }
            )
        return out

    def _collect_manual_notes(self, report: BladeReport) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for r in report.records:
            if r.manual_note:
                out.append(
                    {
                        "record_id": r.record_id,
                        "blade_id": r.blade_id,
                        "metric_name": r.metric_name,
                        "timestamp": r.timestamp.isoformat(),
                        "note": r.manual_note,
                    }
                )
        return out

    def _collect_judgment_changes(
        self, report: BladeReport, audit: AuditTrail
    ) -> list[dict[str, Any]]:
        changes: list[JudgmentChange] = audit.get_judgment_diff(report.report_id)
        out: list[dict[str, Any]] = []
        for c in changes:
            out.append(
                {
                    "field_name": c.field_name,
                    "old_value": c.old_value,
                    "new_value": c.new_value,
                    "changed_at": c.changed_at.isoformat(),
                    "changed_by": c.changed_by,
                    "reason": c.reason,
                }
            )
        return out

    def _collect_materials(self, report: BladeReport) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for m in report.materials:
            out.append(
                {
                    "material_id": m.material_id,
                    "current_name": m.current_name,
                    "original_name": m.original_name,
                    "version": m.version,
                    "name_changed": m.name_changed,
                    "stance_changed": m.stance_changed,
                    "previous_stance": m.previous_stance,
                    "current_stance": m.content,
                }
            )
        return out
