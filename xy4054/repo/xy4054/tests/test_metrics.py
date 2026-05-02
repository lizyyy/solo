import unittest
import pandas as pd
import numpy as np
from datetime import date, datetime, timedelta
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from modules.metrics import (
    NutritionCalculator,
    WasteAnalyzer,
    ChronicAnalyzer,
    MetricsEngine,
    calculate_waste_rate,
    calculate_nutrition_deviation,
    detect_persistent_under_serve
)

from models.enums import NutritionType, ChronicDisease


class TestUtilityFunctions(unittest.TestCase):
    
    def test_calculate_waste_rate(self):
        self.assertAlmostEqual(calculate_waste_rate(100, 100, 20), 20.0)
        self.assertAlmostEqual(calculate_waste_rate(100, 90, 18), 20.0)
        self.assertAlmostEqual(calculate_waste_rate(0, 100, 10), 10.0)
        self.assertAlmostEqual(calculate_waste_rate(100, 0, 0), 0.0)
        self.assertAlmostEqual(calculate_waste_rate(0, 0, 0), 0.0)
    
    def test_calculate_nutrition_deviation(self):
        self.assertAlmostEqual(calculate_nutrition_deviation(120, 100), 20.0)
        self.assertAlmostEqual(calculate_nutrition_deviation(80, 100), -20.0)
        self.assertAlmostEqual(calculate_nutrition_deviation(100, 100), 0.0)
        self.assertAlmostEqual(calculate_nutrition_deviation(100, 0), 0.0)
    
    def test_detect_persistent_under_serve(self):
        series_high = pd.Series([0.7, 0.8, 0.6, 0.9, 0.7])
        series_low = pd.Series([0.3, 0.2, 0.4, 0.1, 0.3])
        
        self.assertTrue(detect_persistent_under_serve(series_high, 5, 0.6))
        self.assertFalse(detect_persistent_under_serve(series_low, 5, 0.6))
        self.assertFalse(detect_persistent_under_serve(pd.Series([]), 0))


class TestNutritionCalculator(unittest.TestCase):
    
    def setUp(self):
        self.dish_df = pd.DataFrame([
            {
                'dish_code': 'D0001',
                'dish_name': '白米饭',
                'dish_category': '主食',
                'energy_per_100g': 116,
                'protein_per_100g': 2.6,
                'fat_per_100g': 0.3,
                'carbs_per_100g': 25.6,
                'sodium_per_100g': 2,
                'fiber_per_100g': 0.3
            },
            {
                'dish_code': 'D0002',
                'dish_name': '红烧肉',
                'dish_category': '荤菜',
                'energy_per_100g': 469,
                'protein_per_100g': 17.8,
                'fat_per_100g': 44.2,
                'carbs_per_100g': 2.1,
                'sodium_per_100g': 140,
                'fiber_per_100g': 0.0
            }
        ])
        self.calculator = NutritionCalculator(self.dish_df)
    
    def test_calculate_nutrition_for_weight(self):
        nutrition = self.calculator.calculate_nutrition_for_weight('D0001', 100)
        self.assertAlmostEqual(nutrition['能量'], 116.0)
        self.assertAlmostEqual(nutrition['蛋白质'], 2.6)
        self.assertAlmostEqual(nutrition['脂肪'], 0.3)
        self.assertAlmostEqual(nutrition['碳水化合物'], 25.6)
        self.assertAlmostEqual(nutrition['钠'], 2.0)
        self.assertAlmostEqual(nutrition['膳食纤维'], 0.3)
    
    def test_calculate_nutrition_for_weight_half(self):
        nutrition = self.calculator.calculate_nutrition_for_weight('D0002', 50)
        self.assertAlmostEqual(nutrition['能量'], 234.5)
        self.assertAlmostEqual(nutrition['蛋白质'], 8.9)
        self.assertAlmostEqual(nutrition['脂肪'], 22.1)
    
    def test_calculate_nutrition_unknown_dish(self):
        nutrition = self.calculator.calculate_nutrition_for_weight('D9999', 100)
        self.assertEqual(nutrition['能量'], 0.0)
        self.assertEqual(nutrition['蛋白质'], 0.0)
    
    def test_calculate_meal_nutrition(self):
        servings = pd.DataFrame([
            {
                'dish_code': 'D0001',
                'actual_weight': 150,
                'waste_weight': 0
            },
            {
                'dish_code': 'D0002',
                'actual_weight': 100,
                'waste_weight': 20
            }
        ])
        
        nutrition = self.calculator.calculate_meal_nutrition(servings)
        
        expected_rice = self.calculator.calculate_nutrition_for_weight('D0001', 150)
        expected_pork = self.calculator.calculate_nutrition_for_weight('D0002', 80)
        
        self.assertAlmostEqual(nutrition['能量'], expected_rice['能量'] + expected_pork['能量'])
        self.assertAlmostEqual(nutrition['蛋白质'], expected_rice['蛋白质'] + expected_pork['蛋白质'])


