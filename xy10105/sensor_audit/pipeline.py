"""
主流水线模块
整合所有模块，提供完整的审计流程
"""
from typing import Dict, Optional, List
from pathlib import Path
import json
from datetime import datetime
import pandas as pd

from .config import AuditConfig, ConfigManager
from .data_loader import DataLoader, LoadedData
from .quality_control import QualityController, QCResult
from .drift_calibration import DriftDetector, Calibrator, DriftResult, CalibrationResult
from .report_generator import ReportGenerator


class AuditPipeline:
    """
    审计流水线
    整合数据加载、质控、漂移检测、校准和报告生成
    """
    
    def __init__(self, config: Optional[AuditConfig] = None, config_file: Optional[str] = None):
        if config_file:
            config_manager = ConfigManager()
            self.config = config_manager.load_from_file(config_file)
        else:
            self.config = config or AuditConfig()
        
        self.data_loader = DataLoader(self.config)
        self.quality_controller = QualityController(self.config)
        self.drift_detector = DriftDetector(self.config)
        self.calibrator = Calibrator(self.config)
        self.report_generator = ReportGenerator(self.config)
        
        self.results: Dict = {}
        self._timestamps: Dict[str, datetime] = {}
    
    def run(
        self,
        input_file: str,
        output_prefix: str = 'audit_report',
        reference_sensor_id: Optional[str] = None
    ) -> Dict:
        self._timestamps['start'] = datetime.now()
        print(f"[{self._timestamps['start'].strftime('%H:%M:%S')}] 开始审计流程...")
        
        print("  → 步骤 1/5: 加载和预处理数据...")
        self._timestamps['load_start'] = datetime.now()
        loaded_data = self.data_loader.load_csv(input_file)
        self._timestamps['load_end'] = datetime.now()
        self.results['loaded_data'] = loaded_data
        print(f"    ✓ 加载完成: {loaded_data.data_summary['raw_rows']} 条原始记录")
        
        print("  → 步骤 2/5: 执行质量控制检查...")
        self._timestamps['qc_start'] = datetime.now()
        qc_result = self.quality_controller.run_all_checks(loaded_data.processed_data)
        self._timestamps['qc_end'] = datetime.now()
        self.results['qc_result'] = qc_result
        print(f"    ✓ 质控完成: 质量评分 {qc_result.quality_score:.1f}/100")
        print(f"      发现 {len(qc_result.issues)} 个问题")
        
        print("  → 步骤 3/5: 检测漂移...")
        self._timestamps['drift_start'] = datetime.now()
        valid_data = self.quality_controller.get_valid_data(
            loaded_data.processed_data.copy(), 
            qc_result
        )
        drift_result = self.drift_detector.detect_drift(valid_data)
        self._timestamps['drift_end'] = datetime.now()
        self.results['drift_result'] = drift_result
        print(f"    ✓ 漂移检测完成: 发现 {len(drift_result.drift_events)} 个漂移事件")
        
        print("  → 步骤 4/5: 执行校准...")
        self._timestamps['calib_start'] = datetime.now()
        calibration_result = self.calibrator.calibrate(
            valid_data.copy(),
            drift_result,
            reference_sensor_id
        )
        self._timestamps['calib_end'] = datetime.now()
        self.results['calibration_result'] = calibration_result
        print(f"    ✓ 校准完成: 生成 {len(calibration_result.parameters)} 个校准参数")
        
        print("  → 步骤 5/5: 生成报告...")
        self._timestamps['report_start'] = datetime.now()
        generated_files = self.report_generator.generate_reports(
            loaded_data=loaded_data,
            qc_result=qc_result,
            drift_result=drift_result,
            calibration_result=calibration_result,
            output_prefix=output_prefix
        )
        self._timestamps['report_end'] = datetime.now()
        self._timestamps['end'] = datetime.now()
        self.results['generated_files'] = generated_files
        
        total_duration = (self._timestamps['end'] - self._timestamps['start']).total_seconds()
        print(f"\n✓ 审计流程完成! 总耗时: {total_duration:.2f} 秒")
        print("  生成的文件:")
        for file_type, file_path in generated_files.items():
            print(f"    - {file_type.upper()}: {file_path}")
        
        self._save_calibrated_data(calibration_result.calibrated_data, output_prefix)
        self._save_metadata(output_prefix)
        
        return self.results
    
    def _save_calibrated_data(self, calibrated_data: pd.DataFrame, output_prefix: str) -> None:
        output_dir = Path(self.config.data_output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_file = output_dir / f'{output_prefix}_calibrated.csv'
        calibrated_data.to_csv(output_file, index=False)
        
        print(f"    - 校准后数据: {output_file}")
        self.results['calibrated_data_file'] = str(output_file)
    
    def _save_metadata(self, output_prefix: str) -> None:
        metadata = {
            'audit_metadata': {
                'generated_at': self._timestamps['end'].isoformat(),
                'duration_seconds': (self._timestamps['end'] - self._timestamps['start']).total_seconds(),
                'step_durations': {
                    'data_loading': (self._timestamps['load_end'] - self._timestamps['load_start']).total_seconds(),
                    'quality_control': (self._timestamps['qc_end'] - self._timestamps['qc_start']).total_seconds(),
                    'drift_detection': (self._timestamps['drift_end'] - self._timestamps['drift_start']).total_seconds(),
                    'calibration': (self._timestamps['calib_end'] - self._timestamps['calib_start']).total_seconds(),
                    'report_generation': (self._timestamps['report_end'] - self._timestamps['report_start']).total_seconds(),
                }
            },
            'configuration': self.config.to_dict(),
            'summary': self._generate_summary()
        }
        
        output_dir = Path(self.config.report_output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        metadata_file = output_dir / f'{output_prefix}_metadata.json'
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        self.results['metadata_file'] = str(metadata_file)
    
    def _generate_summary(self) -> Dict:
        summary = {}
        
        if 'loaded_data' in self.results:
            summary['data'] = self.results['loaded_data'].data_summary
        
        if 'qc_result' in self.results:
            qc = self.results['qc_result']
            summary['quality_control'] = {
                'quality_score': qc.quality_score,
                'total_records': qc.total_records,
                'valid_records': qc.valid_records,
                'invalid_records': qc.invalid_records,
                'total_issues': len(qc.issues),
                'issues_by_type': qc.statistics
            }
        
        if 'drift_result' in self.results:
            drift = self.results['drift_result']
            summary['drift'] = drift.drift_statistics
        
        if 'calibration_result' in self.results:
            calib = self.results['calibration_result']
            summary['calibration'] = calib.calibration_summary
        
        if 'generated_files' in self.results:
            summary['generated_files'] = self.results['generated_files']
        
        return summary
    
    def get_results(self) -> Dict:
        return self.results
    
    def export_results(self, output_file: str) -> None:
        export_data = {
            'timestamps': {k: v.isoformat() if v else None for k, v in self._timestamps.items()},
            'summary': self._generate_summary()
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
