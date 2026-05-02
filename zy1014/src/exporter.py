import os
from typing import Dict, List, Optional, Any
from datetime import datetime
import pandas as pd
import plotly.graph_objects as go

from .metrics import RoastMetrics, RoastPhase
from .storage import RoastNote, DEFECT_TAGS, POSITIVE_TAGS


class ReportExporter:
    def __init__(self):
        pass

    def export_markdown(self, 
                        df: pd.DataFrame,
                        metrics: RoastMetrics,
                        note: Optional[RoastNote] = None,
                        validation_issues: Optional[List[Dict]] = None,
                        title: str = "烘焙复盘报告") -> str:
        lines = []
        
        lines.append(f"# {title}")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        if note:
            lines.append("## 基本信息")
            lines.append(f"- **烘焙名称**: {note.roast_name}")
            if note.roast_date:
                lines.append(f"- **烘焙日期**: {note.roast_date}")
            if note.bean_origin:
                lines.append(f"- **产地**: {note.bean_origin}")
            if note.bean_variety:
                lines.append(f"- **品种**: {note.bean_variety}")
            if note.bean_process:
                lines.append(f"- **处理法**: {note.bean_process}")
            if note.roast_level:
                lines.append(f"- **烘焙度**: {note.roast_level}")
            if note.green_weight and note.roasted_weight:
                weight_loss = ((note.green_weight - note.roasted_weight) / note.green_weight * 100)
                lines.append(f"- **生豆重**: {note.green_weight}g | **熟豆重**: {note.roasted_weight}g | **失重**: {weight_loss:.1f}%")
            lines.append("")
        
        lines.append("## 关键指标")
        lines.append("")
        
        basic_metrics = [
            ("总时长", self._format_seconds(metrics.total_duration)),
            ("入豆温度", f"{metrics.charge_temperature:.1f}°C" if metrics.charge_temperature else "N/A"),
            ("下豆温度", f"{metrics.drop_temperature:.1f}°C" if metrics.drop_temperature else "N/A"),
            ("发展时间", self._format_seconds(metrics.development_time)),
            ("发展比例", f"{metrics.development_ratio:.1f}%" if metrics.development_ratio else "N/A"),
        ]
        
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        for name, value in basic_metrics:
            lines.append(f"| {name} | {value} |")
        lines.append("")
        
        lines.append("## 阶段分析")
        lines.append("")
        
        if metrics.phases:
            lines.append("| 阶段 | 耗时 | 温度变化 |")
            lines.append("|------|------|----------|")
            for phase_key, phase in metrics.phases.items():
                duration = self._format_seconds(phase.duration)
                temp_change = f"{phase.temp_change:+.1f}°C" if phase.temp_change else "N/A"
                lines.append(f"| {phase.name} | {duration} | {temp_change} |")
        else:
            lines.append("*未检测到完整的阶段事件数据*")
        lines.append("")
        
        lines.append("## RoR 分析")
        lines.append("")
        
        lines.append(f"- **平均 RoR**: {metrics.avg_ror_overall:.1f}°C/min" if metrics.avg_ror_overall else "- **平均 RoR**: N/A")
        lines.append(f"- **最小 RoR**: {metrics.min_ror:.1f}°C/min" if metrics.min_ror else "- **最小 RoR**: N/A")
        lines.append(f"- **最大 RoR**: {metrics.max_ror:.1f}°C/min" if metrics.max_ror else "- **最大 RoR**: N/A")
        lines.append("")
        
        if metrics.ror_anomalies:
            lines.append("### RoR 异常提醒")
            lines.append("")
            for anomaly in metrics.ror_anomalies:
                time_str = self._format_seconds(anomaly.get('time'))
                message = anomaly.get('message', '未知异常')
                lines.append(f"- **[{time_str}]** {message}")
            lines.append("")
        
        if validation_issues:
            lines.append("## 数据校验提醒")
            lines.append("")
            
            errors = [i for i in validation_issues if i.get('category') and 'error' in str(i.get('category', '').lower())]
            warnings = [i for i in validation_issues if i.get('category') and 'warning' in str(i.get('category', '').lower())]
            
            if errors:
                lines.append("### ⚠️ 错误")
                for issue in errors:
                    lines.append(f"- {issue.get('message', '未知错误')}")
                lines.append("")
            
            if warnings:
                lines.append("### ⚡ 警告")
                for issue in warnings:
                    lines.append(f"- {issue.get('message', '未知警告')}")
                lines.append("")
        
        if note:
            lines.append("## 复盘备注")
            lines.append("")
            
            if note.defects:
                lines.append("### 缺陷标签")
                lines.append(", ".join([f"`{d}`" for d in note.defects]))
                lines.append("")
            
            if note.positive_aspects:
                lines.append("### 优点标签")
                lines.append(", ".join([f"`{p}`" for p in note.positive_aspects]))
                lines.append("")
            
            if note.overall_notes:
                lines.append("### 总体评价")
                lines.append(note.overall_notes)
                lines.append("")
            
            if note.flavor_notes:
                lines.append("### 风味描述")
                lines.append(note.flavor_notes)
                lines.append("")
            
            if note.custom_tags:
                lines.append("### 自定义标签")
                lines.append(", ".join([f"`{t}`" for t in note.custom_tags]))
                lines.append("")
        
        lines.append("---")
        lines.append("*报告由烘焙曲线复盘工具生成*")
        
        return "\n".join(lines)

    def export_html(self,
                    df: pd.DataFrame,
                    metrics: RoastMetrics,
                    note: Optional[RoastNote] = None,
                    validation_issues: Optional[List[Dict]] = None,
                    fig: Optional[go.Figure] = None,
                    title: str = "烘焙复盘报告") -> str:
        html_parts = []
        
        html_parts.append("""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        * {{ box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            color: #333;
            line-height: 1.6;
        }}
        .container {{
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1 {{ color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }}
        h2 {{ color: #34495e; margin-top: 30px; border-left: 4px solid #3498db; padding-left: 10px; }}
        h3 {{ color: #5d6d7e; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }}
        th, td {{
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background-color: #3498db;
            color: white;
            font-weight: 600;
        }}
        tr:hover {{ background-color: #f8f9fa; }}
        .tag {{
            display: inline-block;
            padding: 4px 10px;
            margin: 2px 4px 2px 0;
            border-radius: 20px;
            font-size: 14px;
        }}
        .tag-defect {{ background-color: #ffebee; color: #c62828; }}
        .tag-positive {{ background-color: #e8f5e9; color: #2e7d32; }}
        .tag-custom {{ background-color: #fff3e0; color: #e65100; }}
        .alert {{
            padding: 15px;
            margin: 10px 0;
            border-radius: 5px;
            border-left: 4px solid;
        }}
        .alert-error {{ background-color: #ffebee; border-color: #f44336; }}
        .alert-warning {{ background-color: #fff3e0; border-color: #ff9800; }}
        .alert-info {{ background-color: #e3f2fd; border-color: #2196f3; }}
        .info-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }}
        .info-card {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
        }}
        .info-label {{
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
        }}
        .info-value {{
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            margin-top: 5px;
        }}
        .chart-container {{
            margin: 30px 0;
        }}
        footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 14px;
        }}
    </style>
</head>
<body>
    <div class="container">
""".format(title=title))
        
        html_parts.append(f"<h1>{title}</h1>")
        html_parts.append(f"<p><strong>生成时间</strong>: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>")
        
        if note:
            html_parts.append("<h2>基本信息</h2>")
            html_parts.append("<div class='info-grid'>")
            
            info_items = [
                ("烘焙名称", note.roast_name),
                ("烘焙日期", note.roast_date or "-"),
                ("产地", note.bean_origin or "-"),
                ("品种", note.bean_variety or "-"),
                ("处理法", note.bean_process or "-"),
                ("烘焙度", note.roast_level or "-"),
            ]
            
            for label, value in info_items:
                if value and value != "-":
                    html_parts.append(f"""
                        <div class='info-card'>
                            <div class='info-label'>{label}</div>
                            <div class='info-value'>{value}</div>
                        </div>
                    """)
            
            if note.green_weight and note.roasted_weight:
                weight_loss = ((note.green_weight - note.roasted_weight) / note.green_weight * 100)
                html_parts.append(f"""
                    <div class='info-card'>
                        <div class='info-label'>失重</div>
                        <div class='info-value'>{weight_loss:.1f}%</div>
                    </div>
                """)
            
            html_parts.append("</div>")
        
        html_parts.append("<h2>关键指标</h2>")
        html_parts.append("""
        <table>
            <thead>
                <tr><th>指标</th><th>值</th></tr>
            </thead>
            <tbody>
        """)
        
        basic_metrics = [
            ("总时长", self._format_seconds(metrics.total_duration)),
            ("入豆温度", f"{metrics.charge_temperature:.1f}°C" if metrics.charge_temperature else "N/A"),
            ("下豆温度", f"{metrics.drop_temperature:.1f}°C" if metrics.drop_temperature else "N/A"),
            ("发展时间", self._format_seconds(metrics.development_time)),
            ("发展比例", f"{metrics.development_ratio:.1f}%" if metrics.development_ratio else "N/A"),
            ("平均 RoR", f"{metrics.avg_ror_overall:.1f}°C/min" if metrics.avg_ror_overall else "N/A"),
        ]
        
        for name, value in basic_metrics:
            html_parts.append(f"<tr><td>{name}</td><td>{value}</td></tr>")
        
        html_parts.append("</tbody></table>")
        
        if metrics.phases:
            html_parts.append("<h2>阶段分析</h2>")
            html_parts.append("""
            <table>
                <thead>
                    <tr><th>阶段</th><th>耗时</th><th>温度变化</th></tr>
                </thead>
                <tbody>
            """)
            
            for phase_key, phase in metrics.phases.items():
                duration = self._format_seconds(phase.duration)
                temp_change = f"{phase.temp_change:+.1f}°C" if phase.temp_change else "N/A"
                html_parts.append(f"<tr><td>{phase.name}</td><td>{duration}</td><td>{temp_change}</td></tr>")
            
            html_parts.append("</tbody></table>")
        
        if metrics.ror_anomalies:
            html_parts.append("<h2>RoR 异常提醒</h2>")
            for anomaly in metrics.ror_anomalies:
                time_str = self._format_seconds(anomaly.get('time'))
                message = anomaly.get('message', '未知异常')
                html_parts.append(f"<div class='alert alert-warning'><strong>[{time_str}]</strong> {message}</div>")
        
        if validation_issues:
            html_parts.append("<h2>数据校验提醒</h2>")
            
            for issue in validation_issues:
                msg = issue.get('message', '未知问题')
                category = issue.get('category', '')
                
                if 'error' in str(category).lower():
                    html_parts.append(f"<div class='alert alert-error'>{msg}</div>")
                elif 'warning' in str(category).lower():
                    html_parts.append(f"<div class='alert alert-warning'>{msg}</div>")
                else:
                    html_parts.append(f"<div class='alert alert-info'>{msg}</div>")
        
        if note:
            html_parts.append("<h2>复盘备注</h2>")
            
            if note.defects:
                html_parts.append("<h3>缺陷标签</h3>")
                for d in note.defects:
                    html_parts.append(f"<span class='tag tag-defect'>{d}</span>")
                html_parts.append("<br><br>")
            
            if note.positive_aspects:
                html_parts.append("<h3>优点标签</h3>")
                for p in note.positive_aspects:
                    html_parts.append(f"<span class='tag tag-positive'>{p}</span>")
                html_parts.append("<br><br>")
            
            if note.custom_tags:
                html_parts.append("<h3>自定义标签</h3>")
                for t in note.custom_tags:
                    html_parts.append(f"<span class='tag tag-custom'>{t}</span>")
                html_parts.append("<br><br>")
            
            if note.overall_notes:
                html_parts.append(f"<h3>总体评价</h3><p>{note.overall_notes}</p>")
            
            if note.flavor_notes:
                html_parts.append(f"<h3>风味描述</h3><p>{note.flavor_notes}</p>")
        
        if fig:
            html_parts.append("<h2>烘焙曲线</h2>")
            html_parts.append("<div class='chart-container'>")
            fig_html = fig.to_html(full_html=False, include_plotlyjs='cdn')
            html_parts.append(fig_html)
            html_parts.append("</div>")
        
        html_parts.append("""
        <footer>
            报告由烘焙曲线复盘工具生成
        </footer>
    </div>
</body>
</html>
""")
        
        return "".join(html_parts)

    def export_comparison_markdown(self,
                                    roast_data_list: List[Dict],
                                    title: str = "多锅对比报告") -> str:
        lines = []
        
        lines.append(f"# {title}")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 对比概览")
        lines.append("")
        
        lines.append("| 烘焙 | 总时长 | 下豆温度 | 发展时间 | 发展比例 |")
        lines.append("|------|--------|----------|----------|----------|")
        
        for roast_data in roast_data_list:
            name = roast_data.get('name', 'Unknown')
            metrics = roast_data.get('metrics')
            
            if metrics:
                duration = self._format_seconds(metrics.total_duration)
                drop_temp = f"{metrics.drop_temperature:.1f}°C" if metrics.drop_temperature else "N/A"
                dev_time = self._format_seconds(metrics.development_time)
                dev_ratio = f"{metrics.development_ratio:.1f}%" if metrics.development_ratio else "N/A"
                lines.append(f"| {name} | {duration} | {drop_temp} | {dev_time} | {dev_ratio} |")
        
        lines.append("")
        
        lines.append("## 阶段对比")
        lines.append("")
        
        all_phases = set()
        for roast_data in roast_data_list:
            metrics = roast_data.get('metrics')
            if metrics and metrics.phases:
                for phase_key, phase in metrics.phases.items():
                    all_phases.add(phase.name)
        
        if all_phases:
            lines.append("### 阶段耗时对比")
            lines.append("")
            
            header = "| 阶段 |"
            separator = "|------|"
            for roast_data in roast_data_list:
                name = roast_data.get('name', 'Unknown')
                header += f" {name} |"
                separator += "-------|"
            
            lines.append(header)
            lines.append(separator)
            
            for phase_name in sorted(all_phases):
                row = f"| {phase_name} |"
                for roast_data in roast_data_list:
                    metrics = roast_data.get('metrics')
                    found = False
                    if metrics and metrics.phases:
                        for phase_key, phase in metrics.phases.items():
                            if phase.name == phase_name:
                                row += f" {self._format_seconds(phase.duration)} |"
                                found = True
                                break
                    if not found:
                        row += " N/A |"
                lines.append(row)
            
            lines.append("")
        
        lines.append("---")
        lines.append("*报告由烘焙曲线复盘工具生成*")
        
        return "\n".join(lines)

    def save_to_file(self, content: str, filepath: str) -> bool:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        except IOError as e:
            print(f"保存文件失败: {e}")
            return False

    def _format_seconds(self, seconds: float) -> str:
        if seconds is None:
            return "N/A"
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes}:{secs:02d}"
