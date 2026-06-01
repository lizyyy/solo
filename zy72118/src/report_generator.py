import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from typing import Dict, List, Optional
from pathlib import Path
import json
from datetime import datetime
import sys
sys.path.append(str(Path(__file__).parent.parent))


class ReportGenerator:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
    def create_calibration_curve(self, raw_values: np.ndarray, 
                                  reference_values: np.ndarray,
                                  corrected_values: np.ndarray,
                                  residuals: np.ndarray) -> go.Figure:
        fig = make_subplots(
            rows=2, cols=1,
            subplot_titles=('校准曲线对比', '误差分布'),
            vertical_spacing=0.15,
            row_heights=[0.7, 0.3]
        )
        
        raw_values = np.array(raw_values)
        reference_values = np.array(reference_values)
        corrected_values = np.array(corrected_values)
        residuals = np.array(residuals)
        
        valid_mask = ~np.isnan(raw_values) & ~np.isnan(reference_values)
        
        n_raw = len(raw_values)
        n_corrected = len(corrected_values)
        
        if n_raw == n_corrected:
            raw_clean = raw_values[valid_mask]
            ref_clean = reference_values[valid_mask]
            corr_clean = corrected_values[valid_mask]
            res_clean = residuals[valid_mask]
        else:
            raw_clean = raw_values[valid_mask]
            ref_clean = reference_values[valid_mask]
            corr_clean = corrected_values
            res_clean = residuals
        
        sorted_indices = np.argsort(raw_clean)
        raw_sorted = raw_clean[sorted_indices]
        ref_sorted = ref_clean[sorted_indices]
        corr_sorted = corr_clean[sorted_indices]
        res_sorted = res_clean[sorted_indices]
        
        fig.add_trace(
            go.Scatter(x=raw_sorted, y=ref_sorted, mode='markers',
                       name='标准值', marker=dict(color='blue', size=8),
                       hovertemplate='原始值: %{x:.2f} mm<br>标准值: %{y:.2f} mm'),
            row=1, col=1
        )
        
        fig.add_trace(
            go.Scatter(x=raw_sorted, y=corr_sorted, mode='lines+markers',
                       name='校准后', line=dict(color='red', width=2),
                       marker=dict(size=6),
                       hovertemplate='原始值: %{x:.2f} mm<br>校准值: %{y:.2f} mm'),
            row=1, col=1
        )
        
        fig.add_trace(
            go.Scatter(x=raw_sorted, y=raw_sorted, mode='lines',
                       name='理想曲线', line=dict(color='gray', dash='dash'),
                       opacity=0.5),
            row=1, col=1
        )
        
        fig.add_trace(
            go.Scatter(x=raw_sorted, y=res_sorted, mode='markers',
                       name='残差', marker=dict(color='orange', size=6),
                       hovertemplate='原始值: %{x:.2f} mm<br>残差: %{y:.4f} mm'),
            row=2, col=1
        )
        
        fig.add_hline(y=0, line_dash="dash", line_color="gray", 
                      opacity=0.5, row=2, col=1)
        
        fig.update_xaxes(title_text='原始测量值 (mm)', row=1, col=1)
        fig.update_yaxes(title_text='距离 (mm)', row=1, col=1)
        fig.update_xaxes(title_text='原始测量值 (mm)', row=2, col=1)
        fig.update_yaxes(title_text='残差 (mm)', row=2, col=1)
        
        fig.update_layout(
            height=600,
            showlegend=True,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
            margin=dict(l=50, r=50, t=80, b=50)
        )
        
        return fig
    
    def create_error_histogram(self, residuals: np.ndarray) -> go.Figure:
        residuals = np.array(residuals)
        valid_residuals = residuals[~np.isnan(residuals)]
        
        fig = go.Figure()
        
        fig.add_trace(
            go.Histogram(x=valid_residuals, nbinsx=20,
                         name='误差分布',
                         marker_color='lightblue',
                         marker_line_color='black',
                         marker_line_width=1)
        )
        
        mean_val = np.mean(valid_residuals)
        std_val = np.std(valid_residuals)
        
        fig.add_vline(x=mean_val, line_dash="dash", line_color="red",
                      annotation_text=f"均值: {mean_val:.4f}",
                      annotation_position="top right")
        
        fig.add_vline(x=mean_val + std_val, line_dash="dash", line_color="orange",
                      annotation_text=f"+1σ: {mean_val + std_val:.4f}",
                      annotation_position="top")
        
        fig.add_vline(x=mean_val - std_val, line_dash="dash", line_color="orange",
                      annotation_text=f"-1σ: {mean_val - std_val:.4f}",
                      annotation_position="top")
        
        fig.update_layout(
            title='误差分布直方图',
            xaxis_title='误差 (mm)',
            yaxis_title='频数',
            height=400,
            margin=dict(l=50, r=50, t=50, b=50)
        )
        
        return fig
    
    def create_time_series_plot(self, timestamps: List, 
                                 raw_values: np.ndarray,
                                 reference_values: np.ndarray = None,
                                 corrected_values: np.ndarray = None) -> go.Figure:
        fig = go.Figure()
        
        fig.add_trace(
            go.Scatter(x=timestamps, y=raw_values, mode='lines+markers',
                       name='原始值', line=dict(color='blue'),
                       marker=dict(size=6))
        )
        
        if reference_values is not None:
            fig.add_trace(
                go.Scatter(x=timestamps, y=reference_values, mode='lines+markers',
                           name='标准值', line=dict(color='green'),
                           marker=dict(size=6))
            )
        
        if corrected_values is not None:
            fig.add_trace(
                go.Scatter(x=timestamps, y=corrected_values, mode='lines+markers',
                           name='校准后', line=dict(color='red'),
                           marker=dict(size=6))
            )
        
        fig.update_layout(
            title='测量值时间序列',
            xaxis_title='时间',
            yaxis_title='距离 (mm)',
            height=400,
            hovermode='x unified',
            margin=dict(l=50, r=50, t=50, b=50)
        )
        
        return fig
    
    def create_direction_comparison(self, direction_stats: Dict) -> go.Figure:
        directions = list(direction_stats.keys())
        if '方向差异' in directions:
            directions.remove('方向差异')
        
        mean_errors = [direction_stats[d]['mean_error'] for d in directions]
        std_errors = [direction_stats[d]['std_error'] for d in directions]
        counts = [direction_stats[d]['count'] for d in directions]
        
        fig = go.Figure()
        
        fig.add_trace(
            go.Bar(x=directions, y=mean_errors,
                   name='平均误差',
                   marker_color='lightblue',
                   error_y=dict(type='data', array=std_errors),
                   text=[f'n={c}' for c in counts],
                   textposition='auto')
        )
        
        fig.update_layout(
            title='方向误差对比',
            xaxis_title='方向',
            yaxis_title='平均误差 (mm)',
            height=400,
            margin=dict(l=50, r=50, t=50, b=50)
        )
        
        return fig
    
    def create_summary_table(self, calibration_result, 
                              error_stats: Dict,
                              direction_stats: Dict = None) -> pd.DataFrame:
        summary_data = {
            '指标': [
                '校准偏差 (bias)',
                '比例系数 (scale)',
                '均方根误差 (RMSE)',
                '平均绝对误差 (MAE)',
                '最大绝对误差',
                '最小绝对误差',
                '误差标准差',
                '决定系数 (R²)'
            ],
            '数值': [
                f'{calibration_result.bias:.6f}',
                f'{calibration_result.scale_factor:.6f}',
                f'{calibration_result.rmse:.6f}',
                f'{calibration_result.mae:.6f}',
                f'{calibration_result.max_error:.6f}',
                f'{calibration_result.min_error:.6f}',
                f'{calibration_result.std_error:.6f}',
                f'{calibration_result.r_squared:.6f}'
            ],
            '单位': ['mm', '', 'mm', 'mm', 'mm', 'mm', 'mm', '']
        }
        
        df = pd.DataFrame(summary_data)
        return df
    
    def export_report_data(self, data_df: pd.DataFrame, 
                           calibration_result,
                           validation_report: Dict,
                           conflict_report: Dict = None,
                           filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'calibration_report_{timestamp}.xlsx'
            
        filepath = self.output_dir / filename
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            data_df.to_excel(writer, sheet_name='原始数据', index=False)
            
            summary_df = pd.DataFrame({
                '指标': ['校准偏差', '比例系数', 'RMSE', 'MAE', '最大误差', 'R²'],
                '数值': [
                    calibration_result.bias,
                    calibration_result.scale_factor,
                    calibration_result.rmse,
                    calibration_result.mae,
                    calibration_result.max_error,
                    calibration_result.r_squared
                ]
            })
            summary_df.to_excel(writer, sheet_name='校准结果', index=False)
            
            if 'corrected_values' in data_df.columns:
                detail_df = pd.DataFrame({
                    '原始值': data_df.get('raw_values', ''),
                    '标准值': data_df.get('reference_values', ''),
                    '校准后': calibration_result.corrected_values,
                    '残差': calibration_result.residuals
                })
                detail_df.to_excel(writer, sheet_name='校准明细', index=False)
            
            warnings_data = []
            for warn_type, warn_data in validation_report.items():
                if isinstance(warn_data, dict) and warn_data.get('has_empty' if warn_type == 'empty_values' else 'has_duplicates' if warn_type == 'duplicates' else False):
                    warnings_data.append({
                        '警告类型': warn_type,
                        '详情': str(warn_data)
                    })
            
            if warnings_data:
                pd.DataFrame(warnings_data).to_excel(writer, sheet_name='数据警告', index=False)
                
        return str(filepath)
    
    def generate_html_report(self, figs: List[go.Figure],
                              summary_df: pd.DataFrame,
                              warnings: List[Dict],
                              suggestions: List[str],
                              filename: str = None) -> str:
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'calibration_report_{timestamp}.html'
            
        filepath = self.output_dir / filename
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>激光测距误差校准报告</title>
            <style>
                body {{ font-family: "Microsoft YaHei", Arial, sans-serif; margin: 20px; }}
                h1 {{ color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }}
                h2 {{ color: #34495e; margin-top: 30px; }}
                .warning-box {{ background-color: #fff3cd; border: 1px solid #ffeeba; padding: 15px; border-radius: 5px; margin: 10px 0; }}
                .suggestion-box {{ background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 10px 0; }}
                table {{ border-collapse: collapse; width: 100%; margin: 10px 0; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
                .chart-container {{ margin: 20px 0; }}
            </style>
        </head>
        <body>
            <h1>🔬 激光测距误差校准报告</h1>
            <p><strong>生成时间:</strong> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            
            <h2>📊 校准结果摘要</h2>
            {summary_df.to_html(index=False)}
        """
        
        if warnings:
            html_content += f"""
            <h2>⚠️ 数据质量警告</h2>
            <div class="warning-box">
                <ul>
            """
            for w in warnings:
                html_content += f"<li><strong>{w.get('message', '')}</strong>: {w.get('details', '')}</li>"
            html_content += """
                </ul>
            </div>
            """
            
        if suggestions:
            html_content += f"""
            <h2>💡 建议动作</h2>
            <div class="suggestion-box">
                <ul>
            """
            for s in suggestions:
                html_content += f"<li>{s}</li>"
            html_content += """
                </ul>
            </div>
            """
            
        html_content += "<h2>📈 分析图表</h2>"
        for i, fig in enumerate(figs):
            html_content += f'<div class="chart-container">{fig.to_html(full_html=False, include_plotlyjs="cdn" if i==0 else False)}</div>'
            
        html_content += """
        </body>
        </html>
        """
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)
            
        return str(filepath)
