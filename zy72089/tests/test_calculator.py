"""单元测试 - 核心计算模块"""

import unittest
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from piano_progress.calculator import ProgressCalculator
from piano_progress.validator import Validator
from piano_progress.converter import UnitConverter
from piano_progress.tracer import DataTracer


class TestUnitConverter(unittest.TestCase):
    """测试单位换算模块"""

    def test_duration_conversion_hours_to_minutes(self):
        """测试小时转分钟"""
        result, alerts = UnitConverter.convert_duration(1.5, "hours", "minutes", "TEST-001")
        self.assertAlmostEqual(result, 90.0, places=2)
        self.assertTrue(any("小时" in a for a in alerts))

    def test_duration_conversion_seconds_to_minutes(self):
        """测试秒转分钟"""
        result, alerts = UnitConverter.convert_duration(120, "seconds", "minutes", "TEST-001")
        self.assertAlmostEqual(result, 2.0, places=2)

    def test_difficulty_conversion_letter_grade(self):
        """测试字母等级难度转换"""
        result, alerts = UnitConverter.convert_difficulty("B", "A-G", "1-10", "TEST-001")
        self.assertAlmostEqual(result, 8.5, places=2)
        self.assertTrue(any("B" in a for a in alerts))

    def test_difficulty_conversion_1_5_to_1_10(self):
        """测试1-5分制转1-10分制"""
        result, alerts = UnitConverter.convert_difficulty(3, "1-5", "1-10", "TEST-001")
        self.assertAlmostEqual(result, 5.5, places=2)

    def test_unknown_unit_alert(self):
        """测试未知单位的提醒"""
        result, alerts = UnitConverter.convert_duration(100, "days", "minutes", "TEST-001")
        self.assertEqual(result, 100)
        self.assertTrue(any("未知" in a for a in alerts))


class TestValidator(unittest.TestCase):
    """测试验证模块"""

    def setUp(self):
        with open("data/params.json", "r", encoding="utf-8") as f:
            self.params = json.load(f)
        self.validator = Validator(self.params)

    def test_weight_validation_correct(self):
        """测试权重闭合验证（正确情况）"""
        result = self.validator.validate_weights("main")
        self.assertTrue(result.is_valid)
        self.assertTrue(any("权重总和" in a for a in result.alerts))

    def test_boundary_hard_violation(self):
        """测试硬边界违规"""
        result = self.validator.validate_boundaries(
            "practice_duration", 300, "TEST-001"
        )
        self.assertFalse(result.is_valid)
        self.assertTrue(any("越界" in e for e in result.errors))

    def test_boundary_soft_violation(self):
        """测试软边界违规"""
        result = self.validator.validate_boundaries(
            "practice_duration", 10, "TEST-001"
        )
        self.assertTrue(result.is_valid)
        self.assertTrue(any("警告" in w for w in result.warnings))
        self.assertTrue(any("人工确认" in w for w in result.warnings))

    def test_boundary_normal(self):
        """测试边界正常情况"""
        result = self.validator.validate_boundaries(
            "practice_duration", 60, "TEST-001"
        )
        self.assertTrue(result.is_valid)
        self.assertEqual(len(result.errors), 0)
        self.assertEqual(len(result.warnings), 0)
        self.assertTrue(any("正常" in a for a in result.alerts))

    def test_progress_fluctuation_normal(self):
        """测试正常波动"""
        result = self.validator.validate_progress_score(70, 65, "TEST-001")
        self.assertTrue(result.is_valid)
        self.assertTrue(any("波动正常" in a for a in result.alerts))

    def test_progress_fluctuation_warning(self):
        """测试波动过大警告"""
        result = self.validator.validate_progress_score(90, 60, "TEST-001")
        self.assertTrue(result.is_valid)
        self.assertTrue(any("波动警告" in w for w in result.warnings))


