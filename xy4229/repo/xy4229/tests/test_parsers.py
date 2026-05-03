"""解析器测试"""
import unittest
import sys
import os
from datetime import timedelta

# 添加项目根目录到路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.parsers.srt_parser import SRTParser
from src.models.models import Subtitle, parse_srt_time, timedelta_to_srt_format


class TestSRTParser(unittest.TestCase):
    """SRT 解析器测试"""
    
    def test_parse_simple_srt(self):
        """测试解析简单的 SRT 内容"""
        srt_content = """1
00:00:01,000 --> 00:00:03,000
第一条字幕

2
00:00:03,500 --> 00:00:05,000
第二条字幕
"""
        
        subtitles = SRTParser.parse(srt_content)
        
        self.assertEqual(len(subtitles), 2)
        self.assertEqual(subtitles[0].index, 1)
        self.assertEqual(subtitles[0].start_time, timedelta(seconds=1))
        self.assertEqual(subtitles[0].end_time, timedelta(seconds=3))
        self.assertEqual(subtitles[0].text, "第一条字幕")
        
        self.assertEqual(subtitles[1].index, 2)
        self.assertEqual(subtitles[1].start_time, timedelta(seconds=3.5))
        self.assertEqual(subtitles[1].end_time, timedelta(seconds=5))
        self.assertEqual(subtitles[1].text, "第二条字幕")
    
    def test_parse_with_speaker(self):
        """测试解析带说话人标注的字幕"""
        srt_content = """1
00:00:01,000 --> 00:00:03,000
[张三] 你好，世界

2
00:00:03,500 --> 00:00:05,000
李四：你好，张三
"""
        
        subtitles = SRTParser.parse(srt_content)
        
        self.assertEqual(len(subtitles), 2)
        self.assertEqual(subtitles[0].speaker, "张三")
        self.assertEqual(subtitles[1].speaker, "李四")
    
    def test_parse_sound_effect(self):
        """测试解析音效字幕"""
        srt_content = """1
00:00:01,000 --> 00:00:03,000
[敲门声]

2
00:00:03,500 --> 00:00:05,000
【电话铃声】

3
00:00:05,500 --> 00:00:06,000
(爆炸声)
"""
        
        subtitles = SRTParser.parse(srt_content)
        
        self.assertEqual(len(subtitles), 3)
        self.assertTrue(subtitles[0].sound_effect)
        self.assertTrue(subtitles[1].sound_effect)
        self.assertTrue(subtitles[2].sound_effect)
    
    def test_to_srt(self):
        """测试将字幕转换为 SRT 格式"""
        subtitles = [
            Subtitle(
                index=1,
                start_time=timedelta(seconds=1.5),
                end_time=timedelta(seconds=3.5),
                text="测试字幕"
            )
        ]
        
        srt_output = SRTParser.to_srt(subtitles)
        
        self.assertIn("1", srt_output)
        self.assertIn("00:00:01,500", srt_output)
        self.assertIn("00:00:03,500", srt_output)
        self.assertIn("测试字幕", srt_output)
    
    def test_parse_srt_time(self):
        """测试解析 SRT 时间格式"""
        self.assertEqual(parse_srt_time("00:00:01,000"), timedelta(seconds=1))
        self.assertEqual(parse_srt_time("00:01:30,500"), timedelta(minutes=1, seconds=30.5))
        self.assertEqual(parse_srt_time("01:02:03,123"), timedelta(hours=1, minutes=2, seconds=3.123))
    
    def test_timedelta_to_srt_format(self):
        """测试将 timedelta 转换为 SRT 时间格式"""
        self.assertEqual(timedelta_to_srt_format(timedelta(seconds=1)), "00:00:01,000")
        self.assertEqual(timedelta_to_srt_format(timedelta(minutes=1, seconds=30.5)), "00:01:30,500")
        self.assertEqual(timedelta_to_srt_format(timedelta(hours=1, minutes=2, seconds=3.123)), "01:02:03,123")


class TestSubtitleModel(unittest.TestCase):
    """字幕数据模型测试"""
    
    def test_subtitle_duration(self):
        """测试字幕持续时间计算"""
        sub = Subtitle(
            index=1,
            start_time=timedelta(seconds=1),
            end_time=timedelta(seconds=4),
            text="测试"
        )
        
        self.assertEqual(sub.duration, timedelta(seconds=3))
    
    def test_subtitle_word_count(self):
        """测试字幕字数计算"""
        sub = Subtitle(
            index=1,
            start_time=timedelta(seconds=1),
            end_time=timedelta(seconds=4),
            text="这是一个测试字幕"
        )
        
        self.assertEqual(sub.word_count, 8)
    
    def test_subtitle_reading_speed(self):
        """测试阅读速度计算"""
        sub = Subtitle(
            index=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=2),
            text="这是一个测试"  # 6个字
        )
        
        # 6字 / 2秒 = 3字/秒
        self.assertEqual(sub.reading_speed, 3.0)
    
    def test_apply_offset(self):
        """测试应用时间偏移"""
        sub = Subtitle(
            index=1,
            start_time=timedelta(seconds=1),
            end_time=timedelta(seconds=3),
            text="测试"
        )
        
        # 应用 +0.5 秒偏移
        sub.apply_offset(timedelta(seconds=0.5))
        
        self.assertEqual(sub.start_time, timedelta(seconds=1.5))
        self.assertEqual(sub.end_time, timedelta(seconds=3.5))
        self.assertEqual(sub.offset_applied, timedelta(seconds=0.5))
        
        # 原始时间应保持不变
        self.assertEqual(sub.original_start_time, timedelta(seconds=1))
        self.assertEqual(sub.original_end_time, timedelta(seconds=3))


if __name__ == '__main__':
    unittest.main()
