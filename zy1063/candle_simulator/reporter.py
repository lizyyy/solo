import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from candle_simulator.models import (
    AnalysisResult, Recipe, CostResult,
    LoadRatioResult, VolatilizationResult, RiskResult, RiskItem
)
from candle_simulator.volatilization import get_note_distribution


def generate_markdown_report(
    results: List[AnalysisResult],
    output_path: Optional[str] = None
) -> str:
    """
    生成 Markdown 格式的报告
    """
    md_parts = []
    
    report_title = "香薰蜡烛配方分析报告" if len(results) == 1 else "香薰蜡烛配方对比分析报告"
    md_parts.append(f"# {report_title}")
    md_parts.append(f"")
    md_parts.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    md_parts.append(f"")
    
    if len(results) > 1:
        md_parts.append("## 配方概览对比")
        md_parts.append("")
        md_parts.append("| 配方名称 | 总批量 | 单杯容量 | 容器数量 | 单杯成本 | 香精负载 | 留香评分 | 高风险 | 中风险 |")
        md_parts.append("|----------|--------|----------|----------|----------|----------|----------|--------|--------|")
        
        for result in results:
            batch_str = f"{result.recipe.total_batch_size}{result.recipe.total_batch_unit}"
            cup_str = f"{result.recipe.target_per_cup_capacity}{result.recipe.target_per_cup_unit}"
            cost_str = f"{result.cost_result.per_cup_cost:.2f}"
            ratio_str = f"{result.load_ratio_result.fragrance_load_ratio:.1f}%"
            score_str = f"{result.volatilization_result.scent_score:.1f}"
            
            md_parts.append(f"| {result.recipe.name} | {batch_str} | {cup_str} | {result.recipe.container_count} | {cost_str} | {ratio_str} | {score_str} | {result.risk_result.high_count} | {result.risk_result.medium_count} |")
        
        md_parts.append("")
        md_parts.append("---")
        md_parts.append("")
    
    for i, result in enumerate(results):
        if len(results) > 1:
            md_parts.append(f"## 配方 {i+1}: {result.recipe.name}")
            md_parts.append("")
        else:
            md_parts.append(f"## 配方详情: {result.recipe.name}")
            md_parts.append("")
        
        if result.recipe.description:
            md_parts.append(f"**描述**: {result.recipe.description}")
            md_parts.append("")
        
        md_parts.append("### 基本信息")
        md_parts.append("")
        md_parts.append(f"- **总批量**: {result.recipe.total_batch_size} {result.recipe.total_batch_unit}")
        md_parts.append(f"- **目标单杯容量**: {result.recipe.target_per_cup_capacity} {result.recipe.target_per_cup_unit}")
        md_parts.append(f"- **容器数量**: {result.recipe.container_count}")
        if result.recipe.target_per_cup_cost > 0:
            md_parts.append(f"- **目标单杯成本**: {result.recipe.target_per_cup_cost}")
        md_parts.append("")
        
        md_parts.append("### 原料清单")
        md_parts.append("")
        md_parts.append("| 原料名称 | 类型 | 用量 | 单位 | 单价 |")
        md_parts.append("|----------|------|------|------|------|")
        
        for ing in result.recipe.ingredients:
            if not ing.ingredient:
                continue
            type_name = _get_type_name(ing.ingredient.type)
            price_str = f"{ing.ingredient.unit_price}/{ing.ingredient.unit}"
            md_parts.append(f"| {ing.name} | {type_name} | {ing.amount} | {ing.unit} | {price_str} |")
        
        md_parts.append("")
        
        md_parts.append("### 成本分析")
        md_parts.append("")
        cost = result.cost_result
        md_parts.append(f"- **总成本**: {cost.total_batch_cost:.4f}")
        md_parts.append(f"- **单杯成本**: {cost.per_cup_cost:.4f}")
        md_parts.append(f"- **单位成本**: {cost.per_unit_cost:.6f}/g")
        md_parts.append("")
        
        if cost.cost_breakdown:
            md_parts.append("**成本明细**:")
            md_parts.append("")
            for name, item_cost in cost.cost_breakdown.items():
                percentage = (item_cost / cost.total_batch_cost * 100) if cost.total_batch_cost > 0 else 0
                md_parts.append(f"- {name}: {item_cost:.4f} ({percentage:.1f}%)")
            md_parts.append("")
        
        md_parts.append("### 负载比例分析")
        md_parts.append("")
        load = result.load_ratio_result
        md_parts.append(f"- **香精总重量**: {load.total_fragrance_amount:.4f}g")
        md_parts.append(f"- **蜡基总重量**: {load.total_wax_amount:.4f}g")
        md_parts.append(f"- **香精负载比例**: {load.fragrance_load_ratio:.2f}%")
        md_parts.append(f"- **蜡基比例**: {load.wax_ratio:.2f}%")
        md_parts.append(f"- **助剂比例**: {load.additive_ratio:.2f}%")
        md_parts.append("")
        
        note_dist = get_note_distribution(result.recipe)
        if any(v > 0 for v in note_dist.values()):
            md_parts.append("**香调分布**:")
            md_parts.append("")
            for note, percentage in note_dist.items():
                md_parts.append(f"- {note}: {percentage:.1f}%")
            md_parts.append("")
        
        md_parts.append("### 挥发模拟与留香分析")
        md_parts.append("")
        vol = result.volatilization_result
        md_parts.append(f"- **整体留香时间**: {vol.longevity_hours:.1f} 小时")
        md_parts.append(f"- **前调持续时间**: {vol.top_duration_hours:.1f} 小时")
        md_parts.append(f"- **中调持续时间**: {vol.middle_duration_hours:.1f} 小时")
        md_parts.append(f"- **后调持续时间**: {vol.base_duration_hours:.1f} 小时")
        md_parts.append(f"- **留香评分**: {vol.scent_score:.1f}/100")
        md_parts.append("")
        
        if vol.base_note_gap:
            md_parts.append(f"⚠️ **香调断层警告**: 中调在约 {vol.base_gap_start_hours or vol.middle_duration_hours:.1f} 小时后消散，但后调强度不足")
            md_parts.append("")
        
        if vol.time_points:
            md_parts.append("**关键时间点强度变化**:")
            md_parts.append("")
            md_parts.append("| 时间(小时) | 前调强度 | 中调强度 | 后调强度 | 总强度 | 主导香调 |")
            md_parts.append("|------------|----------|----------|----------|--------|----------|")
            
            key_points = [0, 2, 4, 8, 12, 24, 48, 72]
            for t in key_points:
                found = next((p for p in vol.time_points if abs(p.time_hours - t) < 0.1), None)
                if found:
                    dominant = ", ".join(found.dominant_notes) if found.dominant_notes else "-"
                    md_parts.append(f"| {found.time_hours:.0f} | {found.top_intensity:.1%} | {found.middle_intensity:.1%} | {found.base_intensity:.1%} | {found.total_intensity:.1%} | {dominant} |")
            
            md_parts.append("")
        
        md_parts.append("### 风险检测")
        md_parts.append("")
        risk = result.risk_result
        
        if risk.high_count + risk.medium_count + risk.low_count == 0:
            md_parts.append("✅ 未检测到风险，配方看起来安全合理。")
            md_parts.append("")
        else:
            md_parts.append(f"**风险概览**: 高风险 {risk.high_count} 项 | 中风险 {risk.medium_count} 项 | 低风险 {risk.low_count} 项")
            md_parts.append("")
            
            if risk.high_count > 0:
                md_parts.append("#### 🔴 高风险")
                md_parts.append("")
                for item in risk.risks:
                    if item.level == 'high':
                        md_parts.append(f"- **[{_get_category_name(item.category)}]** {item.message}")
                md_parts.append("")
            
            if risk.medium_count > 0:
                md_parts.append("#### 🟡 中风险")
                md_parts.append("")
                for item in risk.risks:
                    if item.level == 'medium':
                        md_parts.append(f"- **[{_get_category_name(item.category)}]** {item.message}")
                md_parts.append("")
            
            if risk.low_count > 0:
                md_parts.append("#### 🟢 低风险/提示")
                md_parts.append("")
                for item in risk.risks:
                    if item.level == 'low':
                        md_parts.append(f"- **[{_get_category_name(item.category)}]** {item.message}")
                md_parts.append("")
        
        if i < len(results) - 1:
            md_parts.append("---")
            md_parts.append("")
    
    md_parts.append("---")
    md_parts.append("")
    md_parts.append("*本报告由香薰蜡烛配方预演工具生成*")
    
    full_report = "\n".join(md_parts)
    
    if output_path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(full_report)
    
    return full_report


