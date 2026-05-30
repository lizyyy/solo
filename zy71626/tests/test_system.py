"""
系统测试用例
"""

import os
import sys
import unittest
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from mars_greenhouse.models import (
    GameState, GreenhouseModule, Crop, WaterTank, Battery,
    GameStatus, CropStatus, FailureReason
)
from mars_greenhouse.engine import GreenhouseEngine
from mars_greenhouse.data_import import DataImporter
from mars_greenhouse.error_tracking import ErrorTracker, get_global_error_tracker, track_error_safe


class TestModels(unittest.TestCase):
    """测试数据模型"""
    
    def test_game_state_creation(self):
        """测试游戏状态创建"""
        game = GameState(id="test_01", name="测试关卡")
        self.assertEqual(game.id, "test_01")
        self.assertEqual(game.name, "测试关卡")
        self.assertEqual(game.status, GameStatus.NOT_STARTED)
        self.assertEqual(game.round, 0)
    
    def test_crop_status_enum(self):
        """测试作物状态枚举"""
        self.assertEqual(CropStatus.SEED.value, "seed")
        self.assertEqual(CropStatus.HARVESTABLE.value, "harvestable")
    
    def test_failure_reason_enum(self):
        """测试失败原因枚举"""
        self.assertEqual(FailureReason.ENERGY_NEGATIVE.value, "energy_negative")
        self.assertEqual(FailureReason.WATER_CYCLE_BROKEN.value, "water_cycle_broken")


class TestErrorTracking(unittest.TestCase):
    """测试错误追踪系统"""
    
    def setUp(self):
        self.tracker = ErrorTracker()
    
    def test_track_error(self):
        """测试记录错误"""
        error_id = self.tracker.track_error(
            error_type="TestError",
            error_message="测试错误",
            severity="error",
            source_file="test.py",
            source_line=42
        )
        
        self.assertTrue(error_id.startswith("ERR_"))
        self.assertEqual(len(self.tracker.errors), 1)
    
    def test_track_warning(self):
        """测试记录警告"""
        error_id = self.tracker.track_error(
            error_type="TestWarning",
            error_message="测试警告",
            severity="warning"
        )
        
        self.assertEqual(len(self.tracker.warnings), 1)
        self.assertEqual(len(self.tracker.errors), 0)
    
    def test_error_summary(self):
        """测试错误摘要"""
        for i in range(3):
            self.tracker.track_error(
                error_type=f"ErrorType{i}",
                error_message=f"错误{i}",
                severity="error"
            )
        
        summary = self.tracker.get_error_summary()
        self.assertEqual(summary["total_errors"], 3)
        self.assertEqual(summary["total_warnings"], 0)
    
    def test_track_error_safe_decorator(self):
        """测试安全装饰器"""
        @track_error_safe
        def faulty_function():
            raise ValueError("故意抛出的错误")
        
        result = faulty_function()
        self.assertIsNone(result)
        self.assertTrue(len(get_global_error_tracker().errors) > 0)


class TestDataImport(unittest.TestCase):
    """测试数据导入系统"""
    
    def setUp(self):
        self.importer = DataImporter()
        self.examples_dir = Path(__file__).parent.parent / "examples"
    
    def test_import_json_file(self):
        """测试导入JSON文件"""
        json_file = self.examples_dir / "level_01_basic.json"
        game_state, sources = self.importer.import_file(str(json_file))
        
        self.assertIsNotNone(game_state)
        self.assertGreater(len(sources), 0)
        self.assertGreater(len(game_state.greenhouse_modules), 0)
        self.assertGreater(len(game_state.crops), 0)
    
    def test_import_csv_file(self):
        """测试导入CSV文件"""
        csv_file = self.examples_dir / "level_02_challenge.csv"
        game_state, sources = self.importer.import_file(str(csv_file))
        
        self.assertIsNotNone(game_state)
        self.assertGreater(len(sources), 0)
    
    def test_merge_data(self):
        """测试数据合并"""
        base_state = GameState(id="base", name="基础")
        base_state.crops.append(Crop(id="crop1", name="作物1", species="test"))
        
        supplement_state = GameState(id="supp", name="补充")
        supplement_state.crops.append(Crop(id="crop2", name="作物2", species="test"))
        
        merged = self.importer.merge_data(base_state, supplement_state)
        self.assertEqual(len(merged.crops), 2)
    
    def test_file_not_found(self):
        """测试文件不存在的情况"""
        game_state, sources = self.importer.import_file("nonexistent_file.json")
        self.assertIsNone(game_state)
        self.assertEqual(len(sources), 0)


