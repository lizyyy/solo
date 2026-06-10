from blade_review.audit import AuditTrail
from blade_review.models import BladeReport


class TestAuditTrailLog:
    def test_log_action(self):
        trail = AuditTrail()
        entry = trail.log_action(
            report_id="r001", action="import_new", operator="小宋"
        )
        assert entry.action == "import_new"
        assert len(trail.get_all_entries()) == 1

    def test_log_judgment_change(self):
        trail = AuditTrail()
        entry = trail.log_judgment_change(
            report_id="r001",
            field_name="status",
            old_value="approved",
            new_value="rejected",
            operator="小宋",
            reason="现场发现裂纹",
        )
        assert entry.action == "judgment_changed"
        assert len(entry.changes) == 1
        assert entry.changes[0].old_value == "approved"
        assert entry.changes[0].new_value == "rejected"
        assert entry.changes[0].reason == "现场发现裂纹"

    def test_get_report_history(self):
        trail = AuditTrail()
        trail.log_action(report_id="r001", action="import")
        trail.log_action(report_id="r002", action="import")
        trail.log_action(report_id="r001", action="review")
        history = trail.get_report_history("r001")
        assert len(history) == 2

    def test_get_judgment_diff(self):
        trail = AuditTrail()
        trail.log_judgment_change(
            report_id="r001",
            field_name="status",
            old_value="approved",
            new_value="rejected",
        )
        trail.log_judgment_change(
            report_id="r001",
            field_name="conclusion",
            old_value="正常",
            new_value="异常",
        )
        diffs = trail.get_judgment_diff("r001")
        assert len(diffs) == 2
