import pytest
from pathlib import Path
from datetime import datetime


class TestEvidenceCSVParser:
    def test_parse_csv_file(self, temp_dir, sample_csv_content):
        csv_path = temp_dir / "证据目录.csv"
        csv_path.write_text(sample_csv_content, encoding="utf-8")

        from court_evidence_checker.parsers import EvidenceCSVParser

        parser = EvidenceCSVParser()
        result = parser.parse(csv_path)

        assert result.success is True
        assert result.evidence_catalog is not None
        assert len(result.evidence_catalog.evidences) == 2

        evidence1 = result.evidence_catalog.evidences[0]
        assert evidence1.evidence_number == "1"
        assert evidence1.name == "货物买卖合同"
        assert "合同" in evidence1.aliases
        assert "买卖合同" in evidence1.aliases

        evidence2 = result.evidence_catalog.evidences[1]
        assert evidence2.evidence_number == "2"
        assert evidence2.name == "送货单"

    def test_parse_csv_content(self, sample_csv_content):
        from court_evidence_checker.parsers import EvidenceCSVParser

        parser = EvidenceCSVParser()
        result = parser.parse_content(sample_csv_content)

        assert result.success is True
        assert len(result.evidence_catalog.evidences) == 2

    def test_parse_invalid_csv(self):
        from court_evidence_checker.parsers import EvidenceCSVParser

        parser = EvidenceCSVParser()
        result = parser.parse_content("无效的CSV内容\n,,,\n")

        assert result.success is False

    def test_extract_evidence_number_from_csv(self, temp_dir):
        from court_evidence_checker.parsers import EvidenceCSVParser

        csv_content = """证据编号,证据名称,证据类型
123,测试证据,书证
A-001,另一个证据,书证
"""
        csv_path = temp_dir / "test.csv"
        csv_path.write_text(csv_content, encoding="utf-8")

        parser = EvidenceCSVParser()
        result = parser.parse(csv_path)

        assert result.success is True
        numbers = [e.evidence_number for e in result.evidence_catalog.evidences]
        assert "123" in numbers
        assert "A-001" in numbers


class TestMarkdownTranscriptParser:
    def test_parse_markdown_file(self, temp_dir, sample_markdown_content):
        md_path = temp_dir / "庭审笔录.md"
        md_path.write_text(sample_markdown_content, encoding="utf-8")

        from court_evidence_checker.parsers import MarkdownTranscriptParser

        parser = MarkdownTranscriptParser()
        result = parser.parse(md_path)

        assert result.success is True
        assert result.raw_content == sample_markdown_content

    def test_extract_evidence_references(self, sample_markdown_content):
        from court_evidence_checker.parsers import MarkdownTranscriptParser

        parser = MarkdownTranscriptParser()
        result = parser.parse_content(sample_markdown_content)

        assert result.success is True

        evidence_numbers = [ref.evidence_number for ref in result.references]
        assert "1" in evidence_numbers
        assert "2" in evidence_numbers

    def test_evidence_patterns(self):
        from court_evidence_checker.parsers import MarkdownTranscriptParser

        test_cases = [
            ("证据1：货物买卖合同", "1"),
            ("第1号证据：送货单", "1"),
            ("证据编号：A-001", "A-001"),
            ("证123", "123"),
            ("第 45 份证据", "45"),
        ]

        parser = MarkdownTranscriptParser()

        for text, expected in test_cases:
            result = parser.parse_content(text)
            numbers = [ref.evidence_number for ref in result.references]
            assert expected in numbers, f"未能从 '{text}' 中提取证据编号 {expected}"

    def test_extract_dates(self):
        from court_evidence_checker.parsers import MarkdownTranscriptParser

        content_with_dates = """
        原告于2025年3月15日签订合同。
        被告于2025-03-18收到货物。
        庭审日期：2026/04/15
        """

        parser = MarkdownTranscriptParser()
        result = parser.parse_content(content_with_dates)

        assert result.success is True

        dates = [ref.extracted_date for ref in result.references if ref.extracted_date]
        assert len(dates) > 0


