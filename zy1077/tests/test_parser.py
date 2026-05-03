#!/usr/bin/env python3
"""测试解析/校验模块"""

import unittest
import sys
import os
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from yogurt_sim.parser import validate_plan, normalize_plan, CultureType


class TestParser(unittest.TestCase):
    """测试解析器"""
    
    def setUp(self):
        """设置测试数据"""
        self.valid_plan = {
            "name": "测试方案",
            "milk_volume_ml": 500,
            "culture_type": "yogurt_starter",
            "culture_activity": 8,
            "inoculation_ratio": 2.0,
            "initial_temp_c": 40,
            "target_temp_c": 40,
            "total_duration_h": 8,
            "ambient_temp_c": 25,
            "container_size_ml": 600,
            "preheated": True,
        }
    
    def test_validate_valid_plan(self):
        """测试验证有效方案"""
        result = validate_plan(self.valid_plan)
        self.assertTrue(result["valid"])
        self.assertEqual(len(result["errors"]), 0)
    
    def test_validate_missing_fields(self):
        """测试缺少必需字段"""
        invalid_plan = self.valid_plan.copy()
        del invalid_plan["name"]
        del invalid_plan["milk_volume_ml"]
        
        result = validate_plan(invalid_plan)
        self.assertFalse(result["valid"])
        self.assertGreater(len(result["errors"]), 0)
    
    def test_validate_negative_milk_volume(self):
        """测试牛奶量为负数"""
        invalid_plan = self.valid_plan.copy()
        invalid_plan["milk_volume_ml"] = -100
        
        result = validate_plan(invalid_plan)
        self.assertFalse(result["valid"])
        self.assertTrue(any("牛奶量必须大于 0" in e for e in result["errors"]))
    
    def test_validate_negative_duration(self):
        """测试发酵时长为负数"""
        invalid_plan = self.valid_plan.copy()
        invalid_plan["total_duration_h"] = -5
        
        result = validate_plan(invalid_plan)
        self.assertFalse(result["valid"])
        self.assertTrue(any("发酵时长必须大于 0" in e for e in result["errors"]))
    
    def test_validate_temperature_range(self):
        """测试温度范围验证"""
        # 温度过低
        cold_plan = self.valid_plan.copy()
        cold_plan["target_temp_c"] = -5
        result = validate_plan(cold_plan)
        self.assertFalse(result["valid"])
        
        # 温度过高
        hot_plan = self.valid_plan.copy()
        hot_plan["target_temp_c"] = 150
        result = validate_plan(hot_plan)
        self.assertFalse(result["valid"])
    
    def test_validate_culture_activity_range(self):
        """测试菌种活性范围"""
        # 活性过低
        low_activity = self.valid_plan.copy()
        low_activity["culture_activity"] = 0
        result = validate_plan(low_activity)
        self.assertFalse(result["valid"])
        
        # 活性过高
        high_activity = self.valid_plan.copy()
        high_activity["culture_activity"] = 11
        result = validate_plan(high_activity)
        self.assertFalse(result["valid"])
    
    def test_validate_inoculation_ratio(self):
        """测试接种比例验证"""
        # 接种比例为0
        zero_ratio = self.valid_plan.copy()
        zero_ratio["inoculation_ratio"] = 0
        result = validate_plan(zero_ratio)
        self.assertFalse(result["valid"])
        
        # 接种比例过高（警告，不是错误）
        high_ratio = self.valid_plan.copy()
        high_ratio["inoculation_ratio"] = 25
        result = validate_plan(high_ratio)
        self.assertTrue(result["valid"])  # 仍然有效，但有警告
        self.assertGreater(len(result["warnings"]), 0)
    
    def test_validate_container_overflow(self):
        """测试容器溢出验证"""
        overflow_plan = self.valid_plan.copy()
        overflow_plan["milk_volume_ml"] = 700
        overflow_plan["container_size_ml"] = 600
        
        result = validate_plan(overflow_plan)
        self.assertFalse(result["valid"])
        self.assertTrue(any("溢出" in e for e in result["errors"]))
    
    def test_validate_container_fill_ratio_warnings(self):
        """测试容器填充率警告"""
        # 填充率过高
        high_fill = self.valid_plan.copy()
        high_fill["milk_volume_ml"] = 550
        high_fill["container_size_ml"] = 600
        
        result = validate_plan(high_fill)
        self.assertTrue(result["valid"])
        self.assertTrue(any("填充率较高" in w for w in result["warnings"]))
        
        # 填充率过低
        low_fill = self.valid_plan.copy()
        low_fill["milk_volume_ml"] = 100
        low_fill["container_size_ml"] = 600
        
        result = validate_plan(low_fill)
        self.assertTrue(result["valid"])
        self.assertTrue(any("填充率较低" in w for w in result["warnings"]))
    
    def test_validate_low_temperature_warning(self):
        """测试低温警告"""
        cold_plan = self.valid_plan.copy()
        cold_plan["target_temp_c"] = 28
        
        result = validate_plan(cold_plan)
        self.assertTrue(result["valid"])
        self.assertTrue(any("温度较低" in w for w in result["warnings"]))
    
    def test_validate_high_temperature_warning(self):
        """测试高温警告"""
        hot_plan = self.valid_plan.copy()
        hot_plan["target_temp_c"] = 52
        
        result = validate_plan(hot_plan)
        self.assertTrue(result["valid"])
        self.assertTrue(any("温度较高" in w for w in result["warnings"]))
    
    def test_validate_long_duration_warning(self):
        """测试长时间发酵警告"""
        long_plan = self.valid_plan.copy()
        long_plan["total_duration_h"] = 25  # 需要超过 24 小时才会触发警告
        
        result = validate_plan(long_plan)
        self.assertTrue(result["valid"])
        self.assertTrue(any("时长较长" in w for w in result["warnings"]))
    
    def test_validate_preheat_mismatch_warning(self):
        """测试预热不匹配警告"""
        mismatch_plan = self.valid_plan.copy()
        mismatch_plan["preheated"] = True
        mismatch_plan["initial_temp_c"] = 25
        mismatch_plan["target_temp_c"] = 40
        
        result = validate_plan(mismatch_plan)
        self.assertTrue(result["valid"])
        # 预热不匹配警告在 risk 模块中检测，不在 parser 中
    
    def test_normalize_plan(self):
        """测试方案标准化"""
        minimal_plan = self.valid_plan.copy()
        
        normalized = normalize_plan(minimal_plan)
        
        # 检查默认值是否被设置
        self.assertIn("milk_fat_content", normalized)
        self.assertEqual(normalized["milk_fat_content"], 3.5)
        
        # 检查布尔值
        self.assertIsInstance(normalized["preheated"], bool)
    
    def test_normalize_plan_with_custom_values(self):
        """测试带自定义值的方案标准化"""
        custom_plan = self.valid_plan.copy()
        custom_plan["milk_fat_content"] = 1.5  # 低脂牛奶
        
        normalized = normalize_plan(custom_plan)
        
        # 自定义值应该保留
        self.assertEqual(normalized["milk_fat_content"], 1.5)


if __name__ == "__main__":
    unittest.main()
