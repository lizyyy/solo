"""
规则引擎模块测试
"""

import unittest
import tempfile
import os
import sys

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from rules_engine import (
    IssueSeverity,
    IssueType,
    QualityIssue,
    QualityCheckConfig,
    QualityCheckResult,
    RulesEngine
)
from audio_metadata import (
    ProgramScheduleItem,
    AudioMetadata,
    AudioFormat
)


class TestIssueSeverity(unittest.TestCase):
    """测试严重程度枚举"""
    
    def test_values(self):
        """测试枚举值"""
        self.assertEqual(IssueSeverity.CRITICAL.value, "critical")
        self.assertEqual(IssueSeverity.WARNING.value, "warning")
        self.assertEqual(IssueSeverity.INFO.value, "info")


class TestIssueType(unittest.TestCase):
    """测试问题类型枚举"""
    
    def test_values(self):
        """测试枚举值"""
        # 素材相关
        self.assertEqual(IssueType.MISSING_AUDIO.value, "missing_audio")
        self.assertEqual(IssueType.DUPLICATE_AUDIO.value, "duplicate_audio")
        self.assertEqual(IssueType.UNUSED_AUDIO.value, "unused_audio")
        
        # 时长相关
        self.assertEqual(IssueType.DURATION_TOO_LONG.value, "duration_too_long")
        self.assertEqual(IssueType.DURATION_TOO_SHORT.value, "duration_too_short")
        
        # 格式相关
        self.assertEqual(IssueType.FORMAT_NOT_SUPPORTED.value, "format_not_supported")
        self.assertEqual(IssueType.SAMPLE_RATE_MISMATCH.value, "sample_rate_mismatch")
        
        # 音频质量
        self.assertEqual(IssueType.PEAK_TOO_HIGH.value, "peak_too_high")
        self.assertEqual(IssueType.LEADING_SILENCE_TOO_LONG.value, "leading_silence_too_long")
        self.assertEqual(IssueType.TRAILING_SILENCE_TOO_LONG.value, "trailing_silence_too_long")
        
        # 排播相关
        self.assertEqual(IssueType.AD_DUPLICATE_IN_TIMELINE.value, "ad_duplicate_in_timeline")
        self.assertEqual(IssueType.TIMELINE_OVERLAP.value, "timeline_overlap")


class TestQualityIssue(unittest.TestCase):
    """测试质检问题"""
    
    def test_creation(self):
        """测试创建问题"""
        issue = QualityIssue(
            issue_type=IssueType.MISSING_AUDIO,
            severity=IssueSeverity.CRITICAL,
            item_id="P001",
            audio_file="test.mp3",
            title="测试节目",
            message="测试消息",
            expected_value="期望值",
            actual_value="实际值"
        )
        
        self.assertEqual(issue.issue_type, IssueType.MISSING_AUDIO)
        self.assertEqual(issue.severity, IssueSeverity.CRITICAL)
        self.assertEqual(issue.item_id, "P001")
        self.assertEqual(issue.audio_file, "test.mp3")
        self.assertEqual(issue.title, "测试节目")
        self.assertEqual(issue.message, "测试消息")
        self.assertEqual(issue.expected_value, "期望值")
        self.assertEqual(issue.actual_value, "实际值")
    
    def test_display_properties(self):
        """测试显示属性"""
        # 测试严重问题
        issue1 = QualityIssue(
            issue_type=IssueType.PEAK_TOO_HIGH,
            severity=IssueSeverity.CRITICAL,
            resolved=False
        )
        
        self.assertEqual(issue1.severity_display, "严重")
        self.assertEqual(issue1.issue_type_display, "峰值过高")
        self.assertEqual(issue1.resolution_display, "待处理")
        
        # 测试已接受的问题
        issue2 = QualityIssue(
            issue_type=IssueType.MISSING_AUDIO,
            severity=IssueSeverity.WARNING,
            resolution_action="accept",
            resolved=True
        )
        
        self.assertEqual(issue2.severity_display, "警告")
        self.assertEqual(issue2.issue_type_display, "缺少音频")
        self.assertEqual(issue2.resolution_display, "已接受")
        
        # 测试需修复的问题
        issue3 = QualityIssue(
            issue_type=IssueType.DURATION_TOO_LONG,
            severity=IssueSeverity.INFO,
            resolution_action="needs_fix"
        )
        
        self.assertEqual(issue3.severity_display, "信息")
        self.assertEqual(issue3.issue_type_display, "时长过长")
        self.assertEqual(issue3.resolution_display, "需修复")
    
    def test_to_dict(self):
        """测试转换为字典"""
        issue = QualityIssue(
            issue_type=IssueType.SAMPLE_RATE_MISMATCH,
            severity=IssueSeverity.WARNING,
            item_id="A001",
            audio_file="ad.mp3",
            title="测试广告",
            message="采样率不符",
            expected_value="44100 Hz",
            actual_value="22050 Hz",
            resolved=True,
            resolution_action="accept",
            resolution_note="可接受"
        )
        
        data = issue.to_dict()
        
        self.assertEqual(data["issue_type"], "sample_rate_mismatch")
        self.assertEqual(data["severity"], "warning")
        self.assertEqual(data["item_id"], "A001")
        self.assertEqual(data["audio_file"], "ad.mp3")
        self.assertEqual(data["title"], "测试广告")
        self.assertEqual(data["message"], "采样率不符")
        self.assertEqual(data["expected_value"], "44100 Hz")
        self.assertEqual(data["actual_value"], "22050 Hz")
        self.assertEqual(data["resolved"], True)
        self.assertEqual(data["resolution_action"], "accept")
        self.assertEqual(data["resolution_note"], "可接受")


