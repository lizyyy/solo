import unittest
import tempfile
import os
import csv
import json
import yaml
import pandas as pd
import numpy as np
from pathlib import Path

from kiln_analyzer.data_parser import (
    DataParser,
    ThermocoupleData,
    KilnPosition,
    GlazeRecipe
)


class TestDataParser(unittest.TestCase):
    
    def setUp(self):
        self.parser = DataParser()
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def create_test_csv(self, filename: str, include_missing: bool = False):
        csv_path = Path(self.temp_dir) / filename
        
        times = pd.date_range(
            start='2024-01-01 08:00:00',
            periods=100,
            freq='1min'
        )
        
        temps = []
        for i in range(100):
            if include_missing and i in [25, 50, 75]:
                temps.append('')
            else:
                temp = 20 + (i / 100) * 1260
                temps.append(f"{temp:.1f}")
        
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(['time', 'temperature'])
            for t, temp in zip(times.strftime('%Y-%m-%d %H:%M:%S'), temps):
                writer.writerow([t, temp])
        
        return str(csv_path)
    
    def create_test_json(self, filename: str):
        json_path = Path(self.temp_dir) / filename
        
        data = {
            "positions": [
                {
                    "id": "pos_1",
                    "name": "上层左前",
                    "position_x": 0.2,
                    "position_y": 0.8,
                    "position_z": 0.5,
                    "thermocouple_id": "test_tc",
                    "items": [
                        {"glaze_id": "glaze_001", "count": 3}
                    ]
                }
            ]
        }
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False)
        
        return str(json_path)
    
    def create_test_yaml(self, filename: str):
        yaml_path = Path(self.temp_dir) / filename
        
        data = {
            "recipes": [
                {
                    "id": "glaze_001",
                    "name": "青瓷釉",
                    "components": {
                        "长石": 40.0,
                        "石英": 30.0,
                        "高岭土": 20.0,
                        "石灰石": 10.0
                    },
                    "firing_profile": {
                        "max_temp": 1280,
                        "holding_time_min": 30
                    },
                    "risk_rules": {
                        "max_heating_rate": 150.0,
                        "max_cooling_rate": -100.0,
                        "critical_cooling_range": [573, 300]
                    }
                }
            ]
        }
        
        with open(yaml_path, 'w', encoding='utf-8') as f:
            yaml.dump(data, f, allow_unicode=True)
        
        return str(yaml_path)
    
    def test_parse_thermocouple_csv_basic(self):
        csv_path = self.create_test_csv('test.csv')
        
        tc_data = self.parser.parse_thermocouple_csv(csv_path)
        
        self.assertIsInstance(tc_data, ThermocoupleData)
        self.assertEqual(tc_data.name, 'test')
        self.assertEqual(len(tc_data.temperatures), 100)
        self.assertEqual(tc_data.metadata['missing_points_count'], 0)
    
    def test_parse_thermocouple_csv_with_missing(self):
        csv_path = self.create_test_csv('test_missing.csv', include_missing=True)
        
        tc_data = self.parser.parse_thermocouple_csv(csv_path, interpolation_method='linear')
        
        self.assertEqual(tc_data.metadata['missing_points_count'], 3)
        
        temps = tc_data.temperatures
        self.assertFalse(temps.isna().any())
    
    def test_parse_kiln_positions_json(self):
        json_path = self.create_test_json('positions.json')
        
        positions = self.parser.parse_kiln_positions_json(json_path)
        
        self.assertEqual(len(positions), 1)
        self.assertIn('pos_1', positions)
        
        pos = positions['pos_1']
        self.assertEqual(pos.name, '上层左前')
        self.assertEqual(pos.thermocouple_id, 'test_tc')
        self.assertEqual(len(pos.items), 1)
    
    def test_parse_glaze_recipes_yaml(self):
        yaml_path = self.create_test_yaml('glazes.yaml')
        
        recipes = self.parser.parse_glaze_recipes_yaml(yaml_path)
        
        self.assertEqual(len(recipes), 1)
        self.assertIn('glaze_001', recipes)
        
        recipe = recipes['glaze_001']
        self.assertEqual(recipe.name, '青瓷釉')
        self.assertEqual(recipe.firing_profile['max_temp'], 1280)
        self.assertEqual(len(recipe.components), 4)
    
    def test_thermocouple_data_data_frame(self):
        csv_path = self.create_test_csv('test.csv')
        tc_data = self.parser.parse_thermocouple_csv(csv_path)
        
        df = tc_data.data_frame
        
        self.assertIsInstance(df, pd.DataFrame)
        self.assertEqual(len(df), 100)
        self.assertIn('temperature', df.columns)
    
    def test_get_all_data(self):
        csv_path = self.create_test_csv('test.csv')
        json_path = self.create_test_json('positions.json')
        yaml_path = self.create_test_yaml('glazes.yaml')
        
        self.parser.parse_thermocouple_csv(csv_path)
        self.parser.parse_kiln_positions_json(json_path)
        self.parser.parse_glaze_recipes_yaml(yaml_path)
        
        all_data = self.parser.get_all_data()
        
        self.assertIn('thermocouples', all_data)
        self.assertIn('kiln_positions', all_data)
        self.assertIn('glaze_recipes', all_data)
        
        self.assertEqual(len(all_data['thermocouples']), 1)
        self.assertEqual(len(all_data['kiln_positions']), 1)
        self.assertEqual(len(all_data['glaze_recipes']), 1)
    
    def test_identify_columns_flexible(self):
        test_df = pd.DataFrame({
            'Time': ['00:00', '00:01', '00:02'],
            'Temp': [20, 25, 30]
        })
        
        time_col, temp_col = self.parser._identify_columns(test_df)
        
        self.assertEqual(time_col, 'Time')
        self.assertEqual(temp_col, 'Temp')
    
    def test_clean_missing_data_linear(self):
        temps = pd.Series([20, np.nan, 24, np.nan, 28], 
                           index=pd.date_range('2024-01-01', periods=5, freq='1min'))
        
        cleaned = self.parser._clean_missing_data(temps, 'linear')
        
        self.assertFalse(cleaned.isna().any())
        self.assertAlmostEqual(cleaned.iloc[1], 22.0)
        self.assertAlmostEqual(cleaned.iloc[3], 26.0)


if __name__ == '__main__':
    unittest.main()