def generate_html_report(
    results: List[AnalysisResult],
    output_path: Optional[str] = None
) -> str:
    """
    生成 HTML 格式的报告
    """
    html_parts = []
    
    html_parts.append(_get_html_template_start())
    
    report_title = "香薰蜡烛配方分析报告" if len(results) == 1 else "香薰蜡烛配方对比分析报告"
    html_parts.append(f"<h1>{report_title}</h1>")
    html_parts.append(f"<p class=\"metadata\">生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>")
    
    if len(results) > 1:
        html_parts.append("<h2>配方概览对比</h2>")
        html_parts.append("<div class=\"table-responsive\">")
        html_parts.append("<table class=\"data-table\">")
        html_parts.append("<thead><tr>")
        html_parts.append("<th>配方名称</th><th>总批量</th><th>单杯容量</th><th>容器数量</th><th>单杯成本</th><th>香精负载</th><th>留香评分</th><th>高风险</th><th>中风险</th>")
        html_parts.append("</tr></thead><tbody>")
        
        for result in results:
            batch_str = f"{result.recipe.total_batch_size}{result.recipe.total_batch_unit}"
            cup_str = f"{result.recipe.target_per_cup_capacity}{result.recipe.target_per_cup_unit}"
            cost_str = f"{result.cost_result.per_cup_cost:.2f}"
            ratio_str = f"{result.load_ratio_result.fragrance_load_ratio:.1f}%"
            score_str = f"{result.volatilization_result.scent_score:.1f}"
            
            risk_high = f"<span class=\"risk-badge high\">{result.risk_result.high_count}</span>"
            risk_medium = f"<span class=\"risk-badge medium\">{result.risk_result.medium_count}</span>"
            
            html_parts.append(f"<tr><td>{result.recipe.name}</td><td>{batch_str}</td><td>{cup_str}</td><td>{result.recipe.container_count}</td><td>{cost_str}</td><td>{ratio_str}</td><td>{score_str}</td><td>{risk_high}</td><td>{risk_medium}</td></tr>")
        
        html_parts.append("</tbody></table>")
        html_parts.append("</div>")
    
    for i, result in enumerate(results):
        section_class = "recipe-section"
        if len(results) > 1:
            html_parts.append(f"<div class=\"{section_class}\">")
            html_parts.append(f"<h2>配方 {i+1}: {result.recipe.name}</h2>")
        else:
            html_parts.append(f"<h2>配方详情: {result.recipe.name}</h2>")
        
        if result.recipe.description:
            html_parts.append(f"<p class=\"description\">{result.recipe.description}</p>")
        
        html_parts.append("<h3>基本信息</h3>")
        html_parts.append("<div class=\"info-grid\">")
        html_parts.append(f"<div class=\"info-item\"><span class=\"label\">总批量</span><span class=\"value\">{result.recipe.total_batch_size} {result.recipe.total_batch_unit}</span></div>")
        html_parts.append(f"<div class=\"info-item\"><span class=\"label\">目标单杯容量</span><span class=\"value\">{result.recipe.target_per_cup_capacity} {result.recipe.target_per_cup_unit}</span></div>")
        html_parts.append(f"<div class=\"info-item\"><span class=\"label\">容器数量</span><span class=\"value\">{result.recipe.container_count}</span></div>")
        if result.recipe.target_per_cup_cost > 0:
            html_parts.append(f"<div class=\"info-item\"><span class=\"label\">目标单杯成本</span><span class=\"value\">{result.recipe.target_per_cup_cost}</span></div>")
        html_parts.append("</div>")
        
        html_parts.append("<h3>原料清单</h3>")
        html_parts.append("<div class=\"table-responsive\">")
        html_parts.append("<table class=\"data-table\">")
        html_parts.append("<thead><tr><th>原料名称</th><th>类型</th><th>用量</th><th>单位</th><th>单价</th></tr></thead><tbody>")
        
        for ing in result.recipe.ingredients:
            if not ing.ingredient:
                continue
            type_name = _get_type_name(ing.ingredient.type)
            price_str = f"{ing.ingredient.unit_price}/{ing.ingredient.unit}"
            html_parts.append(f"<tr><td>{ing.name}</td><td>{type_name}</td><td>{ing.amount}</td><td>{ing.unit}</td><td>{price_str}</td></tr>")
        
        html_parts.append("</tbody></table>")
        html_parts.append("</div>")
        
        html_parts.append("<h3>成本分析</h3>")
        cost = result.cost_result
        html_parts.append("<div class=\"info-grid\">")
        html_parts.append(f"<div class=\"info-item highlight\"><span class=\"label\">总成本</span><span class=\"value\">{cost.total_batch_cost:.4f}</span></div>")
        html_parts.append(f"<div class=\"info-item highlight\"><span class=\"label\">单杯成本</span><span class=\"value\">{cost.per_cup_cost:.4f}</span></div>")
        html_parts.append(f"<div class=\"info-item\"><span class=\"label\">单位成本</span><span class=\"value\">{cost.per_unit_cost:.6f}/g</span></div>")
        html_parts.append("</div>")
        
        if cost.cost_breakdown:
            html_parts.append("<p><strong>成本明细:</strong></p>")
            html_parts.append("<div class=\"chart-container\">")
            html_parts.append(_generate_pie_chart_data(cost.cost_breakdown))
            html_parts.append("</div>")
        
        html_parts.append("<h3>负载比例分析</h3>")
        load = result.load_ratio_result
        html_parts.append("<div class=\"info-grid\">")
        html_parts.append(f"<div class=\"info-item\"><span class=\"label\">香精总重量</span><span class=\"value\">{load.total_fragrance_amount:.4f}g</span></div>")
        html_parts.append(f"<div class=\"info-item\"><span class=\"label\">蜡基总重量</span><span class=\"value\">{load.total_wax_amount:.4f}g</span></div>")
        
        load_class = "highlight" if load.fragrance_load_ratio > 8 else ""
        html_parts.append(f"<div class=\"info-item {load_class}\"><span class=\"label\">香精负载比例</span><span class=\"value\">{load.fragrance_load_ratio:.2f}%</span></div>")
        html_parts.append(f"<div class=\"info-item\"><span class=\"label\">蜡基比例</span><span class=\"value\">{load.wax_ratio:.2f}%</span></div>")
        html_parts.append(f"<div class=\"info-item\"><span class=\"label\">助剂比例</span><span class=\"value\">{load.additive_ratio:.2f}%</span></div>")
        html_parts.append("</div>")
        
        note_dist = get_note_distribution(result.recipe)
        if any(v > 0 for v in note_dist.values()):
            html_parts.append("<p><strong>香调分布:</strong></p>")
            html_parts.append("<div class=\"note-distribution\">")
            for note, percentage in note_dist.items():
                color = _get_note_color(note)
                html_parts.append(f"<div class=\"note-bar\" style=\"width: {percentage}%; background-color: {color};\"><span>{note}: {percentage:.1f}%</span></div>")
            html_parts.append("</div>")
        
        html_parts.append("<h3>挥发模拟与留香分析</h3>")
        vol = result.volatilization_result
        
        score_color = _get_score_color(vol.scent_score)
        html_parts.append(f"<div class=\"score-display\" style=\"background-color: {score_color};\">")
        html_parts.append(f"<div class=\"score-value\">{vol.scent_score:.1f}</div>")
        html_parts.append("<div class=\"score-label\">留香评分 / 100</div>")
        html_parts.append("</div>")
        
        html_parts.append("<div class=\"info-grid\">")
        html_parts.append(f"<div class=\"info-item\"><span class=\"label\">整体留香时间</span><span class=\"value\">{vol.longevity_hours:.1f} 小时</span></div>")
        html_parts.append(f"<div class=\"info-item\"><span class=\"label\">前调持续</span><span class=\"value\">{vol.top_duration_hours:.1f} 小时</span></div>")
        html_parts.append(f"<div class=\"info-item\"><span class=\"label\">中调持续</span><span class=\"value\">{vol.middle_duration_hours:.1f} 小时</span></div>")
        html_parts.append(f"<div class=\"info-item\"><span class=\"label\">后调持续</span><span class=\"value\">{vol.base_duration_hours:.1f} 小时</span></div>")
        html_parts.append("</div>")
        
        if vol.base_note_gap:
            gap_time = vol.base_gap_start_hours or vol.middle_duration_hours
            html_parts.append(f"<div class=\"warning-box\">⚠️ <strong>香调断层警告</strong>: 中调在约 {gap_time:.1f} 小时后消散，但后调强度不足，建议增加后调香精比例。</div>")
        
        if vol.time_points:
            html_parts.append("<p><strong>关键时间点强度变化:</strong></p>")
            html_parts.append(_generate_intensity_chart(vol))
        
        html_parts.append("<h3>风险检测</h3>")
        risk = result.risk_result
        
        if risk.high_count + risk.medium_count + risk.low_count == 0:
            html_parts.append("<div class=\"success-box\">✅ 未检测到风险，配方看起来安全合理。</div>")
        else:
            html_parts.append(f"<p><strong>风险概览:</strong> ")
            if risk.high_count > 0:
                html_parts.append(f"<span class=\"risk-badge high\">高风险: {risk.high_count}</span> ")
            if risk.medium_count > 0:
                html_parts.append(f"<span class=\"risk-badge medium\">中风险: {risk.medium_count}</span> ")
            if risk.low_count > 0:
                html_parts.append(f"<span class=\"risk-badge low\">低风险: {risk.low_count}</span>")
            html_parts.append("</p>")
            
            risk_sections = [
                ('high', '🔴 高风险', 'danger-box', [r for r in risk.risks if r.level == 'high']),
                ('medium', '🟡 中风险', 'warning-box', [r for r in risk.risks if r.level == 'medium']),
                ('low', '🟢 低风险/提示', 'info-box', [r for r in risk.risks if r.level == 'low']),
            ]
            
            for level, title, box_class, items in risk_sections:
                if items:
                    html_parts.append(f"<h4>{title}</h4>")
                    html_parts.append(f"<div class=\"{box_class}\">")
                    html_parts.append("<ul>")
                    for item in items:
                        html_parts.append(f"<li><strong>[{_get_category_name(item.category)}]</strong> {item.message}</li>")
                    html_parts.append("</ul>")
                    html_parts.append("</div>")
        
        if len(results) > 1:
            html_parts.append("</div>")
    
    html_parts.append(_get_html_template_end())
    
    full_report = "\n".join(html_parts)
    
    if output_path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(full_report)
    
    return full_report


