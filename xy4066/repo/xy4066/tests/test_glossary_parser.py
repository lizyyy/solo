import json
import tempfile
from pathlib import Path
from unittest import TestCase

from glossary_guardian.parsers.glossary_parser import (
    ForbiddenTerm,
    GlossaryEntry,
    GlossaryParser,
    GuestEntry,
)


class TestGlossaryEntry(TestCase):
    def test_creation(self):
        entry = GlossaryEntry(
            chinese="人工智能",
            english="Artificial Intelligence",
            abbreviation="AI",
            category="技术术语",
            notes="核心技术",
            source="client",
            version="v1",
        )
        self.assertEqual(entry.chinese, "人工智能")
        self.assertEqual(entry.english, "Artificial Intelligence")
        self.assertEqual(entry.abbreviation, "AI")

    def test_to_dict(self):
        entry = GlossaryEntry(chinese="测试", english="Test")
        data = entry.to_dict()
        self.assertEqual(data["chinese"], "测试")
        self.assertEqual(data["english"], "Test")
        self.assertIn("version", data)

    def test_from_dict(self):
        data = {
            "chinese": "人工智能",
            "english": "Artificial Intelligence",
            "abbreviation": "AI",
            "category": "技术术语",
            "source": "client",
            "version": "v2",
        }
        entry = GlossaryEntry.from_dict(data)
        self.assertEqual(entry.chinese, "人工智能")
        self.assertEqual(entry.version, "v2")


class TestForbiddenTerm(TestCase):
    def test_creation(self):
        ft = ForbiddenTerm(
            term="智障",
            reason="侮辱性词汇",
            alternative="智力障碍",
            category="敏感词汇",
        )
        self.assertEqual(ft.term, "智障")
        self.assertEqual(ft.reason, "侮辱性词汇")

    def test_to_dict(self):
        ft = ForbiddenTerm(term="test", reason="reason")
        data = ft.to_dict()
        self.assertEqual(data["term"], "test")


class TestGuestEntry(TestCase):
    def test_creation(self):
        guest = GuestEntry(
            chinese_name="张三",
            english_name="Zhang San",
            aliases=["张总", "张先生"],
            title="CEO",
            organization="科技公司",
        )
        self.assertEqual(guest.chinese_name, "张三")
        self.assertIn("张总", guest.aliases)


