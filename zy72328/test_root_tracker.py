import unittest
import warnings
import copy

from root_tracker import NonlinearRootTracker
from models import SampleStatus, ImportSource, ConflictType, AntiExampleStatus
from errors import (
    DuplicateImportError, BoundaryValueWarning, ConflictDetectedError,
    InvalidDataError, StatusTransitionError
)
from test_data import TEST_SCENARIOS


class TestNonlinearRootTracker(unittest.TestCase):

    def setUp(self):
        self.tracker = NonlinearRootTracker()

    def test_calculate_root(self):
        self.assertEqual(self.tracker.calculate_root(4.0, 10.0), 2.0)
        self.assertEqual(self.tracker.calculate_root(9.0, 10.0), 3.0)
        self.assertEqual(self.tracker.calculate_root(16.0, 20.0), 4.0)
        self.assertIsNone(self.tracker.calculate_root(-1.0, 10.0))
        self.assertIsNone(self.tracker.calculate_root("invalid", 10.0))

    def test_normal_scenario(self):
        scenario = TEST_SCENARIOS["normal"]
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            imported = self.tracker.import_sample_list(scenario["sample_list"], "张老师")
        
        self.assertEqual(len(imported), 5)
        self.assertEqual(len(self.tracker.get_all_samples()), 5)
        self.assertEqual(len([s for s in imported if s.source == ImportSource.SAMPLE_LIST]), 5)
        
        for sample in imported:
            self.assertEqual(sample.original_equation_param, sample.equation_param)
            self.assertEqual(sample.original_threshold, sample.threshold)
            self.assertEqual(sample.status, SampleStatus.NORMAL)
            self.assertFalse(sample.is_boundary_case)
        
        updated = self.tracker.import_parameter_table(scenario["parameter_table"], "吴老师")
        self.assertEqual(len(updated), 5)
        
        for sample in updated:
            self.assertEqual(sample.source, ImportSource.PARAMETER_TABLE)
            self.assertEqual(sample.status, SampleStatus.NORMAL)
            self.assertIsNone(sample.proposed_equation_param)
        
        self.assertEqual(len(self.tracker.get_anti_examples()), scenario["expected_anti_examples"])
        self.assertEqual(len(self.tracker.get_conflicts()), scenario["expected_conflicts"])
        self.assertEqual(len(self.tracker.get_pending_review()), scenario["expected_pending_review"])
        
        self.assertEqual(len(self.tracker.get_history()), 10)

    def test_wrong_calibration_scenario(self):
        scenario = TEST_SCENARIOS["wrong_calibration"]
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            imported = self.tracker.import_sample_list(scenario["sample_list"], "张老师")
            
            boundary_warnings = [x for x in w if issubclass(x.category, BoundaryValueWarning)]
            self.assertEqual(len(boundary_warnings), 3)
        
        self.assertEqual(len(imported), 5)
        
        boundary_samples = [s for s in imported if s.is_boundary_case]
        self.assertEqual(len(boundary_samples), 3)
        
        for s in boundary_samples:
            self.assertEqual(s.status, SampleStatus.PENDING_REVIEW)
            self.assertEqual(s.next_handler, "任课老师")
        
        self.assertEqual(len(self.tracker.get_pending_review()), 3)
        
        conflict_exceptions = 0
        for i, param_data in enumerate(scenario["parameter_table"]):
            try:
                self.tracker.import_parameter_table([param_data], "吴老师")
            except ConflictDetectedError as e:
                conflict_exceptions += 1
                self.assertIn("存在冲突", str(e))
                self.assertIn("抽样名单显示", str(e))
                self.assertIn("参数调试表显示", str(e))
                self.assertIn("吴老师", str(e))
                
                sample = self.tracker.get_sample(param_data["sample_id"])
                self.assertEqual(sample.proposed_equation_param, param_data["equation_param"])
                self.assertEqual(sample.proposed_threshold, param_data["threshold"])
                self.assertEqual(sample.next_handler, "吴老师（处理冲突）")
                self.assertIn(param_data["sample_id"], self.tracker.get_unresolved_samples())
        
        self.assertEqual(conflict_exceptions, 2)
        
        conflicts = self.tracker.get_conflicts()
        self.assertEqual(len(conflicts), scenario["expected_conflicts"])
        
        conflict_types = [c.conflict_type for c in conflicts]
        self.assertIn(ConflictType.THRESHOLD_MISMATCH, conflict_types)
        self.assertIn(ConflictType.DATA_MISMATCH, conflict_types)
        
        self.assertEqual(len(self.tracker.get_anti_examples()), scenario["expected_anti_examples"])
        open_antis = self.tracker.get_anti_examples(status=AntiExampleStatus.OPEN)
        self.assertEqual(len(open_antis), scenario["expected_anti_examples"])

    def test_supplement_scenario(self):
        scenario = TEST_SCENARIOS["supplement"]
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            imported = self.tracker.import_sample_list(scenario["sample_list"], "张老师")
        
        self.assertEqual(len(self.tracker.get_pending_review()), 1)
        self.assertEqual(imported[0].status, SampleStatus.PENDING_REVIEW)
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.tracker.import_parameter_table(scenario["parameter_table"], "吴老师")
        
        history_count_before = len(self.tracker.get_history())
        
        for supplement in scenario["supplement_data"]:
            sample_id = supplement["sample_id"]
            old_root = self.tracker.get_sample(sample_id).root_value
            
            self.tracker.supplement_sample(sample_id, supplement, "吴老师")
            
            recalculated = self.tracker.recalculate_after_supplement("吴老师")
            
            new_root = self.tracker.get_sample(sample_id).root_value
            
            if sample_id == "P001":
                self.assertEqual(self.tracker.get_sample(sample_id).threshold, 105.0)
                self.assertFalse(self.tracker.get_sample(sample_id).is_boundary_case)
            
            if sample_id == "P002":
                self.assertNotEqual(old_root, new_root)
                self.assertAlmostEqual(new_root, 11.18034, places=5)
        
        self.assertEqual(len(self.tracker.get_history()), history_count_before + 4)
        
        self.assertEqual(len(self.tracker.get_anti_examples()), scenario["expected_anti_examples"])

    def test_duplicate_import_error(self):
        data = [{"sample_id": "D001", "equation_param": 4.0, "threshold": 10.0}]
        
        self.tracker.import_sample_list(data, "张老师")
        
        with self.assertRaises(DuplicateImportError) as context:
            self.tracker.import_sample_list(data, "李老师")
        
        self.assertIn("D001", str(context.exception))
        self.assertIn("已存在", str(context.exception))
        self.assertIn("重复导入", str(context.exception))
        self.assertIn("抽样名单", str(context.exception))

    def test_invalid_data_error(self):
        invalid_data = [{"sample_id": "", "equation_param": 4.0, "threshold": 10.0}]
        
        with self.assertRaises(InvalidDataError) as context:
            self.tracker.import_sample_list(invalid_data, "张老师")
        
        self.assertIn("样本编号", str(context.exception))
        self.assertIn("不能为空", str(context.exception))

        invalid_param = [{"sample_id": "V001", "equation_param": "not_a_number", "threshold": 10.0}]
        
        with self.assertRaises(InvalidDataError) as context:
            self.tracker.import_sample_list(invalid_param, "张老师")
        
        self.assertIn("方程参数", str(context.exception))
        self.assertIn("必须是数字", str(context.exception))

    def test_boundary_value_warning(self):
        data = [{"sample_id": "B001", "equation_param": 10.0, "threshold": 10.0}]
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.tracker.import_sample_list(data, "张老师")
            
            self.assertEqual(len(w), 1)
            self.assertTrue(issubclass(w[0].category, BoundaryValueWarning))
            self.assertIn("B001", str(w[0].message))
            self.assertIn("刚好等于阈值", str(w[0].message))
            self.assertIn("待任课老师复核", str(w[0].message))
        
        sample = self.tracker.get_sample("B001")
        self.assertTrue(sample.is_boundary_case)
        self.assertEqual(sample.status, SampleStatus.PENDING_REVIEW)
        self.assertEqual(sample.next_handler, "任课老师")
        self.assertIn("B001", self.tracker.get_pending_review())
        self.assertEqual(sample.original_is_boundary_case, True)

    def test_conflict_resolution_syncs_values_and_original_snapshot(self):
        sample_list = [{"sample_id": "C001", "equation_param": 10.0, "threshold": 10.0}]
        param_table = [{"sample_id": "C001", "equation_param": 12.0, "threshold": 15.0, "notes": "调试表修正"}]
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            self.tracker.import_sample_list(sample_list, "张老师")
        
        sample_before = self.tracker.get_sample("C001")
        self.assertEqual(sample_before.equation_param, 10.0)
        self.assertEqual(sample_before.original_equation_param, 10.0)
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            try:
                self.tracker.import_parameter_table(param_table, "吴老师")
            except ConflictDetectedError:
                pass
        
        sample_mid = self.tracker.get_sample("C001")
        self.assertEqual(sample_mid.proposed_equation_param, 12.0)
        self.assertEqual(sample_mid.proposed_threshold, 15.0)
        self.assertEqual(sample_mid.equation_param, 10.0)
        
        with self.assertRaises(PermissionError):
            self.tracker.resolve_conflict("C001", True, "张老师")
        
        conflicts_resolved = self.tracker.resolve_conflict(
            "C001", True, "吴老师", reason="参数调试表有纸质签字，可信度更高"
        )
        
        self.assertIsInstance(conflicts_resolved, list)
        self.assertEqual(len(conflicts_resolved), 3)
        for c in conflicts_resolved:
            self.assertTrue(c.resolved)
            self.assertIn("确认", c.resolution)
            self.assertIn("参数调试表为准", c.resolution)
            self.assertEqual(c.resolved_by, "吴老师")
            self.assertIsNotNone(c.resolved_time)
        
        sample = self.tracker.get_sample("C001")
        self.assertEqual(sample.equation_param, 12.0)
        self.assertEqual(sample.threshold, 15.0)
        self.assertAlmostEqual(sample.root_value, 3.464102, places=5)
        self.assertFalse(sample.is_boundary_case)
        self.assertEqual(sample.status, SampleStatus.CONFIRMED)
        self.assertEqual(sample.reviewer, "吴老师")
        self.assertEqual(sample.source, ImportSource.PARAMETER_TABLE)
        
        self.assertEqual(sample.original_equation_param, 10.0)
        self.assertEqual(sample.original_threshold, 10.0)
        self.assertIsNone(sample.proposed_equation_param)
        self.assertIn("参数调试表有纸质签字", sample.resolution_reason)
        self.assertIn("原始:参数=10.0", sample.notes)
        self.assertIn("改为:参数=12.0", sample.notes)
        self.assertIsNone(sample.next_handler)
        
        self.assertNotIn("C001", self.tracker.get_unresolved_samples())
        
        resolved_antis = self.tracker.get_anti_examples(status=AntiExampleStatus.RESOLVED)
        self.assertGreaterEqual(len(resolved_antis), 1)
        for ae in resolved_antis:
            self.assertEqual(ae.resolved_by, "吴老师")
            self.assertIsNotNone(ae.resolution_note)

    def test_conflict_resolution_confirm_still_boundary_goes_to_teacher(self):
        sample_list = [{"sample_id": "C002", "equation_param": 8.0, "threshold": 10.0}]
        param_table = [{"sample_id": "C002", "equation_param": 10.0, "threshold": 10.0}]
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            self.tracker.import_sample_list(sample_list, "张老师")
        
        sample_before = self.tracker.get_sample("C002")
        self.assertFalse(sample_before.is_boundary_case)
        self.assertEqual(sample_before.status, SampleStatus.NORMAL)
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            try:
                self.tracker.import_parameter_table(param_table, "吴老师")
            except ConflictDetectedError:
                pass
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            self.tracker.resolve_conflict("C002", True, "吴老师", reason="重新核实原始记录")
            boundary_warnings = [x for x in w if issubclass(x.category, BoundaryValueWarning)]
            self.assertGreaterEqual(len(boundary_warnings), 0)
        
        sample = self.tracker.get_sample("C002")
        self.assertEqual(sample.equation_param, 10.0)
        self.assertEqual(sample.threshold, 10.0)
        self.assertTrue(sample.is_boundary_case)
        
        self.assertNotEqual(sample.status, SampleStatus.CONFIRMED)
        self.assertEqual(sample.status, SampleStatus.PENDING_REVIEW)
        self.assertEqual(sample.next_handler, "任课老师")
        self.assertIn("C002", self.tracker.get_pending_review())
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            reviewed = self.tracker.teacher_review_boundary(
                "C002", True, "王老师", review_reason="人工复核后参数正确"
            )
        
        self.assertEqual(reviewed.status, SampleStatus.NORMAL)
        self.assertIn("王老师", reviewed.notes)
        self.assertIn("人工复核后参数正确", reviewed.notes)

    def test_conflict_resolution_rejected_keeps_original(self):
        sample_list = [{"sample_id": "C003", "equation_param": 10.0, "threshold": 15.0}]
        param_table = [{"sample_id": "C003", "equation_param": 10.0, "threshold": 20.0}]
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            self.tracker.import_sample_list(sample_list, "张老师")
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            try:
                self.tracker.import_parameter_table(param_table, "吴老师")
            except ConflictDetectedError:
                pass
        
        conflicts = self.tracker.resolve_conflict(
            "C003", False, "吴老师", reason="抽样名单有教研主任签字"
        )
        self.assertTrue(conflicts[0].resolved)
        self.assertIn("驳回", conflicts[0].resolution)
        self.assertIn("抽样名单为准", conflicts[0].resolution)
        
        sample = self.tracker.get_sample("C003")
        self.assertEqual(sample.equation_param, 10.0)
        self.assertEqual(sample.threshold, 15.0)
        self.assertEqual(sample.status, SampleStatus.REJECTED)
        self.assertIn("教研主任签字", sample.resolution_reason)
        self.assertIn("保留原始值", sample.notes)
        self.assertIn("驳回提案值", sample.notes)

    def test_teacher_review_boundary(self):
        data = [{"sample_id": "R001", "equation_param": 10.0, "threshold": 10.0}]
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            self.tracker.import_sample_list(data, "张老师")
        
        sample = self.tracker.get_sample("R001")
        self.assertEqual(sample.status, SampleStatus.PENDING_REVIEW)
        
        normal_sample = [{"sample_id": "R002", "equation_param": 5.0, "threshold": 10.0}]
        self.tracker.import_sample_list(normal_sample, "张老师")
        
        with self.assertRaises(StatusTransitionError) as context:
            self.tracker.teacher_review_boundary("R002", True, "李老师")
        
        self.assertIn("不能从", str(context.exception))
        self.assertIn("直接改为", str(context.exception))
        self.assertIn("业务流程", str(context.exception))
        
        reviewed = self.tracker.teacher_review_boundary(
            "R001", True, "李老师", review_reason="实际工况验证无误"
        )
        self.assertEqual(reviewed.status, SampleStatus.NORMAL)
        self.assertEqual(reviewed.reviewer, "李老师")
        self.assertIn("李老师", reviewed.notes)
        self.assertIn("复核确认正常", reviewed.notes)
        self.assertIn("实际工况验证无误", reviewed.resolution_reason)
        self.assertNotIn("R001", self.tracker.get_pending_review())
        self.assertIsNone(reviewed.next_handler)
        
        resolved_antis = self.tracker.get_anti_examples(status=AntiExampleStatus.RESOLVED)
        self.assertEqual(len(resolved_antis), 1)
        self.assertEqual(resolved_antis[0].resolved_by, "李老师")

    def test_self_check_all_passed(self):
        scenario = TEST_SCENARIOS["normal"]
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            self.tracker.import_sample_list(scenario["sample_list"], "张老师")
            self.tracker.import_parameter_table(scenario["parameter_table"], "吴老师")
        
        results = self.tracker.run_self_check()
        
        self.assertEqual(len(results), 4)
        
        check_names = [r.check_name for r in results]
        self.assertIn("重复导入检查", check_names)
        self.assertIn("边界值检查", check_names)
        self.assertIn("补录后重算检查", check_names)
        self.assertIn("导出一致性检查", check_names)
        
        for result in results:
            self.assertTrue(result.passed, f"{result.check_name} should pass: {result.message}")

    def test_self_check_boundary_failed(self):
        data = [{"sample_id": "F001", "equation_param": 10.0, "threshold": 10.0}]
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            self.tracker.import_sample_list(data, "张老师")
        
        sample = self.tracker.get_sample("F001")
        sample.status = SampleStatus.NORMAL
        
        results = self.tracker.run_self_check()
        
        boundary_check = [r for r in results if r.check_name == "边界值检查"][0]
        self.assertFalse(boundary_check.passed)
        self.assertIn("边界值样本状态不正确", boundary_check.message)
        self.assertIn("留给任课老师复核或吴老师确认", boundary_check.message)

    def test_self_check_recalc_failed(self):
        data = [{"sample_id": "F002", "equation_param": 4.0, "threshold": 10.0}]
        
        self.tracker.import_sample_list(data, "张老师")
        
        sample = self.tracker.get_sample("F002")
        sample.root_value = 999.0
        
        results = self.tracker.run_self_check()
        
        recalc_check = [r for r in results if r.check_name == "补录后重算检查"][0]
        self.assertFalse(recalc_check.passed)
        self.assertIn("根值与计算值不一致", recalc_check.message)

    def test_export_consistency(self):
        scenario = TEST_SCENARIOS["normal"]
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            self.tracker.import_sample_list(scenario["sample_list"], "张老师")
        
        exported = self.tracker.export_data()
        self.assertEqual(len(exported), 5)
        
        original = self.tracker.get_all_samples()
        for i, exp in enumerate(exported):
            orig = original[i]
            self.assertEqual(exp["sample_id"], orig.sample_id)
            self.assertAlmostEqual(float(exp["equation_param"]), orig.equation_param)
            self.assertAlmostEqual(float(exp["threshold"]), orig.threshold)
            self.assertAlmostEqual(float(exp["root_value"]), orig.root_value)
            self.assertEqual(exp["original_equation_param"], orig.original_equation_param)
            self.assertEqual(exp["original_threshold"], orig.original_threshold)

    def test_export_report_contains_all_information(self):
        sample_list = [{"sample_id": "EXP01", "equation_param": 9.0, "threshold": 9.0}]
        param_table = [{"sample_id": "EXP01", "equation_param": 9.0, "threshold": 10.0, "notes": "修正阈值"}]
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            self.tracker.import_sample_list(sample_list, "张老师")
            try:
                self.tracker.import_parameter_table(param_table, "吴老师")
            except ConflictDetectedError:
                pass
            self.tracker.resolve_conflict("EXP01", True, "吴老师", reason="测试报告")
        
        report = self.tracker.export_report(include_self_check_in_summary=True)
        self.assertIn("generated_at", report)
        self.assertIn("summary", report)
        self.assertIn("samples", report)
        self.assertIn("conflicts", report)
        self.assertIn("anti_examples", report)
        self.assertIn("history", report)
        self.assertIn("self_check_results", report)
        
        summary = report["summary"]
        self.assertEqual(summary["total_samples"], 1)
        self.assertEqual(summary["unresolved_conflicts"], 0)
        self.assertIn("anti_examples_resolved", summary)
        self.assertIn("self_check_passed", summary)
        
        sample_report = report["samples"][0]
        self.assertEqual(sample_report["sample_id"], "EXP01")
        self.assertEqual(sample_report["original_equation_param"], 9.0)
        self.assertIn("resolution_reason", sample_report)
        self.assertIn("next_handler", sample_report)

    def test_history_records_full_old_to_new_transition(self):
        sample_list = [{"sample_id": "H001", "equation_param": 4.0, "threshold": 10.0}]
        param_table = [{"sample_id": "H001", "equation_param": 16.0, "threshold": 20.0, "notes": "改"}]
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            self.tracker.import_sample_list(sample_list, "张老师")
            try:
                self.tracker.import_parameter_table(param_table, "吴老师")
            except ConflictDetectedError:
                pass
            self.tracker.resolve_conflict("H001", True, "吴老师")
        
        history = self.tracker.get_history()
        conflict_ops = [h for h in history if "处理冲突" in h.operation]
        self.assertGreaterEqual(len(conflict_ops), 1)
        
        details = conflict_ops[0].details
        self.assertIn("old_equation_param", details)
        self.assertIn("new_equation_param", details)
        self.assertIn("old_threshold", details)
        self.assertIn("new_threshold", details)
        self.assertIn("old_status", details)
        self.assertIn("new_status", details)
        self.assertIn("old_next_handler", details)
        self.assertIn("new_next_handler", details)
        self.assertIn("conflicts_resolved_count", details)
        
        self.assertEqual(details["old_equation_param"], 4.0)
        self.assertEqual(details["new_equation_param"], 16.0)

    def test_history_and_anti_examples_consistent_after_resolution(self):
        scenario = TEST_SCENARIOS["wrong_calibration"]
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            self.tracker.import_sample_list(scenario["sample_list"], "张老师")
            
            for param_data in scenario["parameter_table"]:
                try:
                    self.tracker.import_parameter_table([param_data], "吴老师")
                except ConflictDetectedError:
                    pass
        
        for sample_id in list(self.tracker.get_unresolved_samples()):
            self.tracker.resolve_conflict(sample_id, True, "吴老师")
        
        history = self.tracker.get_history()
        anti_examples = self.tracker.get_anti_examples()
        
        history_sample_ids = set()
        for h in history:
            if "sample_id" in h.details:
                history_sample_ids.add(h.details["sample_id"])
        
        anti_sample_ids = set(ae.sample_id for ae in anti_examples)
        
        self.assertTrue(anti_sample_ids.issubset(history_sample_ids),
                        "反例列表中的样本应该都能在历史记录中找到")

        all_conflicts_resolved = all(c.resolved for c in self.tracker.get_conflicts())
        self.assertTrue(all_conflicts_resolved, "吴老师处理后，所有冲突证据都应标记为已解决")
        
        self.assertEqual(len(self.tracker.get_unresolved_samples()), 0,
                         "吴老师处理后，unresolved_samples 应为空")

    def test_recalculate_after_supplement(self):
        data = [{"sample_id": "REC001", "equation_param": 16.0, "threshold": 20.0}]
        
        self.tracker.import_sample_list(data, "张老师")
        
        original_root = self.tracker.get_sample("REC001").root_value
        self.assertEqual(original_root, 4.0)
        
        self.tracker.supplement_sample("REC001", {"equation_param": 25.0, "threshold": 30.0}, "吴老师")
        
        recalculated = self.tracker.recalculate_after_supplement("吴老师")
        
        self.assertEqual(len(recalculated), 1)
        self.assertEqual(recalculated[0].root_value, 5.0)
        self.assertEqual(recalculated[0].sample_id, "REC001")

    def test_boundary_not_auto_normal(self):
        data = [{"sample_id": "SAFE001", "equation_param": 10.0, "threshold": 10.0}]
        
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            self.tracker.import_sample_list(data, "张老师")
        
        sample = self.tracker.get_sample("SAFE001")
        self.assertNotEqual(sample.status, SampleStatus.NORMAL)
        self.assertEqual(sample.status, SampleStatus.PENDING_REVIEW)
        
        param_data = [{"sample_id": "SAFE001", "equation_param": 10.0, "threshold": 10.0, "notes": "核对无误"}]
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            try:
                self.tracker.import_parameter_table(param_data, "吴老师")
            except ConflictDetectedError:
                pass
        
        sample_after = self.tracker.get_sample("SAFE001")
        self.assertNotEqual(sample_after.status, SampleStatus.NORMAL)
        self.assertEqual(sample_after.status, SampleStatus.PENDING_REVIEW)
        self.assertEqual(sample_after.next_handler, "任课老师")
        
        self.assertIn("SAFE001", self.tracker.get_pending_review())

    def test_three_step_workflow(self):
        print("\n" + "=" * 60)
        print("【三步核心流程演示】")
        print("=" * 60)
        
        sample_data = [
            {"sample_id": "FLOW001", "equation_param": 25.0, "threshold": 30.0},
            {"sample_id": "FLOW002", "equation_param": 30.0, "threshold": 30.0},
        ]
        
        print("\n📋 第一步：导入抽样名单（张老师）")
        print("-" * 40)
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            imported = self.tracker.import_sample_list(sample_data, "张老师")
            
            for warning in w:
                print(f"  ⚠️  {warning.message}")
        
        for sample in imported:
            self.assertIsNotNone(sample.original_equation_param)
            print(f"  • 样本【{sample.sample_id}】: 参数={sample.equation_param}, "
                  f"阈值={sample.threshold}, 根={sample.root_value}, 状态={sample.status.value}, "
                  f"原始快照={sample.original_equation_param}/{sample.original_threshold}")
        
        pending = self.tracker.get_pending_review()
        print(f"\n  待复核列表: {pending}")
        self.assertIn("FLOW002", pending)
        
        print("\n🔍 第二步：吴老师补看参数调试表")
        print("-" * 40)
        
        param_data = [
            {"sample_id": "FLOW001", "equation_param": 25.0, "threshold": 30.0, "notes": "参数核对无误"},
            {"sample_id": "FLOW002", "equation_param": 30.0, "threshold": 30.0, "notes": "边界值，需任课老师复核"},
        ]
        
        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            try:
                updated = self.tracker.import_parameter_table(param_data, "吴老师")
                for sample in updated:
                    print(f"  • 样本【{sample.sample_id}】: 来源={sample.source.value}, "
                          f"状态={sample.status.value}, 备注={sample.notes}")
            except ConflictDetectedError as e:
                print(f"  ❌ {e}")
        
        print("\n📝 第三步：反例列表更新")
        print("-" * 40)
        
        anti_examples = self.tracker.get_anti_examples()
        print(f"  反例数量: {len(anti_examples)}")
        for ae in anti_examples:
            print(f"  • 【{ae.sample_id}】{ae.description}")
            print(f"    根本原因: {ae.root_cause}")
            print(f"    当前状态: {ae.status.value}")
        
        self.assertEqual(len(anti_examples), 1)
        self.assertEqual(anti_examples[0].status, AntiExampleStatus.OPEN)
        
        print("\n👨‍🏫 边界值处理：交给任课老师复核")
        print("-" * 40)
        
        if "FLOW002" in pending:
            print(f"  样本【FLOW002】当前状态: {self.tracker.get_sample('FLOW002').status.value}")
            print(f"  👉 不急着归正常，留给任课王老师复核...")
            
            reviewed = self.tracker.teacher_review_boundary("FLOW002", True, "王老师")
            print(f"  ✅ 任课老师复核完成，状态更新为: {reviewed.status.value}")
            print(f"  ✅ 原始值快照保留: {reviewed.original_equation_param}/{reviewed.original_threshold}")
            print(f"  ✅ 处理原因已记录: 人工核对后认为属于正常范围")
            print(f"  ✅ 反例状态同步解决: {self.tracker.get_anti_examples()[0].status.value}")
        
        print("\n📜 历史记录（应包含old→new完整快照）")
        print("-" * 40)
        for i, record in enumerate(self.tracker.get_history(), 1):
            print(f"  {i}. [{record.timestamp.strftime('%H:%M:%S')}] {record.operator} - {record.operation}")
            det = record.details
            if "old_equation_param" in det:
                print(f"     参数变更: {det['old_equation_param']} → {det['new_equation_param']}")
                print(f"     状态变更: {det.get('old_status', '')} → {det.get('new_status', '')}")
        
        self.assertEqual(len(self.tracker.get_history()), 5)
        
        print("\n✅ 自检结果 + 报告摘要")
        print("-" * 40)
        results = self.tracker.run_self_check()
        report = self.tracker.export_report(include_self_check_in_summary=True)
        for result in results:
            status = "✅ 通过" if result.passed else "❌ 未通过"
            print(f"  {status} - {result.check_name}: {result.message}")
        
        print(f"\n  📊 报告摘要: 样本={report['summary']['total_samples']}, "
              f"边界值={report['summary']['boundary_cases']}, "
              f"已解决反例={report['summary']['anti_examples_resolved']}, "
              f"自检通过={report['summary']['self_check_passed']}")
        
        self.assertGreaterEqual(report["summary"]["anti_examples_resolved"], 1)
        
        print("\n" + "=" * 60)
        print("【三步核心流程演示结束】")
        print("=" * 60 + "\n")
        
        self.assertEqual(len(imported), 2)
        self.assertEqual(len(anti_examples), 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