class TestWasteAnalyzer(unittest.TestCase):
    
    def setUp(self):
        self.dish_df = pd.DataFrame([
            {
                'dish_code': 'D0001',
                'dish_name': '白米饭',
                'dish_category': '主食',
                'energy_per_100g': 116,
                'protein_per_100g': 2.6,
                'fat_per_100g': 0.3,
                'carbs_per_100g': 25.6,
                'sodium_per_100g': 2,
                'fiber_per_100g': 0.3
            }
        ])
        self.analyzer = WasteAnalyzer(self.dish_df)
        
        base_date = date(2024, 1, 15)
        
        self.elderly_df = pd.DataFrame([
            {'elderly_id': 'E00001', 'chronic_diseases': '糖尿病'},
            {'elderly_id': 'E00002', 'chronic_diseases': '高血压'},
            {'elderly_id': 'E00003', 'chronic_diseases': ''}
        ])
        
        self.orders = pd.DataFrame([
            {'elderly_id': 'E00001', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'planned_weight': 150},
            {'elderly_id': 'E00002', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'planned_weight': 150},
            {'elderly_id': 'E00003', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'planned_weight': 150},
        ])
        
        self.servings = pd.DataFrame([
            {'elderly_id': 'E00001', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'actual_weight': 100},
            {'elderly_id': 'E00002', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'actual_weight': 140},
            {'elderly_id': 'E00003', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'actual_weight': 150},
        ])
        
        self.wastes = pd.DataFrame([
            {'elderly_id': 'E00001', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'waste_weight': 30},
            {'elderly_id': 'E00002', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'waste_weight': 10},
            {'elderly_id': 'E00003', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'waste_weight': 5},
        ])
    
    def test_analyze_dish_waste(self):
        analysis = self.analyzer.analyze_dish_waste(
            'D0001',
            self.orders,
            self.servings,
            self.wastes,
            self.elderly_df,
            date(2024, 1, 15),
            date(2024, 1, 15)
        )
        
        self.assertEqual(analysis.dish_code, 'D0001')
        self.assertEqual(analysis.dish_name, '白米饭')
        self.assertEqual(analysis.total_servings, 3)
        self.assertEqual(analysis.total_planned, 450)
        self.assertEqual(analysis.total_actual, 390)
        self.assertEqual(analysis.total_waste, 45)
        self.assertGreater(analysis.avg_waste_rate, 0)
        self.assertEqual(analysis.under_serve_count, 1)


