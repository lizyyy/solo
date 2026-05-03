"""规则引擎测试"""
import unittest
import sys
import os
from datetime import timedelta

# 添加项目根目录到路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.models.models import (
    CalibrationProject, Subtitle, TimecodeEntry, AudioAnnotation,
    IssueType, IssueSeverity
)
from src.rules.rules_engine import RulesEngine, RulesConfig


class TestReadingSpeedRule(unittest.TestCase):
    """阅读速度规则测试"""
    
    def test_reading_speed_too_fast(self):
        """测试阅读速度过快检测"""
        project = CalibrationProject()
        
        # 创建一个阅读速度过快的字幕 - 10字/秒 (阈值5字/秒)
        # 10个字，显示1秒 -> 10字/秒
        # 注意：规则引擎可能同时检测到阅读速度过快和最少显示时间不足
        project.subtitles.append(Subtitle(
            index=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=1),
            text="一二三四五六七八九十"  # 10字
        ))
        
        engine = RulesEngine()
        issues = engine.check_reading_speed(project)
        
        # 应该至少检测到一个问题
        self.assertGreater(len(issues), 0)
        
        # 检查是否有阅读速度过快的问题
        speed_issues = [i for i in issues if i.issue_type == IssueType.READING_SPEED_TOO_FAST]
        self.assertGreater(len(speed_issues), 0)
        
        # 检查问题描述是否包含阅读速度信息
        has_speed_info = any("10.0" in issue.description or "10" in issue.description for issue in speed_issues)
        self.assertTrue(has_speed_info)
    
    def test_reading_speed_normal(self):
        """测试正常阅读速度"""
        project = CalibrationProject()
        
        # 正常速度 - 4字/秒 (阈值5字/秒)
        # 8个字，显示2秒 -> 4字/秒
        project.subtitles.append(Subtitle(
            index=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=2),
            text="一二三四五六七八"  # 8字
        ))
        
        engine = RulesEngine()
        issues = engine.check_reading_speed(project)
        
        self.assertEqual(len(issues), 0)
    
    def test_min_duration_per_line(self):
        """测试每行最少显示时间"""
        project = CalibrationProject()
        
        # 2行字幕，只显示2秒 (建议每行至少1.5秒，共需要3秒)
        project.subtitles.append(Subtitle(
            index=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=2),
            text="第一行\n第二行"
        ))
        
        engine = RulesEngine()
        issues = engine.check_reading_speed(project)
        
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].issue_type, IssueType.READING_SPEED_TOO_FAST)


class TestTimelineOverlapRule(unittest.TestCase):
    """时间轴重叠规则测试"""
    
    def test_overlap_detected(self):
        """测试检测时间轴重叠"""
        project = CalibrationProject()
        
        # 字幕1: 0-3秒
        # 字幕2: 2-5秒
        # 重叠: 1秒
        project.subtitles.append(Subtitle(
            index=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=3),
            text="字幕1"
        ))
        project.subtitles.append(Subtitle(
            index=2,
            start_time=timedelta(seconds=2),
            end_time=timedelta(seconds=5),
            text="字幕2"
        ))
        
        engine = RulesEngine()
        issues = engine.check_timeline_overlap(project)
        
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].issue_type, IssueType.TIMELINE_OVERLAP)
        self.assertIn("1.00", issues[0].description)  # 重叠1秒
    
    def test_no_overlap(self):
        """测试没有时间轴重叠"""
        project = CalibrationProject()
        
        # 字幕1: 0-2秒
        # 字幕2: 2-5秒
        # 没有重叠
        project.subtitles.append(Subtitle(
            index=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=2),
            text="字幕1"
        ))
        project.subtitles.append(Subtitle(
            index=2,
            start_time=timedelta(seconds=2),
            end_time=timedelta(seconds=5),
            text="字幕2"
        ))
        
        engine = RulesEngine()
        issues = engine.check_timeline_overlap(project)
        
        self.assertEqual(len(issues), 0)


class TestSpeakerMissingRule(unittest.TestCase):
    """说话人漏标规则测试"""
    
    def test_speaker_missing(self):
        """测试检测说话人漏标"""
        project = CalibrationProject()
        
        # 没有说话人标注的对话字幕
        project.subtitles.append(Subtitle(
            index=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=2),
            text="你好，世界"
        ))
        
        engine = RulesEngine()
        issues = engine.check_speaker_missing(project)
        
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].issue_type, IssueType.SPEAKER_MISSING)
    
    def test_speaker_present(self):
        """测试有说话人标注"""
        project = CalibrationProject()
        
        # 有说话人标注
        project.subtitles.append(Subtitle(
            index=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=2),
            text="[张三] 你好，世界",
            speaker="张三"
        ))
        
        engine = RulesEngine()
        issues = engine.check_speaker_missing(project)
        
        self.assertEqual(len(issues), 0)
    
    def test_sound_effect_skipped(self):
        """测试音效字幕被跳过"""
        project = CalibrationProject()
        
        # 音效字幕不需要说话人
        project.subtitles.append(Subtitle(
            index=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=2),
            text="[敲门声]",
            sound_effect=True
        ))
        
        engine = RulesEngine()
        issues = engine.check_speaker_missing(project)
        
        self.assertEqual(len(issues), 0)


