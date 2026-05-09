import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import seaborn as sns
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from .config import Config
from .quality_control import QCResult
from .predictor import PredictionResult


sns.set_style('whitegrid')
plt.rcParams['font.sans-serif'] = ['SimHei', 'Arial Unicode MS', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False


@dataclass
class ReportOutput:
    charts: Dict[str, str]
    tables: Dict[str, pd.DataFrame]
    summary: Dict[str, Any]


class ReportGenerator:
    def __init__(self, config: Config):
        self.config = config
        self.report_config = config.report
        self.cols = config.columns

    def generate(self, 
                 raw_data: pd.DataFrame,
                 qc_result: QCResult,
                 prediction: PredictionResult,
                 output_dir: str) -> ReportOutput:
        
        os.makedirs(output_dir, exist_ok=True)
        
        charts = {}
        tables = {}
        
        charts.update(self._generate_data_charts(raw_data, output_dir))
        charts.update(self._generate_qc_charts(qc_result, output_dir))
        charts.update(self._generate_prediction_charts(prediction, output_dir))
        
        tables.update(self._generate_qc_tables(qc_result))
        tables.update(self._generate_prediction_tables(prediction))
        
        if self.report_config.include_failures and qc_result.failures:
            tables['failures'] = self._failures_to_df(qc_result.failures)
        
        summary = self._generate_summary(qc_result, prediction)
        
        return ReportOutput(
            charts=charts,
            tables=tables,
            summary=summary
        )

    def _generate_data_charts(self, data: pd.DataFrame, output_dir: str) -> Dict[str, str]:
        charts = {}
        
        if self.cols.timestamp in data.columns and self.cols.charging_power in data.columns:
            chart_path = os.path.join(output_dir, f'charging_load_timeseries.{self.report_config.chart_format}')
            self._plot_timeseries(data, chart_path)
            charts['charging_load_timeseries'] = chart_path
        
        if self.cols.timestamp in data.columns and self.cols.charging_power in data.columns:
            chart_path = os.path.join(output_dir, f'hourly_pattern.{self.report_config.chart_format}')
            self._plot_hourly_pattern(data, chart_path)
            charts['hourly_pattern'] = chart_path
        
        if self.cols.timestamp in data.columns and self.cols.charging_power in data.columns:
            chart_path = os.path.join(output_dir, f'weekly_pattern.{self.report_config.chart_format}')
            self._plot_weekly_pattern(data, chart_path)
            charts['weekly_pattern'] = chart_path
        
        return charts

    def _plot_timeseries(self, data: pd.DataFrame, save_path: str):
        fig, ax = plt.subplots(figsize=(14, 6))
        
        df_plot = data.copy()
        df_plot = df_plot.sort_values(self.cols.timestamp)
        
        ax.plot(df_plot[self.cols.timestamp], df_plot[self.cols.charging_power],
                linewidth=0.8, alpha=0.7, label='实际负荷')
        
        ax.set_xlabel('时间')
        ax.set_ylabel('充电功率 (kW)')
        ax.set_title('充电站负荷时间序列')
        ax.legend()
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
        plt.xticks(rotation=45)
        plt.tight_layout()
        plt.savefig(save_path, dpi=self.report_config.chart_dpi, bbox_inches='tight')
        plt.close()

    def _plot_hourly_pattern(self, data: pd.DataFrame, save_path: str):
        fig, ax = plt.subplots(figsize=(12, 6))
        
        df_plot = data.copy()
        df_plot['hour'] = df_plot[self.cols.timestamp].dt.hour
        
        hourly_stats = df_plot.groupby('hour')[self.cols.charging_power].agg(['mean', 'std', 'median'])
        
        ax.bar(hourly_stats.index, hourly_stats['mean'],
               yerr=hourly_stats['std'], capsize=3, alpha=0.7, label='平均功率')
        ax.plot(hourly_stats.index, hourly_stats['median'],
                'r-o', linewidth=2, markersize=6, label='中位数')
        
        peak_hours = [17, 18, 19, 20, 21, 22]
        ax.axvspan(16.5, 22.5, alpha=0.2, color='red', label='晚高峰时段')
        
        ax.set_xlabel('小时 (0-23)')
        ax.set_ylabel('充电功率 (kW)')
        ax.set_title('24小时负荷分布模式')
        ax.set_xticks(range(0, 24))
        ax.legend()
        plt.tight_layout()
        plt.savefig(save_path, dpi=self.report_config.chart_dpi, bbox_inches='tight')
        plt.close()

    def _plot_weekly_pattern(self, data: pd.DataFrame, save_path: str):
        fig, ax = plt.subplots(figsize=(12, 6))
        
        df_plot = data.copy()
        df_plot['day_of_week'] = df_plot[self.cols.timestamp].dt.dayofweek
        df_plot['hour'] = df_plot[self.cols.timestamp].dt.hour
        
        daily_stats = df_plot.groupby('day_of_week')[self.cols.charging_power].agg(['mean', 'std'])
        
        days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
        ax.bar(range(7), daily_stats['mean'],
               yerr=daily_stats['std'], capsize=3, alpha=0.7)
        
        ax.set_xlabel('星期')
        ax.set_ylabel('平均充电功率 (kW)')
        ax.set_title('周内负荷分布模式')
        ax.set_xticks(range(7))
        ax.set_xticklabels(days)
        plt.tight_layout()
        plt.savefig(save_path, dpi=self.report_config.chart_dpi, bbox_inches='tight')
        plt.close()

    def _generate_qc_charts(self, qc_result: QCResult, output_dir: str) -> Dict[str, str]:
        charts = {}
        
        chart_path = os.path.join(output_dir, f'qc_summary.{self.report_config.chart_format}')
        self._plot_qc_summary(qc_result, chart_path)
        charts['qc_summary'] = chart_path
        
        if qc_result.failures:
            chart_path = os.path.join(output_dir, f'failure_types.{self.report_config.chart_format}')
            self._plot_failure_types(qc_result, chart_path)
            charts['failure_types'] = chart_path
        
        return charts

    def _plot_qc_summary(self, qc_result: QCResult, save_path: str):
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
        
        summary = qc_result.summary
        total = summary['total_records']
        clean = summary['clean_records']
        failed = summary['failed_records']
        
        ax1.pie(
            [clean, failed],
            labels=['有效数据', '无效数据'],
            autopct='%1.1f%%',
            colors=['#2ecc71', '#e74c3c'],
            startangle=90
        )
        ax1.set_title(f'数据质量概况 (总计: {total} 条)')
        
        failure_types = {
            '缺失值': summary.get('missing_value', 0),
            '超出范围': summary.get('out_of_range', 0),
            '格式错误': summary.get('invalid_format', 0),
            '重复记录': summary.get('duplicate', 0),
            '负值': summary.get('negative_value', 0),
            '不一致': summary.get('inconsistent', 0),
        }
        
        non_zero = {k: v for k, v in failure_types.items() if v > 0}
        
        if non_zero:
            ax2.barh(list(non_zero.keys()), list(non_zero.values()), color='#e74c3c', alpha=0.7)
            ax2.set_xlabel('数量')
            ax2.set_title('异常类型分布')
        else:
            ax2.text(0.5, 0.5, '无异常数据', ha='center', va='center',
                     transform=ax2.transAxes, fontsize=14, color='#2ecc71')
            ax2.set_xticks([])
            ax2.set_yticks([])
            ax2.set_title('数据质量完美')
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=self.report_config.chart_dpi, bbox_inches='tight')
        plt.close()

    def _plot_failure_types(self, qc_result: QCResult, save_path: str):
        fig, ax = plt.subplots(figsize=(10, 6))
        
        df = self._failures_to_df(qc_result.failures)
        if 'column' in df.columns:
            col_counts = df['column'].value_counts()
            col_counts.plot(kind='bar', ax=ax, color='#e74c3c', alpha=0.7)
            ax.set_xlabel('列名')
            ax.set_ylabel('异常数量')
            ax.set_title('各列异常分布')
            plt.xticks(rotation=45)
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=self.report_config.chart_dpi, bbox_inches='tight')
        plt.close()

    def _generate_prediction_charts(self, prediction: PredictionResult, output_dir: str) -> Dict[str, str]:
        charts = {}
        
        chart_path = os.path.join(output_dir, f'prediction_comparison.{self.report_config.chart_format}')
        self._plot_prediction_comparison(prediction, chart_path)
        charts['prediction_comparison'] = chart_path
        
        chart_path = os.path.join(output_dir, f'prediction_errors.{self.report_config.chart_format}')
        self._plot_prediction_errors(prediction, chart_path)
        charts['prediction_errors'] = chart_path
        
        if prediction.feature_importance:
            chart_path = os.path.join(output_dir, f'feature_importance.{self.report_config.chart_format}')
            self._plot_feature_importance(prediction, chart_path)
            charts['feature_importance'] = chart_path
        
        return charts

    def _plot_prediction_comparison(self, prediction: PredictionResult, save_path: str):
        fig, ax = plt.subplots(figsize=(14, 6))
        
        actual = prediction.actual_values
        pred = prediction.predictions
        n_points = len(actual)
        
        if prediction.timestamps is not None and len(prediction.timestamps) == n_points:
            ax.plot(prediction.timestamps, actual, label='实际值', linewidth=1.5)
            ax.plot(prediction.timestamps, pred, label='预测值', linewidth=1.5, alpha=0.8)
            ax.xaxis.set_major_formatter(mdates.DateFormatter('%m-%d %H:%M'))
            plt.xticks(rotation=45)
        else:
            ax.plot(actual, label='实际值', linewidth=1.5)
            ax.plot(pred, label='预测值', linewidth=1.5, alpha=0.8)
        
        ax.set_xlabel('时间')
        ax.set_ylabel('充电功率 (kW)')
        ax.set_title('预测值与实际值对比')
        ax.legend()
        plt.tight_layout()
        plt.savefig(save_path, dpi=self.report_config.chart_dpi, bbox_inches='tight')
        plt.close()

    def _plot_prediction_errors(self, prediction: PredictionResult, save_path: str):
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
        
        actual = prediction.actual_values
        pred = prediction.predictions
        errors = actual - pred
        
        ax1.scatter(actual, pred, alpha=0.5, s=20)
        min_val = min(actual.min(), pred.min())
        max_val = max(actual.max(), pred.max())
        ax1.plot([min_val, max_val], [min_val, max_val], 'r--', label='完美预测线')
        ax1.set_xlabel('实际值')
        ax1.set_ylabel('预测值')
        ax1.set_title('预测散点图')
        ax1.legend()
        ax1.axis('equal')
        
        ax2.hist(errors, bins=30, edgecolor='black', alpha=0.7)
        ax2.axvline(x=0, color='r', linestyle='--', label='零误差')
        ax2.set_xlabel('预测误差')
        ax2.set_ylabel('频数')
        ax2.set_title('预测误差分布')
        ax2.legend()
        
        plt.tight_layout()
        plt.savefig(save_path, dpi=self.report_config.chart_dpi, bbox_inches='tight')
        plt.close()

    def _plot_feature_importance(self, prediction: PredictionResult, save_path: str):
        fig, ax = plt.subplots(figsize=(10, 8))
        
        importance = pd.Series(prediction.feature_importance)
        importance = importance.sort_values(ascending=True)
        
        top_n = min(20, len(importance))
        importance_top = importance.tail(top_n)
        
        importance_top.plot(kind='barh', ax=ax, color='#3498db', alpha=0.7)
        ax.set_xlabel('重要性')
        ax.set_ylabel('特征')
        ax.set_title(f'Top {top_n} 特征重要性')
        plt.tight_layout()
        plt.savefig(save_path, dpi=self.report_config.chart_dpi, bbox_inches='tight')
        plt.close()

    def _generate_qc_tables(self, qc_result: QCResult) -> Dict[str, pd.DataFrame]:
        tables = {}
        
        summary_df = pd.DataFrame([{
            '指标': '总记录数',
            '数值': qc_result.summary['total_records']
        }, {
            '指标': '有效记录数',
            '数值': qc_result.summary['clean_records']
        }, {
            '指标': '无效记录数',
            '数值': qc_result.summary['failed_records']
        }, {
            '指标': '有效率',
            '数值': f"{(qc_result.summary['clean_records'] / qc_result.summary['total_records'] * 100):.2f}%"
        }])
        tables['qc_summary'] = summary_df
        
        if qc_result.statistics:
            stats_data = []
            for key, value in qc_result.statistics.items():
                if isinstance(value, dict):
                    for sub_key, sub_val in value.items():
                        if isinstance(sub_val, (int, float, str)):
                            stats_data.append({
                                '统计项': f"{key}_{sub_key}",
                                '数值': sub_val
                            })
                else:
                    stats_data.append({
                        '统计项': key,
                        '数值': value
                    })
            tables['statistics'] = pd.DataFrame(stats_data)
        
        return tables

    def _generate_prediction_tables(self, prediction: PredictionResult) -> Dict[str, pd.DataFrame]:
        tables = {}
        
        metrics_df = pd.DataFrame([{
            '指标': '均方误差 (MSE)',
            '数值': f"{prediction.metrics.get('mse', 'N/A'):.4f}"
        }, {
            '指标': '均方根误差 (RMSE)',
            '数值': f"{prediction.metrics.get('rmse', 'N/A'):.4f}"
        }, {
            '指标': '平均绝对误差 (MAE)',
            '数值': f"{prediction.metrics.get('mae', 'N/A'):.4f}"
        }, {
            '指标': '决定系数 (R²)',
            '数值': f"{prediction.metrics.get('r2', 'N/A'):.4f}"
        }, {
            '指标': '平均绝对百分比误差 (MAPE)',
            '数值': f"{prediction.metrics.get('mape', 'N/A'):.4f}"
        }, {
            '指标': '交叉验证 RMSE (均值)',
            '数值': f"{prediction.metrics.get('cv_rmse_mean', 'N/A'):.4f}"
        }, {
            '指标': '交叉验证 RMSE (标准差)',
            '数值': f"{prediction.metrics.get('cv_rmse_std', 'N/A'):.4f}"
        }, {
            '指标': '高峰时段 RMSE',
            '数值': f"{prediction.metrics.get('peak_rmse', 'N/A'):.4f}"
        }, {
            '指标': '高峰时段 MAE',
            '数值': f"{prediction.metrics.get('peak_mae', 'N/A'):.4f}"
        }])
        tables['model_metrics'] = metrics_df
        
        if prediction.feature_importance:
            imp_df = pd.DataFrame([{
                '特征': feature,
                '重要性': importance
            } for feature, importance in sorted(
                prediction.feature_importance.items(),
                key=lambda x: x[1], reverse=True
            )])
            tables['feature_importance'] = imp_df
        
        if prediction.timestamps is not None and len(prediction.timestamps) == len(prediction.actual_values):
            result_df = pd.DataFrame({
                '时间': prediction.timestamps,
                '实际值': prediction.actual_values,
                '预测值': prediction.predictions,
                '误差': prediction.actual_values - prediction.predictions,
                '相对误差': (prediction.actual_values - prediction.predictions) / prediction.actual_values * 100
            })
            tables['prediction_results'] = result_df
        else:
            result_df = pd.DataFrame({
                '序号': range(len(prediction.actual_values)),
                '实际值': prediction.actual_values,
                '预测值': prediction.predictions,
                '误差': prediction.actual_values - prediction.predictions
            })
            tables['prediction_results'] = result_df
        
        return tables

    def _failures_to_df(self, failures) -> pd.DataFrame:
        return pd.DataFrame([{
            '原始行号': f.row_index,
            '列名': f.column,
            '值': str(f.value),
            '异常类型': f.failure_type,
            '原因': f.reason
        } for f in failures])

    def _generate_summary(self, qc_result: QCResult, prediction: PredictionResult) -> Dict[str, Any]:
        return {
            'data_quality': {
                'total_records': qc_result.summary['total_records'],
                'clean_records': qc_result.summary['clean_records'],
                'failed_records': qc_result.summary['failed_records'],
                'valid_rate': qc_result.summary['clean_records'] / qc_result.summary['total_records']
            },
            'model_performance': {
                'rmse': prediction.metrics.get('rmse'),
                'mae': prediction.metrics.get('mae'),
                'r2': prediction.metrics.get('r2'),
                'mape': prediction.metrics.get('mape')
            }
        }
