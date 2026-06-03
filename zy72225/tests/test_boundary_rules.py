import unittest
from datetime import datetime

from src.models import ReleaseRecord, OriginalSnapshot, ProcessStatus, BoundaryType
from src.boundary_rules import BoundaryRuleEngine


class TestBoundaryRules(unittest.TestCase):
    def setUp(self):
        self.rule_engine = BoundaryRuleEngine()

    def _create_test_record(self, amount: float, remark: str) -> ReleaseRecord:
        snapshot = OriginalSnapshot(
            row_number=1,
            source_file="test.xlsx",
            import_timestamp=datetime.now(),
            raw_data={},
        )
        return ReleaseRecord(
            record_id="test_001",
            ex_dividend_date="2024-01-15",
            bill_number="BILL001",
            amount=amount,
            remark=remark,
            original_snapshot=snapshot,
        )

    def test_zero_amount_with_reversal_note_triggers_rule(self):
        record = self._create_test_record(0.0, "已冲正以前金额")

        triggered, rules = self.rule_engine.check_and_apply(record, operator="test")

        self.assertTrue(triggered)
        self.assertIn(BoundaryType.ZERO_AMOUNT_WITH_REVERSAL_NOTE, rules)
        self.assertEqual(record.status, ProcessStatus.RISK_REVIEW_REQUIRED)
        self.assertEqual(record.boundary_type, BoundaryType.ZERO_AMOUNT_WITH_REVERSAL_NOTE)
        self.assertGreater(len(record.change_history), 0)

    def test_zero_amount_without_reversal_note_no_trigger(self):
        record = self._create_test_record(0.0, "正常备注")

        triggered, rules = self.rule_engine.check_and_apply(record, operator="test")

        self.assertFalse(triggered)
        self.assertEqual(len(rules), 0)
        self.assertEqual(record.status, ProcessStatus.PENDING)

    def test_nonzero_amount_with_reversal_note_no_trigger(self):
        record = self._create_test_record(100.0, "已冲正")

        triggered, rules = self.rule_engine.check_and_apply(record, operator="test")

        self.assertFalse(triggered)
        self.assertEqual(record.status, ProcessStatus.PENDING)

    def test_chongxiao_keyword_triggers_rule(self):
        record = self._create_test_record(0.0, "已冲销")

        triggered, rules = self.rule_engine.check_and_apply(record, operator="test")

        self.assertTrue(triggered)
        self.assertIn(BoundaryType.ZERO_AMOUNT_WITH_REVERSAL_NOTE, rules)

    def test_negative_amount_triggers_rule(self):
        record = self._create_test_record(-50.0, "负数金额")

        triggered, rules = self.rule_engine.check_and_apply(record, operator="test")

        self.assertTrue(triggered)
        self.assertIn(BoundaryType.NEGATIVE_AMOUNT, rules)
        self.assertEqual(record.status, ProcessStatus.RISK_REVIEW_REQUIRED)

    def test_rollback_zero_amount_rule(self):
        record = self._create_test_record(0.0, "已冲正")
        self.rule_engine.check_and_apply(record, operator="test")

        self.assertEqual(record.status, ProcessStatus.RISK_REVIEW_REQUIRED)

        rollback_success = self.rule_engine.rollback_rule(
            record, BoundaryType.ZERO_AMOUNT_WITH_REVERSAL_NOTE, operator="test"
        )

        self.assertTrue(rollback_success)
        self.assertEqual(record.status, ProcessStatus.PENDING)
        self.assertIsNone(record.boundary_type)

    def test_change_log_records_boundary_rule_application(self):
        record = self._create_test_record(0.0, "已冲正")

        self.rule_engine.check_and_apply(record, operator="test_operator")

        boundary_logs = [
            log for log in record.change_history
            if log.change_type.value == "boundary_rule_applied"
        ]
        self.assertEqual(len(boundary_logs), 1)
        self.assertEqual(boundary_logs[0].operator, "test_operator")
        self.assertIn("冲正", boundary_logs[0].reason)

    def test_original_row_number_preserved(self):
        snapshot = OriginalSnapshot(
            row_number=42,
            source_file="test.xlsx",
            import_timestamp=datetime.now(),
            raw_data={"test": "data"},
        )
        record = ReleaseRecord(
            record_id="test_001",
            ex_dividend_date="2024-01-15",
            bill_number="BILL001",
            amount=0.0,
            remark="已冲正",
            original_snapshot=snapshot,
        )

        self.rule_engine.check_and_apply(record, operator="test")

        self.assertEqual(record.original_snapshot.row_number, 42)
        self.assertEqual(record.to_dict()["original_row_number"], 42)


if __name__ == "__main__":
    unittest.main()