class TestSubtitleTimingRule(unittest.TestCase):
    """字幕时间规则测试"""
    
    def test_subtitle_delay(self):
        """测试字幕延迟检测"""
        project = CalibrationProject()
        
        # 字幕比时间码晚 1 秒 (阈值 0.5 秒)
        project.subtitles.append(Subtitle(
            index=1,
            start_time=timedelta(seconds=6),  # 字幕在6秒
            end_time=timedelta(seconds=8),
            text="测试字幕"
        ))
        
        project.timecodes.append(TimecodeEntry(
            index=1,
            timecode=timedelta(seconds=5),  # 时间码在5秒
            description="对话开始",
            scene_type="dialogue"
        ))
        
        engine = RulesEngine()
        issues = engine.check_subtitle_timing(project)
        
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].issue_type, IssueType.SUBTITLE_DELAY)
        self.assertIn("1.00", issues[0].description)  # 延迟1秒
    
    def test_subtitle_too_early(self):
        """测试字幕过早检测"""
        project = CalibrationProject()
        
        # 字幕比时间码早 3 秒 (阈值 2 秒)
        project.subtitles.append(Subtitle(
            index=1,
            start_time=timedelta(seconds=2),  # 字幕在2秒
            end_time=timedelta(seconds=4),
            text="测试字幕"
        ))
        
        project.timecodes.append(TimecodeEntry(
            index=1,
            timecode=timedelta(seconds=5),  # 时间码在5秒
            description="对话开始",
            scene_type="dialogue"
        ))
        
        engine = RulesEngine()
        issues = engine.check_subtitle_timing(project)
        
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].issue_type, IssueType.SUBTITLE_TOO_EARLY)


class TestSoundEffectMissingRule(unittest.TestCase):
    """音效提示缺失规则测试"""
    
    def test_sound_effect_missing(self):
        """测试检测音效提示缺失"""
        project = CalibrationProject()
        
        # 有音频标注但没有对应音效字幕
        project.audio_annotations.append(AudioAnnotation(
            index=1,
            start_time=timedelta(seconds=5),
            end_time=timedelta(seconds=6),
            sound_type="effect",
            description="爆炸声",
            volume="loud"
        ))
        
        # 没有对应的音效字幕
        project.subtitles.append(Subtitle(
            index=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=4),
            text="对话字幕"
        ))
        
        engine = RulesEngine()
        issues = engine.check_sound_effect_missing(project)
        
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0].issue_type, IssueType.SOUND_EFFECT_MISSING)
    
    def test_sound_effect_present(self):
        """测试有对应的音效字幕"""
        project = CalibrationProject()
        
        # 有音频标注
        project.audio_annotations.append(AudioAnnotation(
            index=1,
            start_time=timedelta(seconds=5),
            end_time=timedelta(seconds=6),
            sound_type="effect",
            description="爆炸声",
            volume="loud"
        ))
        
        # 有对应的音效字幕
        project.subtitles.append(Subtitle(
            index=1,
            start_time=timedelta(seconds=5),
            end_time=timedelta(seconds=6),
            text="[爆炸声]",
            sound_effect=True
        ))
        
        engine = RulesEngine()
        issues = engine.check_sound_effect_missing(project)
        
        self.assertEqual(len(issues), 0)


class TestFullAnalysis(unittest.TestCase):
    """完整分析测试"""
    
    def test_check_all(self):
        """测试运行所有检查"""
        project = CalibrationProject()
        
        # 添加有问题的字幕
        project.subtitles.append(Subtitle(
            index=1,
            start_time=timedelta(seconds=0),
            end_time=timedelta(seconds=1),
            text="一二三四五六七八九十十一十二"  # 12字，1秒 -> 12字/秒
        ))
        
        # 添加重叠的字幕
        project.subtitles.append(Subtitle(
            index=2,
            start_time=timedelta(seconds=0.5),
            end_time=timedelta(seconds=2),
            text="重叠字幕"
        ))
        
        # 添加说话人漏标的字幕
        project.subtitles.append(Subtitle(
            index=3,
            start_time=timedelta(seconds=2),
            end_time=timedelta(seconds=4),
            text="没有说话人"
        ))
        
        engine = RulesEngine()
        issues = engine.check_all(project)
        
        # 应该检测到多个问题
        self.assertGreater(len(issues), 0)
        
        # 验证问题类型
        issue_types = [i.issue_type for i in issues]
        self.assertIn(IssueType.READING_SPEED_TOO_FAST, issue_types)
        self.assertIn(IssueType.TIMELINE_OVERLAP, issue_types)
        self.assertIn(IssueType.SPEAKER_MISSING, issue_types)


class TestRulesConfig(unittest.TestCase):
    """规则配置测试"""
    
    def test_default_config(self):
        """测试默认配置"""
        config = RulesConfig()
        
        self.assertEqual(config.SUBTITLE_DELAY_THRESHOLD_POSITIVE, 0.5)
        self.assertEqual(config.SUBTITLE_DELAY_THRESHOLD_NEGATIVE, 2.0)
        self.assertEqual(config.MAX_READING_SPEED, 5.0)
        self.assertEqual(config.MIN_DURATION_PER_LINE, 1.5)
        self.assertEqual(config.OVERLAP_THRESHOLD, 0.1)


if __name__ == '__main__':
    unittest.main()
