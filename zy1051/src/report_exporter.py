import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional
from io import StringIO
import base64

from src.anomaly_analyzer import Anomaly, AnomalyAnalyzer
from src.schedule_simulator import ScenarioResult

class ReportExporter:
    def __init__(
        self,
        overview_stats: Dict,
        anomalies: List[Anomaly],
        scenario_results: List[ScenarioResult] = None,
        filtered_df: pd.DataFrame = None
    ):
        self.overview_stats = overview_stats
        self.anomalies = anomalies
        self.scenario_results = scenario_results or []
        self.filtered_df = filtered_df
        self.export_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    def generate_markdown(self) -> str:
        lines = []
        
        lines.append("# 通勤班车准点分析报告")
        lines.append("")
        lines.append(f"**生成时间**: {self.export_time}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 一、关键指标概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总记录数 | {self.overview_stats.get('总记录数', 0)} |")
        lines.append(f"| 线路数 | {self.overview_stats.get('线路数', 0)} |")
        lines.append(f"| 站点数 | {self.overview_stats.get('站点数', 0)} |")
        lines.append(f"| 平均准点率 | {self.overview_stats.get('平均准点率', 0):.1f}% |")
        lines.append(f"| 平均延误 | {self.overview_stats.get('平均延误_分钟', 0):.1f} 分钟 |")
        lines.append(f"| 平均座位利用率 | {self.overview_stats.get('平均座位利用率', 0):.1f}% |")
        lines.append(f"| 超载次数 | {self.overview_stats.get('超载次数', 0)} |")
        lines.append(f"| 严重延误次数 | {self.overview_stats.get('严重延误次数', 0)} |")
        lines.append("")
        
        lines.append("## 二、异常问题汇总")
        lines.append("")
        
        if not self.anomalies:
            lines.append("未检测到明显异常问题。")
            lines.append("")
        else:
            by_severity = self._group_anomalies_by_severity()
            
            for severity in ['严重', '中等', '轻微']:
                if severity in by_severity and by_severity[severity]:
                    lines.append(f"### {severity}问题")
                    lines.append("")
                    
                    for idx, anomaly in enumerate(by_severity[severity], 1):
                        lines.append(f"#### {idx}. {anomaly.anomaly_type.value}")
                        lines.append("")
                        lines.append(f"- **位置**: {anomaly.location}")
                        lines.append(f"- **描述**: {anomaly.description}")
                        lines.append("")
                        lines.append("**指标详情**:")
                        lines.append("")
                        for key, value in anomaly.metrics.items():
                            lines.append(f"- {key}: {value}")
                        lines.append("")
                        lines.append(f"**原因分析**: {anomaly.cause_analysis}")
                        lines.append("")
                        lines.append(f"**调整建议**: {anomaly.suggestion}")
                        lines.append("")
                        lines.append("---")
                        lines.append("")
        
        if self.scenario_results:
            lines.append("## 三、调班方案对比")
            lines.append("")
            
            for idx, result in enumerate(self.scenario_results, 1):
                lines.append(f"### 方案 {idx}: {result.scenario_name}")
                lines.append("")
                
                lines.append("#### 调整前后对比")
                lines.append("")
                lines.append("| 指标 | 调整前 | 调整后 | 改善情况 |")
                lines.append("|------|--------|--------|----------|")
                
                metrics_map = {
                    '准点率': ('准点率', '%'),
                    '平均延误_分钟': ('平均延误', '分钟'),
                    '严重延误率': ('严重延误率', '%'),
                    '平均座位利用率': ('平均座位利用率', '%'),
                    '超载率': ('超载率', '%'),
                    '高满载率': ('高满载率', '%'),
                }
                
                for key, (label, unit) in metrics_map.items():
                    orig = result.original_metrics.get(key, 0)
                    adj = result.adjusted_metrics.get(key, 0)
                    improvement = result.improvement_summary.get(key, 0)
                    
                    if key == '准点率':
                        improvement_sign = '+' if improvement >= 0 else ''
                    else:
                        improvement_sign = '-' if improvement >= 0 else '+'
                    
                    lines.append(f"| {label} | {orig:.1f}{unit} | {adj:.1f}{unit} | {improvement_sign}{abs(improvement):.1f}{unit} |")
                
                lines.append("")
                
                lines.append("#### 方案评估")
                lines.append("")
                
                good_improvements = []
                if result.improvement_summary.get('准点率', 0) > 5:
                    good_improvements.append(f"准点率提升显著 (+{result.improvement_summary['准点率']:.1f}%)")
                if result.improvement_summary.get('平均延误_分钟', 0) > 2:
                    good_improvements.append(f"平均延误减少明显 (-{result.improvement_summary['平均延误_分钟']:.1f}分钟)")
                if result.improvement_summary.get('超载率', 0) > 5:
                    good_improvements.append(f"超载率大幅下降 (-{result.improvement_summary['超载率']:.1f}%)")
                
                if good_improvements:
                    lines.append("**优势**: " + "；".join(good_improvements))
                else:
                    lines.append("该方案改善效果有限，建议考虑其他方案。")
                
                lines.append("")
                lines.append("---")
                lines.append("")
        
        lines.append("## 四、结论与建议")
        lines.append("")
        
        severe_count = len([a for a in self.anomalies if a.severity == '严重'])
        medium_count = len([a for a in self.anomalies if a.severity == '中等'])
        
        if severe_count > 0:
            lines.append(f"**紧急优先级**: 存在 {severe_count} 个严重问题需要立即处理。")
            lines.append("")
            
            for anomaly in [a for a in self.anomalies if a.severity == '严重'][:3]:
                lines.append(f"- **{anomaly.anomaly_type.value}** ({anomaly.location}): {anomaly.description}")
                lines.append(f"  建议: {anomaly.suggestion}")
                lines.append("")
        
        if medium_count > 0:
            lines.append(f"**中期优化**: 存在 {medium_count} 个中等问题建议在1-2周内处理。")
            lines.append("")
        
        if self.scenario_results:
            best_result = max(self.scenario_results, key=lambda r: (
                r.improvement_summary.get('准点率', 0),
                -r.improvement_summary.get('平均延误_分钟', 0)
            ))
            
            lines.append("**推荐方案**: ")
            lines.append(f"方案 '{best_result.scenario_name}' 效果最佳。")
            if best_result.improvement_summary.get('准点率', 0) > 0:
                lines.append(f"预计可提升准点率 {best_result.improvement_summary['准点率']:.1f}%，")
            if best_result.improvement_summary.get('平均延误_分钟', 0) > 0:
                lines.append(f"减少平均延误 {best_result.improvement_summary['平均延误_分钟']:.1f} 分钟。")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由通勤班车准点分析工具自动生成*")
        
        return "\n".join(lines)
    
    def generate_html(self) -> str:
        markdown_content = self.generate_markdown()
        
        html_template = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>通勤班车准点分析报告</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background-color: #fafafa;
        }}
        h1, h2, h3, h4 {{
            color: #1a1a1a;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
        }}
        h1 {{
            font-size: 2em;
            border-bottom: 3px solid #4CAF50;
            padding-bottom: 10px;
        }}
        h2 {{
            font-size: 1.5em;
            border-bottom: 2px solid #e0e0e0;
            padding-bottom: 8px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
            background-color: white;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }}
        th {{
            background-color: #4CAF50;
            color: white;
            font-weight: bold;
        }}
        tr:nth-child(even) {{
            background-color: #f9f9f9;
        }}
        tr:hover {{
            background-color: #f1f1f1;
        }}
        hr {{
            border: none;
            border-top: 1px solid #ddd;
            margin: 2em 0;
        }}
        .severity-severe {{
            background-color: #ffebee;
            border-left: 4px solid #f44336;
            padding: 10px 15px;
            margin: 1em 0;
        }}
        .severity-medium {{
            background-color: #fff3e0;
            border-left: 4px solid #ff9800;
            padding: 10px 15px;
            margin: 1em 0;
        }}
        .severity-minor {{
            background-color: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 10px 15px;
            margin: 1em 0;
        }}
        .improvement-positive {{
            color: #4CAF50;
            font-weight: bold;
        }}
        .improvement-negative {{
            color: #f44336;
        }}
        .metadata {{
            color: #666;
            font-size: 0.9em;
            margin-bottom: 1em;
        }}
        ul {{
            margin-left: 20px;
        }}
        li {{
            margin: 0.5em 0;
        }}
    </style>
