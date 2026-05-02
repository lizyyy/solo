"""核心模块测试用例"""

import pytest
import pandas as pd
import numpy as np
import tempfile
import json
from datetime import datetime, timedelta
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.data_parser import DataParser, TemperatureRecord, DoorEvent, CalibrationRecord, BatchRecord
from app.metrics import MetricsCalculator, TemperatureMetrics, DoorMetrics, BatchExposureMetrics
from app.rules_engine import RulesEngine, RuleConfig, AnomalySegment, AnomalyType, AnomalySeverity
from app.sample_data import SampleDataGenerator
from app.state_store import StateStore
from app.import_export import ReportGenerator, AnomalyCSVExporter, AuditPackageExporter


class TestDataParser:
    """数据解析模块测试"""
    
    def setup_method(self):
        self.parser = DataParser()
        self.tmpdir = tempfile.mkdtemp()
    
    def test_parse_temperature_csv(self):
        """测试温度CSV解析"""
        df = pd.DataFrame({
            'timestamp': [
                '2024-01-01 00:00:00',
                '2024-01-01 00:05:00',
                '2024-01-01 00:10:00'
            ],
            'temperature': [5.0, 5.2, 4.8]
        })
        
        file_path = Path(self.tmpdir) / "test_temp.csv"
        df.to_csv(file_path, index=False)
        
        record = self.parser.parse_temperature_csv(str(file_path), device_id="TEST-001")
        
        assert isinstance(record, TemperatureRecord)
        assert record.device_id == "TEST-001"
        assert len(record.timestamps) == 3
        assert len(record.temperatures) == 3
        assert record.temperatures.iloc[0] == 5.0
    
    def test_parse_door_events_json(self):
        """测试开门事件JSON解析"""
        events_data = {
            'events': [
                {
                    'device_id': 'TEST-001',
                    'event_id': 'door_001',
                    'open_time': '2024-01-01 10:00:00',
                    'close_time': '2024-01-01 10:02:30',
                    'duration_seconds': 150,
                    'event_type': 'door'
                }
            ]
        }
        
        file_path = Path(self.tmpdir) / "test_door.json"
        with open(file_path, 'w') as f:
            json.dump(events_data, f)
        
        events = self.parser.parse_door_events_json(str(file_path))
        
        assert len(events) == 1
        assert isinstance(events[0], DoorEvent)
        assert events[0].device_id == 'TEST-001'
        assert events[0].duration_seconds == 150
    
    def test_parse_calibration_json(self):
        """测试校准证书JSON解析"""
        cal_data = [
            {
                'device_id': 'TEST-001',
                'certificate_id': 'CAL-2024-001',
                'calibration_date': '2024-01-01',
                'offset_value': 0.15,
                'offset_unit': '°C',
                'is_valid': True
            }
        ]
        
        file_path = Path(self.tmpdir) / "test_cal.json"
        with open(file_path, 'w') as f:
            json.dump(cal_data, f)
        
        calibrations = self.parser.parse_calibration_json(str(file_path))
        
        assert len(calibrations) == 1
        assert isinstance(calibrations[0], CalibrationRecord)
        assert calibrations[0].offset_value == 0.15
    
    def test_parse_batch_csv(self):
        """测试批次CSV解析"""
        df = pd.DataFrame({
            'batch_id': ['BATCH-001'],
            'product_name': ['新冠疫苗'],
            'device_id': ['TEST-001'],
            'start_time': ['2024-01-01 08:00:00'],
            'end_time': ['2024-01-01 16:00:00'],
            'quantity': [100]
        })
        
        file_path = Path(self.tmpdir) / "test_batch.csv"
        df.to_csv(file_path, index=False)
        
        batches = self.parser.parse_batch_csv(str(file_path))
        
        assert len(batches) == 1
        assert isinstance(batches[0], BatchRecord)
        assert batches[0].batch_id == 'BATCH-001'
        assert batches[0].quantity == 100


