import unittest
import pandas as pd
import numpy as np
from datetime import date, datetime, timedelta
from pathlib import Path
import tempfile
import shutil
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from modules.sample_data import (
    SampleDataGenerator,
    generate_sample_elderly,
    generate_sample_dishes,
    generate_sample_orders,
    generate_sample_servings,
    generate_sample_wastes,
    create_all_sample_data,
    save_sample_data_to_csv
)

from modules.data_validator import DataValidator


class TestSampleDataGenerator(unittest.TestCase):
    
    def setUp(self):
        self.generator = SampleDataGenerator()
    
    def test_init_defaults(self):
        self.assertEqual(self.generator.num_elderly, 50)
        self.assertEqual(self.generator.num_dishes, 30)
        self.assertEqual(self.generator.date_range, 7)
    
    def test_init_custom(self):
        custom_config = {
            'num_elderly': 100,
            'num_dishes': 20,
            'date_range': 14
        }
        generator = SampleDataGenerator(custom_config)
        
        self.assertEqual(generator.num_elderly, 100)
        self.assertEqual(generator.num_dishes, 20)
        self.assertEqual(generator.date_range, 14)
    
    def test_generate_elderly_info(self):
        df = self.generator.generate_elderly_info()
        
        self.assertEqual(len(df), 50)
        
        expected_columns = ['elderly_id', 'name', 'age', 'gender', 'bed_number', 
                           'chronic_diseases', 'dietary_restrictions']
        for col in expected_columns:
            self.assertIn(col, df.columns)
        
        for _, row in df.iterrows():
            self.assertTrue(row['elderly_id'].startswith('E'))
            self.assertEqual(len(row['elderly_id']), 6)
            self.assertGreaterEqual(row['age'], 65)
            self.assertLessEqual(row['age'], 92)
            self.assertIn(row['gender'], ['男', '女'])
    
    def test_elderly_chronic_distribution(self):
        df = self.generator.generate_elderly_info()
        
        chronic_counts = df['chronic_diseases'].value_counts()
        
        normal_count = sum(df['chronic_diseases'] == '')
        self.assertGreater(normal_count, 0)
        
        for _, row in df.iterrows():
            if row['chronic_diseases']:
                self.assertIsInstance(row['dietary_restrictions'], str)
    
    def test_generate_dish_info(self):
        df = self.generator.generate_dish_info()
        
        self.assertEqual(len(df), 30)
        
        expected_columns = ['dish_code', 'dish_name', 'dish_category',
                           'energy_per_100g', 'protein_per_100g', 'fat_per_100g',
                           'carbs_per_100g', 'sodium_per_100g', 'fiber_per_100g',
                           'dietary_tags', 'description']
        for col in expected_columns:
            self.assertIn(col, df.columns)
        
        categories = df['dish_category'].unique()
        expected_categories = ['主食', '荤菜', '素菜', '汤', '点心']
        for cat in categories:
            self.assertIn(cat, expected_categories)
        
        for _, row in df.iterrows():
            self.assertTrue(row['dish_code'].startswith('D'))
            self.assertEqual(len(row['dish_code']), 5)
            self.assertGreaterEqual(row['energy_per_100g'], 0)
            self.assertGreaterEqual(row['protein_per_100g'], 0)
            self.assertGreaterEqual(row['fat_per_100g'], 0)
            self.assertGreaterEqual(row['carbs_per_100g'], 0)
            self.assertGreaterEqual(row['sodium_per_100g'], 0)
    
    def test_generate_daily_menu(self):
        base_date = date(2024, 1, 15)
        menu = self.generator.generate_daily_menu(base_date)
        
        self.assertEqual(len(menu), 3)
        self.assertIn('早餐', menu)
        self.assertIn('午餐', menu)
        self.assertIn('晚餐', menu)
        
        for meal_type, dishes in menu.items():
            self.assertGreater(len(dishes), 0)
            for dish_code in dishes:
                self.assertTrue(dish_code.startswith('D'))
                self.assertEqual(len(dish_code), 5)
    
    def test_generate_orders(self):
        elderly_df = self.generator.generate_elderly_info()
        dish_df = self.generator.generate_dish_info()
        
        start_date = date(2024, 1, 15)
        end_date = date(2024, 1, 15)
        
        orders = self.generator.generate_orders(elderly_df, dish_df, start_date, end_date)
        
        self.assertGreater(len(orders), 0)
        
        expected_columns = ['order_id', 'elderly_id', 'date', 'meal_type', 
                           'dish_code', 'planned_weight', 'order_status', 'notes']
        for col in expected_columns:
            self.assertIn(col, orders.columns)
        
        for _, row in orders.iterrows():
            self.assertIn(row['meal_type'], ['早餐', '午餐', '晚餐'])
            self.assertGreater(row['planned_weight'], 0)
            self.assertIn(row['elderly_id'], elderly_df['elderly_id'].values)
            self.assertIn(row['dish_code'], dish_df['dish_code'].values)
    
    def test_generate_servings(self):
        elderly_df = self.generator.generate_elderly_info()
        dish_df = self.generator.generate_dish_info()
        
        start_date = date(2024, 1, 15)
        end_date = date(2024, 1, 15)
        
        orders = self.generator.generate_orders(elderly_df, dish_df, start_date, end_date)
        servings = self.generator.generate_servings(orders, elderly_df)
        
        self.assertEqual(len(servings), len(orders))
        
        expected_columns = ['serving_id', 'elderly_id', 'date', 'meal_type',
                           'dish_code', 'actual_weight', 'serving_time', 
                           'operator', 'is_manual', 'correction_reason', 'notes']
        for col in expected_columns:
            self.assertIn(col, servings.columns)
        
        for _, row in servings.iterrows():
            self.assertGreaterEqual(row['actual_weight'], 0)
            self.assertFalse(row['is_manual'])
        
        chronic_elderly = elderly_df[elderly_df['chronic_diseases'] != '']['elderly_id'].tolist()
        if chronic_elderly:
            chronic_servings = servings[servings['elderly_id'].isin(chronic_elderly)]
            normal_servings = servings[~servings['elderly_id'].isin(chronic_elderly)]
            
            self.assertIsInstance(chronic_servings, pd.DataFrame)
    
    def test_generate_wastes(self):
        elderly_df = self.generator.generate_elderly_info()
        dish_df = self.generator.generate_dish_info()
        
        start_date = date(2024, 1, 15)
        end_date = date(2024, 1, 15)
        
        orders = self.generator.generate_orders(elderly_df, dish_df, start_date, end_date)
        servings = self.generator.generate_servings(orders, elderly_df)
        wastes = self.generator.generate_wastes(servings, elderly_df, dish_df)
        
        self.assertGreaterEqual(len(wastes), 0)
        
        if len(wastes) > 0:
            expected_columns = ['waste_id', 'elderly_id', 'date', 'meal_type',
                               'dish_code', 'waste_weight', 'collection_time',
                               'collector', 'waste_reason', 'notes']
            for col in expected_columns:
                self.assertIn(col, wastes.columns)
            
            for _, row in wastes.iterrows():
                self.assertGreater(row['waste_weight'], 0)
                self.assertIsInstance(row['waste_reason'], str)