class TestDataTracer(unittest.TestCase):
    """测试追溯模块"""

    def setUp(self):
        self.tracer = DataTracer()

    def test_create_trace(self):
        """测试创建追溯记录"""
        trace = self.tracer.create_trace(
            record_id="TEST-001",
            source_type="manual",
            source_file="test.json",
            original_value={"test": "data"},
            converted_value={"result": 100},
            conversion_rule="测试规则",
        )
        self.assertIsNotNone(trace.trace_id)
        self.assertTrue(trace.trace_id.startswith("TRACE-TEST-001"))
        self.assertIsNotNone(trace.data_hash)

    def test_add_note_to_trace(self):
        """测试添加备注"""
        trace = self.tracer.create_trace(
            record_id="TEST-001",
            source_type="manual",
            source_file="test.json",
        )
        original_hash = trace.data_hash
        self.tracer.add_note(trace.trace_id, "测试备注")
        updated = self.tracer.get_trace(trace.trace_id)
        self.assertEqual(len(updated.notes), 1)
        self.assertNotEqual(updated.data_hash, original_hash)

    def test_get_record_history(self):
        """测试获取记录历史"""
        self.tracer.create_trace(
            record_id="TEST-001",
            source_type="manual",
            source_file="test1.json",
        )
        self.tracer.create_trace(
            record_id="TEST-001",
            source_type="manual",
            source_file="test2.json",
        )
        history = self.tracer.get_record_history("TEST-001")
        self.assertEqual(len(history), 2)

    def test_find_legacy_record(self):
        """测试查找旧口径记录"""
        history_samples = [
            {"date": "2026-04-15", "difficulty": 5, "practice_duration": 60, "_source_file": "old.json"},
            {"date": "2026-04-20", "difficulty": 6, "practice_duration": 45, "_source_file": "old.json"},
        ]
        matched = self.tracer.find_legacy_record(
            {"date": "2026-04-15", "difficulty": 5},
            history_samples,
            "NEW-001"
        )
        self.assertIsNotNone(matched)
        self.assertEqual(matched["date"], "2026-04-15")

    def test_verify_trace_chain(self):
        """测试追溯链完整性验证"""
        trace = self.tracer.create_trace(
            record_id="TEST-001",
            source_type="manual",
            source_file="test.json",
        )
        result = self.tracer.verify_trace_chain("TEST-001")
        self.assertTrue(result["is_complete"])
        self.assertEqual(result["trace_count"], 1)


class TestProgressCalculator(unittest.TestCase):
    """测试进步曲线计算模块"""

    def setUp(self):
        with open("data/params.json", "r", encoding="utf-8") as f:
            self.params = json.load(f)
        self.tracer = DataTracer()
        self.calculator = ProgressCalculator(self.params, self.tracer)

    def test_normalize_linear(self):
        """测试线性归一化"""
        result, alerts = self.calculator._normalize("practice_duration", 90, "TEST-001")
        self.assertAlmostEqual(result, 50.0, places=0)

    def test_normalize_inverse(self):
        """测试反向归一化（错误次数）"""
        result, alerts = self.calculator._normalize("mistake_count", 0, "TEST-001")
        self.assertAlmostEqual(result, 100.0, places=0)

    def test_calculate_single_record_smooth(self):
        """测试单条顺利记录计算"""
        record = {
            "date": "2026-05-20",
            "practice_duration": 60,
            "difficulty": 5,
            "accuracy": 85,
            "mistake_count": 8,
            "repetition_count": 5,
            "_source_type": "manual",
        }
        score = self.calculator.calculate_record(record, "TEST-001", "test.json")
        self.assertIsNotNone(score.total_score)
        self.assertGreater(score.total_score, 0)
        self.assertLess(score.total_score, 100)
        self.assertFalse(score.need_manual_confirm)
        self.assertIsNotNone(score.trace_id)

    def test_calculate_single_record_needs_confirm(self):
        """测试单条需要确认的记录"""
        record = {
            "date": "2026-05-20",
            "practice_duration": 10,
            "difficulty": 3,
            "accuracy": 95,
            "mistake_count": 2,
            "repetition_count": 3,
            "_source_type": "manual",
        }
        score = self.calculator.calculate_record(record, "TEST-002", "test.json")
        self.assertTrue(score.need_manual_confirm)
        self.assertIsNotNone(score.confirm_reason)

    def test_calculate_curve_with_prediction(self):
        """测试批量计算带预测"""
        records = [
            {
                "record_id": "TEST-001",
                "date": "2026-05-20",
                "practice_duration": 60,
                "difficulty": 5,
                "accuracy": 85,
                "mistake_count": 8,
                "repetition_count": 5,
            },
            {
                "record_id": "TEST-002",
                "date": "2026-05-21",
                "practice_duration": 45,
                "difficulty": 6,
                "accuracy": 82,
                "mistake_count": 12,
                "repetition_count": 6,
            },
            {
                "record_id": "TEST-003",
                "date": "2026-05-22",
                "practice_duration": 75,
                "difficulty": 6,
                "accuracy": 88,
                "mistake_count": 6,
                "repetition_count": 7,
            },
        ]
        scores, summary = self.calculator.calculate_curve(records, "test.json")
        self.assertEqual(len(scores), 3)
        self.assertIn("next_predicted_score", summary)
        self.assertIn("prediction_reason", summary)
        self.assertIn("预测说明", summary["prediction_reason"])

    def test_calculate_with_duration_conversion(self):
        """测试带单位换算的计算"""
        record = {
            "date": "2026-05-20",
            "practice_duration": {"value": 1.5, "unit": "hours"},
            "difficulty": 5,
            "accuracy": 85,
            "mistake_count": 8,
            "repetition_count": 5,
        }
        score = self.calculator.calculate_record(record, "TEST-003", "test.json")
        self.assertTrue(any("单位换算" in a for a in score.alerts))

    def test_calculate_with_difficulty_letter(self):
        """测试带字母难度的计算"""
        # 使用带scale配置的参数，确保字母难度能被正确转换
        params_with_scale = json.loads(json.dumps(self.params))
        params_with_scale["fields"]["difficulty"]["scale"] = "A-G"
        calculator_with_scale = ProgressCalculator(params_with_scale, DataTracer())
        
        record = {
            "date": "2026-05-20",
            "practice_duration": 60,
            "difficulty": "B",
            "accuracy": 85,
            "mistake_count": 8,
            "repetition_count": 5,
        }
        score = calculator_with_scale.calculate_record(record, "TEST-004", "test.json")
        self.assertTrue(any("难度等级" in a for a in score.alerts))


