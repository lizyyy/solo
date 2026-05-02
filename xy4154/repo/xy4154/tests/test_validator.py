"""
校验规则引擎测试
测试漏扫、重复装箱、签名缺失等规则
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

from core.models import Exhibit, ScanRecord, PhotoRecord, ProjectData
from core.validator import (
    BaseRule, RuleEngine,
    MissingScanRule, DuplicateBoxRule, MissingSignatureRule,
    PhotoMismatchRule, FragileBufferRule, TemperatureHumidityRule,
    UnknownExhibitRule
)


class TestMissingScanRule(TestCase):
    """漏扫规则测试"""
    
    def setUp(self):
        """创建测试数据"""
        self.project_data = ProjectData(project_name="测试项目")
        
        # 添加展品
        self.project_data.exhibits = [
            Exhibit(exhibit_id="EX-001", name="展品1"),
            Exhibit(exhibit_id="EX-002", name="展品2"),
            Exhibit(exhibit_id="EX-003", name="展品3"),
        ]
        
        # 添加扫描记录（EX-003没有扫描记录）
        self.project_data.scan_records = [
            ScanRecord(
                scan_id="SCAN-001",
                exhibit_id="EX-001",
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="测试人员"
            ),
            ScanRecord(
                scan_id="SCAN-002",
                exhibit_id="EX-002",
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="测试人员"
            ),
        ]
    
    def test_detect_missing_scans(self):
        """测试检测漏扫"""
        rule = MissingScanRule()
        anomalies = rule.validate(self.project_data)
        
        # 应该检测到EX-003漏扫
        self.assertEqual(len(anomalies), 1)
        self.assertEqual(anomalies[0].anomaly_type, "missing_scan")
        self.assertEqual(anomalies[0].exhibit_id, "EX-003")
        self.assertEqual(anomalies[0].severity, "critical")
    
    def test_no_missing_scans(self):
        """测试没有漏扫的情况"""
        # 添加EX-003的扫描记录
        self.project_data.scan_records.append(
            ScanRecord(
                scan_id="SCAN-003",
                exhibit_id="EX-003",
                box_number="BOX-A02",
                scan_time=datetime.now(),
                operator="测试人员"
            )
        )
        
        rule = MissingScanRule()
        anomalies = rule.validate(self.project_data)
        
        self.assertEqual(len(anomalies), 0)


class TestDuplicateBoxRule(TestCase):
    """重复装箱规则测试"""
    
    def setUp(self):
        """创建测试数据"""
        self.project_data = ProjectData(project_name="测试项目")
        
        # 添加展品
        self.project_data.exhibits = [
            Exhibit(exhibit_id="EX-001", name="展品1"),
            Exhibit(exhibit_id="EX-002", name="展品2"),
        ]
        
        # 添加扫描记录（EX-001被扫描到不同箱子）
        self.project_data.scan_records = [
            ScanRecord(
                scan_id="SCAN-001",
                exhibit_id="EX-001",
                box_number="BOX-A01",
                scan_time=datetime(2024, 5, 15, 9, 30, 0),
                operator="测试人员1"
            ),
            ScanRecord(
                scan_id="SCAN-002",
                exhibit_id="EX-001",
                box_number="BOX-A02",  # 不同的箱子！
                scan_time=datetime(2024, 5, 15, 10, 0, 0),
                operator="测试人员2"
            ),
            ScanRecord(
                scan_id="SCAN-003",
                exhibit_id="EX-002",
                box_number="BOX-A01",
                scan_time=datetime(2024, 5, 15, 10, 30, 0),
                operator="测试人员1"
            ),
        ]
    
    def test_detect_duplicate_box(self):
        """测试检测重复装箱"""
        rule = DuplicateBoxRule()
        anomalies = rule.validate(self.project_data)
        
        # 应该检测到EX-001被重复装箱
        self.assertEqual(len(anomalies), 1)
        self.assertEqual(anomalies[0].anomaly_type, "duplicate_box")
        self.assertEqual(anomalies[0].exhibit_id, "EX-001")
        self.assertEqual(anomalies[0].severity, "critical")
    
    def test_no_duplicate_box(self):
        """测试没有重复装箱的情况"""
        # 修改扫描记录，使EX-001都在同一个箱子
        self.project_data.scan_records[1].box_number = "BOX-A01"
        
        rule = DuplicateBoxRule()
        anomalies = rule.validate(self.project_data)
        
        # 同一个箱子多次扫描不算重复装箱
        self.assertEqual(len(anomalies), 0)


class TestMissingSignatureRule(TestCase):
    """签名缺失规则测试"""
    
    def setUp(self):
        """创建测试数据"""
        self.project_data = ProjectData(project_name="测试项目")
        
        self.project_data.scan_records = [
            ScanRecord(
                scan_id="SCAN-001",
                exhibit_id="EX-001",
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="测试人员1",
                has_signature=True  # 有签名
            ),
            ScanRecord(
                scan_id="SCAN-002",
                exhibit_id="EX-002",
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="测试人员2",
                has_signature=False  # 没有签名！
            ),
        ]
    
    def test_detect_missing_signature(self):
        """测试检测签名缺失"""
        rule = MissingSignatureRule()
        anomalies = rule.validate(self.project_data)
        
        # 应该检测到SCAN-002缺少签名
        self.assertEqual(len(anomalies), 1)
        self.assertEqual(anomalies[0].anomaly_type, "missing_signature")
        self.assertEqual(anomalies[0].scan_id, "SCAN-002")
        self.assertEqual(anomalies[0].severity, "high")


class TestFragileBufferRule(TestCase):
    """易碎品缓冲确认规则测试"""
    
    def setUp(self):
        """创建测试数据"""
        self.project_data = ProjectData(project_name="测试项目")
        
        # 添加展品
        self.project_data.exhibits = [
            Exhibit(exhibit_id="EX-001", name="易碎展品", is_fragile=True),
            Exhibit(exhibit_id="EX-002", name="普通展品", is_fragile=False),
        ]
        
        # 添加扫描记录
        self.project_data.scan_records = [
            ScanRecord(
                scan_id="SCAN-001",
                exhibit_id="EX-001",
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="测试人员",
                buffer_verified=False  # 易碎品没有缓冲确认！
            ),
            ScanRecord(
                scan_id="SCAN-002",
                exhibit_id="EX-002",
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="测试人员",
                buffer_verified=False  # 普通展品不需要
            ),
        ]
    
    def test_detect_fragile_buffer_missing(self):
        """测试检测易碎品缺少缓冲确认"""
        rule = FragileBufferRule()
        anomalies = rule.validate(self.project_data)
        
        # 应该检测到EX-001缺少缓冲确认
        self.assertEqual(len(anomalies), 1)
        self.assertEqual(anomalies[0].anomaly_type, "fragile_buffer_missing")
        self.assertEqual(anomalies[0].exhibit_id, "EX-001")
        self.assertEqual(anomalies[0].severity, "high")
    
    def test_fragile_with_buffer(self):
        """测试易碎品有缓冲确认的情况"""
        # 添加缓冲确认
        self.project_data.scan_records[0].buffer_verified = True
        
        rule = FragileBufferRule()
        anomalies = rule.validate(self.project_data)
        
        self.assertEqual(len(anomalies), 0)


class TestUnknownExhibitRule(TestCase):
    """未知展品规则测试"""
    
    def setUp(self):
        """创建测试数据"""
        self.project_data = ProjectData(project_name="测试项目")
        
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
                operator="测试人员"
            ),
            ScanRecord(
                scan_id="SCAN-002",
                exhibit_id="EX-UNKNOWN",  # 不在展品清单中！
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="测试人员"
            ),
        ]
    
    def test_detect_unknown_exhibit(self):
        """测试检测未知展品"""
        rule = UnknownExhibitRule()
        anomalies = rule.validate(self.project_data)
        
        # 应该检测到EX-UNKNOWN是未知展品
        self.assertEqual(len(anomalies), 1)
        self.assertEqual(anomalies[0].anomaly_type, "unknown_exhibit")
        self.assertEqual(anomalies[0].exhibit_id, "EX-UNKNOWN")
        self.assertEqual(anomalies[0].severity, "high")


class TestRuleEngine(TestCase):
    """规则引擎集成测试"""
    
    def setUp(self):
        """创建测试数据"""
        self.project_data = ProjectData(project_name="测试项目")
        
        # 添加展品
        self.project_data.exhibits = [
            Exhibit(exhibit_id="EX-001", name="展品1", is_fragile=True),
            Exhibit(exhibit_id="EX-002", name="展品2", is_fragile=False),
            Exhibit(exhibit_id="EX-003", name="展品3", is_fragile=False),  # 漏扫
        ]
        
        # 添加扫描记录
        self.project_data.scan_records = [
            ScanRecord(
                scan_id="SCAN-001",
                exhibit_id="EX-001",
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="测试人员",
                buffer_verified=False,  # 易碎品没有缓冲确认
                has_signature=True
            ),
            ScanRecord(
                scan_id="SCAN-002",
                exhibit_id="EX-001",
                box_number="BOX-A02",  # 重复装箱
                scan_time=datetime.now(),
                operator="测试人员",
                buffer_verified=True,
                has_signature=False  # 没有签名
            ),
            ScanRecord(
                scan_id="SCAN-003",
                exhibit_id="EX-UNKNOWN",  # 未知展品
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="测试人员",
                buffer_verified=True,
                has_signature=True
            ),
        ]
    
    def test_validate_all_rules(self):
        """测试执行所有规则"""
        engine = RuleEngine()
        anomalies, stats = engine.validate_all(self.project_data)
        
        # 检查统计信息
        self.assertGreater(stats['total_rules'], 0)
        self.assertGreater(stats['total_anomalies'], 0)
        
        # 检查是否检测到各种异常
        anomaly_types = [a.anomaly_type for a in anomalies]
        
        # 应该检测到：
        # - missing_scan: EX-003
        # - duplicate_box: EX-001
        # - missing_signature: SCAN-002
        # - fragile_buffer_missing: EX-001 (SCAN-001)
        # - unknown_exhibit: EX-UNKNOWN
        
        self.assertIn('missing_scan', anomaly_types)
        self.assertIn('duplicate_box', anomaly_types)
        self.assertIn('missing_signature', anomaly_types)
        self.assertIn('fragile_buffer_missing', anomaly_types)
        self.assertIn('unknown_exhibit', anomaly_types)
    
    def test_get_available_rules(self):
        """测试获取可用规则列表"""
        engine = RuleEngine()
        rules = engine.get_available_rules()
        
        self.assertGreater(len(rules), 0)
        
        # 检查规则信息
        for rule in rules:
            self.assertIn('name', rule)
            self.assertIn('description', rule)
            self.assertIn('severity', rule)


class TestTemperatureHumidityRule(TestCase):
    """温湿度记录规则测试"""
    
    def setUp(self):
        """创建测试数据"""
        self.project_data = ProjectData(project_name="测试项目")
        
        # 添加展品
        self.project_data.exhibits = [
            Exhibit(
                exhibit_id="EX-001", 
                name="高价值展品", 
                estimated_value=200000,  # 高价值（>10万）
                special_requirements=""
            ),
            Exhibit(
                exhibit_id="EX-002", 
                name="特殊要求展品", 
                estimated_value=50000,
                special_requirements="需要恒温恒湿运输"
            ),
            Exhibit(
                exhibit_id="EX-003", 
                name="普通展品", 
                estimated_value=10000,
                special_requirements=""
            ),
        ]
    
    def test_detect_temp_humidity_missing(self):
        """测试检测温湿度记录缺失"""
        # 添加扫描记录（没有温湿度记录）
        self.project_data.scan_records = [
            ScanRecord(
                scan_id="SCAN-001",
                exhibit_id="EX-001",  # 高价值，需要温湿度
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="测试人员",
                temperature=None,
                humidity=None
            ),
            ScanRecord(
                scan_id="SCAN-002",
                exhibit_id="EX-002",  # 有特殊温湿度要求
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="测试人员",
                temperature=None,
                humidity=None
            ),
            ScanRecord(
                scan_id="SCAN-003",
                exhibit_id="EX-003",  # 普通展品
                box_number="BOX-A01",
                scan_time=datetime.now(),
                operator="测试人员",
                temperature=None,
                humidity=None
            ),
        ]
        
        rule = TemperatureHumidityRule()
        anomalies = rule.validate(self.project_data)
        
        # EX-001和EX-002应该触发温湿度缺失异常
        # EX-003是普通展品，不需要
        exhibit_ids = [a.exhibit_id for a in anomalies]
        
        self.assertIn("EX-001", exhibit_ids)
        self.assertIn("EX-002", exhibit_ids)
        self.assertNotIn("EX-003", exhibit_ids)
        
        # 检查严重程度
        for anomaly in anomalies:
            self.assertEqual(anomaly.severity, "medium")
