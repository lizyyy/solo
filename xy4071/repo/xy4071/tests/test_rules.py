"""测试规则引擎"""

from unittest import TestCase

from frequency_guardian.models.config import ProjectConfig
from frequency_guardian.models.violation import ViolationSeverity, ViolationType
from frequency_guardian.rules.base import RuleContext, RuleResult
from frequency_guardian.rules.call_sign_rule import CallSignFormatRule
from frequency_guardian.rules.engine import RuleEngine
from frequency_guardian.rules.power_rule import PowerLimitRule


class TestCallSignFormatRule(TestCase):
    """测试呼号格式规则"""

    def setUp(self):
        """设置测试环境"""
        self.config = ProjectConfig()
        self.rule = CallSignFormatRule(self.config)

    def test_valid_call_signs(self):
        """测试有效呼号"""
        valid_call_signs = ["BH1ABC", "BA1XYZ", "BG1A", "BD1ABCD", "BH1/BA1"]

        for call_sign in valid_call_signs:
            context = RuleContext(
                data={"call_sign": call_sign},
                source_type="radio",
                line_number=1,
            )
            result = self.rule.execute(context)

            self.assertTrue(result.success, f"呼号应该有效: {call_sign}")
            self.assertEqual(len(result.violations), 0)

    def test_invalid_call_signs(self):
        """测试无效呼号"""
        invalid_call_signs = ["123", "abc", "BH!", "BH1234567890A", "", None]

        for call_sign in invalid_call_signs:
            context = RuleContext(
                data={"call_sign": call_sign},
                source_type="radio",
                line_number=1,
            )
            result = self.rule.execute(context)

            self.assertFalse(result.success, f"呼号应该无效: {call_sign}")
            self.assertGreater(len(result.violations), 0)

            violation = result.violations[0]
            self.assertEqual(violation.violation_type, ViolationType.INVALID_CALLSIGN)
            self.assertEqual(violation.severity, ViolationSeverity.HIGH)


class TestPowerLimitRule(TestCase):
    """测试功率限制规则"""

    def setUp(self):
        """设置测试环境"""
        self.config = ProjectConfig(max_power_watts=25.0)
        self.rule = PowerLimitRule(self.config)

    def test_valid_power(self):
        """测试有效功率"""
        valid_powers = [5.0, 10.0, 25.0, 0.0]

        for power in valid_powers:
            context = RuleContext(
                data={"power_watts": power},
                source_type="radio",
                line_number=1,
            )
            result = self.rule.execute(context)

            self.assertTrue(result.success, f"功率应该有效: {power}")
            self.assertEqual(len(result.violations), 0)

    def test_invalid_power(self):
        """测试无效功率"""
        invalid_powers = [30.0, 50.0, 100.0, -5.0]

        for power in invalid_powers:
            context = RuleContext(
                data={"power_watts": power},
                source_type="radio",
                line_number=1,
            )
            result = self.rule.execute(context)

            self.assertFalse(result.success, f"功率应该无效: {power}")
            self.assertGreater(len(result.violations), 0)

            violation = result.violations[0]
            self.assertEqual(violation.violation_type, ViolationType.POWER_OVER_LIMIT)
            self.assertEqual(violation.severity, ViolationSeverity.HIGH)

            if violation.evidence:
                if power > 0:
                    self.assertEqual(violation.evidence.expected_value, "<=25.0W")
                else:
                    self.assertEqual(violation.evidence.expected_value, ">0W")


class TestRuleEngine(TestCase):
    """测试规则引擎"""

    def setUp(self):
        """设置测试环境"""
        self.config = ProjectConfig()
        self.engine = RuleEngine(self.config)

    def test_register_rule(self):
        """测试注册规则"""
        initial_count = len(self.engine.rules)

        class TestRule:
            rule_name = "test_rule"
            rule_type = "test"

            def execute(self, context):
                return RuleResult(success=True)

        self.engine.register_rule(TestRule())

        self.assertEqual(len(self.engine.rules), initial_count + 1)

    def test_execute_all(self):
        """测试执行所有规则"""
        test_data = [
            {"call_sign": "BH1ABC", "power_watts": 10.0},
            {"call_sign": "invalid!", "power_watts": 100.0},
        ]

        result = self.engine.execute_all(test_data, "radio", "test.csv")

        self.assertGreater(result.total_rules_executed, 0)
        self.assertGreater(len(result.violations), 0)

    def test_get_rules_by_type(self):
        """测试按类型获取规则"""
        radio_rules = self.engine.get_rules_by_type("radio")
        all_rules = self.engine.get_rules_by_type("all")

        self.assertIsInstance(radio_rules, list)
        self.assertIsInstance(all_rules, list)
        self.assertGreaterEqual(len(all_rules), len(radio_rules))
