import os
import tempfile
import unittest
from datetime import datetime
from ferment_calibrator.exporter import (
    MarkdownExporter,
    CSVExporter,
    JSONAuditExporter,
    export_all
)


class TestMarkdownExporter(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.exporter = MarkdownExporter()
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_generate_markdown_report(self):
        batch_info = {
            'batch_id': 'B20240501',
            'strain': 'Saccharomyces cerevisiae',
            'start_time': '2024-05-01 08:00:00',
            'end_time': '2024-05-02 00:00:00',
            'duration_hours': 16.0,
            'total_records': 34,
            'valid_records': 34,
            'quarantined_records': 0
        }
        
        metrics = {
            'growth_metrics': {
                'max_growth_rate': 0.25,
                'lag_phase_duration': 2.5,
                'doubling_time': 2.77,
                'final_od600': 0.58
            },
            'feed_metrics': {
                'feed_changes': [
                    {
                        'feed_time': '2024-05-01 14:00:00',
                        'feed_recipe': 'feedA',
                        'ph_before': 5.0,
                        'ph_after': 5.1,
                        'ph_change': 0.1
                    }
                ],
                'total_feed_amount': 125.0,
                'feed_count': 2
            },
            'do_metrics': {
                'drop_intervals': [
                    {'start_hour': 10.5, 'end_hour': 14.0, 'drop_rate': -5.0}
                ],
                'total_drop_duration': 3.5,
                'max_drop_rate': -5.0,
                'low_do_periods': [{'start_hour': 12.0, 'end_hour': 14.0, 'min_do': 53.0}]
            }
        }
        
        phases = {
            'segments': [
                {
                    'phase': 'lag',
                    'start_time': '2024-05-01 08:00:00',
                    'end_time': '2024-05-01 10:30:00',
                    'start_od': 0.1,
                    'end_od': 0.15,
                    'growth_rate': 0.05,
                    'duration_hours': 2.5
                }
            ]
        }
        
        risks = {
            'risks': [
                {
                    'risk_type': 'contamination',
                    'risk_type_name': '污染风险',
                    'severity': 'high',
                    'severity_name': '高',
                    'description': '检测到pH快速下降',
                    'evidence': {'ph_drop_rate': -0.3}
                }
            ],
            'summary': {'total_risks': 1, 'by_severity': {'high': 1}}
        }
        
        review_stats = {
            'total_risks': 1,
            'by_status': {'pending': 1}
        }
        
        config_snapshot = {
            'sensor_calibration': {'pH': {'offset': 0.0, 'slope': 1.0}},
            'anomaly_thresholds': {'temperature': {'min': 20.0, 'max': 40.0}}
        }
        
        md = self.exporter.generate_markdown_report(
            batch_info, metrics, phases, risks, review_stats, config_snapshot
        )
        
        self.assertIsInstance(md, str)
        self.assertIn('# 发酵实验复盘报告', md)
        self.assertIn('## 批次基本信息', md)
        self.assertIn('## 生长指标分析', md)
        self.assertIn('## 补料记录分析', md)
        self.assertIn('## 阶段切分结果', md)
        self.assertIn('## 风险检测', md)
        self.assertIn('## 人工复核', md)
        self.assertIn('## 配置快照', md)
    
    def test_export_markdown(self):
        output_path = os.path.join(self.temp_dir, 'report.md')
        
        batch_info = {
            'batch_id': 'B20240501',
            'strain': 'Saccharomyces cerevisiae',
            'start_time': '2024-05-01 08:00:00',
            'end_time': '2024-05-02 00:00:00',
            'duration_hours': 16.0,
            'total_records': 34,
            'valid_records': 34,
            'quarantined_records': 0
        }
        
        metrics = {
            'growth_metrics': {
                'max_growth_rate': 0.25,
                'lag_phase_duration': 2.5,
                'doubling_time': 2.77,
                'final_od600': 0.58
            },
            'feed_metrics': {'feed_changes': [], 'total_feed_amount': 0, 'feed_count': 0},
            'do_metrics': {
                'drop_intervals': [],
                'total_drop_duration': 0,
                'max_drop_rate': 0,
                'low_do_periods': []
            }
        }
        
        phases = {'segments': []}
        risks = {'risks': [], 'summary': {'total_risks': 0}}
        review_stats = {'total_risks': 0}
        config_snapshot = {}
        
        path = self.exporter.export_markdown(
            batch_info, metrics, phases, risks, review_stats, config_snapshot, output_path
        )
        
        self.assertEqual(path, output_path)
        self.assertTrue(os.path.exists(output_path))
        
        with open(output_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        self.assertIn('# 发酵实验复盘报告', content)


class TestCSVExporter(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.exporter = CSVExporter()
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_export_csv(self):
        output_path = os.path.join(self.temp_dir, 'metrics.csv')
        
        batch_info = {
            'batch_id': 'B20240501',
            'strain': 'Saccharomyces cerevisiae'
        }
        
        metrics = {
            'growth_metrics': {
                'max_growth_rate': 0.25,
                'lag_phase_duration': 2.5,
                'doubling_time': 2.77,
                'final_od600': 0.58
            },
            'feed_metrics': {
                'total_feed_amount': 125.0,
                'feed_count': 2
            },
            'do_metrics': {
                'total_drop_duration': 3.5,
                'max_drop_rate': -5.0
            },
            'summary': {
                'experiment_duration_hours': 16.0
            }
        }
        
        risks = {
            'summary': {
                'total_risks': 1
            }
        }
        
        path = self.exporter.export_csv(batch_info, metrics, risks, output_path)
        
        self.assertEqual(path, output_path)
        self.assertTrue(os.path.exists(output_path))
        
        with open(output_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        self.assertIn('batch_id', content)
        self.assertIn('strain', content)
        self.assertIn('max_growth_rate', content)
        self.assertIn('lag_phase_duration', content)
        self.assertIn('doubling_time', content)
        self.assertIn('final_od600', content)


class TestJSONAuditExporter(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.exporter = JSONAuditExporter()
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_export_audit(self):
        output_path = os.path.join(self.temp_dir, 'audit.json')
        
        batch_info = {
            'batch_id': 'B20240501',
            'strain': 'Saccharomyces cerevisiae',
            'export_time': '2024-05-02 10:00:00'
        }
        
        config_snapshot = {
            'sensor_calibration': {'pH': {'offset': 0.0}},
            'anomaly_thresholds': {'temperature': {'min': 20.0}}
        }
        
        metrics = {
            'growth_metrics': {'max_growth_rate': 0.25},
            'feed_metrics': {'feed_count': 2},
            'do_metrics': {'total_drop_duration': 3.5}
        }
        
        phases = {
            'segments': [
                {'phase': 'lag', 'start_time': '2024-05-01 08:00:00'}
            ]
        }
        
        risks = {
            'risks': [
                {'risk_type': 'contamination', 'severity': 'high'}
            ],
            'summary': {'total_risks': 1}
        }
        
        reviews = {
            'reviews': [
                {'risk_id': 'risk_001', 'status': 'confirmed'}
            ],
            'statistics': {'total_risks': 1}
        }
        
        quarantine = {
            'quarantined_records': [],
            'statistics': {'total_quarantined': 0}
        }
        
        import_stats = {
            'total_files': 1,
            'total_records': 34,
            'valid_records': 34,
            'quarantined_records': 0
        }
        
        path = self.exporter.export_audit(
            batch_info, config_snapshot, metrics, phases, risks, reviews,
            quarantine, import_stats, output_path
        )
        
        self.assertEqual(path, output_path)
        self.assertTrue(os.path.exists(output_path))
        
        import json
        with open(output_path, 'r', encoding='utf-8') as f:
            content = json.load(f)
        
        self.assertIn('batch_info', content)
        self.assertIn('config_snapshot', content)
        self.assertIn('metrics', content)
        self.assertIn('phases', content)
        self.assertIn('risks', content)
        self.assertIn('reviews', content)
        self.assertIn('quarantine', content)
        self.assertIn('import_statistics', content)
        self.assertIn('export_metadata', content)


class TestExportAll(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_export_all(self):
        batch_info = {
            'batch_id': 'B20240501',
            'strain': 'Saccharomyces cerevisiae',
            'start_time': '2024-05-01 08:00:00',
            'end_time': '2024-05-02 00:00:00',
            'duration_hours': 16.0,
            'total_records': 34,
            'valid_records': 34,
            'quarantined_records': 0
        }
        
        metrics = {
            'growth_metrics': {
                'max_growth_rate': 0.25,
                'lag_phase_duration': 2.5,
                'doubling_time': 2.77,
                'final_od600': 0.58
            },
            'feed_metrics': {'feed_changes': [], 'total_feed_amount': 0, 'feed_count': 0},
            'do_metrics': {
                'drop_intervals': [],
                'total_drop_duration': 0,
                'max_drop_rate': 0,
                'low_do_periods': []
            },
            'summary': {'experiment_duration_hours': 16.0}
        }
        
        phases = {'segments': []}
        risks = {'risks': [], 'summary': {'total_risks': 0}}
        review_stats = {'total_risks': 0}
        config_snapshot = {}
        reviews = {'reviews': [], 'statistics': {'total_risks': 0}}
        quarantine = {'quarantined_records': [], 'statistics': {'total_quarantined': 0}}
        import_stats = {'total_files': 1, 'total_records': 34}
        
        result = export_all(
            self.temp_dir, 'B20240501', batch_info, metrics, phases, risks,
            review_stats, config_snapshot, reviews, quarantine, import_stats
        )
        
        self.assertIn('markdown', result)
        self.assertIn('csv', result)
        self.assertIn('json', result)
        
        self.assertTrue(os.path.exists(result['markdown']))
        self.assertTrue(os.path.exists(result['csv']))
        self.assertTrue(os.path.exists(result['json']))


if __name__ == '__main__':
    unittest.main()