class TestQualityCheckConfig(unittest.TestCase):
    """测试质检配置"""
    
    def test_default_values(self):
        """测试默认值"""
        config = QualityCheckConfig()
        
        # 格式要求
        self.assertIn(AudioFormat.MP3, config.allowed_formats)
        self.assertIn(AudioFormat.WAV, config.allowed_formats)
        self.assertIn(AudioFormat.FLAC, config.allowed_formats)
        self.assertEqual(config.required_sample_rate, 44100)
        self.assertEqual(config.required_channels, 2)
        self.assertEqual(config.min_bit_depth, 16)
        
        # 时长容差
        self.assertEqual(config.max_duration_over_seconds, 2.0)
        self.assertEqual(config.max_duration_under_seconds, 1.0)
        self.assertEqual(config.duration_tolerance_percent, 5.0)
        
        # 音频质量
        self.assertEqual(config.max_peak_dbfs, -1.0)
        self.assertEqual(config.critical_peak_dbfs, 0.0)
        self.assertEqual(config.min_rms_dbfs, -24.0)
        self.assertEqual(config.max_leading_silence_seconds, 1.0)
        self.assertEqual(config.max_trailing_silence_seconds, 1.0)
        
        # 广告规则
        self.assertEqual(config.check_ad_duplicates, True)
        self.assertEqual(config.min_ad_interval_minutes, 30.0)
        self.assertEqual(config.check_timeline_overlap, True)
    
    def test_to_dict(self):
        """测试转换为字典"""
        config = QualityCheckConfig()
        data = config.to_dict()
        
        self.assertIn("allowed_formats", data)
        self.assertIn("required_sample_rate", data)
        self.assertIn("required_channels", data)
        self.assertIn("min_bit_depth", data)
        self.assertIn("max_duration_over_seconds", data)
        self.assertIn("max_peak_dbfs", data)
        self.assertIn("check_ad_duplicates", data)


class TestQualityCheckResult(unittest.TestCase):
    """测试质检结果"""
    
    def test_empty_result(self):
        """测试空结果"""
        result = QualityCheckResult()
        
        self.assertEqual(len(result.issues), 0)
        self.assertEqual(result.total_checks, 0)
        self.assertEqual(result.passed_checks, 0)
        self.assertEqual(result.failed_checks, 0)
        self.assertEqual(result.warning_count, 0)
        self.assertEqual(result.critical_count, 0)
        self.assertFalse(result.has_critical_issues)
        self.assertFalse(result.has_warnings)
        self.assertEqual(len(result.unresolved_issues), 0)
        self.assertEqual(len(result.resolved_issues), 0)
    
    def test_with_issues(self):
        """测试带问题的结果"""
        issues = [
            QualityIssue(
                issue_type=IssueType.MISSING_AUDIO,
                severity=IssueSeverity.CRITICAL,
                resolved=False
            ),
            QualityIssue(
                issue_type=IssueType.PEAK_TOO_HIGH,
                severity=IssueSeverity.WARNING,
                resolved=True
            ),
            QualityIssue(
                issue_type=IssueType.UNUSED_AUDIO,
                severity=IssueSeverity.INFO,
                resolved=False
            )
        ]
        
        result = QualityCheckResult(
            issues=issues,
            total_checks=3,
            passed_checks=1,
            failed_checks=2,
            warning_count=1,
            critical_count=1
        )
        
        self.assertEqual(len(result.issues), 3)
        self.assertEqual(result.total_checks, 3)
        self.assertEqual(result.passed_checks, 1)
        self.assertEqual(result.failed_checks, 2)
        self.assertTrue(result.has_critical_issues)
        self.assertFalse(result.has_warnings)  # 警告已解决
        self.assertEqual(len(result.unresolved_issues), 2)
        self.assertEqual(len(result.resolved_issues), 1)
        
        # 测试按类型获取
        critical = result.get_issues_by_severity(IssueSeverity.CRITICAL)
        self.assertEqual(len(critical), 1)
        
        warnings = result.get_issues_by_severity(IssueSeverity.WARNING)
        self.assertEqual(len(warnings), 1)
    
    def test_to_dict(self):
        """测试转换为字典"""
        result = QualityCheckResult(
            issues=[
                QualityIssue(
                    issue_type=IssueType.MISSING_AUDIO,
                    severity=IssueSeverity.CRITICAL,
                    title="测试问题"
                )
            ],
            total_checks=1,
            critical_count=1
        )
        
        data = result.to_dict()
        
        self.assertEqual(data["total_checks"], 1)
        self.assertEqual(data["critical_count"], 1)
        self.assertEqual(len(data["issues"]), 1)


