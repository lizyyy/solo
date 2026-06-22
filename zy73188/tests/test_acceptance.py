"""自动化验收测试 - 验证完整处理流程

运行方式:
  cd /Users/maca/pro/solo/workspaces/zy73188
  python -m tests.test_acceptance

或用 unittest:
  python -m unittest tests.test_acceptance -v
"""

import json
import os
import shutil
import sys
import unittest
import copy

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from error_propagation_explainer.cli import run
from error_propagation_explainer.models import CaseStatus, EvidenceStatus


PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_DIR = os.path.join(PROJECT_ROOT, "examples", "messy_cases")


def load_json(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(filepath, data):
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


class TestAcceptance(unittest.TestCase):
    """验收测试套件"""

    def setUp(self):
        self.output_dir = os.path.join(PROJECT_ROOT, "out", "test_demo")
        if os.path.exists(self.output_dir):
            shutil.rmtree(self.output_dir)
        os.makedirs(self.output_dir, exist_ok=True)

    def tearDown(self):
        if os.path.exists(self.output_dir):
            shutil.rmtree(self.output_dir)

    def test_01_run_completes_successfully(self):
        """测试1: 工具能成功运行并返回0"""
        exit_code = run(INPUT_DIR, self.output_dir)
        self.assertEqual(exit_code, 0, "工具应该成功运行并返回退出码0")

    def test_02_output_files_generated(self):
        """测试2: 输出目录生成所有必需文件"""
        run(INPUT_DIR, self.output_dir)

        required_files = [
            "明细.json",
            "明细.txt",
            "汇总.json",
            "汇总.txt",
            "解释报告.txt",
            "异常队列.json",
            "异常队列.txt",
        ]
        for f in required_files:
            path = os.path.join(self.output_dir, f)
            self.assertTrue(
                os.path.isfile(path),
                f"输出文件 {f} 应该存在"
            )

    def test_03_summary_has_correct_counts(self):
        """测试3: 汇总文件包含正确的统计数字"""
        run(INPUT_DIR, self.output_dir)

        summary = load_json(os.path.join(self.output_dir, "汇总.json"))

        self.assertEqual(summary["total_files"], 9, "应该有9个输入文件")
        self.assertEqual(summary["total_cases"], 9, "应该有9条记录(所有文件)")
        self.assertEqual(summary["success_count"], 3, "应该有3个成功计算(AREA-001, DENSITY-001, CYLINDER-001)")
        self.assertEqual(summary["suspended_count"], 2, "应该有2个挂起(PERIOD-001的两条记录)")
        self.assertEqual(summary["failed_count"], 3, "应该有3个失败(PARSE-001, PARSE-002, EMPTY-001)")
        self.assertEqual(summary["merged_count"], 1, "应该有1条合并重复记录(DENSITY-001的case_06)")
        self.assertTrue(summary["boundary_count"] >= 1, "应该至少有1个边界样本")

    def test_04_terminal_summary_separates_normal_suspended_failed(self):
        """测试4: 终端摘要区分正常、挂起和失败"""
        import io
        from contextlib import redirect_stdout

        old_cwd = os.getcwd()
        os.chdir(PROJECT_ROOT)
        try:
            buf = io.StringIO()
            with redirect_stdout(buf):
                run(INPUT_DIR, self.output_dir)
            output = buf.getvalue()
        finally:
            os.chdir(old_cwd)

        self.assertIn("成功", output, "终端摘要应显示成功数")
        self.assertIn("挂起", output, "终端摘要应显示挂起数")
        self.assertIn("失败", output, "终端摘要应显示失败数")
        self.assertIn("输出目录", output, "终端摘要应显示输出路径")

    def test_05_anomaly_queue_separate_from_summary(self):
        """测试5: 异常队列与汇总分离"""
        run(INPUT_DIR, self.output_dir)

        summary_text = load_text(os.path.join(self.output_dir, "汇总.txt"))
        anomaly_text = load_text(os.path.join(self.output_dir, "异常队列.txt"))

        self.assertIn("DUPLICATE_CONFLICT", anomaly_text, "异常队列应包含重复冲突记录")
        self.assertIn("BOUNDARY_SAMPLE", anomaly_text, "异常队列应包含边界样本记录")
        self.assertIn("MISSING_FIELD", anomaly_text, "异常队列应包含缺字段记录")
        self.assertIn("UNKNOWN_FORMULA", anomaly_text, "异常队列应包含未知公式记录")
        self.assertIn("EMPTY_INPUT", anomaly_text, "异常队列应包含空集合记录")

        self.assertIn("详见", summary_text, "汇总应指向异常队列文件")
        self.assertIn("异常详情请查看", summary_text, "汇总应说明异常在单独文件中")

    def test_06_empty_input_not_treated_as_normal(self):
        """测试6: 空集合不能被当成正常输入"""
        empty_dir = os.path.join(PROJECT_ROOT, "out", "test_empty_input")
        if os.path.exists(empty_dir):
            shutil.rmtree(empty_dir)
        os.makedirs(empty_dir, exist_ok=True)

        exit_code = run(empty_dir, empty_dir)

        self.assertNotEqual(exit_code, 0, "空输入目录应返回非零退出码")

        if os.path.exists(empty_dir):
            shutil.rmtree(empty_dir)

    def test_07_duplicate_identical_merged(self):
        """测试7: 内容一致的重复样本被合并"""
        run(INPUT_DIR, self.output_dir)

        details = load_json(os.path.join(self.output_dir, "明细.json"))

        density_cases = [c for c in details["题目列表"] if c["case_id"] == "DENSITY-001"]
        self.assertEqual(len(density_cases), 2, "DENSITY-001应有2条记录(原始+合并)")

        merged = [c for c in density_cases if c["status"] == "merged"]
        self.assertEqual(len(merged), 1, "应该有1条记录被标记为merged")

        success = [c for c in density_cases if c["status"] == "success"]
        self.assertEqual(len(success), 1, "应该有1条记录正常计算")

    def test_08_duplicate_conflict_suspended(self):
        """测试8: 数值不一致的重复样本被挂起"""
        run(INPUT_DIR, self.output_dir)

        details = load_json(os.path.join(self.output_dir, "明细.json"))

        period_cases = [c for c in details["题目列表"] if c["case_id"] == "PERIOD-001"]
        self.assertEqual(len(period_cases), 2, "PERIOD-001应有2条记录")

        for c in period_cases:
            self.assertEqual(c["status"], "suspended", "PERIOD-001所有记录应被挂起")

    def test_09_boundary_sample_detected(self):
        """测试9: 边界样本被正确检测"""
        run(INPUT_DIR, self.output_dir)

        details = load_json(os.path.join(self.output_dir, "明细.json"))

        cylinder = [c for c in details["题目列表"] if c["case_id"] == "CYLINDER-001"]
        self.assertEqual(len(cylinder), 1)

        boundary_vars = [v for v in cylinder[0]["variables"] if v["is_boundary"]]
        self.assertEqual(len(boundary_vars), 1, "应该有1个边界变量")
        self.assertEqual(boundary_vars[0]["symbol"], "r", "边界变量应该是r")

    def test_10_parse_failures_correct(self):
        """测试10: 解析失败被正确记录"""
        run(INPUT_DIR, self.output_dir)

        details = load_json(os.path.join(self.output_dir, "明细.json"))

        parse_cases = [c for c in details["题目列表"] if c["case_id"].startswith("PARSE-")]
        empty_cases = [c for c in details["题目列表"] if c["case_id"].startswith("EMPTY-")]

        for c in parse_cases:
            self.assertEqual(c["status"], "failed", f"{c['case_id']}应标记为failed")

        for c in empty_cases:
            self.assertEqual(c["status"], "failed", f"{c['case_id']}应标记为failed")

    def test_11_explanation_report_has_evidence_sections(self):
        """测试11: 解释报告包含证据确认和待补章节"""
        run(INPUT_DIR, self.output_dir)

        report = load_text(os.path.join(self.output_dir, "解释报告.txt"))

        self.assertIn("已确认", report, "解释报告应包含已确认证据章节")
        self.assertIn("待确认", report, "解释报告应包含待确认证据章节")
        self.assertIn("需要补证据", report, "解释报告应包含需要补证据章节")
        self.assertIn("数字从哪来", report, "解释报告应说明数字来源")
        self.assertIn("误差传播怎么算", report, "解释报告应解释计算方法")

    def test_12_modify_duplicate_recalculates(self):
        """测试12: 修改重复样本数值后重新运行，汇总有变化"""
        temp_input = os.path.join(PROJECT_ROOT, "out", "test_modify_input")
        if os.path.exists(temp_input):
            shutil.rmtree(temp_input)
        shutil.copytree(INPUT_DIR, temp_input)

        run(temp_input, self.output_dir)
        summary_before = load_json(os.path.join(self.output_dir, "汇总.json"))
        details_before = load_json(os.path.join(self.output_dir, "明细.json"))

        period_before = [c for c in details_before["题目列表"] if c["case_id"] == "PERIOD-001"]
        self.assertEqual(len(period_before), 2, "修改前应有2条PERIOD-001记录")
        for c in period_before:
            self.assertEqual(c["status"], "suspended")

        conflict_file = os.path.join(temp_input, "case_08_period_conflict_dup.json")
        data = load_json(conflict_file)
        original_value = data["variables"][0]["value"]
        data["variables"][0]["value"] = 1.0
        save_json(conflict_file, data)

        try:
            run(temp_input, self.output_dir)
            summary_after = load_json(os.path.join(self.output_dir, "汇总.json"))
            details_after = load_json(os.path.join(self.output_dir, "明细.json"))

            period_after = [c for c in details_after["题目列表"] if c["case_id"] == "PERIOD-001"]
            merged_after = [c for c in period_after if c["status"] == "merged"]
            success_after = [c for c in period_after if c["status"] == "success"]

            self.assertEqual(
                summary_after["suspended_count"],
                summary_before["suspended_count"] - 2,
                "修改后挂起数应减少2（PERIOD-001不再挂起）"
            )
            self.assertEqual(
                summary_after["success_count"],
                summary_before["success_count"] + 1,
                "修改后成功数应增加1"
            )
            self.assertEqual(
                summary_after["merged_count"],
                summary_before["merged_count"] + 1,
                "修改后合并数应增加1"
            )
        finally:
            data["variables"][0]["value"] = original_value
            save_json(conflict_file, data)
            if os.path.exists(temp_input):
                shutil.rmtree(temp_input)

    def test_13_calculation_results_present(self):
        """测试13: 成功题目有计算结果"""
        run(INPUT_DIR, self.output_dir)

        details = load_json(os.path.join(self.output_dir, "明细.json"))

        area = [c for c in details["题目列表"] if c["case_id"] == "AREA-001"][0]
        self.assertIsNotNone(area["result"], "AREA-001应有计算结果")
        self.assertGreater(area["result"]["result_value"], 0, "面积应大于0")
        self.assertGreater(area["result"]["result_uncertainty"], 0, "不确定度应大于0")
        self.assertIn("dominant_contribution", area["result"], "应标注主要误差来源")
        self.assertGreater(len(area["result"]["uncertainty_contributions_pct"]), 0, "应有各变量贡献")

    def test_14_old_formula_alias_handled(self):
        """测试14: 旧公式名别名能被正确处理"""
        temp_input = os.path.join(PROJECT_ROOT, "out", "test_alias_input")
        if os.path.exists(temp_input):
            shutil.rmtree(temp_input)
        os.makedirs(temp_input, exist_ok=True)

        case_data = {
            "case_id": "ALIAS-001",
            "title": "使用旧公式名称的测试",
            "formula": "面积计算",
            "description": "使用旧名'面积计算'，应映射为'矩形面积'",
            "variables": [
                {"name": "长度", "symbol": "a", "value": 10.0, "uncertainty": 0.1, "unit": "cm"},
                {"name": "宽度", "symbol": "b", "value": 5.0, "uncertainty": 0.1, "unit": "cm"},
            ]
        }
        save_json(os.path.join(temp_input, "alias_case.json"), case_data)

        try:
            exit_code = run(temp_input, self.output_dir)
            self.assertEqual(exit_code, 0)

            details = load_json(os.path.join(self.output_dir, "明细.json"))
            alias_case = [c for c in details["题目列表"] if c["case_id"] == "ALIAS-001"][0]
            self.assertEqual(alias_case["status"], "success")
            self.assertEqual(alias_case["formula_name_resolved"], "矩形面积")
            self.assertTrue(
                any("旧说法" in w or "映射" in w for w in alias_case["warnings"]),
                "应有旧名映射警告"
            )
        finally:
            if os.path.exists(temp_input):
                shutil.rmtree(temp_input)


def load_text(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()


if __name__ == "__main__":
    unittest.main(verbosity=2)
