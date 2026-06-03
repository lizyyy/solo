import unittest
from datetime import date, datetime
from typing import List

import tests
from models import (
    Invoice,
    FundMatchRecord,
    HolidayExtension,
    TailAdjustment,
    MatchStatus,
    RecordType,
    DiscrepancyStatus,
    SelfCheckType,
)
from repository import MatchRepository
from services import (
    MatchingEngine,
    ConflictDetector,
    SelfChecker,
    AuditService,
    WorkflowEngine,
)


class TestConflictDetection(unittest.TestCase):
    def setUp(self):
        self.repo = MatchRepository()
        self.repo.clear_all()
        self.conflict_detector = ConflictDetector(self.repo)
        self.matching_engine = MatchingEngine(self.repo)
        self._setup_test_data()

    def _setup_test_data(self):
        record = FundMatchRecord(
            business_no="BIZ001",
            record_type=RecordType.COMBINED,
            expected_amount=100000.0,
            matched_amount=100000.0,
            status=MatchStatus.MATCHED,
        )
        self.repo.add_match_record(record)

    def test_detect_conflict_between_holiday_and_tail(self):
        holiday = HolidayExtension(
            business_no="BIZ001",
            extension_days=3,
            conclusion="顺延3天，按日利率0.1%计算利息",
            reason="春节假期顺延",
            import_batch="BATCH_HOL_001",
            imported_by="业务同事",
        )
        self.repo.add_holiday_extension(holiday)

        tail_adj = TailAdjustment(
            business_no="BIZ001",
            adjustment_amount=500.0,
            calculation_rule="尾差调整500元",
            reason="系统尾差",
            import_batch="BATCH_TAIL_001",
            imported_by="业务同事",
        )
        self.repo.add_tail_adjustment(tail_adj)

        conflicts = self.conflict_detector.detect_conflicts()

        self.assertEqual(len(conflicts), 1)
        conflict = conflicts[0]
        self.assertEqual(conflict.business_no, "BIZ001")
        self.assertAlmostEqual(conflict.holiday_amount, 100300.0, places=2)
        self.assertAlmostEqual(conflict.tail_adjustment_amount, 100500.0, places=2)
        self.assertAlmostEqual(conflict.difference, 200.0, places=2)
        self.assertIn("BATCH_HOL_001", conflict.holiday_source)
        self.assertIn("BATCH_TAIL_001", conflict.tail_adjustment_source)

    def test_present_conflict_for_decision(self):
        holiday = HolidayExtension(
            business_no="BIZ001",
            extension_days=3,
            conclusion="顺延3天，按日利率0.1%计算利息",
            reason="春节假期顺延",
            import_batch="BATCH_HOL_001",
        )
        tail_adj = TailAdjustment(
            business_no="BIZ001",
            adjustment_amount=500.0,
            calculation_rule="尾差调整500元",
            reason="系统尾差",
            import_batch="BATCH_TAIL_001",
        )
        self.repo.add_holiday_extension(holiday)
        self.repo.add_tail_adjustment(tail_adj)
        self.conflict_detector.detect_conflicts()

        decision = self.conflict_detector.present_conflict_for_decision("BIZ001")

        self.assertIsNotNone(decision)
        self.assertEqual(decision["business_no"], "BIZ001")
        self.assertEqual(len(decision["conflict_evidence"]), 2)
        self.assertEqual(len(decision["available_actions"]), 3)
        self.assertIn("warning", decision)
        self.assertIn("投研助理小周手动选择确认或驳回", decision["warning"])
        self.assertIn("系统不会自动采用节假日顺延说明结论", decision["warning"])

    def test_resolve_conflict_manual_decision(self):
        holiday = HolidayExtension(
            business_no="BIZ001",
            extension_days=3,
            conclusion="顺延3天，按日利率0.1%计算利息",
            reason="春节假期顺延",
        )
        tail_adj = TailAdjustment(
            business_no="BIZ001",
            adjustment_amount=500.0,
            calculation_rule="尾差调整500元",
            reason="系统尾差",
        )
        self.repo.add_holiday_extension(holiday)
        self.repo.add_tail_adjustment(tail_adj)
        self.conflict_detector.detect_conflicts()

        resolution = self.conflict_detector.resolve_conflict(
            business_no="BIZ001",
            action="confirm_tail",
            operator="投研助理小周",
            reason="尾差调整条更准确，与业务确认过",
        )

        self.assertIsNotNone(resolution)
        self.assertEqual(resolution.chosen_rule, "tail_adjustment")
        self.assertAlmostEqual(resolution.final_amount, 100500.0, places=2)
        self.assertEqual(resolution.resolution, DiscrepancyStatus.CONFIRMED)
        self.assertEqual(resolution.operator, "投研助理小周")

        records = self.repo.get_records_by_business_no("BIZ001")
        self.assertTrue(records[0].tail_adjustment_applied)
        self.assertFalse(records[0].holiday_extension_applied)

        audit_logs = self.repo.get_audit_logs_by_business_no("BIZ001")
        self.assertTrue(any(log.action == "冲突解决" for log in audit_logs))

    def test_no_conflict_when_amounts_match(self):
        record = FundMatchRecord(
            business_no="BIZ002",
            record_type=RecordType.COMBINED,
            expected_amount=100000.0,
            matched_amount=100000.0,
            status=MatchStatus.MATCHED,
        )
        self.repo.add_match_record(record)

        holiday = HolidayExtension(
            business_no="BIZ002",
            extension_days=5,
            conclusion="顺延5天",
            reason="五一假期",
        )
        tail_adj = TailAdjustment(
            business_no="BIZ002",
            adjustment_amount=500.0,
            calculation_rule="尾差调整500元",
            reason="系统尾差",
        )
        self.repo.add_holiday_extension(holiday)
        self.repo.add_tail_adjustment(tail_adj)

        conflicts = self.conflict_detector.detect_conflicts(["BIZ002"])

        self.assertEqual(len(conflicts), 0)


