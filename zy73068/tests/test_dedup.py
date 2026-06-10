from datetime import datetime, timedelta

from blade_review.dedup import Deduplicator
from blade_review.models import (
    BladeReport,
    InspectionRecord,
    MaterialType,
    SupplementaryMaterial,
)


def _make_report(title="风机叶片报告复核", blade_ids=None):
    return BladeReport(
        title=title,
        blade_ids=blade_ids or ["B001"],
    )


def _make_record(blade_id="B001", metric="vibration", value=1.0, ts=None):
    return InspectionRecord(
        blade_id=blade_id,
        metric_name=metric,
        value=value,
        timestamp=ts or datetime.now(),
    )


def _make_material(name="补充材料A", content="原始口径", mat_type=MaterialType.SUPPLEMENTARY):
    return SupplementaryMaterial(
        current_name=name,
        original_name=name,
        content=content,
        material_type=mat_type,
    )


class TestDeduplicatorReport:
    def setup_method(self):
        self.dedup = Deduplicator()

    def test_same_request_hash_is_duplicate(self):
        report_a = _make_report(blade_ids=["B001"])
        self.dedup.register_report(report_a)
        report_b = _make_report(blade_ids=["B001"])
        result = self.dedup.check_report_duplicate(report_b)
        assert result.is_duplicate is True
        assert result.matched_report_id == report_a.report_id

    def test_different_request_not_duplicate(self):
        report_a = _make_report(blade_ids=["B001"])
        self.dedup.register_report(report_a)
        report_b = _make_report(blade_ids=["B002"])
        result = self.dedup.check_report_duplicate(report_b)
        assert result.is_duplicate is False

    def test_duplicate_submission_no_double_count(self):
        report_a = _make_report(blade_ids=["B001"])
        self.dedup.register_report(report_a)
        report_b = _make_report(blade_ids=["B001"])
        result = self.dedup.check_report_duplicate(report_b)
        assert result.is_duplicate is True


class TestDeduplicatorRecord:
    def setup_method(self):
        self.dedup = Deduplicator()

    def test_same_record_hash_is_duplicate(self):
        ts = datetime(2026, 6, 10, 10, 0, 0)
        rec_a = _make_record(ts=ts)
        rec_a.compute_hash()
        existing = [rec_a]
        rec_b = _make_record(ts=ts)
        rec_b.compute_hash()
        result = self.dedup.check_record_duplicate(rec_b, existing)
        assert result.is_duplicate is True

    def test_different_record_not_duplicate(self):
        ts_a = datetime(2026, 6, 10, 10, 0, 0)
        ts_b = datetime(2026, 6, 10, 11, 0, 0)
        rec_a = _make_record(ts=ts_a)
        rec_a.compute_hash()
        rec_b = _make_record(ts=ts_b)
        rec_b.compute_hash()
        result = self.dedup.check_record_duplicate(rec_b, [rec_a])
        assert result.is_duplicate is False


class TestDeduplicatorMaterialNameMismatch:
    def setup_method(self):
        self.dedup = Deduplicator()

    def test_same_content_different_name_flags_mismatch(self):
        mat_a = _make_material(name="旧名称", content="口径A")
        mat_a.compute_hash()
        mat_b = _make_material(name="完全不同的新名称", content="口径A")
        mat_b.compute_hash()
        result = self.dedup.check_material_name_mismatch(mat_b, [mat_a])
        assert result.is_duplicate is True
        assert result.name_mismatch is True

    def test_same_content_similar_name_no_mismatch(self):
        mat_a = _make_material(name="补充材料A", content="口径A")
        mat_a.compute_hash()
        mat_b = _make_material(name="补充材料A-v2", content="口径A")
        mat_b.compute_hash()
        result = self.dedup.check_material_name_mismatch(mat_b, [mat_a])
        assert result.is_duplicate is True
        assert result.name_mismatch is False

    def test_different_content_not_duplicate(self):
        mat_a = _make_material(name="材料X", content="口径A")
        mat_a.compute_hash()
        mat_b = _make_material(name="材料X", content="口径B")
        mat_b.compute_hash()
        result = self.dedup.check_material_name_mismatch(mat_b, [mat_a])
        assert result.is_duplicate is False


class TestDeduplicatorMerge:
    def setup_method(self):
        self.dedup = Deduplicator()

    def test_merge_adds_new_records_only(self):
        ts = datetime(2026, 6, 10, 10, 0, 0)
        rec_existing = _make_record(ts=ts)
        rec_existing.compute_hash()
        existing_report = _make_report(blade_ids=["B001"])
        existing_report.records = [rec_existing]
        self.dedup.register_report(existing_report)
        for r in existing_report.records:
            self.dedup._content_hashes[r.content_hash] = r.record_id

        new_ts = datetime(2026, 6, 10, 12, 0, 0)
        rec_new = _make_record(ts=new_ts)
        incoming = _make_report(blade_ids=["B001"])
        incoming.records = [rec_existing, rec_new]

        merged = self.dedup.merge_duplicate_report(incoming, existing_report)
        assert len(merged.records) == 2

    def test_merge_detects_name_change(self):
        mat_existing = _make_material(name="原始名称", content="口径")
        mat_existing.compute_hash()
        existing_report = _make_report(blade_ids=["B001"])
        existing_report.materials = [mat_existing]

        mat_renamed = _make_material(name="完全不一样的新名称", content="口径")
        mat_renamed.compute_hash()
        incoming = _make_report(blade_ids=["B001"])
        incoming.materials = [mat_renamed]

        merged = self.dedup.merge_duplicate_report(incoming, existing_report)
        assert merged.materials[0].name_changed is True
        assert merged.materials[0].original_name == "原始名称"
        assert merged.materials[0].current_name == "完全不一样的新名称"
