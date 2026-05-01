import unittest
import pandas as pd
import numpy as np
from datetime import date, datetime, timedelta
from pathlib import Path
import tempfile
import shutil
import sys
import json

sys.path.insert(0, str(Path(__file__).parent.parent))

from modules.persistence import (
    DataManager,
    VersionManager,
    SessionState,
    save_session,
    load_session,
    export_to_csv,
    export_to_markdown
)


class TestSessionState(unittest.TestCase):
    
    def test_session_state_defaults(self):
        session = SessionState()
        
        self.assertIsNotNone(session.session_id)
        self.assertEqual(len(session.session_id), 8)
        self.assertIsNotNone(session.created_at)
        self.assertIsNotNone(session.updated_at)
        self.assertIsInstance(session.validation_errors, list)
        self.assertIsInstance(session.validation_warnings, list)
        self.assertIsInstance(session.analysis_filters, dict)
        self.assertIsInstance(session.manual_corrections, pd.DataFrame)
    
    def test_session_state_with_params(self):
        session = SessionState(
            session_id='test0001',
            created_at=datetime(2024, 1, 15, 10, 0, 0),
            updated_at=datetime(2024, 1, 15, 11, 0, 0)
        )
        
        self.assertEqual(session.session_id, 'test0001')
        self.assertEqual(session.created_at, datetime(2024, 1, 15, 10, 0, 0))
        self.assertEqual(session.updated_at, datetime(2024, 1, 15, 11, 0, 0))
    
    def test_session_state_to_dict(self):
        session = SessionState(session_id='test0001')
        
        session.elderly_df = pd.DataFrame({'col1': [1, 2, 3]})
        session.dish_df = pd.DataFrame({'col1': [1, 2]})
        
        result = session.to_dict()
        
        self.assertEqual(result['session_id'], 'test0001')
        self.assertTrue(result['has_elderly'])
        self.assertTrue(result['has_dish'])
        self.assertFalse(result['has_orders'])
        self.assertEqual(result['validation_errors_count'], 0)
    
    def test_get_date_range(self):
        session = SessionState()
        
        session.orders_df = pd.DataFrame({
            'date': [date(2024, 1, 15), date(2024, 1, 16), date(2024, 1, 17)]
        })
        session.servings_df = pd.DataFrame({
            'date': [date(2024, 1, 14), date(2024, 1, 18)]
        })
        
        min_date, max_date = session.get_date_range()
        
        self.assertEqual(min_date, date(2024, 1, 14))
        self.assertEqual(max_date, date(2024, 1, 18))
    
    def test_get_date_range_empty(self):
        session = SessionState()
        
        result = session.get_date_range()
        
        self.assertEqual(result, (None, None))


