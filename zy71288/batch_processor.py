import uuid
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass

from config import config
from data_models import BatchJob, ProcessingStatus, AnomalyRecord, DataSourceType
from data_import import DataImportManager
from anomaly_detector import AnomalyDetector
from forecast_engine import TimeSeriesForecaster
from report_generator import ReportGenerator

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@dataclass
class BatchResult:
    job_id: str
    status: ProcessingStatus
    start_time: datetime
    end_time: Optional[datetime]
    records_imported: int
    anomalies_detected: int
    forecast_generated: int
    charts_generated: List[str]
    error_message: Optional[str]
    summary: Dict[str, Any]


class BatchProcessor:
    def __init__(self):
        self.active_jobs: Dict[str, BatchJob] = {}
        self.import_manager = DataImportManager()
        self.anomaly_detector = AnomalyDetector()
        self.forecaster = TimeSeriesForecaster()
        self.report_generator = ReportGenerator()
    
    def _create_job_id(self) -> str:
        return f"job_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
    
    def _convert_records_to_dicts(self, records: List[Any]) -> List[Dict[str, Any]]:
        return [r.model_dump() if hasattr(r, 'model_dump') else dict(r) for r in records]
    
    def run_batch(self, 
                  data_dir: Optional[Path] = None,
                  forecast_start_date: Optional[str] = None,
                  forecast_hours: int = 24,
                  run_scenarios: bool = True) -> BatchResult:
        
        job_id = self._create_job_id()
        start_time = datetime.now()
        
        logger.info(f"开始批处理任务 {job_id}")
        
        job = BatchJob(
            job_id=job_id,
            status=ProcessingStatus.PROCESSING,
            start_time=start_time,
            data_sources=[]
        )
        self.active_jobs[job_id] = job
        
        try:
            logger.info("步骤1: 导入数据...")
            import_results = self.import_manager.import_all_from_directory(data_dir)
            
            source_type_mapping = {
                'reservation': DataSourceType.RESERVATIONS,
                'reservations': DataSourceType.RESERVATIONS,
                'weather': DataSourceType.WEATHER,
                'event': DataSourceType.EVENTS,
                'events': DataSourceType.EVENTS,
                'historical': DataSourceType.HISTORICAL,
                'history': DataSourceType.HISTORICAL,
                'capacity': DataSourceType.CAPACITY,
                'capacities': DataSourceType.CAPACITY
            }
            
            job.data_sources = []
            for source_name in import_results['by_source'].keys():
                for keyword, source_type in source_type_mapping.items():
                    if keyword in source_name:
                        if source_type not in job.data_sources:
                            job.data_sources.append(source_type)
                        break
            
            if import_results['total_records'] == 0:
                raise ValueError("未成功导入任何数据，请检查数据源文件")
            
            imported_data = {
                k: self._convert_records_to_dicts(v)
                for k, v in self.import_manager.imported_records.items()
                if v
            }
            
            job.anomalies.extend(self.import_manager.anomalies)
            
            logger.info("步骤2: 数据异常检测...")
            if imported_data.get('weather'):
                weather_anomalies = self.anomaly_detector.detect_weather_anomalies(
                    imported_data['weather']
                )
                job.anomalies.extend(weather_anomalies)
            
            if imported_data.get('events'):
                event_anomalies = self.anomaly_detector.detect_event_anomalies(
                    imported_data['events']
                )
                job.anomalies.extend(event_anomalies)
            
            data_integrity_anomalies = self.anomaly_detector.detect_data_integrity_issues({
                k: len(v) for k, v in imported_data.items()
            })
            job.anomalies.extend(data_integrity_anomalies)
            
            if not imported_data.get('historical'):
                raise ValueError("缺少历史客流数据，无法进行预测")
            
            logger.info("步骤3: 训练预测模型...")
            model_info = self.forecaster.train(
                historical_data=imported_data['historical'],
                weather_data=imported_data.get('weather'),
                event_data=imported_data.get('events'),
                reservation_data=imported_data.get('reservations')
            )
            
            logger.info("步骤4: 生成客流预测...")
            if run_scenarios:
                scenario_predictions = self.forecaster.predict_with_scenarios(
                    weather_data=imported_data.get('weather'),
                    event_data=imported_data.get('events'),
                    reservation_data=imported_data.get('reservations'),
                    start_date=forecast_start_date,
                    forecast_hours=forecast_hours
                )
                base_predictions = scenario_predictions['base']
            else:
                base_predictions = self.forecaster.predict(
                    weather_data=imported_data.get('weather'),
                    event_data=imported_data.get('events'),
                    reservation_data=imported_data.get('reservations'),
                    start_date=forecast_start_date,
                    forecast_hours=forecast_hours,
                    scenario="base"
                )
                scenario_predictions = {'base': base_predictions}
            
            logger.info("步骤5: 容量预警检测...")
            capacity_warnings = self.anomaly_detector.detect_capacity_warnings(
                base_predictions,
                imported_data.get('capacity', [])
            )
            job.anomalies.extend(capacity_warnings)
            
            logger.info("步骤6: 误差分析（回看）...")
            error_metrics = self.forecaster.calculate_error_metrics(
                imported_data['historical'],
                base_predictions
            )
            
            backtest_data = self.forecaster.get_backtest_data()
            
            logger.info("步骤7: 生成报告和图表...")
            report_summary = self.report_generator.generate_full_report(
                forecast_results=base_predictions,
                scenario_results=scenario_predictions,
                historical_data=imported_data.get('historical'),
                error_metrics=error_metrics,
                anomalies=job.anomalies,
                model_info=model_info,
                backtest_data=backtest_data
            )
            
            logger.info("步骤8: 保存处理后数据...")
            self.import_manager.save_processed_data()
            
            has_errors = any(a.severity == 'error' for a in job.anomalies)
            has_warnings = any(a.severity == 'warning' for a in job.anomalies)
            
            if has_errors:
                job.status = ProcessingStatus.ERROR
            elif has_warnings:
                job.status = ProcessingStatus.WARNING
            else:
                job.status = ProcessingStatus.SUCCESS
            
            end_time = datetime.now()
            job.end_time = end_time
            
            job.results_summary = {
                "imported_records": import_results['total_records'],
                "anomalies_detected": len(job.anomalies),
                "forecast_hours": forecast_hours,
                "error_metrics": error_metrics,
                "model_info": model_info,
                "report_summary": report_summary,
                "anomaly_summary": self.anomaly_detector.get_anomaly_summary(),
                "scenario_predictions": {
                    k: [p.model_dump() for p in v]
                    for k, v in scenario_predictions.items()
                },
                "base_predictions": [p.model_dump() for p in base_predictions]
            }
            
            self._save_job_result(job)
            
            logger.info(f"批处理任务 {job_id} 完成，状态: {job.status}")
            
            return BatchResult(
                job_id=job_id,
                status=job.status,
                start_time=start_time,
                end_time=end_time,
                records_imported=import_results['total_records'],
                anomalies_detected=len(job.anomalies),
                forecast_generated=len(base_predictions),
                charts_generated=list(report_summary['charts'].values()),
                error_message=job.error_message,
                summary=job.results_summary
            )
        
        except Exception as e:
            logger.error(f"批处理任务失败: {str(e)}", exc_info=True)
            end_time = datetime.now()
            
            job.status = ProcessingStatus.ERROR
            job.end_time = end_time
            job.error_message = str(e)
            
            self._save_job_result(job)
            
            return BatchResult(
                job_id=job_id,
                status=ProcessingStatus.ERROR,
                start_time=start_time,
                end_time=end_time,
                records_imported=import_results.get('total_records', 0) if 'import_results' in locals() else 0,
                anomalies_detected=len(job.anomalies),
                forecast_generated=0,
                charts_generated=[],
                error_message=str(e),
                summary={"error": str(e)}
            )
    
    def _save_job_result(self, job: BatchJob):
        job_file = config.LOG_DIR / f"job_{job.job_id}.json"
        with open(job_file, 'w', encoding='utf-8') as f:
            json.dump(job.model_dump(), f, ensure_ascii=False, indent=2, default=str)
        logger.info(f"任务结果已保存: {job_file}")
    
    def get_job_status(self, job_id: str) -> Optional[BatchJob]:
        return self.active_jobs.get(job_id)
    
    def check_duplicate_submission(self, data_dir: Path) -> bool:
        """检查是否重复提交（基于文件内容哈希）"""
        import hashlib
        
        if not data_dir.exists():
            return False
        
        hasher = hashlib.md5()
        for file_path in sorted(data_dir.glob('*.csv')):
            with open(file_path, 'rb') as f:
                hasher.update(f.read())
        
        current_hash = hasher.hexdigest()
        
        hash_file = config.LOG_DIR / "last_submission_hash.txt"
        if hash_file.exists():
            last_hash = hash_file.read_text().strip()
            if current_hash == last_hash:
                return True
        
        hash_file.write_text(current_hash)
        return False