class TestSelfChecks(unittest.TestCase):
    def setUp(self):
        self.repo = MatchRepository()
        self.repo.clear_all()
        self.self_checker = SelfChecker(self.repo)

    def test_check_duplicate_invoice_import(self):
        inv1 = Invoice(
            invoice_id="INV001",
            invoice_no="FP20240001",
            invoice_date=date(2024, 1, 1),
            amount=10000.0,
            tax_amount=1300.0,
            total_amount=11300.0,
            seller="供应商A",
            buyer="采购方",
            business_no="BIZ001",
            import_batch="BATCH001",
        )
        inv2 = Invoice(
            invoice_id="INV002",
            invoice_no="FP20240001",
            invoice_date=date(2024, 1, 1),
            amount=10000.0,
            tax_amount=1300.0,
            total_amount=11300.0,
            seller="供应商A",
            buyer="采购方",
            business_no="BIZ001",
            import_batch="BATCH002",
        )
        self.repo.add_invoice(inv1)
        self.repo.add_invoice(inv2)

        results = self.self_checker.check_duplicate_imports()

        self.assertEqual(len(results), 1)
        self.assertFalse(results[0].passed)
        self.assertEqual(results[0].check_type, SelfCheckType.DUPLICATE_IMPORT)
        self.assertIn("FP20240001", results[0].message)
        self.assertEqual(results[0].details["duplicate_count"], 2)

    def test_check_split_records(self):
        principal = FundMatchRecord(
            business_no="BIZ_SPLIT_001",
            record_type=RecordType.PRINCIPAL,
            expected_amount=95000.0,
            matched_amount=95000.0,
            status=MatchStatus.PENDING_REVIEW,
        )
        fee = FundMatchRecord(
            business_no="BIZ_SPLIT_001",
            record_type=RecordType.FEE,
            expected_amount=5000.0,
            matched_amount=5000.0,
            status=MatchStatus.PENDING_REVIEW,
        )
        principal.related_record_id = fee.record_id
        fee.related_record_id = principal.record_id
        self.repo.add_match_record(principal)
        self.repo.add_match_record(fee)

        results = self.self_checker.check_split_records()

        self.assertEqual(len(results), 1)
        self.assertTrue(results[0].passed)
        self.assertEqual(results[0].business_no, "BIZ_SPLIT_001")
        self.assertEqual(results[0].details["record_count"], 2)
        self.assertTrue(results[0].details["has_principal"])
        self.assertTrue(results[0].details["has_fee"])
        self.assertAlmostEqual(results[0].details["principal_amount"], 95000.0, places=2)
        self.assertAlmostEqual(results[0].details["fee_amount"], 5000.0, places=2)
        self.assertTrue(results[0].details["requires_supervisor_review"])

    def test_check_recalculation_after_supplementary(self):
        record = FundMatchRecord(
            business_no="BIZ001",
            record_type=RecordType.COMBINED,
            expected_amount=100000.0,
            matched_amount=100000.0,
            status=MatchStatus.MATCHED,
        )
        self.repo.add_match_record(record)

        holiday = HolidayExtension(
            business_no="BIZ001",
            extension_days=3,
            conclusion="顺延3天",
            reason="春节假期",
        )
        self.repo.add_holiday_extension(holiday)

        results = self.self_checker.check_recalculation()

        self.assertEqual(len(results), 1)
        self.assertFalse(results[0].passed)
        self.assertEqual(results[0].business_no, "BIZ001")
        self.assertIn("补录", results[0].message)
        self.assertAlmostEqual(results[0].details["difference"], 300.0, places=2)
        self.assertIn("节假日顺延", results[0].details["supplementary_data"][0])

        self.repo.add_match_record(
            FundMatchRecord(
                business_no="BIZ003",
                record_type=RecordType.PRINCIPAL,
                expected_amount=50000.0,
                matched_amount=50000.0,
            )
        )
        self.repo.add_match_record(
            FundMatchRecord(
                business_no="BIZ003",
                record_type=RecordType.FEE,
                expected_amount=5000.0,
                matched_amount=5000.0,
                related_record_id="test",
            )
        )
        holiday2 = HolidayExtension(
            business_no="BIZ003",
            extension_days=3,
            conclusion="顺延3天",
            reason="春节假期",
        )
        self.repo.add_holiday_extension(holiday2)

        results2 = self.self_checker.check_recalculation()
        self.assertGreaterEqual(len(results2), 2)

    def test_check_export_consistency(self):
        record = FundMatchRecord(
            business_no="BIZ001",
            record_type=RecordType.COMBINED,
            expected_amount=100000.0,
            matched_amount=100000.0,
            status=MatchStatus.MATCHED,
        )
        self.repo.add_match_record(record)

        results = self.self_checker.check_export_consistency()

        self.assertEqual(len(results), 1)
        self.assertTrue(results[0].passed)
        self.assertIn("完全一致", results[0].message)

        export_data = self.repo.get_match_records_for_export()
        display_data = self.repo.get_match_records_for_display()
        api_data = self.repo.get_match_records_for_api()

        self.assertEqual(len(export_data), len(display_data))
        self.assertEqual(len(export_data), len(api_data))
        self.assertEqual(export_data[0]["matched_amount"], display_data[0]["matched_amount"])
        self.assertEqual(display_data[0]["matched_amount"], api_data[0]["matched_amount"])
        self.assertEqual(export_data[0]["status"], api_data[0]["status"])

    def test_split_record_data_consistency(self):
        principal = FundMatchRecord(
            business_no="BIZ_SPLIT_002",
            record_type=RecordType.PRINCIPAL,
            expected_amount=90000.0,
            matched_amount=90000.0,
            status=MatchStatus.PENDING_REVIEW,
        )
        fee = FundMatchRecord(
            business_no="BIZ_SPLIT_002",
            record_type=RecordType.FEE,
            expected_amount=10000.0,
            matched_amount=10000.0,
            status=MatchStatus.PENDING_REVIEW,
        )
        principal.related_record_id = fee.record_id
        fee.related_record_id = principal.record_id
        self.repo.add_match_record(principal)
        self.repo.add_match_record(fee)

        export_data = self.repo.get_match_records_for_export()
        display_data = self.repo.get_match_records_for_display()
        api_data = self.repo.get_match_records_for_api()

        self.assertEqual(len(export_data), 2)
        for i in range(2):
            self.assertTrue(export_data[i]["is_split_record"])
            self.assertIn("counterpart_type", export_data[i])
            self.assertIn("combined_amount", export_data[i])
            self.assertEqual(export_data[i]["is_split_record"], display_data[i]["is_split_record"])
            self.assertEqual(export_data[i]["is_split_record"], api_data[i]["is_split_record"])

        principal_export = next(r for r in export_data if r["record_type"] == "本金")
        self.assertEqual(principal_export["counterpart_type"], "手续费")
        self.assertAlmostEqual(principal_export["combined_amount"], 100000.0, places=2)


