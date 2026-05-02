import unittest
import pandas as pd
import numpy as np
from datetime import date, datetime
from pathlib import Path
import tempfile
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from modules.data_validator import (
    CSVReader,
    DataValidator,
    ValidationResult,
    validate_elderly_id,
    validate_meal_type,
    validate_weight,
    validate_dish_code,
    validate_date
)


class TestValidationFunctions(unittest.TestCase):
    
    def test_validate_elderly_id_valid(self):
        self.assertTrue(validate_elderly_id("E00001")[0])
        self.assertTrue(validate_elderly_id("E99999")[0])
        self.assertTrue(validate_elderly_id("E01234")[0])
    
    def test_validate_elderly_id_invalid(self):
        self.assertFalse(validate_elderly_id("")[0])
        self.assertFalse(validate_elderly_id("00001")[0])
        self.assertFalse(validate_elderly_id("e00001")[0])
        self.assertFalse(validate_elderly_id("E0001")[0])
        self.assertFalse(validate_elderly_id("E000001")[0])
        self.assertFalse(validate_elderly_id("X00001")[0])
    
    def test_validate_meal_type_valid(self):
        self.assertTrue(validate_meal_type("早餐")[0])
        self.assertTrue(validate_meal_type("午餐")[0])
        self.assertTrue(validate_meal_type("晚餐")[0])
    
    def test_validate_meal_type_invalid(self):
        self.assertFalse(validate_meal_type("")[0])
        self.assertFalse(validate_meal_type("早茶")[0])
        self.assertFalse(validate_meal_type("宵夜")[0])
        self.assertFalse(validate_meal_type("morning")[0])
    
    def test_validate_weight_valid(self):
        self.assertTrue(validate_weight(0)[0])
        self.assertTrue(validate_weight(100)[0])
        self.assertTrue(validate_weight(500)[0])
        self.assertTrue(validate_weight(5000)[0])
        self.assertTrue(validate_weight(0.5)[0])
    
    def test_validate_weight_invalid(self):
        self.assertFalse(validate_weight(-1)[0])
        self.assertFalse(validate_weight(-100)[0])
        self.assertFalse(validate_weight(5001)[0])
        self.assertFalse(validate_weight(10000)[0])
        self.assertFalse(validate_weight(None)[0])
        self.assertFalse(validate_weight("abc")[0])
        self.assertFalse(validate_weight(np.nan)[0])
    
    def test_validate_dish_code_valid(self):
        self.assertTrue(validate_dish_code("D0001")[0])
        self.assertTrue(validate_dish_code("D9999")[0])
        self.assertTrue(validate_dish_code("D1234")[0])
    
    def test_validate_dish_code_invalid(self):
        self.assertFalse(validate_dish_code("")[0])
        self.assertFalse(validate_dish_code("0001")[0])
        self.assertFalse(validate_dish_code("d0001")[0])
        self.assertFalse(validate_dish_code("D001")[0])
        self.assertFalse(validate_dish_code("D00001")[0])
        self.assertFalse(validate_dish_code("X0001")[0])
    
    def test_validate_date_valid(self):
        self.assertTrue(validate_date(date(2024, 1, 15))[0])
        self.assertTrue(validate_date("2024-01-15")[0])
        self.assertTrue(validate_date("2024-12-31")[0])
    
    def test_validate_date_invalid(self):
        self.assertFalse(validate_date(None)[0])
        self.assertFalse(validate_date("")[0])
        self.assertFalse(validate_date("2024/01/15")[0])
        self.assertFalse(validate_date("01-15-2024")[0])
        self.assertFalse(validate_date("abc")[0])
        self.assertFalse(validate_date(np.nan)[0])


class TestValidationResult(unittest.TestCase):
    
    def test_validation_result_defaults(self):
        result = ValidationResult()
        self.assertTrue(result.is_valid)
        self.assertEqual(result.total_errors, 0)
        self.assertEqual(result.total_warnings, 0)
        self.assertEqual(result.error_rate, 0.0)
    
    def test_validation_result_with_data(self):
        valid_df = pd.DataFrame({'col1': [1, 2, 3]})
        invalid_df = pd.DataFrame({'col1': [4, 5]})
        
        result = ValidationResult(
            is_valid=False,
            valid_rows=valid_df,
            invalid_rows=invalid_df,
            errors=[],
            warnings=[]
        )
        
        self.assertFalse(result.is_valid)
        self.assertEqual(len(result.valid_rows), 3)
        self.assertEqual(len(result.invalid_rows), 2)
        self.assertAlmostEqual(result.error_rate, 40.0)


