import unittest
import os
import tempfile
import json
import csv

from bend_checker.storage.config import ConfigManager, WorkshopConfig
from bend_checker.storage.csv_import import CSVImporter, ImportResult
from bend_checker.storage.json_import import JSONImporter, JSONImportResult


class TestConfigManager(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.config_manager = ConfigManager(self.temp_dir)
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_init_workshop(self):
        config = self.config_manager.init_workshop("测试车间")
        
        self.assertEqual(config.workshop_name, "测试车间")
        self.assertTrue(self.config_manager.is_initialized())
        
        info = self.config_manager.get_workshop_info()
        self.assertEqual(info['workshop_name'], "测试车间")
        self.assertGreater(info['num_materials'], 0)
        self.assertGreater(info['num_machines'], 0)
        self.assertGreater(info['num_dies'], 0)
    
    def test_load_config_not_initialized(self):
        config = self.config_manager.load_config()
        
        self.assertIsInstance(config, WorkshopConfig)
        self.assertEqual(config.workshop_name, "未命名车间")
    
    def test_update_config(self):
        self.config_manager.init_workshop("原始车间")
        
        new_config = WorkshopConfig(
            workshop_name="更新后的车间",
            default_k_factor=0.40,
            safety_factor=1.5
        )
        self.config_manager.update_config(new_config)
        
        loaded_config = self.config_manager.load_config()
        self.assertEqual(loaded_config.workshop_name, "更新后的车间")
        self.assertEqual(loaded_config.default_k_factor, 0.40)
        self.assertEqual(loaded_config.safety_factor, 1.5)
    
    def test_get_workshop_info_not_initialized(self):
        info = self.config_manager.get_workshop_info()
        
        self.assertEqual(info['workshop_name'], "未命名车间")
        self.assertEqual(info['num_materials'], 0)
        self.assertEqual(info['num_machines'], 0)
        self.assertEqual(info['num_dies'], 0)


class TestCSVImporter(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_generate_template(self):
        template_path = os.path.join(self.temp_dir, 'template.csv')
        
        result = CSVImporter.generate_template(template_path, include_multi_row=False)
        
        self.assertTrue(result)
        self.assertTrue(os.path.exists(template_path))
        
        with open(template_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            headers = reader.fieldnames
            
            self.assertIn('part_number', headers)
            self.assertIn('material_grade', headers)
            self.assertIn('material_thickness', headers)
    
    def test_import_parts_valid(self):
        test_csv_path = os.path.join(self.temp_dir, 'test_parts.csv')
        
        with open(test_csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'part_number', 'part_name', 'material_grade', 'material_thickness',
                'quantity', 'overall_length', 'overall_width',
                'bend_id', 'bend_angle', 'bend_radius', 'flange_length', 'inside_length', 'direction'
            ])
            writer.writeheader()
            writer.writerow({
                'part_number': 'TEST-001',
                'part_name': '测试零件',
                'material_grade': 'SPCC',
                'material_thickness': '1.5',
                'quantity': '10',
                'overall_length': '150',
                'overall_width': '80',
                'bend_id': 'B1',
                'bend_angle': '90',
                'bend_radius': '1.5',
                'flange_length': '25',
                'inside_length': '100',
                'direction': 'up'
            })
        
        result = CSVImporter.import_parts(test_csv_path)
        
        self.assertTrue(result.success)
        self.assertEqual(result.valid_parts, 1)
        self.assertEqual(len(result.parts), 1)
        
        part = result.parts[0]
        self.assertEqual(part.part_number, 'TEST-001')
        self.assertEqual(part.material_grade, 'SPCC')
        self.assertEqual(part.material_thickness, 1.5)
        self.assertEqual(len(part.bends), 1)
    
    def test_import_parts_missing_columns(self):
        test_csv_path = os.path.join(self.temp_dir, 'invalid_parts.csv')
        
        with open(test_csv_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['part_name', 'some_column'])
            writer.writeheader()
            writer.writerow({'part_name': '测试', 'some_column': 'value'})
        
        result = CSVImporter.import_parts(test_csv_path)
        
        self.assertFalse(result.success)
        self.assertGreater(len(result.errors), 0)
    
    def test_import_parts_file_not_exists(self):
        result = CSVImporter.import_parts('/nonexistent/path/file.csv')
        
        self.assertFalse(result.success)
        self.assertGreater(len(result.errors), 0)


class TestJSONImporter(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_generate_die_template(self):
        template_path = os.path.join(self.temp_dir, 'dies_template.json')
        
        result = JSONImporter.generate_die_template(template_path)
        
        self.assertTrue(result)
        self.assertTrue(os.path.exists(template_path))
        
        with open(template_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            self.assertIn('dies', data)
            self.assertEqual(len(data['dies']), 1)
    
    def test_generate_machine_template(self):
        template_path = os.path.join(self.temp_dir, 'machines_template.json')
        
        result = JSONImporter.generate_machine_template(template_path)
        
        self.assertTrue(result)
        self.assertTrue(os.path.exists(template_path))
        
        with open(template_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            self.assertIn('machines', data)
    
    def test_generate_material_template(self):
        template_path = os.path.join(self.temp_dir, 'materials_template.json')
        
        result = JSONImporter.generate_material_template(template_path)
        
        self.assertTrue(result)
        self.assertTrue(os.path.exists(template_path))
        
        with open(template_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            self.assertIn('materials', data)
    
    def test_import_dies_valid(self):
        test_json_path = os.path.join(self.temp_dir, 'test_dies.json')
        
        test_data = {
            "dies": [
                {
                    "id": "TEST_V10",
                    "die_type": "v_die",
                    "v_width": 10.0,
                    "v_angle": 90.0,
                    "min_thickness": 1.0,
                    "max_thickness": 1.5,
                    "description": "测试模具"
                }
            ]
        }
        
        with open(test_json_path, 'w', encoding='utf-8') as f:
            json.dump(test_data, f)
        
        result = JSONImporter.import_dies(test_json_path)
        
        self.assertTrue(result.success)
        self.assertEqual(result.count, 1)
        self.assertEqual(result.type, 'die')
    
    def test_import_file_not_exists(self):
        result = JSONImporter.import_dies('/nonexistent/path/file.json')
        
        self.assertFalse(result.success)
        self.assertGreater(len(result.errors), 0)


if __name__ == '__main__':
    unittest.main()
