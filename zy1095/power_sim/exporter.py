from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
import json

from .models import (
    BatterySpec, Load, SolarPanel, Plan, SimulationResult
)
from .risk_analyzer import Risk, RiskLevel


class ReportExporter:
    """报告导出器 - 支持导出 Markdown、HTML、JSON 格式"""
    
    def __init__(
        self,
        battery: BatterySpec,
        loads: List[Load],
        solar_panels: List[SolarPanel],
        plan: Plan,
        simulation_result: SimulationResult,
        risks: List[Risk],
        recommendations: List[str]
    ):
        self.battery = battery
        self.loads = loads
        self.solar_panels = solar_panels
        self.plan = plan
        self.simulation_result = simulation_result
        self.risks = risks
        self.recommendations = recommendations
    
    def to_json(self) -> str:
        """导出 JSON 格式报告"""
        report_data = {
            "metadata": {
                "plan_name": self.plan.name,
                "battery_name": self.battery.name,
                "generated_at": datetime.now().isoformat(),
                "simulation_start_hour": self.plan.simulation_start_hour,
                "simulation_duration_hours": self.plan.simulation_duration_hours
            },
            "battery_spec": {
                "name": self.battery.name,
                "capacity_ah": self.battery.capacity_ah,
                "capacity_wh": self.battery.capacity_wh,
                "usable_capacity_wh": self.battery.usable_capacity_wh,
                "voltage": self.battery.voltage,
                "chemistry": self.battery.chemistry.value,
                "min_soc_percent": self.battery.min_soc_percent,
                "max_soc_percent": self.battery.max_soc_percent,
                "initial_soc_percent": self.battery.initial_soc_percent,
                "inverter_max_power_w": self.battery.inverter_max_power_w,
                "inverter_efficiency_percent": self.battery.inverter_efficiency_percent
            },
            "loads": [
                {
                    "name": load.name,
                    "device_type": load.device_type.value,
                    "power_w": load.actual_power_w,
                    "priority": load.priority.value,
                    "start_time": str(load.start_time),
                    "end_time": str(load.end_time),
                    "duty_cycle_percent": load.duty_cycle_percent
                }
                for load in self.loads
            ],
            "solar_panels": [
                {
                    "name": panel.name,
                    "max_power_w": panel.max_power_w,
                    "efficiency_percent": panel.efficiency_percent,
                    "start_time": str(panel.start_time),
                    "end_time": str(panel.end_time)
                }
                for panel in self.solar_panels
            ],
            "simulation_summary": {
                "initial_soc_percent": self.simulation_result.initial_soc_percent,
                "final_soc_percent": self.simulation_result.final_soc_percent,
                "min_soc_percent": self.simulation_result.min_soc_percent,
                "max_soc_percent": self.simulation_result.max_soc_percent,
                "total_consumption_wh": self.simulation_result.total_consumption_wh,
                "total_solar_generation_wh": self.simulation_result.total_solar_generation_wh,
                "blackout_hour": self.simulation_result.blackout_hour
            },
            "risks": [risk.to_dict() for risk in self.risks],
            "recommendations": self.recommendations,
            "hourly_data": self.simulation_result.hourly_data
        }
        
        return json.dumps(report_data, indent=2, ensure_ascii=False)
    
    def to_markdown(self) -> str:
        """导出 Markdown 格式报告"""
        lines = []
        
        lines.append(f"# 户外电源模拟报告: {self.plan.name}")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**模拟时长**: {self.plan.simulation_duration_hours} 小时")
        lines.append("")
        
        lines.append("## 一、关键风险")
        lines.append("")
        if self.risks:
            critical_risks = [r for r in self.risks if r.level == RiskLevel.CRITICAL]
            high_risks = [r for r in self.risks if r.level == RiskLevel.HIGH]
            medium_risks = [r for r in self.risks if r.level == RiskLevel.MEDIUM]
            
            if critical_risks:
                lines.append("### 🔴 严重风险")
                for risk in critical_risks:
                    lines.append(f"- **{risk.risk_type.value}**: {risk.message}")
                lines.append("")
            
            if high_risks:
                lines.append("### 🟠 高风险")
                for risk in high_risks:
                    lines.append(f"- **{risk.risk_type.value}**: {risk.message}")
                lines.append("")
            
            if medium_risks:
                lines.append("### 🟡 中等风险")
                for risk in medium_risks:
                    lines.append(f"- **{risk.risk_type.value}**: {risk.message}")
                lines.append("")
        else:
            lines.append("✅ 未检测到风险。")
            lines.append("")
        
        lines.append("## 二、建议调整")
        lines.append("")
        for i, rec in enumerate(self.recommendations, 1):
            lines.append(f"{i}. {rec}")
        lines.append("")
        
        lines.append("## 三、模拟摘要")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 初始 SOC | {self.simulation_result.initial_soc_percent:.1f}% |")
        lines.append(f"| 最终 SOC | {self.simulation_result.final_soc_percent:.1f}% |")
        lines.append(f"| 最低 SOC | {self.simulation_result.min_soc_percent:.1f}% |")
        lines.append(f"| 总耗电量 | {self.simulation_result.total_consumption_wh:.0f} Wh |")
        lines.append(f"| 太阳能发电 | {self.simulation_result.total_solar_generation_wh:.0f} Wh |")
        lines.append(f"| 预计断电时间 | {f'{self.simulation_result.blackout_hour:02d}:00' if self.simulation_result.blackout_hour is not None else '无'} |")
        lines.append("")
        
        lines.append("## 四、每小时电量摘要")
        lines.append("")
        lines.append("| 时间 | SOC (%) | 电压 (V) | 负载 (W) | 太阳能 (W) | 净功率 (W) | 活跃设备 |")
        lines.append("|------|---------|----------|----------|------------|------------|----------|")
        
        for hourly in self.simulation_result.hourly_data:
            hour = hourly.get("hour", 0)
            soc = hourly.get("soc_percent", 0)
            voltage = hourly.get("battery_voltage", 0)
            load = hourly.get("total_load_w", 0)
            solar = hourly.get("solar_input_w", 0)
            net = hourly.get("net_power_w", 0)
            is_blackout = hourly.get("is_blackout", False)
            
            dc_loads = hourly.get("dc_loads", [])
            ac_loads = hourly.get("ac_loads", [])
            all_loads = dc_loads + ac_loads
            devices_str = ", ".join(all_loads) if all_loads else "无"
            
            if is_blackout:
                status_marker = "⚡"
            elif soc < self.battery.min_soc_percent + 10:
                status_marker = "🟡"
            else:
                status_marker = ""
            
            lines.append(f"| {hour:02d}:00 {status_marker} | {soc:.1f} | {voltage:.1f} | {load:.0f} | {solar:.0f} | {net:+.0f} | {devices_str[:40]}{'...' if len(devices_str) > 40 else ''} |")
        
        lines.append("")
        
        lines.append("## 五、配置详情")
        lines.append("")
        lines.append("### 电池规格")
        lines.append("")
        lines.append(f"- **名称**: {self.battery.name}")
        lines.append(f"- **容量**: {self.battery.capacity_ah} Ah ({self.battery.capacity_wh:.0f} Wh)")
        lines.append(f"- **可用容量**: {self.battery.usable_capacity_wh:.0f} Wh ({self.battery.min_soc_percent}% - {self.battery.max_soc_percent}% SOC)")
        lines.append(f"- **电压**: {self.battery.voltage} V")
        lines.append(f"- **化学类型**: {self.battery.chemistry.value}")
        lines.append(f"- **逆变器**: {self.battery.inverter_max_power_w} W 最大, {self.battery.inverter_efficiency_percent}% 效率")
        lines.append("")
        
        lines.append("### 负载配置")
        lines.append("")
        lines.append("| 设备 | 类型 | 功率 (W) | 优先级 | 时间 | 占空比 |")
        lines.append("|------|------|----------|--------|------|--------|")
        for load in self.loads:
            time_str = f"{load.start_time.hour:02d}:{load.start_time.minute:02d} - {load.end_time.hour:02d}:{load.end_time.minute:02d}"
            lines.append(f"| {load.name} | {load.device_type.value.upper()} | {load.actual_power_w:.0f} | {load.priority.value} | {time_str} | {load.duty_cycle_percent}% |")
        lines.append("")
        
        if self.solar_panels:
            lines.append("### 太阳能配置")
            lines.append("")
            lines.append("| 设备 | 功率 (W) | 效率 | 发电时间 |")
            lines.append("|------|----------|------|----------|")
            for panel in self.solar_panels:
                time_str = f"{panel.start_time.hour:02d}:{panel.start_time.minute:02d} - {panel.end_time.hour:02d}:{panel.end_time.minute:02d}"
                lines.append(f"| {panel.name} | {panel.max_power_w:.0f} | {panel.efficiency_percent}% | {time_str} |")
            lines.append("")
        
        return "\n".join(lines)
    
    def to_html(self) -> str:
        """导出 HTML 格式报告"""
        md_content = self.to_markdown()
        html_body = self._markdown_to_html(md_content)
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>户外电源模拟报告: {self.plan.name}</title>
    <style>
        * {{
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }}
        .container {{
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            padding: 40px;
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }}
        h2 {{
            color: #34495e;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 8px;
            margin: 30px 0 15px;
        }}
        h3 {{
            color: #555;
            margin: 20px 0 10px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }}
        th {{
            background-color: #3498db;
            color: white;
        }}
        tr:nth-child(even) {{
            background-color: #f9f9f9;
        }}
        tr:hover {{
            background-color: #f1f1f1;
        }}
        ul, ol {{
            margin: 10px 0 10px 30px;
        }}
        li {{
            margin: 8px 0;
        }}
        .risk-critical {{
            color: #e74c3c;
            font-weight: bold;
        }}
        .risk-high {{
            color: #e67e22;
            font-weight: bold;
        }}
        .risk-medium {{
            color: #f39c12;
        }}
        .blackout {{
            background-color: #ffeeee !important;
        }}
        .low-soc {{
            background-color: #fff5e6 !important;
        }}
        .meta-info {{
            background-color: #f8f9fa;
            border-left: 4px solid #3498db;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
        }}
        .meta-info p {{
            margin: 5px 0;
        }}
        .recommendations {{
            background-color: #e8f6f3;
            border-left: 4px solid #1abc9c;
            padding: 15px 20px;
            border-radius: 0 4px 4px 0;
            margin: 15px 0;
        }}
        .recommendations ol {{
            margin: 10px 0 10px 25px;
        }}
    </style>
