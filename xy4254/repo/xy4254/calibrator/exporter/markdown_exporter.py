"""
Markdown导出器 - 导出分析结果为Markdown格式报告
"""

from datetime import datetime
from typing import Dict, List, Any, Optional


class MarkdownExporter:
    """
    Markdown格式报告导出器
    
    生成结构化的Markdown报告，包含摘要、风险评估、行动计划等
    """
    
    def __init__(self):
        self.generated_at = datetime.now()
    
    def export(self, output_path: str,
               analysis_result: Dict,
               risk_results: Dict,
               action_plans: Dict,
               consolidated_actions: Optional[Dict] = None) -> str:
        """
        导出完整报告
        
        Args:
            output_path: 输出文件路径
            analysis_result: 分析结果
            risk_results: 风险评估结果
            action_plans: 行动计划
            consolidated_actions: 整合的操作汇总
            
        Returns:
            生成的Markdown内容
        """
        markdown_parts = []
        
        markdown_parts.append(self._generate_header())
        
        markdown_parts.append(self._generate_summary(analysis_result, risk_results))
        
        if consolidated_actions:
            markdown_parts.append(self._generate_action_summary(consolidated_actions))
        
        markdown_parts.append(self._generate_risk_overview(risk_results))
        
        markdown_parts.append(self._generate_tray_details(risk_results, action_plans))
        
        markdown_parts.append(self._generate_footer())
        
        full_content = '\n\n'.join(markdown_parts)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(full_content)
        
        return full_content
    
    def _generate_header(self) -> str:
        """生成报告头部"""
        timestamp = self.generated_at.strftime('%Y-%m-%d %H:%M:%S')
        
        return f"""# 苗盘补光灌溉校准报告

**生成时间**: {timestamp}

---
"""
    
    def _generate_summary(self, analysis_result: Dict, risk_results: Dict) -> str:
        """生成摘要部分"""
        total_trays = len(risk_results)
        
        risk_counts = {
            'critical': 0,
            'high': 0,
            'medium': 0,
            'normal': 0
        }
        
        for tray_id, result in risk_results.items():
            risk_level = result.overall_risk if hasattr(result, 'overall_risk') else 'normal'
            if risk_level in risk_counts:
                risk_counts[risk_level] += 1
        
        sensor_summary = analysis_result.get('sensor_summary', {})
        tray_summary = analysis_result.get('tray_summary', {})
        
        return f"""## 摘要

### 总体概览

| 指标 | 数值 |
|------|------|
| 总苗盘数 | {total_trays} |
| 严重风险 | {risk_counts['critical']} 盘 |
| 高风险 | {risk_counts['high']} 盘 |
| 中等风险 | {risk_counts['medium']} 盘 |
| 正常状态 | {risk_counts['normal']} 盘 |

### 传感器数据摘要

- **总记录数**: {sensor_summary.get('total_records', 'N/A')} 条
- **覆盖日期**: {sensor_summary.get('date_range', {}).get('start', 'N/A')} 至 {sensor_summary.get('date_range', {}).get('end', 'N/A')}

### 苗盘品种分布

"""
    
    def _generate_action_summary(self, consolidated: Dict) -> str:
        """生成操作汇总"""
        summary = consolidated.get('summary', {})
        urgent_actions = consolidated.get('urgent_actions', [])
        light_actions = consolidated.get('light_actions', [])
        irrigation_actions = consolidated.get('irrigation_actions', [])
        
        content = """## 今日操作汇总

### 操作统计

| 类型 | 数量 |
|------|------|
| 紧急操作 | {urgent_count} 项 |
| 需要补光 | {needs_light} 盘 |
| 需要浇水 | {needs_water} 盘 |
| 预计成本 | ¥{total_cost:.2f} |

""".format(
            urgent_count=summary.get('urgent_count', 0),
            needs_light=summary.get('needs_light', 0),
            needs_water=summary.get('needs_water', 0),
            total_cost=summary.get('total_estimated_cost', 0)
        )
        
        if urgent_actions:
            content += """### ⚠️ 紧急操作

"""
            for action in urgent_actions:
                tray_id = action.get('tray_id', '未知')
                action_detail = action.get('action', {})
                urgency = action_detail.get('urgency', '')
                content += f"- **{tray_id}**: {action_detail.get('action', '')} ({urgency})\n"
        
        if light_actions:
            content += """\n### 💡 补光建议

"""
            for action in light_actions:
                tray_id = action.get('tray_id', '未知')
                details = action.get('action', {}).get('details', {})
                content += f"- **{tray_id}**\n"
                content += f"  - 当前DLI: {details.get('current_dli', 'N/A')} mol/m²/day\n"
                content += f"  - 目标DLI: {details.get('target_dli', 'N/A')} mol/m²/day\n"
                content += f"  - 建议补光: {details.get('recommended_hours', 'N/A')} 小时\n"
                content += f"  - 预计能耗: {details.get('estimated_energy_kwh', 'N/A')} kWh\n"
        
        if irrigation_actions:
            content += """\n### 💧 灌溉建议

"""
            for action in irrigation_actions:
                tray_id = action.get('tray_id', '未知')
                details = action.get('action', {}).get('details', {})
                action_type = action.get('action', {}).get('type', '')
                
                if action_type == 'irrigation':
                    content += f"- **{tray_id}** (需要浇水)\n"
                    content += f"  - 当前湿度: {details.get('current_moisture', 'N/A')}%\n"
                    content += f"  - 目标湿度: {details.get('target_moisture', 'N/A')}%\n"
                    content += f"  - 建议水量: {details.get('recommended_amount_liters', 'N/A')} 升\n"
                    content += f"  - 今日蒸散: {details.get('daily_et0_mm', 'N/A')} mm\n"
                else:
                    content += f"- **{tray_id}** (减少浇水)\n"
                    content += f"  - 当前湿度: {details.get('current_moisture', 'N/A')}%\n"
        
        return content
    
    def _generate_risk_overview(self, risk_results: Dict) -> str:
        """生成风险概览"""
        content = """## 风险评估概览

### 各苗盘风险状态

| 苗盘ID | 总体风险 | 光照风险 | 水分风险 | 综合评分 |
|--------|----------|----------|----------|----------|
"""
        
        for tray_id, result in risk_results.items():
            overall = result.overall_risk if hasattr(result, 'overall_risk') else 'normal'
            light_risk = result.light_risk if hasattr(result, 'light_risk') else {}
            moisture_risk = result.moisture_risk if hasattr(result, 'moisture_risk') else {}
            score = result.overall_score if hasattr(result, 'overall_score') else 5
            
            light_status = light_risk.get('status', '正常')
            moisture_status = moisture_risk.get('status', '正常')
            
            overall_emoji = self._risk_emoji(overall)
            overall_display = f"{overall_emoji} {self._risk_display(overall)}"
            
            content += f"| {tray_id} | {overall_display} | {light_status} | {moisture_status} | {score}/5 |\n"
        
        return content
    
    def _generate_tray_details(self, risk_results: Dict, action_plans: Dict) -> str:
        """生成各苗盘详细信息"""
        content = """## 各苗盘详情

"""
        
        for tray_id, result in risk_results.items():
            plan = action_plans.get(tray_id)
            
            content += f"### {tray_id}\n\n"
            
            overall = result.overall_risk if hasattr(result, 'overall_risk') else 'normal'
            content += f"**总体状态**: {self._risk_emoji(overall)} {self._risk_display(overall)}\n\n"
            
            light_risk = result.light_risk if hasattr(result, 'light_risk') else {}
            light_details = light_risk.get('details', {})
            content += "**光照情况**\n"
            content += f"- 状态: {light_risk.get('status', '正常')}\n"
            content += f"- 最新DLI: {light_details.get('latest_dli', 'N/A')} mol/m²/day\n"
            content += f"- 目标DLI: {light_details.get('dli_requirements', {}).get('optimal_min', 'N/A')} mol/m²/day\n\n"
            
            moisture_risk = result.moisture_risk if hasattr(result, 'moisture_risk') else {}
            moisture_details = moisture_risk.get('details', {})
            content += "**水分情况**\n"
            content += f"- 状态: {moisture_risk.get('status', '正常')}\n"
            content += f"- 当前湿度: {moisture_details.get('current_moisture', 'N/A')}%\n"
            content += f"- 变化趋势: {moisture_details.get('trend', '稳定')}\n"
            content += f"- 今日蒸散: {moisture_details.get('et0', 'N/A')} mm\n\n"
            
            warnings = result.warnings if hasattr(result, 'warnings') else []
            if warnings:
                content += "**警告**\n"
                for warning in warnings:
                    content += f"- ⚠️ {warning}\n"
                content += "\n"
            
            recommendations = result.recommendations if hasattr(result, 'recommendations') else []
            if recommendations:
                content += "**建议**\n"
                for rec in recommendations:
                    content += f"- {rec}\n"
                content += "\n"
            
            if plan:
                priority = plan.priority if hasattr(plan, 'priority') else 'P3 - 正常'
                content += f"**优先级**: {priority}\n\n"
                
                all_actions = []
                if hasattr(plan, 'light_actions'):
                    all_actions.extend([('补光', a) for a in plan.light_actions])
                if hasattr(plan, 'irrigation_actions'):
                    all_actions.extend([('灌溉', a) for a in plan.irrigation_actions])
                if hasattr(plan, 'monitoring_actions'):
                    all_actions.extend([('监测', a) for a in plan.monitoring_actions])
                
                if all_actions:
                    content += "**具体操作**\n"
                    for action_type, action in all_actions:
                        urgency = action.get('urgency', '')
                        content += f"- [{action_type}] {action.get('action', '')} ({urgency})\n"
                    content += "\n"
            
            content += "---\n\n"
        
        return content
    
    def _generate_footer(self) -> str:
        """生成报告页脚"""
        return """---

## 使用说明

1. **紧急操作**: 请优先处理标有"立即执行"和"紧急"的操作
2. **补光建议**: 建议在早晨或傍晚进行补光，避免正午强光
3. **灌溉建议**: 早晨浇水最佳，避免傍晚浇水导致病害
4. **监测频率**: 根据风险等级调整监测频率，高风险苗盘增加检查次数

---

*本报告由苗盘补光灌溉校准器自动生成*
"""
    
    def _risk_emoji(self, risk_level: str) -> str:
        """根据风险等级返回emoji"""
        emojis = {
            'critical': '🔴',
            'high': '🟠',
            'medium': '🟡',
            'normal': '🟢',
            'low': '🟢'
        }
        return emojis.get(risk_level, '⚪')
    
    def _risk_display(self, risk_level: str) -> str:
        """返回风险等级的中文显示"""
        displays = {
            'critical': '严重风险',
            'high': '高风险',
            'medium': '中等风险',
            'normal': '正常',
            'low': '正常'
        }
        return displays.get(risk_level, '未知')
    
    def export_simple_summary(self, output_path: str, 
                               risk_results: Dict,
                               action_plans: Dict) -> str:
        """
        导出简化版摘要
        """
        content = """# 苗盘状态摘要

生成时间: {timestamp}

## 风险汇总

""".format(timestamp=self.generated_at.strftime('%Y-%m-%d %H:%M'))
        
        critical = []
        high = []
        normal = []
        
        for tray_id, result in risk_results.items():
            risk = result.overall_risk if hasattr(result, 'overall_risk') else 'normal'
            if risk == 'critical':
                critical.append(tray_id)
            elif risk == 'high':
                high.append(tray_id)
            else:
                normal.append(tray_id)
        
        if critical:
            content += f"### 🔴 严重风险 ({len(critical)} 盘)\n"
            content += ", ".join(critical) + "\n\n"
        
        if high:
            content += f"### 🟠 高风险 ({len(high)} 盘)\n"
            content += ", ".join(high) + "\n\n"
        
        content += f"### 🟢 正常 ({len(normal)} 盘)\n"
        content += ", ".join(normal) + "\n"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return content
