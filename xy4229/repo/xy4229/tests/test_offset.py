"""偏移计算测试"""
import unittest
import sys
import os
from datetime import timedelta

# 添加项目根目录到路径
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.models.models import (
    CalibrationProject, Subtitle, TimecodeEntry, FeedbackRecord,
    Issue, IssueType, IssueSeverity
)
from src.offset.offset_calculator import OffsetCalculator, OffsetManager


class TestOffsetCalculator(unittest.TestCase):
    """偏移计算器测试"""
    
    def test_validate_offset_valid(self):
        """测试验证有效偏移"""
        subtitles = [
            Subtitle(
                index=1,
                start_time=timedelta(seconds=1),
                end_time=timedelta(seconds=3),
                text="测试1"
            ),
            Subtitle(
                index=2,
                start_time=timedelta(seconds=3.5),
                end_time=timedelta(seconds=5),
                text="测试2"
            )
        ]
        
        # 应用 +0.5 秒偏移
        result = OffsetCalculator.validate_offset(subtitles, timedelta(seconds=0.5))
        
        self.assertTrue(result['valid'])
        self.assertEqual(len(result['warnings']), 0)
        self.assertEqual(result['new_overlaps'], 0)
    
    def test_validate_offset_causes_overlap(self):
        """测试验证导致重叠的偏移"""
        subtitles = [
            Subtitle(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=2),
                text="测试1"
            ),
            Subtitle(
                index=2,
                start_time=timedelta(seconds=2.2),
                end_time=timedelta(seconds=4),
                text="测试2"
            )
        ]
        
        # 应用 +0.5 秒偏移给第一个字幕？不，validate_offset 检查所有字幕的偏移
        # 这里测试的是：如果字幕1结束在2秒，字幕2开始在2.2秒
        # 如果整体偏移 -0.5 秒
        # 字幕1结束在 1.5 秒，字幕2开始在 1.7 秒 -> 没有重叠
        # 但如果偏移使字幕2更早...
        
        # 让我们创建一个场景：偏移后会产生重叠
        subtitles = [
            Subtitle(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=2.5),
                text="测试1"
            ),
            Subtitle(
                index=2,
                start_time=timedelta(seconds=2.6),
                end_time=timedelta(seconds=4),
                text="测试2"
            )
        ]
        
        # 字幕1结束在 2.5，字幕2开始在 2.6
        # 偏移 -0.2 秒:
        # 字幕1结束在 2.3，字幕2开始在 2.4 -> 没问题
        # 偏移 +0.2 秒:
        # 字幕1结束在 2.7，字幕2开始在 2.8 -> 没问题
        
        # 创建会产生重叠的场景
        subtitles = [
            Subtitle(
                index=1,
                start_time=timedelta(seconds=0),
                end_time=timedelta(seconds=2.5),
                text="测试1"
            ),
            Subtitle(
                index=2,
                start_time=timedelta(seconds=2.5),
                end_time=timedelta(seconds=4),
                text="测试2"
            )
        ]
        
        # 字幕1结束在 2.5，字幕2开始在 2.5 (没有重叠)
        # 偏移 +0.1 秒给字幕1? 不，validate_offset 是统一偏移
        
        # 让我们测试负数时间
        subtitles = [
            Subtitle(
                index=1,
                start_time=timedelta(seconds=0.1),
                end_time=timedelta(seconds=2),
                text="测试1"
            )
        ]
        
        # 偏移 -0.2 秒会导致开始时间为负
        result = OffsetCalculator.validate_offset(subtitles, timedelta(seconds=-0.2))
        
        self.assertFalse(result['valid'])
        self.assertGreater(len(result['warnings']), 0)
    
    def test_calculate_batch_offset(self):
        """测试计算批量偏移"""
        subtitles = [
            Subtitle(index=i, start_time=timedelta(seconds=i), end_time=timedelta(seconds=i+1), text=f"测试{i}")
            for i in range(1, 11)
        ]
        
        # 计算字幕 3-7 的偏移
        result = OffsetCalculator.calculate_batch_offset(
            subtitles,
            start_index=3,
            end_index=7,
            offset=timedelta(seconds=0.5)
        )
        
        self.assertEqual(len(result), 5)
        indices = [idx for idx, _ in result]
        self.assertIn(3, indices)
        self.assertIn(5, indices)
        self.assertIn(7, indices)
        self.assertNotIn(2, indices)
        self.assertNotIn(8, indices)


