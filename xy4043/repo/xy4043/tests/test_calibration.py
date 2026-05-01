import os
import tempfile
import unittest
from datetime import datetime, timedelta
from ferment_calibrator.calibration import (
    Calibrator,
    TimeAligner,
    UnifiedTimeSeries,
    apply_sensor_correction,
    full_calibration_pipeline
)
from ferment_calibrator.csv_parser import FermentationRecord
from ferment_calibrator.ferment_config import FermentConfig


class TestCalibrator(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.config_path = os.path.join(self.temp_dir, 'test_config.json')
        self.config = FermentConfig(self.config_path)
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_apply_sensor_correction(self):
        record = FermentationRecord(
            timestamp=datetime(2024, 5, 1, 8, 0, 0),
            temperature=30.0,
            ph=5.5,
            do=95.0,
            stirring=200,
            od600=0.1,
            feed=0.0,
            feed_recipe=None,
            phase='lag',
            notes=None
        )
        
        corrected = apply_sensor_correction(record, self.config, experiment_hours=0)
        
        self.assertIsNotNone(corrected)
        self.assertIn('temperature', corrected)
        self.assertIn('ph', corrected)
        self.assertIn('do', corrected)
        self.assertIn('timestamp', corrected)
    
    def test_calibrate_ph(self):
        calibrator = Calibrator(self.config)
        record = FermentationRecord(
            timestamp=datetime(2024, 5, 1, 8, 0, 0),
            temperature=30.0,
            ph=5.5,
            do=95.0,
            stirring=200,
            od600=0.1,
            feed=0.0,
            feed_recipe=None,
            phase='lag',
            notes=None
        )
        
        result = calibrator.calibrate_ph(record, experiment_hours=2.5)
        self.assertIsInstance(result, float)
    
    def test_calibrate_do(self):
        calibrator = Calibrator(self.config)
        record = FermentationRecord(
            timestamp=datetime(2024, 5, 1, 8, 0, 0),
            temperature=30.0,
            ph=5.5,
            do=95.0,
            stirring=200,
            od600=0.1,
            feed=0.0,
            feed_recipe=None,
            phase='lag',
            notes=None
        )
        
        result = calibrator.calibrate_do(record, experiment_hours=2.5)
        self.assertIsInstance(result, float)
    
    def test_calibrate_temperature(self):
        calibrator = Calibrator(self.config)
        record = FermentationRecord(
            timestamp=datetime(2024, 5, 1, 8, 0, 0),
            temperature=30.0,
            ph=5.5,
            do=95.0,
            stirring=200,
            od600=0.1,
            feed=0.0,
            feed_recipe=None,
            phase='lag',
            notes=None
        )
        
        result = calibrator.calibrate_temperature(record)
        self.assertIsInstance(result, float)
    
    def test_calibrate_batch(self):
        calibrator = Calibrator(self.config)
        records = [
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 8, 0, 0),
                temperature=30.0,
                ph=5.5,
                do=95.0,
                stirring=200,
                od600=0.1,
                feed=0.0,
                feed_recipe=None,
                phase='lag',
                notes=None
            ),
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 8, 30, 0),
                temperature=30.1,
                ph=5.5,
                do=94.5,
                stirring=200,
                od600=None,
                feed=0.0,
                feed_recipe=None,
                phase='lag',
                notes=None
            )
        ]
        
        corrected = calibrator.calibrate_batch(records)
        self.assertEqual(len(corrected), 2)
        self.assertIn('ph_corrected', corrected[0])
        self.assertIn('do_corrected', corrected[0])


class TestTimeAligner(unittest.TestCase):
    
    def test_align_od600_to_timeseries(self):
        aligner = TimeAligner()
        
        od_samples = [
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'od600': 0.15},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'od600': 0.4}
        ]
        
        timeseries = [
            {'timestamp': datetime(2024, 5, 1, 9, 0, 0), 'temperature': 30.0},
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'temperature': 30.1},
            {'timestamp': datetime(2024, 5, 1, 11, 0, 0), 'temperature': 30.0},
            {'timestamp': datetime(2024, 5, 1, 12, 0, 0), 'temperature': 30.2},
            {'timestamp': datetime(2024, 5, 1, 13, 0, 0), 'temperature': 30.1},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'temperature': 30.2},
            {'timestamp': datetime(2024, 5, 1, 15, 0, 0), 'temperature': 30.0}
        ]
        
        result = aligner.align_od600_to_timeseries(od_samples, timeseries)
        self.assertEqual(len(result), 7)
        
        for i, point in enumerate(result):
            if i == 1:
                self.assertEqual(point['od600_aligned'], 0.15)
            elif i == 5:
                self.assertEqual(point['od600_aligned'], 0.4)
            else:
                self.assertIsNotNone(point.get('od600_aligned'))