class TestRulesEngine(unittest.TestCase):
    """测试规则引擎"""
    
    def setUp(self):
        """设置测试"""
        self.engine = RulesEngine()
    
    def test_initialization(self):
        """测试初始化"""
        self.assertIsNotNone(self.engine.config)
        self.assertIsInstance(self.engine.config, QualityCheckConfig)
    
    def test_check_missing_audio(self):
        """测试检查缺少音频"""
        # 创建节目单条目
        items = [
            ProgramScheduleItem(
                item_id="P001",
                title="测试节目",
                start_time="08:00:00",
                duration_seconds=60,
                audio_file="missing.mp3",
                item_type="program"
            )
        ]
        
        # 空的音频元数据
        audio_meta = {}
        
        # 运行检查
        result = self.engine.run_all_checks(
            schedule_items=items,
            audio_metadata=audio_meta
        )
        
        # 检查是否检测到缺少音频
        missing_issues = [i for i in result.issues if i.issue_type == IssueType.MISSING_AUDIO]
        self.assertEqual(len(missing_issues), 1)
        self.assertEqual(missing_issues[0].severity, IssueSeverity.CRITICAL)
    
    def test_check_unused_audio(self):
        """测试检查未使用的音频"""
        items = [
            ProgramScheduleItem(
                item_id="P001",
                title="测试节目",
                start_time="08:00:00",
                duration_seconds=60,
                audio_file="used.mp3",
                item_type="program"
            )
        ]
        
        audio_meta = {
            "used.mp3": AudioMetadata(
                file_path="/used.mp3",
                file_name="used.mp3",
                format=AudioFormat.MP3,
                duration_seconds=60,
                parse_success=True
            ),
            "unused.mp3": AudioMetadata(
                file_path="/unused.mp3",
                file_name="unused.mp3",
                format=AudioFormat.MP3,
                duration_seconds=30,
                parse_success=True
            )
        }
        
        result = self.engine.run_all_checks(
            schedule_items=items,
            audio_metadata=audio_meta
        )
        
        unused_issues = [i for i in result.issues if i.issue_type == IssueType.UNUSED_AUDIO]
        self.assertEqual(len(unused_issues), 1)
        self.assertEqual(unused_issues[0].severity, IssueSeverity.INFO)
        self.assertEqual(unused_issues[0].audio_file, "unused.mp3")
    
    def test_check_timeline_overlap(self):
        """测试检查时间线重叠"""
        items = [
            ProgramScheduleItem(
                item_id="P001",
                title="节目1",
                start_time="08:00:00",
                duration_seconds=120,  # 08:00-08:02
                item_type="program"
            ),
            ProgramScheduleItem(
                item_id="P002",
                title="节目2",
                start_time="08:01:00",  # 08:01-08:02，与节目1重叠
                duration_seconds=60,
                item_type="program"
            )
        ]
        
        audio_meta = {}
        
        result = self.engine.run_all_checks(
            schedule_items=items,
            audio_metadata=audio_meta
        )
        
        overlap_issues = [i for i in result.issues if i.issue_type == IssueType.TIMELINE_OVERLAP]
        self.assertEqual(len(overlap_issues), 1)
        self.assertEqual(overlap_issues[0].severity, IssueSeverity.CRITICAL)


if __name__ == "__main__":
    unittest.main()
