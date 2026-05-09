from __future__ import annotations

import json
import csv
import os
from datetime import datetime, date
from typing import Dict, Optional, List, Any, TextIO

from task_compensation.models import ExecutionReport, CompensationPlan


class ResultExporter:
    def __init__(self, export_dir: str = "./data/reports"):
        self.export_dir = export_dir
        os.makedirs(export_dir, exist_ok=True)
    
    def export_report(self, report: ExecutionReport, 
                     format: str = "json") -> str:
        if format == "json":
            return self._export_json(report)
        elif format == "csv":
            return self._export_csv(report)
        elif format == "html":
            return self._export_html(report)
        else:
            raise ValueError(f"不支持的导出格式: {format}")
    
    def _export_json(self, report: ExecutionReport) -> str:
        file_path = os.path.join(
            self.export_dir,
            f"report_{report.target_date.isoformat()}_{report.report_id}.json"
        )
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
        
        return file_path
    
    def _export_csv(self, report: ExecutionReport) -> str:
        file_path = os.path.join(
            self.export_dir,
            f"report_{report.target_date.isoformat()}_{report.report_id}.csv"
        )
        
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow(["执行报告概要"])
            writer.writerow(["报告ID", report.report_id])
            writer.writerow(["计划ID", report.plan_id])
            writer.writerow(["目标日期", report.target_date.isoformat()])
            writer.writerow(["生成时间", report.generated_at.isoformat()])
            writer.writerow([])
            
            writer.writerow(["执行统计"])
            writer.writerow(["总任务数", report.total_tasks])
            writer.writerow(["成功", report.success_count])
            writer.writerow(["失败", report.failed_count])
            writer.writerow(["跳过", report.skipped_count])
            writer.writerow(["取消", report.cancelled_count])
            writer.writerow(["成功率", f"{report.get_success_rate():.2f}%"])
            writer.writerow(["总耗时(秒)", f"{report.total_duration:.2f}"])
            writer.writerow([])
            
            writer.writerow(["任务详情"])
            writer.writerow([
                "任务ID", "状态", "耗时(秒)", "重试次数", "错误信息"
            ])
            
            for result in report.task_results:
                writer.writerow([
                    result.task_id,
                    result.status.value,
                    f"{result.duration:.2f}" if result.duration else "",
                    result.retry_count,
                    result.error_message or ""
                ])
            
            writer.writerow([])
            writer.writerow(["失败样本"])
            writer.writerow(["样本ID", "任务ID", "执行日期", "错误信息"])
            
            for sample in report.failure_samples:
                writer.writerow([
                    sample.sample_id,
                    sample.task_id,
                    sample.execution_date.isoformat(),
                    sample.error_message
                ])
            
            writer.writerow([])
            writer.writerow(["建议"])
            for recommendation in report.recommendations:
                writer.writerow([recommendation])
        
        return file_path
    
    def _export_html(self, report: ExecutionReport) -> str:
        file_path = os.path.join(
            self.export_dir,
            f"report_{report.target_date.isoformat()}_{report.report_id}.html"
        )
        
        html_content = self._generate_html_report(report)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return file_path
    
    def _generate_html_report(self, report: ExecutionReport) -> str:
        failure_samples_html = ""
        if report.failure_samples:
            failure_samples_html = f"""
        <div class="section">
            <h2>失败样本 ({len(report.failure_samples)})</h2>
            <table class="details-table">
                <tr><th>样本ID</th><th>任务ID</th><th>执行日期</th><th>错误信息</th></tr>
                {''.join(f'''
                <tr>
                    <td>{sample.sample_id[:8]}</td>
                    <td>{sample.task_id}</td>
                    <td>{sample.execution_date.isoformat()}</td>
                    <td class="error-cell">{sample.error_message[:200]}{'...' if len(sample.error_message) > 200 else ''}</td>
                </tr>''' for sample in report.failure_samples)}
            </table>
        </div>
        """
        
        recommendations_html = ""
        if report.recommendations:
            recommendations_html = f"""
        <div class="section">
            <h2>建议</h2>
            <ul class="recommendations">
                {''.join(f'<li>{rec}</li>' for rec in report.recommendations)}
            </ul>
        </div>
        """
        
        return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>任务补偿执行报告 - {report.target_date.isoformat()}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                  color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }}
        .section {{ background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h2 {{ color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px; }}
        .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
                       gap: 15px; }}
        .stat-card {{ background: #f8f9fa; padding: 15px; border-radius: 8px;
                      text-align: center; border-left: 4px solid #667eea; }}
        .stat-card.success {{ border-left-color: #28a745; }}
        .stat-card.failed {{ border-left-color: #dc3545; }}
        .stat-card.skipped {{ border-left-color: #ffc107; }}
        .stat-value {{ font-size: 2em; font-weight: bold; color: #333; }}
        .stat-label {{ color: #666; margin-top: 5px; }}
        .details-table {{ width: 100%; border-collapse: collapse; }}
        .details-table th, .details-table td {{ padding: 12px; text-align: left; 
                                                 border-bottom: 1px solid #ddd; }}
        .details-table th {{ background-color: #f8f9fa; }}
        .status-success {{ color: #28a745; font-weight: bold; }}
        .status-failed {{ color: #dc3545; font-weight: bold; }}
        .status-skipped {{ color: #ffc107; font-weight: bold; }}
        .error-cell {{ max-width: 300px; overflow: hidden; text-overflow: ellipsis; 
                       white-space: nowrap; color: #dc3545; }}
        .recommendations {{ list-style-type: none; padding: 0; }}
        .recommendations li {{ padding: 10px; background: #e7f3ff; margin-bottom: 5px;
                               border-left: 4px solid #007bff; border-radius: 4px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>任务补偿执行报告</h1>
            <p>目标日期: {report.target_date.isoformat()} | 报告ID: {report.report_id[:12]}...</p>
            <p>生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}</p>
        </div>
        
        <div class="section">
            <h2>执行统计</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">{report.total_tasks}</div>
                    <div class="stat-label">总任务数</div>
                </div>
                <div class="stat-card success">
                    <div class="stat-value">{report.success_count}</div>
                    <div class="stat-label">成功</div>
                </div>
                <div class="stat-card failed">
                    <div class="stat-value">{report.failed_count}</div>
                    <div class="stat-label">失败</div>
                </div>
                <div class="stat-card skipped">
                    <div class="stat-value">{report.skipped_count}</div>
                    <div class="stat-label">跳过</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{report.get_success_rate():.1f}%</div>
                    <div class="stat-label">成功率</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">{report.total_duration:.1f}s</div>
                    <div class="stat-label">总耗时</div>
                </div>
            </div>
        </div>
        
        <div class="section">
            <h2>任务详情</h2>
            <table class="details-table">
                <tr><th>任务ID</th><th>状态</th><th>耗时(秒)</th><th>重试次数</th><th>错误信息</th></tr>
                {''.join(f'''
                <tr>
                    <td>{result.task_id}</td>
                    <td class="status-{result.status.value}">{result.status.value}</td>
                    <td>{result.duration:.2f if result.duration else '-'}</td>
                    <td>{result.retry_count}</td>
                    <td class="error-cell">{result.error_message or '-'}</td>
                </tr>''' for result in report.task_results)}
            </table>
        </div>
        
        {failure_samples_html}
        {recommendations_html}
    </div>
</body>
</html>
"""
    
    def export_plan(self, plan: CompensationPlan) -> str:
        file_path = os.path.join(
            self.export_dir,
            f"plan_{plan.target_date.isoformat()}_{plan.plan_id}.json"
        )
        
        plan_dict = plan.dict()
        plan_dict['generated_at'] = plan.generated_at.isoformat()
        plan_dict['target_date'] = plan.target_date.isoformat()
        
        for step in plan_dict['steps']:
            step['execution_date'] = step['execution_date'].isoformat()
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(plan_dict, f, ensure_ascii=False, indent=2, default=str)
        
        return file_path