class TestCSVReader(unittest.TestCase):
    
    def setUp(self):
        self.reader = CSVReader()
    
    def test_required_columns_definition(self):
        self.assertIn('elderly_id', CSVReader.REQUIRED_COLUMNS['elderly'])
        self.assertIn('chronic_diseases', CSVReader.REQUIRED_COLUMNS['elderly'])
        self.assertIn('dish_code', CSVReader.REQUIRED_COLUMNS['dish'])
        self.assertIn('dish_name', CSVReader.REQUIRED_COLUMNS['dish'])
        self.assertIn('dish_category', CSVReader.REQUIRED_COLUMNS['dish'])
        self.assertIn('elderly_id', CSVReader.REQUIRED_COLUMNS['order'])
        self.assertIn('date', CSVReader.REQUIRED_COLUMNS['order'])
        self.assertIn('meal_type', CSVReader.REQUIRED_COLUMNS['order'])
        self.assertIn('dish_code', CSVReader.REQUIRED_COLUMNS['order'])
        self.assertIn('planned_weight', CSVReader.REQUIRED_COLUMNS['order'])
    
    def test_column_mappings(self):
        self.assertEqual(CSVReader.COLUMN_MAPPINGS['老人编号'], 'elderly_id')
        self.assertEqual(CSVReader.COLUMN_MAPPINGS['日期'], 'date')
        self.assertEqual(CSVReader.COLUMN_MAPPINGS['餐次'], 'meal_type')
        self.assertEqual(CSVReader.COLUMN_MAPPINGS['菜品编码'], 'dish_code')
        self.assertEqual(CSVReader.COLUMN_MAPPINGS['慢病标签'], 'chronic_diseases')
    
    def test_parse_date_column(self):
        df = pd.DataFrame({
            'date': ['2024-01-15', '2024-01-16', '2024-01-17']
        })
        result = self.reader.parse_date_column(df)
        self.assertEqual(result['date'].iloc[0], date(2024, 1, 15))
    
    def test_parse_numeric_column(self):
        df = pd.DataFrame({
            'weight': ['100', '200', '300', 'abc']
        })
        result = self.reader.parse_numeric_column(df, 'weight')
        self.assertEqual(result['weight'].iloc[0], 100.0)
        self.assertTrue(pd.isna(result['weight'].iloc[3]))


class TestDataValidator(unittest.TestCase):
    
    def setUp(self):
        self.validator = DataValidator()
    
    def test_set_reference_data(self):
        elderly_df = pd.DataFrame({
            'elderly_id': ['E00001', 'E00002', 'E00003']
        })
        dish_df = pd.DataFrame({
            'dish_code': ['D0001', 'D0002', 'D0003']
        })
        
        self.validator.set_reference_data(elderly_df, dish_df)
        
        self.assertEqual(self.validator.known_elderly_ids, {'E00001', 'E00002', 'E00003'})
        self.assertEqual(self.validator.known_dish_codes, {'D0001', 'D0002', 'D0003'})
    
    def test_validate_order_data_valid(self):
        df = pd.DataFrame({
            'elderly_id': ['E00001', 'E00002'],
            'date': [date(2024, 1, 15), date(2024, 1, 15)],
            'meal_type': ['午餐', '午餐'],
            'dish_code': ['D0001', 'D0002'],
            'planned_weight': [150, 100]
        })
        
        result = self.validator.validate_order_data(df)
        self.assertTrue(result.is_valid)
        self.assertEqual(len(result.valid_rows), 2)
        self.assertEqual(len(result.invalid_rows), 0)
        self.assertEqual(result.total_errors, 0)
    
    def test_validate_order_data_invalid(self):
        df = pd.DataFrame({
            'elderly_id': ['E00001', 'invalid'],
            'date': [date(2024, 1, 15), 'invalid-date'],
            'meal_type': ['午餐', '无效'],
            'dish_code': ['D0001', 'invalid'],
            'planned_weight': [150, -100]
        })
        
        result = self.validator.validate_order_data(df)
        self.assertFalse(result.is_valid)
        self.assertEqual(len(result.invalid_rows), 1)
        self.assertGreater(result.total_errors, 0)
    
    def test_validate_serving_data(self):
        df = pd.DataFrame({
            'elderly_id': ['E00001'],
            'date': [date(2024, 1, 15)],
            'meal_type': ['午餐'],
            'dish_code': ['D0001'],
            'actual_weight': [140]
        })
        
        result = self.validator.validate_serving_data(df)
        self.assertTrue(result.is_valid)
    
    def test_validate_waste_data(self):
        df = pd.DataFrame({
            'elderly_id': ['E00001'],
            'date': [date(2024, 1, 15)],
            'meal_type': ['午餐'],
            'dish_code': ['D0001'],
            'waste_weight': [20]
        })
        
        result = self.validator.validate_waste_data(df)
        self.assertTrue(result.is_valid)
    
    def test_validate_elderly_data(self):
        df = pd.DataFrame({
            'elderly_id': ['E00001', 'E00002'],
            'chronic_diseases': ['糖尿病', '高血压']
        })
        
        result = self.validator.validate_elderly_data(df)
        self.assertTrue(result.is_valid)
        self.assertEqual(len(result.valid_rows), 2)
    
    def test_validate_dish_data(self):
        df = pd.DataFrame({
            'dish_code': ['D0001', 'D0002'],
            'dish_name': ['白米饭', '红烧肉'],
            'dish_category': ['主食', '荤菜']
        })
        
        result = self.validator.validate_dish_data(df)
        self.assertTrue(result.is_valid)
        self.assertEqual(len(result.valid_rows), 2)
    
    def test_cross_reference_validation(self):
        orders = pd.DataFrame({
            'elderly_id': ['E00001', 'E00002'],
            'date': [date(2024, 1, 15), date(2024, 1, 15)],
            'meal_type': ['午餐', '午餐'],
            'dish_code': ['D0001', 'D0002']
        })
        
        servings = pd.DataFrame({
            'elderly_id': ['E00001'],
            'date': [date(2024, 1, 15)],
            'meal_type': ['午餐'],
            'dish_code': ['D0001']
        })
        
        wastes = pd.DataFrame()
        
        errors = self.validator.validate_cross_reference(orders, servings, wastes)
        self.assertGreater(len(errors), 0)


if __name__ == '__main__':
    unittest.main()
