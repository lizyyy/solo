import pytest
from datetime import timedelta
from src.subtitle_fixer.parser import SRTParser, CSVParser, ChapterParser, ParseError
from src.subtitle_fixer.models import Speaker


class TestSRTParser:
    def test_parse_basic_srt(self):
        srt_content = """1
00:00:02,500 --> 00:00:06,000
欢迎收听今天的节目

2
00:00:06,500 --> 00:00:08,200
很高兴见到大家
"""
        parser = SRTParser()
        subtitles = parser.parse_string(srt_content)
        
        assert len(subtitles) == 2
        assert subtitles[0].index == 1
        assert subtitles[0].start_time == timedelta(seconds=2, milliseconds=500)
        assert subtitles[0].end_time == timedelta(seconds=6)
        assert subtitles[0].text == "欢迎收听今天的节目"
    
    def test_parse_with_speaker_extraction(self):
        srt_content = """1
00:00:02,500 --> 00:00:06,000
【主持人】欢迎收听今天的节目

2
00:00:06,500 --> 00:00:08,200
张三: 很高兴见到大家
"""
        parser = SRTParser(auto_extract_speaker=True)
        subtitles = parser.parse_string(srt_content)
        
        assert subtitles[0].speaker == "主持人"
        assert subtitles[1].speaker == "张三"
    
    def test_parse_with_speaker_list(self):
        srt_content = """1
00:00:02,500 --> 00:00:06,000
【张老师】欢迎收听今天的节目
"""
        parser = SRTParser(auto_extract_speaker=True)
        speakers = [
            Speaker(name="张三", alias=["张老师", "张先生"], role="嘉宾")
        ]
        parser.set_speaker_list(speakers)
        
        subtitles = parser.parse_string(srt_content)
        assert subtitles[0].speaker == "张三"
    
    def test_invalid_time_format_raises_error(self):
        srt_content = """1
invalid_time --> 00:00:06,000
欢迎收听今天的节目
"""
        parser = SRTParser()
        with pytest.raises(ParseError):
            parser.parse_string(srt_content)


class TestCSVParser:
    def test_parse_basic_csv(self):
        csv_content = """姓名,别名,角色,是否嘉宾
主持人,主播,节目主持人,否
张三,张老师|张先生,技术专家,是
"""
        parser = CSVParser()
        speakers = parser.parse_string(csv_content)
        
        assert len(speakers) == 2
        assert speakers[0].name == "主持人"
        assert speakers[0].is_guest == False
        assert speakers[1].name == "张三"
        assert speakers[1].alias == ["张老师", "张先生"]
        assert speakers[1].is_guest == True
    
    def test_parse_with_different_headers(self):
        csv_content = """name,nickname,role,guest
李四,李博士,研究员,yes
"""
        parser = CSVParser()
        speakers = parser.parse_string(csv_content)
        
        assert len(speakers) == 1
        assert speakers[0].name == "李四"
        assert speakers[0].is_guest == True


class TestChapterParser:
    def test_parse_basic_chapters(self):
        chapter_content = """00:00:00 开场介绍
00:05:30 主题讨论
00:15:00 总结收尾
"""
        parser = ChapterParser()
        chapters = parser.parse_string(chapter_content)
        
        assert len(chapters) == 3
        assert chapters[0].title == "开场介绍"
        assert chapters[0].start_time == timedelta(seconds=0)
        assert chapters[1].title == "主题讨论"
        assert chapters[1].start_time == timedelta(minutes=5, seconds=30)
    
    def test_parse_with_comments(self):
        chapter_content = """# 这是注释
00:00:00 开场介绍
# 另一个注释
00:05:30 主题讨论
"""
        parser = ChapterParser()
        chapters = parser.parse_string(chapter_content)
        
        assert len(chapters) == 2
    
    def test_parse_minutes_only_format(self):
        chapter_content = """0:00 开场介绍
5:30 主题讨论
15:00 总结收尾
"""
        parser = ChapterParser()
        chapters = parser.parse_string(chapter_content)
        
        assert len(chapters) == 3
        assert chapters[1].start_time == timedelta(minutes=5, seconds=30)
    
    def test_chapter_end_times_filled(self):
        chapter_content = """00:00:00 开场介绍
00:05:30 主题讨论
00:15:00 总结收尾
"""
        parser = ChapterParser(default_duration_minutes=5.0)
        chapters = parser.parse_string(chapter_content)
        
        assert chapters[0].end_time == timedelta(minutes=5, seconds=30)
        assert chapters[1].end_time == timedelta(minutes=15)
        assert chapters[2].end_time == timedelta(minutes=20)
