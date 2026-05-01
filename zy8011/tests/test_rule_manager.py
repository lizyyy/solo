"""
测试规则管理器
"""
import unittest
import tempfile
import json
import csv
from pathlib import Path

from inspection_organizer.rule_manager import RuleManager


class TestRuleManager(unittest.TestCase):
    """测试规则管理器"""
    
    def setUp(self):
        """设置测试环境"""
        self.temp_dir = tempfile.mkdtemp()
        self.rule_manager = RuleManager()
    
    def create_test_rules_file(self, rules_data: dict) -> str:
        """创建测试规则文件"""
        file_path = Path(self.temp_dir) / "test_rules.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(rules_data, f, ensure_ascii=False, indent=2)
        return str(file_path)
    
    def create_test_inspection_file(self, rows: list) -> str:
        """创建测试巡检清单文件"""
        file_path = Path(self.temp_dir) / "test_inspection.csv"
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['门店编码', '点位', '是否必填'])
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
        return str(file_path)
    
    def test_load_store_rules(self):
        """测试加载门店规则"""
        rules_data = {
            "stores": [
                {
                    "store_code": "SH001",
                    "store_name": "上海南京路店",
                    "checkpoints": ["入口", "收银台", "货架A"],
                    "time_window": {"start": "09:00", "end": "21:00"},
                    "photo_patterns": ["SH001"],
                    "checkpoint_patterns": {}
                }
            ]
        }
        
        rules_file = self.create_test_rules_file(rules_data)
        rules = self.rule_manager.load_store_rules(rules_file)
        
        self.assertEqual(len(rules), 1)
        self.assertEqual(rules[0].store_code, "SH001")
        self.assertEqual(rules[0].store_name, "上海南京路店")
        self.assertEqual(len(rules[0].checkpoints), 3)
    
    def test_load_inspection_list(self):
        """测试加载巡检清单"""
        inspection_data = [
            {"门店编码": "SH001", "点位": "入口", "是否必填": "是"},
            {"门店编码": "SH001", "点位": "收银台", "是否必填": "是"},
            {"门店编码": "SH001", "点位": "仓库", "是否必填": "否"},
        ]
        
        inspection_file = self.create_test_inspection_file(inspection_data)
        items = self.rule_manager.load_inspection_list(inspection_file)
        
        self.assertEqual(len(items), 3)
        self.assertEqual(items[0].store_code, "SH001")
        self.assertEqual(items[0].checkpoint, "入口")
        self.assertTrue(items[0].required)
        self.assertFalse(items[2].required)
    
    def test_time_window_validation(self):
        """测试时间窗口验证"""
        # 先加载规则
        rules_data = {
            "stores": [
                {
                    "store_code": "SH001",
                    "store_name": "测试店",
                    "checkpoints": ["入口"],
                    "time_window": {"start": "09:00", "end": "21:00"},
                    "photo_patterns": [],
                    "checkpoint_patterns": {}
                }
            ]
        }
        
        rules_file = self.create_test_rules_file(rules_data)
        self.rule_manager.load_store_rules(rules_file)
        
        # 测试在窗口内的时间
        self.assertTrue(self.rule_manager.is_time_in_window("SH001", "2026-05-01 10:00:00"))
        self.assertTrue(self.rule_manager.is_time_in_window("SH001", "2026-05-01 09:00:00"))
        self.assertTrue(self.rule_manager.is_time_in_window("SH001", "2026-05-01 21:00:00"))
        
        # 测试在窗口外的时间
        self.assertFalse(self.rule_manager.is_time_in_window("SH001", "2026-05-01 08:00:00"))
        self.assertFalse(self.rule_manager.is_time_in_window("SH001", "2026-05-01 22:00:00"))
    
    def test_time_deviation_calculation(self):
        """测试时间偏差计算"""
        rules_data = {
            "stores": [
                {
                    "store_code": "SH001",
                    "store_name": "测试店",
                    "checkpoints": ["入口"],
                    "time_window": {"start": "09:00", "end": "21:00"},
                    "photo_patterns": [],
                    "checkpoint_patterns": {}
                }
            ]
        }
        
        rules_file = self.create_test_rules_file(rules_data)
        self.rule_manager.load_store_rules(rules_file)
        
        # 测试在窗口内
        deviation = self.rule_manager.get_time_deviation_minutes("SH001", "2026-05-01 12:00:00")
        self.assertEqual(deviation, 0)
        
        # 测试早于窗口（08:30，早于09:00）
        deviation = self.rule_manager.get_time_deviation_minutes("SH001", "2026-05-01 08:30:00")
        self.assertEqual(deviation, -30)  # 早30分钟
        
        # 测试晚于窗口（22:30，晚于21:00）
        deviation = self.rule_manager.get_time_deviation_minutes("SH001", "2026-05-01 22:30:00")
        self.assertEqual(deviation, 90)  # 晚90分钟
    
    def test_get_required_checkpoints(self):
        """测试获取必检点位"""
        # 先加载规则
        rules_data = {
            "stores": [
                {
                    "store_code": "SH001",
                    "store_name": "测试店",
                    "checkpoints": ["入口", "收银台", "仓库"],
                    "time_window": {"start": "09:00", "end": "21:00"},
                    "photo_patterns": [],
                    "checkpoint_patterns": {}
                }
            ]
        }
        
        rules_file = self.create_test_rules_file(rules_data)
        self.rule_manager.load_store_rules(rules_file)
        
        # 加载巡检清单
        inspection_data = [
            {"门店编码": "SH001", "点位": "入口", "是否必填": "是"},
            {"门店编码": "SH001", "点位": "收银台", "是否必填": "是"},
            {"门店编码": "SH001", "点位": "仓库", "是否必填": "否"},
        ]
        
        inspection_file = self.create_test_inspection_file(inspection_data)
        self.rule_manager.load_inspection_list(inspection_file)
        
        # 获取必检点位
        required = self.rule_manager.get_required_checkpoints("SH001")
        
        self.assertEqual(len(required), 2)
        self.assertIn("入口", required)
        self.assertIn("收银台", required)
        self.assertNotIn("仓库", required)
    
    def test_validation(self):
        """测试规则与清单一致性验证"""
        # 加载规则（只有SH001）
        rules_data = {
            "stores": [
                {
                    "store_code": "SH001",
                    "store_name": "测试店",
                    "checkpoints": ["入口"],
                    "time_window": {"start": "09:00", "end": "21:00"},
                    "photo_patterns": [],
                    "checkpoint_patterns": {}
                }
            ]
        }
        
        rules_file = self.create_test_rules_file(rules_data)
        self.rule_manager.load_store_rules(rules_file)
        
        # 加载巡检清单（有SH001和SH002）
        inspection_data = [
            {"门店编码": "SH001", "点位": "入口", "是否必填": "是"},
            {"门店编码": "SH002", "点位": "入口", "是否必填": "是"},  # SH002不在规则中
        ]
        
        inspection_file = self.create_test_inspection_file(inspection_data)
        self.rule_manager.load_inspection_list(inspection_file)
        
        # 验证
        issues = self.rule_manager.validate()
        
        # 应该检测到SH002在清单中但没有规则
        self.assertEqual(len(issues), 1)
        self.assertIn("SH002", issues[0])


if __name__ == '__main__':
    unittest.main()
