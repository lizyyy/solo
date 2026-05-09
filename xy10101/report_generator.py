import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import Patch
import seaborn as sns
import logging
from typing import Dict, List, Tuple, Any
from datetime import datetime
from config import CONFIG, OUTPUT_DIR


logger = logging.getLogger(__name__)

plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'STHeiti']
plt.rcParams['axes.unicode_minus'] = False
sns.set_style('whitegrid')


class ReportGenerator:
    def __init__(self, config: Dict = None):
        self.config = config or CONFIG
        self.timestamp = self.config['timestamp']
        
    def generate_reports(self, original_df: pd.DataFrame, 
                         qc_df: pd.DataFrame,
                         filled_df: pd.DataFrame,
                         qc_summary: Dict,
                         fill_summary: Dict,
                         qc_module: Any,
                         loading_errors: List[Dict]) -> Dict:
        logger.info("开始生成报告")
        
        reports = {}
        
        reports['figures'] = self._generate_figures(
            original_df, qc_df, filled_df, qc_summary, fill_summary
        )
        
        reports['tables'] = self._generate_tables(
            original_df, qc_df, filled_df, qc_summary, fill_summary,
            qc_module, loading_errors
        )
        
        logger.info("报告生成完成")
        return reports
        
    def _generate_figures(self, original_df: pd.DataFrame,
                         qc_df: pd.DataFrame,
                         filled_df: pd.DataFrame,
                         qc_summary: Dict,
                         fill_summary: Dict) -> Dict:
        figures = {}
        
        station_col = self.config['station_column']
        time_col = self.config['time_column']
        value_col = self.config['value_column']
        
        stations = original_df[station_col].unique()
        
        for station in stations:
            station_original = original_df[original_df[station_col] == station].copy()
            station_qc = qc_df[qc_df[station_col] == station].copy()
            station_filled = filled_df[filled_df[station_col] == station].copy()
            
            fig = self._plot_station_data(
                station_original, station_qc, station_filled, 
                station, time_col, value_col
            )
            
            fig_path = f'{OUTPUT_DIR}/station_{station}_timeseries_{self.timestamp}.png'
            fig.savefig(fig_path, dpi=300, bbox_inches='tight')
            plt.close(fig)
            
            figures[f'timeseries_{station}'] = fig_path
            
        qc_fig = self._plot_qc_summary(qc_summary)
        qc_path = f'{OUTPUT_DIR}/qc_summary_{self.timestamp}.png'
        qc_fig.savefig(qc_path, dpi=300, bbox_inches='tight')
        plt.close(qc_fig)
        figures['qc_summary'] = qc_path
        
        fill_fig = self._plot_fill_summary(fill_summary)
        fill_path = f'{OUTPUT_DIR}/fill_summary_{self.timestamp}.png'
        fill_fig.savefig(fill_path, dpi=300, bbox_inches='tight')
        plt.close(fill_fig)
        figures['fill_summary'] = fill_path
        
        if len(stations) > 1:
            comp_fig = self._plot_station_comparison(original_df, filled_df)
            comp_path = f'{OUTPUT_DIR}/station_comparison_{self.timestamp}.png'
            comp_fig.savefig(comp_path, dpi=300, bbox_inches='tight')
            plt.close(comp_fig)
            figures['station_comparison'] = comp_path
            
        return figures
        
    def _plot_station_data(self, original_df: pd.DataFrame,
                          qc_df: pd.DataFrame,
                          filled_df: pd.DataFrame,
                          station: str,
                          time_col: str,
                          value_col: str) -> plt.Figure:
        fig, axes = plt.subplots(3, 1, figsize=(14, 12), sharex=True)
        
        ax1 = axes[0]
        ax1.plot(original_df[time_col], original_df[value_col], 
                'b-o', markersize=3, linewidth=1, label='原始数据')
        ax1.set_ylabel('雨量 (mm)')
        ax1.set_title(f'站点 {station} - 原始数据时间序列', fontsize=14, fontweight='bold')
        ax1.legend(loc='upper right')
        ax1.grid(True, alpha=0.3)
        
        ax2 = axes[1]
        
        pass_mask = qc_df['qc_flag'] == 'PASS'
        missing_mask = qc_df['qc_flag'] == 'MISSING'
        fail_mask = qc_df['qc_flag'].isin(['FAIL', 'SPIKE', 'CONSTANT', 'LOGIC'])
        
        ax2.scatter(qc_df[pass_mask][time_col], qc_df[pass_mask][value_col],
                   c='green', s=20, alpha=0.7, label='通过质控')
        ax2.scatter(qc_df[missing_mask][time_col], 
                   [0] * len(qc_df[missing_mask]),
                   c='red', s=50, marker='x', label='缺失值')
        ax2.scatter(qc_df[fail_mask][time_col], qc_df[fail_mask][value_col],
                   c='orange', s=50, marker='^', label='异常值')
        
        ax2.set_ylabel('雨量 (mm)')
        ax2.set_title('质量控制结果', fontsize=14, fontweight='bold')
        ax2.legend(loc='upper right')
        ax2.grid(True, alpha=0.3)
        
        ax3 = axes[2]
        
        filled_mask = filled_df['is_filled'] == True
        ax3.plot(filled_df[time_col], filled_df['filled_value'],
                'g-', linewidth=1.5, label='补全后数据')
        ax3.scatter(filled_df[filled_mask][time_col], 
                   filled_df[filled_mask]['filled_value'],
                   c='red', s=30, alpha=0.7, label='补全值', zorder=5)
        
        method_counts = filled_df[filled_mask].groupby('fill_method').size()
        for i, (method, count) in enumerate(method_counts.items()):
            ax3.text(0.02, 0.95 - i * 0.05, f'{method}: {count}个', 
                    transform=ax3.transAxes, fontsize=10,
                    bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        ax3.set_ylabel('雨量 (mm)')
        ax3.set_title('缺测补全结果', fontsize=14, fontweight='bold')
        ax3.set_xlabel('时间')
        ax3.legend(loc='upper right')
        ax3.grid(True, alpha=0.3)
        
        ax3.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d %H:%M'))
        plt.xticks(rotation=45)
        
        plt.tight_layout()
        return fig
        
    def _plot_qc_summary(self, qc_summary: Dict) -> plt.Figure:
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        
        ax1 = axes[0]
        qc_results = qc_summary.get('qc_results', {})
        labels = list(qc_results.keys())
        counts = [v['count'] for v in qc_results.values()]
        percentages = [v['percentage'] for v in qc_results.values()]
        
        colors = plt.cm.Set3(np.linspace(0, 1, len(labels)))
        bars = ax1.bar(labels, counts, color=colors, alpha=0.7)
        
        for i, (bar, pct) in enumerate(zip(bars, percentages)):
            height = bar.get_height()
            ax1.text(bar.get_x() + bar.get_width()/2., height,
                    f'{pct:.1f}%', ha='center', va='bottom')
            
        ax1.set_ylabel('记录数')
        ax1.set_title('质量控制结果分布', fontsize=12, fontweight='bold')
        ax1.tick_params(axis='x', rotation=45)
        
        ax2 = axes[1]
        by_station = qc_summary.get('by_station', {})
        stations = list(by_station.keys())
        missing_ratios = [v['missing_ratio'] for v in by_station.values()]
        
        bars = ax2.bar(stations, missing_ratios, color='coral', alpha=0.7)
        
        for bar in bars:
            height = bar.get_height()
            ax2.text(bar.get_x() + bar.get_width()/2., height,
                    f'{height:.1f}%', ha='center', va='bottom')
            
        ax2.set_ylabel('缺测率 (%)')
        ax2.set_title('各站点缺测率', fontsize=12, fontweight='bold')
        ax2.tick_params(axis='x', rotation=45)
        
        plt.tight_layout()
        return fig
        
    def _plot_fill_summary(self, fill_summary: Dict) -> plt.Figure:
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        
        ax1 = axes[0]
        method_stats = fill_summary.get('fill_method_stats', {})
        
        if method_stats:
            labels = list(method_stats.keys())
            counts = list(method_stats.values())
            total = sum(counts)
            
            colors = plt.cm.Paired(np.linspace(0, 1, len(labels)))
            wedges, texts, autotexts = ax1.pie(
                counts, labels=labels, colors=colors, autopct='%1.1f%%',
                startangle=90
            )
            ax1.set_title(f'补全方法分布 (共 {total} 条)', 
                         fontsize=12, fontweight='bold')
        else:
            ax1.text(0.5, 0.5, '无补全记录', ha='center', va='center',
                    transform=ax1.transAxes, fontsize=14)
            ax1.set_title('补全方法分布', fontsize=12, fontweight='bold')
            
        ax2 = axes[1]
        by_station = fill_summary.get('by_station', {})
        
        if by_station:
            stations = list(by_station.keys())
            fill_ratios = [v['fill_ratio'] for v in by_station.values()]
            
            bars = ax2.bar(stations, fill_ratios, color='skyblue', alpha=0.7)
            
            for bar in bars:
                height = bar.get_height()
                ax2.text(bar.get_x() + bar.get_width()/2., height,
                        f'{height:.1f}%', ha='center', va='bottom')
                
            ax2.set_ylabel('补全率 (%)')
            ax2.set_title('各站点补全率', fontsize=12, fontweight='bold')
            ax2.tick_params(axis='x', rotation=45)
        else:
            ax2.text(0.5, 0.5, '无补全记录', ha='center', va='center',
                    transform=ax2.transAxes, fontsize=14)
            ax2.set_title('各站点补全率', fontsize=12, fontweight='bold')
            
        plt.tight_layout()
        return fig
        
    def _plot_station_comparison(self, original_df: pd.DataFrame,
                                 filled_df: pd.DataFrame) -> plt.Figure:
        station_col = self.config['station_column']
        time_col = self.config['time_column']
        value_col = self.config['value_column']
        
        stations = original_df[station_col].unique()
        
        fig, axes = plt.subplots(2, 1, figsize=(14, 10))
        
        ax1 = axes[0]
        
        for station in stations:
            station_df = original_df[original_df[station_col] == station]
            ax1.plot(station_df[time_col], station_df[value_col],
                    '-o', markersize=2, linewidth=1, label=station)
            
        ax1.set_ylabel('雨量 (mm)')
        ax1.set_title('各站点原始数据对比', fontsize=12, fontweight='bold')
        ax1.legend(loc='upper right')
        ax1.grid(True, alpha=0.3)
        
        ax2 = axes[1]
        
        for station in stations:
            station_df = filled_df[filled_df[station_col] == station]
            ax2.plot(station_df[time_col], station_df['filled_value'],
                    '-', linewidth=1.2, label=f'{station} (补全后)')
            
        ax2.set_ylabel('雨量 (mm)')
        ax2.set_xlabel('时间')
        ax2.set_title('各站点补全后数据对比', fontsize=12, fontweight='bold')
        ax2.legend(loc='upper right')
        ax2.grid(True, alpha=0.3)
        
        ax2.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d %H:%M'))
        plt.xticks(rotation=45)
        
        plt.tight_layout()
        return fig
        
    def _generate_tables(self, original_df: pd.DataFrame,
                        qc_df: pd.DataFrame,
                        filled_df: pd.DataFrame,
                        qc_summary: Dict,
                        fill_summary: Dict,
                        qc_module: Any,
                        loading_errors: List[Dict]) -> Dict:
        tables = {}
        
        tables['overview'] = self._generate_overview_table(
            original_df, qc_df, filled_df, qc_summary, fill_summary
        )
        
        tables['by_station'] = self._generate_station_table(
            qc_summary, fill_summary
        )
        
        tables['qc_results'] = self._generate_qc_detail_table(qc_module)
        tables['failed_samples'] = self._generate_failed_samples_table(qc_module)
        tables['fill_results'] = self._generate_fill_detail_table(fill_summary)
        tables['loading_errors'] = self._generate_loading_errors_table(loading_errors)
        tables['final_data'] = self._generate_final_data_table(filled_df)
        
        return tables
        
    def _generate_overview_table(self, original_df: pd.DataFrame,
                                 qc_df: pd.DataFrame,
                                 filled_df: pd.DataFrame,
                                 qc_summary: Dict,
                                 fill_summary: Dict) -> pd.DataFrame:
        station_col = self.config['station_column']
        time_col = self.config['time_column']
        value_col = self.config['value_column']
        
        overview_data = {
            '统计项': [
                '总记录数',
                '站点数量',
                '时间范围',
                '通过质控记录数',
                '缺测记录数',
                '异常记录数',
                '补全记录数',
                '原始数据均值 (mm)',
                '补全后数据均值 (mm)'
            ],
            '数值': [
                len(original_df),
                original_df[station_col].nunique(),
                f"{original_df[time_col].min().strftime('%Y-%m-%d %H:%M')} ~ {original_df[time_col].max().strftime('%Y-%m-%d %H:%M')}",
                len(qc_df[qc_df['qc_flag'] == 'PASS']),
                len(qc_df[qc_df['qc_flag'] == 'MISSING']),
                len(qc_df[qc_df['qc_flag'].isin(['FAIL', 'SPIKE', 'CONSTANT', 'LOGIC'])]),
                fill_summary.get('total_filled', 0),
                f"{original_df[value_col].mean():.2f}",
                f"{filled_df['filled_value'].mean():.2f}"
            ]
        }
        
        return pd.DataFrame(overview_data)
        
    def _generate_station_table(self, qc_summary: Dict,
                                fill_summary: Dict) -> pd.DataFrame:
        by_station_qc = qc_summary.get('by_station', {})
        by_station_fill = fill_summary.get('by_station', {})
        
        stations = list(by_station_qc.keys())
        
        table_data = []
        for station in stations:
            qc_data = by_station_qc.get(station, {})
            fill_data = by_station_fill.get(station, {})
            
            table_data.append({
                '站点': station,
                '总记录数': qc_data.get('total', 0),
                '通过质控': qc_data.get('pass_count', 0),
                '缺测数': qc_data.get('missing_count', 0),
                '异常数': qc_data.get('fail_count', 0),
                '缺测率 (%)': f"{qc_data.get('missing_ratio', 0):.1f}",
                '补全数': fill_data.get('filled_count', 0),
                '补全率 (%)': f"{fill_data.get('fill_ratio', 0):.1f}",
                '原始均值 (mm)': f"{fill_data.get('original_valid_mean', 0) or 0:.2f}",
                '补全均值 (mm)': f"{fill_data.get('filled_mean', 0) or 0:.2f}"
            })
            
        return pd.DataFrame(table_data)
        
    def _generate_qc_detail_table(self, qc_module: Any) -> pd.DataFrame:
        qc_results = qc_module.get_qc_results()
        
        table_data = []
        for test_name, results in qc_results.items():
            for result in results:
                table_data.append({
                    '检测项': test_name,
                    '站点': result.get('station', ''),
                    '时间': result.get('time', ''),
                    '原始值': result.get('value', ''),
                    '原因': result.get('reason', ''),
                    '详细信息': str({k: v for k, v in result.items() 
                                   if k not in ['index', 'station', 'time', 'value', 'reason']})
                })
                
        if not table_data:
            return pd.DataFrame(columns=['检测项', '站点', '时间', '原始值', '原因', '详细信息'])
            
        return pd.DataFrame(table_data)
        
    def _generate_failed_samples_table(self, qc_module: Any) -> pd.DataFrame:
        failed_samples = qc_module.get_failed_samples()
        
        if not failed_samples:
            return pd.DataFrame(columns=['检测项', '站点', '时间', '原始值', '原因', '处理动作'])
            
        table_data = []
        for sample in failed_samples:
            table_data.append({
                '检测项': sample.get('test_name', ''),
                '站点': sample.get('station', ''),
                '时间': sample.get('time', ''),
                '原始值': sample.get('value', ''),
                '原因': sample.get('reason', ''),
                '处理动作': sample.get('action', '')
            })
            
        return pd.DataFrame(table_data)
        
    def _generate_fill_detail_table(self, fill_summary: Dict) -> pd.DataFrame:
        fill_records = fill_summary.get('filled_records', [])
        
        if not fill_records:
            return pd.DataFrame(columns=['站点', '时间', '原始值', '补全值', '补全方法', '原始状态'])
            
        table_data = []
        for record in fill_records:
            table_data.append({
                '站点': record.get('station', ''),
                '时间': record.get('time', ''),
                '原始值': record.get('original_value', ''),
                '补全值': f"{record.get('filled_value', ''):.2f}" if record.get('filled_value') is not None else '',
                '补全方法': record.get('method', ''),
                '原始状态': f"{record.get('original_flag', '')} - {record.get('original_reason', '')}"
            })
            
        return pd.DataFrame(table_data)
        
    def _generate_loading_errors_table(self, loading_errors: List[Dict]) -> pd.DataFrame:
        if not loading_errors:
            return pd.DataFrame(columns=['步骤', '错误类型', '错误信息', '详细信息'])
            
        table_data = []
        for error in loading_errors:
            table_data.append({
                '步骤': error.get('step', ''),
                '错误类型': error.get('error_type', ''),
                '错误信息': error.get('error_message', ''),
                '详细信息': str({k: v for k, v in error.items() 
                               if k not in ['step', 'error_type', 'error_message']})
            })
            
        return pd.DataFrame(table_data)
        
    def _generate_final_data_table(self, filled_df: pd.DataFrame) -> pd.DataFrame:
        time_col = self.config['time_column']
        value_col = self.config['value_column']
        station_col = self.config['station_column']
        
        final_df = filled_df.copy()
        
        output_cols = [time_col, station_col, value_col, 'filled_value', 
                      'qc_flag', 'qc_reason', 'fill_method', 'is_filled']
        
        available_cols = [col for col in output_cols if col in final_df.columns]
        
        return final_df[available_cols]
