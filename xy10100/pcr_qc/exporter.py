import pandas as pd
import json
import csv
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict

from .data_loader import LoadedData
from .qc_validator import QCResult, QCStatus, QCFailure


@dataclass
class ExportResult:
    success: bool
    files: List[str]
    errors: List[str]


class Exporter:
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def export_all(self, loaded_data: LoadedData, qc_result: QCResult, 
                   basename: str = "pcr_qc") -> ExportResult:
        files = []
        errors = []

        try:
            files.append(self.export_results_csv(loaded_data, qc_result, f"{basename}_results"))
        except Exception as e:
            errors.append(f"CSV导出失败: {str(e)}")

        try:
            files.append(self.export_failures_csv(qc_result, f"{basename}_failures"))
        except Exception as e:
            errors.append(f"失败样本CSV导出失败: {str(e)}")

        try:
            files.append(self.export_json(loaded_data, qc_result, f"{basename}_report"))
        except Exception as e:
            errors.append(f"JSON导出失败: {str(e)}")

        return ExportResult(
            success=len(errors) == 0,
            files=files,
            errors=errors
        )

    def export_results_csv(self, loaded_data: LoadedData, qc_result: QCResult, 
                          basename: str) -> str:
        output_path = self.output_dir / f"{basename}.csv"
        
        df = qc_result.sample_results.copy()
        
        if 'sample_type' in df.columns:
            df['sample_type'] = df['sample_type'].apply(lambda x: x.value if hasattr(x, 'value') else x)
        
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
        return str(output_path)

    def export_failures_csv(self, qc_result: QCResult, basename: str) -> str:
        output_path = self.output_dir / f"{basename}.csv"
        
        if not qc_result.failures:
            empty_df = pd.DataFrame(columns=['sample_id', 'rule_name', 'reason', 'severity', 'details'])
            empty_df.to_csv(output_path, index=False, encoding='utf-8-sig')
            return str(output_path)
        
        failures_data = []
        for failure in qc_result.failures:
            failures_data.append({
                'sample_id': failure.sample_id,
                'rule_name': failure.rule_name,
                'reason': failure.reason,
                'severity': failure.severity,
                'details': json.dumps(failure.details, ensure_ascii=False)
            })
        
        df = pd.DataFrame(failures_data)
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
        return str(output_path)

    def export_json(self, loaded_data: LoadedData, qc_result: QCResult, 
                   basename: str) -> str:
        output_path = self.output_dir / f"{basename}.json"
        
        report_data = {
            'metadata': loaded_data.metadata,
            'overall_status': qc_result.overall_status.value,
            'statistics': qc_result.statistics,
            'controls': [
                {
                    'type': c.control_type,
                    'expected': c.expected_status,
                    'actual': c.actual_status,
                    'passed': c.passed,
                    'message': c.message,
                    'ct_value': c.ct_value
                } for c in qc_result.control_checks
            ],
            'failures': [
                {
                    'sample_id': f.sample_id,
                    'rule': f.rule_name,
                    'reason': f.reason,
                    'severity': f.severity,
                    'details': f.details
                } for f in qc_result.failures
            ],
            'data_issues': [
                {
                    'type': i.issue_type,
                    'severity': i.severity,
                    'sample_id': i.sample_id,
                    'column': i.column,
                    'message': i.message
                } for i in loaded_data.issues
            ],
            'processing_log': loaded_data.processing_log + qc_result.validation_log
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        return str(output_path)
