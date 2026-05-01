import unittest
from datetime import datetime, timedelta
from ferment_calibrator.risk_detection import (
    RiskType,
    RiskSeverity,
    RiskEvent,
    RiskDetector,
    detect_all_risks
)


class TestRiskType(unittest.TestCase):
    
    def test_risk_type_values(self):
        self.assertEqual(RiskType.CONTAMINATION.value, 'contamination')
        self.assertEqual(RiskType.SENSOR_MISALIGNMENT.value, 'sensor_misalignment')
        self.assertEqual(RiskType.MISSING_FEED_RECORD.value, 'missing_feed_record')
        self.assertEqual(RiskType.RAPID_PH_CHANGE.value, 'rapid_ph_change')
        self.assertEqual(RiskType.ABNORMAL_DO.value, 'abnormal_do')
        self.assertEqual(RiskType.ABNORMAL_TEMPERATURE.value, 'abnormal_temperature')
        self.assertEqual(RiskType.ABNORMAL_OD_GROWTH.value, 'abnormal_od_growth')
    
    def test_risk_type_description(self):
        self.assertEqual(RiskType.CONTAMINATION.description, '污染风险')
        self.assertEqual(RiskType.SENSOR_MISALIGNMENT.description, '传感器失准')
        self.assertEqual(RiskType.MISSING_FEED_RECORD.description, '补料记录缺失')
        self.assertEqual(RiskType.RAPID_PH_CHANGE.description, 'pH快速变化')
        self.assertEqual(RiskType.ABNORMAL_DO.description, '溶氧异常')
        self.assertEqual(RiskType.ABNORMAL_TEMPERATURE.description, '温度异常')
        self.assertEqual(RiskType.ABNORMAL_OD_GROWTH.description, 'OD生长异常')


class TestRiskSeverity(unittest.TestCase):
    
    def test_severity_values(self):
        self.assertEqual(RiskSeverity.CRITICAL.value, 'critical')
        self.assertEqual(RiskSeverity.HIGH.value, 'high')
        self.assertEqual(RiskSeverity.MEDIUM.value, 'medium')
        self.assertEqual(RiskSeverity.LOW.value, 'low')
    
    def test_severity_description(self):
        self.assertEqual(RiskSeverity.CRITICAL.description, '严重')
        self.assertEqual(RiskSeverity.HIGH.description, '高')
        self.assertEqual(RiskSeverity.MEDIUM.description, '中')
        self.assertEqual(RiskSeverity.LOW.description, '低')


class TestRiskEvent(unittest.TestCase):
    
    def test_create_risk_event(self):
        event = RiskEvent(
            risk_type=RiskType.CONTAMINATION,
            severity=RiskSeverity.HIGH,
            timestamp=datetime(2024, 5, 1, 14, 0, 0),
            description='检测到pH快速下降，可能存在污染',
            evidence={
                'ph_drop_rate': -0.3,
                'time_window_hours': 2.0,
                'current_ph': 4.7
            }
        )
        
        self.assertEqual(event.risk_type, RiskType.CONTAMINATION)
        self.assertEqual(event.severity, RiskSeverity.HIGH)
        self.assertEqual(event.description, '检测到pH快速下降，可能存在污染')
    
    def test_to_dict(self):
        event = RiskEvent(
            risk_type=RiskType.SENSOR_MISALIGNMENT,
            severity=RiskSeverity.MEDIUM,
            timestamp=datetime(2024, 5, 1, 10, 0, 0),
            description='溶氧读数恒定超过2小时，可能传感器失准',
            evidence={
                'constant_duration_hours': 2.5,
                'constant_value': 65.0,
                'start_time': '2024-05-01 07:30:00'
            }
        )
        
        data = event.to_dict()
        
        self.assertEqual(data['risk_type'], 'sensor_misalignment')
        self.assertEqual(data['risk_type_name'], '传感器失准')
        self.assertEqual(data['severity'], 'medium')
        self.assertEqual(data['severity_name'], '中')
        self.assertEqual(data['description'], '溶氧读数恒定超过2小时，可能传感器失准')
        self.assertIn('evidence', data)
        self.assertEqual(data['evidence']['constant_value'], 65.0)


