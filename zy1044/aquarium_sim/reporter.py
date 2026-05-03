"""
报告生成模块：生成 Markdown 和 HTML 格式的报告
"""
import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from .models import (
    Scenario, WaterQuality, RiskAssessment, RiskLevel,
    SimulationResult
)
from .risk_assessor import RiskAssessor


class ReportGenerator:
    """报告生成器"""

    @staticmethod
    def generate_markdown(
        result: SimulationResult,
        output_path: str,
        comparison_result: Optional[SimulationResult] = None
    ) -> str:
        """
        生成 Markdown 格式报告
        
        Args:
            result: 模拟结果
            output_path: 输出路径
            comparison_result: 对比结果（可选）
            
        Returns:
            生成的文件路径
        """
        md_content = ReportGenerator._generate_markdown_content(result, comparison_result)
        
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        return output_path

    @staticmethod
    def generate_html(
        result: SimulationResult,
        output_path: str,
        comparison_result: Optional[SimulationResult] = None
    ) -> str:
        """
        生成 HTML 格式报告
        
        Args:
            result: 模拟结果
            output_path: 输出路径
            comparison_result: 对比结果（可选）
            
        Returns:
            生成的文件路径
        """
        html_content = ReportGenerator._generate_html_content(result, comparison_result)
        
        os.makedirs(os.path.dirname(output_path) or '.', exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        return output_path

    @staticmethod
    def _generate_markdown_content(
        result: SimulationResult,
        comparison_result: Optional[SimulationResult] = None
    ) -> str:
        """生成 Markdown 内容"""
        lines = []
        
        overall = result.summary
        sim_summary = overall.get('simulation_summary', {})
        
        lines.append(f"# 鱼缸水质模拟报告 - {result.scenario.name}")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 📊 总体评估")
        lines.append(f"")
        lines.append(f"| 指标 | 值 |")
        lines.append(f"|------|-----|")
        lines.append(f"| 最高风险等级 | **{overall['max_risk_text']}** |")
        lines.append(f"| 安全天数 | {overall['safe_days']} 天 |")
        lines.append(f"| 偏高天数 | {overall['warning_days']} 天 |")
        lines.append(f"| 危险天数 | {overall['danger_days']} 天 |")
        lines.append(f"| 首次危险天数 | {overall['first_danger_day'] or '无'} |")
        lines.append("")
        
        lines.append("## 🐠 场景参数")
        lines.append("")
        lines.append(f"- **鱼缸体积**: {result.scenario.tank_volume} 升")
        lines.append(f"- **鱼只数量**: {sum(f.quantity for f in result.scenario.fish)} 条")
        lines.append(f"- **过滤等级**: {result.scenario.filtration_level.value}")
        lines.append(f"- **每日喂食量**: {result.scenario.daily_feeding_amount} 克")
        lines.append(f"- **模拟天数**: {result.scenario.simulation_days} 天")
        
        if result.scenario.water_changes:
            lines.append(f"- **换水计划**:")
            for wc in result.scenario.water_changes:
                lines.append(f"  - 第 {wc.day} 天: 换水 {wc.percentage}%")
        
        if result.scenario.add_fish:
            lines.append(f"- **加鱼计划**:")
            for af in result.scenario.add_fish:
                lines.append(f"  - 第 {af.day} 天: 加入 {af.quantity} 条 {af.size.value} 型鱼")
        
        lines.append("")
        
        lines.append("## ⚠️ 高风险因素")
        if overall['high_risk_factors']:
            for factor in overall['high_risk_factors']:
                lines.append(f"- {factor}")
        else:
            lines.append("- 无明显高风险因素")
        lines.append("")
        
        lines.append("## 💡 总体建议")
        for suggestion in overall['overall_suggestions']:
            lines.append(f"- {suggestion}")
        lines.append("")
        
        lines.append("## 📈 水质趋势摘要")
        lines.append("")
        lines.append(f"| 指标 | 初始值 | 最终值 | 最大值 | 趋势 |")
        lines.append(f"|------|--------|--------|--------|------|")
        lines.append(f"| 氨氮 (mg/L) | {sim_summary.get('initial_ammonia', 0):.4f} | {sim_summary.get('final_ammonia', 0):.4f} | {sim_summary.get('max_ammonia', 0):.4f} | {sim_summary.get('ammonia_trend', '-')} |")
        lines.append(f"| 亚硝酸盐 (mg/L) | {sim_summary.get('initial_nitrite', 0):.4f} | {sim_summary.get('final_nitrite', 0):.4f} | {sim_summary.get('max_nitrite', 0):.4f} | {sim_summary.get('nitrite_trend', '-')} |")
        lines.append(f"| 硝酸盐 (mg/L) | {sim_summary.get('initial_nitrate', 0):.2f} | {sim_summary.get('final_nitrate', 0):.2f} | {sim_summary.get('max_nitrate', 0):.2f} | {sim_summary.get('nitrate_trend', '-')} |")
        lines.append(f"| pH | {sim_summary.get('initial_ph', 0):.2f} | {sim_summary.get('final_ph', 0):.2f} | - | {'稳定' if sim_summary.get('ph_stable') else '波动'} |")
        lines.append("")
        
        lines.append("## 📅 每日详细数据")
        lines.append("")
        lines.append(f"| 天数 | 氨氮 (mg/L) | 亚硝酸盐 (mg/L) | 硝酸盐 (mg/L) | pH | 风险等级 |")
        lines.append(f"|------|-------------|-----------------|---------------|----|----------|")
        
        for quality, risk in zip(result.daily_quality, result.daily_risks):
            risk_icon = {
                RiskLevel.SAFE: "🟢",
                RiskLevel.WARNING: "🟡",
                RiskLevel.DANGER: "🟠",
                RiskLevel.CRITICAL: "🔴"
            }.get(risk.overall_risk, "⚪")
            
            lines.append(f"| {quality.day} | {quality.ammonia:.4f} | {quality.nitrite:.4f} | {quality.nitrate:.2f} | {quality.ph:.2f} | {risk_icon} {RiskAssessor._risk_to_text(risk.overall_risk)} |")
        
        lines.append("")
        
        if comparison_result:
            lines.append("---")
            lines.append("## 🔄 方案对比")
            lines.append("")
            lines.append(f"| 对比项 | 方案 A: {result.scenario.name} | 方案 B: {comparison_result.scenario.name} |")
            lines.append(f"|--------|-------------------------------|-------------------------------|")
            
            overall_b = comparison_result.summary
            lines.append(f"| 最高风险等级 | {overall['max_risk_text']} | {overall_b['max_risk_text']} |")
            lines.append(f"| 安全天数 | {overall['safe_days']} 天 | {overall_b['safe_days']} 天 |")
            lines.append(f"| 危险天数 | {overall['danger_days']} 天 | {overall_b['danger_days']} 天 |")
            
            sim_b = overall_b.get('simulation_summary', {})
            lines.append(f"| 最大氨氮 | {sim_summary.get('max_ammonia', 0):.4f} mg/L | {sim_b.get('max_ammonia', 0):.4f} mg/L |")
            lines.append(f"| 最大亚硝酸盐 | {sim_summary.get('max_nitrite', 0):.4f} mg/L | {sim_b.get('max_nitrite', 0):.4f} mg/L |")
            lines.append(f"| 最大硝酸盐 | {sim_summary.get('max_nitrate', 0):.2f} mg/L | {sim_b.get('max_nitrate', 0):.2f} mg/L |")
            lines.append("")
            
            lines.append("### 推荐方案")
            score_a = overall['safe_days'] - overall['danger_days'] * 10
            score_b = overall_b['safe_days'] - overall_b['danger_days'] * 10
            
            if score_a > score_b:
                lines.append(f"推荐 **方案 A ({result.scenario.name})**，整体风险更低。")
            elif score_b > score_a:
                lines.append(f"推荐 **方案 B ({comparison_result.scenario.name})**，整体风险更低。")
            else:
                lines.append("两个方案风险相当，可根据实际情况选择。")
            lines.append("")
        
        lines.append("---")
        lines.append("## ℹ️ 说明")
        lines.append("")
        lines.append("- **氨氮安全阈值**: 0.05 mg/L 以下")
        lines.append("- **亚硝酸盐安全阈值**: 0.02 mg/L 以下")
        lines.append("- **硝酸盐安全阈值**: 20 mg/L 以下")
        lines.append("- **pH 最佳范围**: 6.5 - 7.5")
        lines.append("")
        lines.append("> ⚠️ 本报告基于模拟模型生成，仅供参考。实际水质请以专业检测为准。")
        
        return "\n".join(lines)

    @staticmethod
    def _generate_html_content(
        result: SimulationResult,
        comparison_result: Optional[SimulationResult] = None
    ) -> str:
        """生成 HTML 内容"""
        overall = result.summary
        sim_summary = overall.get('simulation_summary', {})
        
        daily_data = []
        for quality, risk in zip(result.daily_quality, result.daily_risks):
            daily_data.append({
                'day': quality.day,
                'ammonia': quality.ammonia,
                'nitrite': quality.nitrite,
                'nitrate': quality.nitrate,
                'ph': quality.ph,
                'risk': risk.overall_risk.value
            })
        
        comparison_data = []
        if comparison_result:
            for quality in comparison_result.daily_quality:
                comparison_data.append({
                    'day': quality.day,
                    'ammonia': quality.ammonia,
                    'nitrite': quality.nitrite,
                    'nitrate': quality.nitrate
                })
        
        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>鱼缸水质模拟报告 - {result.scenario.name}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f7fa; }}
        h1, h2, h3 {{ color: #2c3e50; margin-bottom: 15px; }}
        h1 {{ font-size: 2em; border-bottom: 3px solid #3498db; padding-bottom: 10px; }}
        h2 {{ font-size: 1.5em; margin-top: 30px; border-left: 4px solid #3498db; padding-left: 10px; }}
        .card {{ background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .risk-badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 0.9em; }}
        .risk-safe {{ background: #d4edda; color: #155724; }}
        .risk-warning {{ background: #fff3cd; color: #856404; }}
        .risk-danger {{ background: #ffeaa7; color: #d35400; }}
        .risk-critical {{ background: #f8d7da; color: #721c24; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #eee; }}
        th {{ background: #f8f9fa; font-weight: 600; color: #495057; }}
        tr:hover {{ background: #f8f9fa; }}
        .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }}
        .stat-card {{ text-align: center; padding: 15px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; }}
        .stat-value {{ font-size: 2em; font-weight: bold; }}
        .stat-label {{ font-size: 0.9em; opacity: 0.9; }}
        ul {{ margin: 10px 0 10px 20px; }}
        li {{ margin: 5px 0; }}
        .chart-container {{ height: 300px; margin: 20px 0; position: relative; }}
        .chart {{ width: 100%; height: 100%; }}
        .legend {{ display: flex; gap: 20px; justify-content: center; margin-top: 10px; flex-wrap: wrap; }}
        .legend-item {{ display: flex; align-items: center; gap: 5px; }}
        .legend-color {{ width: 12px; height: 12px; border-radius: 50%; }}
        .comparison-highlight {{ background: #e8f4f8; border-left: 4px solid #3498db; padding: 10px 15px; margin: 15px 0; border-radius: 0 4px 4px 0; }}
        .footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #7f8c8d; font-size: 0.9em; }}
        .timestamp {{ color: #7f8c8d; font-size: 0.9em; }}
        .icon {{ margin-right: 5px; }}
        pre {{ background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; }}
        .warning-box {{ background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 15px 0; }}
        .danger-box {{ background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; margin: 15px 0; }}
    </style>
</head>
<body>
    <div class="card">
        <h1>🐠 鱼缸水质模拟报告</h1>
        <p><strong>{result.scenario.name}</strong></p>
        <p class="timestamp">生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
    </div>

    <div class="card">
        <h2><span class="icon">📊</span>总体评估</h2>
        <div class="grid">
            <div class="stat-card">
                <div class="stat-value"><span class="risk-badge risk-{overall['max_risk']}">{overall['max_risk_text']}</span></div>
                <div class="stat-label">最高风险等级</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{overall['safe_days']}</div>
                <div class="stat-label">安全天数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{overall['warning_days']}</div>
                <div class="stat-label">偏高天数</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{overall['danger_days']}</div>
                <div class="stat-label">危险天数</div>
            </div>
        </div>
    </div>

    <div class="card">
        <h2><span class="icon">📈</span>水质趋势</h2>
        <div class="chart-container">
            <canvas id="waterChart" class="chart"></canvas>
        </div>
        <div class="legend">
            <div class="legend-item"><span class="legend-color" style="background: #e74c3c;"></span> 氨氮 (mg/L)</div>
            <div class="legend-item"><span class="legend-color" style="background: #f39c12;"></span> 亚硝酸盐 (mg/L)</div>
            <div class="legend-item"><span class="legend-color" style="background: #3498db;"></span> 硝酸盐 (mg/L × 0.01)</div>
        </div>
    </div>

    <div class="card">
        <h2><span class="icon">🐟</span>场景参数</h2>
        <table>
            <tr><th>参数</th><th>值</th></tr>
            <tr><td>鱼缸体积</td><td>{result.scenario.tank_volume} 升</td></tr>
            <tr><td>鱼只数量</td><td>{sum(f.quantity for f in result.scenario.fish)} 条</td></tr>
            <tr><td>过滤等级</td><td>{result.scenario.filtration_level.value}</td></tr>
            <tr><td>每日喂食量</td><td>{result.scenario.daily_feeding_amount} 克</td></tr>
            <tr><td>模拟天数</td><td>{result.scenario.simulation_days} 天</td></tr>
        </table>
        {"<h3>换水计划</h3>" if result.scenario.water_changes else ""}
        {ReportGenerator._generate_html_water_changes(result.scenario.water_changes)}
        {"<h3>加鱼计划</h3>" if result.scenario.add_fish else ""}
        {ReportGenerator._generate_html_add_fish(result.scenario.add_fish)}
    </div>

    <div class="card">
        <h2><span class="icon">⚠️</span>高风险因素</h2>
        {ReportGenerator._generate_html_risk_factors(overall['high_risk_factors'])}
    </div>

    <div class="card">
        <h2><span class="icon">💡</span>总体建议</h2>
        <ul>
            {''.join(f'<li>{s}</li>' for s in overall['overall_suggestions'])}
        </ul>
    </div>

    <div class="card">
        <h2><span class="icon">📋</span>水质指标摘要</h2>
        <table>
            <tr><th>指标</th><th>初始值</th><th>最终值</th><th>最大值</th><th>趋势</th></tr>
            <tr><td>氨氮 (mg/L)</td><td>{sim_summary.get('initial_ammonia', 0):.4f}</td><td>{sim_summary.get('final_ammonia', 0):.4f}</td><td>{sim_summary.get('max_ammonia', 0):.4f}</td><td>{sim_summary.get('ammonia_trend', '-')}</td></tr>
            <tr><td>亚硝酸盐 (mg/L)</td><td>{sim_summary.get('initial_nitrite', 0):.4f}</td><td>{sim_summary.get('final_nitrite', 0):.4f}</td><td>{sim_summary.get('max_nitrite', 0):.4f}</td><td>{sim_summary.get('nitrite_trend', '-')}</td></tr>
            <tr><td>硝酸盐 (mg/L)</td><td>{sim_summary.get('initial_nitrate', 0):.2f}</td><td>{sim_summary.get('final_nitrate', 0):.2f}</td><td>{sim_summary.get('max_nitrate', 0):.2f}</td><td>{sim_summary.get('nitrate_trend', '-')}</td></tr>
            <tr><td>pH</td><td>{sim_summary.get('initial_ph', 0):.2f}</td><td>{sim_summary.get('final_ph', 0):.2f}</td><td>-</td><td>{'稳定' if sim_summary.get('ph_stable') else '波动'}</td></tr>
        </table>
    </div>

    {ReportGenerator._generate_html_comparison(result, comparison_result)}

    <div class="card">
        <h2><span class="icon">📅</span>每日详细数据</h2>
        <div style="overflow-x: auto;">
            <table>
                <tr><th>天数</th><th>氨氮 (mg/L)</th><th>亚硝酸盐 (mg/L)</th><th>硝酸盐 (mg/L)</th><th>pH</th><th>风险等级</th></tr>
                {ReportGenerator._generate_html_daily_rows(result.daily_quality, result.daily_risks)}
            </table>
        </div>
    </div>

    <div class="footer">
        <p><strong>安全阈值说明:</strong></p>
        <p>氨氮: 0.05 mg/L 以下 | 亚硝酸盐: 0.02 mg/L 以下 | 硝酸盐: 20 mg/L 以下 | pH: 6.5-7.5</p>
        <p style="margin-top: 10px;">⚠️ 本报告基于模拟模型生成，仅供参考。实际水质请以专业检测为准。</p>
    </div>

    <script>
        const dailyData = {json.dumps(daily_data)};
        const comparisonData = {json.dumps(comparison_data)};
        
        function drawChart() {{
            const canvas = document.getElementById('waterChart');
            const ctx = canvas.getContext('2d');
            
            const padding = {{ top: 30, right: 30, bottom: 50, left: 60 }};
            const chartWidth = canvas.width - padding.left - padding.right;
            const chartHeight = canvas.height - padding.top - padding.bottom;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            const maxAmmonia = Math.max(...dailyData.map(d => d.ammonia), 0.1);
            const maxNitrite = Math.max(...dailyData.map(d => d.nitrite), 0.1);
            const maxNitrate = Math.max(...dailyData.map(d => d.nitrate) || [0], 1) * 0.01;
            const maxValue = Math.max(maxAmmonia, maxNitrite, maxNitrate);
            
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 1;
            for (let i = 0; i <= 5; i++) {{
                const y = padding.top + (chartHeight / 5) * i;
                ctx.beginPath();
                ctx.moveTo(padding.left, y);
                ctx.lineTo(padding.left + chartWidth, y);
                ctx.stroke();
                
                ctx.fillStyle = '#666';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText((maxValue * (5 - i) / 5).toFixed(2), padding.left - 5, y + 4);
            }}
            
            const labelCount = Math.min(dailyData.length, 10);
            const labelStep = Math.max(1, Math.floor(dailyData.length / labelCount));
            for (let i = 0; i < dailyData.length; i += labelStep) {{
                const x = padding.left + (chartWidth / (dailyData.length - 1)) * i;
                ctx.fillStyle = '#666';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`D${{dailyData[i].day}}`, x, canvas.height - padding.bottom + 20);
            }}
            
            function plotLine(data, key, color, scale = 1) {{
                if (!data.length) return;
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                for (let i = 0; i < data.length; i++) {{
                    const x = padding.left + (chartWidth / (data.length - 1)) * i;
                    const value = data[i][key] * scale;
                    const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
                    if (i === 0) {{
                        ctx.moveTo(x, y);
                    }} else {{
                        ctx.lineTo(x, y);
                    }}
                }}
                ctx.stroke();
            }}
            
            function plotPoints(data, key, color, scale = 1) {{
                ctx.fillStyle = color;
                for (let i = 0; i < data.length; i++) {{
                    const x = padding.left + (chartWidth / (data.length - 1)) * i;
                    const value = data[i][key] * scale;
                    const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, Math.PI * 2);
                    ctx.fill();
                }}
            }}
            
            plotLine(dailyData, 'ammonia', '#e74c3c');
            plotPoints(dailyData, 'ammonia', '#e74c3c');
            
            plotLine(dailyData, 'nitrite', '#f39c12');
            plotPoints(dailyData, 'nitrite', '#f39c12');
            
            plotLine(dailyData, 'nitrate', '#3498db', 0.01);
            plotPoints(dailyData, 'nitrate', '#3498db', 0.01);
            
            if (comparisonData.length) {{
                ctx.setLineDash([5, 5]);
                plotLine(comparisonData, 'ammonia', '#c0392b');
                plotLine(comparisonData, 'nitrite', '#e67e22');
                plotLine(comparisonData, 'nitrate', '#2980b9', 0.01);
                ctx.setLineDash([]);
            }}
        }}
        
        window.onload = drawChart;
    </script>
</body>
</html>"""
        
        return html

    @staticmethod
    def _generate_html_water_changes(water_changes) -> str:
        """生成换水计划的 HTML"""
        if not water_changes:
            return ""
        
        lines = ["<ul>"]
        for wc in water_changes:
            lines.append(f"  <li>第 {wc.day} 天: 换水 {wc.percentage}%</li>")
        lines.append("</ul>")
        return "\n".join(lines)

    @staticmethod
    def _generate_html_add_fish(add_fish) -> str:
        """生成加鱼计划的 HTML"""
        if not add_fish:
            return ""
        
        lines = ["<ul>"]
        for af in add_fish:
            lines.append(f"  <li>第 {af.day} 天: 加入 {af.quantity} 条 {af.size.value} 型鱼</li>")
        lines.append("</ul>")
        return "\n".join(lines)

    @staticmethod
    def _generate_html_risk_factors(factors: list) -> str:
        """生成高风险因素的 HTML"""
        if not factors:
            return "<p>无明显高风险因素</p>"
        
        lines = ["<ul>"]
        for factor in factors:
            lines.append(f"  <li>{factor}</li>")
        lines.append("</ul>")
        return "\n".join(lines)

    @staticmethod
    def _generate_html_daily_rows(qualities, risks) -> str:
        """生成每日数据的 HTML 行"""
        lines = []
        for quality, risk in zip(qualities, risks):
            risk_class = {
                RiskLevel.SAFE: "risk-safe",
                RiskLevel.WARNING: "risk-warning",
                RiskLevel.DANGER: "risk-danger",
                RiskLevel.CRITICAL: "risk-critical"
            }.get(risk.overall_risk, "")
            
            risk_text = {
                RiskLevel.SAFE: "安全",
                RiskLevel.WARNING: "偏高",
                RiskLevel.DANGER: "危险",
                RiskLevel.CRITICAL: "极危险"
            }.get(risk.overall_risk, "未知")
            
            lines.append(
                f"<tr><td>{quality.day}</td><td>{quality.ammonia:.4f}</td><td>{quality.nitrite:.4f}</td>"
                f"<td>{quality.nitrate:.2f}</td><td>{quality.ph:.2f}</td>"
                f"<td><span class='risk-badge {risk_class}'>{risk_text}</span></td></tr>"
            )
        
        return "\n".join(lines)

    @staticmethod
    def _generate_html_comparison(result, comparison_result) -> str:
        """生成对比部分的 HTML"""
        if not comparison_result:
            return ""
        
        overall_a = result.summary
        overall_b = comparison_result.summary
        sim_a = overall_a.get('simulation_summary', {})
        sim_b = overall_b.get('simulation_summary', {})
        
        score_a = overall_a['safe_days'] - overall_a['danger_days'] * 10
        score_b = overall_b['safe_days'] - overall_b['danger_days'] * 10
        
        recommended = "方案 A" if score_a > score_b else "方案 B" if score_b > score_a else "两个方案"
        
        html = f"""
<div class="card">
    <h2><span class="icon">🔄</span>方案对比</h2>
    <table>
        <tr><th>对比项</th><th>方案 A: {result.scenario.name}</th><th>方案 B: {comparison_result.scenario.name}</th></tr>
        <tr><td>最高风险等级</td><td>{overall_a['max_risk_text']}</td><td>{overall_b['max_risk_text']}</td></tr>
        <tr><td>安全天数</td><td>{overall_a['safe_days']} 天</td><td>{overall_b['safe_days']} 天</td></tr>
        <tr><td>危险天数</td><td>{overall_a['danger_days']} 天</td><td>{overall_b['danger_days']} 天</td></tr>
        <tr><td>最大氨氮</td><td>{sim_a.get('max_ammonia', 0):.4f} mg/L</td><td>{sim_b.get('max_ammonia', 0):.4f} mg/L</td></tr>
        <tr><td>最大亚硝酸盐</td><td>{sim_a.get('max_nitrite', 0):.4f} mg/L</td><td>{sim_b.get('max_nitrite', 0):.4f} mg/L</td></tr>
        <tr><td>最大硝酸盐</td><td>{sim_a.get('max_nitrate', 0):.2f} mg/L</td><td>{sim_b.get('max_nitrate', 0):.2f} mg/L</td></tr>
    </table>
    <div class="comparison-highlight">
        <strong>推荐:</strong> {recommended} 整体风险更低。
    </div>
</div>
"""
        return html


import json
