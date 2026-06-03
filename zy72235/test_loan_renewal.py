import unittest
from datetime import datetime

from models import (
    HolidayExtension, TailAdjustment, MaterialType, ReviewAction,
    BusinessStatus, NextStepRole
)
from service import LoanRenewalScoreService
from report_generator import ReportGenerator


class TestHolidayExtensionImport(unittest.TestCase):
    def setUp(self):
        self.service = LoanRenewalScoreService()

    def test_import_new_holiday(self):
        holidays = [
            HolidayExtension(
                business_no="TEST001",
                original_due_date=datetime(2024, 1, 15),
                extended_due_date=datetime(2024, 1, 18),
                reason="测试",
                remark="初次导入"
            )
        ]
        imported, skipped = self.service.import_holiday_extensions(holidays, "BATCH-001")
        self.assertEqual(imported, 1)
        self.assertEqual(skipped, 0)

    def test_duplicate_import_no_duplication(self):
        holidays = [
            HolidayExtension(
                business_no="TEST001",
                original_due_date=datetime(2024, 1, 15),
                extended_due_date=datetime(2024, 1, 18),
                reason="测试",
                remark="初次导入"
            )
        ]
        self.service.import_holiday_extensions(holidays, "BATCH-001")

        imported, skipped = self.service.import_holiday_extensions(holidays, "BATCH-002")
        self.assertEqual(imported, 0)
        self.assertEqual(skipped, 1)

        score = self.service.get_score("TEST001")
        self.assertEqual(len(score.holiday_extensions), 1)

    def test_duplicate_import_updates_remark(self):
        holidays1 = [
            HolidayExtension(
                business_no="TEST001",
                original_due_date=datetime(2024, 1, 15),
                extended_due_date=datetime(2024, 1, 18),
                reason="测试",
                remark="旧备注"
            )
        ]
        self.service.import_holiday_extensions(holidays1, "BATCH-001")

        holidays2 = [
            HolidayExtension(
                business_no="TEST001",
                original_due_date=datetime(2024, 1, 15),
                extended_due_date=datetime(2024, 1, 18),
                reason="测试",
                remark="新备注"
            )
        ]
        self.service.import_holiday_extensions(holidays2, "BATCH-002")

        score = self.service.get_score("TEST001")
        self.assertEqual(score.holiday_extensions[0].remark, "新备注")
        self.assertEqual(len(score.change_history), 1)


class TestRemarkChangeHistory(unittest.TestCase):
    def setUp(self):
        self.service = LoanRenewalScoreService()
        holidays = [
            HolidayExtension(
                business_no="TEST001",
                original_due_date=datetime(2024, 1, 15),
                extended_due_date=datetime(2024, 1, 18),
                reason="测试",
                remark="初始"
            )
        ]
        self.service.import_holiday_extensions(holidays, "BATCH-001")

    def test_update_remark_records_history(self):
        score = self.service.get_score("TEST001")
        holiday_id = score.holiday_extensions[0].id

        result = self.service.update_remark(
            "TEST001",
            MaterialType.HOLIDAY_EXTENSION,
            holiday_id,
            "更新后的备注",
            "测试员",
            "测试修改原因"
        )

        self.assertTrue(result)
        history = self.service.get_change_history("TEST001")
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["修改前"], "初始")
        self.assertEqual(history[0]["修改后"], "更新后的备注")
        self.assertEqual(history[0]["修改人"], "测试员")
        self.assertEqual(history[0]["修改原因"], "测试修改原因")

    def test_same_remark_no_change(self):
        score = self.service.get_score("TEST001")
        holiday_id = score.holiday_extensions[0].id

        result = self.service.update_remark(
            "TEST001",
            MaterialType.HOLIDAY_EXTENSION,
            holiday_id,
            "初始",
            "测试员"
        )

        self.assertFalse(result)


class TestBusinessDetailSplit(unittest.TestCase):
    def setUp(self):
        self.service = LoanRenewalScoreService()

    def test_holiday_import_creates_fee_principal_split(self):
        holidays = [
            HolidayExtension(
                business_no="TEST001",
                original_due_date=datetime(2024, 1, 15),
                extended_due_date=datetime(2024, 1, 18),
                reason="测试"
            )
        ]
        self.service.import_holiday_extensions(holidays, "BATCH-001")

        score = self.service.get_score("TEST001")
        detail_types = [d.detail_type for d in score.business_details]

        self.assertIn("手续费", detail_types)
        self.assertIn("本金", detail_types)
        self.assertEqual(len(score.business_details), 2)

    def test_split_details_pending_review_initially(self):
        holidays = [
            HolidayExtension(
                business_no="TEST001",
                original_due_date=datetime(2024, 1, 15),
                extended_due_date=datetime(2024, 1, 18),
                reason="测试"
            )
        ]
        self.service.import_holiday_extensions(holidays, "BATCH-001")

        score = self.service.get_score("TEST001")
        for detail in score.business_details:
            self.assertEqual(detail.status, BusinessStatus.PENDING_REVIEW)