def _get_type_name(ingredient_type) -> str:
    type_map = {
        'wax': '蜡基',
        'fragrance': '香精',
        'additive': '助剂',
        'container': '容器'
    }
    return type_map.get(ingredient_type.value, ingredient_type.value)


def _get_category_name(category: str) -> str:
    category_map = {
        'fragrance_ratio': '香精比例',
        'flash_point': '闪点安全',
        'allergen': '过敏原',
        'container_capacity': '容器容量',
        'scent_gap': '香调断层',
        'scent_duration': '留香时间',
        'cost': '成本控制',
        'material_balance': '物料平衡',
        'unit_consistency': '单位一致性'
    }
    return category_map.get(category, category)


def _get_note_color(note: str) -> str:
    if '前调' in note:
        return '#4CAF50'
    elif '中调' in note:
        return '#2196F3'
    elif '后调' in note:
        return '#9C27B0'
    return '#9E9E9E'


def _get_score_color(score: float) -> str:
    if score >= 80:
        return '#E8F5E9'
    elif score >= 60:
        return '#FFF3E0'
    else:
        return '#FFEBEE'


def _generate_pie_chart_data(breakdown: Dict[str, float]) -> str:
    total = sum(breakdown.values())
    if total <= 0:
        return ""
    
    colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40']
    parts = []
    
    for i, (name, cost) in enumerate(breakdown.items()):
        percentage = cost / total * 100
        color = colors[i % len(colors)]
        parts.append(f'<div class="pie-legend" style="background-color: {color};"><span>{name}: {percentage:.1f}% ({cost:.4f})</span></div>')
    
    return "".join(parts)