class TestAuditTrail(unittest.TestCase):
    def setUp(self):
        self.repo = MatchRepository()
        self.repo.clear_all()
        self.audit_service = AuditService(self.repo)
        self.matching_engine = MatchingEngine(self.repo, self.audit_service)

    def test_log_record_update(self):
        record = FundMatchRecord(
            business_no="BIZ001",
            record_type=RecordType.COMBINED,
            expected_amount=100000.0,
            matched_amount=100000.0,
            status=MatchStatus.PENDING,
        )
        self.repo.add_match_record(record)

        logs = self.audit_service.log_record_update(
            record=record,
            operator="投研助理小周",
            reason="修正匹配金额",
            changes={
                "matched_amount": (100000.0, 100500.0),
                "status": (MatchStatus.PENDING.value, MatchStatus.MATCHED.value),
            },
        )

        self.assertEqual(len(logs), 2)
        self.assertEqual(logs[0].operator, "投研助理小周")
        self.assertEqual(logs[0].action, "更新匹配记录")
        self.assertEqual(logs[0].field_changed, "matched_amount")
        self.assertAlmostEqual(logs[0].old_value, 100000.0, places=2)
        self.assertAlmostEqual(logs[0].new_value, 100500.0, places=2)
        self.assertEqual(logs[0].reason, "修正匹配金额")
        self.assertGreater(len(logs[0].affected_calculation_fields), 0)

    def test_get_impact_analysis(self):
        record = FundMatchRecord(
            business_no="BIZ001",
            record_type=RecordType.COMBINED,
            expected_amount=100000.0,
            matched_amount=100000.0,
            status=MatchStatus.PENDING,
        )
        self.repo.add_match_record(record)

        self.audit_service.log_record_update(
            record=record,
            operator="投研助理小周",
            reason="修正匹配金额",
            changes={"matched_amount": (100000.0, 100500.0)},
        )
        self.audit_service.log_manual_adjustment(
            business_no="BIZ001",
            operator="业务同事",
            field="expected_amount",
            old_value=100000.0,
            new_value=100300.0,
            reason="金额录入错误",
        )

        impact = self.audit_service.get_impact_analysis("BIZ001")

        self.assertEqual(impact["business_no"], "BIZ001")
        self.assertEqual(impact["total_changes"], 2)
        self.assertIn("投研助理小周", impact["unique_operators"])
        self.assertIn("业务同事", impact["unique_operators"])
        self.assertGreater(len(impact["affected_calculation_fields"]), 0)
        self.assertEqual(len(impact["change_timeline"]), 2)

    def test_get_review_summary(self):
        principal = FundMatchRecord(
            business_no="BIZ001",
            record_type=RecordType.PRINCIPAL,
            expected_amount=95000.0,
            matched_amount=95000.0,
            status=MatchStatus.PENDING_REVIEW,
        )
        fee = FundMatchRecord(
            business_no="BIZ001",
            record_type=RecordType.FEE,
            expected_amount=5000.0,
            matched_amount=5000.0,
            status=MatchStatus.PENDING_REVIEW,
        )
        principal.related_record_id = fee.record_id
        fee.related_record_id = principal.record_id
        self.repo.add_match_record(principal)
        self.repo.add_match_record(fee)

        self.audit_service.log_manual_adjustment(
            business_no="BIZ001",
            operator="投研助理小周",
            field="expected_amount",
            old_value=95000.0,
            new_value=95500.0,
            reason="本金金额调整",
        )

        summary = self.audit_service.get_review_summary("BIZ001")

        self.assertTrue(summary["requires_supervisor_review"])
        self.assertTrue(summary["has_split_records"])
        self.assertGreater(len(summary["review_warning"]), 0)
        self.assertTrue(any("结算主管复核" in w for w in summary["review_warning"]))
        self.assertTrue(any("人工调整" in w for w in summary["review_warning"]))
        self.assertIn("changes_by_field", summary)


