"""
报告导出模块测试
"""

import unittest
import tempfile
import os
import sys
import json
import csv
from datetime import datetime

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from report_exporter import ReportExporter, export_report
from rules_engine import (
    QualityCheckResult,
    QualityIssue,
    IssueSeverity,
    IssueType,
    QualityCheckConfig
)
from audio_metadata import ProgramScheduleItem, AudioMetadata, AudioFormat


class TestReportExporter(unittest.TestCase):
    """测试报告导出器"""
    
    def setUp(self):
        """设置测试"""
        self.exporter = ReportExporter()
        self.temp_dir = tempfile.mkdtemp()
        
        # 创建测试用的质检问题
        self.issues = [
            QualityIssue(
                issue_type=IssueType.MISSING_AUDIO,
                severity=IssueSeverity.CRITICAL,
                item_id="P001",
                audio_file="missing.mp3",
                title="测试节目",
                message="音频文件不存在",
                expected_value="文件存在",
                actual_value="文件缺失",
                resolved=False
            ),
            QualityIssue(
                issue_type=IssueType.PEAK_TOO_HIGH,
                severity=IssueSeverity.WARNING,
                item_id="A001",
                audio_file="ad.mp3",
                title="测试广告",
                message="音量峰值过高",
                expected_value="< -1.0 dBFS",
                actual_value="-0.5 dBFS",
                resolved=True,
                resolution_action="accept",
                resolution_note="可接受"
            ),
            QualityIssue(
                issue_type=IssueType.UNUSED_AUDIO,
                severity=IssueSeverity.INFO,
                audio_file="extra.mp3",
                title="未使用素材",
                message="音频文件未被引用",
                resolved=False
            )
        ]
        
        # 创建测试用的质检结果
        self.result = QualityCheckResult(
            issues=self.issues,
            total_checks=3,
            passed_checks=0,
            failed_checks=3,
            warning_count=1,
            critical_count=1
        )
        
        # 创建测试用的节目单
        self.schedule_items = [
            ProgramScheduleItem(
                item_id="P001",
                title="早间新闻",
                start_time="08:00:00",
                duration_seconds=300,
                audio_file="news.mp3",
                item_type="program",
                notes="注意口播"
            ),
            ProgramScheduleItem(
                item_id="A001",
                title="食堂广告",
                start_time="08:05:00",
                duration_seconds=30,
                audio_file="ad.mp3",
                item_type="ad"
            )
        ]
        
        # 创建测试用的音频元数据
        self.audio_metadata = {
            "news.mp3": AudioMetadata(
                file_path="/test/news.mp3",
                file_name="news.mp3",
                format=AudioFormat.MP3,
                duration_seconds=300.5,
                sample_rate=44100,
                channels=2,
                bit_depth=16,
                bitrate=192000,
                peak_dbfs=-3.2,
                rms_dbfs=-18.5,
                leading_silence_duration=0.1,
                trailing_silence_duration=0.2,
                parse_success=True
            ),
            "ad.mp3": AudioMetadata(
                file_path="/test/ad.mp3",
                file_name="ad.mp3",
                format=AudioFormat.MP3,
                duration_seconds=29.8,
                sample_rate=44100,
                channels=2,
                bit_depth=16,
                bitrate=256000,
                peak_dbfs=-0.5,
                rms_dbfs=-12.5,
                leading_silence_duration=2.5,
                trailing_silence_duration=0.5,
                parse_success=True
            )
        }
        
        # 创建测试用的配置
        self.config = QualityCheckConfig()
    
    def tearDown(self):
        """清理测试"""
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_initialization(self):
        """测试初始化"""
        self.assertIsNotNone(self.exporter.export_time)
        self.assertIsInstance(self.exporter.export_time, datetime)
    
    def test_format_timestamp(self):
        """测试时间戳格式化"""
        timestamp = self.exporter._format_timestamp()
        self.assertIsInstance(timestamp, str)
        # 验证格式：YYYY-MM-DD HH:MM:SS
        import re
        pattern = r'^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$'
        self.assertTrue(re.match(pattern, timestamp))
    
    def test_format_date(self):
        """测试日期格式化"""
        date = self.exporter._format_date()
        self.assertIsInstance(date, str)
        # 验证格式：YYYY-MM-DD
        import re
        pattern = r'^\d{4}-\d{2}-\d{2}$'
        self.assertTrue(re.match(pattern, date))
    
    def test_get_severity_icon(self):
        """测试严重程度图标"""
        self.assertEqual(self.exporter._get_severity_icon(IssueSeverity.CRITICAL), "🔴")
        self.assertEqual(self.exporter._get_severity_icon(IssueSeverity.WARNING), "🟡")
        self.assertEqual(self.exporter._get_severity_icon(IssueSeverity.INFO), "🔵")
    
    def test_get_resolution_icon(self):
        """测试处理状态图标"""
        # 已接受
        issue1 = QualityIssue(
            issue_type=IssueType.MISSING_AUDIO,
            severity=IssueSeverity.CRITICAL,
            resolution_action="accept",
            resolved=True
        )
        self.assertEqual(self.exporter._get_resolution_icon(issue1), "✅")
        
        # 已驳回
        issue2 = QualityIssue(
            issue_type=IssueType.MISSING_AUDIO,
            severity=IssueSeverity.CRITICAL,
            resolution_action="reject",
            resolved=True
        )
        self.assertEqual(self.exporter._get_resolution_icon(issue2), "❌")
        
        # 需修复
        issue3 = QualityIssue(
            issue_type=IssueType.MISSING_AUDIO,
            severity=IssueSeverity.CRITICAL,
            resolution_action="needs_fix"
        )
        self.assertEqual(self.exporter._get_resolution_icon(issue3), "🔧")
        
        # 延后
        issue4 = QualityIssue(
            issue_type=IssueType.MISSING_AUDIO,
            severity=IssueSeverity.CRITICAL,
            resolution_action="deferred"
        )
        self.assertEqual(self.exporter._get_resolution_icon(issue4), "⏳")
        
        # 未处理
        issue5 = QualityIssue(
            issue_type=IssueType.MISSING_AUDIO,
            severity=IssueSeverity.CRITICAL,
            resolved=False
        )
        self.assertEqual(self.exporter._get_resolution_icon(issue5), "⏳")
    
    def test_export_markdown_report_content(self):
        """测试导出 Markdown 报告（返回内容）"""
        content = self.exporter.export_markdown_report(
            result=self.result,
            schedule_items=self.schedule_items,
            audio_metadata=self.audio_metadata,
            config=self.config,
            project_name="测试项目"
        )
        
        self.assertIsInstance(content, str)
        self.assertIn("# 播前音频质检报告", content)
        self.assertIn("测试项目", content)
        self.assertIn("## 📊 质检摘要", content)
        self.assertIn("## 🐛 问题详情", content)
        self.assertIn("## 📅 排播时间线", content)
        self.assertIn("## 🎵 音频文件详情", content)
        self.assertIn("## ⚙️ 质检配置", content)
        
        # 验证问题内容
        self.assertIn("测试节目", content)
        self.assertIn("测试广告", content)
        self.assertIn("未使用素材", content)
    
    def test_export_markdown_report_file(self):
        """测试导出 Markdown 报告（保存到文件）"""
        output_path = os.path.join(self.temp_dir, "report.md")
        
        result_path = self.exporter.export_markdown_report(
            result=self.result,
            schedule_items=self.schedule_items,
            audio_metadata=self.audio_metadata,
            config=self.config,
            project_name="测试项目",
            output_path=output_path
        )
        
        self.assertEqual(result_path, output_path)
        self.assertTrue(os.path.exists(output_path))
        
        # 读取文件验证
        with open(output_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        self.assertIn("# 播前音频质检报告", content)
        self.assertIn("测试项目", content)
    
    def test_export_csv_issue_list_content(self):
        """测试导出 CSV 问题清单（返回内容）"""
        content = self.exporter.export_csv_issue_list(result=self.result)
        
        self.assertIsInstance(content, str)
        
        # 验证表头
        self.assertIn("序号", content)
        self.assertIn("严重程度", content)
        self.assertIn("问题类型", content)
        self.assertIn("条目编号", content)
        self.assertIn("处理状态", content)
        
        # 验证问题内容
        self.assertIn("测试节目", content)
        self.assertIn("测试广告", content)
    
    def test_export_csv_issue_list_file(self):
        """测试导出 CSV 问题清单（保存到文件）"""
        output_path = os.path.join(self.temp_dir, "issues.csv")
        
        result_path = self.exporter.export_csv_issue_list(
            result=self.result,
            output_path=output_path
        )
        
        self.assertEqual(result_path, output_path)
        self.assertTrue(os.path.exists(output_path))
        
        # 读取 CSV 验证
        with open(output_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            rows = list(reader)
        
        self.assertGreater(len(rows), 0)
        headers = rows[0]
        self.assertIn("序号", headers)
        self.assertIn("严重程度", headers)
        self.assertIn("问题类型", headers)
    
    def test_export_json_audit_log_content(self):
        """测试导出 JSON 审计记录（返回内容）"""
        content = self.exporter.export_json_audit_log(
            result=self.result,
            schedule_items=self.schedule_items,
            audio_metadata=self.audio_metadata,
            config=self.config,
            project_name="测试项目"
        )
        
        self.assertIsInstance(content, str)
        
        # 解析 JSON 验证
        data = json.loads(content)
        
        self.assertEqual(data["version"], "1.0")
        self.assertEqual(data["audit_type"], "audio_quality_check")
        self.assertEqual(data["project_name"], "测试项目")
        self.assertIn("generated_at", data)
        self.assertIn("summary", data)
        self.assertIn("issues", data)
        self.assertIn("schedule", data)
        self.assertIn("audio_files", data)
        self.assertIn("config", data)
        self.assertIn("statistics", data)
        
        # 验证统计
        self.assertEqual(data["statistics"]["total_issues"], 3)
        self.assertEqual(data["statistics"]["by_severity"]["critical"], 1)
        self.assertEqual(data["statistics"]["by_severity"]["warning"], 1)
        self.assertEqual(data["statistics"]["by_severity"]["info"], 1)
    
    def test_export_json_audit_log_file(self):
        """测试导出 JSON 审计记录（保存到文件）"""
        output_path = os.path.join(self.temp_dir, "audit.json")
        
        result_path = self.exporter.export_json_audit_log(
            result=self.result,
            schedule_items=self.schedule_items,
            audio_metadata=self.audio_metadata,
            config=self.config,
            project_name="测试项目",
            output_path=output_path
        )
        
        self.assertEqual(result_path, output_path)
        self.assertTrue(os.path.exists(output_path))
        
        # 读取 JSON 验证
        with open(output_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.assertEqual(data["version"], "1.0")
        self.assertEqual(data["project_name"], "测试项目")
    
    def test_export_all(self):
        """测试导出所有格式"""
        outputs = self.exporter.export_all(
            result=self.result,
            output_directory=self.temp_dir,
            base_filename="test_report",
            schedule_items=self.schedule_items,
            audio_metadata=self.audio_metadata,
            config=self.config,
            project_name="测试项目"
        )
        
        # 验证返回的字典
        self.assertIn("markdown", outputs)
        self.assertIn("csv", outputs)
        self.assertIn("json", outputs)
        
        # 验证文件存在
        self.assertTrue(os.path.exists(outputs["markdown"]))
        self.assertTrue(os.path.exists(outputs["csv"]))
        self.assertTrue(os.path.exists(outputs["json"]))
        
        # 验证文件名
        self.assertIn("test_report.md", outputs["markdown"])
        self.assertIn("test_report_issues.csv", outputs["csv"])
        self.assertIn("test_report_audit.json", outputs["json"])
    
    def test_export_all_default_filename(self):
        """测试导出所有格式（使用默认文件名）"""
        outputs = self.exporter.export_all(
            result=self.result,
            output_directory=self.temp_dir,
            schedule_items=self.schedule_items,
            audio_metadata=self.audio_metadata,
            config=self.config,
            project_name="测试项目"
        )
        
        self.assertIn("markdown", outputs)
        self.assertIn("csv", outputs)
        self.assertIn("json", outputs)
        
        # 验证文件名包含日期
        md_path = outputs["markdown"]
        self.assertIn("quality_check_", md_path)


class TestExportReportFunction(unittest.TestCase):
    """测试便捷函数 export_report"""
    
    def setUp(self):
        """设置测试"""
        self.temp_dir = tempfile.mkdtemp()
        
        # 创建测试用的质检结果
        self.result = QualityCheckResult(
            issues=[
                QualityIssue(
                    issue_type=IssueType.MISSING_AUDIO,
                    severity=IssueSeverity.CRITICAL,
                    title="测试问题",
                    message="测试消息"
                )
            ],
            total_checks=1,
            critical_count=1
        )
    
    def tearDown(self):
        """清理测试"""
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_export_markdown(self):
        """测试导出 Markdown"""
        output_path = os.path.join(self.temp_dir, "report.md")
        
        result = export_report(
            result=self.result,
            output_path=output_path,
            format_type="markdown",
            project_name="测试"
        )
        
        self.assertEqual(result, output_path)
        self.assertTrue(os.path.exists(output_path))
        
        with open(output_path, 'r', encoding='utf-8') as f:
            content = f.read()
        self.assertIn("# 播前音频质检报告", content)
    
    def test_export_csv(self):
        """测试导出 CSV"""
        output_path = os.path.join(self.temp_dir, "issues.csv")
        
        result = export_report(
            result=self.result,
            output_path=output_path,
            format_type="csv"
        )
        
        self.assertEqual(result, output_path)
        self.assertTrue(os.path.exists(output_path))
    
    def test_export_json(self):
        """测试导出 JSON"""
        output_path = os.path.join(self.temp_dir, "audit.json")
        
        result = export_report(
            result=self.result,
            output_path=output_path,
            format_type="json",
            project_name="测试"
        )
        
        self.assertEqual(result, output_path)
        self.assertTrue(os.path.exists(output_path))
    
    def test_export_invalid_format(self):
        """测试导出无效格式"""
        output_path = os.path.join(self.temp_dir, "invalid.txt")
        
        with self.assertRaises(ValueError):
            export_report(
                result=self.result,
                output_path=output_path,
                format_type="invalid"
            )


class TestReportExporterEdgeCases(unittest.TestCase):
    """测试报告导出器的边界情况"""
    
    def setUp(self):
        """设置测试"""
        self.exporter = ReportExporter()
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """清理测试"""
        import shutil
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
    
    def test_empty_result(self):
        """测试空结果"""
        result = QualityCheckResult()
        
        content = self.exporter.export_markdown_report(result=result)
        
        self.assertIsInstance(content, str)
        self.assertIn("# 播前音频质检报告", content)
        self.assertIn("总检查项", content)
    
    def test_export_to_nested_directory(self):
        """测试导出到嵌套目录"""
        nested_dir = os.path.join(self.temp_dir, "nested", "sub", "dir")
        output_path = os.path.join(nested_dir, "report.md")
        
        # 确保嵌套目录不存在
        self.assertFalse(os.path.exists(nested_dir))
        
        result = QualityCheckResult()
        result_path = self.exporter.export_markdown_report(
            result=result,
            output_path=output_path
        )
        
        # 验证目录被创建
        self.assertTrue(os.path.exists(nested_dir))
        self.assertTrue(os.path.exists(result_path))


if __name__ == "__main__":
    unittest.main()
