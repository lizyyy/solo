"""
数据库模块测试
测试SQLite数据库的CRUD操作
"""

import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from unittest import TestCase
from typing import Optional

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.models import (
    Exhibit, ScanRecord, PhotoRecord, Anomaly, ReviewComment, ProjectData
)
from core.database import DatabaseManager


class TestDatabaseManager(TestCase):
    """数据库管理器测试"""
    
    def setUp(self):
        """创建临时测试数据库"""
        self.temp_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.temp_dir, "test.db")
        self.db = DatabaseManager(db_path=self.db_path)
    
    def tearDown(self):
        """清理临时文件"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_create_project(self):
        """测试创建项目"""
        project_id = self.db.create_project("测试项目", "测试描述")
        
        self.assertIsNotNone(project_id)
        
        # 验证项目被创建
        project = self.db.get_project(project_id)
        self.assertIsNotNone(project)
        self.assertEqual(project['project_name'], "测试项目")
        self.assertEqual(project['description'], "测试描述")
    
    def test_list_projects(self):
        """测试列出项目"""
        # 创建几个项目
        self.db.create_project("项目1")
        self.db.create_project("项目2")
        
        projects = self.db.list_projects()
        
        self.assertEqual(len(projects), 2)
    
    def test_update_project(self):
        """测试更新项目"""
        project_id = self.db.create_project("原始名称")
        
        # 更新项目
        result = self.db.update_project(project_id, project_name="新名称", description="新描述")
        
        self.assertTrue(result)
        
        # 验证更新
        project = self.db.get_project(project_id)
        self.assertEqual(project['project_name'], "新名称")
        self.assertEqual(project['description'], "新描述")
    
    def test_delete_project(self):
        """测试删除项目"""
        project_id = self.db.create_project("待删除项目")
        
        # 删除项目
        result = self.db.delete_project(project_id)
        
        self.assertTrue(result)
        
        # 验证删除
        project = self.db.get_project(project_id)
        self.assertIsNone(project)
    
    def test_save_and_load_exhibits(self):
        """测试保存和加载展品"""
        project_id = self.db.create_project("测试项目")
        
        # 创建展品
        exhibits = [
            Exhibit(exhibit_id="EX-001", name="展品1", category="青铜器", is_fragile=False),
            Exhibit(exhibit_id="EX-002", name="展品2", category="瓷器", is_fragile=True),
        ]
        
        # 保存展品
        count = self.db.save_exhibits(project_id, exhibits)
        
        self.assertEqual(count, 2)
        
        # 加载展品
        loaded = self.db.get_exhibits(project_id)
        
        self.assertEqual(len(loaded), 2)
        self.assertEqual(loaded[0].exhibit_id, "EX-001")
        self.assertEqual(loaded[1].exhibit_id, "EX-002")
        self.assertTrue(loaded[1].is_fragile)
    
    def test_save_and_load_scan_records(self):
        """测试保存和加载扫描记录"""
        project_id = self.db.create_project("测试项目")
        
        # 创建扫描记录
        scans = [
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
        ]
        
        # 保存
        count = self.db.save_scan_records(project_id, scans)
        
        self.assertEqual(count, 1)
        
        # 加载
        loaded = self.db.get_scan_records(project_id)
        
        self.assertEqual(len(loaded), 1)
        self.assertEqual(loaded[0].scan_id, "SCAN-001")
        self.assertEqual(loaded[0].box_number, "BOX-A01")
        self.assertEqual(loaded[0].temperature, 22.5)
        self.assertTrue(loaded[0].buffer_verified)
        self.assertTrue(loaded[0].has_signature)
    
    def test_save_and_load_anomalies(self):
        """测试保存和加载异常记录"""
        project_id = self.db.create_project("测试项目")
        
        # 创建异常
        anomalies = [
            Anomaly(
                anomaly_id="ANO-001",
                anomaly_type="missing_scan",
                severity="critical",
                exhibit_id="EX-001",
                description="展品漏扫",
                suggestion="请确认",
                is_resolved=False
            ),
            Anomaly(
                anomaly_id="ANO-002",
                anomaly_type="missing_signature",
                severity="high",
                exhibit_id="EX-002",
                description="缺少签名",
                suggestion="请补签名",
                is_resolved=True,
                resolved_by="测试人员",
                resolution_notes="已补签"
            ),
        ]
        
        # 保存
        count = self.db.save_anomalies(project_id, anomalies)
        
        self.assertEqual(count, 2)
        
        # 加载所有异常
        all_anomalies = self.db.get_anomalies(project_id)
        
        self.assertEqual(len(all_anomalies), 2)
        
        # 按严重程度筛选
        critical = self.db.get_anomalies(project_id, severity="critical")
        self.assertEqual(len(critical), 1)
        self.assertEqual(critical[0].anomaly_type, "missing_scan")
        
        # 按状态筛选
        unresolved = self.db.get_anomalies(project_id, is_resolved=False)
        self.assertEqual(len(unresolved), 1)
        
        resolved = self.db.get_anomalies(project_id, is_resolved=True)
        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0].resolved_by, "测试人员")
    
    def test_update_anomaly_resolution(self):
        """测试更新异常解决状态"""
        project_id = self.db.create_project("测试项目")
        
        # 创建异常
        anomalies = [
            Anomaly(
                anomaly_id="ANO-001",
                anomaly_type="test",
                severity="high",
                description="测试异常",
                is_resolved=False
            ),
        ]
        self.db.save_anomalies(project_id, anomalies)
        
        # 更新解决状态
        result = self.db.update_anomaly_resolution(
            project_id,
            "ANO-001",
            True,
            "测试人员",
            "已解决"
        )
        
        self.assertTrue(result)
        
        # 验证
        loaded = self.db.get_anomalies(project_id)
        self.assertTrue(loaded[0].is_resolved)
        self.assertEqual(loaded[0].resolved_by, "测试人员")
        self.assertEqual(loaded[0].resolution_notes, "已解决")
    
    def test_add_and_get_review_comments(self):
        """测试添加和获取复核意见"""
        project_id = self.db.create_project("测试项目")
        
        # 创建复核意见
        comment = ReviewComment(
            comment_id="COMM-001",
            anomaly_id="ANO-001",
            reviewer="复核人",
            comment="测试复核意见",
            review_time=datetime.now(),
            is_approved=True,
            follow_up_required=False
        )
        
        # 添加
        result = self.db.add_review_comment(project_id, comment)
        
        self.assertIsNotNone(result)
        
        # 获取
        comments = self.db.get_review_comments(project_id)
        
        self.assertEqual(len(comments), 1)
        self.assertEqual(comments[0].anomaly_id, "ANO-001")
        self.assertEqual(comments[0].reviewer, "复核人")
        self.assertTrue(comments[0].is_approved)
        
        # 按异常ID获取
        comments_by_anomaly = self.db.get_review_comments(project_id, anomaly_id="ANO-001")
        self.assertEqual(len(comments_by_anomaly), 1)
        
        # 测试不存在的异常
        comments_none = self.db.get_review_comments(project_id, anomaly_id="不存在")
        self.assertEqual(len(comments_none), 0)
    
    def test_save_and_load_project_data(self):
        """测试保存和加载完整项目数据"""
        # 创建项目数据
        project_data = ProjectData(project_name="完整测试项目")
        
        # 添加展品
        project_data.exhibits = [
            Exhibit(exhibit_id="EX-001", name="展品1"),
            Exhibit(exhibit_id="EX-002", name="展品2"),
        ]
        
        # 添加扫描记录
        project_data.scan_records = [
            ScanRecord(
                scan_id="SCAN-001",
                exhibit_id="EX-001",
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="测试人员"
            ),
        ]
        
        # 添加异常
        project_data.anomalies = [
            Anomaly(
                anomaly_id="ANO-001",
                anomaly_type="test",
                severity="high",
                description="测试异常"
            ),
        ]
        
        # 保存
        project_id = self.db.save_project_data(project_data)
        
        self.assertIsNotNone(project_id)
        
        # 加载
        loaded = self.db.load_project_data(project_id)
        
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.project_name, "完整测试项目")
        self.assertEqual(len(loaded.exhibits), 2)
        self.assertEqual(len(loaded.scan_records), 1)
        self.assertEqual(len(loaded.anomalies), 1)
    
    def test_overwrite_exhibits(self):
        """测试覆盖保存展品时覆盖旧数据"""
        project_id = self.db.create_project("测试项目")
        
        # 第一次保存
        exhibits1 = [
            Exhibit(exhibit_id="EX-001", name="旧展品1"),
            Exhibit(exhibit_id="EX-002", name="旧展品2"),
        ]
        self.db.save_exhibits(project_id, exhibits1)
        
        # 第二次保存（覆盖）
        exhibits2 = [
            Exhibit(exhibit_id="EX-003", name="新展品1"),
        ]
        self.db.save_exhibits(project_id, exhibits2)
        
        # 验证只有新数据
        loaded = self.db.get_exhibits(project_id)
        self.assertEqual(len(loaded), 1)
        self.assertEqual(loaded[0].exhibit_id, "EX-003")
    
    def test_preserve_resolved_anomalies(self):
        """测试保存异常时保留已解决状态"""
        project_id = self.db.create_project("测试项目")
        
        # 第一次保存（已解决的异常
        anomalies1 = [
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
        self.db.save_anomalies(project_id, anomalies1)
        
        # 第二次保存（模拟重新校验，相同的异常ID但未解决）
        anomalies2 = [
            Anomaly(
                anomaly_id="ANO-001",
                anomaly_type="test",
                severity="high",
                description="测试异常（重新检测）",
                is_resolved=False  # 内存中的数据
            ),
        ]
        self.db.save_anomalies(project_id, anomalies2)
        
        # 验证已解决状态被保留
        loaded = self.db.get_anomalies(project_id)
        self.assertEqual(len(loaded), 1)
        self.assertTrue(loaded[0].is_resolved)  # 应该保留已解决状态
        self.assertEqual(loaded[0].resolved_by, "测试人员")
    
    def test_get_nonexistent_project(self):
        """测试获取不存在的项目"""
        project = self.db.get_project("不存在的ID")
        self.assertIsNone(project)
    
    def test_update_nonexistent_project(self):
        """测试更新不存在的项目"""
        result = self.db.update_project("不存在的ID", project_name="测试")
        self.assertFalse(result)
    
    def test_delete_nonexistent_project(self):
        """测试删除不存在的项目"""
        result = self.db.delete_project("不存在的ID")
        self.assertFalse(result)