</head>
<body>
    <div class="container">
        {html_body}
    </div>
</body>
</html>"""
        return html
    
    def _markdown_to_html(self, md: str) -> str:
        """简单的 Markdown 转 HTML 转换"""
        lines = md.split('\n')
        result = []
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            if line.startswith('# '):
                result.append(f"<h1>{line[2:]}</h1>")
            elif line.startswith('## '):
                result.append(f"<h2>{line[3:]}</h2>")
            elif line.startswith('### '):
                content = line[4:]
                if '🔴' in content:
                    result.append(f"<h3 class=\"risk-critical\">{content}</h3>")
                elif '🟠' in content:
                    result.append(f"<h3 class=\"risk-high\">{content}</h3>")
                elif '🟡' in content:
                    result.append(f"<h3 class=\"risk-medium\">{content}</h3>")
                else:
                    result.append(f"<h3>{content}</h3>")
            elif line.startswith('|') and i + 1 < len(lines) and lines[i + 1].startswith('|---'):
                table_lines = []
                while i < len(lines) and (lines[i].startswith('|') or lines[i].startswith('|---')):
                    table_lines.append(lines[i])
                    i += 1
                i -= 1
                result.append(self._table_to_html(table_lines))
            elif line.startswith('- **'):
                list_item = line
                result.append(f"<ul><li>{list_item[2:]}</li></ul>")
            elif line.startswith('- '):
                list_item = line
                result.append(f"<ul><li>{list_item[2:]}</li></ul>")
            elif line.strip().startswith('**生成时间**:') or line.strip().startswith('**模拟时长**:'):
                if i == 0 or not lines[i-1].startswith('**'):
                    result.append('<div class="meta-info">')
                result.append(f"<p>{line}</p>")
                if i + 1 >= len(lines) or not lines[i + 1].strip().startswith('**'):
                    result.append('</div>')
            elif line.strip() == '':
                pass
            else:
                result.append(f"<p>{line}</p>")
            
            i += 1
        
        return '\n'.join(result)
    
    def _table_to_html(self, table_lines: List[str]) -> str:
        """表格行转 HTML"""
        if len(table_lines) < 2:
            return ""
        
        result = ['<table>']
        
        header_row = table_lines[0]
        headers = [h.strip() for h in header_row.strip('|').split('|')]
        result.append('<thead><tr>')
        for h in headers:
            result.append(f'<th>{h}</th>')
        result.append('</tr></thead>')
        
        result.append('<tbody>')
        for row in table_lines[2:]:
            if not row.startswith('|'):
                continue
            cells = [c.strip() for c in row.strip('|').split('|')]
            
            row_class = ""
            if len(cells) > 1 and ('⚡' in cells[0] or '已断电' in str(cells)):
                row_class = ' class="blackout"'
            elif len(cells) > 1 and '🟡' in cells[0]:
                row_class = ' class="low-soc"'
            
            result.append(f'<tr{row_class}>')
            for cell in cells:
                result.append(f'<td>{cell}</td>')
            result.append('</tr>')
        result.append('</tbody>')
        
        result.append('</table>')
        return '\n'.join(result)
    
    def export(self, output_path: Path, format: str = "markdown") -> None:
        """导出报告到文件"""
        format = format.lower()
        
        if format == "json":
            content = self.to_json()
            if not output_path.suffix:
                output_path = output_path.with_suffix(".json")
        elif format == "html":
            content = self.to_html()
            if not output_path.suffix:
                output_path = output_path.with_suffix(".html")
        else:
            content = self.to_markdown()
            if not output_path.suffix:
                output_path = output_path.with_suffix(".md")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
