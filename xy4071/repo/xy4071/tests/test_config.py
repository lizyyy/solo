"""测试配置模型"""

import json
import tempfile
from pathlib import Path
from unittest import TestCase

from frequency_guardian.models.config import (
    FrequencyGuardianConfig,
    ProjectConfig,
)


class TestProjectConfig(TestCase):
    """测试 ProjectConfig 配置模型"""

    def test_default_config(self):
        """测试默认配置"""
        config = ProjectConfig()

        self.assertEqual(config.project_name, "应急演练频率管理")
        self.assertIsNone(config.exercise_name)
        self.assertEqual(config.max_power_watts, 25.0)
        self.assertEqual(config.min_frequency_mhz, 144.0)
        self.assertEqual(config.max_frequency_mhz, 148.0)
        self.assertIsNotNone(config.call_sign_pattern)

    def test_custom_config(self):
        """测试自定义配置"""
        config = ProjectConfig(
            project_name="测试演练项目",
            exercise_name="2024年春季应急演练",
            max_power_watts=50.0,
            min_frequency_mhz=430.0,
            max_frequency_mhz=440.0,
        )

        self.assertEqual(config.project_name, "测试演练项目")
        self.assertEqual(config.exercise_name, "2024年春季应急演练")
        self.assertEqual(config.max_power_watts, 50.0)
        self.assertEqual(config.min_frequency_mhz, 430.0)
        self.assertEqual(config.max_frequency_mhz, 440.0)

    def test_paths(self):
        """测试路径属性"""
        config = ProjectConfig()

        self.assertIsInstance(config.data_dir, Path)
        self.assertIsInstance(config.output_dir, Path)
        self.assertIsInstance(config.quarantine_file, Path)
        self.assertIsInstance(config.review_file, Path)

        self.assertEqual(config.data_dir.name, "data")
        self.assertEqual(config.output_dir.name, "output")
        self.assertEqual(config.quarantine_file.name, "quarantine.json")

    def test_frequency_range(self):
        """测试频率范围方法"""
        config = ProjectConfig()

        self.assertTrue(config.is_frequency_in_range(145.0))
        self.assertTrue(config.is_frequency_in_range(144.0))
        self.assertTrue(config.is_frequency_in_range(148.0))
        self.assertFalse(config.is_frequency_in_range(143.0))
        self.assertFalse(config.is_frequency_in_range(149.0))

    def test_power_limit(self):
        """测试功率限制方法"""
        config = ProjectConfig(max_power_watts=25.0)

        self.assertTrue(config.is_power_within_limit(25.0))
        self.assertTrue(config.is_power_within_limit(10.0))
        self.assertFalse(config.is_power_within_limit(30.0))
        self.assertFalse(config.is_power_within_limit(100.0))

    def test_call_sign_validation(self):
        """测试呼号验证方法"""
        config = ProjectConfig()

        valid_call_signs = ["BH1ABC", "BA1XYZ", "BG1A", "BD1ABCD", "BH1/BA1"]
        invalid_call_signs = ["123", "abc", "BH!", "BH1234567890A", ""]

        for call_sign in valid_call_signs:
            self.assertTrue(config.is_valid_call_sign(call_sign), f"呼号应该有效: {call_sign}")

        for call_sign in invalid_call_signs:
            self.assertFalse(config.is_valid_call_sign(call_sign), f"呼号应该无效: {call_sign}")


class TestFrequencyGuardianConfig(TestCase):
    """测试 FrequencyGuardianConfig 配置模型"""

    def test_default_severity_levels(self):
        """测试默认严重程度级别"""
        config = FrequencyGuardianConfig()

        self.assertIsNotNone(config.severity_levels)
        self.assertIn("critical", config.severity_levels)
        self.assertIn("high", config.severity_levels)
        self.assertIn("medium", config.severity_levels)
        self.assertIn("low", config.severity_levels)
        self.assertIn("info", config.severity_levels)

    def test_default_rule_configs(self):
        """测试默认规则配置"""
        config = FrequencyGuardianConfig()

        self.assertIsNotNone(config.rule_configs)
        self.assertIn("call_sign_format", config.rule_configs)
        self.assertIn("power_limit", config.rule_configs)
        self.assertIn("frequency_band", config.rule_configs)

    def test_is_rule_enabled(self):
        """测试规则启用状态方法"""
        config = FrequencyGuardianConfig()

        self.assertTrue(config.is_rule_enabled("call_sign_format"))
        self.assertTrue(config.is_rule_enabled("power_limit"))
        self.assertTrue(config.is_rule_enabled("frequency_band"))
        self.assertFalse(config.is_rule_enabled("non_existent_rule"))

    def test_get_severity_config(self):
        """测试获取严重程度配置方法"""
        config = FrequencyGuardianConfig()

        critical_config = config.get_severity_config("critical")
        self.assertIsNotNone(critical_config)
        self.assertEqual(critical_config.get("level"), 1)

        medium_config = config.get_severity_config("medium")
        self.assertIsNotNone(medium_config)
        self.assertEqual(medium_config.get("level"), 3)

        none_config = config.get_severity_config("non_existent")
        self.assertIsNone(none_config)
