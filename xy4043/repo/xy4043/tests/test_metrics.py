import unittest
from datetime import datetime, timedelta
from ferment_calibrator.metrics import (
    MetricsCalculator,
    calculate_max_growth_rate,
    estimate_lag_phase,
    calculate_feed_changes,
    detect_do_drop_intervals,
    calculate_batch_similarity,
    calculate_all_metrics
)


class TestMetricsCalculator(unittest.TestCase):
    
    def setUp(self):
        self.calculator = MetricsCalculator()
    
    def test_calculate_specific_growth_rate(self):
        od1 = 0.1
        od2 = 0.2
        time_hours = 2.0
        
        rate = self.calculator.calculate_specific_growth_rate(od1, od2, time_hours)
        
        expected = (0.6931471805599453) / 2.0
        self.assertAlmostEqual(rate, expected, places=6)
    
    def test_calculate_growth_rates_from_od(self):
        od_samples = [
            {'timestamp': datetime(2024, 5, 1, 8, 0, 0), 'od600': 0.1},
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'od600': 0.15},
            {'timestamp': datetime(2024, 5, 1, 12, 0, 0), 'od600': 0.25},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'od600': 0.4},
            {'timestamp': datetime(2024, 5, 1, 16, 0, 0), 'od600': 0.55},
            {'timestamp': datetime(2024, 5, 1, 18, 0, 0), 'od600': 0.65}
        ]
        
        growth_rates = self.calculator._calculate_growth_rates_from_od(od_samples)
        
        self.assertIsInstance(growth_rates, list)
        self.assertEqual(len(growth_rates), len(od_samples) - 1)
        
        for rate in growth_rates:
            self.assertIn('start_time', rate)
            self.assertIn('end_time', rate)
            self.assertIn('growth_rate', rate)
            self.assertIn('time_interval', rate)
    
    def test_sliding_window_growth_rate(self):
        od_samples = [
            {'timestamp': datetime(2024, 5, 1, 8, 0, 0), 'od600': 0.1},
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'od600': 0.15},
            {'timestamp': datetime(2024, 5, 1, 12, 0, 0), 'od600': 0.25},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'od600': 0.4},
            {'timestamp': datetime(2024, 5, 1, 16, 0, 0), 'od600': 0.55},
            {'timestamp': datetime(2024, 5, 1, 18, 0, 0), 'od600': 0.65}
        ]
        
        window_rates = self.calculator._sliding_window_growth_rate(od_samples, window_size=3)
        
        self.assertIsInstance(window_rates, list)
        self.assertGreater(len(window_rates), 0)
        
        for rate in window_rates:
            self.assertIn('center_time', rate)
            self.assertIn('growth_rate', rate)
            self.assertIn('r_squared', rate)


class TestGrowthRateCalculations(unittest.TestCase):
    
    def test_calculate_max_growth_rate(self):
        od_samples = [
            {'timestamp': datetime(2024, 5, 1, 8, 0, 0), 'od600': 0.1},
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'od600': 0.15},
            {'timestamp': datetime(2024, 5, 1, 12, 0, 0), 'od600': 0.25},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'od600': 0.4},
            {'timestamp': datetime(2024, 5, 1, 16, 0, 0), 'od600': 0.55},
            {'timestamp': datetime(2024, 5, 1, 18, 0, 0), 'od600': 0.65}
        ]
        
        result = calculate_max_growth_rate(od_samples)
        
        self.assertIn('max_growth_rate', result)
        self.assertIn('max_rate_time', result)
        self.assertIn('all_growth_rates', result)
        self.assertIn('doubling_time', result)
        
        self.assertIsInstance(result['max_growth_rate'], float)
        self.assertIsInstance(result['doubling_time'], float)
    
    def test_estimate_lag_phase(self):
        od_samples = [
            {'timestamp': datetime(2024, 5, 1, 8, 0, 0), 'od600': 0.1},
            {'timestamp': datetime(2024, 5, 1, 9, 0, 0), 'od600': 0.105},
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'od600': 0.15},
            {'timestamp': datetime(2024, 5, 1, 12, 0, 0), 'od600': 0.25},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'od600': 0.4}
        ]
        
        max_growth_rate = 0.25
        
        result = estimate_lag_phase(od_samples, max_growth_rate)
        
        self.assertIn('lag_phase_duration', result)
        self.assertIn('lag_end_time', result)
        self.assertIn('method', result)
        
        self.assertIsInstance(result['lag_phase_duration'], float)


