import unittest
from datetime import timedelta

from podcast_sanitizer.rule_engine import RuleEngine, create_default_rules
from podcast_sanitizer.models import Subtitle, SensitiveRule, IssueType


class TestRuleEngine(unittest.TestCase):
    def setUp(self):
        self.rules = [
            SensitiveRule(
                id=1,
                pattern=r"1[3-9]\d{9}",
                category="phone",
                description="手机号码",
                mask_template="[PHONE_{index}]"
            ),
            SensitiveRule(
                id=2,
                pattern=r"[\w.-]+@[\w.-]+\.\w+",
                category="email",
                description="电子邮箱",
                mask_template="[EMAIL_{index}]"
            ),
            SensitiveRule(
                id=3,
                pattern=r"(?:张|王|李)[\u4e00-\u9fa5]{0,2}(?:总|客户)",
                category="client",
                description="客户称谓",
                mask_template="[CLIENT_{index}]"
            )
        ]
        self.engine = RuleEngine(self.rules)

    def test_match_phone_number(self):
        subtitle = Subtitle(
            id=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=5),
            text="联系电话是13812345678"
        )

        matches = self.engine.match_subtitle(subtitle)
        self.assertEqual(len(matches), 1)

        rule, matched_text, pos = matches[0]
        self.assertEqual(matched_text, "13812345678")
        self.assertEqual(rule.category, "phone")

    def test_match_email(self):
        subtitle = Subtitle(
            id=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=5),
            text="Contact: test@example.com for info"
        )

        matches = self.engine.match_subtitle(subtitle)
        self.assertEqual(len(matches), 1)

        rule, matched_text, pos = matches[0]
        self.assertIn("test@example.com", matched_text)
        self.assertEqual(rule.category, "email")

    def test_match_client(self):
        subtitle = Subtitle(
            id=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=5),
            text="张总对这个方案很满意"
        )

        matches = self.engine.match_subtitle(subtitle)
        self.assertGreater(len(matches), 0)

    def test_multiple_matches(self):
        subtitle = Subtitle(
            id=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=5),
            text="张总电话是13812345678，邮箱是zhang@example.com"
        )

        matches = self.engine.match_subtitle(subtitle)
        self.assertGreater(len(matches), 1)

    def test_scan_for_sensitive_words(self):
        subtitles = [
            Subtitle(id=1, start_time=timedelta(0), end_time=timedelta(seconds=5),
                     text="正常的对话内容"),
            Subtitle(id=2, start_time=timedelta(seconds=5), end_time=timedelta(seconds=10),
                     text="张总电话是13812345678")
        ]

        issues = self.engine.scan_for_sensitive_words(subtitles)

        sensitive_issues = [i for i in issues if i.issue_type == IssueType.SENSITIVE_WORD]
        self.assertGreater(len(sensitive_issues), 0)

    def test_get_sensitive_statistics(self):
        subtitles = [
            Subtitle(id=1, start_time=timedelta(0), end_time=timedelta(seconds=5),
                     text="张总电话是13812345678"),
            Subtitle(id=2, start_time=timedelta(seconds=5), end_time=timedelta(seconds=10),
                     text="王总邮箱是wang@example.com")
        ]

        stats = self.engine.get_sensitive_statistics(subtitles)

        self.assertGreater(stats["total_matches"], 0)
        self.assertIn("phone", stats["by_category"])
        self.assertIn("email", stats["by_category"])

    def test_update_rules(self):
        new_rules = [
            SensitiveRule(
                id=1,
                pattern=r"测试",
                category="test",
                description="测试规则"
            )
        ]

        self.engine.update_rules(new_rules)

        subtitle = Subtitle(
            id=1,
            start_time=timedelta(0),
            end_time=timedelta(seconds=5),
            text="这是一个测试"
        )

        matches = self.engine.match_subtitle(subtitle)
        self.assertGreater(len(matches), 0)


class TestDefaultRules(unittest.TestCase):
    def test_create_default_rules(self):
        rules = create_default_rules()
        self.assertGreater(len(rules), 0)

        categories = [r.category for r in rules]
        self.assertIn("phone", categories)
        self.assertIn("email", categories)
        self.assertIn("project", categories)

    def test_default_rules_phone(self):
        rules = create_default_rules()
        engine = RuleEngine(rules)

        subtitle = Subtitle(
            id=1,
            start_time=timedelta(0),
            end_time=timedelta(seconds=5),
            text="手机号13987654321和固定电话010-12345678"
        )

        matches = engine.match_subtitle(subtitle)
        phone_matches = [m for m in matches if m[0].category == "phone"]
        self.assertGreater(len(phone_matches), 0)

    def test_default_rules_project(self):
        rules = create_default_rules()
        engine = RuleEngine(rules)

        subtitle = Subtitle(
            id=1,
            start_time=timedelta(0),
            end_time=timedelta(seconds=5),
            text="正在推进PROJ_2024_001和SPRINT_007两个保密项目"
        )

        matches = engine.match_subtitle(subtitle)
        project_matches = [m for m in matches if m[0].category == "project"]
        self.assertGreater(len(project_matches), 0)


if __name__ == "__main__":
    unittest.main()