class TestIntegration(unittest.TestCase):
    """集成测试"""

    def test_full_analysis_workflow(self):
        """测试完整分析工作流"""
        with open("data/params.json", "r", encoding="utf-8") as f:
            params = json.load(f)
        with open("data/records.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            records = data["records"]

        tracer = DataTracer()
        calculator = ProgressCalculator(params, tracer)
        scores, summary = calculator.calculate_curve(records, "data/records.json")

        self.assertEqual(len(scores), 8)
        self.assertIn("avg_score", summary)
        self.assertIn("trend", summary)
        self.assertIn("total_records", summary)

        for score in scores:
            self.assertIsNotNone(score.trace_id)
            self.assertGreater(len(score.alerts), 0)

    def test_outlier_detection(self):
        """测试越界样本检测"""
        with open("data/params.json", "r", encoding="utf-8") as f:
            params = json.load(f)
        with open("data/outliers.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            records = data["records"]

        tracer = DataTracer()
        calculator = ProgressCalculator(params, tracer)
        scores, summary = calculator.calculate_curve(records, "data/outliers.json")

        self.assertEqual(summary["outlier_count"], 3)
        self.assertTrue(any(not s.validation.is_valid for s in scores))

    def test_sample_records_three_types(self):
        """测试三类样例记录（顺利/待确认/旧口径）"""
        with open("data/params.json", "r", encoding="utf-8") as f:
            params = json.load(f)
        with open("data/sample_records.json", "r", encoding="utf-8") as f:
            data = json.load(f)
            records = data["records"]

        tracer = DataTracer()
        calculator = ProgressCalculator(params, tracer)
        scores, summary = calculator.calculate_curve(records, "data/sample_records.json")

        self.assertEqual(len(scores), 4)

        smooth = [s for s in scores if s.record_id == "REC-SMOOTH-001"][0]
        confirm = [s for s in scores if s.record_id == "REC-CONFIRM-001"][0]
        legacy = [s for s in scores if s.record_id == "REC-LEGACY-001"][0]

        self.assertFalse(smooth.need_manual_confirm)
        self.assertTrue(smooth.validation.is_valid)

        self.assertTrue(confirm.need_manual_confirm)
        self.assertTrue(confirm.validation.is_valid)

        self.assertEqual(legacy.source_type, "legacy")


if __name__ == "__main__":
    unittest.main(verbosity=2)