class TestFeedChanges(unittest.TestCase):
    
    def test_calculate_feed_changes(self):
        data_points = [
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'ph_corrected': 5.4, 'do_corrected': 90.0, 'temperature_corrected': 30.0},
            {'timestamp': datetime(2024, 5, 1, 10, 30, 0), 'ph_corrected': 5.3, 'do_corrected': 88.0, 'temperature_corrected': 30.1},
            {'timestamp': datetime(2024, 5, 1, 11, 0, 0), 'ph_corrected': 5.2, 'do_corrected': 86.0, 'temperature_corrected': 30.0},
            {'timestamp': datetime(2024, 5, 1, 11, 30, 0), 'ph_corrected': 5.1, 'do_corrected': 84.0, 'temperature_corrected': 30.1},
            {'timestamp': datetime(2024, 5, 1, 12, 0, 0), 'ph_corrected': 5.0, 'do_corrected': 80.0, 'temperature_corrected': 30.2},
            {'timestamp': datetime(2024, 5, 1, 12, 30, 0), 'ph_corrected': 5.1, 'do_corrected': 78.0, 'temperature_corrected': 30.1},
            {'timestamp': datetime(2024, 5, 1, 13, 0, 0), 'ph_corrected': 5.1, 'do_corrected': 76.0, 'temperature_corrected': 30.0},
            {'timestamp': datetime(2024, 5, 1, 13, 30, 0), 'ph_corrected': 5.0, 'do_corrected': 74.0, 'temperature_corrected': 30.1}
        ]
        
        feed_events = [
            {'timestamp': datetime(2024, 5, 1, 12, 0, 0), 'feed': 50.0, 'feed_recipe': 'feedA'}
        ]
        
        result = calculate_feed_changes(data_points, feed_events)
        
        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 1)
        
        feed_change = result[0]
        self.assertIn('feed_time', feed_change)
        self.assertIn('feed_recipe', feed_change)
        self.assertIn('ph_before', feed_change)
        self.assertIn('ph_after', feed_change)
        self.assertIn('ph_change', feed_change)
        self.assertIn('do_before', feed_change)
        self.assertIn('do_after', feed_change)
        self.assertIn('do_change', feed_change)
        self.assertIn('temperature_before', feed_change)
        self.assertIn('temperature_after', feed_change)
        self.assertIn('temperature_change', feed_change)


class TestDoDropDetection(unittest.TestCase):
    
    def test_detect_do_drop_intervals(self):
        data_points = []
        base_time = datetime(2024, 5, 1, 8, 0, 0)
        
        do_values = [
            95.0, 94.5, 93.8, 92.5, 91.0,
            89.5, 87.0, 84.0, 80.0, 75.0,
            70.0, 65.0, 60.0, 55.0, 50.0,
            45.0, 40.0, 35.0, 30.0, 25.0,
            30.0, 35.0, 40.0, 45.0, 50.0
        ]
        
        for i, do in enumerate(do_values):
            data_points.append({
                'timestamp': base_time + timedelta(minutes=i * 30),
                'do_corrected': do,
                'experiment_hours': i * 0.5
            })
        
        result = detect_do_drop_intervals(data_points)
        
        self.assertIn('drop_intervals', result)
        self.assertIn('total_drop_duration', result)
        self.assertIn('max_drop_rate', result)
        self.assertIn('low_do_periods', result)
        
        self.assertIsInstance(result['drop_intervals'], list)
        self.assertIsInstance(result['total_drop_duration'], float)
        self.assertIsInstance(result['max_drop_rate'], float)


