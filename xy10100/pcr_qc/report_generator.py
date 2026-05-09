import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import seaborn as sns
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from jinja2 import Template
from datetime import datetime
import platform

from .data_loader import LoadedData, SampleType
from .qc_validator import QCResult, QCStatus, QCFailure, ControlCheckResult


def _setup_matplotlib_font():
    system = platform.system()
    if system == 'Darwin':
        plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'PingFang SC', 'STHeiti']
    elif system == 'Windows':
        plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'SimSun']
    else:
        plt.rcParams['font.sans-serif'] = ['DejaVu Sans', 'Noto Sans CJK JP']
    plt.rcParams['axes.unicode_minus'] = False

_setup_matplotlib_font()


@dataclass
class GeneratedReport:
    html_path: str
    excel_path: str
    charts: List[str]
    summary: Dict[str, Any]


class ReportGenerator:
    COLORS = {
        'pass': '#4CAF50',
        'warn': '#FF9800',
        'fail': '#F44336',
        'unknown': '#9E9E9E',
        'positive_control': '#E91E63',
        'negative_control': '#2196F3',
        'blank': '#607D8B',
        'standard': '#9C27B0',
        'sample': '#3F51B5',
    }

    HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PCR Ct值质控报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header .meta { opacity: 0.9; font-size: 14px; }
        
        .status-badge { display: inline-block; padding: 8px 20px; border-radius: 25px; font-weight: bold; font-size: 16px; }
        .status-pass { background: #4CAF50; }
        .status-warn { background: #FF9800; }
        .status-fail { background: #F44336; }
        
        .card { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .card h2 { font-size: 20px; margin-bottom: 15px; color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .stat-card { background: #f8f9fa; border-radius: 8px; padding: 15px; text-align: center; }
        .stat-value { font-size: 28px; font-weight: bold; color: #333; }
        .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
        
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; }
        tr:hover { background: #f8f9fa; }
        
        .control-result { display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; }
        .control-pass { background: #E8F5E9; color: #2E7D32; }
        .control-fail { background: #FFEBEE; color: #C62828; }
        
        .failure-item { border-left: 4px solid #F44336; padding: 15px; margin: 10px 0; background: #FFEBEE; border-radius: 4px; }
        .failure-item.warning { border-left-color: #FF9800; background: #FFF3E0; }
        .failure-sample { font-weight: bold; margin-bottom: 5px; }
        .failure-reason { color: #666; font-size: 14px; }
        .failure-details { font-family: monospace; font-size: 12px; color: #999; margin-top: 5px; }
        
        .charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 20px; }
        .chart-container { background: #fafafa; border-radius: 8px; padding: 10px; }
        .chart-container img { width: 100%; height: auto; display: block; }
        
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .tab { padding: 10px 20px; background: #e0e0e0; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; }
        .tab.active { background: #667eea; color: white; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        
        .data-issue { padding: 10px; border-left: 3px solid #2196F3; background: #E3F2FD; margin: 5px 0; border-radius: 3px; }
        .data-issue.error { border-left-color: #F44336; background: #FFEBEE; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔬 PCR Ct值质控报告</h1>
            <div class="meta">
                文件: {{ metadata.filename }} | 生成时间: {{ generation_time }}
            </div>
            <div style="margin-top: 15px;">
                总体质控状态: 
                <span class="status-badge status-{{ overall_status }}">
                    {{ overall_status.upper() }}
                </span>
            </div>
        </div>
        
        <div class="tabs">
            <button class="tab active" onclick="showTab('summary')">摘要</button>
            <button class="tab" onclick="showTab('controls')">对照检查</button>
            <button class="tab" onclick="showTab('failures')">失败样本</button>
            <button class="tab" onclick="showTab('charts')">图表分析</button>
            <button class="tab" onclick="showTab('data')">详细数据</button>
            <button class="tab" onclick="showTab('issues')">数据问题</button>
        </div>
        
        <div id="summary" class="tab-content active">
            <div class="card">
                <h2>📊 质控统计</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value" style="color: #333;">{{ statistics.valid_samples }}</div>
                        <div class="stat-label">有效样本数</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #4CAF50;">{{ statistics.pass_samples }}</div>
                        <div class="stat-label">通过样本</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #FF9800;">{{ statistics.warn_samples }}</div>
                        <div class="stat-label">警告样本</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: #F44336;">{{ statistics.fail_samples }}</div>
                        <div class="stat-label">失败样本</div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h2>📈 Ct值统计</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value">{{ ct_stats.mean if ct_stats.mean else 'N/A' }}</div>
                        <div class="stat-label">平均Ct值</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ ct_stats.median if ct_stats.median else 'N/A' }}</div>
                        <div class="stat-label">中位数Ct值</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ ct_stats.min if ct_stats.min else 'N/A' }}</div>
                        <div class="stat-label">最小Ct值</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">{{ ct_stats.max if ct_stats.max else 'N/A' }}</div>
                        <div class="stat-label">最大Ct值</div>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h2>🧬 对照状态</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value" style="color: {{ 'green' if positive_controls.passed == positive_controls.count else 'red' }};">
                            {{ positive_controls.passed }}/{{ positive_controls.count }}
                        </div>
                        <div class="stat-label">阳性对照</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: {{ 'green' if negative_controls.passed == negative_controls.count else 'red' }};">
                            {{ negative_controls.passed }}/{{ negative_controls.count }}
                        </div>
                        <div class="stat-label">阴性对照</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" style="color: {{ 'green' if blank_controls.passed == blank_controls.count else 'red' }};">
                            {{ blank_controls.passed }}/{{ blank_controls.count }}
                        </div>
                        <div class="stat-label">空白对照</div>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="controls" class="tab-content">
            <div class="card">
                <h2>🧬 对照检查详细结果</h2>
                <table>
                    <thead>
                        <tr>
                            <th>对照类型</th>
                            <th>样本ID</th>
                            <th>孔位</th>
                            <th>Ct值</th>
                            <th>期望值</th>
                            <th>实际值</th>
                            <th>状态</th>
                            <th>说明</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for check in control_checks %}
                        <tr>
                            <td>{{ check.control_type_display }}</td>
                            <td>{{ check.sample_id }}</td>
                            <td>{{ check.well }}</td>
                            <td>{{ check.ct_value if check.ct_value else '未检出' }}</td>
                            <td>{{ check.expected_status }}</td>
                            <td>{{ check.actual_status }}</td>
                            <td><span class="control-result {{ 'control-pass' if check.passed else 'control-fail' }}">
                                {{ '通过' if check.passed else '失败' }}
                            </span></td>
                            <td>{{ check.message }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
        </div>
        
        <div id="failures" class="tab-content">
            <div class="card">
                <h2>❌ 失败样本列表</h2>
                {% if failures %}
                    {% for failure in failures %}
                    <div class="failure-item {{ 'warning' if failure.severity == 'warn' else '' }}">
                        <div class="failure-sample">
                            样本: {{ failure.sample_id }} 
                            <span style="float: right; font-size: 12px;">
                                {{ '错误' if failure.severity == 'error' else '警告' }}
                            </span>
                        </div>
                        <div class="failure-reason">原因: {{ failure.reason }}</div>
                        <div class="failure-details">详情: {{ failure.details }}</div>
                    </div>
                    {% endfor %}
                {% else %}
                    <p style="color: #4CAF50; padding: 20px; text-align: center;">✓ 没有失败样本</p>
                {% endif %}
            </div>
        </div>
        
        <div id="charts" class="tab-content">
            <div class="card">
                <h2>📊 图表分析</h2>
                <div class="charts-grid">
                    {% for chart in charts %}
                    <div class="chart-container">
                        <img src="{{ chart }}" alt="图表">
                    </div>
                    {% endfor %}
                </div>
            </div>
        </div>
        
        <div id="data" class="tab-content">
            <div class="card">
                <h2>📋 样本详细数据</h2>
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>样本ID</th>
                                <th>孔位</th>
                                <th>类型</th>
                                <th>Ct值</th>
                                <th>QC状态</th>
                                <th>失败原因</th>
                            </tr>
                        </thead>
                        <tbody>
                            {% for row in sample_rows %}
                            <tr>
                                <td>{{ row.sample_id }}</td>
                                <td>{{ row.well }}</td>
                                <td>{{ row.sample_type_display }}</td>
                                <td>{{ row.ct_value if row.ct_value else '未检出' }}</td>
                                <td><span class="control-result {{ 'control-pass' if row.qc_status == 'pass' else 'control-fail' }}">
                                    {{ row.qc_status_display }}
                                </span></td>
                                <td>{{ row.qc_fail_reasons or '-' }}</td>
                            </tr>
                            {% endfor %}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <div id="issues" class="tab-content">
            <div class="card">
                <h2>⚠️ 数据加载问题</h2>
                {% if data_issues %}
                    {% for issue in data_issues %}
                    <div class="data-issue {{ 'error' if issue.severity == 'error' else '' }}">
                        <strong>{{ issue.issue_type }}</strong> ({{ issue.severity }})
                        {% if issue.sample_id %} - 样本: {{ issue.sample_id }}{% endif %}
                        {% if issue.column %} - 列: {{ issue.column }}{% endif %}
                        <br>
                        {{ issue.message }}
                    </div>
                    {% endfor %}
                {% else %}
                    <p style="color: #4CAF50; padding: 20px; text-align: center;">✓ 数据加载无问题</p>
                {% endif %}
            </div>
            
            {% if failed_samples_rows %}
            <div class="card">
                <h2>🔒 加载失败的样本</h2>
                <table>
                    <thead>
                        <tr>
                            <th>样本ID</th>
                            <th>孔位</th>
                            <th>原始Ct值</th>
                            <th>类型</th>
                        </tr>
                    </thead>
                    <tbody>
                        {% for row in failed_samples_rows %}
                        <tr>
                            <td>{{ row.sample_id or '-' }}</td>
                            <td>{{ row.well or '-' }}</td>
                            <td>{{ row.ct_value or '-' }}</td>
                            <td>{{ row.sample_type or '-' }}</td>
                        </tr>
                        {% endfor %}
                    </tbody>
                </table>
            </div>
            {% endif %}
        </div>
    </div>
    
    <script>
        function showTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            event.target.classList.add('active');
        }
    </script>
</body>
</html>
"""

    def __init__(self, output_dir: str = "./output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate(self, loaded_data: LoadedData, qc_result: QCResult) -> GeneratedReport:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_dir = self.output_dir / f"report_{timestamp}"
        report_dir.mkdir(parents=True, exist_ok=True)
        charts_dir = report_dir / "charts"
        charts_dir.mkdir(parents=True, exist_ok=True)

        charts = self._generate_charts(qc_result, charts_dir)
        html_path = self._generate_html_report(loaded_data, qc_result, charts, report_dir)
        excel_path = self._generate_excel_report(loaded_data, qc_result, report_dir)

        return GeneratedReport(
            html_path=str(html_path),
            excel_path=str(excel_path),
            charts=charts,
            summary={
                "overall_status": qc_result.overall_status.value,
                "pass_samples": qc_result.statistics['pass_samples'],
                "warn_samples": qc_result.statistics['warn_samples'],
                "fail_samples": qc_result.statistics['fail_samples'],
                "total_failures": qc_result.statistics['total_failures'],
                "report_dir": str(report_dir),
            }
        )

    def _generate_charts(self, qc_result: QCResult, charts_dir: Path) -> List[str]:
        charts = []
        
        charts.append(self._plot_ct_distribution(qc_result, charts_dir))
        charts.append(self._plot_status_distribution(qc_result, charts_dir))
        
        if qc_result.plate_heatmap_data is not None:
            charts.append(self._plot_plate_heatmap(qc_result, charts_dir))
        
        charts.append(self._plot_control_results(qc_result, charts_dir))
        
        return [str(p) for p in charts]

    def _plot_ct_distribution(self, qc_result: QCResult, charts_dir: Path) -> Path:
        df = qc_result.sample_results
        samples = df[df['sample_type'] == SampleType.SAMPLE]
        cts = samples['ct_value'].dropna()
        
        if len(cts) == 0:
            return self._create_empty_chart(charts_dir, "ct_distribution.png", "暂无Ct值数据")

        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        
        ax1 = axes[0]
        sns.histplot(cts, kde=True, ax=ax1, color=self.COLORS['sample'])
        ax1.set_title('Ct值分布直方图', fontsize=14, fontweight='bold')
        ax1.set_xlabel('Ct值')
        ax1.set_ylabel('频率')
        ax1.axvline(cts.mean(), color='red', linestyle='--', label=f'均值: {cts.mean():.2f}')
        ax1.axvline(cts.median(), color='orange', linestyle='--', label=f'中位数: {cts.median():.2f}')
        ax1.legend()
        
        ax2 = axes[1]
        status_groups = {
            '通过': samples[samples['qc_status'] == QCStatus.PASS.value]['ct_value'].dropna(),
            '警告': samples[samples['qc_status'] == QCStatus.WARN.value]['ct_value'].dropna(),
            '失败': samples[samples['qc_status'] == QCStatus.FAIL.value]['ct_value'].dropna(),
        }
        
        boxplot_data = [v for v in status_groups.values() if len(v) > 0]
        boxplot_labels = [k for k, v in status_groups.items() if len(v) > 0]
        
        if boxplot_data:
            ax2.boxplot(boxplot_data, labels=boxplot_labels)
        ax2.set_title('按QC状态分布的Ct值箱线图', fontsize=14, fontweight='bold')
        ax2.set_ylabel('Ct值')
        
        plt.tight_layout()
        path = charts_dir / "ct_distribution.png"
        plt.savefig(path, dpi=150, bbox_inches='tight')
        plt.close()
        return path

    def _plot_status_distribution(self, qc_result: QCResult, charts_dir: Path) -> Path:
        stats = qc_result.statistics
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        
        ax1 = axes[0]
        status_data = {
            '通过': stats['pass_samples'],
            '警告': stats['warn_samples'],
            '失败': stats['fail_samples'],
        }
        colors = [self.COLORS['pass'], self.COLORS['warn'], self.COLORS['fail']]
        
        wedges, texts, autotexts = ax1.pie(
            status_data.values(),
            labels=status_data.keys(),
            colors=colors,
            autopct='%1.1f%%',
            startangle=90
        )
        ax1.set_title('样本QC状态分布', fontsize=14, fontweight='bold')
        ax1.axis('equal')
        
        ax2 = axes[1]
        control_stats = {
            '阳性对照': stats['positive_controls']['count'],
            '阴性对照': stats['negative_controls']['count'],
            '空白对照': stats['blank_controls']['count'],
        }
        control_colors = [self.COLORS['positive_control'], self.COLORS['negative_control'], self.COLORS['blank']]
        
        bars = ax2.bar(control_stats.keys(), control_stats.values(), color=control_colors)
        ax2.set_title('对照数量统计', fontsize=14, fontweight='bold')
        ax2.set_ylabel('数量')
        
        for bar in bars:
            height = bar.get_height()
            ax2.text(bar.get_x() + bar.get_width()/2., height,
                    f'{int(height)}', ha='center', va='bottom')
        
        plt.tight_layout()
        path = charts_dir / "status_distribution.png"
        plt.savefig(path, dpi=150, bbox_inches='tight')
        plt.close()
        return path

    def _plot_plate_heatmap(self, qc_result: QCResult, charts_dir: Path) -> Path:
        heatmap_data = qc_result.plate_heatmap_data
        
        fig, ax = plt.subplots(figsize=(14, 6))
        
        cmap = plt.cm.RdYlGn_r
        cmap.set_bad(color='lightgray')
        
        im = ax.imshow(heatmap_data.values.astype(float), cmap=cmap, aspect='auto')
        
        ax.set_xticks(np.arange(len(heatmap_data.columns)))
        ax.set_yticks(np.arange(len(heatmap_data.index)))
        ax.set_xticklabels(heatmap_data.columns)
        ax.set_yticklabels(heatmap_data.index)
        
        ax.set_title('PCR板Ct值热力图', fontsize=14, fontweight='bold')
        ax.set_xlabel('列')
        ax.set_ylabel('行')
        
        for i in range(len(heatmap_data.index)):
            for j in range(len(heatmap_data.columns)):
                value = heatmap_data.iloc[i, j]
                if not pd.isna(value):
                    text = ax.text(j, i, f'{value:.1f}',
                                  ha='center', va='center', color='black', fontsize=8)
        
        plt.colorbar(im, label='Ct值')
        plt.tight_layout()
        
        path = charts_dir / "plate_heatmap.png"
        plt.savefig(path, dpi=150, bbox_inches='tight')
        plt.close()
        return path

    def _plot_control_results(self, qc_result: QCResult, charts_dir: Path) -> Path:
        control_checks = qc_result.control_checks
        
        if not control_checks:
            return self._create_empty_chart(charts_dir, "control_results.png", "暂无对照数据")

        fig, ax = plt.subplots(figsize=(12, 6))
        
        control_types = ['阳性对照', '阴性对照', '空白对照']
        type_mapping = {
            'positive_control': 0,
            'negative_control': 1,
            'blank': 2
        }
        
        colors = [self.COLORS['positive_control'], self.COLORS['negative_control'], self.COLORS['blank']]
        
        positions = []
        ct_values = []
        point_colors = []
        labels = []
        
        for i, check in enumerate(control_checks):
            type_idx = type_mapping.get(check.control_type, 0)
            offset = (i % 5 - 2) * 0.15
            x = type_idx + offset
            
            if check.ct_value is not None and not pd.isna(check.ct_value):
                positions.append(x)
                ct_values.append(check.ct_value)
                point_colors.append('green' if check.passed else 'red')
                labels.append('✓' if check.passed else '✗')
        
        if positions:
            scatter = ax.scatter(positions, ct_values, c=point_colors, s=100, alpha=0.8, zorder=3)
            
            for x, y, label in zip(positions, ct_values, labels):
                ax.text(x, y, label, ha='center', va='center', fontsize=12, fontweight='bold', color='white')
        
        ax.set_xticks(range(3))
        ax.set_xticklabels(control_types)
        ax.set_title('对照Ct值结果 (✓=通过, ✗=失败)', fontsize=14, fontweight='bold')
        ax.set_ylabel('Ct值')
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        path = charts_dir / "control_results.png"
        plt.savefig(path, dpi=150, bbox_inches='tight')
        plt.close()
        return path

    def _create_empty_chart(self, charts_dir: Path, filename: str, message: str) -> Path:
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.text(0.5, 0.5, message, ha='center', va='center', fontsize=16, color='gray')
        ax.set_axis_off()
        path = charts_dir / filename
        plt.savefig(path, dpi=150, bbox_inches='tight')
        plt.close()
        return path

    def _generate_html_report(self, loaded_data: LoadedData, qc_result: QCResult, 
                             charts: List[str], report_dir: Path) -> Path:
        template = Template(self.HTML_TEMPLATE)
        
        sample_rows = []
        for idx, row in qc_result.sample_results.iterrows():
            sample_type_display = {
                SampleType.SAMPLE: '样本',
                SampleType.POSITIVE_CONTROL: '阳性对照',
                SampleType.NEGATIVE_CONTROL: '阴性对照',
                SampleType.BLANK: '空白对照',
                SampleType.STANDARD: '标准品',
                SampleType.UNKNOWN: '未知',
            }.get(row['sample_type'], str(row['sample_type']))
            
            qc_status_display = {
                'pass': '通过',
                'warn': '警告',
                'fail': '失败',
                'unknown': '未知',
            }.get(row['qc_status'], row['qc_status'])
            
            sample_rows.append({
                'sample_id': row.get('sample_id', ''),
                'well': row.get('well', ''),
                'sample_type_display': sample_type_display,
                'ct_value': row['ct_value'] if not pd.isna(row['ct_value']) else None,
                'qc_status': row['qc_status'],
                'qc_status_display': qc_status_display,
                'qc_fail_reasons': row.get('qc_fail_reasons', ''),
            })
        
        control_checks_with_details = []
        for check in qc_result.control_checks:
            sample_match = qc_result.sample_results[
                qc_result.sample_results['sample_type_original'].str.contains(
                    check.control_type.split('_')[0], 
                    na=False, 
                    case=False
                )
            ]
            
            sample_row = sample_match.iloc[0] if len(sample_match) > 0 else {}
            
            control_checks_with_details.append({
                'control_type_display': {
                    'positive_control': '阳性对照',
                    'negative_control': '阴性对照',
                    'blank': '空白对照',
                }.get(check.control_type, check.control_type),
                'sample_id': sample_row.get('sample_id', ''),
                'well': sample_row.get('well', ''),
                'ct_value': check.ct_value if check.ct_value else None,
                'expected_status': check.expected_status,
                'actual_status': check.actual_status,
                'passed': check.passed,
                'message': check.message,
            })
        
        data_issues = []
        for issue in loaded_data.issues:
            data_issues.append({
                'issue_type': issue.issue_type,
                'severity': issue.severity,
                'sample_id': issue.sample_id,
                'column': issue.column,
                'message': issue.message,
            })
        
        failed_samples_rows = []
        for idx, row in loaded_data.failed_samples.iterrows():
            failed_samples_rows.append({
                'sample_id': row.get('sample_id', ''),
                'well': row.get('well', ''),
                'ct_value': row.get('ct_value', ''),
                'sample_type': row.get('sample_type_original', ''),
            })
        
        html_content = template.render(
            metadata=loaded_data.metadata,
            generation_time=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            overall_status=qc_result.overall_status.value,
            statistics=qc_result.statistics,
            ct_stats=qc_result.statistics['ct_statistics'],
            positive_controls=qc_result.statistics['positive_controls'],
            negative_controls=qc_result.statistics['negative_controls'],
            blank_controls=qc_result.statistics['blank_controls'],
            control_checks=control_checks_with_details,
            failures=qc_result.failures,
            charts=charts,
            sample_rows=sample_rows,
            data_issues=data_issues,
            failed_samples_rows=failed_samples_rows,
        )
        
        html_path = report_dir / "report.html"
        html_path.write_text(html_content, encoding='utf-8')
        return html_path

    def _generate_excel_report(self, loaded_data: LoadedData, qc_result: QCResult, 
                              report_dir: Path) -> Path:
        excel_path = report_dir / "report.xlsx"
        
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            summary_df = pd.DataFrame([
                {'指标': '总体状态', '值': qc_result.overall_status.value.upper()},
                {'指标': '有效样本数', '值': qc_result.statistics['valid_samples']},
                {'指标': '通过样本', '值': qc_result.statistics['pass_samples']},
                {'指标': '警告样本', '值': qc_result.statistics['warn_samples']},
                {'指标': '失败样本', '值': qc_result.statistics['fail_samples']},
                {'指标': '平均Ct值', '值': qc_result.statistics['ct_statistics']['mean']},
                {'指标': '中位数Ct值', '值': qc_result.statistics['ct_statistics']['median']},
                {'指标': '最小Ct值', '值': qc_result.statistics['ct_statistics']['min']},
                {'指标': '最大Ct值', '值': qc_result.statistics['ct_statistics']['max']},
                {'指标': '阳性对照通过', '值': f"{qc_result.statistics['positive_controls']['passed']}/{qc_result.statistics['positive_controls']['count']}"},
                {'指标': '阴性对照通过', '值': f"{qc_result.statistics['negative_controls']['passed']}/{qc_result.statistics['negative_controls']['count']}"},
                {'指标': '空白对照通过', '值': f"{qc_result.statistics['blank_controls']['passed']}/{qc_result.statistics['blank_controls']['count']}"},
            ])
            summary_df.to_excel(writer, sheet_name='摘要', index=False)
            
            results_df = qc_result.sample_results.copy()
            results_df['sample_type'] = results_df['sample_type'].apply(lambda x: x.value if hasattr(x, 'value') else x)
            results_df.to_excel(writer, sheet_name='样本结果', index=False)
            
            if qc_result.failures:
                failures_df = pd.DataFrame([
                    {
                        '样本ID': f.sample_id,
                        '规则': f.rule_name,
                        '原因': f.reason,
                        '严重程度': f.severity,
                        '详情': str(f.details),
                    } for f in qc_result.failures
                ])
                failures_df.to_excel(writer, sheet_name='失败样本', index=False)
            
            if qc_result.control_checks:
                controls_df = pd.DataFrame([
                    {
                        '对照类型': {
                            'positive_control': '阳性对照',
                            'negative_control': '阴性对照',
                            'blank': '空白对照',
                        }.get(c.control_type, c.control_type),
                        '期望值': c.expected_status,
                        '实际值': c.actual_status,
                        '是否通过': '是' if c.passed else '否',
                        '说明': c.message,
                    } for c in qc_result.control_checks
                ])
                controls_df.to_excel(writer, sheet_name='对照检查', index=False)
            
            if loaded_data.issues:
                issues_df = pd.DataFrame([
                    {
                        '问题类型': i.issue_type,
                        '严重程度': i.severity,
                        '样本ID': i.sample_id or '',
                        '列': i.column or '',
                        '消息': i.message,
                    } for i in loaded_data.issues
                ])
                issues_df.to_excel(writer, sheet_name='数据问题', index=False)
            
            if len(loaded_data.failed_samples) > 0:
                loaded_data.failed_samples.to_excel(writer, sheet_name='加载失败', index=False)
            
            log_df = pd.DataFrame({
                '日志': loaded_data.processing_log + qc_result.validation_log
            })
            log_df.to_excel(writer, sheet_name='处理日志', index=False)

        return excel_path
