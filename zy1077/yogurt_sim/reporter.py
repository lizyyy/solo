#!/usr/bin/env python3
"""报告生成模块 - 导出 Markdown、HTML 和 JSON 格式的报告"""

import json
import os
from typing import Dict, Any, List
from datetime import datetime


class ReportGenerator:
    """报告生成器"""
    
    def __init__(self):
        self.generation_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def export_json(self, results: List[Dict[str, Any]], output_path: str):
        """
        导出 JSON 格式报告
        
        Args:
            results: 模拟结果列表
            output_path: 输出文件路径
        """
        report = {
            "metadata": {
                "generated_at": self.generation_time,
                "tool_version": "1.0.0",
                "total_plans": len(results)
            },
            "plans": results
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2, default=str)
    
    def export_markdown(self, results: List[Dict[str, Any]], output_path: str):
        """
        导出 Markdown 格式报告
        
        Args:
            results: 模拟结果列表
            output_path: 输出文件路径
        """
        md_lines = []
        
        # 标题
        md_lines.append("# 🍼 酸奶发酵预演报告")
        md_lines.append("")
        md_lines.append(f"**生成时间**: {self.generation_time}")
        md_lines.append(f"**方案数量**: {len(results)} 个")
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")
        
        # 方案汇总表
        md_lines.append("## 📊 方案汇总")
        md_lines.append("")
        md_lines.append("| 方案 | 牛奶量 | 目标温度 | 总时长 | 预计凝固 | 建议停止 | 风险等级 |")
        md_lines.append("|------|--------|----------|--------|----------|----------|----------|")
        
        for result in results:
            plan = result['plan']
            simulation = result['simulation']
            risks = result['risks']
            
            # 计算风险等级
            high_risk = any(r['level'] == 'high' for r in risks)
            medium_risk = any(r['level'] == 'medium' for r in risks)
            
            if high_risk:
                risk_level = "🔴 高"
            elif medium_risk:
                risk_level = "🟡 中"
            else:
                risk_level = "🟢 低"
            
            # 凝固信息
            coagulation = simulation.get('coagulation_window', {})
            coagulation_start = coagulation.get('start_time', 'N/A')
            optimal_time = coagulation.get('optimal_time', 'N/A')
            
            md_lines.append(
                f"| {result['plan_name']} | {plan.get('milk_volume_ml', 'N/A')} ml | "
                f"{plan.get('target_temp_c', 'N/A')}°C | {plan.get('total_duration_h', 'N/A')}h | "
                f"{coagulation_start} | {optimal_time} | {risk_level} |"
            )
        
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")
        
        # 详细方案
        for i, result in enumerate(results, 1):
            plan = result['plan']
            simulation = result['simulation']
            risks = result['risks']
            
            md_lines.append(f"## 📋 方案 {i}: {result['plan_name']}")
            md_lines.append("")
            
            # 基本参数
            md_lines.append("### 📝 基本参数")
            md_lines.append("")
            md_lines.append(f"- **牛奶量**: {plan.get('milk_volume_ml', 'N/A')} ml")
            md_lines.append(f"- **菌种类型**: {plan.get('culture_type', 'N/A')}")
            md_lines.append(f"- **菌种活性**: {plan.get('culture_activity', 'N/A')}/10")
            md_lines.append(f"- **接种比例**: {plan.get('inoculation_ratio', 'N/A')}%")
            md_lines.append(f"- **初始温度**: {plan.get('initial_temp_c', 'N/A')}°C")
            md_lines.append(f"- **目标温度**: {plan.get('target_temp_c', 'N/A')}°C")
            md_lines.append(f"- **总时长**: {plan.get('total_duration_h', 'N/A')} 小时")
            md_lines.append(f"- **环境温度**: {plan.get('ambient_temp_c', 'N/A')}°C")
            md_lines.append(f"- **容器大小**: {plan.get('container_size_ml', 'N/A')} ml")
            md_lines.append(f"- **是否预热**: {'是' if plan.get('preheated') else '否'}")
            md_lines.append("")
            
            # 关键指标
            md_lines.append("### 📈 关键指标")
            md_lines.append("")
            key_metrics = simulation.get('key_metrics', {})
            md_lines.append(f"- **最终 pH**: {key_metrics.get('final_ph', 'N/A')}")
            md_lines.append(f"- **最终酸度**: {key_metrics.get('final_acidity', 'N/A')}%")
            md_lines.append(f"- **菌活性保留**: {key_metrics.get('viability_retention', 'N/A')}%")
            md_lines.append(f"- **累积热损伤**: {key_metrics.get('total_heat_damage', 'N/A')}")
            md_lines.append(f"- **最终温度**: {key_metrics.get('final_temperature', 'N/A')}°C")
            md_lines.append("")
            
            # 凝固窗口
            md_lines.append("### ⏰ 凝固窗口分析")
            md_lines.append("")
            coagulation = simulation.get('coagulation_window', {})
            
            start_hours = coagulation.get('start_hours')
            end_hours = coagulation.get('end_hours')
            optimal_hours = coagulation.get('optimal_hours')
            
            if start_hours:
                md_lines.append(f"- **开始凝固**: {coagulation.get('start_time', 'N/A')} "
                              f"(pH {coagulation.get('start_ph', 'N/A')}, 酸度 {coagulation.get('start_acidity', 'N/A')}%)")
            else:
                md_lines.append("- **开始凝固**: ❌ 预计无法凝固")
            
            if end_hours:
                md_lines.append(f"- **过酸时间**: {coagulation.get('end_time', 'N/A')} "
                              f"(pH {coagulation.get('end_ph', 'N/A')}, 酸度 {coagulation.get('end_acidity', 'N/A')}%)")
            else:
                md_lines.append("- **过酸时间**: ⏳ 配置时长内不会过酸")
            
            if optimal_hours:
                md_lines.append(f"- **建议停止时间**: **{coagulation.get('optimal_time', 'N/A')}** "
                              f"(约 {optimal_hours} 小时)")
            else:
                md_lines.append("- **建议停止时间**: ⚠️ 无法确定，请密切观察")
            
            md_lines.append("")
            
            # 风险评估
            md_lines.append("### ⚠️ 风险评估")
            md_lines.append("")
            
            if risks:
                # 按等级分组
                high_risks = [r for r in risks if r['level'] == 'high']
                medium_risks = [r for r in risks if r['level'] == 'medium']
                low_risks = [r for r in risks if r['level'] == 'low']
                
                if high_risks:
                    md_lines.append("#### 🔴 高风险")
                    md_lines.append("")
                    for r in high_risks:
                        md_lines.append(f"**{r['name']}** (严重度: {r['severity_score']}/10)")
                        md_lines.append(f"- 描述: {r['description']}")
                        md_lines.append(f"- 原因: {r['cause']}")
                        md_lines.append(f"- 建议: {r['suggestion']}")
                        md_lines.append("")
                
                if medium_risks:
                    md_lines.append("#### 🟡 中风险")
                    md_lines.append("")
                    for r in medium_risks:
                        md_lines.append(f"**{r['name']}** (严重度: {r['severity_score']}/10)")
                        md_lines.append(f"- 描述: {r['description']}")
                        md_lines.append(f"- 原因: {r['cause']}")
                        md_lines.append(f"- 建议: {r['suggestion']}")
                        md_lines.append("")
                
                if low_risks:
                    md_lines.append("#### 🟢 低风险")
                    md_lines.append("")
                    for r in low_risks:
                        md_lines.append(f"**{r['name']}** (严重度: {r['severity_score']}/10)")
                        md_lines.append(f"- 描述: {r['description']}")
                        md_lines.append(f"- 原因: {r['cause']}")
                        md_lines.append(f"- 建议: {r['suggestion']}")
                        md_lines.append("")
            else:
                md_lines.append("✅ 未检测到显著风险")
                md_lines.append("")
            
            # 调整建议
            suggestions = simulation.get('suggestions', [])
            if suggestions:
                md_lines.append("### 💡 调整建议")
                md_lines.append("")
                for s in suggestions:
                    md_lines.append(f"- {s}")
                md_lines.append("")
            
            # 时间线表格（只显示关键时间点）
            md_lines.append("### 📅 关键时间点")
            md_lines.append("")
            md_lines.append("| 时间 | 温度 | pH | 酸度 | 状态 |")
            md_lines.append("|------|------|----|------|------|")
            
            time_steps = simulation.get('time_steps', [])
            # 只显示每小时的数据和关键转折点
            displayed_steps = []
            for step in time_steps:
                time_h = step['time_hours']
                # 显示整点、开始凝固、过酸等关键节点
                if (abs(time_h - round(time_h)) < 0.01 or  # 整点
                    step['is_coagulated'] or 
                    step['is_over_acid']):
                    displayed_steps.append(step)
            
            # 限制显示数量
            if len(displayed_steps) > 20:
                displayed_steps = displayed_steps[::len(displayed_steps)//20 + 1]
            
            for step in displayed_steps:
                status = []
                if step['is_coagulated']:
                    status.append("🟢 已凝固")
                if step['is_over_acid']:
                    status.append("🔴 过酸")
                if not status:
                    status.append("⏳ 发酵中")
                
                md_lines.append(
                    f"| {step['time_hours']:.1f}h | {step['temperature_c']:.1f}°C | "
                    f"{step['ph']:.2f} | {step['acidity_percent']:.3f}% | {' '.join(status)} |"
                )
            
            md_lines.append("")
            md_lines.append("---")
            md_lines.append("")
        
        # 模型说明
        md_lines.append("## 📚 模型假设说明")
        md_lines.append("")
        md_lines.append("本工具使用简化模型进行模拟，以下是关键假设：")
        md_lines.append("")
        
        if results:
            assumptions = results[0]['simulation'].get('model_assumptions', {})
            for key, value in assumptions.items():
                md_lines.append(f"- **{key.replace('_', ' ').title()}**: {value}")
        
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")
        md_lines.append("*本报告仅供参考，实际发酵结果可能因具体条件有所不同。*")
        
        # 写入文件
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(md_lines))
    
    def export_html(self, results: List[Dict[str, Any]], output_path: str):
        """
        导出 HTML 格式报告
        
        Args:
            results: 模拟结果列表
            output_path: 输出文件路径
        """
        html_lines = []
        
        # HTML 头部
        html_lines.append("<!DOCTYPE html>")
        html_lines.append("<html lang='zh-CN'>")
        html_lines.append("<head>")
        html_lines.append("    <meta charset='UTF-8'>")
        html_lines.append("    <meta name='viewport' content='width=device-width, initial-scale=1.0'>")
        html_lines.append("    <title>酸奶发酵预演报告</title>")
        html_lines.append("    <style>")
        html_lines.append("        * { box-sizing: border-box; margin: 0; padding: 0; }")
        html_lines.append("        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f5f5f5; }")
        html_lines.append("        .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }")
        html_lines.append("        h1 { color: #e74c3c; text-align: center; margin-bottom: 10px; }")
        html_lines.append("        h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-top: 30px; margin-bottom: 20px; }")
        html_lines.append("        h3 { color: #34495e; margin-top: 20px; margin-bottom: 15px; }")
        html_lines.append("        .metadata { text-align: center; color: #7f8c8d; margin-bottom: 30px; }")
        html_lines.append("        table { width: 100%; border-collapse: collapse; margin: 20px 0; }")
        html_lines.append("        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }")
        html_lines.append("        th { background-color: #3498db; color: white; }")
        html_lines.append("        tr:hover { background-color: #f5f5f5; }")
        html_lines.append("        .risk-high { background-color: #ffebee; border-left: 4px solid #e74c3c; padding: 15px; margin: 10px 0; border-radius: 4px; }")
        html_lines.append("        .risk-medium { background-color: #fff8e1; border-left: 4px solid #f39c12; padding: 15px; margin: 10px 0; border-radius: 4px; }")
        html_lines.append("        .risk-low { background-color: #e8f5e9; border-left: 4px solid #27ae60; padding: 15px; margin: 10px 0; border-radius: 4px; }")
        html_lines.append("        .coagulation-window { background: linear-gradient(90deg, #27ae60 0%, #f39c12 50%, #e74c3c 100%); height: 20px; border-radius: 10px; margin: 20px 0; position: relative; }")
        html_lines.append("        .coagulation-label { position: absolute; top: -25px; font-size: 12px; color: #7f8c8d; }")
        html_lines.append("        .coagulation-label.start { left: 0%; }")
        html_lines.append("        .coagulation-label.optimal { left: 50%; transform: translateX(-50%); }")
        html_lines.append("        .coagulation-label.end { right: 0%; }")
        html_lines.append("        ul { margin-left: 20px; margin-bottom: 20px; }")
        html_lines.append("        li { margin-bottom: 8px; }")
        html_lines.append("        .plan-card { background: #fafafa; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; }")
        html_lines.append("        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }")
        html_lines.append("        .metric-card { background: #f8f9fa; border-radius: 8px; padding: 15px; text-align: center; }")
        html_lines.append("        .metric-value { font-size: 24px; font-weight: bold; color: #3498db; }")
        html_lines.append("        .metric-label { font-size: 14px; color: #7f8c8d; margin-top: 5px; }")
        html_lines.append("        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #7f8c8d; font-size: 14px; }")
        html_lines.append("    </style>")
        html_lines.append("</head>")
        html_lines.append("<body>")
        html_lines.append("    <div class='container'>")
        
        # 标题
        html_lines.append("        <h1>🍼 酸奶发酵预演报告</h1>")
        html_lines.append(f"        <div class='metadata'>生成时间: {self.generation_time} | 方案数量: {len(results)} 个</div>")
        
        # 方案汇总表
        html_lines.append("        <h2>📊 方案汇总</h2>")
        html_lines.append("        <table>")
        html_lines.append("            <thead>")
        html_lines.append("                <tr><th>方案</th><th>牛奶量</th><th>目标温度</th><th>总时长</th><th>预计凝固</th><th>建议停止</th><th>风险等级</th></tr>")
        html_lines.append("            </thead>")
        html_lines.append("            <tbody>")
        
        for result in results:
            plan = result['plan']
            simulation = result['simulation']
            risks = result['risks']
            
            high_risk = any(r['level'] == 'high' for r in risks)
            medium_risk = any(r['level'] == 'medium' for r in risks)
            
            if high_risk:
                risk_level = "<span style='color: #e74c3c;'>🔴 高风险</span>"
            elif medium_risk:
                risk_level = "<span style='color: #f39c12;'>🟡 中风险</span>"
            else:
                risk_level = "<span style='color: #27ae60;'>🟢 低风险</span>"
            
            coagulation = simulation.get('coagulation_window', {})
            coagulation_start = coagulation.get('start_time', 'N/A')
            optimal_time = coagulation.get('optimal_time', 'N/A')
            
            html_lines.append(
                f"                <tr><td>{result['plan_name']}</td>"
                f"<td>{plan.get('milk_volume_ml', 'N/A')} ml</td>"
                f"<td>{plan.get('target_temp_c', 'N/A')}°C</td>"
                f"<td>{plan.get('total_duration_h', 'N/A')}h</td>"
                f"<td>{coagulation_start}</td>"
                f"<td><strong>{optimal_time}</strong></td>"
                f"<td>{risk_level}</td></tr>"
            )
        
        html_lines.append("            </tbody>")
        html_lines.append("        </table>")
        
        # 详细方案
        for i, result in enumerate(results, 1):
            plan = result['plan']
            simulation = result['simulation']
            risks = result['risks']
            
            html_lines.append(f"        <h2>📋 方案 {i}: {result['plan_name']}</h2>")
            html_lines.append("        <div class='plan-card'>")
            
            # 关键指标卡片
            html_lines.append("            <h3>📈 关键指标</h3>")
            html_lines.append("            <div class='metric-grid'>")
            
            key_metrics = simulation.get('key_metrics', {})
            metrics = [
                ("最终 pH", key_metrics.get('final_ph', 'N/A')),
                ("最终酸度", f"{key_metrics.get('final_acidity', 'N/A')}%"),
                ("菌活性保留", f"{key_metrics.get('viability_retention', 'N/A')}%"),
                ("累积热损伤", key_metrics.get('total_heat_damage', 'N/A')),
            ]
            
            for label, value in metrics:
                html_lines.append(f"                <div class='metric-card'><div class='metric-value'>{value}</div><div class='metric-label'>{label}</div></div>")
            
            html_lines.append("            </div>")
            
            # 凝固窗口
            html_lines.append("            <h3>⏰ 凝固窗口分析</h3>")
            coagulation = simulation.get('coagulation_window', {})
            
            start_hours = coagulation.get('start_hours')
            end_hours = coagulation.get('end_hours')
            optimal_hours = coagulation.get('optimal_hours')
            
            if start_hours:
                html_lines.append(f"            <p><strong>开始凝固:</strong> {coagulation.get('start_time', 'N/A')} (pH {coagulation.get('start_ph', 'N/A')})</p>")
            else:
                html_lines.append("            <p style='color: #e74c3c;'><strong>❌ 预计无法凝固</strong></p>")
            
            if end_hours:
                html_lines.append(f"            <p><strong>过酸时间:</strong> {coagulation.get('end_time', 'N/A')} (pH {coagulation.get('end_ph', 'N/A')})</p>")
            
            if optimal_hours:
                html_lines.append(f"            <p><strong style='color: #27ae60;'>💡 建议停止时间: {coagulation.get('optimal_time', 'N/A')}</strong></p>")
            
            # 风险评估
            if risks:
                html_lines.append("            <h3>⚠️ 风险评估</h3>")
                
                high_risks = [r for r in risks if r['level'] == 'high']
                medium_risks = [r for r in risks if r['level'] == 'medium']
                low_risks = [r for r in risks if r['level'] == 'low']
                
                for risk_list, risk_class in [(high_risks, 'risk-high'), (medium_risks, 'risk-medium'), (low_risks, 'risk-low')]:
                    for r in risk_list:
                        html_lines.append(f"            <div class='{risk_class}'>")
                        html_lines.append(f"                <h4>{r['name']} (严重度: {r['severity_score']}/10)</h4>")
                        html_lines.append(f"                <p><strong>描述:</strong> {r['description']}</p>")
                        html_lines.append(f"                <p><strong>原因:</strong> {r['cause']}</p>")
                        html_lines.append(f"                <p><strong>建议:</strong> {r['suggestion']}</p>")
                        html_lines.append("            </div>")
            
            # 调整建议
            suggestions = simulation.get('suggestions', [])
            if suggestions:
                html_lines.append("            <h3>💡 调整建议</h3>")
                html_lines.append("            <ul>")
                for s in suggestions:
                    html_lines.append(f"                <li>{s}</li>")
                html_lines.append("            </ul>")
            
            # 时间线表格
            html_lines.append("            <h3>📅 关键时间点</h3>")
            html_lines.append("            <table>")
            html_lines.append("                <thead><tr><th>时间</th><th>温度</th><th>pH</th><th>酸度</th><th>状态</th></tr></thead>")
            html_lines.append("                <tbody>")
            
            time_steps = simulation.get('time_steps', [])
            displayed_steps = []
            for step in time_steps:
                time_h = step['time_hours']
                if (abs(time_h - round(time_h)) < 0.01 or step['is_coagulated'] or step['is_over_acid']):
                    displayed_steps.append(step)
            
            if len(displayed_steps) > 15:
                displayed_steps = displayed_steps[::len(displayed_steps)//15 + 1]
            
            for step in displayed_steps:
                status = []
                if step['is_coagulated']:
                    status.append("🟢 已凝固")
                if step['is_over_acid']:
                    status.append("🔴 过酸")
                if not status:
                    status.append("⏳ 发酵中")
                
                html_lines.append(
                    f"                    <tr><td>{step['time_hours']:.1f}h</td>"
                    f"<td>{step['temperature_c']:.1f}°C</td>"
                    f"<td>{step['ph']:.2f}</td>"
                    f"<td>{step['acidity_percent']:.3f}%</td>"
                    f"<td>{' '.join(status)}</td></tr>"
                )
            
            html_lines.append("                </tbody>")
            html_lines.append("            </table>")
            html_lines.append("        </div>")
        
        # 模型说明
        html_lines.append("        <h2>📚 模型假设说明</h2>")
        html_lines.append("        <ul>")
        
        if results:
            assumptions = results[0]['simulation'].get('model_assumptions', {})
            for key, value in assumptions.items():
                html_lines.append(f"            <li><strong>{key.replace('_', ' ').title()}:</strong> {value}</li>")
        
        html_lines.append("        </ul>")
        
        # 页脚
        html_lines.append("        <div class='footer'>")
        html_lines.append("            <p>本报告仅供参考，实际发酵结果可能因具体条件有所不同。</p>")
        html_lines.append(f"            <p>生成时间: {self.generation_time}</p>")
        html_lines.append("        </div>")
        
        html_lines.append("    </div>")
        html_lines.append("</body>")
        html_lines.append("</html>")
        
        # 写入文件
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(html_lines))
