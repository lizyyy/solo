import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from typing import Dict, Any, List
from io import BytesIO
from datetime import datetime


class ReportGenerator:
    def __init__(self):
        self.color_valid = '#1f77b4'
        self.color_invalid = '#ff6b6b'
        self.color_warning = '#ffa500'
        self.color_leq = '#2ecc71'
    
    def plot_time_series(
        self,
        data: pd.DataFrame,
        time_col: str,
        noise_col: str,
        leq_results: Dict[str, Any]
    ) -> go.Figure:
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            x=data[time_col],
            y=data[noise_col],
            mode='lines+markers',
            name='噪声声级',
            line=dict(color=self.color_valid, width=1.5),
            marker=dict(size=4, opacity=0.7)
        ))
        
        fig.add_hline(
            y=leq_results['leq'],
            line_dash="dash",
            line_color=self.color_leq,
            annotation_text=f"LAeq = {leq_results['leq']:.2f} dB",
            annotation_position="top right"
        )
        
        fig.add_hline(
            y=leq_results['L10'],
            line_dash="dot",
            line_color='#e74c3c',
            annotation_text=f"L10 = {leq_results['L10']:.2f} dB",
            annotation_position="bottom right"
        )
        
        fig.add_hline(
            y=leq_results['L90'],
            line_dash="dot",
            line_color='#9b59b6',
            annotation_text=f"L90 = {leq_results['L90']:.2f} dB",
            annotation_position="bottom left"
        )
        
        fig.update_layout(
            title='噪声声级时间序列图',
            xaxis_title='时间',
            yaxis_title='声级 (dB)',
            hovermode='x unified',
            template='plotly_white',
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1)
        )
        
        return fig
    
    def plot_histogram(
        self,
        data: pd.DataFrame,
        noise_col: str
    ) -> go.Figure:
        noise_values = data[noise_col]
        
        fig = go.Figure()
        
        fig.add_trace(go.Histogram(
            x=noise_values,
            nbinsx=30,
            marker_color=self.color_valid,
            opacity=0.7,
            name='分布',
            histnorm='probability'
        ))
        
        mean_val = noise_values.mean()
        fig.add_vline(
            x=mean_val,
            line_dash="dash",
            line_color='red',
            annotation_text=f"均值 = {mean_val:.2f} dB",
            annotation_position="top right"
        )
        
        fig.update_layout(
            title='声级分布直方图',
            xaxis_title='声级 (dB)',
            yaxis_title='概率密度',
            template='plotly_white',
            bargap=0.1
        )
        
        return fig
    
    def plot_percentiles(
        self,
        data: pd.DataFrame,
        noise_col: str,
        leq_results: Dict[str, Any]
    ) -> go.Figure:
        sorted_values = np.sort(data[noise_col])
        n = len(sorted_values)
        percentiles = np.linspace(0, 100, n)
        
        fig = go.Figure()
        
        fig.add_trace(go.Scatter(
            x=percentiles,
            y=sorted_values,
            mode='lines',
            line=dict(color=self.color_valid, width=2),
            fill='tozeroy',
            fillcolor='rgba(31, 119, 180, 0.1)',
            name='累计分布'
        ))
        
        fig.add_hline(
            y=leq_results['L10'],
            line_dash="dash",
            line_color='#e74c3c',
            annotation_text="L10 (90%分布)",
            annotation_position="top right"
        )
        
        fig.add_hline(
            y=leq_results['L50'],
            line_dash="dash",
            line_color='#f39c12',
            annotation_text="L50 (50%分布)",
            annotation_position="top right"
        )
        
        fig.add_hline(
            y=leq_results['L90'],
            line_dash="dash",
            line_color='#9b59b6',
            annotation_text="L90 (10%分布)",
            annotation_position="bottom right"
        )
        
        fig.update_layout(
            title='累计百分位数曲线 (L10, L50, L90)',
            xaxis_title='累计百分比 (%)',
            yaxis_title='声级 (dB)',
            template='plotly_white'
        )
        
        return fig
    
    def plot_failed_records(
        self,
        failed_records: List[Dict[str, Any]]
    ) -> go.Figure:
        df = pd.DataFrame(failed_records)
        reason_counts = df['reason'].value_counts()
        
        fig = go.Figure()
        
        colors = [
            '#e74c3c' if '缺失' in r or '超出' in r or '重复' in r or '非数值' in r
            else '#ffa500'
            for r in reason_counts.index
        ]
        
        fig.add_trace(go.Bar(
            x=reason_counts.index,
            y=reason_counts.values,
            marker_color=colors,
            text=reason_counts.values,
            textposition='auto'
        ))
        
        fig.update_layout(
            title='异常样本分类统计',
            xaxis_title='失败原因',
            yaxis_title='样本数量',
            template='plotly_white'
        )
        
        return fig
    
    def generate_excel_report(
        self,
        report_data: Dict[str, Any]
    ) -> bytes:
        output = BytesIO()
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            summary_df = pd.DataFrame([{
                '指标': '等效连续A声级 (LAeq)',
                '数值 (dB)': f"{report_data['summary']['leq']:.2f}"
            }, {
                '指标': '最大声级 (Lmax)',
                '数值 (dB)': f"{report_data['summary']['Lmax']:.2f}"
            }, {
                '指标': '最小声级 (Lmin)',
                '数值 (dB)': f"{report_data['summary']['Lmin']:.2f}"
            }, {
                '指标': 'L10 (累计10%声级)',
                '数值 (dB)': f"{report_data['summary']['L10']:.2f}"
            }, {
                '指标': 'L50 (累计50%声级)',
                '数值 (dB)': f"{report_data['summary']['L50']:.2f}"
            }, {
                '指标': 'L90 (累计90%声级)',
                '数值 (dB)': f"{report_data['summary']['L90']:.2f}"
            }, {
                '指标': 'L95 (累计95%声级)',
                '数值 (dB)': f"{report_data['summary']['L95']:.2f}"
            }, {
                '指标': '标准差',
                '数值 (dB)': f"{report_data['summary']['std']:.2f}"
            }, {
                '指标': '有效样本数',
                '数值 (dB)': f"{int(report_data['summary']['n_samples'])}"
            }])
            summary_df.to_excel(writer, sheet_name='计算结果', index=False)
            
            qc = report_data['quality_control']
            qc_df = pd.DataFrame([{
                '质控项目': '总样本数',
                '数量': qc['total_samples'],
                '状态': '已统计'
            }, {
                '质控项目': '有效样本数',
                '数量': qc['valid_samples'],
                '状态': '✓ 通过' if qc['valid_samples'] > 0 else '✗ 无有效数据'
            }, {
                '质控项目': '缺失值',
                '数量': qc['missing_count'],
                '状态': '✓ 通过' if qc['missing_count'] == 0 else '⚠ 存在'
            }, {
                '质控项目': '重复值',
                '数量': qc['duplicate_count'],
                '状态': '✓ 通过' if qc['duplicate_count'] == 0 else '⚠ 存在'
            }, {
                '质控项目': '超出范围',
                '数量': qc['out_of_range_count'],
                '状态': '✓ 通过' if qc['out_of_range_count'] == 0 else '⚠ 存在'
            }, {
                '质控项目': '统计异常值',
                '数量': qc['outlier_count'],
                '状态': '✓ 通过' if qc['outlier_count'] == 0 else '⚠ 存在'
            }, {
                '质控项目': '时间断点',
                '数量': qc['break_count'],
                '状态': '✓ 连续' if qc['break_count'] == 0 else '⚠ 存在'
            }])
            qc_df.to_excel(writer, sheet_name='质量控制', index=False)
            
            if len(qc['failed_records']) > 0:
                failed_df = pd.DataFrame(qc['failed_records'])
                failed_df.to_excel(writer, sheet_name='失败样本详情', index=False)
            
            report_data['valid_data'].to_excel(writer, sheet_name='有效数据', index=False)
            
            params_df = pd.DataFrame([{
                '参数': '最小有效声级阈值 (dB)',
                '值': report_data['parameters']['min_threshold']
            }, {
                '参数': '最大有效声级阈值 (dB)',
                '值': report_data['parameters']['max_threshold']
            }, {
                '参数': '异常值检测方法',
                '值': report_data['parameters']['outlier_method']
            }, {
                '参数': '预期采样间隔 (秒)',
                '值': report_data['parameters']['time_interval']
            }, {
                '参数': '报告生成时间',
                '值': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }])
            params_df.to_excel(writer, sheet_name='计算参数', index=False)
        
        output.seek(0)
        return output.getvalue()
    
    def generate_markdown_report(
        self,
        report_data: Dict[str, Any]
    ) -> str:
        summary = report_data['summary']
        qc = report_data['quality_control']
        params = report_data['parameters']
        
        missing_status = '✓ 通过' if qc['missing_count'] == 0 else f'✗ 发现 {qc["missing_count"]} 个缺失值'
        duplicate_status = '✓ 通过' if qc['duplicate_count'] == 0 else f'✗ 发现 {qc["duplicate_count"]} 个重复值'
        range_status = '✓ 通过' if qc['out_of_range_count'] == 0 else f'✗ 发现 {qc["out_of_range_count"]} 个超出范围'
        outlier_status = '✓ 通过' if qc['outlier_count'] == 0 else f'⚠ 检测到 {qc["outlier_count"]} 个异常值'
        continuity_status = '✓ 连续' if qc['break_count'] == 0 else f'⚠ 存在 {qc["break_count"]} 个断点'
        valid_samples_status = '✓ 通过' if qc['valid_samples'] > 0 else '✗ 无有效数据'
        invalid_samples_status = '⚠ 存在问题' if qc['invalid_samples'] > 0 else '✓ 无问题'
        
        report_lines = [
            "# 噪声监测等效声级计算报告",
            "",
            f"**报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "---",
            "",
            "## 1. 计算结果",
            "",
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 等效连续A声级 (LAeq) | {summary['leq']:.2f} dB |",
            f"| 最大声级 (Lmax) | {summary['Lmax']:.2f} dB |",
            f"| 最小声级 (Lmin) | {summary['Lmin']:.2f} dB |",
            f"| L10 (累计10%声级) | {summary['L10']:.2f} dB |",
            f"| L50 (累计50%声级) | {summary['L50']:.2f} dB |",
            f"| L90 (累计90%声级) | {summary['L90']:.2f} dB |",
            f"| L95 (累计95%声级) | {summary['L95']:.2f} dB |",
            f"| 标准差 | {summary['std']:.2f} dB |",
            f"| 有效样本数 | {int(summary['n_samples'])} |",
            "",
            "**计算方法**: 能量平均法",
            "",
            "$$L_{eq} = 10 \\log_{10}\\left(\\frac{1}{N}\\sum_{i=1}^{N}10^{L_i/10}\\right)$$",
            "",
            "---",
            "",
            "## 2. 质量控制报告",
            "",
            "### 2.1 总体统计",
            "",
            "| 项目 | 数量 | 状态 |",
            "|------|------|------|",
            f"| 总样本数 | {qc['total_samples']} | - |",
            f"| 有效样本数 | {qc['valid_samples']} | {valid_samples_status} |",
            f"| 无效样本数 | {qc['invalid_samples']} | {invalid_samples_status} |",
            "",
            "### 2.2 详细质控规则",
            "",
            "| 质控项 | 结果 |",
            "|--------|------|",
            f"| 缺失值检查 | {missing_status} |",
            f"| 重复值检查 | {duplicate_status} |",
            f"| 范围有效性 | {range_status} |",
            f"| 异常值检测 | {outlier_status} |",
            f"| 时间连续性 | {continuity_status} |",
            "",
            "---",
            "",
            "## 3. 计算参数",
            "",
            "| 参数 | 值 |",
            "|------|-----|",
            f"| 最小有效声级阈值 | {params['min_threshold']} dB |",
            f"| 最大有效声级阈值 | {params['max_threshold']} dB |",
            f"| 异常值检测方法 | {params['outlier_method']} |",
            f"| 预期采样间隔 | {params['time_interval']} 秒 |",
            "",
            "---"
        ]
        
        report = "\n".join(report_lines)
        
        if len(qc['failed_records']) > 0:
            report += "\n\n## 4. 失败样本详情\n\n"
            report += "| 序号 | 时间 | 原始值 | 原因 |\n"
            report += "|------|------|--------|------|\n"
            for i, record in enumerate(qc['failed_records'][:100]):
                report += f"| {i+1} | {record['timestamp']} | {record['original_value']} | {record['reason']} |\n"
            if len(qc['failed_records']) > 100:
                report += f"\n... 还有 {len(qc['failed_records']) - 100} 条记录，完整数据请下载Excel报告\n"
        
        report += "\n\n---\n\n**备注**: 本报告由噪声监测等效声级计算系统自动生成，所有计算步骤可追溯，结果可复现。"
        
        return report
