"""
音频元数据解析模块测试
"""

import unittest
import tempfile
import os
import sys

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from audio_metadata import (
    AudioFormat,
    AudioMetadata,
    AudioAnalyzer,
    ProgramScheduleItem
)


class TestProgramScheduleItem(unittest.TestCase):
    """测试节目单条目"""
    
    def test_time_conversion(self):
        """测试时间转换"""
        # 测试 HH:MM:SS 转秒
        self.assertEqual(ProgramScheduleItem._time_to_seconds("01:30:00"), 5400)
        self.assertEqual(ProgramScheduleItem._time_to_seconds("00:01:30"), 90)
        self.assertEqual(ProgramScheduleItem._time_to_seconds("00:00:30"), 30)
        
        # 测试 HH:MM 转秒
        self.assertEqual(ProgramScheduleItem._time_to_seconds("01:30"), 5400)
        self.assertEqual(ProgramScheduleItem._time_to_seconds("00:05"), 300)
        
        # 测试秒转时间
        self.assertEqual(ProgramScheduleItem._seconds_to_time(5400), "01:30:00.000")
        self.assertEqual(ProgramScheduleItem._seconds_to_time(90.5), "00:01:30.500")
    
    def test_item_creation(self):
        """测试条目创建"""
        item = ProgramScheduleItem(
            item_id="P001",
            title="测试节目",
            start_time="08:00:00",
            duration_seconds=300,
            audio_file="test.mp3",
            item_type="program",
            notes="测试备注"
        )
        
        self.assertEqual(item.item_id, "P001")
        self.assertEqual(item.title, "测试节目")
        self.assertEqual(item.start_time, "08:00:00")
        self.assertEqual(item.duration_seconds, 300)
        self.assertEqual(item.audio_file, "test.mp3")
        self.assertEqual(item.item_type, "program")
        self.assertEqual(item.notes, "测试备注")
        
        # 测试计算属性
        self.assertEqual(item.end_time_seconds, 8 * 3600 + 300)
        self.assertEqual(item.type_display, "节目")
        self.assertEqual(item.duration_formatted, "05:00")
    
    def test_to_dict(self):
        """测试转换为字典"""
        item = ProgramScheduleItem(
            item_id="A001",
            title="测试广告",
            start_time="09:00:00",
            duration_seconds=30,
            audio_file="ad.mp3",
            item_type="ad"
        )
        
        data = item.to_dict()
        
        self.assertEqual(data["item_id"], "A001")
        self.assertEqual(data["title"], "测试广告")
        self.assertEqual(data["type_display"], "广告")
        self.assertEqual(data["duration_seconds"], 30)


class TestAudioMetadata(unittest.TestCase):
    """测试音频元数据"""
    
    def test_initialization(self):
        """测试初始化"""
        metadata = AudioMetadata(
            file_path="/test/audio.mp3",
            file_name="audio.mp3",
            format=AudioFormat.MP3,
            duration_seconds=60.5,
            sample_rate=44100,
            channels=2,
            bit_depth=16,
            parse_success=True
        )
        
        self.assertEqual(metadata.file_path, "/test/audio.mp3")
        self.assertEqual(metadata.file_name, "audio.mp3")
        self.assertEqual(metadata.format, AudioFormat.MP3)
        self.assertEqual(metadata.duration_seconds, 60.5)
        self.assertEqual(metadata.sample_rate, 44100)
        self.assertEqual(metadata.channels, 2)
        self.assertEqual(metadata.bit_depth, 16)
        self.assertTrue(metadata.parse_success)
    
    def test_computed_properties(self):
        """测试计算属性"""
        metadata = AudioMetadata(
            file_path="/test.mp3",
            file_name="test.mp3",
            format=AudioFormat.WAV,
            duration_seconds=125.5,
            parse_success=True
        )
        
        self.assertEqual(metadata.duration_formatted, "02:05.500")
        self.assertEqual(metadata.format_str, "WAV")


class TestAudioFormat(unittest.TestCase):
    """测试音频格式枚举"""
    
    def test_values(self):
        """测试枚举值"""
        self.assertEqual(AudioFormat.MP3.value, "mp3")
        self.assertEqual(AudioFormat.WAV.value, "wav")
        self.assertEqual(AudioFormat.FLAC.value, "flac")
        self.assertEqual(AudioFormat.OGG.value, "ogg")
        self.assertEqual(AudioFormat.M4A.value, "m4a")
        self.assertEqual(AudioFormat.UNKNOWN.value, "unknown")


if __name__ == "__main__":
    unittest.main()
