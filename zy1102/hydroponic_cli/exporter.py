"""报告导出模块 - 导出 Markdown、HTML、JSON 格式的报告"""
import json
from typing import Dict, List, Optional, Any
from datetime import date, datetime
from pathlib import Path

from .models import (
    SimulationResult, SimulationSummary, StrategyComparison,
    ValidationResult, ValidationError, ValidationWarning,
    DataBundle, DailyAction
)
from .simulator import SimulationStrategy


class ReportExporter:
    """报告导出器"""
    
    def __init__(self, data_bundle: Optional[DataBundle] = None):
        self.data = data_bundle
    
    def export_json(
        self,
        data: Any,
        filepath: str,
        indent: int = 2
    ) -> str:
        """导出为 JSON 格式"""
        output = self._convert_to_json_serializable(data)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=indent, default=str)
        
        return filepath
    
    def export_markdown(
        self,
        simulation_result: Optional[SimulationResult] = None,
        strategy_comparisons: Optional[Dict[str, StrategyComparison]] = None,
        validation_result: Optional[ValidationResult] = None,
        comparison_summary: Optional[Dict] = None,
        title: str = "水培营养液调配报告"
    ) -> str:
        """生成 Markdown 格式报告"""
        lines = [
            f"# {title}",
            "",
            f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
        ]
        
        if validation_result:
            lines.extend(self._generate_validation_section(validation_result))
        
        if simulation_result:
            lines.extend(self._generate_simulation_section(simulation_result))
        
        if strategy_comparisons:
            lines.extend(self._generate_comparison_section(strategy_comparisons, comparison_summary))
        
        lines.extend(self._generate_footer())
        
        return "\n".join(lines)
    
    def export_html(
        self,
        simulation_result: Optional[SimulationResult] = None,
        strategy_comparisons: Optional[Dict[str, StrategyComparison]] = None,
        validation_result: Optional[ValidationResult] = None,
        comparison_summary: Optional[Dict] = None,
        title: str = "水培营养液调配报告"
    ) -> str:
        """生成 HTML 格式报告"""
        markdown_content = self.export_markdown(
            simulation_result=simulation_result,
            strategy_comparisons=strategy_comparisons,
            validation_result=validation_result,
            comparison_summary=comparison_summary,
            title=title
        )
        
        html_content = self._markdown_to_html(markdown_content, title)
        return html_content
    
    def _convert_to_json_serializable(self, data: Any) -> Any:
        """转换为 JSON 可序列化格式"""
        if hasattr(data, '__dict__'):
            result = {}
            for key, value in data.__dict__.items():
                if key.startswith('_'):
                    continue
                result[key] = self._convert_to_json_serializable(value)
            return result
        elif isinstance(data, dict):
            return {k: self._convert_to_json_serializable(v) for k, v in data.items()}
        elif isinstance(data, list):
            return [self._convert_to_json_serializable(item) for item in data]
        elif isinstance(data, (date, datetime)):
            return data.isoformat()
        else:
            return data
    
    def _generate_validation_section(self, result: ValidationResult) -> List[str]:
        """生成校验结果部分"""
        lines = [
            "## 数据校验结果",
            "",
        ]
        
        if result.valid:
            lines.append("✅ **校验通过**: 所有数据格式正确")
        else:
            lines.append(f"❌ **校验失败**: 发现 {len(result.errors)} 个错误")
        
        lines.append("")
        
        if result.errors:
            lines.append("### 错误详情")
            lines.append("")
            lines.append("| 字段 | 值 | 错误信息 | 来源 |")
            lines.append("|------|-----|----------|------|")
            for error in result.errors:
                source = error.source_file or ""
                if error.row_index:
                    source = f"{source} (第 {error.row_index} 行)"
                lines.append(f"| {error.field} | `{error.value}` | {error.message} | {source} |")
            lines.append("")
        
        if result.warnings:
            lines.append("### 警告详情")
            lines.append("")
            lines.append("| 字段 | 值 | 警告信息 | 来源 |")
            lines.append("|------|-----|----------|------|")
            for warning in result.warnings:
                source = warning.source_file or ""
                if warning.row_index:
                    source = f"{source} (第 {warning.row_index} 行)"
                lines.append(f"| {warning.field} | `{warning.value}` | {warning.message} | {source} |")
            lines.append("")
        
        if result.info:
            lines.append("### 其他信息")
            lines.append("")
            for info in result.info:
                lines.append(f"- {info}")
            lines.append("")
        
        return lines
    
    def _generate_simulation_section(self, result: SimulationResult) -> List[str]:
        """生成模拟结果部分"""
        lines = [
            "## 模拟结果",
            "",
            f"**储液桶 ID**: `{result.reservoir_id}`",
            f"**模拟周期**: {result.start_date} 至 {result.end_date} ({result.total_days} 天)",
            "",
        ]
        
        if result.errors:
            lines.append("### ⚠️ 模拟错误")
            lines.append("")
            for error in result.errors:
                lines.append(f"- {error}")
            lines.append("")
        
        if result.warnings:
            lines.append("### ⚠️ 模拟警告")
            lines.append("")
            for warning in result.warnings:
                lines.append(f"- {warning}")
            lines.append("")
        
        lines.extend(self._generate_summary_table(result.summary))
        lines.extend(self._generate_daily_actions_table(result.daily_actions))
        
        return lines
    
    def _generate_summary_table(self, summary: SimulationSummary) -> List[str]:
        """生成摘要表格"""
        lines = [
            "### 资源消耗摘要",
            "",
            "| 项目 | 数量 | 单位 |",
            "|------|------|------|",
            f"| 补水总量 | {summary.total_water_added_liters:.2f} | L |",
            f"| A 液总量 | {summary.total_a_added_ml:.1f} | mL |",
            f"| B 液总量 | {summary.total_b_added_ml:.1f} | mL |",
            f"| 酸液总量 | {summary.total_acid_added_ml:.1f} | mL |",
            f"| 碱液总量 | {summary.total_base_added_ml:.1f} | mL |",
            f"| 排液总量 | {summary.total_drained_liters:.2f} | L |",
            "",
            "### 操作统计",
            "",
            "| 指标 | 值 |",
            "|------|-----|",
            f"| 需要换液次数 | {summary.full_changes_required} |",
            f"| EC 超出范围天数 | {summary.ec_out_of_range_days} |",
            f"| pH 超出范围天数 | {summary.ph_out_of_range_days} |",
            f"| 平均 EC | {summary.average_ec:.3f} mS/cm |",
            f"| 平均 pH | {summary.average_ph:.2f} |",
            f"| 最终 EC | {summary.end_ec:.3f} mS/cm |",
            f"| 最终 pH | {summary.end_ph:.2f} |",
            f"| 最终体积 | {summary.end_volume:.2f} L |",
            "",
        ]
        return lines
    
    def _generate_daily_actions_table(self, actions: List[DailyAction]) -> List[str]:
        """生成每日操作表格"""
        lines = [
            "### 每日操作详情",
            "",
            "| 日期 | 操作 | 补水(L) | A液(mL) | B液(mL) | 酸(mL) | 碱(mL) | 排液(L) | 预计 EC | 预计 pH |",
            "|------|------|---------|---------|---------|--------|--------|---------|---------|---------|",
        ]
        
        for action in actions:
            actions_str = "、".join(action.actions) if action.actions else "-"
            ec_str = f"{action.expected_ec:.3f}" if action.expected_ec else "-"
            ph_str = f"{action.expected_ph:.2f}" if action.expected_ph else "-"
            
            lines.append(
                f"| {action.date} | {actions_str[:30]}... | "
                f"{action.add_water_liters:.2f} | {action.add_a_ml:.1f} | {action.add_b_ml:.1f} | "
                f"{action.add_acid_ml:.1f} | {action.add_base_ml:.1f} | {action.drain_liters:.2f} | "
                f"{ec_str} | {ph_str} |"
            )
        
        lines.append("")
        
        lines.append("### 每日操作备注")
        lines.append("")
        for action in actions:
            if action.notes or action.warnings:
                lines.append(f"**{action.date} (第 {action.day} 天)**")
                lines.append("")
                if action.notes:
                    lines.append("📝 **说明**:")
                    for note in action.notes:
                        lines.append(f"- {note}")
                if action.warnings:
                    lines.append("⚠️ **警告**:")
                    for warning in action.warnings:
                        lines.append(f"- {warning}")
                lines.append("")
        
        return lines
    
    def _generate_comparison_section(
        self,
        comparisons: Dict[str, StrategyComparison],
        summary: Optional[Dict]
    ) -> List[str]:
        """生成策略比较部分"""
        lines = [
            "## 策略比较",
            "",
        ]
        
        stable = comparisons.get(SimulationStrategy.STABLE_EC)
        save = comparisons.get(SimulationStrategy.SAVE_NUTRIENT)
        
        if stable and save:
            lines.append("### 对比概览")
            lines.append("")
            lines.append("| 指标 | 稳 EC 策略 | 省营养液策略 |")
            lines.append("|------|-----------|-------------|")
            lines.append(f"| 补水总量 | {stable.total_water_liters:.2f} L | {save.total_water_liters:.2f} L |")
            lines.append(f"| 营养液总量 | {stable.total_nutrient_ml:.1f} mL | {save.total_nutrient_ml:.1f} mL |")
            lines.append(f"| 酸/碱总量 | {stable.total_acid_base_ml:.1f} mL | {save.total_acid_base_ml:.1f} mL |")
            lines.append(f"| 换液次数 | {stable.full_changes} | {save.full_changes} |")
            lines.append(f"| **估算成本** | **¥{stable.estimated_cost:.2f}** | **¥{save.estimated_cost:.2f}** |")
            lines.append(f"| **风险评分** | **{stable.risk_score:.1f}/10** | **{save.risk_score:.1f}/10** |")
            lines.append("")
        
        for strategy_id, comparison in comparisons.items():
            lines.append(f"### {comparison.strategy_name}")
            lines.append("")
            lines.append(f"{comparison.description}")
            lines.append("")
            
            lines.append("✅ **优势**:")
            for benefit in comparison.key_benefits:
                lines.append(f"- {benefit}")
            lines.append("")
            
            lines.append("⚠️ **风险**:")
            for risk in comparison.key_risks:
                lines.append(f"- {risk}")
            lines.append("")
        
        if summary and summary.get("recommendation"):
            lines.append("### 💡 建议")
            lines.append("")
            lines.append(summary["recommendation"])
            lines.append("")
        
        return lines
    
    def _generate_footer(self) -> List[str]:
        """生成页脚"""
        lines = [
            "---",
            "",
            "## 注意事项",
            "",
            "1. **pH 调整**: 报告中的酸/碱用量仅为估算值，实际操作中应少量多次添加并测试",
            "2. **EC 单位**: 本报告统一使用 mS/cm，如需转换请参考：1 mS/cm = 1000 μS/cm = 500 ppm",
            "3. **库存检查**: 执行操作前请确认营养液库存充足",
            "4. **混配禁忌**: 不同配方的营养液请勿随意混合",
            "5. **定期检测**: 建议每天检测 EC 和 pH，确保在目标范围内",
            "",
            "---",
            "",
            f"*报告由 hydroponic-cli 生成于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*",
        ]
        return lines
    
    def _markdown_to_html(self, markdown: str, title: str) -> str:
        """简单的 Markdown 转 HTML（仅用于报告展示）"""
        html_parts = [
            f"<!DOCTYPE html>",
            f"<html lang=\"zh-CN\">",
            f"<head>",
            f"    <meta charset=\"UTF-8\">",
            f"    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
            f"    <title>{title}</title>",
            f"    <style>",
            f"        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }}",
            f"        .container {{ max-width: 900px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}",
            f"        h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }}",
            f"        h2 {{ color: #34495e; margin-top: 30px; border-bottom: 2px solid #ecf0f1; padding-bottom: 8px; }}",
            f"        h3 {{ color: #555; margin-top: 25px; }}",
            f"        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}",
            f"        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}",
            f"        th {{ background-color: #f8f9fa; font-weight: 600; }}",
            f"        tr:hover {{ background-color: #f5f5f5; }}",
            f"        code {{ background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', monospace; }}",
            f"        pre {{ background: #282c34; color: #abb2bf; padding: 15px; border-radius: 6px; overflow-x: auto; }}",
            f"        .warning {{ color: #e67e22; }}",
            f"        .success {{ color: #27ae60; }}",
            f"        .error {{ color: #e74c3c; }}",
            f"        hr {{ border: none; border-top: 1px solid #eee; margin: 30px 0; }}",
            f"        ul, ol {{ line-height: 1.8; }}",
            f"    </style>",
            f"</head>",
            f"<body>",
            f"    <div class=\"container\">",
        ]
        
        lines = markdown.split('\n')
        
        for line in lines:
            if line.startswith('# '):
                html_parts.append(f"        <h1>{line[2:]}</h1>")
            elif line.startswith('## '):
                html_parts.append(f"        <h2>{line[3:]}</h2>")
            elif line.startswith('### '):
                html_parts.append(f"        <h3>{line[4:]}</h3>")
            elif line.startswith('#### '):
                html_parts.append(f"        <h4>{line[5:]}</h4>")
            elif line.startswith('|'):
                if not hasattr(self, '_in_table'):
                    self._in_table = True
                    html_parts.append("        <table>")
                if '---' in line:
                    pass
                else:
                    cells = [c.strip() for c in line.strip('|').split('|')]
                    if html_parts[-1].endswith('<table>'):
                        html_parts.append("        <thead><tr>")
                        for cell in cells:
                            html_parts.append(f"            <th>{self._format_inline(cell)}</th>")
                        html_parts.append("        </tr></thead><tbody>")
                    else:
                        html_parts.append("        <tr>")
                        for cell in cells:
                            html_parts.append(f"            <td>{self._format_inline(cell)}</td>")
                        html_parts.append("        </tr>")
            elif self._in_table if hasattr(self, '_in_table') else False:
                if not line.strip():
                    html_parts.append("        </tbody></table>")
                    self._in_table = False
            elif line.startswith('- '):
                if not hasattr(self, '_in_list') or not self._in_list:
                    self._in_list = True
                    html_parts.append("        <ul>")
                html_parts.append(f"            <li>{self._format_inline(line[2:])}</li>")
            elif line.startswith('---'):
                html_parts.append("        <hr>")
            elif line.strip() == '':
                if hasattr(self, '_in_list') and self._in_list:
                    html_parts.append("        </ul>")
                    self._in_list = False
            elif line.strip():
                html_parts.append(f"        <p>{self._format_inline(line)}</p>")
        
        if hasattr(self, '_in_table') and self._in_table:
            html_parts.append("        </tbody></table>")
        
        if hasattr(self, '_in_list') and self._in_list:
            html_parts.append("        </ul>")
        
        html_parts.extend([
            f"    </div>",
            f"</body>",
            f"</html>",
        ])
        
        return '\n'.join(html_parts)
    
    def _format_inline(self, text: str) -> str:
        """格式化行内元素"""
        import re
        
        text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
        text = re.sub(r'\*(.*?)\*', r'<em>\1</em>', text)
        text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
        
        if '❌' in text or '错误' in text:
            text = f'<span class="error">{text}</span>'
        elif '✅' in text or '通过' in text:
            text = f'<span class="success">{text}</span>'
        elif '⚠️' in text or '警告' in text:
            text = f'<span class="warning">{text}</span>'
        
        return text
