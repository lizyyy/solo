"""解析模块测试"""

import json
import tempfile
from pathlib import Path

import pytest
import yaml

from interview_bias_audit.parser import (
    CandidatesParser,
    CompetencyDictParser,
    NotesParser,
    RulesParser,
)


class TestCandidatesParser:
    def test_parse_valid_csv(self):
        content = "candidate_id,name,position,score\nC001,张三,后端,85"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(content)
            f.flush()
            parser = CandidatesParser()
            result = parser.parse(Path(f.name))

        assert len(result) == 1
        assert result[0]["candidate_id"] == "C001"
        assert result[0]["name"] == "张三"

    def test_parse_empty_csv(self):
        content = "candidate_id,name,position,score\n"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
            f.write(content)
            f.flush()
            parser = CandidatesParser()
            result = parser.parse(Path(f.name))

        assert len(result) == 0


class TestNotesParser:
    def test_parse_valid_jsonl(self):
        content = '{"candidate_id": "C001", "notes": "测试"}\n{"candidate_id": "C002", "notes": "测试2"}'
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write(content)
            f.flush()
            parser = NotesParser()
            result = parser.parse(Path(f.name))

        assert len(result) == 2
        assert result[0]["candidate_id"] == "C001"

    def test_parse_jsonl_with_empty_lines(self):
        content = '{"candidate_id": "C001", "notes": "测试"}\n\n{"candidate_id": "C002", "notes": "测试2"}'
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write(content)
            f.flush()
            parser = NotesParser()
            result = parser.parse(Path(f.name))

        assert len(result) == 2


class TestRulesParser:
    def test_parse_valid_yaml(self):
        content = "thresholds:\n  high_score: 85.0\n  low_score: 50.0"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(content)
            f.flush()
            parser = RulesParser()
            result = parser.parse(Path(f.name))

        assert result["thresholds"]["high_score"] == 85.0
        assert result["thresholds"]["low_score"] == 50.0


class TestCompetencyDictParser:
    def test_parse_valid_yaml(self):
        content = "competencies:\n  技术基础:\n    keywords:\n      - 算法\n      - 数据库"
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            f.write(content)
            f.flush()
            parser = CompetencyDictParser()
            result = parser.parse(Path(f.name))

        assert "技术基础" in result
        assert "算法" in result["技术基础"]