class TestGlossaryParser(TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def test_parse_csv(self):
        csv_content = """中文,英文,缩写,分类
人工智能,Artificial Intelligence,AI,技术术语
机器学习,Machine Learning,ML,技术术语
"""
        csv_path = Path(self.temp_dir) / "terms.csv"
        csv_path.write_text(csv_content, encoding="utf-8")

        parser = GlossaryParser()
        entries = parser.parse_csv(csv_path)

        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0].chinese, "人工智能")
        self.assertEqual(entries[0].abbreviation, "AI")

    def test_parse_json(self):
        json_content = """[
            {"chinese": "人工智能", "english": "Artificial Intelligence", "abbreviation": "AI"},
            {"chinese": "机器学习", "english": "Machine Learning", "abbreviation": "ML"}
        ]"""
        json_path = Path(self.temp_dir) / "terms.json"
        json_path.write_text(json_content, encoding="utf-8")

        parser = GlossaryParser()
        entries = parser.parse_json(json_path)

        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0].chinese, "人工智能")

    def test_import_glossary_merge(self):
        csv1_content = """中文,英文,缩写
人工智能,Artificial Intelligence,AI
"""
        csv1_path = Path(self.temp_dir) / "terms1.csv"
        csv1_path.write_text(csv1_content, encoding="utf-8")

        csv2_content = """中文,英文,缩写
机器学习,Machine Learning,ML
"""
        csv2_path = Path(self.temp_dir) / "terms2.csv"
        csv2_path.write_text(csv2_content, encoding="utf-8")

        parser = GlossaryParser()
        merged1, conflicts1 = parser.import_glossary(csv1_path)
        merged2, conflicts2 = parser.import_glossary(csv2_path)

        self.assertEqual(len(conflicts1), 0)
        self.assertEqual(len(conflicts2), 0)
        self.assertEqual(len(parser.entries), 2)

    def test_import_glossary_conflict(self):
        csv1_content = """中文,英文,缩写
人工智能,Artificial Intelligence,AI
"""
        csv1_path = Path(self.temp_dir) / "terms1.csv"
        csv1_path.write_text(csv1_content, encoding="utf-8")

        csv2_content = """中文,英文,缩写
人工智能,AI System,AI
"""
        csv2_path = Path(self.temp_dir) / "terms2.csv"
        csv2_path.write_text(csv2_content, encoding="utf-8")

        parser = GlossaryParser()
        parser.import_glossary(csv1_path)
        merged, conflicts = parser.import_glossary(csv2_path)

        self.assertGreater(len(conflicts), 0)

    def test_get_abbreviations(self):
        csv_content = """中文,英文,缩写
人工智能,Artificial Intelligence,AI
机器学习,Machine Learning,ML
深度学习,Deep Learning,DL
"""
        csv_path = Path(self.temp_dir) / "terms.csv"
        csv_path.write_text(csv_content, encoding="utf-8")

        parser = GlossaryParser()
        parser.import_glossary(csv_path)

        abbreviations = parser.get_abbreviations()
        self.assertEqual(len(abbreviations), 3)
        self.assertIn("ai", abbreviations)
        self.assertIn("ml", abbreviations)
        self.assertIn("dl", abbreviations)

    def test_get_duplicate_abbreviations(self):
        csv_content = """中文,英文,缩写
人工智能,Artificial Intelligence,AI
图像识别,Image Recognition,IR
信息检索,Information Retrieval,IR
"""
        csv_path = Path(self.temp_dir) / "terms.csv"
        csv_path.write_text(csv_content, encoding="utf-8")

        parser = GlossaryParser()
        parser.import_glossary(csv_path)

        duplicates = parser.get_duplicate_abbreviations()
        self.assertEqual(len(duplicates), 1)
        self.assertIn("ir", duplicates)
        self.assertEqual(len(duplicates["ir"]), 2)

    def test_parse_forbidden_terms_csv(self):
        csv_content = """禁用词,原因,替代词,分类
智障,侮辱性词汇,智力障碍,敏感词汇
最好的,绝对化词汇,优秀的,广告合规
"""
        csv_path = Path(self.temp_dir) / "forbidden.csv"
        csv_path.write_text(csv_content, encoding="utf-8")

        parser = GlossaryParser()
        forbidden = parser.parse_forbidden_terms_csv(csv_path)

        self.assertEqual(len(forbidden), 2)
        self.assertEqual(forbidden[0].term, "智障")
        self.assertEqual(forbidden[1].alternative, "优秀的")

    def test_parse_guest_list_csv(self):
        csv_content = """中文名,英文名,别名,职位,单位
张三,Zhang San,张总,CEO,科技公司
李四,Li Si,李博士,CTO,科技公司
"""
        csv_path = Path(self.temp_dir) / "guests.csv"
        csv_path.write_text(csv_content, encoding="utf-8")

        parser = GlossaryParser()
        guests = parser.parse_guest_list_csv(csv_path)

        self.assertEqual(len(guests), 2)
        self.assertEqual(guests[0].chinese_name, "张三")
        self.assertIn("张总", guests[0].aliases)
        self.assertEqual(guests[1].english_name, "Li Si")

    def test_export_to_json(self):
        parser = GlossaryParser()
        parser.entries["测试|test"] = GlossaryEntry(
            chinese="测试",
            english="Test",
            abbreviation="T",
        )
        parser.forbidden_terms.append(ForbiddenTerm(term="禁止"))
        parser.guests.append(GuestEntry(chinese_name="客人"))

        json_path = Path(self.temp_dir) / "exported.json"
        parser.export_to_json(json_path)

        self.assertTrue(json_path.exists())

        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.assertIn("glossary", data)
        self.assertIn("forbidden_terms", data)
        self.assertIn("guests", data)
