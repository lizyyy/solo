import tempfile
from datetime import timedelta
from pathlib import Path

import pytest

from subtitle_inspector.subtitle_parser import (
    parse_srt_time,
    clean_srt_text,
    clean_ass_text,
    SRTSubtitleParser,
    parse_subtitle_file,
)


class TestParseSrtTime:
    def test_basic_format(self):
        td = parse_srt_time("00:00:03,000")
        assert td == timedelta(seconds=3)
    
    def test_with_milliseconds(self):
        td = parse_srt_time("00:00:05,500")
        assert td == timedelta(seconds=5, milliseconds=500)
    
    def test_hours_minutes(self):
        td = parse_srt_time("01:30:00,000")
        assert td == timedelta(hours=1, minutes=30)
    
    def test_dot_separator(self):
        td = parse_srt_time("00:00:10.123")
        assert td == timedelta(seconds=10, milliseconds=123)


class TestCleanSrtText:
    def test_remove_html_tags(self):
        text = "<i>Hello</i> <b>World</b>"
        assert clean_srt_text(text) == "Hello World"
    
    def test_remove_ass_tags(self):
        text = "{\\i1}Italic{\\i0} Text"
        assert clean_srt_text(text) == "Italic Text"
    
    def test_preserve_normal_text(self):
        text = "这是正常的字幕文本"
        assert clean_srt_text(text) == "这是正常的字幕文本"


class TestCleanAssText:
    def test_remove_ass_commands(self):
        text = "{\\pos(100,200)\\bord2}Hello\\NWorld"
        assert clean_ass_text(text) == "Hello\nWorld"
    
    def test_newline_conversion(self):
        text = "Line1\\NLine2\\nInline"
        assert clean_ass_text(text) == "Line1\nLine2 Inline"


class TestSRTSubtitleParser:
    def test_parse_basic_srt(self):
        content = """1
00:00:01,000 --> 00:00:03,000
第一条字幕

2
00:00:04,000 --> 00:00:06,000
第二条字幕
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", delete=False) as f:
            f.write(content)
            temp_path = Path(f.name)
        
        try:
            parser = SRTSubtitleParser(temp_path, encoding="utf-8")
            result = parser.parse()
            
            assert result.format == "srt"
            assert len(result.entries) == 2
            
            entry1 = result.entries[0]
            assert entry1.index == 1
            assert entry1.start_time == timedelta(seconds=1)
            assert entry1.end_time == timedelta(seconds=3)
            assert entry1.text == "第一条字幕"
            
            entry2 = result.entries[1]
            assert entry2.index == 2
            assert entry2.start_time == timedelta(seconds=4)
        finally:
            temp_path.unlink()
    
    def test_parse_with_tags(self):
        content = """1
00:00:01,000 --> 00:00:03,000
<i>斜体文本</i>

2
00:00:04,000 --> 00:00:06,000
{\\b1}粗体文本{\\b0}
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", delete=False) as f:
            f.write(content)
            temp_path = Path(f.name)
        
        try:
            parser = SRTSubtitleParser(temp_path, encoding="utf-8")
            result = parser.parse()
            
            assert result.entries[0].text == "斜体文本"
            assert result.entries[1].text == "粗体文本"
        finally:
            temp_path.unlink()
    
    def test_language_detection(self):
        content = """1
00:00:01,000 --> 00:00:03,000
这是中文字幕

2
00:00:04,000 --> 00:00:06,000
继续中文
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", delete=False, prefix="zh_") as f:
            f.write(content)
            temp_path = Path(f.name)
        
        try:
            parser = SRTSubtitleParser(temp_path, encoding="utf-8")
            result = parser.parse()
            
            assert result.language == "zh-CN"
        finally:
            temp_path.unlink()


class TestParseSubtitleFile:
    def test_parse_srt(self):
        content = """1
00:00:01,000 --> 00:00:03,000
Test subtitle
"""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".srt", delete=False) as f:
            f.write(content)
            temp_path = Path(f.name)
        
        try:
            result = parse_subtitle_file(temp_path, encoding="utf-8")
            assert result.format == "srt"
            assert len(result.entries) == 1
        finally:
            temp_path.unlink()
    
    def test_invalid_format(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("invalid")
            temp_path = Path(f.name)
        
        try:
            with pytest.raises(ValueError, match="Unsupported subtitle format"):
                parse_subtitle_file(temp_path)
        finally:
            temp_path.unlink()
