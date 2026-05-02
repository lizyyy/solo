"""
报告导出模块

支持：
- 终端摘要
- Markdown报告
- HTML报告
- 机器可读JSON
"""
import json
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

from .models import (
    DryingResult,
    RiskAssessment,
    ComparisonResult,
)


class ReportGenerator:
    """报告生成器"""
    
    @staticmethod
    def generate_terminal_summary(
        result: DryingResult,
    ) -> str:
        """生成终端摘要"""
        lines = []
        
        lines.append("=" * 60)
        lines.append(f"🌧️ 梅雨季晾衣干燥预估器 - 场景: {result.scenario_name}")
        lines.append("=" * 60)
        lines.append("")
        
        lines.append("📊 天气概览:")
        ws = result.weather_summary
        lines.append(f"   平均温度: {ws.get('average_temp_c', 'N/A')}℃")
        lines.append(f"   平均湿度: {ws.get('average_humidity_pct', 'N/A')}%")
        lines.append(f"   平均风速: {ws.get('average_wind_kph', 'N/A')} km/h")
        lines.append("")
        
        lines.append("👕 衣物干燥时间预估:")
        lines.append("-" * 40)
        
        for item in result.raw_data.get("clothing_results", []):
            risk = next(
                (r for r in result.risk_assessments if r.clothing_name == item["name"]),
                None
            )
            risk_display = f" [{risk.risk_level}]" if risk else ""
            status = "✅" if item.get("is_fully_dry") else "⚠️"
            lines.append(
                f"   {status} {item['name']} ({item['fabric_type']}): "
                f"{item['dry_time_formatted']}{risk_display}"
            )
        lines.append("")
        
        lines.append("📈 统计摘要:")
        lines.append(f"   最快干燥: {result.quickest_item.get('name')} - {result.quickest_item.get('dry_time_formatted')}")
        lines.append(f"   最慢干燥: {result.slowest_item.get('name')} - {result.slowest_item.get('dry_time_formatted')}")
        lines.append(f"   平均干燥时间: {result.average_dry_time_hours:.1f} 小时")
        lines.append(f"   整体风险等级: {result.overall_risk_level}")
        lines.append("")
        
        high_risk = [r for r in result.risk_assessments if r.risk_level in ["高风险", "极高风险"]]
        if high_risk:
            lines.append("⚠️ 高风险衣物警告:")
            for r in high_risk:
                lines.append(f"   - {r.clothing_name}: 霉味风险{r.mold_risk_score}, 回潮风险{r.damp_risk_score}")
                for msg in r.warning_messages:
                    lines.append(f"     * {msg}")
            lines.append("")
        
        lines.append("💡 优化建议:")
        for i, rec in enumerate(result.recommendations, 1):
            lines.append(f"   {i}. {rec}")
        
        lines.append("")
        lines.append("=" * 60)
        
        return "\n".join(lines)
    
    @staticmethod
    def generate_markdown_report(
        result: DryingResult,
        output_path: Optional[str] = None,
    ) -> str:
        """生成Markdown报告"""
        lines = []
        
        lines.append(f"# 梅雨季晾衣干燥预估报告")
        lines.append("")
        lines.append(f"**场景名称**: {result.scenario_name}")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 📊 天气概览")
        lines.append("")
        ws = result.weather_summary
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 平均温度 | {ws.get('average_temp_c', 'N/A')}℃ |")
        lines.append(f"| 平均湿度 | {ws.get('average_humidity_pct', 'N/A')}% |")
        lines.append(f"| 平均风速 | {ws.get('average_wind_kph', 'N/A')} km/h |")
        lines.append("")
        
        lines.append("## 👕 衣物干燥详情")
        lines.append("")
        lines.append("| 衣物名称 | 布料类型 | 预计干燥时间 | 风险等级 | 霉味风险 | 回潮风险 |")
        lines.append("|----------|----------|--------------|----------|----------|----------|")
        
        for item in result.raw_data.get("clothing_results", []):
            risk = next(
                (r for r in result.risk_assessments if r.clothing_name == item["name"]),
                None
            )
            lines.append(
                f"| {item['name']} | {item['fabric_type']} | {item['dry_time_formatted']} | "
                f"{risk.risk_level if risk else 'N/A'} | "
                f"{risk.mold_risk_score if risk else 'N/A'} | "
                f"{risk.damp_risk_score if risk else 'N/A'} |"
            )
        lines.append("")
        
        lines.append("## 📈 统计摘要")
        lines.append("")
        lines.append(f"- **最快干燥**: {result.quickest_item.get('name')} - {result.quickest_item.get('dry_time_formatted')}")
        lines.append(f"- **最慢干燥**: {result.slowest_item.get('name')} - {result.slowest_item.get('dry_time_formatted')}")
        lines.append(f"- **平均干燥时间**: {result.average_dry_time_hours:.1f} 小时")
        lines.append(f"- **整体风险等级**: {result.overall_risk_level}")
        lines.append("")
        
        high_risk = [r for r in result.risk_assessments if r.risk_level in ["高风险", "极高风险"]]
        if high_risk:
            lines.append("## ⚠️ 高风险警告")
            lines.append("")
            for r in high_risk:
                lines.append(f"### {r.clothing_name}")
                lines.append(f"- **风险等级**: {r.risk_level}")
                lines.append(f"- **霉味风险分数**: {r.mold_risk_score}")
                lines.append(f"- **回潮风险分数**: {r.damp_risk_score}")
                if r.warning_messages:
                    lines.append("- **警告**:")
                    for msg in r.warning_messages:
                        lines.append(f"  - {msg}")
                lines.append("")
        
        lines.append("## 💡 优化建议")
        lines.append("")
        for i, rec in enumerate(result.recommendations, 1):
            lines.append(f"{i}. {rec}")
        lines.append("")
        
        lines.append("## 📋 附录：干燥曲线数据")
        lines.append("")
        lines.append("<details>")
        lines.append("<summary>点击展开查看详细干燥曲线数据</summary>")
        lines.append("")
        
        for item in result.raw_data.get("clothing_results", []):
            lines.append(f"### {item['name']}")
            lines.append("")
            lines.append("| 小时 | 时间点 | 含水量% | 干燥率 | 温度℃ | 湿度% | 风速km/h | 晴天 |")
            lines.append("|------|--------|---------|--------|-------|-------|----------|------|")
            for dp in item.get("dry_curve", [])[:24]:
                lines.append(
                    f"| {dp['hour']} | {dp['clock_hour']}:00 | {dp['moisture_pct']} | "
                    f"{dp['drying_rate']:.4f} | {dp['temperature_c']} | "
                    f"{dp['humidity_pct']} | {dp['wind_speed_kph']} | "
                    f"{'是' if dp['is_sunny'] else '否'} |"
                )
            lines.append("")
        
        lines.append("</details>")
        lines.append("")
        
        markdown_content = "\n".join(lines)
        
        if output_path:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(markdown_content)
        
        return markdown_content
    
    @staticmethod
    def generate_html_report(
        result: DryingResult,
        output_path: Optional[str] = None,
    ) -> str:
        """生成HTML报告"""
        html_template = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>梅雨季晾衣干燥预估报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 1000px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 { font-size: 2em; margin-bottom: 10px; }
        .header .meta { opacity: 0.9; }
        .content { padding: 30px; }
        .section { margin-bottom: 30px; }
        .section h2 { 
            color: #4facfe;
            border-bottom: 2px solid #4facfe;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .weather-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 20px;
        }
        .weather-card {
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            padding: 20px;
            border-radius: 12px;
            text-align: center;
        }
        .weather-card .label { 
            font-size: 0.9em; 
            color: #666;
            margin-bottom: 5px;
        }
        .weather-card .value { 
            font-size: 1.8em; 
            font-weight: bold;
            color: #333;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }
        th {
            background: #f5f7fa;
            font-weight: 600;
            color: #4facfe;
        }
        tr:hover { background: #f9f9f9; }
        .risk-low { color: #4caf50; }
        .risk-medium { color: #ff9800; }
        .risk-high { color: #f44336; }
        .risk-critical { color: #e91e63; font-weight: bold; }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }
        .stat-card {
            background: #f5f7fa;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #4facfe;
        }
        .stat-card .label { font-size: 0.85em; color: #666; }
        .stat-card .value { font-size: 1.1em; font-weight: 600; color: #333; }
        .warnings {
            background: #fff3e0;
            border-left: 4px solid #ff9800;
            padding: 15px;
            border-radius: 4px;
            margin-top: 10px;
        }
        .warnings h3 { color: #f57c00; margin-bottom: 10px; }
        .warnings ul { margin-left: 20px; }
        .recommendations {
            background: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            border-radius: 4px;
            margin-top: 10px;
        }
        .recommendations h3 { color: #1976d2; margin-bottom: 10px; }
        .recommendations ol { margin-left: 20px; }
        .recommendations li { margin-bottom: 8px; }
        .accordion {
            background: #f5f7fa;
            border-radius: 8px;
            overflow: hidden;
        }
        .accordion-item { border-bottom: 1px solid #e0e0e0; }
        .accordion-item:last-child { border-bottom: none; }
        .accordion-header {
            padding: 15px;
            cursor: pointer;
            background: #e3f2fd;
            font-weight: 600;
        }
        .accordion-header:hover { background: #bbdefb; }
        .accordion-content {
            padding: 0 15px;
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease;
        }
        .accordion-content.open { max-height: 1000px; padding: 15px; }
        .small-table { font-size: 0.85em; }
        .footer {
            text-align: center;
            padding: 20px;
            color: #999;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌧️ 梅雨季晾衣干燥预估报告</h1>
            <div class="meta">
                场景: <strong>{{scenario_name}}</strong> | 
                生成时间: <strong>{{gen_time}}</strong>
            </div>
        </div>
        
        <div class="content">
            <div class="section">
                <h2>📊 天气概览</h2>
                <div class="weather-grid">
                    {{weather_cards}}
                </div>
            </div>
            
            <div class="section">
                <h2>👕 衣物干燥详情</h2>
                <table>
                    <thead>
                        <tr>
                            <th>衣物名称</th>
                            <th>布料类型</th>
                            <th>预计干燥时间</th>
                            <th>风险等级</th>
                            <th>霉味风险</th>
                            <th>回潮风险</th>
                        </tr>
                    </thead>
                    <tbody>
                        {{clothing_rows}}
                    </tbody>
                </table>
            </div>
            
            <div class="section">
                <h2>📈 统计摘要</h2>
                <div class="stats-grid">
                    {{stat_cards}}
                </div>
            </div>
            
            {{warnings_section}}
            
            <div class="section">
                <h2>💡 优化建议</h2>
                <div class="recommendations">
                    <h3>建议措施</h3>
                    <ol>
                        {{recommendations_list}}
                    </ol>
                </div>
            </div>
            
            <div class="section">
                <h2>📋 干燥曲线详情</h2>
                <div class="accordion">
                    {{dry_curves}}
                </div>
            </div>
        </div>
        
        <div class="footer">
            梅雨季晾衣干燥预估器 v1.0.0 | 数据仅供参考，请根据实际情况调整
        </div>
    </div>
</body>
</html>"""
        
        ws = result.weather_summary
        weather_cards = ""
        weather_items = [
            ("平均温度", f"{ws.get('average_temp_c', 'N/A')}℃"),
            ("平均湿度", f"{ws.get('average_humidity_pct', 'N/A')}%"),
            ("平均风速", f"{ws.get('average_wind_kph', 'N/A')} km/h"),
            ("总时长", f"{ws.get('total_hours', 'N/A')} 小时"),
        ]
        for label, value in weather_items:
            weather_cards += f"""<div class="weather-card">
                <div class="label">{label}</div>
                <div class="value">{value}</div>
            </div>"""
        
        clothing_rows = ""
        for item in result.raw_data.get("clothing_results", []):
            risk = next(
                (r for r in result.risk_assessments if r.clothing_name == item["name"]),
                None
            )
            risk_level = risk.risk_level if risk else "N/A"
            mold_score = risk.mold_risk_score if risk else "N/A"
            damp_score = risk.damp_risk_score if risk else "N/A"
            
            risk_class = "risk-low"
            if risk_level == "中风险":
                risk_class = "risk-medium"
            elif risk_level == "高风险":
                risk_class = "risk-high"
            elif risk_level == "极高风险":
                risk_class = "risk-critical"
            
            clothing_rows += f"""<tr>
                <td><strong>{item['name']}</strong></td>
                <td>{item['fabric_type']}</td>
                <td>{item['dry_time_formatted']}</td>
                <td><span class="{risk_class}">{risk_level}</span></td>
                <td>{mold_score}</td>
                <td>{damp_score}</td>
            </tr>"""
        
        stat_items = [
            ("最快干燥", f"{result.quickest_item.get('name')} - {result.quickest_item.get('dry_time_formatted')}"),
            ("最慢干燥", f"{result.slowest_item.get('name')} - {result.slowest_item.get('dry_time_formatted')}"),
            ("平均干燥时间", f"{result.average_dry_time_hours:.1f} 小时"),
            ("整体风险等级", result.overall_risk_level),
        ]
        stat_cards = ""
        for label, value in stat_items:
            stat_cards += f"""<div class="stat-card">
                <div class="label">{label}</div>
                <div class="value">{value}</div>
            </div>"""
        
        warnings_section = ""
        high_risk = [r for r in result.risk_assessments if r.risk_level in ["高风险", "极高风险"]]
        if high_risk:
            warnings_content = ""
            for r in high_risk:
                warnings_content += f"<p><strong>{r.clothing_name}</strong>: 霉味风险{r.mold_risk_score}, 回潮风险{r.damp_risk_score}</p>"
                if r.warning_messages:
                    warnings_content += "<ul>"
                    for msg in r.warning_messages:
                        warnings_content += f"<li>{msg}</li>"
                    warnings_content += "</ul>"
            
            warnings_section = f"""<div class="section">
                <h2>⚠️ 高风险警告</h2>
                <div class="warnings">
                    <h3>需要关注的衣物</h3>
                    {warnings_content}
                </div>
            </div>"""
        
        recommendations_list = ""
        for rec in result.recommendations:
            recommendations_list += f"<li>{rec}</li>"
        
        dry_curves = ""
        for item in result.raw_data.get("clothing_results", []):
            curve_table = "<table class='small-table'><thead><tr><th>小时</th><th>时间点</th><th>含水量%</th><th>温度℃</th><th>湿度%</th><th>风速</th></tr></thead><tbody>"
            for dp in item.get("dry_curve", [])[:24]:
                curve_table += f"<tr><td>{dp['hour']}</td><td>{dp['clock_hour']}:00</td><td>{dp['moisture_pct']}</td><td>{dp['temperature_c']}</td><td>{dp['humidity_pct']}</td><td>{dp['wind_speed_kph']} km/h</td></tr>"
            curve_table += "</tbody></table>"
            
            dry_curves += f"""<div class="accordion-item">
                <div class="accordion-header" onclick="this.nextElementSibling.classList.toggle('open')">
                    {item['name']} - 预计 {item['dry_time_formatted']} 干燥
                </div>
                <div class="accordion-content">
                    {curve_table}
                </div>
            </div>"""
        
        html_content = html_template
        html_content = html_content.replace("{{scenario_name}}", result.scenario_name)
        html_content = html_content.replace("{{gen_time}}", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        html_content = html_content.replace("{{weather_cards}}", weather_cards)
        html_content = html_content.replace("{{clothing_rows}}", clothing_rows)
        html_content = html_content.replace("{{stat_cards}}", stat_cards)
        html_content = html_content.replace("{{warnings_section}}", warnings_section)
        html_content = html_content.replace("{{recommendations_list}}", recommendations_list)
        html_content = html_content.replace("{{dry_curves}}", dry_curves)
        
        if output_path:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(html_content)
        
        return html_content
    
    @staticmethod
    def generate_json_output(
        result: DryingResult,
        output_path: Optional[str] = None,
        include_curve: bool = True,
    ) -> str:
        """生成机器可读的JSON输出"""
        output = {
            "scenario_name": result.scenario_name,
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_dry_time_hours": result.total_dry_time_hours,
                "average_dry_time_hours": result.average_dry_time_hours,
                "quickest_item": {
                    "name": result.quickest_item.get("name"),
                    "dry_time_hours": result.quickest_item.get("dry_time_hours"),
                    "dry_time_formatted": result.quickest_item.get("dry_time_formatted"),
                },
                "slowest_item": {
                    "name": result.slowest_item.get("name"),
                    "dry_time_hours": result.slowest_item.get("dry_time_hours"),
                    "dry_time_formatted": result.slowest_item.get("dry_time_formatted"),
                },
                "overall_risk_level": result.overall_risk_level,
            },
            "weather_summary": result.weather_summary,
            "clothing_items": [],
            "risk_assessments": [],
            "recommendations": result.recommendations,
        }
        
        for item in result.raw_data.get("clothing_results", []):
            item_data = {
                "name": item["name"],
                "fabric_type": item["fabric_type"],
                "dry_time_hours": item["dry_time_hours"],
                "dry_time_formatted": item["dry_time_formatted"],
                "is_fully_dry": item.get("is_fully_dry", False),
                "weight_kg": item.get("weight_kg"),
                "moisture_content_pct": item.get("moisture_content_pct"),
                "drying_location": item.get("drying_location"),
                "hanger_spacing_cm": item.get("hanger_spacing_cm"),
            }
            if include_curve:
                item_data["dry_curve"] = item.get("dry_curve", [])
            output["clothing_items"].append(item_data)
        
        for risk in result.risk_assessments:
            output["risk_assessments"].append({
                "clothing_name": risk.clothing_name,
                "mold_risk_score": risk.mold_risk_score,
                "damp_risk_score": risk.damp_risk_score,
                "risk_level": risk.risk_level,
                "warning_messages": risk.warning_messages,
                "critical_hours": risk.critical_hours,
            })
        
        json_content = json.dumps(output, ensure_ascii=False, indent=2)
        
        if output_path:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                f.write(json_content)
        
        return json_content
    
    @staticmethod
    def generate_comparison_report(
        comp_result: ComparisonResult,
        result_a: DryingResult,
        result_b: DryingResult,
        output_path: Optional[str] = None,
        format: str = "markdown",
    ) -> str:
        """生成场景比较报告"""
        if format == "markdown":
            lines = []
            lines.append(f"# 晾晒方案对比报告")
            lines.append("")
            lines.append(f"**方案 A**: {comp_result.scenario_a_name}")
            lines.append(f"**方案 B**: {comp_result.scenario_b_name}")
            lines.append(f"**推荐方案**: {comp_result.winner}")
            lines.append("")
            
            lines.append("## 📊 关键对比")
            lines.append("")
            lines.append("| 指标 | 方案 A | 方案 B | 优势方 |")
            lines.append("|------|--------|--------|--------|")
            
            a_avg = result_a.average_dry_time_hours
            b_avg = result_b.average_dry_time_hours
            faster = "A" if a_avg < b_avg else "B" if b_avg < a_avg else "持平"
            lines.append(f"| 平均干燥时间 | {a_avg:.1f}小时 | {b_avg:.1f}小时 | {faster} |")
            
            a_risk = result_a.overall_risk_level
            b_risk = result_b.overall_risk_level
            safer = "A" if a_risk in ["低风险", "中风险"] and b_risk in ["高风险", "极高风险"] else "B" if b_risk in ["低风险", "中风险"] and a_risk in ["高风险", "极高风险"] else "持平"
            lines.append(f"| 整体风险等级 | {a_risk} | {b_risk} | {safer} |")
            lines.append("")
            
            lines.append("## 💡 关键差异")
            lines.append("")
            for diff in comp_result.key_differences:
                lines.append(f"- {diff}")
            lines.append("")
            
            if comp_result.time_savings_hours > 0:
                lines.append(f"## ⏰ 时间节省")
                lines.append("")
                lines.append(f"{comp_result.winner} 比另一方案快约 **{comp_result.time_savings_hours:.1f} 小时**")
                lines.append("")
            
            content = "\n".join(lines)
            
            if output_path:
                path = Path(output_path)
                path.parent.mkdir(parents=True, exist_ok=True)
                with open(path, "w", encoding="utf-8") as f:
                    f.write(content)
            
            return content
        
        return ""