class TestVersionManager(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.manager = VersionManager(Path(self.temp_dir))
        self.session = SessionState(session_id='test0001')
    
    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_save_version(self):
        df = pd.DataFrame({
            'elderly_id': ['E00001', 'E00002'],
            'name': ['张大爷', '李大妈']
        })
        
        version_id = self.manager.save_version(self.session, 'elderly', df)
        
        self.assertIsNotNone(version_id)
        self.assertTrue(version_id.startswith('elderly_'))
        
        archive_dir = Path(self.temp_dir) / 'data' / 'archive' / 'test0001'
        self.assertTrue(archive_dir.exists())
    
    def test_list_versions_empty(self):
        versions = self.manager.list_versions('nonexistent')
        self.assertEqual(versions, [])
    
    def test_list_versions(self):
        df = pd.DataFrame({'col1': [1, 2, 3]})
        
        self.manager.save_version(self.session, 'elderly', df)
        self.manager.save_version(self.session, 'dish', df)
        
        versions = self.manager.list_versions('test0001')
        self.assertEqual(len(versions), 2)
        
        elderly_versions = self.manager.list_versions('test0001', 'elderly')
        self.assertEqual(len(elderly_versions), 1)


class TestDataManager(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.manager = DataManager(Path(self.temp_dir))
    
    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_create_new_session(self):
        session = self.manager.create_new_session()
        
        self.assertIsNotNone(session)
        self.assertIsNotNone(session.session_id)
        self.assertEqual(self.manager.active_session, session)
    
    def test_save_and_load_session(self):
        session = self.manager.create_new_session()
        
        session.elderly_df = pd.DataFrame({
            'elderly_id': ['E00001', 'E00002'],
            'chronic_diseases': ['糖尿病', '高血压']
        })
        
        session.dish_df = pd.DataFrame({
            'dish_code': ['D0001', 'D0002'],
            'dish_name': ['白米饭', '红烧肉'],
            'dish_category': ['主食', '荤菜'],
            'energy_per_100g': [116, 469],
            'protein_per_100g': [2.6, 17.8],
            'fat_per_100g': [0.3, 44.2],
            'carbs_per_100g': [25.6, 2.1],
            'sodium_per_100g': [2, 140],
            'fiber_per_100g': [0.3, 0.0]
        })
        
        session.orders_df = pd.DataFrame({
            'elderly_id': ['E00001'],
            'date': [date(2024, 1, 15)],
            'meal_type': ['午餐'],
            'dish_code': ['D0001'],
            'planned_weight': [150]
        })
        
        session.servings_df = pd.DataFrame({
            'elderly_id': ['E00001'],
            'date': [date(2024, 1, 15)],
            'meal_type': ['午餐'],
            'dish_code': ['D0001'],
            'actual_weight': [140]
        })
        
        self.manager.save_session(session)
        
        session_id = session.session_id
        loaded = self.manager.load_session(session_id)
        
        self.assertIsNotNone(loaded)
        self.assertEqual(loaded.session_id, session_id)
        self.assertEqual(len(loaded.elderly_df), 2)
        self.assertEqual(len(loaded.dish_df), 2)
        self.assertEqual(len(loaded.orders_df), 1)
        self.assertEqual(len(loaded.servings_df), 1)
    
    def test_list_sessions_empty(self):
        sessions = self.manager.list_sessions()
        self.assertEqual(sessions, [])
    
    def test_list_sessions(self):
        session1 = self.manager.create_new_session()
        self.manager.save_session(session1)
        
        session2 = self.manager.create_new_session()
        self.manager.save_session(session2)
        
        sessions = self.manager.list_sessions()
        self.assertEqual(len(sessions), 2)
    
    def test_apply_manual_correction(self):
        session = self.manager.create_new_session()
        
        session.servings_df = pd.DataFrame([{
            'elderly_id': 'E00001',
            'date': date(2024, 1, 15),
            'meal_type': '午餐',
            'dish_code': 'D0001',
            'actual_weight': 100,
            'is_manual': False,
            'correction_reason': ''
        }])
        
        correction = {
            'data_type': 'serving',
            'elderly_id': 'E00001',
            'date': date(2024, 1, 15),
            'meal_type': '午餐',
            'dish_code': 'D0001',
            'original_value': 100,
            'new_value': 140,
            'reason': '称重记录错误',
            'operator': '营养师'
        }
        
        result = self.manager.apply_manual_correction(correction)
        
        self.assertTrue(result)
        self.assertIsNotNone(session.manual_corrections)
        self.assertEqual(len(session.manual_corrections), 1)
        
        updated_row = session.servings_df.iloc[0]
        self.assertEqual(updated_row['actual_weight'], 140)
        self.assertTrue(updated_row['is_manual'])
        self.assertEqual(updated_row['correction_reason'], '称重记录错误')


class TestExportFunctions(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_export_to_csv(self):
        df = pd.DataFrame({
            'elderly_id': ['E00001', 'E00002', 'E00003'],
            'name': ['张大爷', '李大妈', '王阿姨'],
            'age': [75, 80, 78]
        })
        
        file_path = Path(self.temp_dir) / 'test_export.csv'
        result = export_to_csv(df, file_path)
        
        self.assertTrue(result)
        self.assertTrue(file_path.exists())
        
        loaded = pd.read_csv(file_path)
        self.assertEqual(len(loaded), 3)
        self.assertListEqual(list(loaded.columns), ['elderly_id', 'name', 'age'])
    
    def test_export_to_markdown(self):
        report_data = {
            'start_date': date(2024, 1, 15),
            'end_date': date(2024, 1, 21),
            'data_source': '配餐偏差复盘台',
            'overall_stats': {
                '分析天数': 7,
                '老人数': 50,
                '订单数': 1050,
                '浪费率(%)': 12.5
            },
            'nutrition_overview': [
                {'营养项': '能量', '实际摄入': '1650 kcal', '参考值': '1800 kcal', '偏差%': '-8.3%'},
                {'营养项': '蛋白质', '实际摄入': '55 g', '参考值': '60 g', '偏差%': '-8.3%'}
            ],
            'waste_ranking': [
                {'菜品名称': '炒青菜', '分类': '素菜', '浪费率%': 25.5, '少打次数': 5},
                {'菜品名称': '红烧肉', '分类': '荤菜', '浪费率%': 15.2, '少打次数': 2}
            ],
            'under_served': [
                {'菜品名称': '清蒸鲈鱼', '分类': '荤菜', '少打率%': 65.0, '是否长期少打': '是'}
            ],
            'chronic_nutrition': [
                {'慢病类型': '高血压', '人数': 15, '钠摄入': '2500mg', '蛋白质': '58g', '关键问题': '钠摄入超标'},
                {'慢病类型': '糖尿病', '人数': 10, '钠摄入': '1800mg', '蛋白质': '55g', '关键问题': '碳水摄入偏高'}
            ],
            'nutrition_alerts': [],
            'recommendations': [
                '建议减少炒青菜的供应量',
                '高血压患者应选择低钠菜品',
                '糖尿病患者需控制主食量'
            ]
        }
        
        file_path = Path(self.temp_dir) / 'test_report.md'
        result = export_to_markdown(report_data, file_path)
        
        self.assertTrue(result)
        self.assertTrue(file_path.exists())
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        self.assertIn('配餐偏差复盘报告', content)
        self.assertIn('2024-01-15', content)
        self.assertIn('2024-01-21', content)
        self.assertIn('炒青菜', content)
        self.assertIn('高血压', content)
        self.assertIn('建议减少炒青菜的供应量', content)


class TestPersistenceIntegration(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.manager = DataManager(Path(self.temp_dir))
    
    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_full_workflow(self):
        session = self.manager.create_new_session()
        
        session.elderly_df = pd.DataFrame([
            {'elderly_id': 'E00001', 'chronic_diseases': '高血压', 'name': '张大爷', 'age': 75},
            {'elderly_id': 'E00002', 'chronic_diseases': '糖尿病', 'name': '李大妈', 'age': 80},
            {'elderly_id': 'E00003', 'chronic_diseases': '', 'name': '王阿姨', 'age': 72}
        ])
        
        session.dish_df = pd.DataFrame([
            {
                'dish_code': 'D0001', 'dish_name': '白米饭', 'dish_category': '主食',
                'energy_per_100g': 116, 'protein_per_100g': 2.6, 'fat_per_100g': 0.3,
                'carbs_per_100g': 25.6, 'sodium_per_100g': 2, 'fiber_per_100g': 0.3
            },
            {
                'dish_code': 'D0002', 'dish_name': '宫保鸡丁', 'dish_category': '荤菜',
                'energy_per_100g': 226, 'protein_per_100g': 16.4, 'fat_per_100g': 16.5,
                'carbs_per_100g': 5.7, 'sodium_per_100g': 680, 'fiber_per_100g': 1.0
            }
        ])
        
        base_date = date(2024, 1, 15)
        
        session.orders_df = pd.DataFrame([
            {'elderly_id': 'E00001', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'planned_weight': 150},
            {'elderly_id': 'E00001', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0002', 'planned_weight': 100},
            {'elderly_id': 'E00002', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'planned_weight': 120},
            {'elderly_id': 'E00002', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0002', 'planned_weight': 80},
        ])
        
        session.servings_df = pd.DataFrame([
            {'elderly_id': 'E00001', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'actual_weight': 140, 'is_manual': False},
            {'elderly_id': 'E00001', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0002', 'actual_weight': 90, 'is_manual': False},
            {'elderly_id': 'E00002', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'actual_weight': 80, 'is_manual': False},
            {'elderly_id': 'E00002', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0002', 'actual_weight': 70, 'is_manual': False},
        ])
        
        session.wastes_df = pd.DataFrame([
            {'elderly_id': 'E00001', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'waste_weight': 20},
            {'elderly_id': 'E00002', 'date': base_date, 'meal_type': '午餐', 
             'dish_code': 'D0001', 'waste_weight': 30},
        ])
        
        self.assertTrue(self.manager.save_session(session))
        
        session_id = session.session_id
        loaded = load_session(session_id, self.manager)
        
        self.assertIsNotNone(loaded)
        self.assertEqual(len(loaded.elderly_df), 3)
        self.assertEqual(len(loaded.dish_df), 2)
        self.assertEqual(len(loaded.orders_df), 4)
        self.assertEqual(len(loaded.servings_df), 4)
        self.assertEqual(len(loaded.wastes_df), 2)
        
        correction = {
            'data_type': 'serving',
            'elderly_id': 'E00002',
            'date': base_date,
            'meal_type': '午餐',
            'dish_code': 'D0001',
            'original_value': 80,
            'new_value': 110,
            'reason': '少打补录',
            'operator': '营养师'
        }
        
        self.assertTrue(self.manager.apply_manual_correction(correction))
        
        self.assertEqual(len(loaded.manual_corrections), 1)
        
        updated_row = loaded.servings_df[
            (loaded.servings_df['elderly_id'] == 'E00002') &
            (loaded.servings_df['dish_code'] == 'D0001')
        ]
        
        self.assertEqual(updated_row['actual_weight'].iloc[0], 110)
        self.assertTrue(updated_row['is_manual'].iloc[0])


if __name__ == '__main__':
    unittest.main()
