"""结果导出模块。"""

import pandas as pd
import numpy as np
import json
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import asdict
from .config import AnalysisConfig
from .logger import AnalysisLogger
from .consistency_analyzer import AnalysisResult
from .quality_control import QCReport
from .report_generator import ReportGenerator


class Exporter:
    """结果导出器。"""
    
    def __init__(self, config: AnalysisConfig, logger: Optional[AnalysisLogger] = None):
        self.config = config
        self.logger = logger or AnalysisLogger(
            log_to_file=config.log_to_file,
            log_file=config.log_file,
            log_level=config.log_level
        )
    
    def export_all(self,
                  df: pd.DataFrame,
                  analysis_result: AnalysisResult,
                  qc_report: QCReport,
                  report_generator: ReportGenerator,
                  output_dir: str) -> Dict[str, str]:
        """导出所有结果。"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        export_files = {}
        
        self.logger.info("导出", f"开始导出结果到: {output_dir}")
        
        plot_files = report_generator.generate_all_plots(df, analysis_result, str(output_path / 'plots'))
        export_files['plots'] = plot_files
        
        excel_path = output_path / 'analysis_results.xlsx'
        self._export_to_excel(df, analysis_result, qc_report, excel_path)
        export_files['excel'] = str(excel_path)
        
        csv_path = output_path / 'analysis_results.csv'
        self._export_to_csv(df, analysis_result, qc_report, csv_path)
        export_files['csv'] = str(csv_path)
        
        json_path = output_path / 'analysis_results.json'
        self._export_to_json(analysis_result, qc_report, json_path)
        export_files['json'] = str(json_path)
        
        failed_samples_path = output_path / 'failed_samples.csv'
        self.logger.export_failed_samples(str(failed_samples_path), format='csv')
        export_files['failed_samples'] = str(failed_samples_path)
        
        failed_samples_json_path = output_path / 'failed_samples.json'
        self.logger.export_failed_samples(str(failed_samples_json_path), format='json')
        export_files['failed_samples_json'] = str(failed_samples_json_path)
        
        summary_html_path = output_path / 'summary_report.html'
        self._export_html_report(analysis_result, qc_report, summary_html_path)
        export_files['html_report'] = str(summary_html_path)
        
        self.logger.info("导出", f"所有结果导出完成，共 {len(export_files)} 个文件")
        
        return export_files
    
    def _export_to_excel(self,
                        df: pd.DataFrame,
                        analysis_result: AnalysisResult,
                        qc_report: QCReport,
                        output_path: Path) -> None:
        """导出到 Excel。"""
        try:
            with pd.ExcelWriter(output_path, engine='xlsxwriter') as writer:
                summary = self._create_summary_df(analysis_result, qc_report)
                summary.to_excel(writer, sheet_name='汇总', index=False)
                
                battery_metrics = self._battery_metrics_to_df(analysis_result)
                battery_metrics.to_excel(writer, sheet_name='电池指标', index=False)
                
                if not analysis_result.capacity_retention_summary.empty:
                    analysis_result.capacity_retention_summary.to_excel(
                        writer, sheet_name='容量保持率', index=False
                    )
                
                qc_issues = self._qc_issues_to_df(qc_report)
                if not qc_issues.empty:
                    qc_issues.to_excel(writer, sheet_name='质控问题', index=False)
                
                failed_samples = self._failed_samples_to_df()
                if not failed_samples.empty:
                    failed_samples.to_excel(writer, sheet_name='失败样本', index=False)
                
                if not df.empty:
                    df_export = df.copy()
                    for col in df_export.columns:
                        if df_export[col].dtype == 'object':
                            df_export[col] = df_export[col].astype(str)
                    df_export.to_excel(writer, sheet_name='原始数据', index=False)
                
                self._format_excel(writer)
            
            self.logger.info("导出", f"Excel 文件已导出: {output_path}")
        except Exception as e:
            self.logger.error("导出", f"导出 Excel 失败: {str(e)}")
    
    def _format_excel(self, writer: pd.ExcelWriter) -> None:
        """格式化 Excel 文件。"""
        workbook = writer.book
        
        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#4472C4',
            'font_color': 'white',
            'border': 1,
            'align': 'center',
            'valign': 'vcenter'
        })
        
        for sheet_name in writer.sheets:
            worksheet = writer.sheets[sheet_name]
            df = pd.read_excel(writer, sheet_name=sheet_name)
            
            for col_num, value in enumerate(df.columns.values):
                worksheet.write(0, col_num, value, header_format)
            
            worksheet.set_column('A:Z', 15)
            worksheet.freeze_panes(1, 0)
    
    def _create_summary_df(self,
                          analysis_result: AnalysisResult,
                          qc_report: QCReport) -> pd.DataFrame:
        """创建汇总 DataFrame。"""
        summary_data = []
        
        batch_summary = analysis_result.batch_summary
        consistency_metrics = analysis_result.consistency_metrics
        
        summary_data.append(['批次信息', '电池数量', batch_summary.get('电池数量', 0), '个'])
        
        init_stats = batch_summary.get('初始容量统计', {})
        for key, value in init_stats.items():
            if value is not None:
                summary_data.append(['初始容量', key, value, ''])
        
        fade_stats = batch_summary.get('衰减率统计', {})
        for key, value in fade_stats.items():
            if value is not None:
                summary_data.append(['衰减率', key, value, ''])
        
        if consistency_metrics:
            summary_data.append(['一致性', '初始容量CV(%)', consistency_metrics.cv_initial_capacity, ''])
            summary_data.append(['一致性', '衰减率CV(%)', consistency_metrics.cv_fade_rate, ''])
            summary_data.append(['一致性', '综合CV值(%)', consistency_metrics.cv_cv_score, ''])
            summary_data.append(['一致性', '一致性等级', consistency_metrics.consistency_level, ''])
        
        summary_data.append(['质量控制', '通过样本数', qc_report.passed_samples, '个'])
        summary_data.append(['质量控制', '警告样本数', qc_report.warning_samples, '个'])
        summary_data.append(['质量控制', '失败样本数', qc_report.failed_samples, '个'])
        
        for issue_type, count in qc_report.by_type.items():
            summary_data.append(['质控问题类型', issue_type, count, '次'])
        
        return pd.DataFrame(summary_data, columns=['类别', '指标', '数值', '单位'])
    
    def _battery_metrics_to_df(self, analysis_result: AnalysisResult) -> pd.DataFrame:
        """将电池指标转换为 DataFrame。"""
        data = []
        for bid, metrics in analysis_result.battery_metrics.items():
            row = {
                '电池编号': bid,
                '初始容量(mAh)': round(metrics.initial_capacity, 2),
                '最大循环次数': metrics.max_cycle,
                '衰减率(%/循环)': round(metrics.capacity_fade_rate, 6),
                '预估循环寿命(次)': metrics.cycle_life_estimate,
                '80%保持率循环(次)': metrics.initial_cycle_to_80,
            }
            
            for cycle, retention in metrics.capacity_retention_at_target.items():
                if pd.notna(retention):
                    row[f'{cycle}次保持率(%)'] = round(retention, 2)
                else:
                    row[f'{cycle}次保持率(%)'] = 'N/A'
            
            data.append(row)
        
        return pd.DataFrame(data)
    
    def _qc_issues_to_df(self, qc_report: QCReport) -> pd.DataFrame:
        """将质控问题转换为 DataFrame。"""
        data = []
        for issue in qc_report.issues:
            data.append({
                '电池编号': issue.battery_id,
                '问题类型': issue.issue_type,
                '描述': issue.description,
                '循环次数': issue.cycle_number if issue.cycle_number is not None else 'N/A',
                '异常值': issue.value if issue.value is not None else 'N/A',
                '严重程度': issue.severity
            })
        
        return pd.DataFrame(data)
    
    def _failed_samples_to_df(self) -> pd.DataFrame:
        """将失败样本转换为 DataFrame。"""
        data = []
        for sample in self.logger.failed_samples:
            data.append({
                '电池编号': sample.battery_id,
                '错误类型': sample.error_type,
                '错误信息': sample.error_message,
                '时间戳': sample.timestamp,
                '循环次数': sample.cycle_number if sample.cycle_number is not None else 'N/A',
                '异常值': sample.value if sample.value is not None else 'N/A',
                '详情': json.dumps(sample.details, ensure_ascii=False) if sample.details else ''
            })
        
        return pd.DataFrame(data)
    
    def _export_to_csv(self,
                      df: pd.DataFrame,
                      analysis_result: AnalysisResult,
                      qc_report: QCReport,
                      output_path: Path) -> None:
        """导出到 CSV。"""
        try:
            battery_metrics = self._battery_metrics_to_df(analysis_result)
            battery_metrics.to_csv(output_path, index=False, encoding='utf-8-sig')
            self.logger.info("导出", f"CSV 文件已导出: {output_path}")
        except Exception as e:
            self.logger.error("导出", f"导出 CSV 失败: {str(e)}")
    
    def _export_to_json(self,
                       analysis_result: AnalysisResult,
                       qc_report: QCReport,
                       output_path: Path) -> None:
        """导出到 JSON。"""
        try:
            export_data = {
                'batch_summary': analysis_result.batch_summary,
                'battery_metrics': {
                    bid: asdict(metrics) for bid, metrics in analysis_result.battery_metrics.items()
                },
                'consistency_metrics': asdict(analysis_result.consistency_metrics) 
                    if analysis_result.consistency_metrics else None,
                'qc_report': {
                    'total_samples': qc_report.total_samples,
                    'passed_samples': qc_report.passed_samples,
                    'failed_samples': qc_report.failed_samples,
                    'warning_samples': qc_report.warning_samples,
                    'issues_by_type': qc_report.by_type,
                    'issues': [asdict(issue) for issue in qc_report.issues]
                },
                'failed_samples': self.logger.get_failed_samples_summary()
            }
            
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, ensure_ascii=False, indent=2, default=str)
            
            self.logger.info("导出", f"JSON 文件已导出: {output_path}")
        except Exception as e:
            self.logger.error("导出", f"导出 JSON 失败: {str(e)}")
    
    def _export_html_report(self,
                           analysis_result: AnalysisResult,
                           qc_report: QCReport,
                           output_path: Path) -> None:
        """导出 HTML 报告。"""
        try:
            consistency_metrics = analysis_result.consistency_metrics
            batch_summary = analysis_result.batch_summary
            
            consistency_color = {
                '优秀': '#28a745',
                '良好': '#17a2b8',
                '一般': '#ffc107',
                '较差': '#dc3545'
            }.get(consistency_metrics.consistency_level if consistency_metrics else '较差', '#6c757d')
            
            html = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>电池批次一致性分析报告</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 20px;
        }}
        .header h1 {{
            margin: 0;
            font-size: 28px;
        }}
        .consistency-badge {{
            display: inline-block;
            padding: 10px 20px;
            border-radius: 25px;
            font-size: 18px;
            font-weight: bold;
            margin-top: 15px;
        }}
        .card {{
            background: white;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        .card h2 {{
            margin-top: 0;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }}
        .stat-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }}
        .stat-item {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }}
        .stat-value {{
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
        }}
        .stat-label {{
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background-color: #667eea;
            color: white;
        }}
        tr:hover {{
            background-color: #f5f5f5;
        }}
        .qc-status {{
            display: inline-block;
            padding: 5px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: bold;
        }}
        .status-pass {{ background: #d4edda; color: #155724; }}
        .status-warning {{ background: #fff3cd; color: #856404; }}
        .status-fail {{ background: #f8d7da; color: #721c24; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>电池批次一致性分析报告</h1>
            <p>批次: {batch_summary.get('批次名称', '未知批次')}</p>
            <div class="consistency-badge" style="background-color: {consistency_color}; color: white;">
                一致性等级: {consistency_metrics.consistency_level if consistency_metrics else '未知'}
            </div>
        </div>
        
        <div class="card">
            <h2>批次概览</h2>
            <div class="stat-grid">
                <div class="stat-item">
                    <div class="stat-value">{batch_summary.get('电池数量', 0)}</div>
                    <div class="stat-label">电池数量</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{consistency_metrics.cv_cv_score:.2f}%</div>
                    <div class="stat-label">综合CV值</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{qc_report.passed_samples}</div>
                    <div class="stat-label">质控通过</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{qc_report.failed_samples}</div>
                    <div class="stat-label">质控失败</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>初始容量统计</h2>
            <div class="stat-grid">
                <div class="stat-item">
                    <div class="stat-value">{batch_summary.get('初始容量统计', {}).get('均值(mAh)', 0):.1f}</div>
                    <div class="stat-label">均值 (mAh)</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{batch_summary.get('初始容量统计', {}).get('标准差(mAh)', 0):.1f}</div>
                    <div class="stat-label">标准差 (mAh)</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{batch_summary.get('初始容量统计', {}).get('最小值(mAh)', 0):.1f}</div>
                    <div class="stat-label">最小值 (mAh)</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{batch_summary.get('初始容量统计', {}).get('最大值(mAh)', 0):.1f}</div>
                    <div class="stat-label">最大值 (mAh)</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>衰减率统计</h2>
            <div class="stat-grid">
                <div class="stat-item">
                    <div class="stat-value">{batch_summary.get('衰减率统计', {}).get('均值(%/循环)', 0):.4f}</div>
                    <div class="stat-label">均值 (%/循环)</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{batch_summary.get('衰减率统计', {}).get('标准差(%/循环)', 0):.4f}</div>
                    <div class="stat-label">标准差</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">{consistency_metrics.cv_fade_rate:.2f}%</div>
                    <div class="stat-label">衰减率CV</div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <h2>质量控制状态</h2>
            <table>
                <tr>
                    <th>状态</th>
                    <th>数量</th>
                    <th>说明</th>
                </tr>
                <tr>
                    <td><span class="qc-status status-pass">通过</span></td>
                    <td>{qc_report.passed_samples}</td>
                    <td>无严重质控问题</td>
                </tr>
                <tr>
                    <td><span class="qc-status status-warning">警告</span></td>
                    <td>{qc_report.warning_samples}</td>
                    <td>存在轻微异常，已标注</td>
                </tr>
                <tr>
                    <td><span class="qc-status status-fail">失败</span></td>
                    <td>{qc_report.failed_samples}</td>
                    <td>存在严重质控问题</td>
                </tr>
            </table>
        </div>
        
        <div class="card">
            <h2>分析图表</h2>
            <p>请查看 plots 目录下的图表文件:</p>
            <ul>
                <li>capacity_vs_cycle.png - 容量衰减曲线</li>
                <li>capacity_retention.png - 容量保持率曲线</li>
                <li>initial_capacity_distribution.png - 初始容量分布</li>
                <li>fade_rate_distribution.png - 衰减率分布</li>
                <li>consistency_radar.png - 一致性雷达图</li>
                <li>battery_comparison.png - 电池性能对比</li>
            </ul>
        </div>
    </div>
</body>
</html>
"""
            
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(html)
            
            self.logger.info("导出", f"HTML 报告已导出: {output_path}")
        except Exception as e:
            self.logger.error("导出", f"导出 HTML 报告失败: {str(e)}")