class TestMetricsCalculator:
    """指标计算模块测试"""
    
    def setup_method(self):
        self.calculator = MetricsCalculator()
        self.generator = SampleDataGenerator(base_date=datetime(2024, 1, 1, 0, 0, 0))
    
    def test_calculate_temperature_metrics(self):
        """测试温度指标计算"""
        sample_data = self.generator.generate_temperature_data(
            'TEST-001', duration_hours=24, add_anomalies=True, add_missing=False
        )
        
        timestamps = pd.DatetimeIndex(pd.to_datetime(sample_data['timestamp']))
        temperatures = pd.Series(sample_data['temperature'])
        
        record = TemperatureRecord(
            device_id='TEST-001',
            device_name='TEST-001',
            timestamps=timestamps,
            temperatures=temperatures,
            raw_data=sample_data
        )
        
        metrics = self.calculator.calculate_temperature_metrics(record)
        
        assert isinstance(metrics, TemperatureMetrics)
        assert metrics.device_id == 'TEST-001'
        assert metrics.total_records == len(temperatures)
        assert metrics.valid_records > 0
        assert not np.isnan(metrics.mean_temp)
        assert metrics.min_temp <= metrics.max_temp
    
    def test_calculate_door_metrics(self):
        """测试开门指标计算"""
        events = [
            DoorEvent(
                device_id='TEST-001',
                event_id='door_1',
                open_time=datetime(2024, 1, 1, 10, 0, 0),
                close_time=datetime(2024, 1, 1, 10, 3, 0),
                duration_seconds=180
            ),
            DoorEvent(
                device_id='TEST-001',
                event_id='door_2',
                open_time=datetime(2024, 1, 1, 14, 0, 0),
                close_time=datetime(2024, 1, 1, 14, 1, 0),
                duration_seconds=60
            )
        ]
        
        metrics = self.calculator.calculate_door_metrics('TEST-001', events)
        
        assert isinstance(metrics, DoorMetrics)
        assert metrics.device_id == 'TEST-001'
        assert metrics.total_openings == 2
        assert metrics.total_duration_seconds == 240
        assert metrics.avg_duration_seconds == 120
    
    def test_rank_devices(self):
        """测试设备排行"""
        temp_metrics = {
            'DEV-001': TemperatureMetrics(
                device_id='DEV-001',
                total_records=288,
                valid_records=288,
                missing_records=0,
                min_temp=4.0,
                max_temp=6.0,
                mean_temp=5.0,
                median_temp=5.0,
                std_temp=0.3,
                temp_range=2.0,
                fluctuation_rate=6.0
            ),
            'DEV-002': TemperatureMetrics(
                device_id='DEV-002',
                total_records=288,
                valid_records=250,
                missing_records=38,
                min_temp=1.0,
                max_temp=12.0,
                mean_temp=6.5,
                median_temp=6.0,
                std_temp=3.0,
                temp_range=11.0,
                fluctuation_rate=46.0
            )
        }
        
        door_metrics = {
            'DEV-001': DoorMetrics(
                device_id='DEV-001',
                total_openings=3,
                total_duration_seconds=180,
                avg_duration_seconds=60,
                max_duration_seconds=90,
                min_duration_seconds=30
            ),
            'DEV-002': DoorMetrics(
                device_id='DEV-002',
                total_openings=15,
                total_duration_seconds=1800,
                avg_duration_seconds=120,
                max_duration_seconds=300,
                min_duration_seconds=60,
                long_openings_count=3
            )
        }
        
        anomaly_counts = {'DEV-001': 0, 'DEV-002': 10}
        
        ranking = self.calculator.rank_devices(temp_metrics, door_metrics, anomaly_counts)
        
        assert isinstance(ranking, pd.DataFrame)
        assert len(ranking) == 2
        assert ranking.iloc[0]['device_id'] == 'DEV-001'
        assert ranking.iloc[1]['device_id'] == 'DEV-002'
        assert ranking.iloc[0]['score'] >= ranking.iloc[1]['score']


