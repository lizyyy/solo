"""图表和表格报告生成模块。"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.font_manager as fm
from pathlib import Path
from typing import Dict, List, Optional, Any
from .config import AnalysisConfig
from .logger import AnalysisLogger
from .consistency_analyzer import AnalysisResult
from .quality_control import QCReport


class ReportGenerator:
    """报告生成器。"""
    
    def __init__(self, config: AnalysisConfig, logger: Optional[AnalysisLogger] = None):
        self.config = config
        self.logger = logger or AnalysisLogger(
            log_to_file=config.log_to_file,
            log_file=config.log_file,
            log_level=config.log_level
        )
        self._setup_plot_style()
    
    def _setup_plot_style(self) -> None:
        """设置绘图样式。"""
        plt.style.use('seaborn-v0_8-whitegrid')
        
        font_names = ['Arial Unicode MS', 'SimHei', 'Heiti TC', 'PingFang SC', 
                      'Microsoft YaHei', 'STHeiti', 'Noto Sans CJK SC']
        
        for font_name in font_names:
            try:
                plt.rcParams['font.sans-serif'] = [font_name]
                plt.rcParams['axes.unicode_minus'] = False
                break
            except:
                continue
        
        plt.rcParams['figure.figsize'] = self.config.figure_size
        plt.rcParams['figure.dpi'] = self.config.plot_dpi
        plt.rcParams['font.size'] = 10
        plt.rcParams['axes.titlesize'] = 14
        plt.rcParams['axes.labelsize'] = 12
        plt.rcParams['xtick.labelsize'] = 10
        plt.rcParams['ytick.labelsize'] = 10
    
    def generate_all_plots(self, df: pd.DataFrame, 
                           analysis_result: AnalysisResult,
                           output_dir: str) -> Dict[str, str]:
        """生成所有图表。"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        plot_files = {}
        
        self.logger.info("报告", "开始生成图表...")
        
        plot_files['capacity_curves'] = self._plot_capacity_curves(df, output_path)
        plot_files['capacity_retention'] = self._plot_capacity_retention(df, output_path)
        plot_files['initial_capacity_dist'] = self._plot_initial_capacity_distribution(
            analysis_result, output_path
        )
        plot_files['fade_rate_dist'] = self._plot_fade_rate_distribution(
            analysis_result, output_path
        )
        plot_files['consistency_radar'] = self._plot_consistency_radar(
            analysis_result, output_path
        )
        plot_files['battery_comparison'] = self._plot_battery_comparison(
            analysis_result, output_path
        )
        
        self.logger.info("报告", f"图表生成完成，共 {len(plot_files)} 个图表")
        
        return plot_files
    
    def _plot_capacity_curves(self, df: pd.DataFrame, output_path: Path) -> str:
        """绘制容量-循环曲线。"""
        fig, ax = plt.subplots(figsize=self.config.figure_size)
        
        for battery_id, group in df.groupby('battery_id'):
            group = group.sort_values('cycle')
            ax.plot(group['cycle'], group['capacity'], 
                   label=str(battery_id), linewidth=1.5, alpha=0.8)
        
        ax.set_xlabel('循环次数', fontsize=12)
        ax.set_ylabel('容量 (mAh)', fontsize=12)
        ax.set_title('电池容量衰减曲线', fontsize=14, fontweight='bold')
        ax.legend(loc='best', ncol=2, fontsize=8)
        ax.grid(True, alpha=0.3)
        
        filename = output_path / 'capacity_vs_cycle.png'
        plt.savefig(filename, dpi=self.config.plot_dpi, bbox_inches='tight')
        plt.close()
        
        return str(filename)
    
    def _plot_capacity_retention(self, df: pd.DataFrame, output_path: Path) -> str:
        """绘制容量保持率曲线。"""
        fig, ax = plt.subplots(figsize=self.config.figure_size)
        
        for battery_id, group in df.groupby('battery_id'):
            group = group.sort_values('cycle')
            if len(group) > 0:
                initial_cap = group['capacity'].iloc[0]
                if initial_cap > 0:
                    retention = (group['capacity'] / initial_cap) * 100
                    ax.plot(group['cycle'], retention, 
                           label=str(battery_id), linewidth=1.5, alpha=0.8)
        
        ax.axhline(y=80, color='r', linestyle='--', alpha=0.7, label='80% 阈值')
        
        ax.set_xlabel('循环次数', fontsize=12)
        ax.set_ylabel('容量保持率 (%)', fontsize=12)
        ax.set_title('电池容量保持率曲线', fontsize=14, fontweight='bold')
        ax.legend(loc='best', ncol=2, fontsize=8)
        ax.grid(True, alpha=0.3)
        ax.set_ylim([60, 105])
        
        filename = output_path / 'capacity_retention.png'
        plt.savefig(filename, dpi=self.config.plot_dpi, bbox_inches='tight')
        plt.close()
        
        return str(filename)
    
    def _plot_initial_capacity_distribution(self, 
                                           analysis_result: AnalysisResult,
                                           output_path: Path) -> str:
        """绘制初始容量分布图。"""
        if not analysis_result.battery_metrics:
            return ""
        
        initial_caps = [m.initial_capacity for m in analysis_result.battery_metrics.values()]
        battery_ids = list(analysis_result.battery_metrics.keys())
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        
        ax1 = axes[0]
        ax1.bar(range(len(battery_ids)), initial_caps, alpha=0.7, color='steelblue')
        ax1.set_xlabel('电池编号', fontsize=11)
        ax1.set_ylabel('初始容量 (mAh)', fontsize=11)
        ax1.set_title('各电池初始容量对比', fontsize=13, fontweight='bold')
        ax1.set_xticks(range(len(battery_ids)))
        ax1.set_xticklabels(battery_ids, rotation=45, ha='right', fontsize=8)
        
        mean_cap = np.mean(initial_caps)
        ax1.axhline(y=mean_cap, color='r', linestyle='--', 
                   alpha=0.7, label=f'均值: {mean_cap:.1f} mAh')
        ax1.legend(fontsize=9)
        ax1.grid(axis='y', alpha=0.3)
        
        ax2 = axes[1]
        n, bins, patches = ax2.hist(initial_caps, bins='auto', alpha=0.7, 
                                   color='steelblue', edgecolor='white')
        ax2.set_xlabel('初始容量 (mAh)', fontsize=11)
        ax2.set_ylabel('频数', fontsize=11)
        ax2.set_title('初始容量分布', fontsize=13, fontweight='bold')
        ax2.axvline(x=mean_cap, color='r', linestyle='--', alpha=0.7)
        ax2.grid(axis='y', alpha=0.3)
        
        plt.tight_layout()
        filename = output_path / 'initial_capacity_distribution.png'
        plt.savefig(filename, dpi=self.config.plot_dpi, bbox_inches='tight')
        plt.close()
        
        return str(filename)
    
    def _plot_fade_rate_distribution(self,
                                    analysis_result: AnalysisResult,
                                    output_path: Path) -> str:
        """绘制衰减率分布图。"""
        if not analysis_result.battery_metrics:
            return ""
        
        fade_rates = [m.capacity_fade_rate for m in analysis_result.battery_metrics.values()]
        battery_ids = list(analysis_result.battery_metrics.keys())
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        
        ax1 = axes[0]
        colors = ['red' if fr > np.mean(fade_rates) * 1.2 else 'steelblue' for fr in fade_rates]
        ax1.bar(range(len(battery_ids)), fade_rates, alpha=0.7, color=colors)
        ax1.set_xlabel('电池编号', fontsize=11)
        ax1.set_ylabel('衰减率 (%/循环)', fontsize=11)
        ax1.set_title('各电池衰减率对比', fontsize=13, fontweight='bold')
        ax1.set_xticks(range(len(battery_ids)))
        ax1.set_xticklabels(battery_ids, rotation=45, ha='right', fontsize=8)
        
        mean_fade = np.mean(fade_rates)
        ax1.axhline(y=mean_fade, color='r', linestyle='--', 
                   alpha=0.7, label=f'均值: {mean_fade:.4f}')
        ax1.legend(fontsize=9)
        ax1.grid(axis='y', alpha=0.3)
        
        ax2 = axes[1]
        ax2.boxplot(fade_rates, vert=True, patch_artist=True)
        ax2.set_ylabel('衰减率 (%/循环)', fontsize=11)
        ax2.set_title('衰减率箱线图', fontsize=13, fontweight='bold')
        ax2.grid(axis='y', alpha=0.3)
        
        plt.tight_layout()
        filename = output_path / 'fade_rate_distribution.png'
        plt.savefig(filename, dpi=self.config.plot_dpi, bbox_inches='tight')
        plt.close()
        
        return str(filename)
    
    def _plot_consistency_radar(self,
                               analysis_result: AnalysisResult,
                               output_path: Path) -> str:
        """绘制一致性雷达图。"""
        metrics = analysis_result.consistency_metrics
        if metrics is None:
            return ""
        
        categories = ['初始容量CV', '衰减率CV', '综合CV']
        values = [
            min(metrics.cv_initial_capacity * 10, 100),
            min(metrics.cv_fade_rate * 10, 100),
            min(metrics.cv_cv_score * 10, 100)
        ]
        
        levels = {
            '优秀': 20,
            '良好': 50,
            '一般': 100,
            '较差': 150
        }
        
        fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(projection='polar'))
        
        angles = np.linspace(0, 2 * np.pi, len(categories), endpoint=False).tolist()
        values += values[:1]
        angles += angles[:1]
        
        ax.plot(angles, values, 'o-', linewidth=2, color='steelblue')
        ax.fill(angles, values, alpha=0.25, color='steelblue')
        
        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(categories, fontsize=11)
        ax.set_yticks([20, 50, 100])
        ax.set_yticklabels(['优秀', '良好', '一般'], fontsize=9)
        ax.set_ylim([0, 120])
        ax.set_title(f'一致性评估 (等级: {metrics.consistency_level})', 
                    fontsize=14, fontweight='bold', pad=20)
        
        ax.grid(True)
        
        filename = output_path / 'consistency_radar.png'
        plt.savefig(filename, dpi=self.config.plot_dpi, bbox_inches='tight')
        plt.close()
        
        return str(filename)
    
    def _plot_battery_comparison(self,
                                analysis_result: AnalysisResult,
                                output_path: Path) -> str:
        """绘制电池性能综合对比图。"""
        if not analysis_result.battery_metrics:
            return ""
        
        df_metrics = pd.DataFrame([
            {
                '电池编号': m.battery_id,
                '初始容量': m.initial_capacity,
                '衰减率': m.capacity_fade_rate,
                '最大循环': m.max_cycle
            }
            for m in analysis_result.battery_metrics.values()
        ])
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 12))
        
        ax1 = axes[0, 0]
        ax1.scatter(df_metrics['初始容量'], df_metrics['衰减率'], 
                   alpha=0.7, s=100, edgecolors='white')
        ax1.set_xlabel('初始容量 (mAh)', fontsize=11)
        ax1.set_ylabel('衰减率 (%/循环)', fontsize=11)
        ax1.set_title('初始容量 vs 衰减率', fontsize=12, fontweight='bold')
        ax1.grid(True, alpha=0.3)
        
        for i, row in df_metrics.iterrows():
            ax1.annotate(row['电池编号'], 
                        (row['初始容量'], row['衰减率']),
                        fontsize=8, alpha=0.7)
        
        ax2 = axes[0, 1]
        ax2.scatter(df_metrics['初始容量'], df_metrics['最大循环'],
                   alpha=0.7, s=100, edgecolors='white')
        ax2.set_xlabel('初始容量 (mAh)', fontsize=11)
        ax2.set_ylabel('最大循环次数', fontsize=11)
        ax2.set_title('初始容量 vs 最大循环', fontsize=12, fontweight='bold')
        ax2.grid(True, alpha=0.3)
        
        for i, row in df_metrics.iterrows():
            ax2.annotate(row['电池编号'],
                        (row['初始容量'], row['最大循环']),
                        fontsize=8, alpha=0.7)
        
        ax3 = axes[1, 0]
        df_sorted = df_metrics.sort_values('初始容量')
        ax3.barh(df_sorted['电池编号'], df_sorted['初始容量'], 
                alpha=0.7, color='steelblue')
        ax3.set_xlabel('初始容量 (mAh)', fontsize=11)
        ax3.set_title('初始容量排名', fontsize=12, fontweight='bold')
        ax3.grid(axis='x', alpha=0.3)
        
        ax4 = axes[1, 1]
        df_sorted_fade = df_metrics.sort_values('衰减率')
        ax4.barh(df_sorted_fade['电池编号'], df_sorted_fade['衰减率'],
                alpha=0.7, color='orange')
        ax4.set_xlabel('衰减率 (%/循环)', fontsize=11)
        ax4.set_title('衰减率排名', fontsize=12, fontweight='bold')
        ax4.grid(axis='x', alpha=0.3)
        
        plt.tight_layout()
        filename = output_path / 'battery_comparison.png'
        plt.savefig(filename, dpi=self.config.plot_dpi, bbox_inches='tight')
        plt.close()
        
        return str(filename)
    
    def generate_summary_table(self,
                              analysis_result: AnalysisResult,
                              qc_report: QCReport
                              ) -> pd.DataFrame:
        """生成汇总表格。"""
        summary_data = []
        
        batch_summary = analysis_result.batch_summary
        
        summary_data.append({
            '指标类别': '批次信息',
            '指标': '电池数量',
            '数值': batch_summary.get('电池数量', 0),
            '单位': '个'
        })
        
        init_stats = batch_summary.get('初始容量统计', {})
        for key, value in init_stats.items():
            if value is not None:
                summary_data.append({
                    '指标类别': '初始容量',
                    '指标': key,
                    '数值': value,
                    '单位': ''
                })
        
        fade_stats = batch_summary.get('衰减率统计', {})
        for key, value in fade_stats.items():
            if value is not None:
                summary_data.append({
                    '指标类别': '衰减率',
                    '指标': key,
                    '数值': value,
                    '单位': ''
                })
        
        consistency = batch_summary.get('一致性评估', {})
        for key, value in consistency.items():
            summary_data.append({
                '指标类别': '一致性',
                '指标': key,
                '数值': value,
                '单位': ''
            })
        
        summary_data.append({
            '指标类别': '质量控制',
            '指标': '通过样本数',
            '数值': qc_report.passed_samples,
            '单位': '个'
        })
        
        summary_data.append({
            '指标类别': '质量控制',
            '指标': '警告样本数',
            '数值': qc_report.warning_samples,
            '单位': '个'
        })
        
        summary_data.append({
            '指标类别': '质量控制',
            '指标': '失败样本数',
            '数值': qc_report.failed_samples,
            '单位': '个'
        })
        
        return pd.DataFrame(summary_data)