def _generate_intensity_chart(vol: VolatilizationResult) -> str:
    key_times = [0, 2, 4, 8, 12, 24, 48, 72]
    selected_points = []
    
    for t in key_times:
        found = next((p for p in vol.time_points if abs(p.time_hours - t) < 0.1), None)
        if found:
            selected_points.append(found)
    
    if not selected_points:
        return ""
    
    html = '<div class="table-responsive"><table class="data-table"><thead><tr>'
    html += '<th>时间(小时)</th><th>前调强度</th><th>中调强度</th><th>后调强度</th><th>总强度</th><th>主导香调</th>'
    html += '</tr></thead><tbody>'
    
    for p in selected_points:
        dominant = ", ".join(p.dominant_notes) if p.dominant_notes else "-"
        html += f'<tr><td>{p.time_hours:.0f}</td><td>{p.top_intensity:.1%}</td><td>{p.middle_intensity:.1%}</td><td>{p.base_intensity:.1%}</td><td>{p.total_intensity:.1%}</td><td>{dominant}</td></tr>'
    
    html += '</tbody></table></div>'
    return html


def _get_html_template_start() -> str:
    return """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>香薰蜡烛配方分析报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f7fa;
            padding: 20px;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 20px rgba(0,0,0,0.08);
        }
        h1 { color: #1a1a2e; font-size: 2rem; margin-bottom: 10px; border-bottom: 3px solid #4a6fa5; padding-bottom: 15px; }
        h2 { color: #1a1a2e; font-size: 1.5rem; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #4a6fa5; padding-left: 12px; }
        h3 { color: #2d3748; font-size: 1.25rem; margin-top: 25px; margin-bottom: 12px; }
        h4 { color: #4a5568; font-size: 1.1rem; margin-top: 20px; margin-bottom: 10px; }
        .metadata { color: #718096; font-size: 0.9rem; margin-bottom: 25px; }
        .description { color: #4a5568; font-style: italic; margin-bottom: 20px; padding: 12px; background: #f7fafc; border-radius: 6px; }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .info-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }
        .info-item.highlight {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
        }
        .info-item .label {
            display: block;
            font-size: 0.85rem;
            color: #6c757d;
            margin-bottom: 4px;
        }
        .info-item.highlight .label { color: rgba(255,255,255,0.8); }
        .info-item .value {
            display: block;
            font-size: 1.15rem;
            font-weight: 600;
            color: #2d3748;
        }
        .info-item.highlight .value { color: white; }
        .table-responsive { overflow-x: auto; margin-bottom: 20px; }
        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.95rem;
        }
        .data-table th {
            background: #4a6fa5;
            color: white;
            padding: 12px 15px;
            text-align: left;
            font-weight: 600;
        }
        .data-table td {
            padding: 12px 15px;
            border-bottom: 1px solid #e9ecef;
        }
        .data-table tr:hover { background: #f8f9fa; }
        .score-display {
            text-align: center;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 20px;
        }
        .score-value {
            font-size: 3rem;
            font-weight: 700;
            color: #2d3748;
        }
        .score-label {
            font-size: 1rem;
            color: #4a5568;
            margin-top: 5px;
        }
        .note-distribution {
            display: flex;
            height: 40px;
            border-radius: 6px;
            overflow: hidden;
            margin-bottom: 15px;
        }
        .note-bar {
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 0.8rem;
            font-weight: 500;
            transition: all 0.3s;
        }
        .note-bar:hover { opacity: 0.9; }
        .warning-box {
            background: #fff3cd;
            border: 1px solid #ffc107;
            color: #856404;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
        }
        .danger-box {
            background: #f8d7da;
            border: 1px solid #dc3545;
            color: #721c24;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
        }
        .success-box {
            background: #d4edda;
            border: 1px solid #28a745;
            color: #155724;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
        }
        .info-box {
            background: #d1ecf1;
            border: 1px solid #17a2b8;
            color: #0c5460;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 15px;
        }
        .risk-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            margin: 2px;
        }
        .risk-badge.high { background: #dc3545; color: white; }
        .risk-badge.medium { background: #ffc107; color: #856404; }
        .risk-badge.low { background: #17a2b8; color: white; }
        .recipe-section {
            background: #fafbfc;
            padding: 25px;
            border-radius: 10px;
            margin-bottom: 25px;
            border: 1px solid #e2e8f0;
        }
        .chart-container { margin-bottom: 20px; }
        .pie-legend {
            display: inline-block;
            padding: 8px 15px;
            margin: 5px;
            border-radius: 20px;
            color: white;
            font-size: 0.9rem;
        }
        ul { margin-left: 20px; margin-bottom: 10px; }
        li { margin-bottom: 5px; }
        hr { border: none; border-top: 1px solid #e2e8f0; margin: 30px 0; }
        .footer {
            text-align: center;
            color: #718096;
            font-size: 0.85rem;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
        }
        @media (max-width: 768px) {
            body { padding: 10px; }
            .container { padding: 20px; }
            h1 { font-size: 1.5rem; }
            h2 { font-size: 1.25rem; }
            .info-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
<div class="container">
"""


def _get_html_template_end() -> str:
    return """
<div class="footer">
    本报告由香薰蜡烛配方预演工具生成 | Candle Simulator v1.0.0
</div>
</div>
</body>
</html>
"""
