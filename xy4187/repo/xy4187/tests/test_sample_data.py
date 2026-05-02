"""
示例数据模块测试
"""

import unittest
import tempfile
import os
import sys
import csv
import json

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sample_data import (
    generate_sample_schedule,
    generate_mock_audio_metadata,
    generate_mock_quality_issues,
    create_demo_project
)
from audio_metadata import AudioFormat
from rules_engine import IssueType, IssueSeverity


class TestGenerateSampleSchedule(unittest.TestCase):
    """测试生成示例节目单"""
    
    def setUp(self):
        """设置测试"""
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """清理测试"""
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_generate_content(self):
        """测试生成 CSV 内容"""
        content = generate_sample_schedule()
        
        self.assertIsInstance(content, str)
        
        # 验证表头
        self.assertIn("编号", content)
        self.assertIn("标题", content)
        self.assertIn("开始时间", content)
        self.assertIn("预计时长(秒)", content)
        self.assertIn("音频文件", content)
        self.assertIn("类型", content)
        self.assertIn("口播备注", content)
        
        # 验证内容包含预期的节目
        self.assertIn("早间开播片头", content)
        self.assertIn("校园新闻早播报", content)
        self.assertIn("今日天气", content)
        self.assertIn("食堂优惠广告", content)
        self.assertIn("音乐下午茶", content)
        self.assertIn("社团招新宣传", content)
        self.assertIn("演讲比赛实况", content)
        self.assertIn("上午时段结束片花", content)
    
    def test_generate_file(self):
        """测试生成 CSV 文件"""
        output_path = os.path.join(self.temp_dir, "schedule.csv")
        
        result_path = generate_sample_schedule(output_path=output_path)
        
        self.assertEqual(result_path, output_path)
        self.assertTrue(os.path.exists(output_path))
        
        # 读取 CSV 验证
        with open(output_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        # 验证表头
        headers = rows[0]
        self.assertEqual(headers[0], "编号")
        self.assertEqual(headers[1], "标题")
        self.assertEqual(headers[2], "开始时间")
        self.assertEqual(headers[3], "预计时长(秒)")
        self.assertEqual(headers[4], "音频文件")
        self.assertEqual(headers[5], "类型")
        self.assertEqual(headers[6], "口播备注")
        
        # 验证行数（表头 + 9 个节目）
        self.assertEqual(len(rows), 10)
        
        # 验证几个关键条目
        item_ids = [row[0] for row in rows[1:]]
        self.assertIn("J001", item_ids)  # 片头
        self.assertIn("P001", item_ids)  # 节目
        self.assertIn("A001", item_ids)  # 广告


class TestGenerateMockAudioMetadata(unittest.TestCase):
    """测试生成模拟音频元数据"""
    
    def test_generate_metadata(self):
        """测试生成元数据字典"""
        metadata = generate_mock_audio_metadata()
        
        self.assertIsInstance(metadata, dict)
        self.assertGreater(len(metadata), 0)
        
        # 验证预期的文件存在
        expected_files = [
            "morning_intro.mp3",
            "news_20260503.mp3",
            "weather_report.mp3",
            "cafeteria_ad.mp3",
            "music_show.mp3",
            "speech_contest.ogg",
            "segment_ending.mp3",
            "extra_file.mp3"
        ]
        
        for filename in expected_files:
            self.assertIn(filename, metadata)
        
        # 验证元数据结构
        for filename, meta in metadata.items():
            self.assertEqual(meta.file_name, filename)
            self.assertIsInstance(meta.format, AudioFormat)
            self.assertGreater(meta.duration_seconds, 0)
            self.assertTrue(meta.parse_success)
    
    def test_metadata_scenarios(self):
        """测试不同场景的元数据"""
        metadata = generate_mock_audio_metadata()
        
        # 验证正常文件
        m1 = metadata["morning_intro.mp3"]
        self.assertEqual(m1.format, AudioFormat.MP3)
        self.assertEqual(m1.sample_rate, 44100)
        self.assertEqual(m1.channels, 2)
        self.assertAlmostEqual(m1.duration_seconds, 15.2, places=1)
        
        # 验证时长过长的文件
        m2 = metadata["news_20260503.mp3"]
        self.assertAlmostEqual(m2.duration_seconds, 310.5, places=1)  # 预计 300 秒
        
        # 验证峰值过高的文件
        m4 = metadata["cafeteria_ad.mp3"]
        self.assertAlmostEqual(m4.peak_dbfs, -0.3, places=1)  # 接近 0dBFS
        self.assertAlmostEqual(m4.leading_silence_duration, 2.5, places=1)  # 片头静音过长
        
        # 验证采样率不符的文件
        m5 = metadata["music_show.mp3"]
        self.assertEqual(m5.sample_rate, 22050)  # 应该是 44100
        self.assertEqual(m5.channels, 1)  # 单声道
        self.assertAlmostEqual(m5.trailing_silence_duration, 10.0, places=1)  # 片尾静音过长
        
        # 验证格式问题的文件
        m6 = metadata["speech_contest.ogg"]
        self.assertEqual(m6.format, AudioFormat.OGG)
        
        # 验证未使用的文件
        m8 = metadata["extra_file.mp3"]
        self.assertEqual(m8.format, AudioFormat.MP3)


class TestGenerateMockQualityIssues(unittest.TestCase):
    """测试生成模拟质检问题"""
    
    def test_generate_issues(self):
        """测试生成问题列表"""
        issues = generate_mock_quality_issues()
        
        self.assertIsInstance(issues, list)
        self.assertEqual(len(issues), 11)
        
        # 按严重程度统计
        critical_count = sum(1 for i in issues if i.severity == IssueSeverity.CRITICAL)
        warning_count = sum(1 for i in issues if i.severity == IssueSeverity.WARNING)
        info_count = sum(1 for i in issues if i.severity == IssueSeverity.INFO)
        
        self.assertEqual(critical_count, 3)
        self.assertEqual(warning_count, 6)
        self.assertEqual(info_count, 2)
    
    def test_issue_types(self):
        """测试问题类型覆盖"""
        issues = generate_mock_quality_issues()
        
        # 提取问题类型
        issue_types = [i.issue_type for i in issues]
        
        # 验证覆盖的问题类型
        self.assertIn(IssueType.MISSING_AUDIO, issue_types)
        self.assertIn(IssueType.TIMELINE_OVERLAP, issue_types)
        self.assertIn(IssueType.PEAK_TOO_HIGH, issue_types)
        self.assertIn(IssueType.DURATION_TOO_LONG, issue_types)
        self.assertIn(IssueType.LEADING_SILENCE_TOO_LONG, issue_types)
        self.assertIn(IssueType.TRAILING_SILENCE_TOO_LONG, issue_types)
        self.assertIn(IssueType.SAMPLE_RATE_MISMATCH, issue_types)
        self.assertIn(IssueType.CHANNELS_MISMATCH, issue_types)
        self.assertIn(IssueType.AD_DUPLICATE_IN_TIMELINE, issue_types)
        self.assertIn(IssueType.PEAK_TOO_LOW, issue_types)
        self.assertIn(IssueType.UNUSED_AUDIO, issue_types)
    
    def test_issue_content(self):
        """测试问题内容"""
        issues = generate_mock_quality_issues()
        
        # 验证第一个问题（缺少音频）
        i1 = issues[0]
        self.assertEqual(i1.issue_type, IssueType.MISSING_AUDIO)
        self.assertEqual(i1.severity, IssueSeverity.CRITICAL)
        self.assertEqual(i1.item_id, "P004")
        self.assertEqual(i1.audio_file, "club_recruitment.mp3")
        self.assertIn("社团招新宣传", i1.title)
        self.assertIn("不存在", i1.message)
        
        # 验证时间重叠问题
        i2 = issues[1]
        self.assertEqual(i2.issue_type, IssueType.TIMELINE_OVERLAP)
        self.assertEqual(i2.severity, IssueSeverity.CRITICAL)
        self.assertIn("P004", i2.item_id)
        self.assertIn("P005", i2.item_id)
        
        # 验证峰值过高问题
        i3 = issues[2]
        self.assertEqual(i3.issue_type, IssueType.PEAK_TOO_HIGH)
        self.assertEqual(i3.severity, IssueSeverity.CRITICAL)
        self.assertEqual(i3.audio_file, "cafeteria_ad.mp3")
        
        # 验证时长过长问题
        i4 = issues[3]
        self.assertEqual(i4.issue_type, IssueType.DURATION_TOO_LONG)
        self.assertEqual(i4.severity, IssueSeverity.WARNING)
        self.assertEqual(i4.item_id, "P001")
        
        # 验证广告重复问题
        i9 = issues[8]
        self.assertEqual(i9.issue_type, IssueType.AD_DUPLICATE_IN_TIMELINE)
        self.assertEqual(i9.severity, IssueSeverity.WARNING)
        self.assertIn("A001", i9.item_id)
        self.assertIn("A002", i9.item_id)
        
        # 验证未使用音频问题
        i11 = issues[10]
        self.assertEqual(i11.issue_type, IssueType.UNUSED_AUDIO)
        self.assertEqual(i11.severity, IssueSeverity.INFO)
        self.assertEqual(i11.audio_file, "extra_file.mp3")


class TestCreateDemoProject(unittest.TestCase):
    """测试创建演示项目"""
    
    def setUp(self):
        """设置测试"""
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """清理测试"""
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_create_demo_project(self):
        """测试创建完整演示项目"""
        files = create_demo_project(self.temp_dir)
        
        # 验证返回的文件字典
        self.assertIn("schedule", files)
        self.assertIn("audio_readme", files)
        self.assertIn("demo_state", files)
        
        # 验证文件存在
        self.assertTrue(os.path.exists(files["schedule"]))
        self.assertTrue(os.path.exists(files["audio_readme"]))
        self.assertTrue(os.path.exists(files["demo_state"]))
        
        # 验证音频目录存在
        audio_dir = os.path.join(self.temp_dir, "audio")
        self.assertTrue(os.path.exists(audio_dir))
        self.assertTrue(os.path.isdir(audio_dir))
        
        # 验证节目单文件
        self.assertTrue(files["schedule"].endswith("program_schedule.csv"))
        
        # 验证音频说明文件
        self.assertTrue(files["audio_readme"].endswith("README.txt"))
        
        # 验证状态文件
        self.assertTrue(files["demo_state"].endswith("demo_state.json"))
    
    def test_demo_state_content(self):
        """测试演示状态文件内容"""
        files = create_demo_project(self.temp_dir)
        
        # 读取状态文件
        with open(files["demo_state"], 'r', encoding='utf-8') as f:
            state = json.load(f)
        
        # 验证状态结构
        self.assertIn("session_id", state)
        self.assertIn("created_at", state)
        self.assertIn("updated_at", state)
        self.assertIn("project_name", state)
        self.assertIn("schedule_csv_path", state)
        self.assertIn("audio_directory", state)
        self.assertIn("issue_resolutions", state)
        self.assertIn("custom_config", state)
        self.assertIn("session_notes", state)
        self.assertIn("check_history", state)
        
        # 验证项目名称
        self.assertIn("演示项目", state["project_name"])
        self.assertIn("早间节目排播", state["project_name"])
        
        # 验证备注
        self.assertIn("演示项目", state["session_notes"])
    
    def test_audio_readme_content(self):
        """测试音频说明文件内容"""
        files = create_demo_project(self.temp_dir)
        
        # 读取说明文件
        with open(files["audio_readme"], 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 验证内容
        self.assertIn("音频素材目录", content)
        self.assertIn("演示模式", content)
        self.assertIn("morning_intro.mp3", content)
        self.assertIn("news_20260503.mp3", content)
        self.assertIn("cafeteria_ad.mp3", content)
        self.assertIn("music_show.mp3", content)
    
    def test_nested_directory_creation(self):
        """测试嵌套目录创建"""
        nested_dir = os.path.join(self.temp_dir, "nested", "demo")
        
        self.assertFalse(os.path.exists(nested_dir))
        
        files = create_demo_project(nested_dir)
        
        self.assertTrue(os.path.exists(nested_dir))
        self.assertIn("schedule", files)


class TestSampleDataIntegration(unittest.TestCase):
    """测试示例数据模块的集成测试"""
    
    def setUp(self):
        """设置测试"""
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """清理测试"""
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_full_workflow(self):
        """测试完整工作流程"""
        # 1. 生成示例节目单
        schedule_content = generate_sample_schedule()
        self.assertIsInstance(schedule_content, str)
        self.assertGreater(len(schedule_content), 0)
        
        # 2. 生成模拟音频元数据
        audio_meta = generate_mock_audio_metadata()
        self.assertIsInstance(audio_meta, dict)
        self.assertGreater(len(audio_meta), 0)
        
        # 3. 生成模拟质检问题
        issues = generate_mock_quality_issues()
        self.assertIsInstance(issues, list)
        self.assertGreater(len(issues), 0)
        
        # 4. 创建演示项目
        files = create_demo_project(self.temp_dir)
        self.assertIsInstance(files, dict)
        self.assertGreater(len(files), 0)
        
        # 验证所有文件存在
        for key, path in files.items():
            self.assertTrue(os.path.exists(path), f"文件不存在: {path}")
    
    def test_consistency_between_modules(self):
        """测试模块间数据一致性"""
        # 生成节目单和元数据
        schedule_content = generate_sample_schedule()
        audio_meta = generate_mock_audio_metadata()
        
        # 从节目单中提取音频文件
        import io
        reader = csv.reader(io.StringIO(schedule_content))
        next(reader)  # 跳过表头
        
        audio_files_in_schedule = []
        for row in reader:
            if len(row) >= 5 and row[4]:  # 第5列是音频文件
                audio_files_in_schedule.append(row[4])
        
        # 验证节目单中引用的音频文件在元数据中有对应条目
        # 注意：club_recruitment.mp3 是故意缺失的，用于测试
        for audio_file in audio_files_in_schedule:
            if audio_file == "club_recruitment.mp3":
                self.assertNotIn(audio_file, audio_meta, "故意缺失的文件不应存在")
            elif audio_file:
                # 检查是否存在（考虑可能的扩展名差异，如 speech_contest.mp3 在元数据中是 .ogg）
                found = False
                for meta_filename in audio_meta.keys():
                    if meta_filename.startswith(audio_file.replace('.mp3', '').replace('.ogg', '')):
                        found = True
                        break
                if audio_file not in ["speech_contest.mp3"]:  # 这些是故意有差异的
                    self.assertTrue(found, f"音频文件在元数据中未找到: {audio_file}")


if __name__ == "__main__":
    unittest.main()