def main():
    import sys
    
    data_dir = sys.argv[1] if len(sys.argv) > 1 else None
    forecast_hours = int(sys.argv[2]) if len(sys.argv) > 2 else 24
    start_date = sys.argv[3] if len(sys.argv) > 3 else None
    
    processor = BatchProcessor()
    
    if data_dir:
        data_path = Path(data_dir)
        if processor.check_duplicate_submission(data_path):
            logger.warning("检测到重复提交，数据未发生变化")
            response = input("是否继续处理? (y/n): ")
            if response.lower() != 'y':
                logger.info("用户取消处理")
                return
    
    result = processor.run_batch(
        data_dir=Path(data_dir) if data_dir else None,
        forecast_start_date=start_date,
        forecast_hours=forecast_hours,
        run_scenarios=True
    )
    
    print("\n" + "="*60)
    print("批处理任务完成")
    print("="*60)
    print(f"任务ID: {result.job_id}")
    print(f"状态: {result.status}")
    print(f"开始时间: {result.start_time}")
    print(f"结束时间: {result.end_time}")
    print(f"导入记录数: {result.records_imported}")
    print(f"检测异常数: {result.anomalies_detected}")
    print(f"生成预测数: {result.forecast_generated}")
    print(f"生成图表数: {len(result.charts_generated)}")
    
    if result.error_message:
        print(f"错误信息: {result.error_message}")
    
    print("\n生成的图表:")
    for chart in result.charts_generated:
        print(f"  - {chart}")
    
    if result.status in [ProcessingStatus.WARNING, ProcessingStatus.ERROR]:
        print("\n异常提示:")
        anomalies = result.summary.get('anomaly_summary', {}).get('details', [])
        for anomaly in anomalies[:5]:
            print(f"  [{anomaly['severity']}] {anomaly['message']}")
            print(f"    建议: {anomaly['suggestion']}")
    
    print("="*60)


if __name__ == "__main__":
    main()