class TestChronicAnalyzer(unittest.TestCase):
    
    def setUp(self):
        self.dish_df = pd.DataFrame([
            {
                'dish_code': 'D0001',
                'dish_name': '白米饭',
                'dish_category': '主食',
                'energy_per_100g': 116,
                'protein_per_100g': 2.6,
                'fat_per_100g': 0.3,
                'carbs_per_100g': 25.6,
                'sodium_per_100g': 2,
                'fiber_per_100g': 0.3
            },
            {
                'dish_code': 'D0003',
                'dish_name': '宫保鸡丁',
                'dish_category': '荤菜',
                'energy_per_100g': 226,
                'protein_per_100g': 16.4,
                'fat_per_100g': 16.5,
                'carbs_per_100g': 5.7,
                'sodium_per_100g': 680,
                'fiber_per_100g': 1.0
            }
        ])
        self.nutrition_calc = NutritionCalculator(self.dish_df)
        self.analyzer = ChronicAnalyzer(self.nutrition_calc)
        
        self.elderly_df = pd.DataFrame([
            {'elderly_id': 'E00001', 'chronic_diseases': '高血压'},
            {'elderly_id': 'E00002', 'chronic_diseases': '高血压'},
            {'elderly_id': 'E00003', 'chronic_diseases': '糖尿病'},
            {'elderly_id': 'E00004', 'chronic_diseases': ''}
        ])
        
        base_date = date(2024, 1, 15)
        
        self.servings = pd.DataFrame([
            {'elderly_id': 'E00001', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0003', 'actual_weight': 150},
            {'elderly_id': 'E00002', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0003', 'actual_weight': 120},
            {'elderly_id': 'E00003', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'actual_weight': 200},
            {'elderly_id': 'E00004', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'actual_weight': 150},
        ])
        
        self.wastes = pd.DataFrame([
            {'elderly_id': 'E00001', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0003', 'waste_weight': 20},
        ])
    
    def test_analyze_chronic_group(self):
        analysis = self.analyzer.analyze_chronic_group(
            '高血压',
            self.elderly_df,
            self.servings,
            self.wastes,
            date(2024, 1, 15),
            date(2024, 1, 15)
        )
        
        self.assertEqual(analysis.chronic_type, '高血压')
        self.assertEqual(analysis.total_persons, 2)
        self.assertGreater(analysis.avg_daily_nutrition['钠'], 0)
        self.assertIsInstance(analysis.key_concerns, list)
        self.assertIsInstance(analysis.improvement_suggestions, list)
    
    def test_analyze_normal_group(self):
        analysis = self.analyzer.analyze_chronic_group(
            '普通',
            self.elderly_df,
            self.servings,
            self.wastes,
            date(2024, 1, 15),
            date(2024, 1, 15)
        )
        
        self.assertEqual(analysis.total_persons, 1)


class TestMetricsEngine(unittest.TestCase):
    
    def setUp(self):
        self.dish_df = pd.DataFrame([
            {
                'dish_code': 'D0001',
                'dish_name': '白米饭',
                'dish_category': '主食',
                'energy_per_100g': 116,
                'protein_per_100g': 2.6,
                'fat_per_100g': 0.3,
                'carbs_per_100g': 25.6,
                'sodium_per_100g': 2,
                'fiber_per_100g': 0.3
            }
        ])
        self.elderly_df = pd.DataFrame([
            {'elderly_id': 'E00001', 'chronic_diseases': '普通', 'name': '张大爷', 'age': 75}
        ])
        self.engine = MetricsEngine(self.dish_df, self.elderly_df)
        
        base_date = date(2024, 1, 15)
        
        self.orders = pd.DataFrame([
            {'elderly_id': 'E00001', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'planned_weight': 150}
        ])
        
        self.servings = pd.DataFrame([
            {'elderly_id': 'E00001', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'actual_weight': 140}
        ])
        
        self.wastes = pd.DataFrame([
            {'elderly_id': 'E00001', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'waste_weight': 20}
        ])
    
    def test_generate_daily_summary(self):
        summary = self.engine.generate_daily_summary(
            date(2024, 1, 15),
            '午餐',
            self.orders,
            self.servings,
            self.wastes
        )
        
        self.assertEqual(summary.date, date(2024, 1, 15))
        self.assertEqual(summary.meal_type, '午餐')
        self.assertEqual(summary.total_orders, 1)
        self.assertEqual(summary.total_elderly, 1)
        self.assertGreater(summary.waste_rate, 0)
    
    def test_get_all_waste_analysis(self):
        analyses = self.engine.get_all_waste_analysis(
            self.orders,
            self.servings,
            self.wastes,
            date(2024, 1, 15),
            date(2024, 1, 15)
        )
        
        self.assertEqual(len(analyses), 1)
        self.assertEqual(analyses[0].dish_code, 'D0001')
    
    def test_get_all_chronic_analysis(self):
        analyses = self.engine.get_all_chronic_analysis(
            self.servings,
            self.wastes,
            date(2024, 1, 15),
            date(2024, 1, 15)
        )
        
        self.assertGreater(len(analyses), 0)


if __name__ == '__main__':
    unittest.main()