class TestRulesEngine:
    """规则引擎测试"""
    
    def setup_method(self):
        self.config = RuleConfig(
            upper_temp_threshold=8.0,
            lower_temp_threshold=2.0,
            continuous_overtemp_window_minutes=15,
            continuous_undertemp_window_minutes=15,
            missing_data_threshold_minutes=30,
            rapid_change_threshold=2.0,
            long_door_opening_seconds=180
        )
        self.engine = RulesEngine(self.config)
        self.generator = SampleDataGenerator(base_date=datetime(2024, 1, 1, 0, 0, 0))
    
    def test_detect_threshold_anomalies(self):
        """测试阈值异常检测"""
        base_time = datetime(2024, 1, 1, 0, 0, 0)
        n_points = 60
        timestamps = pd.DatetimeIndex([
            base_time + timedelta(minutes=i) for i in range(n_points)
        ])
        
        temperatures = np.full(n_points, 5.0)
        
        temperatures[10:15] = 9.0
        temperatures[30:35] = 1.0
        
        anomalies = self.engine.detect_threshold_anomalies(
            'TEST-001', timestamps, pd.Series(temperatures)
        )
        
        assert len(anomalies) >= 2
        
        over_anomalies = [a for a in anomalies if a.anomaly_type == AnomalyType.OVER_TEMPERATURE]
        under_anomalies = [a for a in anomalies if a.anomaly_type == AnomalyType.UNDER_TEMPERATURE]
        
        assert len(over_anomalies) >= 1
        assert len(under_anomalies) >= 1
    
    def test_detect_continuous_anomalies(self):
        """测试连续异常检测"""
        base_time = datetime(2024, 1, 1, 0, 0, 0)
        n_points = 60
        timestamps = pd.DatetimeIndex([
            base_time + timedelta(minutes=i) for i in range(n_points)
        ])
        
        temperatures = np.full(n_points, 5.0)
        
        temperatures[10:30] = 9.5
        
        threshold_anomalies = self.engine.detect_threshold_anomalies(
            'TEST-001', timestamps, pd.Series(temperatures)
        )
        
        continuous_anomalies = self.engine.detect_continuous_anomalies(
            'TEST-001', timestamps, pd.Series(temperatures), threshold_anomalies
        )
        
        critical_anomalies = [a for a in continuous_anomalies if a.severity == AnomalySeverity.CRITICAL]
        assert len(critical_anomalies) >= 1
    
    def test_detect_missing_data(self):
        """测试数据缺失检测"""
        base_time = datetime(2024, 1, 1, 0, 0, 0)
        
        timestamps = pd.DatetimeIndex([
            base_time,
            base_time + timedelta(minutes=5),
            base_time + timedelta(minutes=50),
            base_time + timedelta(minutes=55)
        ])
        
        temperatures = pd.Series([5.0, 5.1, 4.9, 5.0])
        
        anomalies = self.engine.detect_missing_data('TEST-001', timestamps, temperatures)
        
        assert len(anomalies) >= 1
        assert anomalies[0].anomaly_type == AnomalyType.MISSING_DATA
    
    def test_detect_long_door_openings(self):
        """测试长时间开门检测"""
        events = [
            DoorEvent(
                device_id='TEST-001',
                event_id='door_1',
                open_time=datetime(2024, 1, 1, 10, 0, 0),
                close_time=datetime(2024, 1, 1, 10, 10, 0),
                duration_seconds=600
            ),
            DoorEvent(
                device_id='TEST-001',
                event_id='door_2',
                open_time=datetime(2024, 1, 1, 14, 0, 0),
                close_time=datetime(2024, 1, 1, 14, 2, 0),
                duration_seconds=120
            )
        ]
        
        anomalies = self.engine.detect_long_door_openings('TEST-001', events)
        
        assert len(anomalies) == 1
        assert anomalies[0].anomaly_type == AnomalyType.DOOR_OPEN_TOO_LONG
        assert anomalies[0].duration_seconds == 600
    
    def test_apply_calibration_offset(self):
        """测试校准偏移应用"""
        base_time = datetime(2024, 1, 1, 0, 0, 0)
        timestamps = pd.DatetimeIndex([
            base_time + timedelta(minutes=i) for i in range(10)
        ])
        temperatures = pd.Series([5.0] * 10)
        
        record = TemperatureRecord(
            device_id='TEST-001',
            device_name='TEST-001',
            timestamps=timestamps,
            temperatures=temperatures,
            raw_data=pd.DataFrame()
        )
        
        calibrations = [
            CalibrationRecord(
                device_id='TEST-001',
                calibration_date=datetime(2024, 1, 1),
                offset_value=0.5,
                certificate_id='CAL-001'
            )
        ]
        
        calibrated_temps, offset = self.engine.apply_calibration_offset(record, calibrations)
        
        assert offset == 0.5
        assert calibrated_temps.iloc[0] == 5.5