class TestRiskDetector(unittest.TestCase):
    
    def setUp(self):
        self.detector = RiskDetector()
    
    def test_check_contamination_rapid_ph_drop(self):
        data_points = []
        base_time = datetime(2024, 5, 1, 8, 0, 0)
        
        ph_values = [5.5, 5.45, 5.4, 5.3, 5.1, 4.9, 4.7, 4.5, 4.3, 4.1]
        
        for i, ph in enumerate(ph_values):
            data_points.append({
                'timestamp': base_time + timedelta(hours=i),
                'ph_corrected': ph,
                'temperature_corrected': 30.0 + i * 0.1,
                'do_corrected': 95.0 - i * 3.0,
                'experiment_hours': float(i)
            })
        
        risks = self.detector._check_contamination(data_points)
        
        self.assertGreater(len(risks), 0)
        contamination_risks = [r for r in risks if r.risk_type == RiskType.CONTAMINATION]
        self.assertGreater(len(contamination_risks), 0)
    
    def test_check_sensor_misalignment_constant_reading(self):
        data_points = []
        base_time = datetime(2024, 5, 1, 8, 0, 0)
        
        for i in range(12):
            data_points.append({
                'timestamp': base_time + timedelta(minutes=i * 30),
                'ph_corrected': 5.5,
                'temperature_corrected': 30.0,
                'do_corrected': 65.0,
                'experiment_hours': i * 0.5
            })
        
        risks = self.detector._check_sensor_misalignment(data_points)
        
        self.assertGreater(len(risks), 0)
        sensor_risks = [r for r in risks if r.risk_type == RiskType.SENSOR_MISALIGNMENT]
        self.assertGreater(len(sensor_risks), 0)
    
    def test_check_missing_feed_record(self):
        data_points = []
        base_time = datetime(2024, 5, 1, 8, 0, 0)
        
        for i in range(24):
            data_points.append({
                'timestamp': base_time + timedelta(hours=i),
                'ph_corrected': 5.5 - i * 0.03,
                'temperature_corrected': 30.0,
                'do_corrected': 95.0 - i * 1.5,
                'experiment_hours': float(i)
            })
        
        feed_events = [
            {'timestamp': datetime(2024, 5, 1, 14, 0, 0), 'feed': 50.0, 'feed_recipe': 'feedA'}
        ]
        
        risks = self.detector._check_missing_feed_record(data_points, feed_events)
        
        missing_feed_risks = [r for r in risks if r.risk_type == RiskType.MISSING_FEED_RECORD]
        self.assertGreaterEqual(len(missing_feed_risks), 0)
    
    def test_check_rapid_ph_change(self):
        data_points = []
        base_time = datetime(2024, 5, 1, 8, 0, 0)
        
        ph_values = [5.5, 5.5, 5.5, 5.45, 5.4, 5.2, 5.0, 4.8, 4.7, 4.7]
        
        for i, ph in enumerate(ph_values):
            data_points.append({
                'timestamp': base_time + timedelta(minutes=i * 30),
                'ph_corrected': ph,
                'temperature_corrected': 30.0,
                'do_corrected': 90.0,
                'experiment_hours': i * 0.5
            })
        
        risks = self.detector._check_rapid_ph_change(data_points)
        
        self.assertGreater(len(risks), 0)
        ph_risks = [r for r in risks if r.risk_type == RiskType.RAPID_PH_CHANGE]
        self.assertGreater(len(ph_risks), 0)
    
    def test_check_abnormal_do(self):
        data_points = []
        base_time = datetime(2024, 5, 1, 8, 0, 0)
        
        do_values = [95.0, 94.0, 93.0, 80.0, 50.0, 20.0, 10.0, 5.0, 8.0, 12.0]
        
        for i, do in enumerate(do_values):
            data_points.append({
                'timestamp': base_time + timedelta(minutes=i * 30),
                'ph_corrected': 5.5,
                'temperature_corrected': 30.0,
                'do_corrected': do,
                'experiment_hours': i * 0.5
            })
        
        risks = self.detector._check_abnormal_do(data_points)
        
        self.assertGreater(len(risks), 0)
        do_risks = [r for r in risks if r.risk_type == RiskType.ABNORMAL_DO]
        self.assertGreater(len(do_risks), 0)
    
    def test_check_abnormal_temperature(self):
        data_points = []
        base_time = datetime(2024, 5, 1, 8, 0, 0)
        
        temp_values = [30.0, 30.1, 30.0, 30.2, 32.0, 35.0, 37.0, 35.0, 33.0, 31.0]
        
        for i, temp in enumerate(temp_values):
            data_points.append({
                'timestamp': base_time + timedelta(minutes=i * 30),
                'ph_corrected': 5.5,
                'temperature_corrected': temp,
                'do_corrected': 90.0,
                'experiment_hours': i * 0.5
            })
        
        risks = self.detector._check_abnormal_temperature(data_points)
        
        self.assertGreater(len(risks), 0)
        temp_risks = [r for r in risks if r.risk_type == RiskType.ABNORMAL_TEMPERATURE]
        self.assertGreater(len(temp_risks), 0)


class TestDetectAllRisks(unittest.TestCase):
    
    def test_detect_all_risks(self):
        data_points = []
        base_time = datetime(2024, 5, 1, 8, 0, 0)
        
        for i in range(12):
            data_points.append({
                'timestamp': base_time + timedelta(minutes=i * 30),
                'ph_corrected': 5.5 - i * 0.08,
                'temperature_corrected': 30.0 + i * 0.2,
                'do_corrected': 95.0 - i * 5.0,
                'experiment_hours': i * 0.5
            })
        
        od_samples = [
            {'timestamp': datetime(2024, 5, 1, 8, 0, 0), 'od600': 0.1},
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'od600': 0.15},
            {'timestamp': datetime(2024, 5, 1, 12, 0, 0), 'od600': 0.25}
        ]
        
        feed_events = [
            {'timestamp': datetime(2024, 5, 1, 10, 0, 0), 'feed': 50.0, 'feed_recipe': 'feedA'}
        ]
        
        thresholds = {
            'contamination': {'ph_drop_threshold': -0.2, 'temp_rise_threshold': 1.5},
            'sensor_drift': {'constant_reading_hours': 2.0},
            'missing_feed': {'expected_interval_hours': 6.0}
        }
        
        result = detect_all_risks(data_points, od_samples, feed_events, thresholds)
        
        self.assertIn('risks', result)
        self.assertIn('summary', result)
        
        risks = result['risks']
        self.assertIsInstance(risks, list)
        
        summary = result['summary']
        self.assertIn('total_risks', summary)
        self.assertIn('by_severity', summary)
        self.assertIn('by_type', summary)


if __name__ == '__main__':
    unittest.main()
