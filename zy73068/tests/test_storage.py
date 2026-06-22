from datetime import datetime

from blade_review.models import (
    AuditLogEntry,
    BladeReport,
    InspectionRecord,
    JudgmentChange,
    MaterialType,
    SupplementaryMaterial,
)
from blade_review.storage import ReportStore


def _make_report(tmp_path):
    r = BladeReport(
        title="演示报告",
        blade_ids=["B001", "B002"],
        operator="小宋",
    )
    r.records.append(
        InspectionRecord(
            blade_id="B001",
            metric_name="vibration",
            value=1.2,
            timestamp=datetime(2026, 6, 10, 10, 0, 0),
            manual_note="测试备注",
        )
    )
    r.materials.append(
        SupplementaryMaterial(
            current_name="补充材料",
            original_name="补充材料",
            material_type=MaterialType.SUPPLEMENTARY,
            content="原始口径",
            version=1,
        )
    )
    r.audit_logs.append(
        AuditLogEntry(
            action="import",
            operator="小宋",
            detail="初始导入",
            changes=[
                JudgmentChange(
                    field_name="content",
                    old_value="v1",
                    new_value="v2",
                    changed_by="小宋",
                    reason="stance_changed_same_name",
                )
            ],
        )
    )
    return r


class TestStorage:
    def test_save_and_load_roundtrip(self, tmp_path):
        db = tmp_path / "t.db"
        report = _make_report(tmp_path)
        report.compute_request_hash()
        with ReportStore(str(db)) as store:
            store.save_report(report)
            loaded = store.load_report(report.report_id)
        assert loaded is not None
        assert loaded.title == "演示报告"
        assert loaded.blade_ids == ["B001", "B002"]
        assert loaded.operator == "小宋"
        assert len(loaded.records) == 1
        assert loaded.records[0].manual_note == "测试备注"
        assert len(loaded.materials) == 1
        assert loaded.materials[0].current_name == "补充材料"
        assert len(loaded.audit_logs) == 1
        assert len(loaded.audit_logs[0].changes) == 1
        assert loaded.audit_logs[0].changes[0].reason == "stance_changed_same_name"

    def test_list_and_find(self, tmp_path):
        db = tmp_path / "t.db"
        report = _make_report(tmp_path)
        report.compute_request_hash()
        with ReportStore(str(db)) as store:
            store.save_report(report)
            rows = store.list_reports()
            assert len(rows) == 1
            assert rows[0]["report_id"] == report.report_id
            by_hash = store.find_by_request_hash(report.request_hash)
            assert by_hash is not None
            assert by_hash.report_id == report.report_id

    def test_resolve_suspension_via_storage(self, tmp_path):
        from blade_review.models import ReviewStatus, SuspensionRecord

        db = tmp_path / "t.db"
        report = _make_report(tmp_path)
        report.compute_request_hash()
        report.status = ReviewStatus.SUSPENDED
        susp = SuspensionRecord(report_id=report.report_id, reason="sampling_gap_major")
        report.suspensions.append(susp)
        with ReportStore(str(db)) as store:
            store.save_report(report)
            ok = store.resolve_suspension(
                report.report_id, susp.suspension_id, "现场老师", "OK"
            )
            assert ok is True
            reloaded = store.load_report(report.report_id)
            assert reloaded.suspensions[0].resolved is True
            assert reloaded.suspensions[0].resolved_by == "现场老师"
