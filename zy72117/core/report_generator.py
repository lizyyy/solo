import os
from datetime import datetime
from typing import List, Dict, Any
from dataclasses import dataclass


@dataclass
class CalculationResult:
    time_point: float
    smoke_layer_thickness: float
    smoke_temperature: float
    smoke_velocity: float
    visibility: float
    co_concentration: float
    risk_level: str
    is_safe: bool
    warnings: List[str]


class ReportGenerator:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_ascii_chart(self, data: List[float], title: str, height: int = 10) -> str:
        if not data:
            return "无数据"

        max_val = max(data) if max(data) > 0 else 1
        min_val = min(data) if min(data) < 0 else 0
        value_range = max_val - min_val
        if value_range == 0:
            value_range = 1

        chart_lines = []
        chart_lines.append(f"\n{title}")
        chart_lines.append("-" * 60)

        for row in range(height, -1, -1):
            line = f"{row / height * 100:3.0f}% |"
            threshold_y = (10.0 - min_val) / value_range * height if 'visibility' in title else \
                         (100.0 - min_val) / value_range * height if 'CO' in title else None

            for i, value in enumerate(data):
                bar_height = (value - min_val) / value_range * height
                if bar_height >= row:
                    if threshold_y and row <= threshold_y:
                        line += "█"
                    else:
                        line += "█"
                elif threshold_y and abs(row - threshold_y) < 0.5:
                    line += "─"
                else:
                    line += " "
                if i % 5 == 4:
                    line += " "
            chart_lines.append(line)

        chart_lines.append("    |" + "-" * len(data))
        chart_lines.append(f"    最小值: {min_val:.2f}, 最大值: {max_val:.2f}, 平均值: {sum(data)/len(data):.2f}")
        chart_lines.append("")

        return "\n".join(chart_lines)

    def generate_risk_summary_chart(self, results: List[CalculationResult]) -> str:
        risk_levels = {'低风险': 0, '低风险(注意)': 1, '中风险': 2, '高风险': 3, '极高风险': 4}
        risk_colors = {'低风险': '🟢', '低风险(注意)': '🟢', '中风险': '🟡', '高风险': '🟠', '极高风险': '🔴'}

        chart = []
        chart.append("\n📊 风险变化趋势:")
        chart.append("-" * 50)

        for i, r in enumerate(results):
            time_marker = f"t={r.time_point:.0f}s" if i % 2 == 0 else " " * 6
            safe_tag = "" if r.is_safe else " [不安全]"
            chart.append(f"{time_marker} [{risk_colors.get(r.risk_level, '⚪')}] {r.risk_level}{safe_tag}")

        chart.append("-" * 50)

        risk_counts = {}
        for r in results:
            risk_counts[r.risk_level] = risk_counts.get(r.risk_level, 0) + 1

        chart.append("\n风险分布统计:")
        for level in ['低风险', '低风险(注意)', '中风险', '高风险', '极高风险']:
            count = risk_counts.get(level, 0)
            percentage = count / len(results) * 100 if results else 0
            chart.append(f"  {risk_colors.get(level, '⚪')} {level}: {count}次 ({percentage:.1f}%)")

        return "\n".join(chart)

    def generate_text_report(self, results: List[CalculationResult],
                            validation_report: str,
                            anomaly_summary: str,
                            imported_data: Any,
                            conflicts: List[Any]) -> str:
        report = []
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        report.append("=" * 70)
        report.append("               隧道通风烟气扩散分析报告")
        report.append(f"               生成时间: {timestamp}")
        report.append("=" * 70)

        report.append("\n📋 一、数据概览")
        report.append("-" * 70)
        report.append(f"  传感器记录数: {len(imported_data.sensor_records)}")
        report.append(f"  设备参数数: {len(imported_data.equipment_params)}")
        report.append(f"  现场备注数: {len(imported_data.on_site_notes)}")
        report.append(f"  计算时间点: {len(results)}个")

        report.append("\n🔍 二、数据验证结果")
        report.append("-" * 70)
        report.append(validation_report)

        report.append("\n⚠️ 三、异常检测结果")
        report.append("-" * 70)
        report.append(anomaly_summary)

        if conflicts:
            report.append("\n⚔️ 四、数据冲突分析")
            report.append("-" * 70)
            for conflict in conflicts[:5]:
                report.append(f"\n  冲突类型: {conflict.conflict_type}")
                report.append(f"  传感器数据: {conflict.sensor_data}")
                report.append(f"  微信群数据: {conflict.wechat_data['content']}")
                report.append(f"  建议动作: {', '.join(conflict.suggested_actions)}")

        report.append("\n📈 五、计算结果趋势")
        report.append("-" * 70)

        visibility_data = [r.visibility for r in results]
        co_data = [r.co_concentration for r in results]
        temp_data = [r.smoke_temperature for r in results]

        report.append(self.generate_ascii_chart(visibility_data, "可见度变化 (m)"))
        report.append(self.generate_ascii_chart(co_data, "CO浓度变化 (ppm)"))
        report.append(self.generate_ascii_chart(temp_data, "烟气温度变化 (°C)"))

        report.append(self.generate_risk_summary_chart(results))

        report.append("\n📝 六、关键时间点明细")
        report.append("-" * 70)

        report.append(f"{'时间(s)':<8} {'烟层(m)':<8} {'温度(°C)':<10} {'可见度(m)':<10} {'CO(ppm)':<10} {'风险等级':<10}")
        report.append("-" * 60)

        for r in results:
            risk_marker = "🔴" if not r.is_safe else "�" if r.risk_level == "低风险(注意)" else "�"
            report.append(f"{r.time_point:<8.0f} {r.smoke_layer_thickness:<8.2f} {r.smoke_temperature:<10.1f} "
                      f"{r.visibility:<10.1f} {r.co_concentration:<10.1f} {risk_marker}{r.risk_level}")

        report.append("\n💬 七、微信群原始备注（未清洗）")
        report.append("-" * 70)
        for i, note in enumerate(imported_data.on_site_notes[:10]):
            report.append(f"  [{i+1}] {note.content}")
        if len(imported_data.on_site_notes) > 10:
            report.append(f"  ... 还有 {len(imported_data.on_site_notes) - 10} 条备注")

        report.append("\n🎯 八、总结与建议")
        report.append("-" * 70)

        unsafe_count = sum(1 for r in results if not r.is_safe)
        medium_risk_count = sum(1 for r in results if r.risk_level == '中风险')
        high_risk_count = sum(1 for r in results if r.risk_level in ['高风险', '极高风险'])
        attention_count = sum(1 for r in results if r.risk_level == '低风险(注意)')
        total_warnings = sum(len(r.warnings) for r in results)

        if high_risk_count > 0 or medium_risk_count > 0:
            if high_risk_count > 0:
                report.append(f"  🔴 检测到 {high_risk_count} 个高/极高风险时间点（不安全）")
            if medium_risk_count > 0:
                report.append(f"  🟡 检测到 {medium_risk_count} 个中风险时间点（不安全，有关键指标超阈值）")
            report.append(f"  合计 {unsafe_count} 个不安全时间点，共产生 {total_warnings} 条告警")
            report.append("  建议:")
            report.append("    1. 立即检查通风系统运行状态")
            report.append("    2. 核查CO浓度、可见度等超阈值指标的现场实际情况")
            report.append("    3. 考虑增加通风量或调整通风策略")
            report.append("    4. 对高风险区域进行现场复核")
            report.append("    5. 评估是否需要启动应急预案")
        elif attention_count > 0:
            report.append(f"  🟢 整体安全，但有 {attention_count} 个时间点存在需关注的指标")
            report.append(f"  共产生 {total_warnings} 条注意/警告")
            report.append("  建议:")
            report.append("    1. 关注风速不足或温度偏高等轻微异常")
            report.append("    2. 确保通风设备正常运行")
        else:
            report.append("  ✅ 所有计算时间点均在安全范围内，无告警")
            report.append("  建议:")
            report.append("    1. 持续监测烟气扩散情况")
            report.append("    2. 保持通风系统良好运行状态")

        report.append("\n" + "=" * 70)
        report.append("                      报告结束")
        report.append("=" * 70)

        return "\n".join(report)

    def save_report(self, report_content: str, filename: str = None) -> str:
        if not filename:
            filename = f"tunnel_smoke_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        elif not filename.endswith('.txt'):
            filename = f"{filename}.txt"

        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(report_content)

        return filepath

    def generate_html_report(self, results: List[CalculationResult],
                           validation_report: str,
                           imported_data: Any) -> str:
        html = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>隧道通风烟气扩散分析报告</title>
    <style>
        body {{ font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #333; border-bottom: 3px solid #0078d4; padding-bottom: 10px; }}
        h2 {{ color: #0078d4; margin-top: 30px; }}
        .summary {{ display: flex; gap: 20px; flex-wrap: wrap; }}
        .summary-card {{ flex: 1; min-width: 200px; background: #f0f8ff; padding: 15px; border-radius: 8px; }}
        .summary-card h3 {{ margin: 0 0 10px 0; color: #666; }}
        .summary-card .value {{ font-size: 24px; font-weight: bold; color: #0078d4; }}
        .risk-low {{ background: #d4edda; color: #155724; }}
        .risk-medium {{ background: #fff3cd; color: #856404; }}
        .risk-high {{ background: #f8d7da; color: #721c24; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #0078d4; color: white; }}
        tr:hover {{ background: #f5f5f5; }}
        .wechat-note {{ background: #e8f5e9; padding: 10px; margin: 5px 0; border-radius: 4px; border-left: 4px solid #4caf50; }}
        .warnings {{ background: #fff3cd; padding: 15px; border-radius: 4px; margin: 10px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 隧道通风烟气扩散分析报告</h1>
        <p style="color: #666;">生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>

        <h2>📋 数据概览</h2>
        <div class="summary">
            <div class="summary-card">
                <h3>传感器记录</h3>
                <div class="value">{len(imported_data.sensor_records)}</div>
            </div>
            <div class="summary-card">
                <h3>设备参数</h3>
                <div class="value">{len(imported_data.equipment_params)}</div>
            </div>
            <div class="summary-card">
                <h3>计算时间点</h3>
                <div class="value">{len(results)}</div>
            </div>
            <div class="summary-card">
                <h3>高风险次数</h3>
                <div class="value" style="color: #dc3545;">{sum(1 for r in results if r.risk_level in ['高风险', '极高风险'])}</div>
            </div>
            <div class="summary-card">
                <h3>中风险次数(不安全)</h3>
                <div class="value" style="color: #ffc107;">{sum(1 for r in results if r.risk_level == '中风险')}</div>
            </div>
        </div>

        <h2>📊 计算结果明细</h2>
        <table>
            <tr>
                <th>时间(s)</th>
                <th>烟层厚度(m)</th>
                <th>烟气温度(°C)</th>
                <th>可见度(m)</th>
                <th>CO浓度(ppm)</th>
                <th>风险等级</th>
                <th>状态</th>
            </tr>
        """

        for r in results:
            if r.risk_level in ['高风险', '极高风险']:
                risk_class = 'risk-high'
            elif r.risk_level == '中风险':
                risk_class = 'risk-medium'
            else:
                risk_class = 'risk-low'
            status = '安全' if r.is_safe else '危险'
            html += f"""
            <tr class="{risk_class}">
                <td>{r.time_point:.0f}</td>
                <td>{r.smoke_layer_thickness:.2f}</td>
                <td>{r.smoke_temperature:.1f}</td>
                <td>{r.visibility:.1f}</td>
                <td>{r.co_concentration:.1f}</td>
                <td>{r.risk_level}</td>
                <td>{'✅' if r.is_safe else '❌'} {status}</td>
            </tr>
            """

        html += f"""
        </table>

        <h2>💬 微信群原始备注</h2>
        """

        for note in imported_data.on_site_notes[:10]:
            html += f'<div class="wechat-note"><strong>{note.author}</strong> ({note.timestamp}): {note.content}</div>'

        html += f"""

        <h2>⚠️ 数据验证</h2>
        <pre style="background: #f8f9fa; padding: 15px; border-radius: 4px; white-space: pre-wrap;">{validation_report}</pre>

    </div>
</body>
</html>
        """
        return html

    def save_html_report(self, html_content: str, filename: str = None) -> str:
        if not filename:
            filename = f"tunnel_smoke_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html"
        elif not filename.endswith('.html'):
            filename = f"{filename}.html"

        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html_content)

        return filepath