class TestStateStore:
    """状态存储测试"""
    
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.store = StateStore(storage_dir=self.tmpdir)
    
    def test_save_and_get_review(self):
        """测试复核记录保存和读取"""
        review_data = {
            'review_reason': '正常操作',
            'review_notes': '取放货操作',
            'reviewed_by': '测试员'
        }
        
        saved_path = self.store.save_review(
            'TEST-ANOMALY-001',
            review_data,
            session_id='test-session'
        )
        
        assert Path(saved_path).exists()
        
        reviews = self.store.get_reviews('TEST-ANOMALY-001')
        assert len(reviews) == 1
        assert reviews[0]['review_reason'] == '正常操作'
    
    def test_save_and_load_config(self):
        """测试配置保存和加载"""
        config_data = {
            'upper_temp_threshold': 8.0,
            'lower_temp_threshold': 2.0,
            'continuous_overtemp_window_minutes': 15
        }
        
        saved_path = self.store.save_config('test_config', config_data)
        assert Path(saved_path).exists()
        
        loaded = self.store.load_config('test_config')
        assert loaded is not None
        assert loaded['config']['upper_temp_threshold'] == 8.0
    
    def test_audit_log(self):
        """测试审计日志"""
        self.store._append_audit_log('test_action', {'detail': 'test'})
        
        logs = self.store.get_audit_logs(
            start_date=datetime.now() - timedelta(days=1),
            end_date=datetime.now()
        )
        
        assert len(logs) >= 1
        assert logs[0]['action'] == 'test_action'


class TestImportExport:
    """导入导出测试"""
    
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.report_gen = ReportGenerator()
        self.csv_exporter = AnomalyCSVExporter()
        self.audit_exporter = AuditPackageExporter()
    
    def test_generate_markdown_report(self):
        """测试Markdown报告生成"""
        analysis_data = {
            'temperature_metrics': {
                'DEV-001': {
                    'device_id': 'DEV-001',
                    'total_records': 288,
                    'valid_records': 288,
                    'missing_records': 0,
                    'min_temp': 4.0,
                    'max_temp': 6.0,
                    'mean_temp': 5.0,
                    'median_temp': 5.0,
                    'std_temp': 0.5,
                    'fluctuation_rate': 10.0
                }
            },
            'door_metrics': {
                'DEV-001': {
                    'device_id': 'DEV-001',
                    'total_openings': 5,
                    'total_duration_seconds': 300,
                    'avg_duration_seconds': 60,
                    'max_duration_seconds': 120,
                    'long_openings_count': 0
                }
            },
            'batch_metrics': {},
            'anomalies': [],
            'door_events': [],
            'reviews': [],
            'config': {
                'upper_temp_threshold': 8.0,
                'lower_temp_threshold': 2.0,
                'continuous_overtemp_window_minutes': 15,
                'continuous_undertemp_window_minutes': 15,
                'missing_data_threshold_minutes': 30,
                'rapid_change_threshold': 2.0,
                'long_door_opening_seconds': 180
            }
        }
        
        report = self.report_gen.generate_markdown_report(analysis_data)
        
        assert isinstance(report, str)
        assert len(report) > 0
        assert '# 疫苗冷链温控偏航复盘报告' in report
        assert '分析概览' in report
    
    def test_csv_exporter(self):
        """测试CSV导出"""
        anomalies = [
            {
                'anomaly_id': 'TEST-001',
                'device_id': 'DEV-001',
                'anomaly_type': 'over_temperature',
                'severity': 'high',
                'start_time': '2024-01-01 10:00:00',
                'end_time': '2024-01-01 10:15:00',
                'duration_seconds': 900,
                'min_value': 8.5,
                'max_value': 10.0,
                'mean_value': 9.2,
                'description': '超温异常',
                'batch_overlaps': ['BATCH-001'],
                'reviewed': False,
                'review_reason': '',
                'review_notes': '',
                'reviewed_by': '',
                'reviewed_at': ''
            }
        ]
        
        df = self.csv_exporter.export_to_dataframe(anomalies)
        
        assert isinstance(df, pd.DataFrame)
        assert len(df) == 1
        assert '异常ID' in df.columns
        assert '设备ID' in df.columns
        assert df.iloc[0]['异常ID'] == 'TEST-001'
    
    def test_audit_package_exporter(self):
        """测试审计包导出"""
        analysis_data = {
            'temperature_metrics': {},
            'door_metrics': {},
            'batch_metrics': {},
            'anomalies': [],
            'door_events': [],
            'reviews': [],
            'config': RuleConfig()
        }
        
        output_path = Path(self.tmpdir) / "audit_package.json"
        
        result_path = self.audit_exporter.export_audit_package(
            analysis_data,
            str(output_path),
            include_raw_data=False
        )
        
        assert Path(result_path).exists()
        
        with open(result_path, 'r') as f:
            package = json.load(f)
        
        assert 'export_metadata' in package
        assert 'analysis_summary' in package
        assert 'anomalies' in package


