import os
import tempfile
import unittest
import json
from ferment_calibrator.ferment_config import FermentConfig, DEFAULT_CONFIG, CONFIG_SCHEMA


class TestFermentConfig(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.config_path = os.path.join(self.temp_dir, 'ferment_config.json')
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_default_config_creation(self):
        config = FermentConfig(self.config_path)
        self.assertTrue(os.path.exists(self.config_path))
        self.assertEqual(config.config, DEFAULT_CONFIG)
    
    def test_config_load_and_save(self):
        config = FermentConfig(self.config_path)
        config.config['sensor_calibration']['pH']['offset'] = 0.2
        config.save()
        
        config2 = FermentConfig(self.config_path)
        self.assertEqual(config2.config['sensor_calibration']['pH']['offset'], 0.2)
    
    def test_getters(self):
        config = FermentConfig(self.config_path)
        
        ph_calib = config.get_ph_calibration()
        self.assertIn('offset', ph_calib)
        self.assertIn('slope', ph_calib)
        
        do_calib = config.get_do_calibration()
        self.assertIn('offset', do_calib)
        
        temp_calib = config.get_temp_calibration()
        self.assertIn('offset', temp_calib)
        
        thresholds = config.get_anomaly_thresholds()
        self.assertIn('temperature', thresholds)
        self.assertIn('pH', thresholds)
        
        stages = config.get_valid_stages()
        self.assertIn('lag', stages)
        self.assertIn('exponential', stages)
        
        feed_recipes = config.get_feed_recipes()
        self.assertIsInstance(feed_recipes, dict)
        
        output_dir = config.get_output_dir()
        self.assertIsInstance(output_dir, str)
    
    def test_get_ph_offset(self):
        config = FermentConfig(self.config_path)
        offset = config.get_ph_offset(2.5)
        self.assertIsInstance(offset, float)
    
    def test_get_do_offset(self):
        config = FermentConfig(self.config_path)
        offset = config.get_do_offset(2.5)
        self.assertIsInstance(offset, float)
    
    def test_get_risk_thresholds(self):
        config = FermentConfig(self.config_path)
        thresholds = config.get_risk_thresholds()
        self.assertIn('contamination', thresholds)
        self.assertIn('sensor_drift', thresholds)
        self.assertIn('missing_feed', thresholds)
    
    def test_validate_config(self):
        config = FermentConfig(self.config_path)
        is_valid, errors = config.validate_config(config.config)
        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)
    
    def test_invalid_config_validation(self):
        invalid_config = {
            'sensor_calibration': {
                'pH': {'offset': 'not a number'}
            }
        }
        config = FermentConfig(self.config_path)
        is_valid, errors = config.validate_config(invalid_config)
        self.assertFalse(is_valid)
        self.assertGreater(len(errors), 0)


if __name__ == '__main__':
    unittest.main()
