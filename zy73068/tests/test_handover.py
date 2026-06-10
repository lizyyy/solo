from blade_review.audit import AuditTrail
from blade_review.handover import HandoverSummary
from blade_review.models import (
    BladeReport,
    MaterialType,
    SupplementaryMaterial,
    SuspensionRecord,
)


def _make_report(blade_ids=None):
    return BladeReport(title="风机叶片报告复核", blade_ids=blade_ids or ["B001"])


class TestHandoverSummary:
    def test_basic_handover(self):
        audit = AuditTrail()
        summary = HandoverSummary(audit)
        report = _make_report(blade_ids=["B001", "B002"])
        text = summary.generate(report)
        assert "B001" in text
        assert "B002" in text
        assert "导出方式" in text
        assert "异常: 无" in text

    def test_handover_with_anomalies(self):
        audit = AuditTrail()
        summary = HandoverSummary(audit)
        report = _make_report()
        mat = SupplementaryMaterial(
            current_name="新名称",
            original_name="旧名称",
            content="口径v2",
            name_changed=True,
            stance_changed=True,
        )
        report.materials = [mat]
        text = summary.generate(report)
        assert "material_renamed" in text
        assert "material_stance_changed" in text

    def test_handover_with_suspension(self):
        audit = AuditTrail()
        summary = HandoverSummary(audit)
        report = _make_report()
        report.suspensions = [
            SuspensionRecord(reason="sampling_gap_major", resolved=False)
        ]
        text = summary.generate(report)
        assert "suspended" in text
        assert "待处理挂起: 1" in text

    def test_handover_with_judgment_changes(self):
        audit = AuditTrail()
        audit.log_judgment_change(
            report_id="r001",
            field_name="status",
            old_value="approved",
            new_value="rejected",
        )
        summary = HandoverSummary(audit)
        report = _make_report()
        report.report_id = "r001"
        text = summary.generate(report)
        assert "近期改判: 1条" in text

    def test_handover_is_concise(self):
        audit = AuditTrail()
        summary = HandoverSummary(audit)
        report = _make_report(blade_ids=["B001"])
        text = summary.generate(report)
        lines = [l for l in text.split("\n") if l.strip()]
        assert len(lines) <= 8