</head>
<body>
    <div class="metadata">
        <strong>生成时间:</strong> {self.export_time}
    </div>
    {self._markdown_to_html(markdown_content)}
</body>
</html>"""
        
        return html_template
    
    def _markdown_to_html(self, md_text: str) -> str:
        lines = md_text.split('\n')
        html_lines = []
        in_table = False
        table_rows = []
        
        for line in lines:
            if line.strip() == '':
                if in_table and table_rows:
                    html_lines.append(self._render_table(table_rows))
                    table_rows = []
                    in_table = False
                html_lines.append('')
                continue
            
            if line.startswith('# '):
                html_lines.append(f'<h1>{line[2:]}</h1>')
            elif line.startswith('## '):
                html_lines.append(f'<h2>{line[3:]}</h2>')
            elif line.startswith('### '):
                html_lines.append(f'<h3>{line[4:]}</h3>')
            elif line.startswith('#### '):
                html_lines.append(f'<h4>{line[5:]}</h4>')
            elif line.startswith('---'):
                html_lines.append('<hr>')
            elif line.startswith('|') and '|' in line[1:]:
                in_table = True
                table_rows.append(line)
            elif line.startswith('- **'):
                line = line[2:]
                html_lines.append(f'<li>{self._format_inline_markdown(line)}</li>')
            elif line.startswith('  - '):
                line = line[4:]
                html_lines.append(f'<li>{self._format_inline_markdown(line)}</li>')
            elif line.startswith('**'):
                html_lines.append(f'<p>{self._format_inline_markdown(line)}</p>')
            else:
                html_lines.append(f'<p>{self._format_inline_markdown(line)}</p>')
        
        if in_table and table_rows:
            html_lines.append(self._render_table(table_rows))
        
        return '\n'.join(html_lines)
    
    def _format_inline_markdown(self, text: str) -> str:
        import re
        
        text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
        text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', text)
        
        return text
    
    def _render_table(self, rows: List[str]) -> str:
        if len(rows) < 2:
            return ''
        
        header_row = rows[0]
        separator_row = rows[1]
        data_rows = rows[2:]
        
        headers = [h.strip() for h in header_row.strip().strip('|').split('|')]
        
        html = '<table>'
        html += '<thead><tr>'
        for header in headers:
            html += f'<th>{self._format_inline_markdown(header)}</th>'
        html += '</tr></thead>'
        
        html += '<tbody>'
        for row in data_rows:
            cells = [c.strip() for c in row.strip().strip('|').split('|')]
            html += '<tr>'
            for cell in cells:
                html += f'<td>{self._format_inline_markdown(cell)}</td>'
            html += '</tr>'
        html += '</tbody></table>'
        
        return html
    
    def _group_anomalies_by_severity(self) -> Dict[str, List[Anomaly]]:
        groups = {'严重': [], '中等': [], '轻微': []}
        for anomaly in self.anomalies:
            if anomaly.severity in groups:
                groups[anomaly.severity].append(anomaly)
        return groups
    
    def get_downloadable_markdown(self) -> Tuple[str, str]:
        content = self.generate_markdown()
        b64 = base64.b64encode(content.encode('utf-8')).decode()
        return f'data:text/markdown;base64,{b64}', content
    
    def get_downloadable_html(self) -> Tuple[str, str]:
        content = self.generate_html()
        b64 = base64.b64encode(content.encode('utf-8')).decode()
        return f'data:text/html;base64,{b64}', content