class TestThreeStepWorkflow(unittest.TestCase):
    def setUp(self):
        self.repo = MatchRepository()
        self.repo.clear_all()
        self.workflow = WorkflowEngine(self.repo)
        self._setup_base_data()

    def _setup_base_data(self):
        record = FundMatchRecord(
            business_no="BIZ_WORK_001",
            record_type=RecordType.COMBINED,
            expected_amount=100000.0,
            matched_amount=100000.0,
            status=MatchStatus.PENDING,
        )
        self.repo.add_match_record(record)

    def test_full_workflow_three_steps(self):
        step1 = self.workflow.step_1_import_holiday_extension(
            business_no="BIZ_WORK_001",
            extension=HolidayExtension(
                business_no="BIZ_WORK_001",
                extension_days=3,
                original_due_date=date(2024, 2, 8),
                extended_due_date=date(2024, 2, 18),
                reason="春节假期顺延",
                conclusion="顺延10天，按日利率0.1%计息",
                import_batch="HOL_20240201",
                imported_by="业务同事",
            ),
            operator="投研助理小周",
        )

        self.assertIn("第一步", step1["workflow_step"])
        self.assertTrue(step1["data_consistency_verified"])
        self.assertIn("next_step", step1)
        self.assertEqual(step1["holiday_extension"]["extension_days"], 3)

        step2 = self.workflow.step_2_review_tail_adjustment(
            business_no="BIZ_WORK_001",
            adjustment=TailAdjustment(
                business_no="BIZ_WORK_001",
                adjustment_amount=300.0,
                adjustment_date=date(2024, 2, 18),
                reason="尾差调整",
                calculation_rule="顺延3天产生利息300元",
                import_batch="TAIL_20240205",
                imported_by="业务同事",
            ),
            operator="投研助理小周",
        )

        self.assertIn("第二步", step2["workflow_step"])
        self.assertFalse(step2["has_conflict"])
        self.assertTrue(step2["data_consistency_verified"])

        step3 = self.workflow.step_3_update_discrepancy_list(
            business_no="BIZ_WORK_001",
            operator="投研助理小周",
        )

        self.assertIn("流程完成", step3["workflow_step"])
        self.assertEqual(len(step3["final_records"]), 1)
        self.assertTrue(step3["data_consistency_verified"])

        self.assertEqual(
            step3["export_data"][0]["matched_amount"],
            step3["display_data"][0]["matched_amount"],
        )
        self.assertEqual(
            step3["display_data"][0]["matched_amount"],
            step3["api_data"][0]["matched_amount"],
        )

        review_summary = step3["review_summary"]
        self.assertIn("change_timeline", review_summary)
        self.assertGreater(len(review_summary["change_timeline"]), 0)

    def test_workflow_with_conflict(self):
        self.workflow.step_1_import_holiday_extension(
            business_no="BIZ_WORK_001",
            extension=HolidayExtension(
                business_no="BIZ_WORK_001",
                extension_days=5,
                reason="春节假期顺延",
                conclusion="顺延5天，按日利率0.1%计息",
                import_batch="HOL_20240201",
            ),
            operator="投研助理小周",
        )

        step2 = self.workflow.step_2_review_tail_adjustment(
            business_no="BIZ_WORK_001",
            adjustment=TailAdjustment(
                business_no="BIZ_WORK_001",
                adjustment_amount=300.0,
                reason="尾差调整",
                calculation_rule="尾差调整300元",
                import_batch="TAIL_20240205",
            ),
            operator="投研助理小周",
        )

        self.assertTrue(step2["has_conflict"])
        self.assertIsNotNone(step2["conflict_decision"])
        self.assertIn("投研助理小周手动选择确认或驳回", step2["warning"])
        self.assertIn("系统不会自动采用节假日顺延说明结论", step2["warning"])

        resolution = self.workflow.resolve_conflict(
            business_no="BIZ_WORK_001",
            action="confirm_tail",
            operator="投研助理小周",
            reason="尾差调整条有业务确认邮件，采用尾差结论",
        )

        self.assertEqual(resolution["resolution"]["chosen_rule"], "tail_adjustment")
        self.assertAlmostEqual(resolution["resolution"]["final_amount"], 100300.0, places=2)

        step3 = self.workflow.step_3_update_discrepancy_list(
            business_no="BIZ_WORK_001",
            operator="投研助理小周",
        )

        self.assertIn("流程完成", step3["workflow_step"])

    def test_workflow_with_split_records_supervisor_review(self):
        self.repo.clear_all()
        matching_engine = MatchingEngine(self.repo)
        matching_engine.create_split_records(
            business_no="BIZ_SPLIT_WORK",
            principal_amount=95000.0,
            fee_amount=5000.0,
            operator="业务同事",
        )

        self.workflow.step_1_import_holiday_extension(
            business_no="BIZ_SPLIT_WORK",
            extension=HolidayExtension(
                business_no="BIZ_SPLIT_WORK",
                extension_days=3,
                reason="春节假期顺延",
                conclusion="顺延3天",
                import_batch="HOL_001",
            ),
            operator="投研助理小周",
        )

        self.workflow.step_2_review_tail_adjustment(
            business_no="BIZ_SPLIT_WORK",
            adjustment=TailAdjustment(
                business_no="BIZ_SPLIT_WORK",
                adjustment_amount=300.0,
                reason="尾差调整",
                calculation_rule="尾差调整300元",
                import_batch="TAIL_001",
            ),
            operator="投研助理小周",
        )

        step3 = self.workflow.step_3_update_discrepancy_list(
            business_no="BIZ_SPLIT_WORK",
            operator="投研助理小周",
        )

        self.assertIn("第三步", step3["workflow_step"])
        self.assertTrue(step3["requires_supervisor_review"])
        self.assertIn("拆分行记录系统不会自动归为正常", step3["warning"])
        self.assertIn("结算主管复核", step3["required_action"])

        final_step = self.workflow.supervisor_review_split_records(
            business_no="BIZ_SPLIT_WORK",
            operator="结算主管老王",
            confirm=True,
            notes="本金95000元，手续费5000元，拆分正确",
        )

        self.assertIn("流程完成", final_step["workflow_step"])
        self.assertEqual(final_step["supervisor_decision"], "confirmed")
        self.assertEqual(final_step["supervisor_notes"], "本金95000元，手续费5000元，拆分正确")

        records = self.repo.get_records_by_business_no("BIZ_SPLIT_WORK")
        for r in records:
            self.assertEqual(r.status, MatchStatus.MATCHED)

        audit_logs = self.repo.get_audit_logs_by_business_no("BIZ_SPLIT_WORK")
        self.assertTrue(any(log.operator == "结算主管老王" for log in audit_logs))
        self.assertTrue(any(log.action == "结算主管复核完成" for log in audit_logs))

    def test_split_record_not_auto_marked_normal(self):
        matching_engine = MatchingEngine(self.repo)
        principal, fee = matching_engine.create_split_records(
            business_no="BIZ_SPLIT_005",
            principal_amount=90000.0,
            fee_amount=10000.0,
            operator="业务同事",
        )

        self.assertEqual(principal.status, MatchStatus.PENDING_REVIEW)
        self.assertEqual(fee.status, MatchStatus.PENDING_REVIEW)

        matching_engine.recalculate_matched_amounts(
            business_no="BIZ_SPLIT_005",
            operator="投研助理小周",
            reason="测试重算",
        )

        principal_after = self.repo.get_match_record(principal.record_id)
        fee_after = self.repo.get_match_record(fee.record_id)

        self.assertEqual(principal_after.status, MatchStatus.PENDING_REVIEW)
        self.assertEqual(fee_after.status, MatchStatus.PENDING_REVIEW)

        records = self.repo.get_all_match_records()
        for r in records:
            if r.business_no == "BIZ_SPLIT_005":
                self.assertNotEqual(r.status, MatchStatus.MATCHED)

        matching_engine.confirm_split_records(
            business_no="BIZ_SPLIT_005",
            operator="结算主管老王",
            confirm=True,
            notes="确认拆分正确",
        )

        principal_final = self.repo.get_match_record(principal.record_id)
        self.assertEqual(principal_final.status, MatchStatus.MATCHED)

    def test_all_data_sources_read_same_result(self):
        matching_engine = MatchingEngine(self.repo)
        matching_engine.create_split_records(
            business_no="BIZ_DATA_TEST",
            principal_amount=97000.0,
            fee_amount=3000.0,
            operator="业务同事",
        )

        export = self.repo.get_match_records_for_export()
        display = self.repo.get_match_records_for_display()
        api = self.repo.get_match_records_for_api()

        self.assertEqual(len(export), len(display))
        self.assertEqual(len(display), len(api))

        for i in range(len(export)):
            self.assertEqual(export[i]["business_no"], display[i]["business_no"])
            self.assertEqual(export[i]["record_type"], display[i]["record_type"])
            self.assertEqual(export[i]["expected_amount"], display[i]["expected_amount"])
            self.assertEqual(export[i]["matched_amount"], display[i]["matched_amount"])
            self.assertEqual(export[i]["status"], display[i]["status"])
            self.assertEqual(export[i]["is_split_record"], display[i]["is_split_record"])

            self.assertEqual(display[i]["business_no"], api[i]["business_no"])
            self.assertEqual(display[i]["record_type"], api[i]["record_type"])
            self.assertEqual(display[i]["expected_amount"], api[i]["expected_amount"])
            self.assertEqual(display[i]["matched_amount"], api[i]["matched_amount"])
            self.assertEqual(display[i]["status"], api[i]["status"])
            self.assertEqual(display[i]["is_split_record"], api[i]["is_split_record"])

            if export[i]["is_split_record"]:
                self.assertIn("counterpart_type", export[i])
                self.assertIn("counterpart_type", display[i])
                self.assertIn("counterpart_type", api[i])
                self.assertEqual(export[i]["counterpart_type"], display[i]["counterpart_type"])
                self.assertEqual(display[i]["counterpart_type"], api[i]["counterpart_type"])


if __name__ == "__main__":
    unittest.main()