class TestBatchSimilarity(unittest.TestCase):
    
    def test_calculate_batch_similarity(self):
        batch1_metrics = {
            'max_growth_rate': 0.25,
            'lag_phase_duration': 2.5,
            'final_od600': 0.65,
            'mean_ph': 5.2,
            'mean_temperature': 30.1,
            'feed_count': 2
        }
        
        batch2_metrics = {
            'max_growth_rate': 0.27,
            'lag_phase_duration': 2.3,
            'final_od600': 0.68,
            'mean_ph': 5.1,
            'mean_temperature': 30.0,
            'feed_count': 2
        }
        
        weights = {
            'max_growth_rate': 0.3,
            'lag_phase_duration': 0.2,
            'final_od600': 0.2,
            'mean_ph': 0.15,
            'mean_temperature': 0.15
        }
        
        result = calculate_batch_similarity(batch1_metrics, batch2_metrics, weights)
        
        self.assertIn('overall_similarity', result)
        self.assertIn('metric_similarities', result)
        self.assertIn('weights_used', result)
        
        self.assertIsInstance(result['overall_similarity'], float)
        self.assertGreaterEqual(result['overall_similarity'], 0.0)
        self.assertLessEqual(result['overall_similarity'], 1.0)


class TestAllMetrics(unittest.TestCase):
    
    def test_calculate_all_metrics(self):
        od_samples = [
            {'timestamp': datetime(2024, 5, 1, 8, 0, 0), 'od600': 0.1},
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'od600': 0.15},
            {'timestamp': datetime(2024, 5, 1, 12, 0, 0), 'od600': 0.25},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'od600': 0.4},
            {'timestamp': datetime(2024, 5, 1, 16, 0, 0), 'od600': 0.55},
            {'timestamp': datetime(2024, 5, 1, 18, 0, 0), 'od600': 0.65}
        ]
        
        data_points = [
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'ph_corrected': 5.4, 'do_corrected': 90.0, 'temperature_corrected': 30.0, 'experiment_hours': 2.0},
            {'timestamp': datetime(2024, 5, 1, 12, 0, 0), 'ph_corrected': 5.2, 'do_corrected': 80.0, 'temperature_corrected': 30.2, 'experiment_hours': 4.0},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'ph_corrected': 5.0, 'do_corrected': 70.0, 'temperature_corrected': 30.1, 'experiment_hours': 6.0},
            {'timestamp': datetime(2024, 5, 1, 16, 0, 0), 'ph_corrected': 4.9, 'do_corrected': 60.0, 'temperature_corrected': 30.0, 'experiment_hours': 8.0},
            {'timestamp': datetime(2024, 5, 1, 18, 0, 0), 'ph_corrected': 4.8, 'do_corrected': 50.0, 'temperature_corrected': 30.1, 'experiment_hours': 10.0}
        ]
        
        feed_events = [
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'feed': 50.0, 'feed_recipe': 'feedA'}
        ]
        
        result = calculate_all_metrics(od_samples, data_points, feed_events)
        
        self.assertIn('growth_metrics', result)
        self.assertIn('feed_metrics', result)
        self.assertIn('do_metrics', result)
        self.assertIn('summary', result)
        
        self.assertIn('max_growth_rate', result['growth_metrics'])
        self.assertIn('lag_phase_duration', result['growth_metrics'])
        self.assertIn('doubling_time', result['growth_metrics'])
        self.assertIn('final_od600', result['growth_metrics'])
        
        self.assertIn('feed_changes', result['feed_metrics'])
        self.assertIn('total_feed_amount', result['feed_metrics'])
        self.assertIn('feed_count', result['feed_metrics'])
        
        self.assertIn('drop_intervals', result['do_metrics'])
        self.assertIn('total_drop_duration', result['do_metrics'])
        self.assertIn('max_drop_rate', result['do_metrics'])
        self.assertIn('low_do_periods', result['do_metrics'])
        
        self.assertIn('experiment_duration_hours', result['summary'])
        self.assertIn('total_data_points', result['summary'])
        self.assertIn('od_sample_count', result['summary'])


if __name__ == '__main__':
    unittest.main()
