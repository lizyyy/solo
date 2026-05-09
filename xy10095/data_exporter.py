import os
import pandas as pd
import numpy as np
from typing import List, Dict, Optional
from dataclasses import dataclass
from config import AppConfig


@dataclass
class ExportResult:
    success: bool
    files: List[str]
    errors: List[str]


class DataExporter:
    def __init__(self, config: AppConfig):
        self.config = config
        self.output_dir = config.output_dir

    def _ensure_output_dir(self):
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def _format_inverter_table(self, df: pd.DataFrame) -> pd.DataFrame:
        result = df.copy()
        for col in ['measured_efficiency', 'adjusted_efficiency']:
            if col in result.columns:
                result[col] = result[col].apply(lambda x: round(x*100, 2) if pd.notna(x) else None)
        for col in ['temperature_correction_factor', 'performance_ratio',
                   'data_quality_score', 'capacity_utilization']:
            if col in result.columns:
                result[col] = result[col].apply(lambda x: round(x, 4) if pd.notna(x) else None)
        for col in ['raw_generation', 'theoretical_generation', 'specific_yield']:
            if col in result.columns:
                result[col] = result[col].apply(lambda x: round(x, 2) if pd.notna(x) else None)
        if 'rank' in result.columns:
            result['rank'] = result['rank'].apply(lambda x: int(x) if pd.notna(x) else None)
        return result

    def _format_row_level_table(self, df: pd.DataFrame) -> pd.DataFrame:
        result = df.copy()
        if 'measured_efficiency' in result.columns:
            result['measured_efficiency'] = result['measured_efficiency'].apply(
                lambda x: round(x*100, 2) if pd.notna(x) else None
            )
        for col in ['temperature_correction_factor']:
            if col in result.columns:
                result[col] = result[col].apply(lambda x: round(x, 4) if pd.notna(x) else None)
        for col in ['irradiance', 'temperature', 'generation', 'theoretical_generation', 'capacity']:
            if col in result.columns:
                result[col] = result[col].apply(lambda x: round(x, 2) if pd.notna(x) else None)
        return result

    def _issues_to_df(self, issues: List) -> pd.DataFrame:
        if not issues:
            return pd.DataFrame(columns=[
                '行索引', '逆变器编号', '时间戳', '字段', '问题类型',
                '描述', '原始值', '处理动作'
            ])

        data = []
        for issue in issues:
            data.append({
                '行索引': issue.row_index,
                '逆变器编号': issue.inverter_id,
                '时间戳': issue.timestamp,
                '字段': issue.field,
                '问题类型': issue.issue_type,
                '描述': issue.description,
                '原始值': issue.original_value,
                '处理动作': issue.action
            })
        return pd.DataFrame(data)

    def export_to_excel(
        self,
        load_result,
        qc_result,
        calc_result,
        base_name: str = "inverter_result"
    ) -> str:
        self._ensure_output_dir()
        timestamp = pd.Timestamp.now().strftime("%Y%m%d_%H%M%S")
        file_path = os.path.join(self.output_dir, f"{base_name}_{timestamp}.xlsx")

        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            inverter_df = self._format_inverter_table(calc_result.inverter_level_data.copy())
            inverter_df.to_excel(writer, sheet_name='逆变器效率排名', index=False)

            row_df = self._format_row_level_table(calc_result.row_level_data.copy())
            if len(row_df) > 0:
                row_df.to_excel(writer, sheet_name='逐行计算结果', index=False)

            issues_df = self._issues_to_df(qc_result.issues)
            if len(issues_df) > 0:
                issues_df.to_excel(writer, sheet_name='质量问题记录', index=False)

            summary_data = []
            overall = calc_result.overall_metrics
            summary_data.append({'指标': '逆变器总数', '值': overall.get('total_inverters', 0)})
            summary_data.append({'指标': '有效排名数', '值': overall.get('ranked_inverters', 0)})
            summary_data.append({'指标': '有效样本数', '值': overall.get('total_valid_samples', 0)})
            summary_data.append({
                '指标': '平均实测效率 (%)',
                '值': round(overall.get('average_measured_efficiency', 0)*100, 2)
            })
            summary_data.append({
                '指标': '平均调整后效率 (%)',
                '值': round(overall.get('average_adjusted_efficiency', 0)*100, 2)
            })
            summary_data.append({
                '指标': '中位调整后效率 (%)',
                '值': round(overall.get('median_adjusted_efficiency', 0)*100, 2)
            })
            summary_data.append({
                '指标': '效率标准差 (%)',
                '值': round(overall.get('efficiency_std', 0)*100, 2)
            })
            summary_data.append({
                '指标': '最高效率 (%)',
                '值': round(overall.get('max_efficiency', 0)*100, 2)
            })
            summary_data.append({
                '指标': '最低效率 (%)',
                '值': round(overall.get('min_efficiency', 0)*100, 2)
            })
            summary_data.append({'指标': '平均 PR', '值': round(overall.get('average_pr', 0), 4)})

            qc_summary = qc_result.summary
            summary_data.append({'指标': '原始数据行数', '值': qc_summary.get('total_raw_rows', 0)})
            summary_data.append({'指标': '清洗后行数', '值': qc_summary.get('total_clean_rows', 0)})
            summary_data.append({'指标': '排除行数', '值': qc_summary.get('rows_excluded', 0)})
            summary_data.append({
                '指标': '排除率 (%)',
                '值': round(qc_summary.get('exclusion_rate', 0)*100, 2)
            })

            pd.DataFrame(summary_data).to_excel(writer, sheet_name='总体汇总', index=False)

            metadata = calc_result.calculation_metadata
            meta_data = []
            for k, v in metadata.items():
                meta_data.append({'参数名': k, '值': str(v)})
            if load_result.warnings:
                meta_data.append({'参数名': '加载警告', '值': '; '.join(load_result.warnings)})
            if load_result.errors:
                meta_data.append({'参数名': '加载错误', '值': '; '.join(load_result.errors)})
            pd.DataFrame(meta_data).to_excel(writer, sheet_name='计算参数', index=False)

        return file_path

    def export_to_csv(
        self,
        load_result,
        qc_result,
        calc_result,
        base_name: str = "inverter_result"
    ) -> List[str]:
        self._ensure_output_dir()
        timestamp = pd.Timestamp.now().strftime("%Y%m%d_%H%M%S")
        files = []

        inverter_df = self._format_inverter_table(calc_result.inverter_level_data.copy())
        inv_path = os.path.join(self.output_dir, f"{base_name}_ranking_{timestamp}.csv")
        inverter_df.to_csv(inv_path, index=False, encoding='utf-8-sig')
        files.append(inv_path)

        row_df = self._format_row_level_table(calc_result.row_level_data.copy())
        if len(row_df) > 0:
            row_path = os.path.join(self.output_dir, f"{base_name}_row_level_{timestamp}.csv")
            row_df.to_csv(row_path, index=False, encoding='utf-8-sig')
            files.append(row_path)

        issues_df = self._issues_to_df(qc_result.issues)
        if len(issues_df) > 0:
            issues_path = os.path.join(self.output_dir, f"{base_name}_issues_{timestamp}.csv")
            issues_df.to_csv(issues_path, index=False, encoding='utf-8-sig')
            files.append(issues_path)

        return files

    def export(
        self,
        load_result,
        qc_result,
        calc_result,
        formats: List[str] = None,
        base_name: str = "inverter_result"
    ) -> ExportResult:
        if formats is None:
            formats = ['xlsx']

        errors = []
        files = []

        for fmt in formats:
            try:
                if fmt == 'xlsx':
                    f = self.export_to_excel(load_result, qc_result, calc_result, base_name)
                    files.append(f)
                elif fmt == 'csv':
                    fs = self.export_to_csv(load_result, qc_result, calc_result, base_name)
                    files.extend(fs)
                else:
                    errors.append(f"不支持的导出格式: {fmt}")
            except Exception as e:
                errors.append(f"导出 {fmt} 时出错: {str(e)}")

        return ExportResult(
            success=len(errors) == 0,
            files=files,
            errors=errors
        )
