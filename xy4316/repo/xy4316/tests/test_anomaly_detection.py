import sys
import os
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
from anomaly_detection import AnomalyDetector, AnomalyReport, AnomalyDiagnosis, anomaly_detector


class TestAnomalyDetector:
    @pytest.fixture
    def detector(self):
        return AnomalyDetector()
    
    @pytest.fixture
    def normal_data(self):
        np.random.seed(42)
        x = np.array([10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0])
        true_slope = 0.12
        true_intercept = 0.5
        noise = np.random.normal(0, 0.05, size=len(x))
        y = true_slope * x + true_intercept + noise
        residuals = y - (true_slope * x + true_intercept)
        return x, y, residuals
    
    @pytest.fixture
    def data_with_outlier(self):
        np.random.seed(42)
        x = np.array([10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0])
        true_slope = 0.12
        true_intercept = 0.5
        noise = np.random.normal(0, 0.05, size=len(x))
        y = true_slope * x + true_intercept + noise
        y[3] += 2.0
        residuals = y - (true_slope * x + true_intercept)
        return x, y, residuals
    
    def test_detect_normal_data(self, detector, normal_data):
        x, y, residuals = normal_data
        
        report = detector.detect(x, y, residuals)
        
        assert isinstance(report, AnomalyReport)
        assert report.total_points == len(x)
    
    def test_detect_with_outlier(self, detector, data_with_outlier):
        x, y, residuals = data_with_outlier
        
        report = detector.detect(x, y, residuals)
        
        assert isinstance(report, AnomalyReport)
        assert report.total_points == len(x)
    
    def test_anomaly_report_attributes(self, detector, normal_data):
        x, y, residuals = normal_data
        
        report = detector.detect(x, y, residuals)
        
        assert report.normal_count + report.anomaly_count == report.total_points
        assert len(report.normal_indices) == report.normal_count
        assert len(report.anomalies) == report.anomaly_count
    
    def test_get_anomaly_indices(self, detector, data_with_outlier):
        x, y, residuals = data_with_outlier
        
        report = detector.detect(x, y, residuals)
        
        indices = report.get_anomaly_indices()
        assert isinstance(indices, list)
        assert all(isinstance(i, int) for i in indices)
    
    def test_get_severity_counts(self, detector, normal_data):
        x, y, residuals = normal_data
        
        report = detector.detect(x, y, residuals)
        
        counts = report.get_severity_counts()
        assert 'high' in counts
        assert 'medium' in counts
        assert 'low' in counts
    
    def test_create_diagnosis(self, detector):
        diagnosis = detector._create_diagnosis(
            index=3,
            pump_speed=25.0,
            flow_rate=4.5,
            residual=2.5,
            details={'methods': ['residual_zscore']}
        )
        
        assert isinstance(diagnosis, AnomalyDiagnosis)
        assert diagnosis.index == 3
        assert diagnosis.pump_speed == 25.0
        assert diagnosis.flow_rate == 4.5
    
    def test_filter_outliers_normal_data(self, detector, normal_data):
        x, y, residuals = normal_data
        
        report = detector.detect(x, y, residuals)
        
        x_filtered, y_filtered, r_filtered, removed = detector.filter_outliers(
            x, y, residuals, report
        )
        
        assert len(x_filtered) == len(x)
        assert len(removed) == 0
    
    def test_filter_outliers_remove_high_severity(self, detector, data_with_outlier):
        x, y, residuals = data_with_outlier
        
        report = detector.detect(x, y, residuals)
        
        x_filtered, y_filtered, r_filtered, removed = detector.filter_outliers(
            x, y, residuals, report, remove_high_severity_only=True
        )
        
        assert len(x_filtered) <= len(x)
        assert len(x_filtered) == len(y_filtered)
        assert len(x_filtered) == len(r_filtered)
    
    def test_generate_summary(self, detector, normal_data):
        x, y, residuals = normal_data
        
        report = detector.detect(x, y, residuals)
        
        summary = report.summary
        assert 'status' in summary
        assert 'detection_method' in summary
        assert 'severity_counts' in summary


class TestAnomalyDiagnosis:
    def test_diagnosis_creation(self):
        diagnosis = AnomalyDiagnosis(
            index=0,
            pump_speed=10.0,
            flow_rate=1.5,
            anomaly_type='异常值',
            severity='high',
            description='残差超出正常范围',
            suggested_action='建议复查数据',
            metrics={'z_score': 3.5, 'residual': 2.0}
        )
        
        assert diagnosis.index == 0
        assert diagnosis.pump_speed == 10.0
        assert diagnosis.flow_rate == 1.5
        assert diagnosis.anomaly_type == '异常值'
        assert diagnosis.severity == 'high'
        assert 'z_score' in diagnosis.metrics


class TestAnomalyDetectorInstance:
    def test_singleton_instance(self):
        assert anomaly_detector is not None
        assert isinstance(anomaly_detector, AnomalyDetector)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
