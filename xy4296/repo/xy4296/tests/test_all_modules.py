#!/usr/bin/env python3
"""
综合测试模块
测试数据解析、规则引擎、状态存储和导出功能
"""

import sys
import os
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from parser.data_parser import DataParser
from parser.validators import DataValidator
from engine.rule_engine import RuleEngine
from engine.risk_assessor import RiskAssessor
from storage.state_manager import StateManager
from exporter.exporter import Exporter


class TestDataParser(unittest.TestCase):
    """测试数据解析模块"""
    
    def setUp(self):
        """测试前准备"""
        self.parser = DataParser()
        self.test_dir = Path(__file__).parent.parent / 'examples'
        
        # 创建测试CSV数据
        self.test_csv_data = """id,time,location,latitude,longitude,reflectivity
RD001,2026-05-03 14:00:00,测试位置,34.85,113.75,45
"""
    
    def test_parse_csv(self):
        """测试解析CSV文件"""
        # 创建临时CSV文件
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(self.test_csv_data)
            temp_path = f.name
        
        try:
            result = self.parser.parse_file(temp_path)
            self.assertIn('radar_data', result)
            self.assertEqual(len(result['radar_data']), 1)
            
            radar = result['radar_data'][0]
            self.assertEqual(radar['id'], 'RD001')
            self.assertEqual(radar['latitude'], 34.85)
            self.assertEqual(radar['longitude'], 113.75)
            self.assertEqual(radar['reflectivity'], 45.0)
            
        finally:
            os.unlink(temp_path)
    
    def test_parse_json(self):
        """测试解析JSON文件"""
        json_data = {
            'radar_data': [{
                'id': 'RD001',
                'time': '2026-05-03 14:00:00',
                'location': '测试位置',
                'latitude': 34.85,
                'longitude': 113.75,
                'reflectivity': 45
            }]
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
            import json
            json.dump(json_data, f)
            temp_path = f.name
        
        try:
            result = self.parser.parse_file(temp_path)
            self.assertIn('radar_data', result)
            self.assertEqual(len(result['radar_data']), 1)
            
        finally:
            os.unlink(temp_path)
    
    def test_parse_yaml(self):
        """测试解析YAML文件"""
        yaml_data = """radar_data:
  - id: RD001
    time: "2026-05-03 14:00:00"
    location: 测试位置
    latitude: 34.85
    longitude: 113.75
    reflectivity: 45
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
            f.write(yaml_data)
            temp_path = f.name
        
        try:
            result = self.parser.parse_file(temp_path)
            self.assertIn('radar_data', result)
            self.assertEqual(len(result['radar_data']), 1)
            
        finally:
            os.unlink(temp_path)
    
    def test_parse_datetime(self):
        """测试日期时间解析"""
        test_cases = [
            ('2026-05-03 14:00:00', True),
            ('2026/05/03 14:00', True),
            ('2026年05月03日', True),
            ('', False),
            ('invalid', False)
        ]
        
        for datetime_str, should_parse in test_cases:
            result = self.parser._parse_datetime(datetime_str)
            if should_parse:
                self.assertIsNotNone(result, f"应该能解析: {datetime_str}")
            else:
                self.assertIsNone(result, f"不应该解析: {datetime_str}")


class TestDataValidator(unittest.TestCase):
    """测试数据验证模块"""
    
    def setUp(self):
        """测试前准备"""
        self.validator = DataValidator()
    
    def test_validate_radar_data(self):
        """测试验证雷达数据"""
        valid_radar = {
            'id': 'RD001',
            'time': datetime.now(),
            'latitude': 34.85,
            'longitude': 113.75,
            'reflectivity': 45,
            'movement_direction': 90
        }
        
        invalid_radar = {
            'id': 'RD002',
            'time': None,  # 缺少时间
            'latitude': 100,  # 无效纬度
            'longitude': 200,  # 无效经度
            'reflectivity': 100,  # 超出常规范围
            'movement_direction': 400  # 无效方向
        }
        
        test_data = {'radar_data': [valid_radar, invalid_radar]}
        is_valid, errors = self.validator.validate_all(test_data)
        
        # 应该发现错误
        self.assertFalse(is_valid)
        self.assertTrue(len(errors) > 0)
    
    def test_validate_airspace_data(self):
        """测试验证空域批复数据"""
        valid_approval = {
            'approval_number': 'KY2026001',
            'start_time': datetime.now(),
            'end_time': datetime.now() + timedelta(hours=2),
            'altitude_min': 0,
            'altitude_max': 5000
        }
        
        invalid_approval = {
            'approval_number': '',  # 缺少批复编号
            'start_time': datetime.now() + timedelta(hours=2),  # 开始时间晚于结束时间
            'end_time': datetime.now(),
            'altitude_min': -100,  # 负数高度
            'altitude_max': 0
        }
        
        test_data = {'airspace_approvals': [valid_approval, invalid_approval]}
        is_valid, errors = self.validator.validate_all(test_data)
        
        self.assertFalse(is_valid)
    
    def test_validate_ammunition_data(self):
        """测试验证弹药库存数据"""
        # 已过期的弹药
        expired_ammo = {
            'batch_number': 'BATCH-001',
            'type': 'WR-98火箭弹',
            'quantity': 50,
            'expiry_date': datetime.now() - timedelta(days=30),
            'status': 'normal'
        }
        
        # 库存为0
        zero_ammo = {
            'batch_number': 'BATCH-002',
            'type': '37高炮炮弹',
            'quantity': 0,
            'expiry_date': datetime.now() + timedelta(days=365),
            'status': 'normal'
        }
        
        test_data = {'ammunition_inventory': [expired_ammo, zero_ammo]}
        is_valid, errors = self.validator.validate_all(test_data)
        
        # 过期弹药应该是错误
        self.assertFalse(is_valid)
    
    def test_validate_personnel_data(self):
        """测试验证人员资质数据"""
        # 已过期的资质
        expired_person = {
            'name': '张三',
            'qualification_type': '人工增雨作业资质',
            'qualification_number': 'QZ-001',
            'expiry_date': datetime.now() - timedelta(days=30),
            'status': 'valid'
        }
        
        # 缺少必要字段
        invalid_person = {
            'name': '',
            'qualification_type': '',
            'qualification_number': '',
            'expiry_date': None,
            'status': 'valid'
        }
        
        test_data = {'personnel_qualifications': [expired_person, invalid_person]}
        is_valid, errors = self.validator.validate_all(test_data)
        
        self.assertFalse(is_valid)


class TestRuleEngine(unittest.TestCase):
    """测试规则引擎模块"""
    
    def setUp(self):
        """测试前准备"""
        self.rule_engine = RuleEngine()
        self.now = datetime.now()
    
    def test_check_no_fly_time(self):
        """测试禁飞时段检查"""
        # 有效空域批复
        valid_approval = {
            'approval_number': 'KY2026001',
            'start_time': self.now - timedelta(hours=1),
            'end_time': self.now + timedelta(hours=2),
            'status': 'approved'
        }
        
        # 已过期的空域批复
        expired_approval = {
            'approval_number': 'KY2026002',
            'start_time': self.now - timedelta(hours=3),
            'end_time': self.now - timedelta(hours=1),
            'status': 'approved'
        }
        
        # 测试没有空域批复的情况
        risks = self.rule_engine.check_all_rules({'airspace_approvals': []}, self.now)
        critical_risks = [r for r in risks if r['severity'] == 'critical']
        self.assertTrue(len(critical_risks) > 0)
        
        # 测试有效空域批复
        self.rule_engine.clear_risks()
        risks = self.rule_engine.check_all_rules({'airspace_approvals': [valid_approval]}, self.now)
        critical_risks = [r for r in risks if r['severity'] == 'critical' and r['category'] == 'no_fly_time']
        # 应该没有禁飞时段的严重风险
        no_fly_critical = [r for r in critical_risks if r['category'] == 'no_fly_time']
        # 这里应该检查是否有"无空域批复数据"的风险被排除
    
    def test_check_ammunition_expiry(self):
        """测试弹药过期检查"""
        # 已过期的弹药
        expired_ammo = {
            'batch_number': 'BATCH-EXPIRED',
            'type': 'WR-98火箭弹',
            'quantity': 50,
            'expiry_date': self.now - timedelta(days=30),
            'status': 'normal'
        }
        
        # 有效的弹药
        valid_ammo = {
            'batch_number': 'BATCH-VALID',
            'type': '37高炮炮弹',
            'quantity': 100,
            'expiry_date': self.now + timedelta(days=365),
            'status': 'normal'
        }
        
        # 即将过期的弹药
        soon_expired_ammo = {
            'batch_number': 'BATCH-SOON',
            'type': 'WR-98火箭弹',
            'quantity': 30,
            'expiry_date': self.now + timedelta(days=15),
            'status': 'normal'
        }
        
        test_data = {'ammunition_inventory': [expired_ammo, valid_ammo, soon_expired_ammo]}
        risks = self.rule_engine.check_all_rules(test_data, self.now)
        
        # 应该检测到过期弹药的严重风险
        expired_risks = [r for r in risks if r['category'] == 'ammunition_expiry' and r['severity'] == 'critical']
        self.assertTrue(len(expired_risks) > 0)
        
        # 应该检测到即将过期的警告
        warning_risks = [r for r in risks if r['category'] == 'ammunition_expiry' and r['severity'] == 'warning']
        self.assertTrue(len(warning_risks) > 0)
    
    def test_check_qualification_expiry(self):
        """测试人员资质过期检查"""
        # 已过期的资质
        expired_person = {
            'name': '张三',
            'qualification_type': '人工增雨作业资质',
            'qualification_number': 'QZ-EXPIRED',
            'expiry_date': self.now - timedelta(days=30),
            'status': 'valid'
        }
        
        # 有效的资质
        valid_person = {
            'name': '李四',
            'qualification_type': '人工增雨作业资质',
            'qualification_number': 'QZ-VALID',
            'expiry_date': self.now + timedelta(days=365),
            'status': 'valid'
        }
        
        # 即将过期的资质
        soon_expired_person = {
            'name': '王五',
            'qualification_type': '人工增雨作业资质',
            'qualification_number': 'QZ-SOON',
            'expiry_date': self.now + timedelta(days=60),
            'status': 'valid'
        }
        
        test_data = {'personnel_qualifications': [expired_person, valid_person, soon_expired_person]}
        risks = self.rule_engine.check_all_rules(test_data, self.now)
        
        # 应该检测到过期资质的严重风险
        expired_risks = [r for r in risks if r['category'] == 'qualification_expiry' and r['severity'] == 'critical']
        self.assertTrue(len(expired_risks) > 0)
    
    def test_check_radar_threat(self):
        """测试雷达威胁检查"""
        # 强回波
        strong_radar = {
            'id': 'RD-STRONG',
            'time': self.now,
            'latitude': 34.85,
            'longitude': 113.75,
            'reflectivity': 55,
            'storm_type': '强对流'
        }
        
        # 中等回波
        medium_radar = {
            'id': 'RD-MEDIUM',
            'time': self.now,
            'latitude': 34.80,
            'longitude': 113.80,
            'reflectivity': 35,
            'storm_type': '层状云'
        }
        
        # 弱回波
        weak_radar = {
            'id': 'RD-WEAK',
            'time': self.now,
            'latitude': 34.90,
            'longitude': 113.60,
            'reflectivity': 25,
            'storm_type': '弱回波'
        }
        
        test_data = {'radar_data': [strong_radar, medium_radar, weak_radar]}
        risks = self.rule_engine.check_all_rules(test_data, self.now)
        
        # 应该检测到强回波的严重风险
        strong_risks = [r for r in risks if r['category'] == 'radar_threat' and r['severity'] == 'critical']
        self.assertTrue(len(strong_risks) > 0)


class TestRiskAssessor(unittest.TestCase):
    """测试风险评估模块"""
    
    def setUp(self):
        """测试前准备"""
        self.assessor = RiskAssessor()
    
    def test_assess_risks(self):
        """测试风险评估"""
        test_risks = [
            {
                'severity': 'critical',
                'category': 'ammunition_expiry',
                'title': '弹药已过期',
                'description': '弹药批号 BATCH-001 已过期',
                'details': {},
                'timestamp': datetime.now()
            },
            {
                'severity': 'high',
                'category': 'radar_threat',
                'title': '强回波威胁',
                'description': '检测到强回波',
                'details': {},
                'timestamp': datetime.now()
            },
            {
                'severity': 'warning',
                'category': 'no_fly_time',
                'title': '空域批复即将过期',
                'description': '空域批复将在15分钟后过期',
                'details': {},
                'timestamp': datetime.now()
            }
        ]
        
        result = self.assessor.assess_risks(test_risks)
        
        self.assertEqual(result['total_risks'], 3)
        self.assertEqual(result['overall_risk'], 'critical')
        self.assertFalse(result['can_proceed'])
    
    def test_get_risk_summary(self):
        """测试获取风险摘要"""
        test_risks = [
            {
                'severity': 'critical',
                'category': 'ammunition_expiry',
                'title': '测试风险1',
                'description': '测试描述',
                'details': {},
                'timestamp': datetime.now()
            }
        ]
        
        self.assessor.assess_risks(test_risks)
        summary = self.assessor.get_risk_summary()
        
        self.assertIn('total_risks', summary)
        self.assertIn('overall_risk', summary)
        self.assertIn('can_proceed', summary)
    
    def test_get_statistics(self):
        """测试获取统计信息"""
        test_risks = [
            {
                'severity': 'critical',
                'category': 'ammunition_expiry',
                'title': '测试风险1',
                'description': '测试描述',
                'details': {},
                'timestamp': datetime.now()
            },
            {
                'severity': 'high',
                'category': 'radar_threat',
                'title': '测试风险2',
                'description': '测试描述',
                'details': {},
                'timestamp': datetime.now()
            }
        ]
        
        self.assessor.assess_risks(test_risks)
        stats = self.assessor.get_statistics()
        
        self.assertEqual(stats['total_risks'], 2)
        self.assertIn('by_severity', stats)
        self.assertIn('by_category', stats)


class TestStateManager(unittest.TestCase):
    """测试状态存储模块"""
    
    def setUp(self):
        """测试前准备"""
        # 使用临时目录
        self.temp_dir = tempfile.mkdtemp()
        self.state_manager = StateManager(self.temp_dir)
    
    def tearDown(self):
        """测试后清理"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_create_new_session(self):
        """测试创建新会话"""
        session_id = self.state_manager.create_new_session("测试作业")
        
        self.assertIsNotNone(session_id)
        
        current_session = self.state_manager.get_current_status()
        self.assertIsNotNone(current_session)
        self.assertEqual(current_session['operation_name'], "测试作业")
        self.assertEqual(current_session['status'], 'pending')
    
    def test_save_and_load_session(self):
        """测试保存和加载会话"""
        # 创建会话
        session_id = self.state_manager.create_new_session("测试作业")
        
        # 更新状态
        self.state_manager.update_status('reviewed', "复核完成，无重大问题")
        
        # 保存
        self.assertTrue(self.state_manager.save_session())
        
        # 清除当前会话
        self.state_manager.clear_current_session()
        self.assertIsNone(self.state_manager.get_current_status())
        
        # 重新加载
        self.assertTrue(self.state_manager.load_session(session_id))
        
        loaded_session = self.state_manager.get_current_status()
        self.assertIsNotNone(loaded_session)
        self.assertEqual(loaded_session['status'], 'reviewed')
        self.assertEqual(loaded_session['review_notes'], "复核完成，无重大问题")
    
    def test_update_status(self):
        """测试更新状态"""
        self.state_manager.create_new_session("测试作业")
        
        # 测试各种状态
        test_statuses = [
            ('reviewed', "复核备注"),
            ('approved', "放行意见"),
            ('rejected', "驳回原因")
        ]
        
        for status, notes in test_statuses:
            self.assertTrue(self.state_manager.update_status(status, notes))
            
            current = self.state_manager.get_current_status()
            self.assertEqual(current['status'], status)
            
            if status == 'reviewed':
                self.assertEqual(current['review_notes'], notes)
            elif status == 'approved':
                self.assertEqual(current['approval_notes'], notes)
            elif status == 'rejected':
                self.assertEqual(current['rejection_reason'], notes)
    
    def test_get_all_sessions(self):
        """测试获取所有会话"""
        # 创建多个会话
        for i in range(3):
            self.state_manager.create_new_session(f"测试作业{i+1}")
            self.state_manager.save_session()
        
        sessions = self.state_manager.get_all_sessions()
        
        self.assertEqual(len(sessions), 3)
    
    def test_delete_session(self):
        """测试删除会话"""
        session_id = self.state_manager.create_new_session("要删除的作业")
        self.state_manager.save_session()
        
        # 确认会话存在
        sessions = self.state_manager.get_all_sessions()
        self.assertEqual(len(sessions), 1)
        
        # 删除会话
        self.assertTrue(self.state_manager.delete_session(session_id))
        
        # 确认会话已删除
        sessions = self.state_manager.get_all_sessions()
        self.assertEqual(len(sessions), 0)
    
    def test_status_display(self):
        """测试状态显示"""
        display_names = {
            'pending': '待复核',
            'reviewed': '已复核',
            'approved': '已放行',
            'rejected': '已驳回'
        }
        
        for status, expected_name in display_names.items():
            self.assertEqual(self.state_manager.get_status_display(status), expected_name)


class TestExporter(unittest.TestCase):
    """测试导出模块"""
    
    def setUp(self):
        """测试前准备"""
        self.exporter = Exporter()
        self.temp_dir = tempfile.mkdtemp()
        
        # 准备测试数据
        self.test_session = {
            'session_id': 'TEST-20260503',
            'operation_name': '测试作业',
            'created_at': datetime.now(),
            'updated_at': datetime.now(),
            'status': 'reviewed',
            'review_notes': '复核完成，无重大问题',
            'data_sources': []
        }
        
        self.test_risks = [
            {
                'severity': 'high',
                'category': 'radar_threat',
                'title': '较强回波',
                'description': '检测到较强回波',
                'details': {'reflectivity': 45},
                'timestamp': datetime.now()
            }
        ]
        
        self.test_parsed_data = {
            'radar_data': [],
            'airspace_approvals': [],
            'operation_points': [],
            'ammunition_inventory': [{'quantity': 100}],
            'personnel_qualifications': []
        }
    
    def tearDown(self):
        """测试后清理"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_export_markdown_release_note(self):
        """测试导出Markdown放行单"""
        output_path = os.path.join(self.temp_dir, 'test_release_note.md')
        
        result = self.exporter.export_markdown_release_note(
            self.test_session,
            self.test_risks,
            self.test_parsed_data,
            output_path
        )
        
        self.assertTrue(result)
        self.assertTrue(os.path.exists(output_path))
        
        # 验证文件内容
        with open(output_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        self.assertIn('人工增雨作业放行单', content)
        self.assertIn('测试作业', content)
        self.assertIn('较强回波', content)
    
    def test_export_csv_risk_list(self):
        """测试导出CSV风险清单"""
        output_path = os.path.join(self.temp_dir, 'test_risk_list.csv')
        
        result = self.exporter.export_csv_risk_list(
            self.test_risks,
            output_path
        )
        
        self.assertTrue(result)
        self.assertTrue(os.path.exists(output_path))
        
        # 验证文件内容
        with open(output_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        self.assertIn('较强回波', content)
    
    def test_export_json_audit_package(self):
        """测试导出JSON审计包"""
        output_path = os.path.join(self.temp_dir, 'test_audit_package.json')
        
        result = self.exporter.export_json_audit_package(
            self.test_session,
            self.test_risks,
            self.test_parsed_data,
            output_path
        )
        
        self.assertTrue(result)
        self.assertTrue(os.path.exists(output_path))
        
        # 验证文件内容
        import json
        with open(output_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        self.assertIn('version', data)
        self.assertIn('session', data)
        self.assertIn('risks', data)
        self.assertIn('data_summary', data)
    
    def test_generate_filename(self):
        """测试生成文件名"""
        filename = self.exporter.generate_filename('放行单', 'md', 'TEST-001')
        
        self.assertIn('放行单', filename)
        self.assertIn('TEST-001', filename)
        self.assertTrue(filename.endswith('.md'))


def run_tests():
    """运行所有测试"""
    # 创建测试套件
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # 添加测试用例
    suite.addTests(loader.loadTestsFromTestCase(TestDataParser))
    suite.addTests(loader.loadTestsFromTestCase(TestDataValidator))
    suite.addTests(loader.loadTestsFromTestCase(TestRuleEngine))
    suite.addTests(loader.loadTestsFromTestCase(TestRiskAssessor))
    suite.addTests(loader.loadTestsFromTestCase(TestStateManager))
    suite.addTests(loader.loadTestsFromTestCase(TestExporter))
    
    # 运行测试
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)