class TestUnifiedTimeSeries(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.config_path = os.path.join(self.temp_dir, 'test_config.json')
        self.config = FermentConfig(self.config_path)
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_create_from_records(self):
        records = [
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 8, 0, 0),
                temperature=30.0,
                ph=5.5,
                do=95.0,
                stirring=200,
                od600=0.1,
                feed=0.0,
                feed_recipe=None,
                phase='lag',
                notes='接种完成'
            ),
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 8, 30, 0),
                temperature=30.1,
                ph=5.5,
                do=94.5,
                stirring=200,
                od600=None,
                feed=0.0,
                feed_recipe=None,
                phase='lag',
                notes=None
            )
        ]
        
        unified = UnifiedTimeSeries.create_from_records(records, self.config)
        
        self.assertEqual(len(unified.data), 2)
        self.assertIn('ph_corrected', unified.data[0])
        self.assertIn('do_corrected', unified.data[0])
        self.assertIn('temperature_corrected', unified.data[0])
    
    def test_get_od_samples(self):
        records = [
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 8, 0, 0),
                temperature=30.0,
                ph=5.5,
                do=95.0,
                stirring=200,
                od600=0.1,
                feed=0.0,
                feed_recipe=None,
                phase='lag',
                notes=None
            ),
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 8, 30, 0),
                temperature=30.1,
                ph=5.5,
                do=94.5,
                stirring=200,
                od600=None,
                feed=0.0,
                feed_recipe=None,
                phase='lag',
                notes=None
            ),
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 10, 0, 0),
                temperature=30.0,
                ph=5.4,
                do=91.0,
                stirring=200,
                od600=0.15,
                feed=0.0,
                feed_recipe=None,
                phase='lag',
                notes=None
            )
        ]
        
        unified = UnifiedTimeSeries.create_from_records(records, self.config)
        od_samples = unified.get_od_samples()
        
        self.assertEqual(len(od_samples), 2)
        self.assertEqual(od_samples[0]['od600'], 0.1)
        self.assertEqual(od_samples[1]['od600'], 0.15)
    
    def test_get_feed_events(self):
        records = [
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 8, 0, 0),
                temperature=30.0,
                ph=5.5,
                do=95.0,
                stirring=200,
                od600=0.1,
                feed=0.0,
                feed_recipe=None,
                phase='lag',
                notes=None
            ),
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 14, 0, 0),
                temperature=30.2,
                ph=5.0,
                do=60.0,
                stirring=350,
                od600=0.4,
                feed=50.0,
                feed_recipe='feedA',
                phase='feed',
                notes='第一次补料'
            )
        ]
        
        unified = UnifiedTimeSeries.create_from_records(records, self.config)
        feed_events = unified.get_feed_events()
        
        self.assertEqual(len(feed_events), 1)
        self.assertEqual(feed_events[0]['feed'], 50.0)
        self.assertEqual(feed_events[0]['feed_recipe'], 'feedA')
    
    def test_to_dataframe(self):
        records = [
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 8, 0, 0),
                temperature=30.0,
                ph=5.5,
                do=95.0,
                stirring=200,
                od600=0.1,
                feed=0.0,
                feed_recipe=None,
                phase='lag',
                notes=None
            )
        ]
        
        unified = UnifiedTimeSeries.create_from_records(records, self.config)
        df = unified.to_dataframe()
        
        self.assertEqual(len(df), 1)
        self.assertIn('temperature', df.columns)
        self.assertIn('ph', df.columns)
        self.assertIn('do', df.columns)


class TestFullCalibrationPipeline(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.config_path = os.path.join(self.temp_dir, 'test_config.json')
        self.config = FermentConfig(self.config_path)
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_full_calibration_pipeline(self):
        records = [
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 8, 0, 0),
                temperature=30.0,
                ph=5.5,
                do=95.0,
                stirring=200,
                od600=0.1,
                feed=0.0,
                feed_recipe=None,
                phase='lag',
                notes='接种完成'
            ),
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 8, 30, 0),
                temperature=30.1,
                ph=5.5,
                do=94.5,
                stirring=200,
                od600=None,
                feed=0.0,
                feed_recipe=None,
                phase='lag',
                notes=None
            ),
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 10, 0, 0),
                temperature=30.0,
                ph=5.4,
                do=91.0,
                stirring=200,
                od600=0.15,
                feed=0.0,
                feed_recipe=None,
                phase='lag',
                notes=None
            ),
            FermentationRecord(
                timestamp=datetime(2024, 5, 1, 14, 0, 0),
                temperature=30.2,
                ph=5.0,
                do=60.0,
                stirring=350,
                od600=0.4,
                feed=50.0,
                feed_recipe='feedA',
                phase='feed',
                notes='第一次补料'
            )
        ]
        
        result = full_calibration_pipeline(records, self.config)
        
        self.assertIn('unified_data', result)
        self.assertIn('od_samples', result)
        self.assertIn('feed_events', result)
        self.assertIn('calibration_offsets', result)
        
        self.assertGreater(len(result['unified_data']), 0)
        self.assertEqual(len(result['od_samples']), 3)
        self.assertEqual(len(result['feed_events']), 1)


if __name__ == '__main__':
    unittest.main()