class TestCrossExaminationJSONParser:
    def test_parse_json_file(self, temp_dir, sample_json_content):
        json_path = temp_dir / "举证质证记录.json"
        json_path.write_text(sample_json_content, encoding="utf-8")

        from court_evidence_checker.parsers import CrossExaminationJSONParser

        parser = CrossExaminationJSONParser()
        result = parser.parse(json_path)

        assert result.success is True

    def test_extract_references_from_json(self, sample_json_content):
        from court_evidence_checker.parsers import CrossExaminationJSONParser

        parser = CrossExaminationJSONParser()
        result = parser.parse_content(sample_json_content)

        assert result.success is True

        evidence_numbers = [ref.evidence_number for ref in result.references]
        assert "1" in evidence_numbers

    def test_extract_objections_from_json(self, sample_json_content):
        from court_evidence_checker.parsers import CrossExaminationJSONParser

        parser = CrossExaminationJSONParser()
        result = parser.parse_content(sample_json_content)

        assert result.success is True
        assert len(result.objections) == 1

        objection = result.objections[0]
        assert objection.objection_id == "obj_001"
        assert objection.status.value == "pending"

    def test_parse_invalid_json(self):
        from court_evidence_checker.parsers import CrossExaminationJSONParser

        parser = CrossExaminationJSONParser()
        result = parser.parse_content("无效的JSON内容")

        assert result.success is False


class TestJudgmentDraftParser:
    def test_parse_judgment_draft(self, temp_dir):
        from court_evidence_checker.parsers import JudgmentDraftParser

        judgment_content = """
        # 民事判决书（草稿）

        ## 事实认定

        原被告于2025年3月15日签订《货物买卖合同》（**证据1**）。
        原告已按约交付货物（**证据2**）。

        ## 裁判要点

        根据**证据1**和**证据2**，本院认定...
        """

        md_path = temp_dir / "裁判要点草稿.md"
        md_path.write_text(judgment_content, encoding="utf-8")

        parser = JudgmentDraftParser()
        result = parser.parse(md_path)

        assert result.success is True

        evidence_numbers = [ref.evidence_number for ref in result.references]
        assert "1" in evidence_numbers
        assert "2" in evidence_numbers

    def test_bold_evidence_pattern(self):
        from court_evidence_checker.parsers import JudgmentDraftParser

        test_content = """
        根据**证据1**的内容...
        参考**证据编号：A-001**...
        （**第2号证据**）
        """

        parser = JudgmentDraftParser()
        result = parser.parse_content(test_content)

        numbers = [ref.evidence_number for ref in result.references]
        assert "1" in numbers
        assert "A-001" in numbers
        assert "2" in numbers


class TestParserIntegration:
    def test_all_parsers_work_together(
        self, temp_dir, sample_csv_content, sample_markdown_content, sample_json_content
    ):
        csv_path = temp_dir / "证据目录.csv"
        csv_path.write_text(sample_csv_content, encoding="utf-8")

        md_path = temp_dir / "庭审笔录.md"
        md_path.write_text(sample_markdown_content, encoding="utf-8")

        json_path = temp_dir / "举证质证记录.json"
        json_path.write_text(sample_json_content, encoding="utf-8")

        from court_evidence_checker.parsers import (
            EvidenceCSVParser,
            MarkdownTranscriptParser,
            CrossExaminationJSONParser,
        )

        csv_parser = EvidenceCSVParser()
        csv_result = csv_parser.parse(csv_path)
        assert csv_result.success is True

        md_parser = MarkdownTranscriptParser()
        md_result = md_parser.parse(md_path)
        assert md_result.success is True

        json_parser = CrossExaminationJSONParser()
        json_result = json_parser.parse(json_path)
        assert json_result.success is True

        all_references = (
            csv_result.references + md_result.references + json_result.references
        )
        all_objections = json_result.objections

        assert len(all_references) > 0
        assert len(all_objections) >= 0
