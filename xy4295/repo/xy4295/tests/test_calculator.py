"""
测试计算器模块
"""

import unittest
from datetime import datetime, timedelta
from pathlib import Path
import sys
import tempfile
import os

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from reef_dosing_helper.models import (
    TankParams, DailyReading, SupplementConfig, DosingPlan, DosingResult,
    DEFAULT_SUPPLEMENTS
)
from reef_dosing_helper.csv_reader import CSVReader
from reef_dosing_helper.calculator import DosingCalculator
from reef_dosing_helper.exporter import Exporter


class TestTankParams(unittest.TestCase):
    """测试缸体参数"""
    
    def test_validate_valid_params(self):
        """测试有效的参数验证"""
        params = TankParams(
            tank_name="测试缸",
            total_volume=200.0,
            target_kh_min=7.0,
            target_kh_max=9.0,
            target_ca_min=400.0,
            target_ca_max=450.0,
            target_mg_min=1250.0,
            target_mg_max=1350.0,
            target_salinity_min=1.024,
            target_salinity_max=1.026,
        )
        
        warnings = params.validate()
        self.assertEqual(len(warnings), 0)
    
    def test_validate_invalid_volume(self):
        """测试无效的体积"""
        params = TankParams(
            total_volume=0.0,
        )
        
        warnings = params.validate()
        self.assertTrue(any("总水量必须大于0" in w for w in warnings))
    
    def test_validate_invalid_range(self):
        """测试无效的目标范围"""
        params = TankParams(
            total_volume=200.0,
            target_kh_min=9.0,
            target_kh_max=7.0,
        )
        
        warnings = params.validate()
        self.assertTrue(any("KH目标最小值应小于最大值" in w for w in warnings))
    
    def test_get_target_midpoint(self):
        """测试获取目标中点"""
        params = TankParams(
            target_kh_min=7.0,
            target_kh_max=9.0,
        )
        
        midpoint = params.get_target_midpoint('kh')
        self.assertEqual(midpoint, 8.0)


class TestDailyReading(unittest.TestCase):
    """测试每日检测数据"""
    
    def test_get_missing_params_all_present(self):
        """测试所有参数都存在"""
        reading = DailyReading(
            date=datetime.now(),
            kh=8.0,
            ca=420.0,
            mg=1300.0,
            salinity=1.025,
            evaporation=5.0,
        )
        
        missing = reading.get_missing_params()
        self.assertEqual(len(missing), 0)
    
    def test_get_missing_params_some_missing(self):
        """测试部分参数缺失"""
        reading = DailyReading(
            date=datetime.now(),
            kh=8.0,
            ca=None,
            mg=1300.0,
            salinity=None,
            evaporation=5.0,
        )
        
        missing = reading.get_missing_params()
        self.assertIn('钙', missing)
        self.assertIn('盐度', missing)


class TestSupplementConfig(unittest.TestCase):
    """测试补剂配置"""
    
    def test_validate_valid_config(self):
        """测试有效的配置"""
        config = SupplementConfig(
            name="KH提升液",
            param="kh",
            concentration=1.0,
            concentration_unit="meq/mL",
            max_daily_dosage=5.0,
            safety_threshold=1.0,
        )
        
        warnings = config.validate()
        self.assertEqual(len(warnings), 0)
    
    def test_validate_invalid_concentration(self):
        """测试无效的浓度"""
        config = SupplementConfig(
            name="KH提升液",
            param="kh",
            concentration=0.0,
            concentration_unit="meq/mL",
            max_daily_dosage=5.0,
            safety_threshold=1.0,
        )
        
        warnings = config.validate()
        self.assertTrue(any("浓度必须大于0" in w for w in warnings))


