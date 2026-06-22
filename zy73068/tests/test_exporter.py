import json
from datetime import datetime, timedelta

from blade_review.audit import AuditTrail
from blade_review.exporter import ReportExporter
from blade_review.models import BladeReport, InspectionRecord, ReviewStatus, SuspensionRecord


class TestExporter:
    def _make_report(self):
        r = BladeReport(
            title="测试", blade_ids=["B001"], operator="小宋", status=ReviewStatus.SUSPENDED
        )
        base = datetime(2026, 6, 10, 10, 0, 0)
        values = [1.0, 1.02, 1.01, 0.99, 8.0, 1.03, 1.0, 1.02]
        for i, v in enumerate(values):
            r.records.append(
                InspectionRecord(
                    blade_id="B001", metric_name="vibration", value=v,
                    timestamp=base + timedelta(hours=i * 2),
                    manual_note=("突变点" if v > 5 else ""),
                )
            )
        r.suspensions.append(
            SuspensionRecord(reason="sampling_gap_major", report_id=r.report_id)
        )
        return r

    def test_export_json_has_all_required_fields(self, tmp_path):
        audit = AuditTrail()
        audit.log_judgment_change(
            report_id="r001",
            field_name="status",
            old_value="approved",
            new_value="rejected",
            operator="小宋",
            reason="现场发现裂纹",
        )
        exporter = ReportExporter(audit_trail=audit)
        report = self._make_report()
        report.report_id = "r001"
        out = tmp_path / "out.json"
        text = exporter.export_json(report, out_path=str(out))
        assert out.exists()
        data = json.loads(text)
        for key in [
            "report_id", "status", "conclusion", "is_stable",
            "anomalies", "suspensions", "manual_notes",
            "judgment_changes", "sample_location",
        ]:
            assert key in data, key
        assert data["report_id"] == "r001"
        assert data["sample_location"]["blade_ids"] == ["B001"]
        assert any(a["kind"] == "single_point_spike" for a in data["anomalies"])
        assert len(data["manual_notes"]) >= 1
        assert len(data["judgment_changes"]) == 1

    def test_export_text_has_sections(self, tmp_path):
        exporter = ReportExporter()
        report = self._make_report()
        text = exporter.export_text(report, out_path=str(tmp_path / "out.txt"))
        for key in [
            "复核结论", "异常点", "挂起项", "人工备注", "改判前后差异", "样例位置",
        ]:
            assert key in text, key
