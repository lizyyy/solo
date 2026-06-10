from datetime import datetime, timedelta

from blade_review.importer import ReportImporter
from blade_review.models import (
    BladeReport,
    InspectionRecord,
    MaterialType,
    SupplementaryMaterial,
)


def _make_report(blade_ids=None, title="风机叶片报告复核"):
    return BladeReport(title=title, blade_ids=blade_ids or ["B001"])


def _make_record(blade_id="B001", metric="vibration", value=1.0, ts=None):
    return InspectionRecord(
        blade_id=blade_id,
        metric_name=metric,
        value=value,
        timestamp=ts or datetime(2026, 6, 10, 10, 0, 0),
    )


def _make_material(name="补充材料", content="口径", mat_type=MaterialType.SUPPLEMENTARY):
    return SupplementaryMaterial(
        current_name=name, original_name=name, content=content, material_type=mat_type
    )


class TestImporterNewReport:
    def test_import_new_report(self):
        importer = ReportImporter()
        report = _make_report()
        report.records = [_make_record()]
        result = importer.import_report(report, operator="小宋")
        assert result.is_new_report is True
        assert result.records_added == 1

    def test_duplicate_import_skipped(self):
        importer = ReportImporter()
        report_a = _make_report()
        report_a.records = [_make_record()]
        importer.import_report(report_a, operator="小宋")
        report_b = _make_report()
        report_b.records = [_make_record()]
        result = importer.import_report(report_b, operator="小宋")
        assert result.is_new_report is False


class TestImporterMerge:
    def test_merge_adds_new_records_not_duplicates(self):
        importer = ReportImporter()
        existing = _make_report()
        ts_a = datetime(2026, 6, 10, 10, 0, 0)
        ts_b = datetime(2026, 6, 10, 12, 0, 0)
        existing.records = [_make_record(ts=ts_a)]
        importer.import_report(existing, operator="小宋")

        incoming = _make_report()
        incoming.records = [_make_record(ts=ts_a), _make_record(ts=ts_b)]
        result = importer.import_report(incoming, existing=existing, operator="小宋")
        assert result.records_added == 1
        assert result.records_skipped == 1
        assert len(existing.records) == 2

    def test_merge_no_double_count(self):
        importer = ReportImporter()
        existing = _make_report()
        ts = datetime(2026, 6, 10, 10, 0, 0)
        existing.records = [_make_record(ts=ts)]
        importer.import_report(existing, operator="小宋")

        incoming = _make_report()
        incoming.records = [_make_record(ts=ts)]
        result = importer.import_report(incoming, existing=existing, operator="小宋")
        assert result.records_skipped == 1
        assert result.records_added == 0
        assert len(existing.records) == 1

    def test_manual_notes_preserved_on_duplicate(self):
        importer = ReportImporter()
        existing = _make_report()
        ts = datetime(2026, 6, 10, 10, 0, 0)
        rec = _make_record(ts=ts)
        rec.manual_note = "人工备注：已现场确认"
        existing.records = [rec]
        importer.import_report(existing, operator="小宋")

        incoming = _make_report()
        dup_rec = _make_record(ts=ts)
        incoming.records = [dup_rec]
        result = importer.import_report(incoming, existing=existing, operator="小宋")
        assert result.records_skipped == 1
        assert existing.records[0].manual_note == "人工备注：已现场确认"


class TestImporterMaterialMerge:
    def test_material_name_change_detected_on_merge(self):
        importer = ReportImporter()
        existing = _make_report()
        mat_a = _make_material(name="原始材料", content="口径v1")
        existing.materials = [mat_a]
        importer.import_report(existing, operator="小宋")

        incoming = _make_report()
        mat_b = _make_material(name="完全改名的材料", content="口径v1")
        incoming.materials = [mat_b]
        result = importer.import_report(incoming, existing=existing, operator="小宋")
        assert result.materials_updated == 1

    def test_new_material_added(self):
        importer = ReportImporter()
        existing = _make_report()
        mat_a = _make_material(name="材料A", content="口径A")
        existing.materials = [mat_a]
        importer.import_report(existing, operator="小宋")

        incoming = _make_report()
        mat_b = _make_material(name="材料B", content="口径B")
        incoming.materials = [mat_b]
        result = importer.import_report(incoming, existing=existing, operator="小宋")
        assert result.materials_added == 1
        assert len(existing.materials) == 2


class TestImporterGapSuspension:
    def test_import_with_gap_suspends(self):
        importer = ReportImporter(gap_detector=ReportImporter().gap)
        report = _make_report()
        ts = datetime(2026, 6, 10, 10, 0, 0)
        report.records = [
            _make_record(ts=ts),
            _make_record(ts=ts + timedelta(hours=48)),
        ]
        result = importer.import_report(report, operator="小宋")
        assert result.suspensions == 1
