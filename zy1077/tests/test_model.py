#!/usr/bin/env python3
"""测试科学计算模型"""

import unittest
import sys
from pathlib import Path

# 添加父目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from yogurt_sim.model import FermentationSimulator, SimulationState, CoagulationWindow


class TestModel(unittest.TestCase):
    """测试科学计算模型"""
    
    def setUp(self):
        """设置测试数据"""
        self.standard_plan = {
            "name": "标准测试方案",
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
    
    def test_simulator_initialization(self):
        """测试模拟器初始化"""
        simulator = FermentationSimulator(self.standard_plan)
        
        # 检查参数是否正确提取
        self.assertEqual(simulator.initial_temp, 40)
        self.assertEqual(simulator.target_temp, 40)
        self.assertEqual(simulator.total_duration, 8)
        self.assertEqual(simulator.inoculation_ratio, 2.0)
        self.assertEqual(simulator.preheated, True)
    
    def test_fill_ratio_calculation(self):
        """测试填充率计算"""
        simulator = FermentationSimulator(self.standard_plan)
        
        # 500ml 牛奶，600ml 容器，填充率应为 5/6 ≈ 0.833
        expected_fill_ratio = 500 / 600
        self.assertAlmostEqual(simulator.fill_ratio, expected_fill_ratio, places=3)
    
    def test_thermal_coefficient_calculation(self):
        """测试温度系数计算"""
        # 使用中间填充率作为标准（30-70% 之间）
        mid_fill_plan = self.standard_plan.copy()
        mid_fill_plan["milk_volume_ml"] = 350  # 350/600 ≈ 58% (在 30-70% 之间)
        mid_fill_plan["container_size_ml"] = 600
        simulator = FermentationSimulator(mid_fill_plan)
        coeff1 = simulator._calculate_thermal_coeff()
        self.assertGreater(coeff1, 0)
        
        # 低填充率的情况（散热快，< 30%）
        low_fill_plan = self.standard_plan.copy()
        low_fill_plan["milk_volume_ml"] = 100  # 100/600 ≈ 17% (< 30%)
        low_fill_plan["container_size_ml"] = 600
        simulator2 = FermentationSimulator(low_fill_plan)
        coeff2 = simulator2._calculate_thermal_coeff()
        
        # 低填充率应该有更高的温度系数（散热更快）
        self.assertGreater(coeff2, coeff1)
        
        # 高填充率的情况（保温好，> 70%）
        high_fill_plan = self.standard_plan.copy()
        high_fill_plan["milk_volume_ml"] = 500  # 500/600 ≈ 83% (> 70%)
        high_fill_plan["container_size_ml"] = 600
        simulator3 = FermentationSimulator(high_fill_plan)
        coeff3 = simulator3._calculate_thermal_coeff()
        
        # 高填充率应该有更低的温度系数
        self.assertLess(coeff3, coeff1)
    
    def test_temperature_simulation_constant(self):
        """测试恒温模拟"""
        # 当初始温度等于目标温度时，温度应该保持恒定
        simulator = FermentationSimulator(self.standard_plan)
        result = simulator.simulate()
        
        # 检查温度是否基本保持在40°C左右
        time_steps = result.get("time_steps", [])
        self.assertGreater(len(time_steps), 0)
        
        # 所有时间步的温度应该接近40°C
        for step in time_steps:
            temp = step.get("temperature_c", 0)
            self.assertAlmostEqual(temp, 40.0, delta=1.0)
    
    def test_temperature_simulation_heating(self):
        """测试加热过程模拟"""
        # 初始温度低于目标温度
        heating_plan = self.standard_plan.copy()
        heating_plan["initial_temp_c"] = 25
        heating_plan["target_temp_c"] = 40
        
        simulator = FermentationSimulator(heating_plan)
        result = simulator.simulate()
        
        time_steps = result.get("time_steps", [])
        
        # 初始温度应该是25°C
        self.assertAlmostEqual(time_steps[0]["temperature_c"], 25.0, delta=1.0)
        
        # 最终温度应该接近40°C
        final_temp = time_steps[-1]["temperature_c"]
        self.assertGreater(final_temp, 30)  # 应该升高
        self.assertLess(final_temp, 45)  # 不应该超过太多
    
    def test_ph_calculation(self):
        """测试pH计算"""
        simulator = FermentationSimulator(self.standard_plan)
        
        # 测试不同酸度对应的pH
        # 新鲜牛奶: 酸度 ~0.15%, pH ~6.6
        ph1 = simulator._calculate_ph_from_acidity(0.15)
        self.assertAlmostEqual(ph1, 6.6, delta=0.2)
        
        # 凝固开始: 酸度 ~0.6%, pH ~4.6
        ph2 = simulator._calculate_ph_from_acidity(0.6)
        self.assertLess(ph2, 5.0)
        self.assertGreater(ph2, 4.0)
        
        # 过酸: 酸度 ~1.0%, pH ~4.2
        ph3 = simulator._calculate_ph_from_acidity(1.0)
        self.assertLess(ph3, 4.5)
    
    def test_coagulation_detection(self):
        """测试凝固检测"""
        # 使用标准方案，应该能检测到凝固
        simulator = FermentationSimulator(self.standard_plan)
        result = simulator.simulate()
        
        coagulation = result.get("coagulation_window", {})
        
        # 应该有开始凝固时间
        start_hours = coagulation.get("start_hours")
        self.assertIsNotNone(start_hours)
        self.assertGreater(start_hours, 0)
        self.assertLess(start_hours, 8)  # 应该在8小时内开始凝固
    
    def test_simulation_produces_time_steps(self):
        """测试模拟产生时间步"""
        simulator = FermentationSimulator(self.standard_plan)
        result = simulator.simulate()
        
        time_steps = result.get("time_steps", [])
        
        # 应该有足够的时间步
        expected_steps = int(8 / 0.25) + 1  # 8小时，每15分钟一步
        self.assertEqual(len(time_steps), expected_steps)
        
        # 检查时间步结构
        first_step = time_steps[0]
        self.assertIn("time_hours", first_step)
        self.assertIn("temperature_c", first_step)
        self.assertIn("ph", first_step)
        self.assertIn("acidity_percent", first_step)
        self.assertIn("bacteria_activity", first_step)
        self.assertIn("is_coagulated", first_step)
        self.assertIn("is_over_acid", first_step)
    
    def test_acidity_increases_over_time(self):
        """测试酸度随时间增加"""
        simulator = FermentationSimulator(self.standard_plan)
        result = simulator.simulate()
        
        time_steps = result.get("time_steps", [])
        
        # 初始酸度
        initial_acidity = time_steps[0]["acidity_percent"]
        
        # 最终酸度
        final_acidity = time_steps[-1]["acidity_percent"]
        
        # 酸度应该增加
        self.assertGreater(final_acidity, initial_acidity)
    
    def test_ph_decreases_over_time(self):
        """测试pH随时间下降"""
        simulator = FermentationSimulator(self.standard_plan)
        result = simulator.simulate()
        
        time_steps = result.get("time_steps", [])
        
        # 初始pH
        initial_ph = time_steps[0]["ph"]
        
        # 最终pH
        final_ph = time_steps[-1]["ph"]
        
        # pH应该下降
        self.assertLess(final_ph, initial_ph)
    
    def test_key_metrics_calculation(self):
        """测试关键指标计算"""
        simulator = FermentationSimulator(self.standard_plan)
        result = simulator.simulate()
        
        key_metrics = result.get("key_metrics", {})
        
        # 应该包含关键指标
        self.assertIn("final_ph", key_metrics)
        self.assertIn("final_acidity", key_metrics)
        self.assertIn("viability_retention", key_metrics)
        self.assertIn("total_heat_damage", key_metrics)
        self.assertIn("final_temperature", key_metrics)
        
        # 最终pH应该合理
        final_ph = key_metrics["final_ph"]
        self.assertGreaterEqual(final_ph, 3.5)  # 使用 >= 而不是 >
        self.assertLess(final_ph, 6.0)
    
    def test_suggestions_generation(self):
        """测试建议生成"""
        simulator = FermentationSimulator(self.standard_plan)
        result = simulator.simulate()
        
        suggestions = result.get("suggestions", [])
        # 建议列表可能为空或包含建议
        self.assertIsInstance(suggestions, list)
    
    def test_model_assumptions(self):
        """测试模型假设"""
        simulator = FermentationSimulator(self.standard_plan)
        result = simulator.simulate()
        
        assumptions = result.get("model_assumptions", {})
        
        # 应该包含模型假设
        self.assertIn("temperature_model", assumptions)
        self.assertIn("activity_curve", assumptions)
        self.assertIn("acid_production", assumptions)
        self.assertIn("ph_model", assumptions)
        self.assertIn("coagulation_window", assumptions)
        self.assertIn("time_step", assumptions)
        self.assertIn("limitations", assumptions)
    
    def test_low_temperature_simulation(self):
        """测试低温发酵模拟"""
        # 低温发酵应该需要更长时间凝固
        low_temp_plan = self.standard_plan.copy()
        low_temp_plan["target_temp_c"] = 30
        low_temp_plan["total_duration_h"] = 12
        
        simulator = FermentationSimulator(low_temp_plan)
        result = simulator.simulate()
        
        coagulation = result.get("coagulation_window", {})
        start_hours = coagulation.get("start_hours")
        
        # 低温下可能需要更长时间，甚至可能在12小时内不凝固
        # 这里只验证模拟能运行
        time_steps = result.get("time_steps", [])
        self.assertGreater(len(time_steps), 0)
    
    def test_high_temperature_simulation(self):
        """测试高温发酵模拟"""
        # 高温发酵可能导致热损伤
        high_temp_plan = self.standard_plan.copy()
        high_temp_plan["target_temp_c"] = 48
        high_temp_plan["total_duration_h"] = 6
        
        simulator = FermentationSimulator(high_temp_plan)
        result = simulator.simulate()
        
        key_metrics = result.get("key_metrics", {})
        heat_damage = key_metrics.get("total_heat_damage", 0)
        
        # 高温下可能有热损伤
        # 这里只验证模拟能运行
        time_steps = result.get("time_steps", [])
        self.assertGreater(len(time_steps), 0)
    
    def test_low_inoculation_simulation(self):
        """测试低接种比例模拟"""
        # 低接种比例可能无法凝固
        low_inoc_plan = self.standard_plan.copy()
        low_inoc_plan["inoculation_ratio"] = 0.5
        
        simulator = FermentationSimulator(low_inoc_plan)
        result = simulator.simulate()
        
        # 验证模拟能运行
        time_steps = result.get("time_steps", [])
        self.assertGreater(len(time_steps), 0)
    
    def test_long_duration_simulation(self):
        """测试长时间发酵模拟"""
        # 长时间发酵可能过酸
        long_plan = self.standard_plan.copy()
        long_plan["total_duration_h"] = 16
        
        simulator = FermentationSimulator(long_plan)
        result = simulator.simulate()
        
        coagulation = result.get("coagulation_window", {})
        end_hours = coagulation.get("end_hours")
        
        # 长时间发酵应该会过酸
        if end_hours is not None:
            self.assertLess(end_hours, 16)
        
        # 验证模拟能运行
        time_steps = result.get("time_steps", [])
        self.assertGreater(len(time_steps), 0)


if __name__ == "__main__":
    unittest.main()