class TestCSVReader(unittest.TestCase):
    """测试CSV读取器"""
    
    def setUp(self):
        """设置测试环境"""
        self.reader = CSVReader()
        self.examples_dir = Path(__file__).parent.parent / "examples"
        
        # 创建临时测试文件
        self.temp_files = []
    
    def tearDown(self):
        """清理测试环境"""
        for f in self.temp_files:
            if f.exists():
                f.unlink()
    
    def test_read_tank_params_from_example(self):
        """测试从示例文件读取缸体参数"""
        params_path = self.examples_dir / "tank_params.csv"
        self.assertTrue(params_path.exists(), f"示例文件不存在: {params_path}")
        
        params = self.reader.read_tank_params(str(params_path))
        
        self.assertEqual(params.tank_name, "示例海水缸")
        self.assertEqual(params.total_volume, 200.0)
        self.assertEqual(params.target_kh_min, 7.0)
        self.assertEqual(params.target_kh_max, 9.0)
    
    def test_read_daily_readings_from_example(self):
        """测试从示例文件读取检测数据"""
        readings_path = self.examples_dir / "daily_readings.csv"
        self.assertTrue(readings_path.exists(), f"示例文件不存在: {readings_path}")
        
        readings = self.reader.read_daily_readings(str(readings_path))
        
        self.assertEqual(len(readings), 5)
        self.assertEqual(readings[0].kh, 8.2)
        self.assertEqual(readings[-1].kh, 7.0)
    
    def test_read_supplement_config_from_example(self):
        """测试从示例文件读取补剂配置"""
        supplements_path = self.examples_dir / "supplements.csv"
        self.assertTrue(supplements_path.exists(), f"示例文件不存在: {supplements_path}")
        
        supplements = self.reader.read_supplement_config(str(supplements_path))
        
        self.assertIn('kh', supplements)
        self.assertIn('ca', supplements)
        self.assertIn('mg', supplements)
        
        self.assertEqual(supplements['kh'].name, "KH提升液")
        self.assertEqual(supplements['kh'].concentration, 1.0)


class TestDosingCalculator(unittest.TestCase):
    """测试投加计算器"""
    
    def setUp(self):
        """设置测试环境"""
        self.tank_params = TankParams(
            tank_name="测试缸",
            total_volume=200.0,
            target_kh_min=7.0,
            target_kh_max=9.0,
            target_ca_min=400.0,
            target_ca_max=450.0,
            target_mg_min=1250.0,
            target_mg_max=1350.0,
            target_salinity_min=1.024,
            target_salinity_max=1.026,
        )
        
        # 创建历史检测数据（显示下降趋势）
        base_date = datetime(2024, 5, 1)
        self.readings = [
            DailyReading(
                date=base_date + timedelta(days=i),
                kh=8.2 - i * 0.3,
                ca=430 - i * 5,
                mg=1320 - i * 5,
                salinity=1.025,
                evaporation=5.0,
            )
            for i in range(5)
        ]
    
    def test_calculate_consumption_rates(self):
        """测试消耗速率计算"""
        calculator = DosingCalculator(
            tank_params=self.tank_params,
            historical_readings=self.readings,
        )
        
        # KH 每天下降 0.3
        self.assertAlmostEqual(calculator.consumption_rates['kh'], 0.3, places=1)
        # 钙每天下降 5 ppm
        self.assertAlmostEqual(calculator.consumption_rates['ca'], 5.0, places=1)
        # 镁每天下降 5 ppm
        self.assertAlmostEqual(calculator.consumption_rates['mg'], 5.0, places=1)
    
    def test_calculate_dosing_plan(self):
        """测试投加计划计算"""
        calculator = DosingCalculator(
            tank_params=self.tank_params,
            historical_readings=self.readings,
        )
        
        result = calculator.calculate_dosing_plan(days=7)
        
        self.assertEqual(len(result.future_plans), 7)
        
        # 检查是否有投加计划（因为参数在下降，应该需要投加）
        total_kh = sum(p.kh_dosage or 0 for p in result.future_plans)
        total_ca = sum(p.ca_dosage or 0 for p in result.future_plans)
        
        # 由于参数在下降，应该需要投加
        self.assertGreater(total_kh, 0)
        self.assertGreater(total_ca, 0)
    
    def test_insufficient_data(self):
        """测试数据不足的情况"""
        # 只有1天数据
        short_readings = self.readings[:1]
        
        calculator = DosingCalculator(
            tank_params=self.tank_params,
            historical_readings=short_readings,
        )
        
        warnings = calculator.get_warnings()
        self.assertTrue(any("历史数据不足" in w for w in warnings))


