"""
报告生成模块
生成HTML和Excel格式的审计报告
"""
from typing import Dict, List, Optional
from pathlib import Path
from datetime import datetime
import base64
import io
import os

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import seaborn as sns

from .config import AuditConfig
from .data_loader import LoadedData
from .quality_control import QCResult, QCIssue
from .drift_calibration import DriftResult, CalibrationResult

sns.set_style('whitegrid')
plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'DejaVu Sans']
plt.rcParams['axes.unicode_minus'] = False


class ReportGenerator:
    """
    报告生成器
    生成包含图表和表格的HTML和Excel报告
    """
    
    def __init__(self, config: AuditConfig):
        self.config = config
        self._output_dir = Path(config.report_output_dir)
        self._output_dir.mkdir(parents=True, exist_ok=True)
        
        self._figures: Dict[str, str] = {}
        self._tables: Dict[str, pd.DataFrame] = {}
    
    def generate_reports(
        self,
        loaded_data: LoadedData,
        qc_result: QCResult,
        drift_result: DriftResult,
        calibration_result: CalibrationResult,
        output_prefix: str = 'audit_report'
    ) -> Dict[str, str]:
        """
        生成所有报告
        """
        self._figures.clear()
        self._tables.clear()
        
        self._prepare_figures(loaded_data, qc_result, drift_result, calibration_result)
        self._prepare_tables(loaded_data, qc_result, drift_result, calibration_result)
        
        generated_files = {}
        
        if self.config.export_html:
            html_path = self._output_dir / f'{output_prefix}.html'
            self._generate_html_report(str(html_path), loaded_data, qc_result, drift_result, calibration_result)
            generated_files['html'] = str(html_path)
        
        if self.config.export_excel:
            excel_path = self._output_dir / f'{output_prefix}.xlsx'
            self._generate_excel_report(str(excel_path), loaded_data, qc_result, drift_result, calibration_result)
            generated_files['excel'] = str(excel_path)
        
        return generated_files
    
    def _prepare_figures(
        self,
        loaded_data: LoadedData,
        qc_result: QCResult,
        drift_result: DriftResult,
        calibration_result: CalibrationResult
    ):
        df = loaded_data.processed_data
        
        if 'timestamp' in df.columns and 'sensor_id' in df.columns:
            self._figures['timeseries_temp'] = self._plot_timeseries(df, 'temperature', '温度')
            self._figures['timeseries_hum'] = self._plot_timeseries(df, 'humidity', '湿度')
        
        self._figures['qc_summary'] = self._plot_qc_summary(qc_result)
        
        if drift_result.drift_events:
            self._figures['drift_analysis'] = self._plot_drift_analysis(drift_result)
        
        if calibration_result.parameters:
            self._figures['calibration_comparison'] = self._plot_calibration_comparison(
                calibration_result
            )
    
    def _prepare_tables(
        self,
        loaded_data: LoadedData,
        qc_result: QCResult,
        drift_result: DriftResult,
        calibration_result: CalibrationResult
    ):
        self._tables['data_summary'] = pd.DataFrame([{
            '指标': '原始数据行数',
            '数值': loaded_data.data_summary.get('raw_rows', 0)
        }, {
            '指标': '处理后数据行数',
            '数值': loaded_data.data_summary.get('processed_rows', 0)
        }, {
            '指标': '传感器数量',
            '数值': loaded_data.data_summary.get('sensor_count', 0)
        }, {
            '指标': '位置数量',
            '数值': loaded_data.data_summary.get('location_count', 0)
        }, {
            '指标': '批次数量',
            '数值': loaded_data.data_summary.get('batch_count', 0)
        }])
        
        issue_summary = qc_result.get_issue_summary()
        qc_table_data = []
        for issue_type, info in issue_summary.items():
            qc_table_data.append({
                '问题类型': issue_type,
                '数量': info['count'],
                '示例': info['examples'][0]['message'] if info['examples'] else ''
            })
        self._tables['qc_summary'] = pd.DataFrame(qc_table_data)
        
        drift_table_data = []
        for event in drift_result.drift_events:
            drift_table_data.append({
                '传感器ID': event.sensor_id,
                '指标': event.metric,
                '开始日期': event.start_date,
                '结束日期': event.end_date,
                '漂移量': round(event.drift_magnitude, 4),
                '方向': event.drift_direction,
                '状态': event.status.value,
                'p值': round(event.p_value, 6) if event.p_value is not None else 'N/A'
            })
        self._tables['drift_events'] = pd.DataFrame(drift_table_data)
        
        calib_table_data = []
        for param in calibration_result.parameters:
            calib_table_data.append({
                '传感器ID': param.sensor_id,
                '指标': param.metric,
                '斜率': round(param.slope, 6),
                '截距': round(param.intercept, 6),
                'R²': round(param.r_squared, 6),
                '生效日期': param.effective_date,
                '参考值均值': round(param.reference_value, 4),
                '传感器均值': round(param.sensor_value, 4)
            })
        self._tables['calibration_parameters'] = pd.DataFrame(calib_table_data)
        
        failed_samples = []
        for issue in qc_result.issues:
            if issue.action in ['EXCLUDE', 'REMOVE']:
                failed_samples.append({
                    '行索引': issue.index,
                    '传感器ID': issue.sensor_id,
                    '列': issue.column,
                    '问题类型': issue.issue_type,
                    '问题描述': issue.message,
                    '严重程度': issue.severity,
                    '建议操作': issue.action
                })
        self._tables['failed_samples'] = pd.DataFrame(failed_samples)
        
        failed_with_reason = []
        for issue in qc_result.issues:
            failed_with_reason.append({
                '行索引': issue.index,
                '传感器ID': issue.sensor_id,
                '问题类型': issue.issue_type,
                '列': issue.column,
                '详细原因': issue.message,
                '严重程度': issue.severity,
                '建议操作': issue.action
            })
        self._tables['all_qc_issues'] = pd.DataFrame(failed_with_reason)
    
    def _plot_timeseries(self, df: pd.DataFrame, metric: str, title_suffix: str) -> str:
        fig, ax = plt.subplots(figsize=(14, 8))
        
        for sensor_id in df['sensor_id'].dropna().unique()[:10]:
            sensor_mask = df['sensor_id'] == sensor_id
            sensor_data = df[sensor_mask].sort_values('timestamp')
            
            if 'timestamp' not in sensor_data.columns or metric not in sensor_data.columns:
                continue
            
            valid_data = sensor_data[['timestamp', metric]].dropna()
            if len(valid_data) < 2:
                continue
            
            ax.plot(valid_data['timestamp'], valid_data[metric], label=f'{sensor_id}', alpha=0.7)
        
        ax.set_xlabel('时间', fontsize=12)
        ax.set_ylabel(f'{title_suffix}', fontsize=12)
        ax.set_title(f'{title_suffix}时间序列', fontsize=14, fontweight='bold')
        ax.legend(loc='upper left', bbox_to_anchor=(1, 1))
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
        plt.xticks(rotation=45)
        plt.tight_layout()
        
        return self._fig_to_base64(fig)
    
    def _plot_qc_summary(self, qc_result: QCResult) -> str:
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        
        ax1 = axes[0]
        labels = ['有效记录', '无效记录', '有警告记录']
        warning_count = len(qc_result.issues) - qc_result.invalid_records
        sizes = [
            qc_result.valid_records - warning_count,
            qc_result.invalid_records,
            warning_count
        ]
        colors = ['#4CAF50', '#F44336', '#FFC107']
        ax1.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90)
        ax1.set_title('数据有效性分布', fontsize=12, fontweight='bold')
        
        ax2 = axes[1]
        issue_summary = qc_result.get_issue_summary()
        if issue_summary:
            issue_types = list(issue_summary.keys())
            issue_counts = [info['count'] for info in issue_summary.values()]
            bars = ax2.bar(range(len(issue_types)), issue_counts, color='#2196F3', alpha=0.7)
            ax2.set_xlabel('问题类型', fontsize=10)
            ax2.set_ylabel('数量', fontsize=10)
            ax2.set_title('各类问题数量分布', fontsize=12, fontweight='bold')
            ax2.set_xticks(range(len(issue_types)))
            ax2.set_xticklabels(issue_types, rotation=45, ha='right')
            
            for bar in bars:
                height = bar.get_height()
                ax2.text(bar.get_x() + bar.get_width()/2., height,
                        f'{int(height)}', ha='center', va='bottom')
        else:
            ax2.text(0.5, 0.5, '无质量问题', ha='center', va='center',
                    transform=ax2.transAxes, fontsize=12)
            ax2.set_title('各类问题数量分布', fontsize=12, fontweight='bold')
        
        plt.tight_layout()
        return self._fig_to_base64(fig)
    
    def _plot_drift_analysis(self, drift_result: DriftResult) -> str:
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        
        ax1 = axes[0]
        drift_stats = drift_result.drift_statistics
        
        if 'by_metric' in drift_stats and drift_stats['by_metric']:
            metrics = list(drift_stats['by_metric'].keys())
            counts = [drift_stats['by_metric'][m]['count'] for m in metrics]
            avg_drifts = [drift_stats['by_metric'][m]['avg_drift'] for m in metrics]
            
            x_pos = np.arange(len(metrics))
            width = 0.35
            
            bars1 = ax1.bar(x_pos - width/2, counts, width, label='事件数', color='#2196F3')
            ax1.set_ylabel('事件数', fontsize=10)
            ax1.set_xlabel('指标', fontsize=10)
            ax1.set_title('各指标漂移事件统计', fontsize=12, fontweight='bold')
            ax1.set_xticks(x_pos)
            ax1.set_xticklabels(metrics)
            ax1.legend(loc='upper left')
        else:
            ax1.text(0.5, 0.5, '无漂移事件', ha='center', va='center',
                    transform=ax1.transAxes, fontsize=12)
        
        ax2 = axes[1]
        if drift_result.drift_events:
            sensor_ids = list(set(e.sensor_id for e in drift_result.drift_events))
            sensor_count = {sid: sum(1 for e in drift_result.drift_events if e.sensor_id == sid) 
                          for sid in sensor_ids}
            
            sorted_sensors = sorted(sensor_count.items(), key=lambda x: x[1], reverse=True)[:10]
            sensor_labels = [s[0] for s in sorted_sensors]
            sensor_values = [s[1] for s in sorted_sensors]
            
            bars = ax2.bar(sensor_labels, sensor_values, color='#E91E63', alpha=0.7)
            ax2.set_xlabel('传感器ID', fontsize=10)
            ax2.set_ylabel('漂移事件数', fontsize=10)
            ax2.set_title('传感器漂移事件分布', fontsize=12, fontweight='bold')
            plt.setp(ax2.get_xticklabels(), rotation=45, ha='right')
            
            for bar in bars:
                height = bar.get_height()
                ax2.text(bar.get_x() + bar.get_width()/2., height,
                        f'{int(height)}', ha='center', va='bottom')
        else:
            ax2.text(0.5, 0.5, '无漂移事件', ha='center', va='center',
                    transform=ax2.transAxes, fontsize=12)
        
        plt.tight_layout()
        return self._fig_to_base64(fig)
    
    def _plot_calibration_comparison(self, calibration_result: CalibrationResult) -> str:
        pre_stats = calibration_result.pre_calibration_stats.get('by_sensor', {})
        post_stats = calibration_result.post_calibration_stats.get('by_sensor', {})
        
        if not pre_stats or not post_stats:
            fig, ax = plt.subplots(figsize=(10, 6))
            ax.text(0.5, 0.5, '无足够数据进行校准对比', ha='center', va='center',
                   transform=ax.transAxes, fontsize=12)
            ax.set_title('校准前后对比', fontsize=14, fontweight='bold')
            return self._fig_to_base64(fig)
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 6))
        
        for idx, metric in enumerate(['temperature', 'humidity']):
            ax = axes[idx]
            
            sensor_ids = list(pre_stats.keys())[:10]
            pre_means = []
            post_means = []
            valid_sensors = []
            
            for sid in sensor_ids:
                if metric in pre_stats.get(sid, {}) and metric in post_stats.get(sid, {}):
                    pre_means.append(pre_stats[sid][metric]['mean'])
                    post_means.append(post_stats[sid][metric]['mean'])
                    valid_sensors.append(sid)
            
            if valid_sensors:
                x_pos = np.arange(len(valid_sensors))
                width = 0.35
                
                ax.bar(x_pos - width/2, pre_means, width, label='校准前', color='#FF5722', alpha=0.7)
                ax.bar(x_pos + width/2, post_means, width, label='校准后', color='#4CAF50', alpha=0.7)
                
                ax.set_xlabel('传感器ID', fontsize=10)
                ax.set_ylabel('均值', fontsize=10)
                ax.set_title(f'{metric}校准前后对比', fontsize=12, fontweight='bold')
                ax.set_xticks(x_pos)
                ax.set_xticklabels(valid_sensors, rotation=45, ha='right')
                ax.legend()
            else:
                ax.text(0.5, 0.5, f'{metric}无数据', ha='center', va='center',
                       transform=ax.transAxes, fontsize=10)
        
        plt.tight_layout()
        return self._fig_to_base64(fig)
    
    def _fig_to_base64(self, fig) -> str:
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        return img_str
    
    def _generate_html_report(
        self,
        file_path: str,
        loaded_data: LoadedData,
        qc_result: QCResult,
        drift_result: DriftResult,
        calibration_result: CalibrationResult
    ):
        html_content = self._render_html(loaded_data, qc_result, drift_result, calibration_result)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
    
    def _render_html(
        self,
        loaded_data: LoadedData,
        qc_result: QCResult,
        drift_result: DriftResult,
        calibration_result: CalibrationResult
    ) -> str:
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        html = f'''
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>传感器漂移校准审计报告</title>
    <style>
        {{CSS}}
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1>传感器漂移校准审计报告</h1>
            <p class="report-time">生成时间: {now}</p>
        </header>
        
        <section class="section">
            <h2>📊 数据概览</h2>
            {self._render_data_summary(loaded_data)}
        </section>
        
        <section class="section">
            <h2>✅ 质量控制分析</h2>
            {self._render_qc_summary(qc_result)}
            {self._fig_to_html('qc_summary', '质量控制统计图')}
        </section>
        
        <section class="section">
            <h2>📈 漂移检测分析</h2>
            {self._render_drift_summary(drift_result)}
            {self._fig_to_html('drift_analysis', '漂移分析图')}
        </section>
        
        <section class="section">
            <h2>🔧 校准结果</h2>
            {self._render_calibration_summary(calibration_result)}
            {self._fig_to_html('calibration_comparison', '校准对比图')}
        </section>
        
        <section class="section">
            <h2>📉 数据时间序列</h2>
            {self._fig_to_html('timeseries_temp', '温度时间序列')}
            {self._fig_to_html('timeseries_hum', '湿度时间序列')}
        </section>
        
        <section class="section">
            <h2>⚠️ 失败样本详情</h2>
            {self._render_failed_samples(qc_result)}
        </section>
        
        <section class="section">
            <h2>📋 详细数据表</h2>
            {self._render_tables()}
        </section>
        
        <footer class="footer">
            <p>报告由传感器漂移校准审计系统生成</p>
            <p>版本: 1.0.0</p>
        </footer>
    </div>
</body>
</html>
        '''
        
        css = '''
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #333;
    line-height: 1.6;
    padding: 20px;
}
.container {
    max-width: 1400px;
    margin: 0 auto;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    overflow: hidden;
}
.header {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #fff;
    padding: 40px;
    text-align: center;
}
.header h1 { font-size: 2.5em; margin-bottom: 10px; }
.report-time { opacity: 0.8; font-size: 0.9em; }

.section { padding: 30px 40px; border-bottom: 1px solid #eee; }
.section:last-child { border-bottom: none; }
.section h2 { 
    font-size: 1.5em; 
    color: #1a1a2e;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #667eea;
}

.summary-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-bottom: 25px;
}
.summary-card {
    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.summary-card .label {
    font-size: 0.9em;
    color: #666;
    margin-bottom: 8px;
}
.summary-card .value {
    font-size: 2em;
    font-weight: bold;
    color: #1a1a2e;
}

.score-card {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    border-radius: 10px;
    padding: 25px;
    text-align: center;
    margin-bottom: 20px;
}
.score-card .score {
    font-size: 3em;
    font-weight: bold;
}
.score-card .label { font-size: 1.1em; opacity: 0.9; }

.figure-container {
    text-align: center;
    margin: 25px 0;
    padding: 20px;
    background: #fafafa;
    border-radius: 10px;
}
.figure-container img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.figure-container .caption {
    margin-top: 10px;
    font-weight: bold;
    color: #555;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
    font-size: 0.9em;
}
th, td {
    padding: 12px 15px;
    text-align: left;
    border-bottom: 1px solid #ddd;
}
th {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    font-weight: bold;
}
tr:hover { background-color: #f5f5f5; }
tr:nth-child(even) { background-color: #fafafa; }

.drift-status {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 0.85em;
    font-weight: bold;
}
.status-NO_DRIFT { background: #4CAF50; color: #fff; }
.status-LOW_DRIFT { background: #FFC107; color: #333; }
.status-MODERATE_DRIFT { background: #FF9800; color: #fff; }
.status-SEVERE_DRIFT { background: #F44336; color: #fff; }

.issue-table { max-height: 400px; overflow-y: auto; }
.footer {
    background: #1a1a2e;
    color: #fff;
    text-align: center;
    padding: 20px;
    opacity: 0.8;
}
        '''
        
        html = html.replace('{{CSS}}', css)
        return html
    
    def _render_data_summary(self, loaded_data: LoadedData) -> str:
        summary = loaded_data.data_summary
        cards = []
        
        cards.append(f'''
        <div class="summary-card">
            <div class="label">原始数据行数</div>
            <div class="value">{summary.get('raw_rows', 0):,}</div>
        </div>
        ''')
        
        cards.append(f'''
        <div class="summary-card">
            <div class="label">处理后数据行数</div>
            <div class="value">{summary.get('processed_rows', 0):,}</div>
        </div>
        ''')
        
        cards.append(f'''
        <div class="summary-card">
            <div class="label">传感器数量</div>
            <div class="value">{summary.get('sensor_count', 0)}</div>
        </div>
        ''')
        
        cards.append(f'''
        <div class="summary-card">
            <div class="label">位置数量</div>
            <div class="value">{summary.get('location_count', 0)}</div>
        </div>
        ''')
        
        if 'date_start' in summary and 'date_end' in summary:
            cards.append(f'''
            <div class="summary-card">
                <div class="label">数据时间范围</div>
                <div class="value" style="font-size: 1.2em;">{summary['date_start'][:10]}<br>至<br>{summary['date_end'][:10]}</div>
            </div>
            ''')
        
        return f'<div class="summary-grid">{"".join(cards)}</div>'
    
    def _render_qc_summary(self, qc_result: QCResult) -> str:
        score_html = f'''
        <div class="score-card">
            <div class="score">{qc_result.quality_score:.1f}</div>
            <div class="label">数据质量评分 (0-100)</div>
        </div>
        '''
        
        summary_html = f'''
        <div class="summary-grid">
            <div class="summary-card">
                <div class="label">总记录数</div>
                <div class="value">{qc_result.total_records:,}</div>
            </div>
            <div class="summary-card">
                <div class="label">有效记录数</div>
                <div class="value" style="color: #4CAF50;">{qc_result.valid_records:,}</div>
            </div>
            <div class="summary-card">
                <div class="label">无效记录数</div>
                <div class="value" style="color: #F44336;">{qc_result.invalid_records:,}</div>
            </div>
            <div class="summary-card">
                <div class="label">问题总数</div>
                <div class="value" style="color: #FF9800;">{len(qc_result.issues):,}</div>
            </div>
        </div>
        '''
        
        stats = qc_result.statistics
        if any(stats.values()):
            stats_html = f'''
            <h3 style="margin: 20px 0 10px;">问题类型统计</h3>
            <div class="summary-grid">
            '''
            for issue_type, count in stats.items():
                if count > 0:
                    stats_html += f'''
                    <div class="summary-card">
                        <div class="label">{issue_type}</div>
                        <div class="value">{count}</div>
                    </div>
                    '''
            stats_html += '</div>'
            return score_html + summary_html + stats_html
        
        return score_html + summary_html
    
    def _render_drift_summary(self, drift_result: DriftResult) -> str:
        stats = drift_result.drift_statistics
        total_events = stats.get('total_events', 0)
        
        html = f'''
        <div class="summary-grid">
            <div class="summary-card">
                <div class="label">总漂移事件数</div>
                <div class="value">{total_events}</div>
            </div>
            <div class="summary-card">
                <div class="label">平均漂移量</div>
                <div class="value">{stats.get('avg_drift_magnitude', 0):.4f}</div>
            </div>
        </div>
        '''
        
        if drift_result.drift_events:
            html += '<h3 style="margin: 20px 0 10px;">漂移事件详情</h3>'
            html += '<div class="issue-table"><table><thead><tr>'
            html += '<th>传感器ID</th><th>指标</th><th>开始日期</th><th>结束日期</th>'
            html += '<th>漂移量</th><th>方向</th><th>状态</th><th>p值</th>'
            html += '</tr></thead><tbody>'
            
            for event in drift_result.drift_events[:50]:
                status_class = f'status-{event.status.value}'
                p_value_str = f'{event.p_value:.6f}' if event.p_value is not None else 'N/A'
                html += f'''
                <tr>
                    <td>{event.sensor_id}</td>
                    <td>{event.metric}</td>
                    <td>{event.start_date.strftime('%Y-%m-%d')}</td>
                    <td>{event.end_date.strftime('%Y-%m-%d')}</td>
                    <td>{event.drift_magnitude:.4f}</td>
                    <td>{event.drift_direction}</td>
                    <td><span class="drift-status {status_class}">{event.status.value}</span></td>
                    <td>{p_value_str}</td>
                </tr>
                '''
            
            if len(drift_result.drift_events) > 50:
                html += f'<tr><td colspan="8" style="text-align: center;">... 还有 {len(drift_result.drift_events) - 50} 条记录，请查看Excel报告</td></tr>'
            
            html += '</tbody></table></div>'
        
        return html
    
    def _render_calibration_summary(self, calibration_result: CalibrationResult) -> str:
        params = calibration_result.parameters
        summary = calibration_result.calibration_summary
        
        html = f'''
        <div class="summary-grid">
            <div class="summary-card">
                <div class="label">校准参数数量</div>
                <div class="value">{len(params)}</div>
            </div>
            <div class="summary-card">
                <div class="label">平均 R²</div>
                <div class="value">{summary.get('average_r_squared', 0):.4f}</div>
            </div>
        </div>
        '''
        
        if params:
            html += '<h3 style="margin: 20px 0 10px;">校准参数详情</h3>'
            html += '<table><thead><tr>'
            html += '<th>传感器ID</th><th>指标</th><th>斜率</th><th>截距</th>'
            html += '<th>R²</th><th>生效日期</th><th>参考均值</th><th>传感器均值</th>'
            html += '</tr></thead><tbody>'
            
            for param in params[:50]:
                html += f'''
                <tr>
                    <td>{param.sensor_id}</td>
                    <td>{param.metric}</td>
                    <td>{param.slope:.6f}</td>
                    <td>{param.intercept:.6f}</td>
                    <td>{param.r_squared:.6f}</td>
                    <td>{param.effective_date.strftime('%Y-%m-%d')}</td>
                    <td>{param.reference_value:.4f}</td>
                    <td>{param.sensor_value:.4f}</td>
                </tr>
                '''
            
            if len(params) > 50:
                html += f'<tr><td colspan="8" style="text-align: center;">... 还有 {len(params) - 50} 条记录，请查看Excel报告</td></tr>'
            
            html += '</tbody></table>'
        
        return html
    
    def _render_failed_samples(self, qc_result: QCResult) -> str:
        failed_issues = [i for i in qc_result.issues if i.action in ['EXCLUDE', 'REMOVE']]
        
        if not failed_issues:
            return '<p>✓ 没有需要排除的失败样本</p>'
        
        html = f'<p style="margin-bottom: 15px;">共 {len(failed_issues)} 条失败样本，以下是详细原因：</p>'
        html += '<div class="issue-table"><table><thead><tr>'
        html += '<th>行索引</th><th>传感器ID</th><th>问题类型</th><th>列</th>'
        html += '<th>详细原因</th><th>严重程度</th><th>建议操作</th>'
        html += '</tr></thead><tbody>'
        
        for issue in failed_issues[:100]:
            html += f'''
            <tr>
                <td>{issue.index}</td>
                <td>{issue.sensor_id or 'N/A'}</td>
                <td>{issue.issue_type}</td>
                <td>{issue.column or 'N/A'}</td>
                <td>{issue.message}</td>
                <td>{issue.severity}</td>
                <td>{issue.action}</td>
            </tr>
            '''
        
        if len(failed_issues) > 100:
            html += f'<tr><td colspan="7" style="text-align: center;">... 还有 {len(failed_issues) - 100} 条记录，请查看Excel报告</td></tr>'
        
        html += '</tbody></table></div>'
        
        return html
    
    def _render_tables(self) -> str:
        html = ''
        
        for table_name, df in self._tables.items():
            if df.empty:
                continue
            
            html += f'<h3 style="margin: 25px 0 10px;">{table_name.replace("_", " ").title()}</h3>'
            html += '<div class="issue-table">'
            
            html += df.head(20).to_html(index=False, escape=False)
            
            if len(df) > 20:
                html += f'<p style="text-align: center; margin-top: 10px; color: #666;">... 还有 {len(df) - 20} 条记录，请查看Excel报告</p>'
            
            html += '</div>'
        
        return html
    
    def _fig_to_html(self, fig_key: str, caption: str) -> str:
        if fig_key not in self._figures:
            return ''
        
        img_data = self._figures[fig_key]
        return f'''
        <div class="figure-container">
            <img src="data:image/png;base64,{img_data}" alt="{caption}">
            <div class="caption">{caption}</div>
        </div>
        '''
    
    def _generate_excel_report(
        self,
        file_path: str,
        loaded_data: LoadedData,
        qc_result: QCResult,
        drift_result: DriftResult,
        calibration_result: CalibrationResult
    ):
        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            for sheet_name, df in self._tables.items():
                if not df.empty:
                    sheet_title = sheet_name[:31]
                    df.to_excel(writer, sheet_name=sheet_title, index=False)
            
            loaded_data.processed_data.to_excel(
                writer, sheet_name='原始处理数据', index=False
            )
            
            calibration_result.calibrated_data.to_excel(
                writer, sheet_name='校准后数据', index=False
            )
