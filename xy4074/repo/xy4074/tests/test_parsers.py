import tempfile
from pathlib import Path
from datetime import datetime

import pytest

from classroom_cluster.models import TimeRange, QuestionItem, SourceType
from classroom_cluster.parsers import SRTParser, ChatParser, OutlineParser


class TestTimeRange:
    def test_from_srt_timestamp(self):
        tr = TimeRange.from_srt_timestamp("00:01:30,500 --> 00:02:45,123")
        assert tr.start_seconds == 90.5
        assert tr.end_seconds == 165.123
    
    def test_to_srt_format(self):
        tr = TimeRange(start_seconds=90.5, end_seconds=165.123)
        srt_str = tr.to_srt_format()
        assert "00:01:30,500" in srt_str
        assert "00:02:45,123" in srt_str
    
    def test_overlaps_with(self):
        tr1 = TimeRange(start_seconds=0, end_seconds=10)
        tr2 = TimeRange(start_seconds=5, end_seconds=15)
        tr3 = TimeRange(start_seconds=15, end_seconds=20)
        
        assert tr1.overlaps_with(tr2)
        assert not tr1.overlaps_with(tr3)
        assert tr1.overlaps_with(tr3, tolerance=1.0)


class TestSRTParser:
    def create_test_srt(self, tmp_path: Path) -> Path:
        srt_content = """1
00:00:30,000 --> 00:00:35,000
学员A: 老师，这个API接口的参数怎么理解？

2
00:00:36,000 --> 00:00:40,000
讲师: 好问题，我们来看一下文档

3
00:01:15,000 --> 00:01:20,000
学员B: 请问这个认证流程具体是怎么执行的？
"""
        srt_file = tmp_path / "test.srt"
        srt_file.write_text(srt_content, encoding="utf-8")
        return srt_file
    
    def test_parse_srt(self, tmp_path):
        srt_file = self.create_test_srt(tmp_path)
        parser = SRTParser(srt_file)
        blocks = parser.parse()
        
        assert len(blocks) == 3
        assert blocks[0].speaker == "学员A"
        assert blocks[1].speaker == "讲师"
        assert "API接口的参数" in blocks[0].text
    
    def test_extract_questions(self, tmp_path):
        srt_file = self.create_test_srt(tmp_path)
        parser = SRTParser(srt_file)
        parser.parse()
        questions = parser.extract_questions()
        
        assert len(questions) >= 2
        for q in questions:
            assert q.source_type == SourceType.SUBTITLE
            assert q.time_range is not None


class TestChatParser:
    def create_test_csv(self, tmp_path: Path) -> Path:
        csv_content = """timestamp,speaker,content
2024-01-15 14:00:30,学员A,老师，API接口的参数不太理解
2024-01-15 14:01:15,学员B,认证流程具体怎么执行的？
2024-01-15 14:02:00,学员C,谢谢老师讲解
"""
        csv_file = tmp_path / "test_chat.csv"
        csv_file.write_text(csv_content, encoding="utf-8")
        return csv_file
    
    def test_parse_csv(self, tmp_path):
        csv_file = self.create_test_csv(tmp_path)
        parser = ChatParser(csv_file)
        messages = parser.parse()
        
        assert len(messages) == 3
        assert messages[0].speaker == "学员A"
        assert messages[1].content == "认证流程具体怎么执行的？"
    
    def test_extract_questions(self, tmp_path):
        csv_file = self.create_test_csv(tmp_path)
        parser = ChatParser(csv_file)
        parser.parse()
        questions = parser.extract_questions()
        
        assert len(questions) == 2
        for q in questions:
            assert q.source_type == SourceType.CHAT


class TestOutlineParser:
    def create_test_yaml(self, tmp_path: Path) -> Path:
        yaml_content = """- title: 第一章：API接口基础
  description: 学习RESTful API的基本概念
  time: "00:00:00"
  keywords:
    - API
    - RESTful

- title: 第二章：认证与授权
  description: 深入理解OAuth2.0认证流程
  time: "00:01:00"
  keywords:
    - OAuth2.0
    - 认证
"""
        yaml_file = tmp_path / "test_outline.yaml"
        yaml_file.write_text(yaml_content, encoding="utf-8")
        return yaml_file
    
    def test_parse_yaml(self, tmp_path):
        yaml_file = self.create_test_yaml(tmp_path)
        parser = OutlineParser(yaml_file)
        chapters = parser.parse()
        
        assert len(chapters) == 2
        assert chapters[0].title == "第一章：API接口基础"
        assert chapters[1].time_range is not None
        assert chapters[1].time_range.start_seconds == 60.0
    
    def test_find_chapter_by_time(self, tmp_path):
        yaml_file = self.create_test_yaml(tmp_path)
        parser = OutlineParser(yaml_file)
        chapters = parser.parse()
        
        chapter = parser.find_chapter_by_time(30.0)
        assert chapter is not None
        assert "API接口" in chapter.title
        
        chapter = parser.find_chapter_by_time(90.0)
        assert chapter is not None
        assert "认证" in chapter.title
