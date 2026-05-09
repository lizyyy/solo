import os
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

from config import config
from logger import get_logger
from data_loader import DataLoader


class Exporter:
    def __init__(self, data_loader: DataLoader):
        self.loader = data_loader
        self.logger = get_logger()
    
    def export_results(self,
                      df: pd.DataFrame,
                      qc_report: Dict,
                      attributions: List,
                      calculation_log: List,
                      output_dir: Optional[str] = None) -> Dict[str, str]:
        
        output_dir = Path(output_dir or config.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        self.logger.log_info(f"开始导出结果到: {output_dir}")
        
        exported_files = {}
        
        excel_path = output_dir / config.export_excel_file
        self._export_to_excel(df, qc_report, attributions, calculation_log, excel_path)
        exported_files['excel'] = str(excel_path)
        
        failed_samples_path = output_dir / config.failed_samples_file
        failed_samples = self.logger.get_failed_samples()
        if failed_samples:
            self._export_failed_samples(failed_samples, failed_samples_path)
            exported_files['failed_samples'] = str(failed_samples_path)
        
        csv_path = output_dir / 'cleaned_data.csv'
        self._export_cleaned_data(df, csv_path)
        exported_files['cleaned_data'] = str(csv_path)
        
        repro_path = output_dir / 'reproducibility_info.json'
        self._export_reproducibility_info(calculation_log, repro_path)
        exported_files['reproducibility'] = str(repro_path)
        
        self.logger.log_info(f"所有结果已导出到 {output_dir}")
        return exported_files
    
    def _export_to_excel(self, df: pd.DataFrame, qc_report: Dict,
                        attributions: List, calculation_log: List,
                        file_path: Path):
        
        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            self._export_main_data(df, writer)
            self._export_statistics(df, writer)
            self._export_qc_report(qc_report, writer)
            self._export_attributions(attributions, writer)
            self._export_calculation_log(calculation_log, writer)
            self._export_failed_samples_to_excel(writer)
        
        self.logger.log_info(f"Excel文件已导出: {file_path}")
    
    def _export_main_data(self, df: pd.DataFrame, writer: pd.ExcelWriter):
        export_df = df.copy()
        
        display_columns = [col for col in export_df.columns if not col.startswith('_')]
        for internal_col in ['_specific_energy', '_energy_deviation', 
                           '_energy_deviation_pct', '_expected_energy',
                           '_energy_waste', '_is_anomaly']:
            if internal_col in export_df.columns:
                display_columns.append(internal_col)
        
        export_df = export_df[display_columns].copy()
        
        column_rename = {
            '_specific_energy': '单位能耗(kWh/m³)',
            '_energy_deviation': '能耗偏差',
            '_energy_deviation_pct': '偏差百分比(%)',
            '_expected_energy': '预期能耗',
            '_energy_waste': '浪费能耗',
            '_is_anomaly': '是否异常'
        }
        export_df = export_df.rename(columns=column_rename)
        
        export_df.to_excel(writer, sheet_name='原始数据', index=False)
    
    def _export_statistics(self, df: pd.DataFrame, writer: pd.ExcelWriter):
        stats_data = []
        
        for col_type in ['energy', 'production', 'pressure', 'leak']:
            col_name = self.loader.mapping.get(col_type)
            if not col_name or col_name not in df.columns:
                continue
            
            valid_data = df[col_name].dropna()
            if len(valid_data) == 0:
                continue
            
            unit_map = {
                'energy': config.default_energy_unit,
                'production': config.default_production_unit,
                'pressure': config.default_pressure_unit,
                'leak': config.default_leak_unit
            }
            
            stats_data.append({
                '指标': col_name,
                '单位': unit_map.get(col_type, ''),
                '计数': len(valid_data),
                '均值': round(valid_data.mean(), 4),
                '标准差': round(valid_data.std(), 4),
                '最小值': round(valid_data.min(), 4),
                '25%分位数': round(valid_data.quantile(0.25), 4),
                '中位数': round(valid_data.median(), 4),
                '75%分位数': round(valid_data.quantile(0.75), 4),
                '最大值': round(valid_data.max(), 4),
                '缺失数': int(df[col_name].isna().sum()),
                '缺失比例': f"{df[col_name].isna().sum() / len(df) * 100:.1f}%"
            })
        
        if '_specific_energy' in df.columns:
            valid_se = df['_specific_energy'].dropna()
            if len(valid_se) > 0:
                stats_data.append({
                    '指标': '单位能耗',
                    '单位': 'kWh/m³',
                    '计数': len(valid_se),
                    '均值': round(valid_se.mean(), 4),
                    '标准差': round(valid_se.std(), 4),
                    '最小值': round(valid_se.min(), 4),
                    '25%分位数': round(valid_se.quantile(0.25), 4),
                    '中位数': round(valid_se.median(), 4),
                    '75%分位数': round(valid_se.quantile(0.75), 4),
                    '最大值': round(valid_se.max(), 4),
                    '缺失数': int(df['_specific_energy'].isna().sum()),
                    '缺失比例': f"{df['_specific_energy'].isna().sum() / len(df) * 100:.1f}%"
                })
        
        stats_df = pd.DataFrame(stats_data)
        if not stats_df.empty:
            stats_df.to_excel(writer, sheet_name='统计摘要', index=False)
    
    def _export_qc_report(self, qc_report: Dict, writer: pd.ExcelWriter):
        if qc_report.get('missing_values'):
            missing_data = []
            for col, stats in qc_report['missing_values'].items():
                missing_data.append({
                    '列名': col,
                    '缺失数量': stats['count'],
                    '缺失比例': f"{stats['ratio'] * 100:.1f}%"
                })
            pd.DataFrame(missing_data).to_excel(writer, sheet_name='缺失值统计', index=False)
        
        if qc_report.get('outliers'):
            outlier_data = []
            for outlier in qc_report['outliers']:
                outlier_data.append({
                    '检测方法': outlier.get('method', ''),
                    '列名': outlier.get('column', ''),
                    '原索引': outlier.get('index', ''),
                    '值': outlier.get('value', ''),
                    '范围/Z值': outlier.get('bounds', outlier.get('zscore', ''))
                })
            pd.DataFrame(outlier_data).to_excel(writer, sheet_name='异常值检测', index=False)
        
        if qc_report.get('duplicates'):
            duplicate_data = []
            for dup in qc_report['duplicates']:
                duplicate_data.append({
                    '重复键': str(dup.get('key', '')),
                    '涉及索引': ', '.join(map(str, dup.get('indices', []))),
                    '重复次数': dup.get('count', '')
                })
            pd.DataFrame(duplicate_data).to_excel(writer, sheet_name='重复记录', index=False)
    
    def _export_attributions(self, attributions: List, writer: pd.ExcelWriter):
        if not attributions:
            return
        
        attr_data = []
        for i, attr in enumerate(attributions, 1):
            attr_data.append({
                '排名': i,
                '原因类别': attr.category,
                '描述': attr.description,
                '置信度': f"{attr.confidence * 100:.0f}%",
                '影响记录数': attr.affected_count,
                '贡献度': f"{attr.contribution * 100:.0f}%",
                '相关记录索引': ', '.join(map(str, attr.related_indices[:50]))
            })
        
        pd.DataFrame(attr_data).to_excel(writer, sheet_name='异常归因', index=False)
        
        detail_data = []
        for attr in attributions:
            for idx in attr.related_indices:
                detail_data.append({
                    '原索引': idx,
                    '归因类别': attr.category,
                    '置信度': f"{attr.confidence * 100:.0f}%"
                })
        
        if detail_data:
            pd.DataFrame(detail_data).to_excel(writer, sheet_name='归因详情', index=False)
    
    def _export_calculation_log(self, calculation_log: List, writer: pd.ExcelWriter):
        if not calculation_log:
            return
        
        log_data = []
        for step in calculation_log:
            log_data.append({
                '步骤名称': step.get('step_name', ''),
                '描述': step.get('description', ''),
                '时间戳': step.get('timestamp', ''),
                '参数': str(step.get('parameters', {})),
                '结果摘要': str(step.get('result_summary', {}))
            })
        
        pd.DataFrame(log_data).to_excel(writer, sheet_name='计算流程日志', index=False)
    
    def _export_failed_samples_to_excel(self, writer: pd.ExcelWriter):
        failed_samples = self.logger.get_failed_samples()
        if not failed_samples:
            return
        
        category_map = {
            'missing_value': '缺失值',
            'duplicate': '重复记录',
            'negative_value': '负值',
            'outlier_iqr': 'IQR异常值',
            'outlier_zscore': 'Z-score异常值',
            'unit_error': '单位错误',
            'datetime_error': '时间格式错误',
            'numeric_error': '数值转换错误',
            'calculation_error': '计算错误'
        }
        
        failed_data = []
        for sample in failed_samples:
            row_data = {
                '原索引': sample.get('index', ''),
                '失败类别': category_map.get(sample.get('category', ''), sample.get('category', '')),
                '失败原因': sample.get('reason', '')
            }
            
            data = sample.get('data', {})
            for key, value in list(data.items())[:10]:
                row_data[f'字段_{key}'] = str(value) if pd.notna(value) else ''
            
            failed_data.append(row_data)
        
        if failed_data:
            pd.DataFrame(failed_data).to_excel(writer, sheet_name='失败样本详情', index=False)
    
    def _export_failed_samples(self, failed_samples: List, file_path: Path):
        category_map = {
            'missing_value': '缺失值',
            'duplicate': '重复记录',
            'negative_value': '负值',
            'outlier_iqr': 'IQR异常值',
            'outlier_zscore': 'Z-score异常值',
            'unit_error': '单位错误',
            'datetime_error': '时间格式错误',
            'numeric_error': '数值转换错误',
            'calculation_error': '计算错误'
        }
        
        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            summary_data = []
            from collections import Counter
            category_counts = Counter(s['category'] for s in failed_samples)
            
            for category, count in category_counts.items():
                summary_data.append({
                    '失败类别': category_map.get(category, category),
                    '英文标识': category,
                    '数量': count,
                    '比例': f"{count / len(failed_samples) * 100:.1f}%"
                })
            
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='汇总', index=False)
            
            detail_data = []
            for sample in failed_samples:
                row_data = {
                    '原索引': sample.get('index', ''),
                    '失败类别': category_map.get(sample.get('category', ''), sample.get('category', '')),
                    '失败原因': sample.get('reason', '')
                }
                
                data = sample.get('data', {})
                for key, value in data.items():
                    row_data[key] = str(value) if pd.notna(value) else ''
                
                detail_data.append(row_data)
            
            if detail_data:
                pd.DataFrame(detail_data).to_excel(writer, sheet_name='详细记录', index=False)
        
        self.logger.log_info(f"失败样本已导出: {file_path}")
    
    def _export_cleaned_data(self, df: pd.DataFrame, file_path: Path):
        export_df = df.copy()
        
        display_columns = [col for col in export_df.columns if not col.startswith('_') or col == '_original_index']
        export_df = export_df[display_columns].copy()
        
        export_df.to_csv(file_path, index=False, encoding='utf-8-sig')
        self.logger.log_info(f"清洗后数据已导出: {file_path}")
    
    def _export_reproducibility_info(self, calculation_log: List, file_path: Path):
        import json
        
        repro_info = {
            'export_timestamp': datetime.now().isoformat(),
            'calculation_steps': calculation_log,
            'config': {
                'outlier_iqr_multiplier': config.outlier_iqr_multiplier,
                'zscore_threshold': config.zscore_threshold,
                'missing_threshold': config.missing_threshold,
                'pressure_normal_range': list(config.pressure_normal_range),
                'leak_threshold': config.leak_threshold,
                'default_energy_unit': config.default_energy_unit,
                'default_production_unit': config.default_production_unit,
                'default_pressure_unit': config.default_pressure_unit,
                'default_leak_unit': config.default_leak_unit
            }
        }
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(repro_info, f, ensure_ascii=False, indent=2)
        
        self.logger.log_info(f"复算信息已导出: {file_path}")
