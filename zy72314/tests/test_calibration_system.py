"""测试分位数薪酬校准系统"""

import os
import sys
import unittest
import tempfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from quantile_calibration.main import QuantileCalibrationSystem
from quantile_calibration.models import BoundaryType, ProcessingStatus


class TestQuantileCalibrationSystem(unittest.TestCase):
    """测试分位数薪酬校准系统"""

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.test_dir, "test_calibration.db")
        self.system = QuantileCalibrationSystem(self.db_path)
        self.data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
        self.test_file_v1 = os.path.join(self.data_dir, "test_rating_weights_v1.csv")
        self.test_file_v1_edited = os.path.join(self.data_dir, "test_rating_weights_v1_edited.csv")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_step1_import_rating_table(self):
        """测试 Step 1: 导入评分权重表"""
        result = self.system.step1_import(self.test_file_v1, "alan_ops")

        self.assertEqual(result["step"], 1)
        self.assertTrue(result["completed"])
        self.assertEqual(result["next_step"], 2)
        self.assertIsNotNone(result["batch_id"])

        boundary_summary = result["boundary_detection_summary"]
        self.assertIn("negative_treated_as_missing", boundary_summary)
        self.assertIn("negative_value", boundary_summary)
        self.assertIn("missing_value", boundary_summary)
        self.assertIn("normal", boundary_summary)

        self.assertIn("action_required", result)
        self.assertIn("未自动归正常", result["note"])

    def test_boundary_detection_negative_treated_as_missing(self):
        """测试边界检测：负数被旧表当成缺失的情况"""
        step1 = self.system.step1_import(self.test_file_v1, "alan_ops")
        batch_id = step1["batch_id"]

        records = self.system.db.get_records_by_batch(batch_id)

        negative_as_missing = [
            r for r in records
            if r.boundary_type == BoundaryType.NEGATIVE_TREATED_AS_MISSING
        ]
        negative_value = [
            r for r in records
            if r.boundary_type == BoundaryType.NEGATIVE_VALUE
        ]
        missing_value = [
            r for r in records
            if r.boundary_type == BoundaryType.MISSING_VALUE
        ]

        self.assertGreater(len(negative_as_missing), 0,
                          "应该检测到负数被旧表当成缺失的记录")
        self.assertGreater(len(negative_value), 0,
                          "应该检测到负数值记录")
        self.assertGreater(len(missing_value), 0,
                          "应该检测到缺失值记录")

        for r in negative_as_missing:
            self.assertEqual(r.status, ProcessingStatus.PENDING_REVIEW,
                           "负数被旧表当成缺失的记录应该标记为待复核")

    def test_step2_review_old_formula_screenshot(self):
        """测试 Step 2: 运营规划阿岚补看旧公式截图"""
        step1 = self.system.step1_import(self.test_file_v1, "alan_ops")
        batch_id = step1["batch_id"]

        step2 = self.system.step2_review_formula(
            batch_id=batch_id,
            reviewed_by="alan_ops",
            review_note="对照旧公式截图，确认高级产品经理P10原来是-500，被旧表误标为缺失",
            screenshot_reference="旧公式截图_2024_v3.png"
        )

        self.assertEqual(step2["step"], 2)
        self.assertTrue(step2["completed"])
        self.assertEqual(step2["next_step"], 3)
        self.assertIn("records_for_review", step2)
        self.assertGreater(len(step2["records_for_review"]), 0)

    def test_step3_update_boundary_report(self):
        """测试 Step 3: 边界样本报告更新"""
        step1 = self.system.step1_import(self.test_file_v1, "alan_ops")
        batch_id = step1["batch_id"]

        step2 = self.system.step2_review_formula(
            batch_id=batch_id,
            reviewed_by="alan_ops",
            review_note="对照旧公式截图完成复核",
            screenshot_reference="旧公式截图_2024_v3.png"
        )

        step3 = self.system.step3_boundary_report(
            batch_id=batch_id,
            operator="alan_ops",
            ta_assignee="ta_xiaoming"
        )

        self.assertEqual(step3["step"], 3)
        self.assertTrue(step3["completed"])
        self.assertIsNone(step3["next_step"])
        self.assertIsNotNone(step3["report_id"])
        self.assertGreater(len(step3["review_tasks_created"]), 0)

        self.assertIn("负数被旧表当成缺失的", step3["note"])
        self.assertIn("留待学生助教复核", step3["note"])
        self.assertIn("未自动归正常", step3["note"])

    def test_ta_review_negative_as_missing(self):
        """测试学生助教复核 NEGATIVE_TREATED_AS_MISSING"""
        workflow = self.system.run_complete_workflow(
            file_path=self.test_file_v1,
            import_operator="alan_ops",
            formula_reviewer="alan_ops",
            formula_review_note="已对照旧公式截图",
            screenshot_reference="旧公式截图_2024_v3.png",
            ta_assignee="ta_xiaoming"
        )

        batch_id = workflow["step1"]["batch_id"]
        records = self.system.db.get_records_by_batch(batch_id)

        negative_as_missing = [
            r for r in records
            if r.boundary_type == BoundaryType.NEGATIVE_TREATED_AS_MISSING
        ]
        self.assertGreater(len(negative_as_missing), 0)

        record = negative_as_missing[0]
        pending_tasks = self.system.get_pending_review_tasks("ta_xiaoming")
        self.assertGreater(len(pending_tasks["tasks"]), 0)

        task = pending_tasks["tasks"][0]
        result = self.system.ta_review_record(
            task_id=task["task_id"],
            record_id=record.id,
            review_result="经复核，P10确实是-500，旧表将负数当成缺失处理",
            correction_decision="restore_negative",
            corrected_values={"weight_p10": -500},
            ta_name="xiaoming"
        )

        self.assertTrue(result["evidence_traced"])
        self.assertEqual(result["ta_name"], "xiaoming")
        self.assertIn("version_history_diff", result)
        self.assertIn("所有改动已留痕", result["note"])

    def test_get_evidence_for_ta_query(self):
        """测试学生助教追问时能回到证据"""
        step1 = self.system.step1_import(self.test_file_v1, "alan_ops")
        batch_id = step1["batch_id"]
        records = self.system.db.get_records_by_batch(batch_id)
        record = records[0]

        evidence = self.system.get_evidence(record.id)

        self.assertIn("original_row_number", evidence)
        self.assertIn("raw_data", evidence)
        self.assertIn("full_history", evidence)
        self.assertIn("version_diffs", evidence)
        self.assertIn("can_rollback", evidence)
        self.assertEqual(evidence["original_row_number"], record.original_row_number)
        self.assertIn("原始行号和历史快照均已保存", evidence["note"])

    def test_duplicate_import_no_duplicate_count(self):
        """测试重复导入不去重，不翻倍数量"""
        step1_first = self.system.step1_import(self.test_file_v1, "alan_ops")
        batch_id_first = step1_first["batch_id"]
        records_first = self.system.db.get_records_by_batch(batch_id_first)
        count_first = len(records_first)

        step1_second = self.system.step1_import(self.test_file_v1, "alan_ops")

        self.assertTrue(step1_second["import_result"]["is_duplicate"])
        self.assertEqual(step1_second["import_result"]["action"], "deduplicated_import")
        self.assertEqual(step1_second["import_result"]["new_count"], 0)
        self.assertEqual(step1_second["import_result"]["original_count"], count_first)

        records_second = self.system.db.get_records_by_batch(batch_id_first)
        count_second = len(records_second)
        self.assertEqual(count_first, count_second,
                        "重复导入不应增加记录数量")

    def test_reimport_with_only_remark_change(self):
        """测试只改一条备注时，历史里能看出改前改后差别"""
        step1 = self.system.step1_import(self.test_file_v1, "alan_ops")
        batch_id = step1["batch_id"]
        records = self.system.db.get_records_by_batch(batch_id)
        first_record = records[0]
        old_remark = first_record.remark

        self.system.manual_edit(
            record_id=first_record.id,
            updates={"remark": old_remark + "-已复核"},
            operator="alan_ops",
            reason="运营规划阿岚只修改了备注"
        )

        version_diff = self.system.get_version_diff(first_record.id)
        diffs = version_diff["version_diffs"]

        self.assertGreater(len(diffs), 0)
        remark_diff = None
        for d in diffs:
            if "remark" in d["differences"]:
                remark_diff = d["differences"]["remark"]
                break

        self.assertIsNotNone(remark_diff)
        self.assertIn("before", remark_diff)
        self.assertIn("after", remark_diff)
        self.assertNotEqual(remark_diff["before"], remark_diff["after"])
        self.assertIn("-已复核", remark_diff["after"])

    def test_reimport_file_with_remark_change(self):
        """测试重复导入同一文件（仅改备注后再次导入，系统检测到变更并记录历史"""
        step1_first = self.system.step1_import(self.test_file_v1, "alan_ops")
        batch_id = step1_first["batch_id"]
        first_records = self.system.db.get_records_by_batch(batch_id)
        first_record = first_records[0]

        edit_result = self.system.manual_edit(
            record_id=first_record.id,
            updates={"remark": "正常样本-手动修改备注"},
            operator="alan_ops",
            reason="运营规划阿岚修改了第一条记录备注"
        )

        step1_second = self.system.step1_import(self.test_file_v1, "alan_ops")

        import_result = step1_second["import_result"]
        self.assertTrue(import_result["is_duplicate"])
        self.assertIn("changes_detected", import_result)
        self.assertGreaterEqual(import_result["changes_detected"], 1)
        self.assertIn("change_details", import_result)

        change_details = import_result["change_details"]
        self.assertGreaterEqual(len(change_details), 1)

        change = change_details[0]
        self.assertIn("remark", change["differences"])
        old_val, new_val = change["differences"]["remark"]
        self.assertIn("手动修改备注", old_val)
        self.assertIn("正常样本", new_val)

    def test_rollback_functionality(self):
        """测试回滚功能"""
        step1 = self.system.step1_import(self.test_file_v1, "alan_ops")
        batch_id = step1["batch_id"]
        records = self.system.db.get_records_by_batch(batch_id)
        record = records[0]

        edit_result = self.system.manual_edit(
            record_id=record.id,
            updates={"remark": "测试修改"},
            operator="alan_ops",
            reason="测试回滚"
        )

        histories = self.system.db.get_record_histories(record.id)
        self.assertGreaterEqual(len(histories), 2)

        first_history = histories[0]
        rollback_result = self.system.rollback_to_history(
            record_id=record.id,
            history_id=first_history.id,
            operator="alan_ops"
        )

        self.assertEqual(rollback_result["current_status"], ProcessingStatus.ROLLED_BACK.value)
        self.assertIn("回滚操作已留痕", rollback_result["note"])

        evidence = self.system.get_evidence(record.id)
        rollback_history = [
            h for h in evidence["full_history"]
            if h["change_source"] == "rollback"
        ]
        self.assertEqual(len(rollback_history), 1)

    def test_get_pending_review_tasks(self):
        """测试获取待复核任务"""
        self.system.run_complete_workflow(
            file_path=self.test_file_v1,
            import_operator="alan_ops",
            formula_reviewer="alan_ops",
            formula_review_note="已复核",
            screenshot_reference="截图.png",
            ta_assignee="ta_xiaoming"
        )

        pending = self.system.get_pending_review_tasks("ta_xiaoming")
        self.assertGreater(pending["pending_count"], 0)
        self.assertEqual(pending["assigned_to"], "ta_xiaoming")

        all_pending = self.system.get_pending_review_tasks()
        self.assertGreaterEqual(all_pending["pending_count"], pending["pending_count"])

    def test_get_records_by_boundary_type(self):
        """测试按边界类型查询记录"""
        self.system.step1_import(self.test_file_v1, "alan_ops")

        result = self.system.get_records_by_boundary_type("negative_treated_as_missing")
        self.assertEqual(result["boundary_type"], "negative_treated_as_missing")
        self.assertGreater(result["count"], 0)

        result_normal = self.system.get_records_by_boundary_type("normal")
        self.assertGreater(result_normal["count"], 0)

    def test_workflow_status_tracking(self):
        """测试工作流状态追踪"""
        step1 = self.system.step1_import(self.test_file_v1, "alan_ops")
        batch_id = step1["batch_id"]

        status = self.system.get_workflow_status(batch_id)
        self.assertTrue(status["step1_import_completed"])
        self.assertFalse(status["step2_formula_review_completed"])
        self.assertFalse(status["step3_boundary_report_completed"])
        self.assertEqual(status["current_step"], 2)

        self.system.step2_review_formula(batch_id, "alan_ops", "已复核", "截图.png")
        status = self.system.get_workflow_status(batch_id)
        self.assertTrue(status["step2_formula_review_completed"])
        self.assertEqual(status["current_step"], 3)

        self.system.step3_boundary_report(batch_id, "alan_ops", "ta_xiaoming")
        status = self.system.get_workflow_status(batch_id)
        self.assertTrue(status["step3_boundary_report_completed"])

    def test_negative_samples_not_automatically_normalized(self):
        """关键测试：负数样本被旧表当成缺失时，不急着归正常"""
        step1 = self.system.step1_import(self.test_file_v1, "alan_ops")
        batch_id = step1["batch_id"]

        records = self.system.db.get_records_by_batch(batch_id)
        negative_as_missing = [
            r for r in records
            if r.boundary_type == BoundaryType.NEGATIVE_TREATED_AS_MISSING
        ]

        for r in negative_as_missing:
            self.assertNotEqual(r.boundary_type, BoundaryType.NORMAL,
                              f"记录 {r.id} (原始行号 {r.original_row_number}) "
                              f"不应该被自动归为正常，"
                              f"当前边界类型: {r.boundary_type.value}")
            self.assertEqual(r.status, ProcessingStatus.PENDING_REVIEW,
                           f"记录 {r.id} 应该标记为待复核")

        step3 = self.system.step3_boundary_report(batch_id, "alan_ops", "ta_xiaoming")
        self.assertGreater(len(step3["review_tasks_created"]), 0)
        self.assertIn("status_pending_review", step3["boundary_summary"])
        self.assertGreater(step3["boundary_summary"]["status_pending_review"], 0)

        pending_tasks = self.system.get_pending_review_tasks("ta_xiaoming")
        self.assertGreaterEqual(pending_tasks["pending_count"], len(negative_as_missing))

    def test_reimport_does_not_overwrite_ta_confirmed_value(self):
        """
        关键测试：学生助教确认修正的值，重复导入不能覆盖。
        场景：导入→TA复核恢复P10=-500→重复导入→P10仍为-500，不回None。
        """
        step1 = self.system.step1_import(self.test_file_v1, "alan_ops")
        batch_id = step1["batch_id"]

        self.system.step2_review_formula(batch_id, "alan_ops", "已复核", "截图.png")
        self.system.step3_boundary_report(batch_id, "alan_ops", "ta_xiaoming")

        pending = self.system.get_pending_review_tasks("ta_xiaoming")
        neg_task = next(
            (t for t in pending["tasks"]
             if t["boundary_type"] == "negative_treated_as_missing"),
            None
        )
        self.assertIsNotNone(neg_task, "应找到负数当缺失的复核任务")

        review = self.system.ta_review_record(
            task_id=neg_task["task_id"],
            record_id=neg_task["record_id"],
            review_result="P10确实是-500",
            correction_decision="restore_negative",
            corrected_values={"weight_p10": -500},
            ta_name="xiaoming"
        )
        self.assertEqual(review["updated_boundary_type"], "negative_value")

        detail_before = self.system.get_detail_view(neg_task["record_id"])
        self.assertEqual(detail_before["current_values"]["weight_p10"], -500.0)

        step1_repeat = self.system.step1_import(self.test_file_v1, "alan_ops")

        detail_after = self.system.get_detail_view(neg_task["record_id"])
        self.assertEqual(
            detail_after["current_values"]["weight_p10"], -500.0,
            "重复导入不应覆盖TA确认的P10=-500"
        )

        self.assertEqual(
            detail_after["boundary_type"], "negative_value",
            "边界类型应基于保留后的值（negative_value），不是负数被旧表当缺失"
        )

        conflict_tasks = [
            t for t in self.system.db.get_pending_review_tasks()
            if t.record_id == neg_task["record_id"]
            and "冲突" in t.review_note
        ]
        self.assertGreater(
            len(conflict_tasks), 0,
            "重复导入与人工确认冲突时，应生成新待办任务"
        )

        consistency = self.system.verify_consistency(batch_id)
        self.assertTrue(consistency["consistency_passed"])

    def test_reimport_different_hash_does_not_overwrite_ta_confirmed_value(self):
        """
        关键测试：哈希不同（v1_edited）的重复导入也不能覆盖TA确认值。
        """
        step1 = self.system.step1_import(self.test_file_v1, "alan_ops")
        batch_id = step1["batch_id"]

        step1b = self.system.step1_import(self.test_file_v1_edited, "alan_ops")

        self.system.step2_review_formula(batch_id, "alan_ops", "已复核", "截图.png")
        self.system.step3_boundary_report(batch_id, "alan_ops", "ta_xiaoming")

        pending = self.system.get_pending_review_tasks("ta_xiaoming")
        neg_task = next(
            (t for t in pending["tasks"]
             if t["boundary_type"] == "negative_treated_as_missing"),
            None
        )
        self.assertIsNotNone(neg_task)

        self.system.ta_review_record(
            task_id=neg_task["task_id"],
            record_id=neg_task["record_id"],
            review_result="P10确实是-500",
            correction_decision="restore_negative",
            corrected_values={"weight_p10": -500},
            ta_name="xiaoming"
        )

        detail_before = self.system.get_detail_view(neg_task["record_id"])
        self.assertEqual(detail_before["current_values"]["weight_p10"], -500.0)

        step1_repeat = self.system.step1_import(self.test_file_v1_edited, "alan_ops")
        self.assertTrue(step1_repeat["import_result"]["is_duplicate"])

        detail_after = self.system.get_detail_view(neg_task["record_id"])
        self.assertEqual(
            detail_after["current_values"]["weight_p10"], -500.0,
            "哈希不同的重复导入也不应覆盖TA确认的P10=-500"
        )

        consistency = self.system.verify_consistency(batch_id)
        self.assertTrue(consistency["consistency_passed"])


if __name__ == "__main__":
    unittest.main()
