import unittest
from datetime import datetime
from ferment_calibrator.phase_segmentation import (
    GrowthPhase,
    PhaseSegment,
    PhaseSegmenter,
    detect_phase_by_od,
    segment_phases_by_feed,
    segment_phases
)


class TestGrowthPhase(unittest.TestCase):
    
    def test_phase_enum_values(self):
        self.assertEqual(GrowthPhase.LAG.value, 'lag')
        self.assertEqual(GrowthPhase.EXPONENTIAL.value, 'exponential')
        self.assertEqual(GrowthPhase.STATIONARY.value, 'stationary')
        self.assertEqual(GrowthPhase.DECLINE.value, 'decline')
        self.assertEqual(GrowthPhase.FEED.value, 'feed')
    
    def test_phase_description(self):
        self.assertEqual(GrowthPhase.LAG.description, '滞后期')
        self.assertEqual(GrowthPhase.EXPONENTIAL.description, '指数生长期')
        self.assertEqual(GrowthPhase.STATIONARY.description, '稳定期')
        self.assertEqual(GrowthPhase.DECLINE.description, '衰退期')
        self.assertEqual(GrowthPhase.FEED.description, '补料期')


class TestPhaseSegment(unittest.TestCase):
    
    def test_create_segment(self):
        segment = PhaseSegment(
            phase=GrowthPhase.EXPONENTIAL,
            start_time=datetime(2024, 5, 1, 10, 30, 0),
            end_time=datetime(2024, 5, 1, 18, 0, 0),
            start_od=0.15,
            end_od=0.65,
            growth_rate=0.25,
            duration_hours=7.5
        )
        
        self.assertEqual(segment.phase, GrowthPhase.EXPONENTIAL)
        self.assertEqual(segment.growth_rate, 0.25)
        self.assertEqual(segment.duration_hours, 7.5)
    
    def test_to_dict(self):
        segment = PhaseSegment(
            phase=GrowthPhase.LAG,
            start_time=datetime(2024, 5, 1, 8, 0, 0),
            end_time=datetime(2024, 5, 1, 10, 30, 0),
            start_od=0.1,
            end_od=0.15,
            growth_rate=0.05,
            duration_hours=2.5
        )
        
        data = segment.to_dict()
        self.assertEqual(data['phase'], 'lag')
        self.assertEqual(data['start_od'], 0.1)
        self.assertEqual(data['end_od'], 0.15)
        self.assertEqual(data['growth_rate'], 0.05)
        self.assertEqual(data['duration_hours'], 2.5)


