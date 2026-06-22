from __future__ import annotations

import csv
import json
import os
from datetime import datetime
from typing import Optional

from .anomaly import AnomalyDetector
from .audit import AuditTrail
from .exporter import ReportExporter
from .gap_detector import GapDetector
from .handover import HandoverSummary
from .importer import ImportResult, ReportImporter
from .models import (
    BladeReport,
    InspectionRecord,
    MaterialType,
    ReviewStatus,
    SupplementaryMaterial,
)
from .storage import ReportStore
from .version_tracker import VersionTracker


DEFAULT_GAP_HOURS = 24.0


def _parse_dt(value: str) -> datetime:
    value = value.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return datetime.fromisoformat(value)


def _default_db_path() -> str:
    env = os.environ.get("BLADE_REVIEW_DB")
    if env:
        return env
    return os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "blade_review.db")
    )


class ReviewService:
    def __init__(
        self,
        db_path: Optional[str] = None,
        gap_hours: float = DEFAULT_GAP_HOURS,
    ) -> None:
        self.db_path = db_path or _default_db_path()
        self.gap_hours = gap_hours
        self.store = ReportStore(self.db_path)
        self.audit = AuditTrail()
        self.anomaly = AnomalyDetector()
        self.gap = GapDetector(max_gap_hours=gap_hours)
        self.exporter = ReportExporter(
            anomaly_detector=self.anomaly, audit_trail=self.audit, gap_hours=gap_hours
        )
        self.handover = HandoverSummary(
            audit_trail=self.audit,
            anomaly_detector=self.anomaly,
            exporter=self.exporter,
            gap_hours=gap_hours,
        )

    def close(self) -> None:
        self.store.close()

    def __enter__(self) -> "ReviewService":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def _hydrate_audit_from_storage(self, report: BladeReport) -> None:
        for entry in report.audit_logs:
            if entry not in self.audit.get_all_entries():
                self.audit._entries.append(entry)

    def list_reports(self) -> list[dict]:
        return self.store.list_reports()

    def get_report(self, report_id: str) -> Optional[BladeReport]:
        report = self.store.load_report(report_id)
        if report:
            self._hydrate_audit_from_storage(report)
        return report

    def _find_existing(
        self, report_id: Optional[str], incoming: BladeReport
    ) -> Optional[BladeReport]:
        if report_id:
            existing = self.store.load_report(report_id)
            if existing:
                self._hydrate_audit_from_storage(existing)
            return existing
        incoming.compute_request_hash()
        by_hash = self.store.find_by_request_hash(incoming.request_hash)
        if by_hash:
            self._hydrate_audit_from_storage(by_hash)
        return by_hash

    def import_report(
        self,
        incoming: BladeReport,
        report_id: Optional[str] = None,
        operator: str = "",
    ) -> tuple[BladeReport, ImportResult]:
        existing = self._find_existing(report_id, incoming)
        for mat in incoming.materials:
            if not mat.content_hash:
                mat.compute_hash()
        for rec in incoming.records:
            if not rec.content_hash:
                rec.compute_hash()

        importer = ReportImporter(
            gap_detector=self.gap,
            audit_trail=self.audit,
            version_tracker=VersionTracker(),
        )
        if existing is None:
            result = importer.import_report(incoming, operator=operator)
            incoming.updated_at = datetime.now()
            incoming.operator = operator or incoming.operator
            self._save_with_audit(incoming)
            return incoming, result

        self._seed_version_tracker(importer.tracker, existing)
        result = importer.import_report(
            incoming, existing=existing, operator=operator
        )
        existing.updated_at = datetime.now()
        existing.operator = operator or existing.operator
        self._save_with_audit(existing)
        return existing, result

    def _seed_version_tracker(
        self, tracker: VersionTracker, report: BladeReport
    ) -> None:
        for mat in report.materials:
            tracker.capture(mat)
            if mat.version > 1:
                if mat.material_id not in tracker._history:
                    tracker._history[mat.material_id] = []
                from .version_tracker import VersionSnapshot

                existing = tracker._history[mat.material_id]
                if len(existing) < mat.version:
                    for v in range(max(1, len(existing) + 1), mat.version + 1):
                        existing.append(
                            VersionSnapshot(
                                material_id=mat.material_id,
                                version=v,
                                name=mat.current_name,
                                content=mat.content,
                            )
                        )

    def _save_with_audit(self, report: BladeReport) -> None:
        for entry in self.audit.get_report_history(report.report_id):
            if not any(e.entry_id == entry.entry_id for e in report.audit_logs):
                report.audit_logs.append(entry)
        self.store.save_report(report)

    def resolve_suspension(
        self,
        report_id: str,
        suspension_id: str,
        resolved_by: str,
        resolution_note: str,
    ) -> tuple[bool, Optional[BladeReport]]:
        ok = self.store.resolve_suspension(
            report_id, suspension_id, resolved_by, resolution_note
        )
        if not ok:
            return False, None
        report = self.store.load_report(report_id)
        if not report:
            return False, None
        all_resolved = all(s.resolved for s in report.suspensions)
        if all_resolved and report.status == ReviewStatus.SUSPENDED:
            report.status = ReviewStatus.IN_REVIEW
            self._save_with_audit(report)
        self.audit.log_action(
            report_id=report_id,
            action="suspension_resolved",
            operator=resolved_by,
            detail=f"suspension={suspension_id} note={resolution_note}",
        )
        return True, report

    def load_records_from_csv(self, path: str) -> list[InspectionRecord]:
        records: list[InspectionRecord] = []
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ts = row.get("timestamp") or row.get("time") or row.get("日期")
                blade = row.get("blade_id") or row.get("blade") or row.get("叶片编号")
                metric = (
                    row.get("metric")
                    or row.get("metric_name")
                    or row.get("指标")
                    or "vibration"
                )
                value_raw = row.get("value") or row.get("值") or row.get("数值")
                note = (
                    row.get("manual_note")
                    or row.get("note")
                    or row.get("备注")
                    or ""
                )
                ts_dt = _parse_dt(ts) if ts else datetime.now()
                rec = InspectionRecord(
                    blade_id=blade,
                    timestamp=ts_dt,
                    value=float(value_raw) if value_raw else 0.0,
                    metric_name=metric,
                    manual_note=note,
                )
                rec.compute_hash()
                records.append(rec)
        return records

    def load_material_from_file(
        self,
        path: str,
        name: Optional[str] = None,
        material_type: MaterialType = MaterialType.SUPPLEMENTARY,
    ) -> SupplementaryMaterial:
        base = os.path.basename(path)
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        material = SupplementaryMaterial(
            current_name=name or base,
            original_name=name or base,
            material_type=material_type,
            content=content,
        )
        material.compute_hash()
        return material

    def load_material_from_text(
        self,
        name: str,
        content: str,
        material_type: MaterialType = MaterialType.VERBAL_NOTE,
    ) -> SupplementaryMaterial:
        material = SupplementaryMaterial(
            current_name=name,
            original_name=name,
            material_type=material_type,
            content=content,
        )
        material.compute_hash()
        return material

    def export_json(self, report_id: str, out_path: str) -> str:
        report = self.get_report(report_id)
        if not report:
            raise KeyError(f"report_id {report_id} not found")
        return self.exporter.export_json(report, out_path=out_path, audit_trail=self.audit)

    def export_text(self, report_id: str, out_path: str) -> str:
        report = self.get_report(report_id)
        if not report:
            raise KeyError(f"report_id {report_id} not found")
        text = self.exporter.export_text(report, audit_trail=self.audit)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(text)
        return text

    def handover_text(self, report_id: str) -> str:
        report = self.get_report(report_id)
        if not report:
            raise KeyError(f"report_id {report_id} not found")
        return self.handover.generate(
            report,
            export_command=f"blade-review export --report {report_id} --out <path>",
        )

    def save_report_inline(self, report: BladeReport) -> None:
        self._save_with_audit(report)
