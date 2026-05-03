"""
Markdown和CSV导出功能模块
"""

import csv
from datetime import datetime
from typing import List, Dict, Optional
from pathlib import Path

from .models import (
    TankParams, DailyReading, SupplementConfig, DosingPlan, DosingResult
)


class Exporter:
    """结果导出器"""
    
    @staticmethod
    def export_markdown(result: DosingResult, output_path: str) -> str:
        """
        导出Markdown格式的维护单
        
        Args:
            result: 投加计算结果
            output_path: 输出文件路径
        
        Returns:
            生成的Markdown内容
        """
        content = Exporter._generate_markdown_content(result)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return content
    
    @staticmethod
    def _generate_markdown_content(result: DosingResult) -> str:
        """生成Markdown内容"""
        lines = []
        
        # 标题
        lines.append("# 海水缸补剂配平维护单")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 缸体信息
        lines.append("## 1. 缸体基本信息")
        lines.append("")
        lines.append("| 参数 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 缸体名称 | {result.tank_params.tank_name} |")
        lines.append(f"| 总水量 | {result.tank_params.total_volume:.1f} L |")
        if result.tank_params.display_volume > 0:
            lines.append(f"| 主缸水量 | {result.tank_params.display_volume:.1f} L |")
        if result.tank_params.sump_volume > 0:
            lines.append(f"| 底缸水量 | {result.tank_params.sump_volume:.1f} L |")
        lines.append("")
        
        # 目标参数范围
        lines.append("## 2. 目标参数范围")
        lines.append("")
        lines.append("| 参数 | 最小值 | 最大值 | 目标中点 | 单位 |")
        lines.append("|------|--------|--------|----------|------|")
        lines.append(f"| KH | {result.tank_params.target_kh_min:.1f} | {result.tank_params.target_kh_max:.1f} | {(result.tank_params.target_kh_min + result.tank_params.target_kh_max)/2:.1f} | dKH |")
        lines.append(f"| 钙 | {result.tank_params.target_ca_min:.0f} | {result.tank_params.target_ca_max:.0f} | {(result.tank_params.target_ca_min + result.tank_params.target_ca_max)/2:.0f} | ppm |")
        lines.append(f"| 镁 | {result.tank_params.target_mg_min:.0f} | {result.tank_params.target_mg_max:.0f} | {(result.tank_params.target_mg_min + result.tank_params.target_mg_max)/2:.0f} | ppm |")
        lines.append(f"| 盐度 | {result.tank_params.target_salinity_min:.3f} | {result.tank_params.target_salinity_max:.3f} | {(result.tank_params.target_salinity_min + result.tank_params.target_salinity_max)/2:.3f} | sg |")
        lines.append("")
        
        # 历史检测数据
        if result.historical_readings:
            lines.append("## 3. 历史检测数据")
            lines.append("")
            lines.append("| 日期 | KH (dKH) | 钙 (ppm) | 镁 (ppm) | 盐度 (sg) | 蒸发量 (L) | 备注 |")
            lines.append("|------|----------|----------|----------|-----------|------------|------|")
            
            for reading in result.historical_readings:
                kh = f"{reading.kh:.1f}" if reading.kh is not None else "-"
                ca = f"{reading.ca:.0f}" if reading.ca is not None else "-"
                mg = f"{reading.mg:.0f}" if reading.mg is not None else "-"
                salinity = f"{reading.salinity:.3f}" if reading.salinity is not None else "-"
                evaporation = f"{reading.evaporation:.1f}" if reading.evaporation is not None else "-"
                notes = reading.notes or "-"
                
                date_str = reading.date.strftime('%Y-%m-%d')
                lines.append(f"| {date_str} | {kh} | {ca} | {mg} | {salinity} | {evaporation} | {notes} |")
            
            lines.append("")
        
        # 补剂配置
        if result.supplement_configs:
            lines.append("## 4. 补剂配置")
            lines.append("")
            lines.append("| 补剂名称 | 对应参数 | 浓度 | 浓度单位 | 每日最大投加量 | 安全阈值 |")
            lines.append("|----------|----------|------|----------|----------------|----------|")
            
            for param, config in result.supplement_configs.items():
                max_dosage_str = f"{config.max_daily_dosage:.1f} mL/100L"
                if param == 'kh':
                    threshold_str = f"{config.safety_threshold:.1f} dKH"
                elif param == 'salinity':
                    threshold_str = f"{config.safety_threshold:.3f} sg"
                else:
                    threshold_str = f"{config.safety_threshold:.0f} ppm"
                
                lines.append(
                    f"| {config.name} | {param.upper()} | {config.concentration} | {config.concentration_unit} | "
                    f"{max_dosage_str} | {threshold_str} |"
                )
            
            lines.append("")
        
        # 未来投加计划
        lines.append("## 5. 未来7天投加计划")
        lines.append("")
        lines.append("### 每日投加明细")
        lines.append("")
        
        for i, plan in enumerate(result.future_plans, 1):
            date_str = plan.date.strftime('%Y-%m-%d')
            weekday = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][plan.date.weekday()]
            
            lines.append(f"#### 第 {i} 天 - {date_str} ({weekday})")
            lines.append("")
            lines.append("| 参数 | 投加量 | 预计浓度变化 | 状态 |")
            lines.append("|------|--------|--------------|------|")
            
            # KH
            if plan.kh_dosage and plan.kh_dosage > 0:
                kh_status = "需要投加"
                if plan.kh_warnings:
                    kh_status = "⚠️ 有警告"
                lines.append(
                    f"| KH | {plan.kh_dosage:.2f} mL | +{plan.kh_concentration_change:.2f} dKH | {kh_status} |"
                )
            else:
                lines.append("| KH | - | - | 无需投加 |")
            
            # 钙
            if plan.ca_dosage and plan.ca_dosage > 0:
                ca_status = "需要投加"
                if plan.ca_warnings:
                    ca_status = "⚠️ 有警告"
                lines.append(
                    f"| 钙 | {plan.ca_dosage:.2f} mL | +{plan.ca_concentration_change:.0f} ppm | {ca_status} |"
                )
            else:
                lines.append("| 钙 | - | - | 无需投加 |")
            
            # 镁
            if plan.mg_dosage and plan.mg_dosage > 0:
                mg_status = "需要投加"
                if plan.mg_warnings:
                    mg_status = "⚠️ 有警告"
                lines.append(
                    f"| 镁 | {plan.mg_dosage:.2f} mL | +{plan.mg_concentration_change:.0f} ppm | {mg_status} |"
                )
            else:
                lines.append("| 镁 | - | - | 无需投加 |")
            
            # 补水
            if plan.top_up_water and plan.top_up_water > 0:
                salinity_note = ""
                if plan.salinity_adjustment and abs(plan.salinity_adjustment) > 0.0001:
                    if plan.salinity_adjustment > 0:
                        salinity_note = f" (需加盐 +{plan.salinity_adjustment:.4f} sg)"
                    else:
                        salinity_note = f" (需稀释 {plan.salinity_adjustment:.4f} sg)"
                lines.append(f"| 补水 | {plan.top_up_water:.1f} L | {salinity_note} | 每日蒸发补充 |")
            
            lines.append("")
            
            # 显示当天的警告
            all_warnings = plan.get_all_warnings()
            if all_warnings:
                lines.append("**⚠️ 注意事项:**")
                lines.append("")
                for warning in all_warnings:
                    lines.append(f"- {warning}")
                lines.append("")
        
        # 汇总统计
        lines.append("### 投加量汇总")
        lines.append("")
        lines.append("| 参数 | 7天总投加量 | 日均投加量 |")
        lines.append("|------|-------------|------------|")
        
        total_kh = sum(p.kh_dosage or 0 for p in result.future_plans)
        total_ca = sum(p.ca_dosage or 0 for p in result.future_plans)
        total_mg = sum(p.mg_dosage or 0 for p in result.future_plans)
        total_water = sum(p.top_up_water or 0 for p in result.future_plans)
        
        if total_kh > 0:
            lines.append(f"| KH | {total_kh:.2f} mL | {total_kh/7:.2f} mL/天 |")
        if total_ca > 0:
            lines.append(f"| 钙 | {total_ca:.2f} mL | {total_ca/7:.2f} mL/天 |")
        if total_mg > 0:
            lines.append(f"| 镁 | {total_mg:.2f} mL | {total_mg/7:.2f} mL/天 |")
        if total_water > 0:
            lines.append(f"| 补水 | {total_water:.1f} L | {total_water/7:.1f} L/天 |")
        
        lines.append("")
        
        # 总体警告
        all_warnings = []
        all_warnings.extend(result.overall_warnings)
        for plan in result.future_plans:
            all_warnings.extend(plan.get_all_warnings())
        
        if all_warnings:
            lines.append("## 6. 重要警告")
            lines.append("")
            lines.append("### ⚠️ 需要特别注意的问题")
            lines.append("")
            
            # 去重
            unique_warnings = list(dict.fromkeys(all_warnings))
            for warning in unique_warnings:
                lines.append(f"- {warning}")
            
            lines.append("")
        
        # 页脚
        lines.append("---")
        lines.append("")
        lines.append("*本维护单由补剂配平助手自动生成，请在执行前仔细核对所有计算结果。*")
        lines.append("")
        lines.append("**操作建议**:")
        lines.append("- 投加前请再次确认补剂浓度和投加量")
        lines.append("- 建议分多次投加，每次间隔1-2小时")
        lines.append("- 投加后24小时请检测参数变化")
        lines.append("- 如有异常请立即停止并咨询专业人士")
        
        return "\n".join(lines)
    
    @staticmethod
    def export_csv(result: DosingResult, output_path: str):
        """
        导出CSV格式的投加计划
        
        Args:
            result: 投加计算结果
            output_path: 输出文件路径
        """
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            # 缸体信息行
            writer.writerow(['缸体信息'])
            writer.writerow(['缸体名称', result.tank_params.tank_name])
            writer.writerow(['总水量', f"{result.tank_params.total_volume:.1f} L"])
            writer.writerow([])
            
            # 目标参数
            writer.writerow(['目标参数范围'])
            writer.writerow(['参数', '最小值', '最大值', '单位'])
            writer.writerow(['KH', result.tank_params.target_kh_min, result.tank_params.target_kh_max, 'dKH'])
            writer.writerow(['钙', result.tank_params.target_ca_min, result.tank_params.target_ca_max, 'ppm'])
            writer.writerow(['镁', result.tank_params.target_mg_min, result.tank_params.target_mg_max, 'ppm'])
            writer.writerow(['盐度', result.tank_params.target_salinity_min, result.tank_params.target_salinity_max, 'sg'])
            writer.writerow([])
            
            # 投加计划
            writer.writerow(['未来7天投加计划'])
            writer.writerow([
                '日期', '星期',
                'KH投加量(mL)', 'KH浓度变化(dKH)', 'KH警告',
                '钙投加量(mL)', '钙浓度变化(ppm)', '钙警告',
                '镁投加量(mL)', '镁浓度变化(ppm)', '镁警告',
                '补水量(L)', '盐度调整(sg)', '盐度警告',
                '其他警告'
            ])
            
            weekdays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
            
            for plan in result.future_plans:
                date_str = plan.date.strftime('%Y-%m-%d')
                weekday = weekdays[plan.date.weekday()]
                
                # 处理各参数
                kh_dosage = f"{plan.kh_dosage:.2f}" if plan.kh_dosage and plan.kh_dosage > 0 else "0"
                kh_change = f"{plan.kh_concentration_change:.2f}" if plan.kh_concentration_change else "0"
                kh_warning = "; ".join(plan.kh_warnings) if plan.kh_warnings else ""
                
                ca_dosage = f"{plan.ca_dosage:.2f}" if plan.ca_dosage and plan.ca_dosage > 0 else "0"
                ca_change = f"{plan.ca_concentration_change:.0f}" if plan.ca_concentration_change else "0"
                ca_warning = "; ".join(plan.ca_warnings) if plan.ca_warnings else ""
                
                mg_dosage = f"{plan.mg_dosage:.2f}" if plan.mg_dosage and plan.mg_dosage > 0 else "0"
                mg_change = f"{plan.mg_concentration_change:.0f}" if plan.mg_concentration_change else "0"
                mg_warning = "; ".join(plan.mg_warnings) if plan.mg_warnings else ""
                
                top_up = f"{plan.top_up_water:.1f}" if plan.top_up_water else "0"
                salinity_adj = f"{plan.salinity_adjustment:.4f}" if plan.salinity_adjustment else "0"
                salinity_warning = "; ".join(plan.salinity_warnings) if plan.salinity_warnings else ""
                
                other_warning = "; ".join(plan.all_warnings) if plan.all_warnings else ""
                
                writer.writerow([
                    date_str, weekday,
                    kh_dosage, kh_change, kh_warning,
                    ca_dosage, ca_change, ca_warning,
                    mg_dosage, mg_change, mg_warning,
                    top_up, salinity_adj, salinity_warning,
                    other_warning
                ])
            
            writer.writerow([])
            
            # 汇总
            writer.writerow(['7天汇总'])
            writer.writerow(['参数', '总投加量', '日均投加量', '单位'])
            
            total_kh = sum(p.kh_dosage or 0 for p in result.future_plans)
            total_ca = sum(p.ca_dosage or 0 for p in result.future_plans)
            total_mg = sum(p.mg_dosage or 0 for p in result.future_plans)
            total_water = sum(p.top_up_water or 0 for p in result.future_plans)
            
            if total_kh > 0:
                writer.writerow(['KH', f"{total_kh:.2f}", f"{total_kh/7:.2f}", 'mL'])
            if total_ca > 0:
                writer.writerow(['钙', f"{total_ca:.2f}", f"{total_ca/7:.2f}", 'mL'])
            if total_mg > 0:
                writer.writerow(['镁', f"{total_mg:.2f}", f"{total_mg/7:.2f}", 'mL'])
            if total_water > 0:
                writer.writerow(['补水', f"{total_water:.1f}", f"{total_water/7:.1f}", 'L'])
            
            writer.writerow([])
            
            # 警告汇总
            all_warnings = []
            all_warnings.extend(result.overall_warnings)
            for plan in result.future_plans:
                all_warnings.extend(plan.get_all_warnings())
            
            if all_warnings:
                writer.writerow(['警告汇总'])
                unique_warnings = list(dict.fromkeys(all_warnings))
                for warning in unique_warnings:
                    writer.writerow(['⚠️', warning])