class TestSampleDataGenerator:
    """示例数据生成测试"""
    
    def setup_method(self):
        self.generator = SampleDataGenerator(base_date=datetime(2024, 1, 1, 0, 0, 0))
        self.tmpdir = tempfile.mkdtemp()
    
    def test_generate_temperature_data(self):
        """测试温度数据生成"""
        df = self.generator.generate_temperature_data(
            'TEST-001',
            duration_hours=24,
            interval_minutes=5,
            add_anomalies=True,
            add_missing=True
        )
        
        assert isinstance(df, pd.DataFrame)
        assert 'timestamp' in df.columns
        assert 'temperature' in df.columns
        assert 'device_id' in df.columns
        
        expected_rows = int((24 * 60) / 5)
        assert len(df) == expected_rows
    
    def test_generate_door_events(self):
        """测试开门事件生成"""
        events = self.generator.generate_door_events('TEST-001', num_events=5)
        
        assert len(events) == 5
        assert 'device_id' in events[0]
        assert 'open_time' in events[0]
        assert 'close_time' in events[0]
        assert events[0]['device_id'] == 'TEST-001'
    
    def test_generate_calibration_records(self):
        """测试校准证书生成"""
        records = self.generator.generate_calibration_records(['DEV-001', 'DEV-002'])
        
        assert len(records) == 2
        assert records[0]['device_id'] == 'DEV-001'
        assert records[1]['device_id'] == 'DEV-002'
        assert 'offset_value' in records[0]
        assert 'certificate_id' in records[0]
    
    def test_generate_all_sample_data(self):
        """测试完整示例数据生成"""
        sample_data = self.generator.generate_all_sample_data(
            device_ids=['DEV-001', 'DEV-002'],
            output_dir=self.tmpdir
        )
        
        assert 'temperature_files' in sample_data
        assert 'door_events' in sample_data
        assert 'calibration_records' in sample_data
        assert 'batch_records' in sample_data
        
        assert len(sample_data['temperature_files']) == 2
        assert isinstance(sample_data['batch_records'], pd.DataFrame)
        
        temp_files = list(Path(self.tmpdir).glob("*_temperature.csv"))
        assert len(temp_files) == 2
        
        door_file = Path(self.tmpdir) / "door_events.json"
        assert door_file.exists()
        
        cal_file = Path(self.tmpdir) / "calibration_records.json"
        assert cal_file.exists()
        
        batch_file = Path(self.tmpdir) / "batch_records.csv"
        assert batch_file.exists()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