class TestPhaseSegmenter(unittest.TestCase):
    
    def test_calculate_growth_rates(self):
        segmenter = PhaseSegmenter()
        
        od_samples = [
            {'timestamp': datetime(2024, 5, 1, 8, 0, 0), 'od600': 0.1},
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'od600': 0.15},
            {'timestamp': datetime(2024, 5, 1, 12, 0, 0), 'od600': 0.25},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'od600': 0.4},
            {'timestamp': datetime(2024, 5, 1, 16, 0, 0), 'od600': 0.55},
            {'timestamp': datetime(2024, 5, 1, 18, 0, 0), 'od600': 0.65},
            {'timestamp': datetime(2024, 5, 1, 20, 0, 0), 'od600': 0.68},
            {'timestamp': datetime(2024, 5, 2, 0, 0, 0), 'od600': 0.58}
        ]
        
        growth_rates = segmenter._calculate_growth_rates(od_samples)
        
        self.assertIsInstance(growth_rates, list)
        self.assertEqual(len(growth_rates), len(od_samples))
        
        for rate in growth_rates:
            self.assertIn('timestamp', rate)
            self.assertIn('growth_rate', rate)
    
    def test_calculate_phase_statistics(self):
        segmenter = PhaseSegmenter()
        
        data_points = [
            {'timestamp': datetime(2024, 5, 1, 8, 0, 0), 'temperature': 30.0, 'ph': 5.5, 'do': 95.0, 'od600_aligned': 0.1},
            {'timestamp': datetime(2024, 5, 1, 8, 30, 0), 'temperature': 30.1, 'ph': 5.5, 'do': 94.5, 'od600_aligned': 0.11},
            {'timestamp': datetime(2024, 5, 1, 9, 0, 0), 'temperature': 30.0, 'ph': 5.5, 'do': 93.8, 'od600_aligned': 0.12},
            {'timestamp': datetime(2024, 5, 1, 9, 30, 0), 'temperature': 30.1, 'ph': 5.4, 'do': 92.5, 'od600_aligned': 0.13},
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'temperature': 30.0, 'ph': 5.4, 'do': 91.0, 'od600_aligned': 0.15}
        ]
        
        stats = segmenter._calculate_phase_statistics(data_points)
        
        self.assertIn('temperature_mean', stats)
        self.assertIn('temperature_std', stats)
        self.assertIn('ph_mean', stats)
        self.assertIn('ph_std', stats)
        self.assertIn('do_mean', stats)
        self.assertIn('do_std', stats)
        self.assertIn('od600_mean', stats)
    
    def test_detect_phase_by_od(self):
        od_samples = [
            {'timestamp': datetime(2024, 5, 1, 8, 0, 0), 'od600': 0.1},
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'od600': 0.15},
            {'timestamp': datetime(2024, 5, 1, 12, 0, 0), 'od600': 0.25},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'od600': 0.4},
            {'timestamp': datetime(2024, 5, 1, 16, 0, 0), 'od600': 0.55},
            {'timestamp': datetime(2024, 5, 1, 18, 0, 0), 'od600': 0.65},
            {'timestamp': datetime(2024, 5, 1, 20, 0, 0), 'od600': 0.68},
            {'timestamp': datetime(2024, 5, 2, 0, 0, 0), 'od600': 0.58}
        ]
        
        result = detect_phase_by_od(od_samples)
        
        self.assertIn('phases', result)
        self.assertIn('growth_rates', result)
        self.assertIn('max_growth_rate', result)
        
        phases = result['phases']
        self.assertGreater(len(phases), 0)
        
        phase_names = [p.phase for p in phases]
        self.assertIn(GrowthPhase.LAG, phase_names)
        self.assertIn(GrowthPhase.EXPONENTIAL, phase_names)
    
    def test_segment_phases_by_feed(self):
        data_points = [
            {'timestamp': datetime(2024, 5, 1, 8, 0, 0), 'temperature': 30.0, 'ph': 5.5, 'do': 95.0, 'od600_aligned': 0.1, 'phase': 'lag'},
            {'timestamp': datetime(2024, 5, 1, 10, 30, 0), 'temperature': 30.2, 'ph': 5.4, 'do': 89.5, 'od600_aligned': 0.16, 'phase': 'exponential'},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'temperature': 30.2, 'ph': 5.0, 'do': 60.0, 'od600_aligned': 0.4, 'phase': 'feed', 'feed': 50.0, 'feed_recipe': 'feedA'},
            {'timestamp': datetime(2024, 5, 1, 16, 0, 0), 'temperature': 30.2, 'ph': 5.0, 'do': 62.0, 'od600_aligned': 0.52, 'phase': 'exponential'},
            {'timestamp': datetime(2024, 5, 1, 18, 0, 0), 'temperature': 30.2, 'ph': 4.8, 'do': 53.0, 'od600_aligned': 0.65, 'phase': 'feed', 'feed': 75.0, 'feed_recipe': 'feedB'},
            {'timestamp': datetime(2024, 5, 1, 20, 0, 0), 'temperature': 30.1, 'ph': 4.8, 'do': 58.0, 'od600_aligned': 0.67, 'phase': 'stationary'},
            {'timestamp': datetime(2024, 5, 2, 0, 0, 0), 'temperature': 29.7, 'ph': 4.5, 'do': 49.0, 'od600_aligned': 0.58, 'phase': 'decline'}
        ]
        
        feed_events = [
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'feed': 50.0, 'feed_recipe': 'feedA'},
            {'timestamp': datetime(2024, 5, 1, 18, 0, 0), 'feed': 75.0, 'feed_recipe': 'feedB'}
        ]
        
        od_samples = [
            {'timestamp': datetime(2024, 5, 1, 8, 0, 0), 'od600': 0.1},
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'od600': 0.15},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'od600': 0.4},
            {'timestamp': datetime(2024, 5, 1, 18, 0, 0), 'od600': 0.65},
            {'timestamp': datetime(2024, 5, 2, 0, 0, 0), 'od600': 0.58}
        ]
        
        segments = segment_phases_by_feed(data_points, feed_events, od_samples)
        
        self.assertGreater(len(segments), 0)
        
        for segment in segments:
            self.assertIsInstance(segment, PhaseSegment)
    
    def test_segment_phases(self):
        data_points = [
            {'timestamp': datetime(2024, 5, 1, 8, 0, 0), 'temperature': 30.0, 'ph': 5.5, 'do': 95.0, 'od600_aligned': 0.1, 'phase': 'lag'},
            {'timestamp': datetime(2024, 5, 1, 10, 30, 0), 'temperature': 30.2, 'ph': 5.4, 'do': 89.5, 'od600_aligned': 0.16, 'phase': 'exponential'},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'temperature': 30.2, 'ph': 5.0, 'do': 60.0, 'od600_aligned': 0.4, 'phase': 'feed', 'feed': 50.0, 'feed_recipe': 'feedA'},
            {'timestamp': datetime(2024, 5, 1, 18, 0, 0), 'temperature': 30.2, 'ph': 4.8, 'do': 53.0, 'od600_aligned': 0.65, 'phase': 'stationary'},
            {'timestamp': datetime(2024, 5, 2, 0, 0, 0), 'temperature': 29.7, 'ph': 4.5, 'do': 49.0, 'od600_aligned': 0.58, 'phase': 'decline'}
        ]
        
        feed_events = [
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'feed': 50.0, 'feed_recipe': 'feedA'}
        ]
        
        od_samples = [
            {'timestamp': datetime(2024, 5, 1, 8, 0, 0), 'od600': 0.1},
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'od600': 0.15},
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'od600': 0.4},
            {'timestamp': datetime(2024, 5, 1, 18, 0, 0), 'od600': 0.65},
            {'timestamp': datetime(2024, 5, 2, 0, 0, 0), 'od600': 0.58}
        ]
        
        result = segment_phases(data_points, feed_events, od_samples, use_feed_events=True)
        
        self.assertIn('segments', result)
        self.assertIn('feed_segments', result)
        self.assertIn('od_phases', result)
        
        self.assertGreater(len(result['segments']), 0)


if __name__ == '__main__':
    unittest.main()
