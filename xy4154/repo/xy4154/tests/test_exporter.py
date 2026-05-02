"""
导入导出模块测试
测试Markdown、CSV、JSON导出功能
"""

import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from unittest import TestCase

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.models import (
    Exhibit, ScanRecord, PhotoRecord, Anomaly, ReviewComment, ProjectData
)
from core.exporter import (
    MarkdownExporter, CSVExporter, JSONExporter, DataExporter
)


class TestMarkdownExporter(TestCase):
    """Markdown导出器测试"""
    
    def setUp(self):
        """创建测试数据"""
        self.project_data = ProjectData(project_name="测试临展撤展项目")
        
        # 添加展品
        self.project_data.exhibits = [
            Exhibit(exhibit_id="EX-001", name="青铜器-鼎", category="青铜器", is_fragile=False),
            Exhibit(exhibit_id="EX-002", name="瓷器-瓶", category="瓷器", is_fragile=True),
            Exhibit(exhibit_id="EX-003", name="书画-卷轴", category="书画", is_fragile=False),
        ]
        
        # 添加扫描记录
        self.project_data.scan_records = [
            ScanRecord(
                scan_id="SCAN-001",
                exhibit_id="EX-001",
                box_number="BOX-A01",
                scan_time=datetime(2024, 5, 15, 9, 30, 0),
                operator="张三",
                temperature=22.5,
                humidity=55.0,
                buffer_verified=True,
                has_signature=True
            ),
            ScanRecord(
                scan_id="SCAN-002",
                exhibit_id="EX-002",
                box_number="BOX-A01",
                scan_time=datetime(2024, 5, 15, 9, 45, 0),
                operator="李四",
                temperature=None,
                humidity=None,
                buffer_verified=False,
                has_signature=False
            ),
        ]
        
        # 添加异常
        self.project_data.anomalies = [
            Anomaly(
                anomaly_id="ANO-001",
                anomaly_type="missing_scan",
                severity="critical",
                exhibit_id="EX-003",
                description="展品 EX-003 (书画-卷轴) 未找到扫描记录",
                suggestion="请确认展品是否已装箱或遗漏",
                is_resolved=False
            ),
            Anomaly(
                anomaly_id="ANO-002",
                anomaly_type="fragile_buffer_missing",
                severity="high",
                exhibit_id="EX-002",
                scan_id="SCAN-002",
                description="易碎品 EX-002 (瓷器-瓶) 缺少缓冲材料确认",
                suggestion="请确认是否添加了足够的缓冲材料",
                is_resolved=False
            ),
        ]
        
        # 添加复核意见
        self.project_data.review_comments = [
            ReviewComment(
                comment_id="COMM-001",
                anomaly_id="ANO-001",
                reviewer="王主管",
                comment="已确认展品还在展厅，稍后装箱",
                review_time=datetime.now(),
                is_approved=True,
                follow_up_required=True
            ),
        ]
        
        # 添加照片（使用正确的PhotoRecord参数）
        self.project_data.photo_records = [
            PhotoRecord(
                photo_id="PHOTO-001",
                file_path="/path/to/EX-001_BOX-A01_20240515_093000.jpg",
                file_name="EX-001_BOX-A01_20240515_093000.jpg",
                file_size=102400,
                capture_time=datetime(2024, 5, 15, 9, 30, 0),
                exhibit_references=["EX-001"],
                box_references=["BOX-A01"]
            ),
        ]
        
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """清理临时文件"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_export_markdown(self):
        """测试导出Markdown交接单"""
        exporter = MarkdownExporter()
        output_path = os.path.join(self.temp_dir, "交接单.md")
        
        # 导出
        result = exporter.export(self.project_data, output_path)
        
        self.assertIsNotNone(result)
        self.assertTrue(os.path.exists(output_path))
        
        # 读取内容验证
        with open(output_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查关键内容是否存在
        self.assertIn("测试临展撤展项目", content)
        self.assertIn("展品清单", content)
        self.assertIn("装箱清单", content)
        self.assertIn("异常清单", content)
        self.assertIn("复核意见", content)
        
        # 检查具体展品
        self.assertIn("EX-001", content)
        self.assertIn("青铜器-鼎", content)
        self.assertIn("EX-002", content)
        self.assertIn("瓷器-瓶", content)
        
        # 检查异常
        self.assertIn("漏扫", content)
        self.assertIn("缓冲材料确认", content)


class TestCSVExporter(TestCase):
    """CSV导出器测试"""
    
    def setUp(self):
        """创建测试数据"""
        self.project_data = ProjectData(project_name="测试项目")
        
        # 添加展品
        self.project_data.exhibits = [
            Exhibit(exhibit_id="EX-001", name="展品1", category="青铜器"),
            Exhibit(exhibit_id="EX-002", name="展品2", category="瓷器"),
        ]
        
        # 添加扫描记录
        self.project_data.scan_records = [
            ScanRecord(
                scan_id="SCAN-001",
                exhibit_id="EX-001",
                box_number="BOX-A01",
                scan_time=datetime(2024, 5, 15, 9, 30, 0),
                operator="张三",
                temperature=22.5,
                humidity=55.0
            ),
        ]
        
        # 添加异常
        self.project_data.anomalies = [
            Anomaly(
                anomaly_id="ANO-001",
                anomaly_type="missing_scan",
                severity="critical",
                exhibit_id="EX-002",
                description="展品漏扫",
                suggestion="请确认",
                is_resolved=False
            ),
        ]
        
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """清理临时文件"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_export_anomalies_csv(self):
        """测试导出异常表CSV"""
        exporter = CSVExporter()
        output_path = os.path.join(self.temp_dir, "异常表.csv")
        
        # 包含已解决的异常
        result = exporter.export_anomalies(self.project_data, output_path, include_resolved=True)
        
        self.assertEqual(result, 1)
        self.assertTrue(os.path.exists(output_path))
        
        # 读取内容
        with open(output_path, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
        
        self.assertGreater(len(lines), 1)  # 至少有表头和一行数据
        self.assertIn("ANO-001", lines[1])
        self.assertIn("missing_scan", lines[1])
        # 注意：导出时使用中文严重程度，"critical" 转为 "严重"
        self.assertIn("严重", lines[1])
    
    def test_export_box_manifest_csv(self):
        """测试导出装箱清单CSV（注意：方法名是export_box_manifest）"""
        exporter = CSVExporter()
        output_path = os.path.join(self.temp_dir, "装箱清单.csv")
        
        # 使用正确的方法名 export_box_manifest
        result = exporter.export_box_manifest(self.project_data, output_path)
        
        self.assertEqual(result, 1)
        self.assertTrue(os.path.exists(output_path))
        
        # 读取内容
        with open(output_path, 'r', encoding='utf-8-sig') as f:
            lines = f.readlines()
        
        self.assertGreater(len(lines), 1)
        # 注意：装箱清单CSV不包含scan_id，只包含箱号、展品编号等
        self.assertIn("EX-001", lines[1])
        self.assertIn("BOX-A01", lines[1])
        self.assertIn("展品1", lines[1])


class TestJSONExporter(TestCase):
    """JSON导出器测试"""
    
    def setUp(self):
        """创建测试数据"""
        self.project_data = ProjectData(project_name="测试审计项目")
        
        # 添加展品
        self.project_data.exhibits = [
            Exhibit(exhibit_id="EX-001", name="展品1", category="青铜器"),
        ]
        
        # 添加扫描记录
        self.project_data.scan_records = [
            ScanRecord(
                scan_id="SCAN-001",
                exhibit_id="EX-001",
                box_number="BOX-A01",
                scan_time=datetime(2024, 5, 15, 9, 30, 0),
                operator="张三"
            ),
        ]
        
        # 添加异常
        self.project_data.anomalies = [
            Anomaly(
                anomaly_id="ANO-001",
                anomaly_type="test",
                severity="high",
                description="测试异常",
                is_resolved=True,
                resolved_by="测试人员",
                resolution_notes="已解决"
            ),
        ]
        
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """清理临时文件"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_export_audit_package(self):
        """测试导出审计包JSON"""
        exporter = JSONExporter()
        output_path = os.path.join(self.temp_dir, "审计包.json")
        
        result = exporter.export_audit_package(self.project_data, output_path)
        
        self.assertIsNotNone(result)
        self.assertTrue(os.path.exists(output_path))
        
        # 读取并解析JSON
        import json
        with open(output_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 检查审计包结构
        self.assertIn("metadata", data)
        self.assertIn("summary", data)
        self.assertIn("raw_data", data)
        
        # 检查元数据
        self.assertEqual(data["metadata"]["project_name"], "测试审计项目")
        # 注意：版本字段名是 export_version，不是 version
        self.assertEqual(data["metadata"]["export_version"], "1.0.0")
        
        # 检查摘要
        self.assertEqual(data["summary"]["total_exhibits"], 1)
        self.assertEqual(data["summary"]["total_scans"], 1)
        self.assertEqual(data["summary"]["total_anomalies"], 1)
        self.assertEqual(data["summary"]["unresolved_anomalies"], 0)
        
        # 检查原始数据 (raw_data 只包含 exhibits, scan_records, photo_records)
        self.assertEqual(len(data["raw_data"]["exhibits"]), 1)
        self.assertEqual(len(data["raw_data"]["scan_records"]), 1)
        # 注意：anomalies 在顶层，不在 raw_data 中
        self.assertEqual(len(data["anomalies"]), 1)


class TestDataExporter(TestCase):
    """统一导出器测试"""
    
    def setUp(self):
        """创建测试数据"""
        self.project_data = ProjectData(project_name="统一导出测试")
        
        # 添加展品
        self.project_data.exhibits = [
            Exhibit(exhibit_id="EX-001", name="展品1"),
            Exhibit(exhibit_id="EX-002", name="展品2"),
        ]
        
        # 添加扫描记录
        self.project_data.scan_records = [
            ScanRecord(
                scan_id="SCAN-001",
                exhibit_id="EX-001",
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="张三"
            ),
        ]
        
        # 添加异常
        self.project_data.anomalies = [
            Anomaly(
                anomaly_id="ANO-001",
                anomaly_type="missing_scan",
                severity="critical",
                exhibit_id="EX-002",
                description="展品漏扫",
                is_resolved=False
            ),
        ]
        
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """清理临时文件"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_export_all_formats(self):
        """测试导出所有格式"""
        # 注意：DataExporter需要project_data参数
        exporter = DataExporter(self.project_data)
        
        # 导出
        result = exporter.export_all(
            self.temp_dir,
            "测试导出"
        )
        
        self.assertIn("markdown", result)
        self.assertIn("anomalies_csv", result)
        self.assertIn("manifest_csv", result)  # 注意：是manifest_csv而不是box_list_csv
        self.assertIn("audit_json", result)
        
        # 检查所有文件是否存在
        self.assertTrue(os.path.exists(result["markdown"]))
        self.assertTrue(os.path.exists(result["anomalies_csv"]))
        self.assertTrue(os.path.exists(result["manifest_csv"]))
        self.assertTrue(os.path.exists(result["audit_json"]))
    
    def test_export_with_no_data(self):
        """测试空数据导出"""
        empty_data = ProjectData(project_name="空项目")
        
        # 注意：DataExporter需要project_data参数
        exporter = DataExporter(empty_data)
        result = exporter.export_all(self.temp_dir, "空导出")
        
        # 即使没有数据也应该能导出
        self.assertTrue(os.path.exists(result["markdown"]))
        self.assertTrue(os.path.exists(result["audit_json"]))
