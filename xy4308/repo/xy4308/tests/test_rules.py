"""测试规则引擎"""
import unittest
from datetime import datetime

from freeze_dryer_reviewer.models import (
    BatchData, BatchMetadata, RecipeInfo,
    TemperatureData, VacuumData
)
from freeze_dryer_reviewer.rules import (
    RuleEngine, RuleSeverity,
    VacuumFluctuationRule, TemperatureExceedanceRule,
    PlateauInsufficiencyRule, SensorDriftRule, PrematureHeatingRule
)


class TestVacuumFluctuationRule(unittest.TestCase):
    """测试真空波动规则"""
    
    def setUp(self):
        self.metadata = BatchMetadata(
            batch_id="TEST-001",
            product_name="Test Product",
            equipment_id="FD-001"
        )
    
    def test_vacuum_fluctuation_detection(self):
        """测试真空波动检测"""
        timestamps = [
            datetime(2024, 1, 15, 8, i, 0) for i in range(30)
        ]
        
        values = [75.0] * 10 + [150.0] * 5 + [80.0] * 15
        
        vacuum = VacuumData(
            sensor_name="chamber_vacuum",
            timestamps=timestamps,
            values=values
        )
        
        batch = BatchData(
            metadata=self.metadata,
            vacuum=vacuum
        )
        
        rule = VacuumFluctuationRule(threshold_mtorr=50.0, window_minutes=5.0)
        result = rule.check(batch)
        
        self.assertFalse(result.passed)


class TestTemperatureExceedanceRule(unittest.TestCase):
    """测试温度越界规则"""
    
    def setUp(self):
        self.metadata = BatchMetadata(
            batch_id="TEST-001",
            product_name="Test Product",
            equipment_id="FD-001"
        )
        
        self.recipe = RecipeInfo(
            product_name="Test Product",
            batch_size_ml=500.0,
            vial_count=100,
            fill_volume_ml=5.0,
            collapse_temp_c=-15.0
        )
    
    def test_temperature_exceedance(self):
        """测试温度越界检测"""
        timestamps = [
            datetime(2024, 1, 15, 8, i * 15, 0) for i in range(20)
        ]
        
        values = [-40.0] * 5 + [-30.0] * 5 + [-18.0] * 5 + [-5.0] * 5
        
        product_temp = TemperatureData(
            sensor_name="product_temp",
            timestamps=timestamps,
            values=values
        )
        
        batch = BatchData(
            metadata=self.metadata,
            recipe=self.recipe,
            product_temp=product_temp
        )
        
        rule = TemperatureExceedanceRule()
        result = rule.check(batch)
        
        self.assertFalse(result.passed)


class TestRuleEngine(unittest.TestCase):
    """测试规则引擎"""
    
    def setUp(self):
        self.metadata = BatchMetadata(
            batch_id="TEST-001",
            product_name="Test Product",
            equipment_id="FD-001"
        )
        
        self.recipe = RecipeInfo(
            product_name="Test Product",
            batch_size_ml=500.0,
            vial_count=100,
            fill_volume_ml=5.0,
            collapse_temp_c=-15.0
        )
        
        timestamps = [
            datetime(2024, 1, 15, 8, i * 15, 0) for i in range(30)
        ]
        
        shelf_values = [20.0, 15.0, 10.0, 5.0, 0.0,
                        -5.0, -10.0, -15.0, -20.0, -25.0,
                        -30.0, -35.0, -40.0, -40.0, -40.0,
                        -35.0, -30.0, -25.0, -20.0, -15.0,
                        -10.0, -5.0, 0.0, 5.0, 10.0,
                        15.0, 20.0, 25.0, 25.0]
        
        product_values = [19.5, 14.5, 9.5, 4.5, -0.5,
                         -5.5, -10.5, -15.5, -20.5, -25.5,
                         -30.5, -35.5, -40.5, -40.5, -40.5,
                         -38.0, -34.0, -30.0, -26.0, -22.0,
                         -18.0, -12.0, -5.0, 0.0, 5.0,
                         8.0, 12.0, 15.0, 17.0]
        
        vacuum_values = [760000] * 5 + [500000, 200000, 50000, 10000, 2000,
                                        300, 150, 80, 75, 80,
                                        78, 82, 76, 80, 79,
                                        81, 77, 78, 80, 79,
                                        78, 75, 70, 65, 60, 55]
        
        self.shelf_temp = TemperatureData(
            sensor_name="shelf_temp",
            timestamps=timestamps,
            values=shelf_values
        )
        
        self.product_temp = TemperatureData(
            sensor_name="product_temp",
            timestamps=timestamps,
            values=product_values
        )
        
        self.vacuum = VacuumData(
            sensor_name="chamber_vacuum",
            timestamps=timestamps,
            values=vacuum_values
        )
    
    def test_rule_engine_run_all_checks(self):
        """测试规则引擎运行所有检查"""
        batch = BatchData(
            metadata=self.metadata,
            recipe=self.recipe,
            shelf_temp=self.shelf_temp,
            product_temp=self.product_temp,
            vacuum=self.vacuum
        )
        
        rule_engine = RuleEngine()
        results = rule_engine.run_all_checks(batch)
        
        self.assertGreater(len(results), 0)
        
        summary = rule_engine.generate_summary(results)
        self.assertIn("total_checks", summary)
        self.assertIn("passed", summary)
        self.assertIn("failed", summary)


if __name__ == "__main__":
    unittest.main()
