import os
import base64
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional

from config import config
from logger import get_logger
from data_loader import DataLoader


plt.rcParams['font.sans-serif'] = ['Arial Unicode MS', 'SimHei', 'STHeiti', 'Microsoft YaHei']
plt.rcParams['axes.unicode_minus'] = False
plt.rcParams['figure.dpi'] = 100


class ReportGenerator:
    def __init__(self, data_loader: DataLoader):
        self.loader = data_loader
        self.logger = get_logger()
        self.plots: Dict[str, str] = {}
    
    def _fig_to_base64(self, fig) -> str:
        buf = BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', dpi=120)
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode()
        plt.close(fig)
        return img_str
    
    def plot_energy_trend(self, df: pd.DataFrame) -> Optional[str]:
        datetime_col = self.loader.mapping.get('datetime')
        energy_col = self.loader.mapping.get('energy')
        
        if not datetime_col or not energy_col:
            return None
        
        fig, ax = plt.subplots(figsize=(12, 6))
        
        plot_df = df[df[datetime_col].notna() & df[energy_col].notna()].copy()
        if len(plot_df) == 0:
            plt.close(fig)
            return None
        
        plot_df = plot_df.sort_values(datetime_col)
        
        ax.plot(plot_df[datetime_col], plot_df[energy_col], 'b-', label='实际能耗', linewidth=1.5, alpha=0.7)
        
        if '_expected_energy' in plot_df.columns:
            valid_mask = plot_df['_expected_energy'].notna()
            if valid_mask.sum() > 0:
                ax.plot(plot_df.loc[valid_mask, datetime_col], 
                        plot_df.loc[valid_mask, '_expected_energy'], 
                        'g--', label='预期能耗', linewidth=1.5, alpha=0.7)
        
        if '_is_anomaly' in plot_df.columns:
            anomaly_mask = plot_df['_is_anomaly']
            if anomaly_mask.sum() > 0:
                ax.scatter(plot_df.loc[anomaly_mask, datetime_col],
                          plot_df.loc[anomaly_mask, energy_col],
                          c='red', s=50, zorder=5, label='异常点')
        
        ax.set_xlabel('时间', fontsize=11)
        ax.set_ylabel(f'能耗 ({config.default_energy_unit})', fontsize=11)
        ax.set_title('能耗趋势分析', fontsize=13, fontweight='bold')
        ax.legend(loc='best')
        ax.grid(True, alpha=0.3)
        
        if len(plot_df) > 100:
            ax.xaxis.set_major_formatter(mdates.DateFormatter('%Y-%m-%d'))
            plt.xticks(rotation=45)
        
        fig.tight_layout()
        
        img_str = self._fig_to_base64(fig)
        self.plots['energy_trend'] = img_str
        return img_str
    
    def plot_specific_energy(self, df: pd.DataFrame) -> Optional[str]:
        if '_specific_energy' not in df.columns:
            return None
        
        datetime_col = self.loader.mapping.get('datetime')
        
        fig, axes = plt.subplots(1, 2, figsize=(14, 5))
        
        valid_df = df[df['_specific_energy'].notna()].copy()
        if len(valid_df) == 0:
            plt.close(fig)
            return None
        
        ax1 = axes[0]
        if datetime_col and datetime_col in valid_df.columns:
            valid_df = valid_df.sort_values(datetime_col)
            ax1.plot(valid_df[datetime_col], valid_df['_specific_energy'], 'b-', linewidth=1, alpha=0.6)
            
            if '_is_anomaly' in valid_df.columns:
                anomaly_mask = valid_df['_is_anomaly']
                if anomaly_mask.sum() > 0:
                    ax1.scatter(valid_df.loc[anomaly_mask, datetime_col],
                               valid_df.loc[anomaly_mask, '_specific_energy'],
                               c='red', s=40, zorder=5)
            
            ax1.set_xlabel('时间')
            if len(valid_df) > 50:
                plt.setp(ax1.xaxis.get_majorticklabels(), rotation=45)
        else:
            ax1.plot(valid_df['_specific_energy'].values, 'b-', linewidth=1, alpha=0.6)
            ax1.set_xlabel('记录序号')
        
        ax1.set_ylabel(f'单位能耗 (kWh/m³)')
        ax1.set_title('单位能耗趋势', fontweight='bold')
        ax1.grid(True, alpha=0.3)
        
        ax2 = axes[1]
        n, bins, patches = ax2.hist(valid_df['_specific_energy'], bins=20, 
                                    alpha=0.7, color='steelblue', edgecolor='white')
        ax2.set_xlabel(f'单位能耗 (kWh/m³)')
        ax2.set_ylabel('频数')
        ax2.set_title('单位能耗分布', fontweight='bold')
        ax2.axvline(valid_df['_specific_energy'].mean(), color='red', 
                   linestyle='--', linewidth=2, label=f'均值: {valid_df["_specific_energy"].mean():.3f}')
        ax2.axvline(valid_df['_specific_energy'].median(), color='green', 
                   linestyle='-', linewidth=2, label=f'中位数: {valid_df["_specific_energy"].median():.3f}')
        ax2.legend()
        ax2.grid(True, alpha=0.3)
        
        fig.tight_layout()
        
        img_str = self._fig_to_base64(fig)
        self.plots['specific_energy'] = img_str
        return img_str
    
    def plot_attribution_pie(self, attributions) -> Optional[str]:
        if not attributions:
            return None
        
        categories = [a.category for a in attributions]
        impacts = [a.contribution * a.affected_count for a in attributions]
        
        fig, ax = plt.subplots(figsize=(8, 8))
        
        colors = plt.cm.Set3(np.linspace(0, 1, len(categories)))
        wedges, texts, autotexts = ax.pie(
            impacts,
            labels=categories,
            colors=colors,
            autopct='%1.1f%%',
            startangle=90,
            textprops={'fontsize': 10}
        )
        
        ax.set_title('异常归因分布', fontsize=14, fontweight='bold')
        ax.axis('equal')
        
        fig.tight_layout()
        
        img_str = self._fig_to_base64(fig)
        self.plots['attribution_pie'] = img_str
        return img_str
    
    def plot_factor_analysis(self, df: pd.DataFrame) -> Optional[str]:
        factors = []
        factor_names = []
        
        pressure_col = self.loader.mapping.get('pressure')
        leak_col = self.loader.mapping.get('leak')
        production_col = self.loader.mapping.get('production')
        
        if pressure_col and pressure_col in df.columns:
            valid_data = df[pressure_col].dropna()
            if len(valid_data) > 0:
                factors.append(valid_data.values)
                factor_names.append('压力')
        
        if leak_col and leak_col in df.columns:
            valid_data = df[leak_col].dropna()
            if len(valid_data) > 0:
                factors.append(valid_data.values)
                factor_names.append('泄漏')
        
        if production_col and production_col in df.columns:
            valid_data = df[production_col].dropna()
            if len(valid_data) > 0:
                factors.append(valid_data.values)
                factor_names.append('产量')
        
        if len(factors) < 2:
            return None
        
        fig, axes = plt.subplots(1, len(factors), figsize=(5 * len(factors), 5))
        
        if len(factors) == 1:
            axes = [axes]
        
        for i, (data, name) in enumerate(zip(factors, factor_names)):
            ax = axes[i]
            ax.boxplot(data, vert=True, widths=0.6, 
                      patch_artist=True, 
                      boxprops=dict(facecolor='lightblue', alpha=0.7),
                      medianprops=dict(color='red', linewidth=2))
            ax.set_title(f'{name}分布', fontweight='bold')
            ax.set_ylabel(name)
            ax.grid(True, alpha=0.3, axis='y')
        
        fig.suptitle('关键因子箱线图分析', fontsize=14, fontweight='bold')
        fig.tight_layout()
        
        img_str = self._fig_to_base64(fig)
        self.plots['factor_analysis'] = img_str
        return img_str
    
    def generate_statistics_table(self, df: pd.DataFrame) -> pd.DataFrame:
        stats_data = []
        
        for col_type in ['energy', 'production', 'pressure', 'leak']:
            col_name = self.loader.mapping.get(col_type)
            if not col_name or col_name not in df.columns:
                continue
            
            valid_data = df[col_name].dropna()
            if len(valid_data) == 0:
                continue
            
            stats_data.append({
                '指标': col_name,
                '计数': len(valid_data),
                '均值': round(valid_data.mean(), 4),
                '标准差': round(valid_data.std(), 4),
                '最小值': round(valid_data.min(), 4),
                '25%分位数': round(valid_data.quantile(0.25), 4),
                '中位数': round(valid_data.median(), 4),
                '75%分位数': round(valid_data.quantile(0.75), 4),
                '最大值': round(valid_data.max(), 4),
                '缺失数': int(df[col_name].isna().sum())
            })
        
        if '_specific_energy' in df.columns:
            valid_se = df['_specific_energy'].dropna()
            if len(valid_se) > 0:
                stats_data.append({
                    '指标': '单位能耗',
                    '计数': len(valid_se),
                    '均值': round(valid_se.mean(), 4),
                    '标准差': round(valid_se.std(), 4),
                    '最小值': round(valid_se.min(), 4),
                    '25%分位数': round(valid_se.quantile(0.25), 4),
                    '中位数': round(valid_se.median(), 4),
                    '75%分位数': round(valid_se.quantile(0.75), 4),
                    '最大值': round(valid_se.max(), 4),
                    '缺失数': int(df['_specific_energy'].isna().sum())
                })
        
        return pd.DataFrame(stats_data)
    
    def generate_html_report(self, 
                            df: pd.DataFrame,
                            qc_report: Dict,
                            attributions: List,
                            calculation_log: List,
                            failed_samples: List) -> str:
        
        self.logger.log_info("生成HTML报告")
        
        stats_table = self.generate_statistics_table(df)
        
        self.plot_energy_trend(df)
        self.plot_specific_energy(df)
        self.plot_factor_analysis(df)
        if attributions:
            self.plot_attribution_pie(attributions)
        
        html_content = self._build_html_content(df, qc_report, attributions, 
                                               calculation_log, failed_samples, stats_table)
        
        output_dir = Path(config.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        report_path = output_dir / config.report_file
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        self.logger.log_info(f"报告已生成: {report_path}")
        return str(report_path)
    
    def _build_html_content(self, df, qc_report, attributions, calculation_log, 
                           failed_samples, stats_table):
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        summary_stats = self._get_summary_stats(df, qc_report, failed_samples, attributions)
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>空压机能耗异常归因分析报告</title>
    <style>
        body {{ font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #2c3e50; text-align: center; border-bottom: 3px solid #3498db; padding-bottom: 15px; }}
        h2 {{ color: #34495e; margin-top: 30px; border-left: 4px solid #3498db; padding-left: 10px; }}
        h3 {{ color: #555; margin-top: 20px; }}
        .summary-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }}
        .summary-card {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }}
        .summary-card.warning {{ background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }}
        .summary-card.success {{ background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }}
        .summary-card h4 {{ margin: 0 0 10px 0; font-size: 14px; opacity: 0.9; }}
        .summary-card .value {{ font-size: 28px; font-weight: bold; }}
        .summary-card .unit {{ font-size: 12px; opacity: 0.8; margin-left: 5px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background-color: #3498db; color: white; font-weight: bold; }}
        tr:hover {{ background-color: #f5f5f5; }}
        .plot-container {{ text-align: center; margin: 20px 0; }}
        .plot-container img {{ max-width: 100%; border: 1px solid #ddd; border-radius: 4px; }}
        .attribution-item {{ background-color: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 6px; border-left: 4px solid #3498db; }}
        .attribution-item.primary {{ border-left-color: #e74c3c; background-color: #fdf2f2; }}
        .confidence-bar {{ height: 8px; background-color: #e0e0e0; border-radius: 4px; margin-top: 8px; overflow: hidden; }}
        .confidence-fill {{ height: 100%; border-radius: 4px; }}
        .step-log {{ background-color: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 6px; font-family: monospace; font-size: 13px; }}
        .error-category {{ background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; border-radius: 4px; }}
        .footer {{ text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #7f8c8d; font-size: 12px; }}
        .badge {{ display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; margin-left: 5px; }}
        .badge-high {{ background-color: #e74c3c; color: white; }}
        .badge-medium {{ background-color: #f39c12; color: white; }}
        .badge-low {{ background-color: #27ae60; color: white; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔧 空压机能耗异常归因分析报告</h1>
        
        <p style="text-align: center; color: #7f8c8d;">生成时间: {now}</p>
        
        <h2>📊 执行摘要</h2>
        <div class="summary-grid">
            <div class="summary-card">
                <h4>总记录数</h4>
                <div class="value">{summary_stats['total_records']}</div>
                <div class="unit">条</div>
            </div>
            <div class="summary-card {'warning' if summary_stats['anomaly_count'] > 0 else 'success'}">
                <h4>异常记录数</h4>
                <div class="value">{summary_stats['anomaly_count']}</div>
                <div class="unit">条 ({summary_stats['anomaly_pct']}%)</div>
            </div>
            <div class="summary-card {'warning' if summary_stats['failed_count'] > 0 else 'success'}">
                <h4>质控失败数</h4>
                <div class="value">{summary_stats['failed_count']}</div>
                <div class="unit">条</div>
            </div>
            <div class="summary-card">
                <h4>检测到的原因</h4>
                <div class="value">{summary_stats['attribution_count']}</div>
                <div class="unit">类</div>
            </div>
        </div>
"""
        
        if attributions:
            html += f"""
        <h2>🎯 异常归因分析</h2>
        <p><strong>最可能原因:</strong> <span style="color: #e74c3c; font-size: 18px; font-weight: bold;">{attributions[0].category}</span></p>
"""
            
            for i, attr in enumerate(attributions):
                is_primary = i == 0
                confidence_pct = int(attr.confidence * 100)
                confidence_color = '#27ae60' if confidence_pct >= 70 else ('#f39c12' if confidence_pct >= 40 else '#e74c3c')
                
                html += f"""
        <div class="attribution-item {'primary' if is_primary else ''}">
            <h3>
                {i+1}. {attr.category}
                {'<span class="badge badge-high">首要原因</span>' if is_primary else ''}
            </h3>
            <p><strong>描述:</strong> {attr.description}</p>
            <p><strong>影响记录数:</strong> {attr.affected_count} 条</p>
            <p><strong>置信度:</strong> {confidence_pct}%</p>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: {confidence_pct}%; background-color: {confidence_color};"></div>
            </div>
            <p><strong>相关记录索引:</strong> {', '.join(map(str, attr.related_indices[:10]))}{'...' if len(attr.related_indices) > 10 else ''}</p>
        </div>
"""
        
        html += f"""
        <h2>📈 可视化分析</h2>
"""
        
        if 'energy_trend' in self.plots:
            html += f"""
        <div class="plot-container">
            <h3>能耗趋势图</h3>
            <img src="data:image/png;base64,{self.plots['energy_trend']}" alt="能耗趋势">
        </div>
"""
        
        if 'specific_energy' in self.plots:
            html += f"""
        <div class="plot-container">
            <h3>单位能耗分析</h3>
            <img src="data:image/png;base64,{self.plots['specific_energy']}" alt="单位能耗">
        </div>
"""
        
        if 'factor_analysis' in self.plots:
            html += f"""
        <div class="plot-container">
            <h3>关键因子分析</h3>
            <img src="data:image/png;base64,{self.plots['factor_analysis']}" alt="因子分析">
        </div>
"""
        
        if 'attribution_pie' in self.plots:
            html += f"""
        <div class="plot-container">
            <h3>归因分布</h3>
            <img src="data:image/png;base64,{self.plots['attribution_pie']}" alt="归因分布">
        </div>
"""
        
        html += f"""
        <h2>📋 统计数据</h2>
        {self._df_to_html_table(stats_table)}
"""
        
        html += f"""
        <h2>🔍 质量控制报告</h2>
"""
        
        if qc_report.get('missing_values'):
            html += """
        <h3>缺失值统计</h3>
        <table>
            <tr><th>列名</th><th>缺失数量</th><th>缺失比例</th></tr>
"""
            for col, stats in qc_report['missing_values'].items():
                html += f"""
            <tr><td>{col}</td><td>{stats['count']}</td><td>{stats['ratio']:.1%}</td></tr>
"""
            html += "</table>"
        
        if qc_report.get('duplicates'):
            html += f"""
        <div class="error-category">
            <strong>重复记录:</strong> 发现 {len(qc_report['duplicates'])} 组重复记录
        </div>
"""
        
        if qc_report.get('outliers'):
            html += f"""
        <div class="error-category">
            <strong>异常值:</strong> 检测到 {len(qc_report['outliers'])} 个统计异常值
        </div>
"""
        
        html += f"""
        <h2>⚠️ 失败样本记录</h2>
"""
        
        if failed_samples:
            from collections import Counter
            category_counts = Counter(s['category'] for s in failed_samples)
            
            html += f"""
        <p>共 {len(failed_samples)} 条样本处理失败，按类别分布:</p>
"""
            for category, count in category_counts.items():
                category_desc = {
                    'missing_value': '缺失值',
                    'duplicate': '重复记录',
                    'negative_value': '负值',
                    'outlier_iqr': 'IQR异常值',
                    'outlier_zscore': 'Z-score异常值',
                    'unit_error': '单位错误',
                    'datetime_error': '时间格式错误',
                    'numeric_error': '数值转换错误',
                    'calculation_error': '计算错误'
                }.get(category, category)
                
                html += f"""
        <div class="error-category">
            <strong>{category_desc}:</strong> {count} 条
        </div>
"""
            
            html += """
        <h3>失败样本详情（前20条）</h3>
        <table>
            <tr><th>原索引</th><th>类别</th><th>原因</th></tr>
"""
            for sample in failed_samples[:20]:
                category_desc = {
                    'missing_value': '缺失值',
                    'duplicate': '重复记录',
                    'negative_value': '负值',
                    'outlier_iqr': 'IQR异常值',
                    'outlier_zscore': 'Z-score异常值',
                    'unit_error': '单位错误',
                    'datetime_error': '时间格式错误',
                    'numeric_error': '数值转换错误',
                    'calculation_error': '计算错误'
                }.get(sample['category'], sample['category'])
                
                html += f"""
            <tr>
                <td>{sample['index']}</td>
                <td>{category_desc}</td>
                <td>{sample['reason']}</td>
            </tr>
"""
            if len(failed_samples) > 20:
                html += f"""
            <tr><td colspan="3" style="text-align: center;">... 还有 {len(failed_samples) - 20} 条，请查看导出的Excel文件</td></tr>
"""
            html += "</table>"
        else:
            html += """
        <p style="color: #27ae60;">✓ 所有样本均通过质量控制</p>
"""
        
        html += f"""
        <h2>📝 计算流程日志（可复算）</h2>
"""
        
        for step in calculation_log:
            html += f"""
        <div class="step-log">
            <strong>[{step['step_name']}]</strong> {step['description']}<br>
            <span style="color: #7f8c8d;">时间: {step['timestamp']}</span><br>
"""
            if step['parameters']:
                html += f"""
            <span style="color: #3498db;">参数: {step['parameters']}</span><br>
"""
            if step['result_summary']:
                html += f"""
            <span style="color: #27ae60;">结果: {step['result_summary']}</span>
"""
            html += "</div>"
        
        html += """
        <div class="footer">
            <p>本报告由空压机能耗异常归因分析系统自动生成</p>
            <p>所有计算流程均已记录，支持完全复算</p>
        </div>
    </div>
</body>
</html>
"""
        
        return html
    
    def _get_summary_stats(self, df, qc_report, failed_samples, attributions):
        total_records = len(df)
        
        anomaly_count = 0
        if '_is_anomaly' in df.columns:
            anomaly_count = int(df['_is_anomaly'].sum())
        
        anomaly_pct = round((anomaly_count / total_records * 100), 1) if total_records > 0 else 0
        
        return {
            'total_records': total_records,
            'anomaly_count': anomaly_count,
            'anomaly_pct': anomaly_pct,
            'failed_count': len(failed_samples),
            'attribution_count': len(attributions)
        }
    
    def _df_to_html_table(self, df: pd.DataFrame) -> str:
        if df.empty:
            return "<p>暂无统计数据</p>"
        
        html = '<table>\n<tr>'
        for col in df.columns:
            html += f'<th>{col}</th>'
        html += '</tr>\n'
        
        for _, row in df.iterrows():
            html += '<tr>'
            for col in df.columns:
                html += f'<td>{row[col]}</td>'
            html += '</tr>\n'
        
        html += '</table>'
        return html