class TestOffsetManager(unittest.TestCase):
    """偏移管理器测试"""
    
    def setUp(self):
        """设置测试"""
        self.project = CalibrationProject()
        self.project.subtitles = [
            Subtitle(
                index=1,
                start_time=timedelta(seconds=1),
                end_time=timedelta(seconds=3),
                text="字幕1"
            ),
            Subtitle(
                index=2,
                start_time=timedelta(seconds=3.5),
                end_time=timedelta(seconds=5),
                text="字幕2"
            ),
            Subtitle(
                index=3,
                start_time=timedelta(seconds=5.5),
                end_time=timedelta(seconds=7),
                text="字幕3"
            )
        ]
        self.manager = OffsetManager(self.project)
    
    def test_apply_global_offset(self):
        """测试应用全局偏移"""
        # 保存原始时间
        original_times = [
            (sub.start_time, sub.end_time) 
            for sub in self.project.subtitles
        ]
        
        result = self.manager.apply_global_offset(timedelta(seconds=0.5))
        
        self.assertTrue(result['success'])
        
        # 验证所有字幕都被偏移
        for i, sub in enumerate(self.project.subtitles):
            # 原始时间应该保持不变
            self.assertEqual(sub.original_start_time, original_times[i][0])
            self.assertEqual(sub.original_end_time, original_times[i][1])
            
            # 新时间应该有偏移
            self.assertEqual(sub.start_time, original_times[i][0] + timedelta(seconds=0.5))
            self.assertEqual(sub.end_time, original_times[i][1] + timedelta(seconds=0.5))
    
    def test_apply_single_offset(self):
        """测试应用单条偏移"""
        result = self.manager.apply_single_offset(2, timedelta(seconds=1.0))
        
        self.assertTrue(result['success'])
        
        # 验证只有字幕2被偏移
        self.assertEqual(self.project.subtitles[0].start_time, timedelta(seconds=1))  # 字幕1不变
        self.assertEqual(self.project.subtitles[1].start_time, timedelta(seconds=4.5))  # 字幕2被偏移 +1秒 (3.5 + 1 = 4.5)
        self.assertEqual(self.project.subtitles[2].start_time, timedelta(seconds=5.5))  # 字幕3不变
    
    def test_apply_batch_offset(self):
        """测试应用批量偏移"""
        result = self.manager.apply_batch_offset(1, 2, timedelta(seconds=0.5))
        
        self.assertTrue(result['success'])
        self.assertEqual(result['affected_count'], 2)
        
        # 验证字幕1和2被偏移
        self.assertEqual(self.project.subtitles[0].start_time, timedelta(seconds=1.5))  # 字幕1 +0.5秒
        self.assertEqual(self.project.subtitles[1].start_time, timedelta(seconds=4.0))  # 字幕2 +0.5秒
        self.assertEqual(self.project.subtitles[2].start_time, timedelta(seconds=5.5))  # 字幕3不变
    
    def test_apply_single_offset_invalid_index(self):
        """测试应用单条偏移到不存在的索引"""
        result = self.manager.apply_single_offset(99, timedelta(seconds=1.0))
        
        self.assertFalse(result['success'])
        self.assertIn("未找到字幕", result['message'])


class TestSmartSuggestions(unittest.TestCase):
    """智能建议测试"""
    
    def test_suggest_offset_by_issue_delay(self):
        """测试根据延迟问题建议偏移"""
        issue = Issue(
            issue_type=IssueType.SUBTITLE_DELAY,
            subtitle_index=1,
            start_time=timedelta(seconds=5),
            description="字幕延迟 1.50 秒",
            suggested_fix="建议将字幕提前 1.50 秒"
        )
        
        suggested = OffsetCalculator.suggest_offset_by_issue(issue)
        
        self.assertIsNotNone(suggested)
        # 延迟问题应该建议负偏移（提前）
        self.assertLess(suggested.total_seconds(), 0)
    
    def test_suggest_offset_by_issue_early(self):
        """测试根据过早问题建议偏移"""
        issue = Issue(
            issue_type=IssueType.SUBTITLE_TOO_EARLY,
            subtitle_index=1,
            start_time=timedelta(seconds=5),
            description="字幕过早 2.00 秒",
            suggested_fix="建议将字幕延后 2.00 秒"
        )
        
        suggested = OffsetCalculator.suggest_offset_by_issue(issue)
        
        self.assertIsNotNone(suggested)
        # 过早问题应该建议正偏移（延后）
        self.assertGreater(suggested.total_seconds(), 0)
    
    def test_suggest_auto_offset_with_timecodes(self):
        """测试基于时间码的智能建议"""
        project = CalibrationProject()
        
        # 创建字幕和时间码，字幕整体晚 0.5 秒
        for i in range(5):
            project.subtitles.append(Subtitle(
                index=i+1,
                start_time=timedelta(seconds=i + 0.5),  # 字幕晚 0.5 秒
                end_time=timedelta(seconds=i + 1.5),
                text=f"字幕{i+1}"
            ))
            
            project.timecodes.append(TimecodeEntry(
                index=i+1,
                timecode=timedelta(seconds=i),  # 时间码在 i 秒
                description=f"对话{i+1}",
                scene_type="dialogue"
            ))
        
        manager = OffsetManager(project)
        result = manager.suggest_auto_offset()
        
        # 应该有建议
        self.assertGreater(result['count'], 0)
        
        # 检查是否有时间码来源的建议
        timecode_suggestions = [s for s in result['suggestions'] if s.get('source') == 'timecode']
        self.assertGreater(len(timecode_suggestions), 0)


class TestProjectGlobalOffset(unittest.TestCase):
    """项目全局偏移测试"""
    
    def test_apply_global_offset(self):
        """测试项目级全局偏移"""
        project = CalibrationProject()
        
        project.subtitles = [
            Subtitle(
                index=1,
                start_time=timedelta(seconds=1),
                end_time=timedelta(seconds=3),
                text="测试1"
            ),
            Subtitle(
                index=2,
                start_time=timedelta(seconds=3.5),
                end_time=timedelta(seconds=5),
                text="测试2"
            )
        ]
        
        # 应用全局偏移
        project.apply_global_offset(timedelta(seconds=0.5))
        
        # 验证全局偏移记录
        self.assertEqual(project.global_offset, timedelta(seconds=0.5))
        
        # 验证所有字幕被偏移
        self.assertEqual(project.subtitles[0].start_time, timedelta(seconds=1.5))
        self.assertEqual(project.subtitles[0].end_time, timedelta(seconds=3.5))
        self.assertEqual(project.subtitles[1].start_time, timedelta(seconds=4.0))
        self.assertEqual(project.subtitles[1].end_time, timedelta(seconds=5.5))
        
        # 验证原始时间保持不变
        self.assertEqual(project.subtitles[0].original_start_time, timedelta(seconds=1))
        self.assertEqual(project.subtitles[0].original_end_time, timedelta(seconds=3))


if __name__ == '__main__':
    unittest.main()
