import unittest
from datetime import timedelta

from podcast_sanitizer.mask_mapper import MaskMapper
from podcast_sanitizer.rule_engine import RuleEngine
from podcast_sanitizer.models import Subtitle, SensitiveRule


class TestMaskMapper(unittest.TestCase):
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
        self.mapper = MaskMapper()

    def tearDown(self):
        self.mapper.reset()

    def test_get_mask_consistency(self):
        original = "13812345678"

        mask1 = self.mapper.get_mask(original, "phone", "[PHONE_{index}]")
        mask2 = self.mapper.get_mask(original, "phone", "[PHONE_{index}]")

        self.assertEqual(mask1, mask2)

    def test_get_mask_increment(self):
        mask1 = self.mapper.get_mask("13811111111", "phone", "[PHONE_{index}]")
        mask2 = self.mapper.get_mask("13822222222", "phone", "[PHONE_{index}]")
        mask3 = self.mapper.get_mask("13833333333", "phone", "[PHONE_{index}]")

        self.assertIn("1", mask1)
        self.assertIn("2", mask2)
        self.assertIn("3", mask3)

    def test_get_original(self):
        original = "13812345678"
        mask = self.mapper.get_mask(original, "phone", "[PHONE_{index}]")

        recovered = self.mapper.get_original(mask)
        self.assertEqual(recovered, original)

    def test_get_original_unknown(self):
        unknown = "[UNKNOWN_999]"
        recovered = self.mapper.get_original(unknown)
        self.assertEqual(recovered, unknown)

    def test_mask_subtitle(self):
        subtitle = Subtitle(
            id=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=5),
            text="张总电话是13812345678"
        )

        sanitized, mappings = self.mapper.mask_subtitle(subtitle, self.engine)

        self.assertEqual(sanitized.id, 1)
        self.assertTrue(sanitized.has_sensitive)
        self.assertNotEqual(sanitized.masked_text, subtitle.text)
        self.assertGreater(len(mappings), 0)

        for mapping in mappings:
            self.assertIn(mapping.original_text, subtitle.text)
            self.assertIn(mapping.masked_text, sanitized.masked_text)

    def test_mask_subtitle_no_sensitive(self):
        subtitle = Subtitle(
            id=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=5),
            text="这是一段正常的对话内容"
        )

        sanitized, mappings = self.mapper.mask_subtitle(subtitle, self.engine)

        self.assertEqual(sanitized.id, 1)
        self.assertFalse(sanitized.has_sensitive)
        self.assertEqual(sanitized.masked_text, subtitle.text)
        self.assertEqual(len(mappings), 0)

    def test_mask_subtitle_multiple_sensitive(self):
        subtitle = Subtitle(
            id=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=5),
            text="张总电话是13812345678，邮箱是zhang@example.com"
        )

        sanitized, mappings = self.mapper.mask_subtitle(subtitle, self.engine)

        self.assertTrue(sanitized.has_sensitive)
        self.assertGreater(len(mappings), 1)

        categories = [m.category for m in mappings]
        self.assertIn("phone", categories)
        self.assertIn("email", categories)
        self.assertIn("client", categories)

    def test_mask_all_subtitles(self):
        subtitles = [
            Subtitle(id=1, start_time=timedelta(0), end_time=timedelta(seconds=5),
                     text="张总电话是13812345678"),
            Subtitle(id=2, start_time=timedelta(seconds=5), end_time=timedelta(seconds=10),
                     text="正常的内容"),
            Subtitle(id=3, start_time=timedelta(seconds=10), end_time=timedelta(seconds=15),
                     text="王总邮箱是wang@example.com")
        ]

        sanitized_list, mappings = self.mapper.mask_all_subtitles(subtitles, self.engine)

        self.assertEqual(len(sanitized_list), 3)
        self.assertGreater(len(mappings), 0)

        sensitive_count = sum(1 for s in sanitized_list if s.has_sensitive)
        self.assertEqual(sensitive_count, 2)

    def test_get_statistics(self):
        subtitles = [
            Subtitle(id=1, start_time=timedelta(0), end_time=timedelta(seconds=5),
                     text="张总电话是13812345678"),
            Subtitle(id=2, start_time=timedelta(seconds=5), end_time=timedelta(seconds=10),
                     text="王总电话是13987654321")
        ]

        self.mapper.mask_all_subtitles(subtitles, self.engine)
        stats = self.mapper.get_statistics()

        self.assertGreater(stats["total_masked_items"], 0)
        self.assertIn("phone", stats["by_category"])
        self.assertIn("client", stats["by_category"])

    def test_reset(self):
        subtitle = Subtitle(
            id=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=5),
            text="张总电话是13812345678"
        )

        self.mapper.mask_subtitle(subtitle, self.engine)
        stats_before = self.mapper.get_statistics()
        self.assertGreater(stats_before["total_masked_items"], 0)

        self.mapper.reset()
        stats_after = self.mapper.get_statistics()
        self.assertEqual(stats_after["total_masked_items"], 0)


class TestMaskTemplate(unittest.TestCase):
    def test_default_template(self):
        mapper = MaskMapper()
        mask = mapper.get_mask("13812345678", "phone", "[PHONE_{index}]")
        self.assertEqual(mask, "[PHONE_1]")

    def test_custom_template(self):
        mapper = MaskMapper()
        mask = mapper.get_mask("13812345678", "phone", "***PHONE***_{index}***")
        self.assertEqual(mask, "***PHONE***_1***")

    def test_category_uppercase(self):
        mapper = MaskMapper()
        mask = mapper.get_mask("test@example.com", "email", "[{category}_{index}]")
        self.assertEqual(mask, "[EMAIL_1]")


if __name__ == "__main__":
    unittest.main()