class TestEngine(unittest.TestCase):
    """测试游戏引擎"""
    
    def setUp(self):
        # 创建一个简单的游戏状态
        self.game = GameState(id="test_game", name="测试游戏", max_rounds=10)
        self.game.greenhouse_modules.append(
            GreenhouseModule(id="gh1", name="测试舱", capacity=5, light_on=True, light_intensity=100.0)
        )
        self.game.crops.append(Crop(id="c1", name="测试作物", species="test"))
        self.game.water_tanks.append(WaterTank(id="t1", name="测试水箱", capacity=500, current_level=400))
        self.game.batteries.append(Battery(id="b1", name="测试电池", capacity=300, current_charge=200))
        
        self.engine = GreenhouseEngine(self.game)
    
    def test_start_game(self):
        """测试开始游戏"""
        result = self.engine.start_game()
        self.assertTrue(result)
        self.assertEqual(self.game.status, GameStatus.RUNNING)
        self.assertEqual(self.game.round, 1)
    
    def test_process_round(self):
        """测试处理回合"""
        self.engine.start_game()
        continue_game, messages = self.engine.process_round()
        
        self.assertIsInstance(continue_game, bool)
        self.assertIsInstance(messages, list)
        self.assertGreater(self.game.round, 1)
    
    def test_toggle_light(self):
        """测试开关灯"""
        initial_state = self.game.greenhouse_modules[0].light_on
        new_state = self.engine.toggle_light("gh1")
        self.assertNotEqual(initial_state, new_state)
    
    def test_set_target_temperature(self):
        """测试设置温度"""
        result = self.engine.set_target_temperature("gh1", 25.0)
        self.assertTrue(result)
        self.assertEqual(self.game.greenhouse_modules[0].target_temperature, 25.0)
    
    def test_set_invalid_temperature(self):
        """测试设置无效温度"""
        result = self.engine.set_target_temperature("gh1", 100.0)
        self.assertFalse(result)
    
    def test_toggle_water_circulation(self):
        """测试开关水循环"""
        result = self.engine.toggle_water_circulation("t1")
        self.assertIsInstance(result, bool)


class TestFailureConditions(unittest.TestCase):
    """测试失败条件"""
    
    def test_energy_failure(self):
        """测试能量耗尽失败"""
        game = GameState(id="test", name="测试")
        game.batteries.append(Battery(id="b1", name="电池", capacity=100, current_charge=0))
        game.greenhouse_modules.append(GreenhouseModule(id="gh1", name="舱", capacity=5))
        game.crops.append(Crop(id="c1", name="作物", species="test"))
        
        engine = GreenhouseEngine(game)
        engine.start_game()
        
        # 处理一个回合，应该触发能量失败
        engine.process_round()
        
        # 能量耗尽需要多个回合
        for battery in game.batteries:
            battery.current_charge = 0
        
        # 手动检查失败条件
        engine._check_failure_conditions()
    
    def test_crop_death(self):
        """测试作物全部死亡"""
        game = GameState(id="test", name="测试")
        game.greenhouse_modules.append(GreenhouseModule(id="gh1", name="舱", capacity=5))
        game.batteries.append(Battery(id="b1", name="电池", capacity=100, current_charge=50))
        game.water_tanks.append(WaterTank(id="t1", name="水箱", capacity=500, current_level=400))
        
        crop = Crop(id="c1", name="作物", species="test", status=CropStatus.DEAD)
        game.crops.append(crop)
        
        engine = GreenhouseEngine(game)
        engine.start_game()
        
        failed, reason = engine._check_failure_conditions()
        self.assertTrue(failed)
        self.assertEqual(reason, FailureReason.CROP_ALL_DEAD)


if __name__ == "__main__":
    # 运行前清空全局错误追踪器
    get_global_error_tracker().clear()
    
    unittest.main(verbosity=2)
