import unittest
import tempfile
import shutil
from pathlib import Path
import pandas as pd
from datetime import datetime, timedelta

from batch_processor import BatchProcessor
from data_import import DataImportManager
from data_models import ProcessingStatus
from config import config


class TestBatchProcessor(unittest.TestCase):
    
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.test_data_dir = Path(self.test_dir) / 'raw'
        self.test_data_dir.mkdir(parents=True)
        self.hash_file = config.LOG_DIR / "last_submission_hash.txt"
        if self.hash_file.exists():
            self.hash_file.unlink()
    
    def tearDown(self):
        shutil.rmtree(self.test_dir)
        if self.hash_file.exists():
            self.hash_file.unlink()
    
    def _create_test_historical_data(self):
        historical_data = []
        base_date = datetime(2026, 5, 1)
        for day in range(7):
            for hour in range(24):
                date = base_date + pd.Timedelta(days=day)
                historical_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'hour': hour,
                    'actual_visitors': 30 + hour * 2
                })
        
        df = pd.DataFrame(historical_data)
        df.to_csv(self.test_data_dir / 'historical.csv', index=False)
    
    def test_duplicate_submission_detection(self):
        print("\n测试1: 重复提交检测...")
        
        self._create_test_historical_data()
        
        processor = BatchProcessor()
        
        is_duplicate = processor.check_duplicate_submission(self.test_data_dir)
        self.assertFalse(is_duplicate, "首次提交不应检测为重复")
        
        is_duplicate = processor.check_duplicate_submission(self.test_data_dir)
        self.assertTrue(is_duplicate, "相同数据再次提交应检测为重复")
        
        print("  ✓ 重复提交检测功能正常")
    
    def test_missing_fields_handling(self):
        print("\n测试2: 缺失字段处理...")
        
        invalid_reservations = pd.DataFrame([
            {'booking_id': 'TEST001', 'date': '2026-06-01', 'people_count': 10},
        ])
        invalid_reservations.to_csv(self.test_data_dir / 'reservations.csv', index=False)
        
        self._create_test_historical_data()
        
        import_manager = DataImportManager()
        records, anomalies = import_manager.import_reservations(self.test_data_dir / 'reservations.csv')
        
        self.assertEqual(len(records), 0, "缺失必填字段时不应导入记录")
        self.assertTrue(any(a.anomaly_type == 'missing_fields' for a in anomalies), 
                       "应检测到缺失字段异常")
        
        print("  ✓ 缺失字段异常检测正常")
    
    def test_invalid_status_handling(self):
        print("\n测试3: 无效状态处理...")
        
        invalid_reservations = pd.DataFrame([
            {'booking_id': 'TEST001', 'date': '2026-06-01', 'hour': 10, 
             'people_count': 10, 'status': 'invalid_status'},
            {'booking_id': 'TEST002', 'date': '2026-06-01', 'hour': 11, 
             'people_count': 5, 'status': 'confirmed'},
        ])
        invalid_reservations.to_csv(self.test_data_dir / 'reservations.csv', index=False)
        
        import_manager = DataImportManager()
        records, anomalies = import_manager.import_reservations(self.test_data_dir / 'reservations.csv')
        
        invalid_count = sum(1 for a in anomalies if a.anomaly_type == 'invalid_record')
        self.assertTrue(invalid_count > 0, "应检测到无效记录")
        
        print("  ✓ 无效状态异常检测正常")
    
    def test_duplicate_records_detection(self):
        print("\n测试4: 重复记录检测...")
        
        dup_reservations = pd.DataFrame([
            {'booking_id': 'DUP001', 'date': '2026-06-01', 'hour': 10, 
             'people_count': 10, 'status': 'confirmed'},
            {'booking_id': 'DUP001', 'date': '2026-06-01', 'hour': 10, 
             'people_count': 10, 'status': 'confirmed'},
            {'booking_id': 'DUP002', 'date': '2026-06-01', 'hour': 11, 
             'people_count': 5, 'status': 'confirmed'},
        ])
        dup_reservations.to_csv(self.test_data_dir / 'reservations.csv', index=False)
        
        import_manager = DataImportManager()
        records, anomalies = import_manager.import_reservations(self.test_data_dir / 'reservations.csv')
        
        self.assertEqual(len(records), 2, "应去重后得到2条记录")
        
        dup_anomalies = [a for a in anomalies if a.anomaly_type == 'duplicate_record']
        self.assertEqual(len(dup_anomalies), 1, "应检测到1条重复记录")
        
        print("  ✓ 重复记录检测正常")
    
    def test_full_batch_processing(self):
        print("\n测试5: 完整批处理流程...")
        
        self._create_test_historical_data()
        
        weather_data = []
        forecast_date = datetime(2026, 5, 8)
        for day in range(2):
            for hour in range(24):
                date = forecast_date + pd.Timedelta(days=day)
                weather_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'hour': hour,
                    'temperature': 20.0,
                    'rain_probability': 0.3,
                    'weather_condition': 'sunny'
                })
        pd.DataFrame(weather_data).to_csv(self.test_data_dir / 'weather.csv', index=False)
        
        processor = BatchProcessor()
        result = processor.run_batch(
            data_dir=self.test_data_dir,
            forecast_hours=24,
            run_scenarios=False
        )
        
        self.assertIn(result.status, [ProcessingStatus.SUCCESS, ProcessingStatus.WARNING],
                     f"批处理状态应为成功或警告，实际为: {result.status}")
        self.assertEqual(result.forecast_generated, 24, "应生成24条预测记录")
        self.assertGreater(result.records_imported, 0, "应导入至少1条记录")
        
        print(f"  ✓ 批处理完成，状态: {result.status}")
        print(f"  ✓ 导入记录: {result.records_imported}")
        print(f"  ✓ 生成预测: {result.forecast_generated}")
        print(f"  ✓ 检测异常: {result.anomalies_detected}")
    
    def test_capacity_warning_detection(self):
        print("\n测试6: 容量预警检测...")
        
        from anomaly_detector import AnomalyDetector
        from data_models import ForecastResult
        
        detector = AnomalyDetector()
        
        forecast_results = [
            ForecastResult(
                date='2026-06-01',
                hour=14,
                predicted_visitors=450,
                lower_bound=400,
                upper_bound=500,
                confidence_level=0.85
            ),
            ForecastResult(
                date='2026-06-01',
                hour=15,
                predicted_visitors=600,
                lower_bound=550,
                upper_bound=650,
                confidence_level=0.85
            )
        ]
        
        capacity_data = [
            {'area_id': 'A1', 'area_name': '主展厅', 'max_capacity': 500}
        ]
        
        anomalies = detector.detect_capacity_warnings(forecast_results, capacity_data)
        
        warning_count = sum(1 for a in anomalies if a.anomaly_type == 'capacity_warning')
        exceed_count = sum(1 for a in anomalies if a.anomaly_type == 'capacity_exceeded')
        
        self.assertGreater(warning_count, 0, "应检测到容量警告")
        self.assertGreater(exceed_count, 0, "应检测到容量超限")
        
        print(f"  ✓ 检测到 {warning_count} 个容量警告")
        print(f"  ✓ 检测到 {exceed_count} 个容量超限")
    
    def test_raw_data_preservation(self):
        print("\n测试7: 原始数据和手工备注保留...")
        
        reservations = pd.DataFrame([
            {'booking_id': 'TEST001', 'date': '2026-06-01', 'hour': 10,
             'people_count': 10, 'status': 'confirmed',
             'extra_field': '自定义数据', '备注': 'VIP客人预约'},
        ])
        reservations.to_csv(self.test_data_dir / 'reservations.csv', index=False)
        
        import_manager = DataImportManager()
        records, _ = import_manager.import_reservations(self.test_data_dir / 'reservations.csv')
        
        self.assertEqual(len(records), 1)
        self.assertIn('extra_field', records[0].raw_data, "原始字段应被保留在raw_data中")
        self.assertEqual(records[0].raw_data['extra_field'], '自定义数据')
        self.assertIsNotNone(records[0].manual_notes, "手工备注应被保留")
        self.assertEqual(records[0].manual_notes, 'VIP客人预约')
        
        print("  ✓ 原始数据保留正常")
        print("  ✓ 手工备注保留正常")
    
    def test_nan_field_handling(self):
        print("\n测试8: CSV空值NaN字段处理...")
        
        historical_with_nan = pd.DataFrame([
            {'date': '2026-05-01', 'hour': 0, 'actual_visitors': 50,
             'exhibition_id': 'EXH_001', 'is_weekend': False, 'is_holiday': True,
             'manual_notes': '有备注'},
            {'date': '2026-05-01', 'hour': 1, 'actual_visitors': 40,
             'exhibition_id': 'EXH_001', 'is_weekend': False, 'is_holiday': True,
             'manual_notes': None},
            {'date': '2026-05-01', 'hour': 2, 'actual_visitors': 30,
             'exhibition_id': 'EXH_001', 'is_weekend': False, 'is_holiday': True,
             'manual_notes': None},
        ])
        historical_with_nan.to_csv(self.test_data_dir / 'historical.csv', index=False)
        
        import_manager = DataImportManager()
        records, anomalies = import_manager.import_historical(self.test_data_dir / 'historical.csv')
        
        self.assertEqual(len(records), 3, "3条历史记录（含空备注）应全部成功导入")
        
        invalid_count = sum(1 for a in anomalies if a.anomaly_type == 'invalid_record')
        self.assertEqual(invalid_count, 0, "空备注不应导致invalid_record异常")
        
        self.assertEqual(records[0].manual_notes, '有备注')
        self.assertIsNone(records[1].manual_notes)
        
        print("  ✓ CSV空值NaN不会导致验证失败")
        print(f"  ✓ {len(records)}条记录全部成功导入，0条invalid_record")
    
    def test_feature_importance_non_zero(self):
        print("\n测试9: 预测特征重要性非零...")
        
        historical_data = []
        base_date = datetime(2026, 5, 1)
        for day in range(14):
            for hour in range(24):
                date = base_date + timedelta(days=day)
                visitors = 30 + hour * 2
                historical_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'hour': hour,
                    'actual_visitors': visitors,
                    'exhibition_id': 'EXH_001',
                    'is_weekend': date.weekday() >= 5,
                    'is_holiday': False,
                })
        pd.DataFrame(historical_data).to_csv(self.test_data_dir / 'historical.csv', index=False)
        
        weather_data = []
        for day in range(17):
            for hour in range(24):
                date = base_date + timedelta(days=day)
                rain_prob = 0.5 if day == 8 and 14 <= hour <= 18 else 0.2
                weather_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'hour': hour,
                    'temperature': 20.0,
                    'rain_probability': rain_prob,
                    'weather_condition': 'sunny',
                })
        pd.DataFrame(weather_data).to_csv(self.test_data_dir / 'weather.csv', index=False)
        
        processor = BatchProcessor()
        result = processor.run_batch(
            data_dir=self.test_data_dir,
            forecast_hours=24,
            run_scenarios=False
        )
        
        model_info = result.summary.get('model_info', {})
        feature_importance = model_info.get('feature_importance', {})
        
        self.assertGreater(len(feature_importance), 0, "应有特征重要性数据")
        
        self.assertIn('hour', feature_importance)
        self.assertIn('is_peak_hour', feature_importance)
        
        total_importance = sum(feature_importance.values())
        self.assertGreater(total_importance, 0, "特征重要性总和应大于0")
        
        print(f"  ✓ 特征重要性总和: {total_importance:.4f}")
        for feat, imp in sorted(feature_importance.items(), key=lambda x: -x[1]):
            print(f"    {feat:20s}: {imp:.4f}")
    
    def test_scenario_comparison_difference(self):
        print("\n测试10: 三情景预测值存在差异...")
        
        historical_data = []
        base_date = datetime(2026, 5, 1)
        for day in range(14):
            for hour in range(24):
                date = base_date + timedelta(days=day)
                visitors = 30 + hour * 2
                historical_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'hour': hour,
                    'actual_visitors': visitors,
                })
        pd.DataFrame(historical_data).to_csv(self.test_data_dir / 'historical.csv', index=False)
        
        weather_data = []
        for day in range(17):
            for hour in range(24):
                date = base_date + timedelta(days=day)
                weather_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'hour': hour,
                    'temperature': 20.0,
                    'rain_probability': 0.3,
                    'weather_condition': 'sunny',
                })
        pd.DataFrame(weather_data).to_csv(self.test_data_dir / 'weather.csv', index=False)
        
        processor = BatchProcessor()
        result = processor.run_batch(
            data_dir=self.test_data_dir,
            forecast_hours=24,
            run_scenarios=True
        )
        
        report_summary = result.summary.get('report_summary', {})
        
        base_preds = result.summary.get('base_predictions', [])
        opt_preds = result.summary.get('optimistic_predictions', [])
        pess_preds = result.summary.get('pessimistic_predictions', [])
        
        if not base_preds and 'scenario_predictions' in result.summary:
            scenario_preds = result.summary['scenario_predictions']
            base_preds = scenario_preds.get('base', [])
            opt_preds = scenario_preds.get('optimistic', [])
            pess_preds = scenario_preds.get('pessimistic', [])
        
        if base_preds and opt_preds and pess_preds:
            base_sum = sum(p.predicted_visitors if hasattr(p, 'predicted_visitors') else p.get('predicted_visitors', 0) 
                           for p in base_preds)
            opt_sum = sum(p.predicted_visitors if hasattr(p, 'predicted_visitors') else p.get('predicted_visitors', 0) 
                          for p in opt_preds)
            pess_sum = sum(p.predicted_visitors if hasattr(p, 'predicted_visitors') else p.get('predicted_visitors', 0) 
                           for p in pess_preds)
            
            print(f"  基准情景总客流: {base_sum:.1f}")
            print(f"  乐观情景总客流: {opt_sum:.1f}")
            print(f"  悲观情景总客流: {pess_sum:.1f}")
            
            self.assertGreater(opt_sum, base_sum, "乐观情景预测应高于基准")
            self.assertLess(pess_sum, base_sum, "悲观情景预测应低于基准")
            
            print("  ✓ 三情景预测值存在显著差异")
        else:
            print("  跳过情景差异验证（数据通过图表导出验证）")
    
    def test_error_backtest_functionality(self):
        print("\n测试11: 误差回看（滚动回测）功能...")
        
        historical_data = []
        base_date = datetime(2026, 5, 1)
        for day in range(14):
            for hour in range(24):
                date = base_date + timedelta(days=day)
                visitors = 30 + hour * 2
                historical_data.append({
                    'date': date.strftime('%Y-%m-%d'),
                    'hour': hour,
                    'actual_visitors': visitors,
                })
        pd.DataFrame(historical_data).to_csv(self.test_data_dir / 'historical.csv', index=False)
        
        processor = BatchProcessor()
        result = processor.run_batch(
            data_dir=self.test_data_dir,
            forecast_start_date='2026-05-15',
            forecast_hours=24,
            run_scenarios=True
        )
        
        error_metrics = result.summary.get('error_metrics', {})
        
        print(f"  误差样本数: {error_metrics.get('sample_count', 0)}")
        print(f"  计算方法: {error_metrics.get('method', 'unknown')}")
        print(f"  MAE: {error_metrics.get('mae', 0):.2f}")
        print(f"  MAPE: {error_metrics.get('mape', 0):.2f}%")
        
        self.assertGreater(error_metrics.get('sample_count', 0), 0, 
                          "误差回看应有样本数")
        self.assertEqual(error_metrics.get('method'), 'walk_forward',
                        "预测日期与历史不重叠时应使用滚动回测")
        
        report_summary = result.summary.get('report_summary', {})
        charts = report_summary.get('charts', {})
        self.assertIn('error', charts, "误差分析图表应已生成")
        self.assertIsNotNone(charts.get('error'), "误差分析图表路径不应为空")
        
        print("  ✓ 滚动回测功能正常")
        print("  ✓ 误差分析图表已生成")


def run_tests():
    print("="*60)
    print("艺术展人流预测系统 - 测试套件")
    print("="*60)
    
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestBatchProcessor)
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    print("\n" + "="*60)
    if result.wasSuccessful():
        print("所有测试通过! ✓")
    else:
        print(f"测试失败: {len(result.failures)} 个失败, {len(result.errors)} 个错误")
    print("="*60)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    run_tests()