class TestSettlementSupervisorReview(unittest.TestCase):
    def setUp(self):
        self.service = LoanRenewalScoreService()
        holidays = [
            HolidayExtension(
                business_no="TEST001",
                original_due_date=datetime(2024, 1, 15),
                extended_due_date=datetime(2024, 1, 18),
                reason="测试"
            )
        ]
        self.service.import_holiday_extensions(holidays, "BATCH-001")

    def test_approve_changes_status_to_normal(self):
        score = self.service.get_score("TEST001")
        detail_ids = [score.business_details[0].id]

        result = self.service.review_by_settlement_supervisor(
            "TEST001",
            detail_ids,
            ReviewAction.APPROVE,
            "同意",
            "结算主管"
        )

        self.assertTrue(result)
        self.assertEqual(score.business_details[0].status, BusinessStatus.NORMAL)

    def test_review_creates_record(self):
        score = self.service.get_score("TEST001")
        detail_ids = [d.id for d in score.business_details]

        self.service.review_by_settlement_supervisor(
            "TEST001",
            detail_ids,
            ReviewAction.APPROVE,
            "全部同意",
            "结算主管-王总"
        )

        self.assertEqual(len(score.review_records), 1)
        self.assertEqual(score.review_records[0].reviewer, "结算主管-王总")
        self.assertEqual(score.review_records[0].review_action, ReviewAction.APPROVE)
        self.assertEqual(score.review_records[0].review_comment, "全部同意")


class TestDifferenceList(unittest.TestCase):
    def setUp(self):
        self.service = LoanRenewalScoreService()

    def test_pending_review_difference_points_to_supervisor(self):
        holidays = [
            HolidayExtension(
                business_no="TEST001",
                original_due_date=datetime(2024, 1, 15),
                extended_due_date=datetime(2024, 1, 18),
                reason="测试"
            )
        ]
        self.service.import_holiday_extensions(holidays, "BATCH-001")

        score = self.service.get_score("TEST001")
        pending_diff = [d for d in score.differences if d.next_step_role == NextStepRole.SETTLEMENT_SUPERVISOR]

        self.assertTrue(len(pending_diff) > 0)
        self.assertIn("拆分为手续费和本金", pending_diff[0].reason_kept)
        self.assertIn("结算主管", pending_diff[0].next_step_action)

    def test_missing_tail_adjustment_difference(self):
        holidays = [
            HolidayExtension(
                business_no="TEST001",
                original_due_date=datetime(2024, 1, 15),
                extended_due_date=datetime(2024, 1, 18),
                reason="测试"
            )
        ]
        self.service.import_holiday_extensions(holidays, "BATCH-001")

        score = self.service.get_score("TEST001")
        tail_diff = [d for d in score.differences if "尾差" in d.description]

        self.assertTrue(len(tail_diff) > 0)
        self.assertEqual(tail_diff[0].next_step_role, NextStepRole.RESEARCH_ASSISTANT)


class TestNavigateToSource(unittest.TestCase):
    def setUp(self):
        self.service = LoanRenewalScoreService()
        holidays = [
            HolidayExtension(
                business_no="TEST001",
                original_due_date=datetime(2024, 1, 15),
                extended_due_date=datetime(2024, 1, 18),
                reason="测试原因",
                remark="测试备注"
            )
        ]
        self.service.import_holiday_extensions(holidays, "BATCH-001")

    def test_navigate_back_to_holiday_extension(self):
        score = self.service.get_score("TEST001")
        detail_id = score.business_details[0].id

        source_info = self.service.navigate_to_source_material("TEST001", detail_id)

        self.assertIsNotNone(source_info)
        self.assertIsNotNone(source_info["holiday_extension"])
        self.assertEqual(source_info["holiday_extension"].reason, "测试原因")
        self.assertEqual(source_info["holiday_extension"].remark, "测试备注")


class TestReportGenerator(unittest.TestCase):
    def setUp(self):
        self.service = LoanRenewalScoreService()
        holidays = [
            HolidayExtension(
                business_no="TEST001",
                original_due_date=datetime(2024, 1, 15),
                extended_due_date=datetime(2024, 1, 18),
                reason="测试"
            )
        ]
        self.service.import_holiday_extensions(holidays, "BATCH-001")

    def test_summary_report_generation(self):
        report = ReportGenerator.generate_summary_report(self.service)
        self.assertIn("小微贷款续贷评分复核报告", report)
        self.assertIn("总业务数", report)
        self.assertIn("待结算主管复核", report)

    def test_difference_report_generation(self):
        report = ReportGenerator.generate_difference_report(self.service)
        self.assertIn("差异清单详情", report)
        self.assertIn("为什么留下", report)
        self.assertIn("下一步", report)


if __name__ == "__main__":
    unittest.main()
