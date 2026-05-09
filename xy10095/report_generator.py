import os
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from config import AppConfig


plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False


@dataclass
class ReportOutput:
    html_path: str
    chart_paths: List[str]
    summary_text: str


class ReportGenerator:
    def __init__(self, config: AppConfig):
        self.config = config
        self.output_dir = config.output_dir

    def _ensure_output_dir(self):
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)

    def _plot_efficiency_ranking(self, inverter_df: pd.DataFrame, output_path: str) -> bool:
        if len(inverter_df) == 0:
            return False

        ranked = inverter_df[inverter_df['rank'].notna()].copy()
        if len(ranked) == 0:
            return False

        ranked = ranked.sort_values('adjusted_efficiency', ascending=True)

        fig, ax = plt.subplots(figsize=(12, max(6, len(ranked) * 0.4)))
        y_pos = np.arange(len(ranked))

        colors = plt.cm.RdYlGn(np.linspace(0.2, 0.8, len(ranked)))
        bars = ax.barh(y_pos, ranked['adjusted_efficiency'] * 100, color=colors, alpha=0.8)

        for i, (idx, row) in enumerate(ranked.iterrows()):
            qs = row['data_quality_score']
            rank_text = f"#{int(row['rank'])}"
            if qs < 0.7:
                rank_text += f" (QS: {qs:.2f}★)"
            ax.text(row['adjusted_efficiency'] * 100 + 0.5, i, rank_text, va='center', fontsize=9)

        ax.set_yticks(y_pos)
        ax.set_yticklabels(ranked['inverter_id'])
        ax.set_xlabel('调整后效率 (%)', fontsize=12)
        ax.set_title('逆变器效率排名 (温度修正后)', fontsize=14, fontweight='bold')
        ax.set_xlim(0, max(ranked['adjusted_efficiency'] * 100) * 1.15 if len(ranked) > 0 else 100)
        ax.grid(axis='x', alpha=0.3)

        unranked = inverter_df[inverter_df['rank'].isna()]
        if len(unranked) > 0:
            note = f"有 {len(unranked)} 台逆变器未参与排名（数据质量不足）"
            plt.figtext(0.02, 0.01, note, fontsize=10, color='orange')

        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        return True

    def _plot_efficiency_scatter(self, row_df: pd.DataFrame, output_path: str) -> bool:
        if len(row_df) == 0:
            return False

        valid = row_df[row_df['measured_efficiency'].notna() & (row_df['irradiance'] > 50)]
        if len(valid) == 0:
            return False

        fig, axes = plt.subplots(1, 2, figsize=(14, 6))

        ax1 = axes[0]
        scatter1 = ax1.scatter(
            valid['irradiance'],
            valid['measured_efficiency'] * 100,
            c=valid['temperature'],
            cmap='RdYlBu_r',
            alpha=0.6,
            s=30
        )
        ax1.set_xlabel('辐照度 (W/m²)', fontsize=11)
        ax1.set_ylabel('实测效率 (%)', fontsize=11)
        ax1.set_title('效率 vs 辐照度 (颜色表示温度)', fontsize=12, fontweight='bold')
        ax1.axhline(y=98, color='r', linestyle='--', alpha=0.5, label='标称效率 98%')
        ax1.legend()
        ax1.grid(alpha=0.3)
        plt.colorbar(scatter1, ax=ax1, label='温度 (°C)')

        ax2 = axes[1]
        valid_gen = valid[valid['theoretical_generation'] > 0]
        if len(valid_gen) > 0:
            max_val = max(valid_gen['generation'].max(), valid_gen['theoretical_generation'].max())
            ax2.scatter(
                valid_gen['theoretical_generation'],
                valid_gen['generation'],
                alpha=0.6,
                s=30
            )
            ax2.plot([0, max_val], [0, max_val], 'r--', alpha=0.5, label='理论=实测')
            ax2.set_xlabel('理论发电量 (kWh)', fontsize=11)
            ax2.set_ylabel('实际发电量 (kWh)', fontsize=11)
            ax2.set_title('实测 vs 理论发电量', fontsize=12, fontweight='bold')
            ax2.legend()
            ax2.grid(alpha=0.3)
            ax2.set_xlim(0, max_val)
            ax2.set_ylim(0, max_val)

        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        return True

    def _plot_qc_summary(self, qc_result, output_path: str) -> bool:
        issues = qc_result.issues
        if len(issues) == 0:
            return False

        issue_types = {}
        for issue in issues:
            issue_types[issue.issue_type] = issue_types.get(issue.issue_type, 0) + 1

        fig, axes = plt.subplots(1, 2, figsize=(14, 6))

        ax1 = axes[0]
        types = list(issue_types.keys())
        counts = list(issue_types.values())
        colors = plt.cm.Set2(np.linspace(0, 1, len(types)))
        bars = ax1.bar(types, counts, color=colors, alpha=0.8)
        ax1.set_xlabel('问题类型', fontsize=11)
        ax1.set_ylabel('数量', fontsize=11)
        ax1.set_title('质量问题类型分布', fontsize=12, fontweight='bold')
        ax1.tick_params(axis='x', rotation=45)
        for bar, count in zip(bars, counts):
            ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + max(counts)*0.02,
                    str(count), ha='center', fontsize=10)
        ax1.grid(axis='y', alpha=0.3)

        ax2 = axes[1]
        total = qc_result.summary['total_raw_rows']
        clean = qc_result.summary['total_clean_rows']
        excluded = total - clean
        labels = ['有效数据', '排除数据']
        sizes = [clean, excluded]
        colors = ['#4CAF50', '#F44336']
        if sizes[1] > 0:
            ax2.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%',
                   startangle=90, textprops={'fontsize': 11})
            ax2.set_title(f'数据质量概览 (共 {total} 条)', fontsize=12, fontweight='bold')
        else:
            ax2.text(0.5, 0.5, f"全部 {total} 条数据有效！", ha='center', va='center', fontsize=14)
            ax2.axis('off')

        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        return True

    def _plot_inverter_comparison(self, inverter_df: pd.DataFrame, output_path: str) -> bool:
        if len(inverter_df) == 0:
            return False

        valid = inverter_df[inverter_df['rank'].notna()]
        if len(valid) < 2:
            return False

        fig, axes = plt.subplots(2, 2, figsize=(14, 10))

        ax1 = axes[0, 0]
        valid_sorted = valid.sort_values('performance_ratio', ascending=True)
        y_pos = np.arange(len(valid_sorted))
        ax1.barh(y_pos, valid_sorted['performance_ratio'], color='skyblue', alpha=0.8)
        ax1.set_yticks(y_pos)
        ax1.set_yticklabels(valid_sorted['inverter_id'])
        ax1.set_xlabel('PR (性能比)', fontsize=10)
        ax1.set_title('逆变器性能比 (PR) 对比', fontsize=11, fontweight='bold')
        ax1.grid(axis='x', alpha=0.3)

        ax2 = axes[0, 1]
        valid_sorted2 = valid.sort_values('data_quality_score', ascending=True)
        y_pos2 = np.arange(len(valid_sorted2))
        colors_qc = ['red' if x < 0.6 else 'orange' if x < 0.8 else 'green'
                     for x in valid_sorted2['data_quality_score']]
        ax2.barh(y_pos2, valid_sorted2['data_quality_score'], color=colors_qc, alpha=0.8)
        ax2.set_yticks(y_pos2)
        ax2.set_yticklabels(valid_sorted2['inverter_id'])
        ax2.set_xlabel('数据质量分数 (0-1)', fontsize=10)
        ax2.set_title('数据质量分数', fontsize=11, fontweight='bold')
        ax2.axvline(x=0.5, color='red', linestyle='--', alpha=0.5, label='最低阈值')
        ax2.legend()
        ax2.set_xlim(0, 1)
        ax2.grid(axis='x', alpha=0.3)

        ax3 = axes[1, 0]
        ax3.scatter(valid['adjusted_efficiency'] * 100, valid['performance_ratio'],
                   c=valid['sample_count'], cmap='viridis', alpha=0.7, s=100)
        ax3.set_xlabel('调整后效率 (%)', fontsize=10)
        ax3.set_ylabel('PR', fontsize=10)
        ax3.set_title('效率 vs PR (大小=样本量)', fontsize=11, fontweight='bold')
        ax3.grid(alpha=0.3)

        ax4 = axes[1, 1]
        box_data = []
        labels_box = []
        for _, row in valid.iterrows():
            if pd.notna(row['adjusted_efficiency']):
                box_data.append([row['measured_efficiency'] * 100, row['adjusted_efficiency'] * 100])
                labels_box.append(row['inverter_id'])
        if len(box_data) > 0:
            df_box = pd.DataFrame(box_data, columns=['实测效率', '调整后效率'], index=labels_box)
            df_box.T.boxplot(ax=ax4, rot=45)
            ax4.set_ylabel('效率 (%)', fontsize=10)
            ax4.set_title('实测 vs 调整后效率', fontsize=11, fontweight='bold')
            ax4.grid(axis='y', alpha=0.3)

        plt.tight_layout()
        plt.savefig(output_path, dpi=150, bbox_inches='tight')
        plt.close()
        return True

    def _build_html_report(
        self,
        load_result,
        qc_result,
        calc_result,
        chart_paths: Dict[str, str],
        timestamp: str
    ) -> str:
        overall = calc_result.overall_metrics
        summary = qc_result.summary
        metadata = calc_result.calculation_metadata

        issues_html = ""
        if len(qc_result.issues) > 0:
            issues_df = pd.DataFrame([vars(issue) for issue in qc_result.issues[:100]])
            issues_html = f"""
            <div class="section">
                <h3>质量问题详情 (前100条)</h3>
                <div class="table-wrapper">
                    {issues_df[['inverter_id', 'timestamp', 'field', 'issue_type', 'description', 'action']].to_html(
                        index=False, classes='data-table'
                    )}
                </div>
            </div>
            """

        inverter_table = ""
        if len(calc_result.inverter_level_data) > 0:
            display_cols = ['inverter_id', 'rank', 'adjusted_efficiency', 'measured_efficiency',
                           'performance_ratio', 'data_quality_score', 'sample_count', 'rank_reason']
            display_df = calc_result.inverter_level_data.copy()
            display_df['adjusted_efficiency'] = display_df['adjusted_efficiency'].apply(
                lambda x: f"{x*100:.2f}%" if pd.notna(x) else "-"
            )
            display_df['measured_efficiency'] = display_df['measured_efficiency'].apply(
                lambda x: f"{x*100:.2f}%" if pd.notna(x) else "-"
            )
            display_df['performance_ratio'] = display_df['performance_ratio'].apply(
                lambda x: f"{x:.3f}" if pd.notna(x) else "-"
            )
            display_df['data_quality_score'] = display_df['data_quality_score'].apply(
                lambda x: f"{x:.2f}"
            )
            display_df['rank'] = display_df['rank'].apply(
                lambda x: int(x) if pd.notna(x) else "-"
            )
            inverter_table = f"""
            <div class="section">
                <h3>逆变器效率排名表</h3>
                <div class="table-wrapper">
                    {display_df[display_cols].to_html(index=False, classes='data-table', na_rep='-')}
                </div>
            </div>
            """

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>光伏逆变器效率复算报告</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1400px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }}
        h2 {{ color: #34495e; margin-top: 30px; }}
        h3 {{ color: #5d6d7e; }}
        .section {{ margin: 20px 0; padding: 20px; background: #fafafa; border-radius: 6px; }}
        .metric-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }}
        .metric-card {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }}
        .metric-card.green {{ background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }}
        .metric-card.orange {{ background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }}
        .metric-card.blue {{ background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }}
        .metric-value {{ font-size: 28px; font-weight: bold; }}
        .metric-label {{ font-size: 14px; opacity: 0.9; margin-top: 5px; }}
        .data-table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
        .data-table th {{ background: #3498db; color: white; padding: 12px; text-align: left; }}
        .data-table td {{ padding: 10px; border-bottom: 1px solid #ddd; }}
        .data-table tr:hover {{ background: #f0f8ff; }}
        .table-wrapper {{ overflow-x: auto; }}
        .chart-container {{ margin: 20px 0; text-align: center; }}
        .chart-container img {{ max-width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        .warning {{ background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 10px 0; border-radius: 4px; }}
        .error {{ background: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 10px 0; border-radius: 4px; }}
        .success {{ background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 10px 0; border-radius: 4px; }}
        .footer {{ text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #7f8c8d; font-size: 12px; }}
        ul {{ line-height: 1.8; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>☀️ 光伏逆变器效率复算报告</h1>
        <p><strong>生成时间:</strong> {timestamp}</p>

        <div class="section">
            <h2>📋 执行概要</h2>
            <div class="metric-grid">
                <div class="metric-card blue">
                    <div class="metric-value">{overall.get('total_inverters', 0)}</div>
                    <div class="metric-label">逆变器总数</div>
                </div>
                <div class="metric-card green">
                    <div class="metric-value">{overall.get('ranked_inverters', 0)}</div>
                    <div class="metric-label">有效排名数</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">{overall.get('total_valid_samples', 0)}</div>
                    <div class="metric-label">有效样本数</div>
                </div>
                <div class="metric-card orange">
                    <div class="metric-value">{overall.get('average_adjusted_efficiency', 0)*100:.1f}%</div>
                    <div class="metric-label">平均调整后效率</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>📊 总体指标</h2>
            <ul>
                <li><strong>平均实测效率:</strong> {overall.get('average_measured_efficiency', 0)*100:.2f}%</li>
                <li><strong>平均调整后效率:</strong> {overall.get('average_adjusted_efficiency', 0)*100:.2f}%</li>
                <li><strong>中位调整后效率:</strong> {overall.get('median_adjusted_efficiency', 0)*100:.2f}%</li>
                <li><strong>效率标准差:</strong> {overall.get('efficiency_std', 0)*100:.2f}%</li>
                <li><strong>最高效率:</strong> {overall.get('max_efficiency', 0)*100:.2f}%</li>
                <li><strong>最低效率:</strong> {overall.get('min_efficiency', 0)*100:.2f}%</li>
                <li><strong>平均 PR:</strong> {overall.get('average_pr', 0):.3f}</li>
            </ul>
        </div>

        <div class="section">
            <h2>🔍 数据质量报告</h2>
            <ul>
                <li><strong>原始数据行数:</strong> {summary.get('total_raw_rows', 0)}</li>
                <li><strong>清洗后行数:</strong> {summary.get('total_clean_rows', 0)}</li>
                <li><strong>排除行数:</strong> {summary.get('rows_excluded', 0)}</li>
                <li><strong>排除率:</strong> {summary.get('exclusion_rate', 0)*100:.2f}%</li>
            </ul>
            <h4>问题类型分布:</h4>
            <ul>
                {''.join([f"<li><strong>{k}:</strong> {v}</li>" for k, v in summary.get('issues_by_type', {}).items()])}
            </ul>
        </div>

        {inverter_table}

        <div class="section">
            <h2>📈 图表分析</h2>
            {f'<div class="chart-container"><img src="{chart_paths.get("ranking", "")}" alt="效率排名"></div>' if chart_paths.get("ranking") else ''}
            {f'<div class="chart-container"><img src="{chart_paths.get("scatter", "")}" alt="散点分析"></div>' if chart_paths.get("scatter") else ''}
            {f'<div class="chart-container"><img src="{chart_paths.get("qc", "")}" alt="质量控制"></div>' if chart_paths.get("qc") else ''}
            {f'<div class="chart-container"><img src="{chart_paths.get("comparison", "")}" alt="逆变器对比"></div>' if chart_paths.get("comparison") else ''}
        </div>

        {issues_html}

        <div class="section">
            <h2>⚙️ 计算参数</h2>
            <ul>
                <li><strong>标称逆变器效率:</strong> {metadata.get('nominal_inverter_efficiency', 0)*100}%</li>
                <li><strong>温度系数:</strong> {metadata.get('temperature_coefficient', 0)}/°C</li>
                <li><strong>参考温度:</strong> {metadata.get('reference_temperature_celsius', 0)}°C</li>
                <li><strong>STC 辐照度:</strong> {metadata.get('stc_irradiance_wm2', 0)} W/m²</li>
                <li><strong>估计采样间隔:</strong> {metadata.get('estimated_sampling_interval_hours', 0):.2f} 小时</li>
                <li><strong>DC/AC 容配比:</strong> {metadata.get('dc_ac_ratio_assumed', 0)}</li>
            </ul>
        </div>

        <div class="section">
            <h2>⚠️ 加载警告信息</h2>
            {''.join([f'<div class="warning">⚠️ {w}</div>' for w in load_result.warnings]) if load_result.warnings else '<div class="success">✅ 无警告</div>'}
            {''.join([f'<div class="error">❌ {e}</div>' for e in load_result.errors]) if load_result.errors else ''}
        </div>

        <div class="footer">
            光伏逆变器效率复算器 | 报告生成于 {timestamp}
        </div>
    </div>
</body>
</html>
"""
        return html

    def generate(
        self,
        load_result,
        qc_result,
        calc_result,
        base_name: str = "inverter_report"
    ) -> ReportOutput:
        self._ensure_output_dir()
        timestamp = pd.Timestamp.now().strftime("%Y%m%d_%H%M%S")
        chart_paths = {}
        all_paths = []

        ranking_path = os.path.join(self.output_dir, f"{base_name}_ranking_{timestamp}.png")
        if self._plot_efficiency_ranking(calc_result.inverter_level_data, ranking_path):
            chart_paths['ranking'] = ranking_path
            all_paths.append(ranking_path)

        scatter_path = os.path.join(self.output_dir, f"{base_name}_scatter_{timestamp}.png")
        if self._plot_efficiency_scatter(calc_result.row_level_data, scatter_path):
            chart_paths['scatter'] = scatter_path
            all_paths.append(scatter_path)

        qc_path = os.path.join(self.output_dir, f"{base_name}_qc_{timestamp}.png")
        if self._plot_qc_summary(qc_result, qc_path):
            chart_paths['qc'] = qc_path
            all_paths.append(qc_path)

        comparison_path = os.path.join(self.output_dir, f"{base_name}_comparison_{timestamp}.png")
        if self._plot_inverter_comparison(calc_result.inverter_level_data, comparison_path):
            chart_paths['comparison'] = comparison_path
            all_paths.append(comparison_path)

        html_content = self._build_html_report(
            load_result,
            qc_result,
            calc_result,
            chart_paths,
            pd.Timestamp.now().strftime("%Y-%m-%d %H:%M:%S")
        )

        html_path = os.path.join(self.output_dir, f"{base_name}_{timestamp}.html")
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        summary = f"""
报告生成完成:
- HTML 报告: {html_path}
- 图表数量: {len(all_paths)}
- 有效逆变器: {calc_result.overall_metrics.get('ranked_inverters', 0)} / {calc_result.overall_metrics.get('total_inverters', 0)}
"""

        return ReportOutput(
            html_path=html_path,
            chart_paths=all_paths,
            summary_text=summary
        )