class TestConvenienceFunctions(unittest.TestCase):
    
    def test_generate_sample_elderly(self):
        df = generate_sample_elderly(10)
        self.assertEqual(len(df), 10)
        
        df_default = generate_sample_elderly()
        self.assertEqual(len(df_default), 50)
    
    def test_generate_sample_dishes(self):
        df = generate_sample_dishes(10)
        self.assertEqual(len(df), 10)
        
        df_default = generate_sample_dishes()
        self.assertEqual(len(df_default), 30)
    
    def test_create_all_sample_data(self):
        data = create_all_sample_data()
        
        self.assertIn('elderly', data)
        self.assertIn('dish', data)
        self.assertIn('orders', data)
        self.assertIn('servings', data)
        self.assertIn('wastes', data)
        
        self.assertEqual(len(data['elderly']), 50)
        self.assertEqual(len(data['dish']), 30)
        self.assertGreater(len(data['orders']), 0)
        self.assertGreater(len(data['servings']), 0)
    
    def test_create_all_sample_data_custom(self):
        start_date = date(2024, 2, 1)
        end_date = date(2024, 2, 3)
        
        data = create_all_sample_data(
            start_date=start_date,
            end_date=end_date,
            num_elderly=20,
            num_dishes=15
        )
        
        self.assertEqual(len(data['elderly']), 20)
        self.assertEqual(len(data['dish']), 15)
        
        dates = data['orders']['date'].unique()
        self.assertEqual(len(dates), 3)