class TestExporter(unittest.TestCase):
    """测试导出器"""
    
    def setUp(self):
        """设置测试环境"""
        self.tank_params = TankParams(
            tank_name="测试缸",
            total_volume=200.0,
            target_kh_min=7.0,
            target_kh_max=9.0,
            target_ca_min=400.0,
            target_ca_max=450.0,
            target_mg_min=1250.0,
            target_mg_max=1350.0,
            target_salinity_min=1.024,
            target_salinity_max=1.026,
        )
        
        base_date = datetime(2024, 5, 1)
        self.readings = [
            DailyReading(
                date=base_date + timedelta(days=i),
                kh=8.2 - i * 0.3,
                ca=430 - i * 5,
                mg=1320 - i * 5,
                salinity=1.025,
                evaporation=5.0,
            )
            for i in range(5)
        ]
        
        # 创建临时目录
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """清理测试环境"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_export_markdown(self):
        """测试Markdown导出"""
        calculator = DosingCalculator(
            tank_params=self.tank_params,
            historical_readings=self.readings,
        )
        
        result = calculator.calculate_dosing_plan(days=7)
        
        output_path = os.path.join(self.temp_dir, "test_output.md")
        content = Exporter.export_markdown(result, output_path)
        
        # 检查文件是否创建
        self.assertTrue(os.path.exists(output_path))
        
        # 检查内容是否包含关键信息
        self.assertIn("海水缸补剂配平维护单", content)
        self.assertIn("测试缸", content)
        self.assertIn("投加计划", content)
    
    def test_export_csv(self):
        """测试CSV导出"""
        calculator = DosingCalculator(
            tank_params=self.tank_params,
            historical_readings=self.readings,
        )
        
        result = calculator.calculate_dosing_plan(days=7)
        
        output_path = os.path.join(self.temp_dir, "test_output.csv")
        Exporter.export_csv(result, output_path)
        
        # 检查文件是否创建
        self.assertTrue(os.path.exists(output_path))
        
        # 读取并验证内容
        with open(output_path, 'r', encoding='utf-8-sig') as f:
            content = f.read()
        
        self.assertIn("测试缸", content)
        self.assertIn("投加计划", content)


class TestIntegration(unittest.TestCase):
    """集成测试"""
    
    def setUp(self):
        """设置测试环境"""
        self.examples_dir = Path(__file__).parent.parent / "examples"
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        """清理测试环境"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_full_workflow(self):
        """测试完整工作流程"""
        # 1. 读取数据
        reader = CSVReader()
        
        params = reader.read_tank_params(str(self.examples_dir / "tank_params.csv"))
        readings = reader.read_daily_readings(str(self.examples_dir / "daily_readings.csv"))
        supplements = reader.read_supplement_config(str(self.examples_dir / "supplements.csv"))
        
        # 验证读取
        self.assertEqual(params.tank_name, "示例海水缸")
        self.assertEqual(len(readings), 5)
        self.assertIn('kh', supplements)
        
        # 2. 计算投加计划
        calculator = DosingCalculator(
            tank_params=params,
            historical_readings=readings,
            supplement_configs=supplements,
        )
        
        result = calculator.calculate_dosing_plan(days=7)
        
        # 验证计算
        self.assertEqual(len(result.future_plans), 7)
        
        # 3. 导出结果
        md_path = os.path.join(self.temp_dir, "maintenance.md")
        csv_path = os.path.join(self.temp_dir, "dosing_plan.csv")
        
        Exporter.export_markdown(result, md_path)
        Exporter.export_csv(result, csv_path)
        
        # 验证导出
        self.assertTrue(os.path.exists(md_path))
        self.assertTrue(os.path.exists(csv_path))


if __name__ == '__main__':
    unittest.main()
