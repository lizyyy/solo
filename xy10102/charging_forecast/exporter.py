import os
import json
from datetime import datetime
from typing import Dict, Any, Optional
import pandas as pd
from .config import Config
from .quality_control import QCResult
from .predictor import PredictionResult
from .report import ReportOutput


class ResultExporter:
    def __init__(self, config: Config):
        self.config = config

    def export_all(self,
                   report_output: ReportOutput,
                   qc_result: QCResult,
                   prediction: PredictionResult,
                   output_dir: str,
                   prefix: str = "") -> Dict[str, str]:
        
        os.makedirs(output_dir, exist_ok=True)
        
        if prefix:
            prefix = f"{prefix}_"
        
        export_paths = {}
        
        export_paths['tables'] = self._export_tables(
            report_output.tables, output_dir, prefix
        )
        
        export_paths['clean_data'] = self._export_clean_data(
            qc_result, output_dir, prefix
        )
        
        export_paths['failures'] = self._export_failures(
            qc_result, output_dir, prefix
        )
        
        export_paths['prediction'] = self._export_predictions(
            prediction, output_dir, prefix
        )
        
        export_paths['summary_json'] = self._export_summary_json(
            report_output, qc_result, prediction, output_dir, prefix
        )
        
        if hasattr(prediction, 'model') and prediction.model is not None:
            export_paths['model'] = self._export_model(
                prediction.model, output_dir, prefix
            )
        
        return export_paths

    def _export_tables(self, tables: Dict[str, pd.DataFrame],
                       output_dir: str, prefix: str) -> Dict[str, str]:
        paths = {}
        export_format = self.config.report.export_format
        
        for name, df in tables.items():
            if df is None or len(df) == 0:
                continue
            
            if export_format == 'xlsx':
                path = os.path.join(output_dir, f'{prefix}{name}.xlsx')
                df.to_excel(path, index=False)
            elif export_format == 'csv':
                path = os.path.join(output_dir, f'{prefix}{name}.csv')
                df.to_csv(path, index=False, encoding='utf-8-sig')
            else:
                path = os.path.join(output_dir, f'{prefix}{name}.xlsx')
                df.to_excel(path, index=False)
            
            paths[name] = path
        
        return paths

    def _export_clean_data(self, qc_result: QCResult,
                           output_dir: str, prefix: str) -> Optional[str]:
        if qc_result.cleaned_data is None or len(qc_result.cleaned_data) == 0:
            return None
        
        export_format = self.config.report.export_format
        if export_format == 'xlsx':
            path = os.path.join(output_dir, f'{prefix}clean_data.xlsx')
            qc_result.cleaned_data.to_excel(path, index=False)
        else:
            path = os.path.join(output_dir, f'{prefix}clean_data.csv')
            qc_result.cleaned_data.to_csv(path, index=False, encoding='utf-8-sig')
        
        return path

    def _export_failures(self, qc_result: QCResult,
                         output_dir: str, prefix: str) -> Optional[str]:
        if not qc_result.failures:
            return None
        
        failures_df = pd.DataFrame([{
            '原始行号': f.row_index,
            '列名': f.column,
            '值': str(f.value),
            '异常类型': f.failure_type,
            '原因': f.reason
        } for f in qc_result.failures])
        
        export_format = self.config.report.export_format
        if export_format == 'xlsx':
            path = os.path.join(output_dir, f'{prefix}failures.xlsx')
            failures_df.to_excel(path, index=False)
        else:
            path = os.path.join(output_dir, f'{prefix}failures.csv')
            failures_df.to_csv(path, index=False, encoding='utf-8-sig')
        
        return path

    def _export_predictions(self, prediction: PredictionResult,
                            output_dir: str, prefix: str) -> Optional[str]:
        data = {
            '实际值': prediction.actual_values,
            '预测值': prediction.predictions,
            '误差': prediction.actual_values - prediction.predictions
        }
        
        n_points = len(prediction.actual_values)
        if prediction.timestamps is not None and len(prediction.timestamps) == n_points:
            data['时间'] = prediction.timestamps
        
        df = pd.DataFrame(data)
        
        if '时间' in df.columns:
            cols = ['时间', '实际值', '预测值', '误差']
            df = df[cols]
        
        export_format = self.config.report.export_format
        if export_format == 'xlsx':
            path = os.path.join(output_dir, f'{prefix}predictions.xlsx')
            df.to_excel(path, index=False)
        else:
            path = os.path.join(output_dir, f'{prefix}predictions.csv')
            df.to_csv(path, index=False, encoding='utf-8-sig')
        
        return path

    def _export_summary_json(self, report_output: ReportOutput,
                             qc_result: QCResult,
                             prediction: PredictionResult,
                             output_dir: str, prefix: str) -> str:
        
        summary = {
            'export_time': datetime.now().isoformat(),
            'data_quality': {
                'total_records': qc_result.summary['total_records'],
                'clean_records': qc_result.summary['clean_records'],
                'failed_records': qc_result.summary['failed_records'],
                'valid_rate': qc_result.summary['clean_records'] / qc_result.summary['total_records'] if qc_result.summary['total_records'] > 0 else 0,
                'failure_types': {
                    'missing_value': qc_result.summary.get('missing_value', 0),
                    'out_of_range': qc_result.summary.get('out_of_range', 0),
                    'invalid_format': qc_result.summary.get('invalid_format', 0),
                    'duplicate': qc_result.summary.get('duplicate', 0),
                    'negative_value': qc_result.summary.get('negative_value', 0),
                    'inconsistent': qc_result.summary.get('inconsistent', 0),
                }
            },
            'model_performance': prediction.metrics,
            'feature_importance': prediction.feature_importance,
            'output_files': {
                'charts': list(report_output.charts.values()),
                'tables': list(report_output.tables.keys())
            }
        }
        
        path = os.path.join(output_dir, f'{prefix}summary.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2, default=str)
        
        return path

    def _export_model(self, model, output_dir: str, prefix: str) -> str:
        try:
            import joblib
            path = os.path.join(output_dir, f'{prefix}model.joblib')
            joblib.dump(model, path)
            return path
        except ImportError:
            return ""