class TestSampleDataValidation(unittest.TestCase):
    
    def test_sample_data_passes_validation(self):
        data = create_all_sample_data(num_elderly=10, num_dishes=10)
        
        validator = DataValidator()
        validator.set_reference_data(data['elderly'], data['dish'])
        
        elderly_result = validator.validate_elderly_data(data['elderly'])
        self.assertTrue(elderly_result.is_valid)
        self.assertEqual(elderly_result.total_errors, 0)
        
        dish_result = validator.validate_dish_data(data['dish'])
        self.assertTrue(dish_result.is_valid)
        self.assertEqual(dish_result.total_errors, 0)
        
        orders_result = validator.validate_order_data(data['orders'])
        self.assertTrue(orders_result.is_valid)
        
        servings_result = validator.validate_serving_data(data['servings'])
        self.assertTrue(servings_result.is_valid)
        
        if not data['wastes'].empty:
            wastes_result = validator.validate_waste_data(data['wastes'])
            self.assertTrue(wastes_result.is_valid)
    
    def test_sample_data_structure(self):
        data = create_all_sample_data()
        
        for elderly_id in data['orders']['elderly_id'].unique():
            self.assertIn(elderly_id, data['elderly']['elderly_id'].values)
        
        for dish_code in data['orders']['dish_code'].unique():
            self.assertIn(dish_code, data['dish']['dish_code'].values)
        
        self.assertEqual(len(data['orders']), len(data['servings']))


class TestSaveSampleData(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_save_sample_data_to_csv(self):
        data = create_all_sample_data(num_elderly=5, num_dishes=5)
        
        output_path = Path(self.temp_dir) / 'sample_data'
        save_sample_data_to_csv(data, output_path)
        
        expected_files = [
            'sample_elderly.csv',
            'sample_dish.csv',
            'sample_orders.csv',
            'sample_servings.csv',
            'sample_wastes.csv'
        ]
        
        for filename in expected_files:
            file_path = output_path / filename
            self.assertTrue(file_path.exists(), f"File {filename} should exist")
        
        elderly_df = pd.read_csv(output_path / 'sample_elderly.csv')
        self.assertEqual(len(elderly_df), 5)
        
        dish_df = pd.read_csv(output_path / 'sample_dish.csv')
        self.assertEqual(len(dish_df), 5)


class TestIntegrationWithMetrics(unittest.TestCase):
    
    def test_sample_data_works_with_metrics(self):
        from modules.metrics import MetricsEngine, calculate_waste_rate
        
        data = create_all_sample_data(num_elderly=20, num_dishes=15)
        
        engine = MetricsEngine(data['dish'], data['elderly'])
        
        start_date = data['orders']['date'].min()
        end_date = data['orders']['date'].max()
        
        waste_analyses = engine.get_all_waste_analysis(
            data['orders'], data['servings'], data['wastes'],
            start_date, end_date
        )
        
        self.assertGreater(len(waste_analyses), 0)
        
        for analysis in waste_analyses:
            self.assertIsInstance(analysis.dish_code, str)
            self.assertIsInstance(analysis.avg_waste_rate, float)
            self.assertGreaterEqual(analysis.avg_waste_rate, 0)
            self.assertLessEqual(analysis.avg_waste_rate, 100)
        
        chronic_analyses = engine.get_all_chronic_analysis(
            data['servings'], data['wastes'], start_date, end_date
        )
        
        self.assertGreater(len(chronic_analyses), 0)
        
        for analysis in chronic_analyses:
            self.assertIsInstance(analysis.chronic_type, str)
            self.assertIsInstance(analysis.avg_daily_nutrition, dict)
            self.assertIsInstance(analysis.key_concerns, list)
            self.assertIsInstance(analysis.improvement_suggestions, list)


if __name__ == '__main__':
    unittest.main()
