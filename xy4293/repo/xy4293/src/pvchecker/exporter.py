#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
导出模块 - Exporter Module

报告导出功能：
- MarkdownExporter: Markdown格式报告
- CSVExporter: CSV格式报告
- JSONExporter: JSON格式报告
- ReportExporter: 统一导出接口
"""

import os
import json
import csv
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict, is_dataclass
from pathlib import Path
from datetime import datetime
from enum import Enum

from pvchecker import (
    PVModule,
    RoofZone,
    InverterMPPT,
    RiskItem,
    AnalysisResult
)
from pvchecker.solver import ConfigurationSolution, SolutionScore, SolutionType
from pvchecker.risk import RiskLevel


class ExportFormat(Enum):
    """导出格式"""
    MARKDOWN = "markdown"
    CSV = "csv"
    JSON = "json"


@dataclass
class ExportResult:
    """导出结果"""
    success: bool
    format: str
    output_path: Optional[str] = None
    message: str = ""
    file_size: Optional[int] = None


class MarkdownExporter:
    """Markdown格式报告导出器"""
    
    def __init__(self):
        self._report_content: List[str] = []
    
    def export(
        self,
        solutions: List[ConfigurationSolution],
        module: Optional[PVModule] = None,
        inverter: Optional[InverterMPPT] = None,
        roof_zones: Optional[List[RoofZone]] = None,
        risks: Optional[List[RiskItem]] = None,
        shading_matrix: Optional[List[List[float]]] = None,
        environment_params: Optional[Dict] = None,
        output_path: Optional[Union[str, Path]] = None,
        title: str = "屋顶光伏串线校核报告"
    ) -> ExportResult:
        """导出Markdown报告
        
        Args:
            solutions: 方案列表
            module: 组件参数
            inverter: 逆变器参数
            roof_zones: 屋面分区
            risks: 风险列表
            shading_matrix: 遮挡系数矩阵
            environment_params: 环境参数
            output_path: 输出文件路径
            title: 报告标题
            
        Returns:
            ExportResult对象
        """
        self._report_content = []
        
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        self._add_header(title, level=1)
        self._add_paragraph(f"生成时间: {now}")
        self._add_horizontal_rule()
        
        if module:
            self._add_module_info(module)
        
        if inverter:
            self._add_inverter_info(inverter)
        
        if roof_zones:
            self._add_roof_zones_info(roof_zones)
        
        if environment_params:
            self._add_environment_info(environment_params)
        
        self._add_horizontal_rule()
        
        if solutions:
            self._add_solutions_comparison(solutions)
        
        if risks:
            self._add_risks_section(risks)
        
        self._add_horizontal_rule()
        self._add_footer()
        
        content = "\n".join(self._report_content)
        
        if output_path:
            try:
                output_path = Path(output_path)
                output_path.parent.mkdir(parents=True, exist_ok=True)
                
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                file_size = output_path.stat().st_size
                
                return ExportResult(
                    success=True,
                    format="markdown",
                    output_path=str(output_path),
                    message=f"Markdown报告已成功导出到: {output_path}",
                    file_size=file_size
                )
                
            except Exception as e:
                return ExportResult(
                    success=False,
                    format="markdown",
                    output_path=str(output_path) if output_path else None,
                    message=f"导出失败: {e}"
                )
        
        return ExportResult(
            success=True,
            format="markdown",
            message="报告内容已生成（未保存到文件）"
        )
    
    def _add_header(self, text: str, level: int = 1):
        """添加标题"""
        self._report_content.append(f"{'#' * level} {text}")
        self._report_content.append("")
    
    def _add_paragraph(self, text: str):
        """添加段落"""
        self._report_content.append(text)
        self._report_content.append("")
    
    def _add_horizontal_rule(self):
        """添加分隔线"""
        self._report_content.append("---")
        self._report_content.append("")
    
    def _add_list(self, items: List[str], ordered: bool = False):
        """添加列表"""
        for i, item in enumerate(items):
            if ordered:
                self._report_content.append(f"{i+1}. {item}")
            else:
                self._report_content.append(f"- {item}")
        self._report_content.append("")
    
    def _add_table(self, headers: List[str], rows: List[List[Any]]):
        """添加表格"""
        self._report_content.append(f"| {' | '.join(str(h) for h in headers)} |")
        self._report_content.append(f"| {' | '.join(['---'] * len(headers))} |")
        
        for row in rows:
            self._report_content.append(f"| {' | '.join(str(cell) for cell in row)} |")
        
        self._report_content.append("")
    
    def _add_module_info(self, module: PVModule):
        """添加组件参数信息"""
        self._add_header("光伏组件参数", level=2)
        
        headers = ["参数", "值"]
        rows = [
            ["型号", module.model],
            ["最大功率 Pmax", f"{module.p_max} W"],
            ["最大功率点电压 Vmp", f"{module.v_mp} V"],
            ["最大功率点电流 Imp", f"{module.i_mp} A"],
            ["开路电压 Voc", f"{module.voc} V"],
            ["短路电流 Isc", f"{module.isc} A"],
            ["开路电压温度系数 β", f"{module.temp_coeff_voc} %/°C"],
            ["短路电流温度系数 α", f"{module.temp_coeff_isc} %/°C"],
            ["最大功率温度系数 γ", f"{module.temp_coeff_pmax} %/°C"],
            ["标称工作温度 NOCT", f"{module.noct} °C"],
            ["组件面积", f"{module.area} m²"],
            ["组件效率", f"{module.efficiency * 100} %"],
        ]
        self._add_table(headers, rows)
    
    def _add_inverter_info(self, inverter: InverterMPPT):
        """添加逆变器参数信息"""
        self._add_header("逆变器MPPT参数", level=2)
        
        headers = ["参数", "值"]
        rows = [
            ["逆变器型号", inverter.inverter_model],
            ["MPPT通道ID", inverter.mppt_id],
            ["MPPT最低工作电压", f"{inverter.v_min} V"],
            ["MPPT最高工作电压", f"{inverter.v_max} V"],
            ["标称工作电压", f"{inverter.v_nom} V"],
            ["最大功率", f"{inverter.p_max} W ({inverter.p_max/1000:.1f} kW)"],
            ["最大输入电流", f"{inverter.i_max} A"],
            ["转换效率", f"{inverter.efficiency * 100} %"],
        ]
        if inverter.v_start:
            rows.append(["启动电压", f"{inverter.v_start} V"])
        self._add_table(headers, rows)
    
    def _add_roof_zones_info(self, roof_zones: List[RoofZone]):
        """添加屋面分区信息"""
        self._add_header("屋面分区信息", level=2)
        
        total_modules = sum(z.module_count for z in roof_zones)
        total_area = sum(z.area for z in roof_zones)
        
        self._add_paragraph(f"**总分区数**: {len(roof_zones)} 个")
        self._add_paragraph(f"**总组件数**: {total_modules} 块")
        self._add_paragraph(f"**总面积**: {total_area:.2f} m²")
        
        headers = ["分区ID", "面积(m²)", "倾角(°)", "方位角(°)", "组件数", "遮挡特性", "备注"]
        rows = []
        for zone in roof_zones:
            rows.append([
                zone.zone_id,
                f"{zone.area:.1f}",
                f"{zone.tilt:.1f}",
                f"{zone.azimuth:.1f}",
                zone.module_count,
                zone.shading_profile,
                zone.notes or "-"
            ])
        self._add_table(headers, rows)
    
    def _add_environment_info(self, environment_params: Dict):
        """添加环境参数信息"""
        self._add_header("环境参数设置", level=2)
        
        min_temp = environment_params.get('min_temp', -10.0)
        max_temp = environment_params.get('max_temp', 60.0)
        irradiance = environment_params.get('reference_irradiance', 1000.0)
        
        headers = ["参数", "值"]
        rows = [
            ["最低环境温度", f"{min_temp} °C"],
            ["最高环境温度", f"{max_temp} °C"],
            ["参考辐照度", f"{irradiance} W/m²"],
        ]
        self._add_table(headers, rows)
    
    def _add_solutions_comparison(self, solutions: List[ConfigurationSolution]):
        """添加方案对比"""
        self._add_header("串并联方案对比", level=2)
        
        sorted_solutions = sorted(
            solutions,
            key=lambda s: s.score.total_score,
            reverse=True
        )
        
        self._add_paragraph(f"共生成 {len(solutions)} 个候选方案，按综合评分排序如下：")
        
        headers = [
            "排名", "方案名称", "类型", "每串组件", "并联路数",
            "总功率(kW)", "工作电压(V)", "电压范围", "遮挡损失(%)", "线缆损失(%)", "综合评分"
        ]
        rows = []
        for rank, sol in enumerate(sorted_solutions, 1):
            type_label = {
                SolutionType.MIN_SERIES: "最小串联",
                SolutionType.OPTIMAL: "最优串联",
                SolutionType.MAX_SERIES: "最大串联"
            }.get(sol.solution_type, "自定义")
            
            voltage_status = "✓ 范围内" if sol.voltage_in_mppt_range else "⚠ 超限"
            
            rows.append([
                rank,
                sol.name,
                type_label,
                sol.modules_per_string,
                sol.strings_in_parallel,
                f"{sol.estimated_total_power/1000:.2f}",
                f"{sol.estimated_v_mp:.1f}",
                voltage_status,
                f"{sol.estimated_shading_loss_percent:.1f}",
                f"{sol.estimated_cable_loss_percent:.1f}",
                f"{sol.score.total_score:.1f}"
            ])
        self._add_table(headers, rows)
        
        for i, sol in enumerate(sorted_solutions, 1):
            self._add_header(f"方案 {i}: {sol.name}", level=3)
            self._add_paragraph(sol.notes)
            
            score_headers = ["评分维度", "得分"]
            score_rows = [
                ["综合评分", f"{sol.score.total_score:.1f}"],
                ["效率评分", f"{sol.score.efficiency_score:.1f}"],
                ["成本评分", f"{sol.score.cost_score:.1f}"],
                ["风险评分", f"{sol.score.risk_score:.1f}"],
                ["电压匹配评分", f"{sol.score.voltage_match_score:.1f}"],
            ]
            self._add_table(score_headers, score_rows)
            
            detail_headers = ["参数", "值"]
            detail_rows = [
                ["每串组件数", sol.modules_per_string],
                ["并联路数", sol.strings_in_parallel],
                ["总组件数", sol.total_modules],
                ["低温开路电压", f"{sol.estimated_voc_low_temp:.1f} V"],
                ["高温开路电压", f"{sol.estimated_voc_high_temp:.1f} V"],
                ["工作电压 Vmp", f"{sol.estimated_v_mp:.1f} V"],
                ["工作电流 Imp", f"{sol.estimated_i_mp:.2f} A"],
                ["估算总功率", f"{sol.estimated_total_power:.0f} W ({sol.estimated_total_power/1000:.2f} kW)"],
                ["MPPT电压范围", "✓ 工作电压在MPPT范围内" if sol.voltage_in_mppt_range else "⚠ 工作电压可能超出MPPT范围"],
            ]
            self._add_table(detail_headers, detail_rows)
    
    def _add_risks_section(self, risks: List[RiskItem]):
        """添加风险评估"""
        self._add_header("风险评估", level=2)
        
        if not risks:
            self._add_paragraph("✅ 未检测到显著风险项。")
            return
        
        critical_risks = [r for r in risks if r.severity == 'critical']
        high_risks = [r for r in risks if r.severity == 'high']
        medium_risks = [r for r in risks if r.severity == 'medium']
        low_risks = [r for r in risks if r.severity == 'low']
        
        self._add_paragraph(f"**风险统计**:")
        risk_summary = [
            f"🔴 严重风险: {len(critical_risks)} 项",
            f"🟠 高风险: {len(high_risks)} 项",
            f"🟡 中等风险: {len(medium_risks)} 项",
            f"🟢 低风险: {len(low_risks)} 项",
        ]
        self._add_list(risk_summary)
        
        all_risks = critical_risks + high_risks + medium_risks + low_risks
        
        if all_risks:
            headers = ["等级", "风险项", "描述", "风险评分", "建议措施"]
            rows = []
            
            severity_labels = {
                'critical': "🔴 严重",
                'high': "🟠 高",
                'medium': "🟡 中等",
                'low': "🟢 低"
            }
            
            for risk in all_risks:
                severity_label = severity_labels.get(risk.severity, risk.severity)
                affected = ", ".join(risk.affected_components) if risk.affected_components else "-"
                
                rows.append([
                    severity_label,
                    risk.rule_name,
                    risk.message,
                    f"{risk.risk_score:.1f}",
                    risk.suggested_action
                ])
            self._add_table(headers, rows)
        
        if critical_risks or high_risks:
            self._add_header("⚠ 关键建议", level=3)
            suggestions = []
            for risk in critical_risks + high_risks:
                suggestions.append(f"**{risk.rule_name}**: {risk.suggested_action}")
            self._add_list(suggestions)
    
    def _add_footer(self):
        """添加页脚"""
        self._add_paragraph("---")
        self._add_paragraph("*报告由屋顶光伏串线校核器自动生成*")
        self._add_paragraph(f"*版本: 1.0.0*")
    
    def get_content(self) -> str:
        """获取生成的报告内容"""
        return "\n".join(self._report_content)


class CSVExporter:
    """CSV格式报告导出器"""
    
    def export(
        self,
        solutions: List[ConfigurationSolution],
        module: Optional[PVModule] = None,
        inverter: Optional[InverterMPPT] = None,
        roof_zones: Optional[List[RoofZone]] = None,
        risks: Optional[List[RiskItem]] = None,
        output_path: Optional[Union[str, Path]] = None,
        sheet_name: str = "analysis"
    ) -> ExportResult:
        """导出CSV报告
        
        生成多个CSV文件：
        - solutions.csv: 方案对比
        - risks.csv: 风险评估
        - module_params.csv: 组件参数
        - roof_zones.csv: 屋面分区
        """
        if output_path:
            output_path = Path(output_path)
            if output_path.suffix:
                base_dir = output_path.parent
                base_name = output_path.stem
            else:
                base_dir = output_path
                base_name = "pv_analysis"
            
            try:
                base_dir.mkdir(parents=True, exist_ok=True)
                
                files_created = []
                
                if solutions:
                    solutions_path = base_dir / f"{base_name}_solutions.csv"
                    self._export_solutions(solutions, solutions_path)
                    files_created.append(str(solutions_path))
                
                if risks:
                    risks_path = base_dir / f"{base_name}_risks.csv"
                    self._export_risks(risks, risks_path)
                    files_created.append(str(risks_path))
                
                if module:
                    module_path = base_dir / f"{base_name}_module.csv"
                    self._export_module(module, module_path)
                    files_created.append(str(module_path))
                
                if roof_zones:
                    zones_path = base_dir / f"{base_name}_roof_zones.csv"
                    self._export_roof_zones(roof_zones, zones_path)
                    files_created.append(str(zones_path))
                
                return ExportResult(
                    success=True,
                    format="csv",
                    output_path=str(base_dir),
                    message=f"已导出 {len(files_created)} 个CSV文件到: {base_dir}",
                    file_size=sum(Path(f).stat().st_size for f in files_created if Path(f).exists())
                )
                
            except Exception as e:
                return ExportResult(
                    success=False,
                    format="csv",
                    output_path=str(base_dir) if 'base_dir' in locals() else None,
                    message=f"导出失败: {e}"
                )
        
        return ExportResult(
            success=True,
            format="csv",
            message="CSV导出需要指定输出路径"
        )
    
    def _export_solutions(self, solutions: List[ConfigurationSolution], filepath: Path):
        """导出方案对比"""
        sorted_solutions = sorted(
            solutions,
            key=lambda s: s.score.total_score,
            reverse=True
        )
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                "排名", "方案名称", "方案类型", "每串组件数", "并联路数", "总组件数",
                "估算总功率(W)", "低温开路电压(V)", "高温开路电压(V)", "工作电压(V)",
                "工作电流(A)", "MPPT范围内", "遮挡损失(%)", "线缆损失(%)",
                "综合评分", "效率评分", "成本评分", "风险评分", "电压匹配评分", "备注"
            ])
            
            for rank, sol in enumerate(sorted_solutions, 1):
                type_label = {
                    SolutionType.MIN_SERIES: "最小串联",
                    SolutionType.OPTIMAL: "最优串联",
                    SolutionType.MAX_SERIES: "最大串联"
                }.get(sol.solution_type, "自定义")
                
                writer.writerow([
                    rank, sol.name, type_label, sol.modules_per_string, sol.strings_in_parallel,
                    sol.total_modules, sol.estimated_total_power, sol.estimated_voc_low_temp,
                    sol.estimated_voc_high_temp, sol.estimated_v_mp, sol.estimated_i_mp,
                    "是" if sol.voltage_in_mppt_range else "否",
                    sol.estimated_shading_loss_percent, sol.estimated_cable_loss_percent,
                    sol.score.total_score, sol.score.efficiency_score, sol.score.cost_score,
                    sol.score.risk_score, sol.score.voltage_match_score, sol.notes
                ])
    
    def _export_risks(self, risks: List[RiskItem], filepath: Path):
        """导出风险评估"""
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                "风险等级", "风险项名称", "描述", "受影响组件", "风险评分", "建议措施"
            ])
            
            severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
            sorted_risks = sorted(risks, key=lambda r: severity_order.get(r.severity, 999))
            
            for risk in sorted_risks:
                affected = "; ".join(risk.affected_components) if risk.affected_components else ""
                
                writer.writerow([
                    risk.severity, risk.rule_name, risk.message, affected,
                    risk.risk_score, risk.suggested_action
                ])
    
    def _export_module(self, module: PVModule, filepath: Path):
        """导出组件参数"""
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow(["参数名称", "参数值", "单位"])
            
            writer.writerow(["型号", module.model, ""])
            writer.writerow(["最大功率 Pmax", module.p_max, "W"])
            writer.writerow(["最大功率点电压 Vmp", module.v_mp, "V"])
            writer.writerow(["最大功率点电流 Imp", module.i_mp, "A"])
            writer.writerow(["开路电压 Voc", module.voc, "V"])
            writer.writerow(["短路电流 Isc", module.isc, "A"])
            writer.writerow(["开路电压温度系数 β", module.temp_coeff_voc, "%/°C"])
            writer.writerow(["短路电流温度系数 α", module.temp_coeff_isc, "%/°C"])
            writer.writerow(["最大功率温度系数 γ", module.temp_coeff_pmax, "%/°C"])
            writer.writerow(["标称工作温度 NOCT", module.noct, "°C"])
            writer.writerow(["组件面积", module.area, "m²"])
            writer.writerow(["组件效率", module.efficiency * 100, "%"])
    
    def _export_roof_zones(self, roof_zones: List[RoofZone], filepath: Path):
        """导出屋面分区"""
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                "分区ID", "面积(m²)", "倾角(°)", "方位角(°)", "组件数量", "遮挡特性", "备注"
            ])
            
            for zone in roof_zones:
                writer.writerow([
                    zone.zone_id, zone.area, zone.tilt, zone.azimuth,
                    zone.module_count, zone.shading_profile, zone.notes
                ])


class JSONExporter:
    """JSON格式报告导出器"""
    
    def export(
        self,
        solutions: List[ConfigurationSolution],
        module: Optional[PVModule] = None,
        inverter: Optional[InverterMPPT] = None,
        roof_zones: Optional[List[RoofZone]] = None,
        risks: Optional[List[RiskItem]] = None,
        shading_matrix: Optional[List[List[float]]] = None,
        environment_params: Optional[Dict] = None,
        output_path: Optional[Union[str, Path]] = None,
        indent: int = 2
    ) -> ExportResult:
        """导出JSON报告
        
        Args:
            solutions: 方案列表
            module: 组件参数
            inverter: 逆变器参数
            roof_zones: 屋面分区
            risks: 风险列表
            shading_matrix: 遮挡系数矩阵
            environment_params: 环境参数
            output_path: 输出文件路径
            indent: 缩进空格数
            
        Returns:
            ExportResult对象
        """
        export_data = {
            'metadata': {
                'generated_at': datetime.now().isoformat(),
                'version': '1.0.0',
                'tool': '屋顶光伏串线校核器'
            }
        }
        
        if module:
            export_data['module_params'] = asdict(module)
        
        if inverter:
            export_data['inverter_params'] = asdict(inverter)
        
        if roof_zones:
            export_data['roof_zones'] = [asdict(z) for z in roof_zones]
            export_data['summary'] = {
                'total_zones': len(roof_zones),
                'total_modules': sum(z.module_count for z in roof_zones),
                'total_area': sum(z.area for z in roof_zones)
            }
        
        if environment_params:
            export_data['environment_params'] = environment_params
        
        if solutions:
            sorted_solutions = sorted(
                solutions,
                key=lambda s: s.score.total_score,
                reverse=True
            )
            export_data['solutions'] = []
            for rank, sol in enumerate(sorted_solutions, 1):
                sol_dict = asdict(sol)
                sol_dict['rank'] = rank
                if 'solution_type' in sol_dict:
                    sol_dict['solution_type'] = sol_dict['solution_type'].value
                export_data['solutions'].append(sol_dict)
            
            export_data['recommended_solution'] = export_data['solutions'][0] if export_data['solutions'] else None
        
        if risks:
            severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
            sorted_risks = sorted(risks, key=lambda r: severity_order.get(r.severity, 999))
            
            export_data['risks'] = [asdict(r) for r in sorted_risks]
            export_data['risk_summary'] = {
                'total': len(risks),
                'critical': len([r for r in risks if r.severity == 'critical']),
                'high': len([r for r in risks if r.severity == 'high']),
                'medium': len([r for r in risks if r.severity == 'medium']),
                'low': len([r for r in risks if r.severity == 'low'])
            }
        
        if shading_matrix:
            export_data['shading_matrix'] = shading_matrix
        
        if output_path:
            try:
                output_path = Path(output_path)
                output_path.parent.mkdir(parents=True, exist_ok=True)
                
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(
                        export_data,
                        f,
                        ensure_ascii=False,
                        indent=indent,
                        default=str
                    )
                
                file_size = output_path.stat().st_size
                
                return ExportResult(
                    success=True,
                    format="json",
                    output_path=str(output_path),
                    message=f"JSON报告已成功导出到: {output_path}",
                    file_size=file_size
                )
                
            except Exception as e:
                return ExportResult(
                    success=False,
                    format="json",
                    output_path=str(output_path) if output_path else None,
                    message=f"导出失败: {e}"
                )
        
        return ExportResult(
            success=True,
            format="json",
            message="JSON数据已生成（未保存到文件）"
        )


class ReportExporter:
    """统一报告导出接口"""
    
    def __init__(self):
        self._md_exporter = MarkdownExporter()
        self._csv_exporter = CSVExporter()
        self._json_exporter = JSONExporter()
    
    def export(
        self,
        format: Union[str, ExportFormat],
        output_path: Union[str, Path],
        solutions: List[ConfigurationSolution],
        module: Optional[PVModule] = None,
        inverter: Optional[InverterMPPT] = None,
        roof_zones: Optional[List[RoofZone]] = None,
        risks: Optional[List[RiskItem]] = None,
        shading_matrix: Optional[List[List[float]]] = None,
        environment_params: Optional[Dict] = None,
        **kwargs
    ) -> ExportResult:
        """导出报告
        
        Args:
            format: 导出格式 ('markdown', 'csv', 'json' 或 ExportFormat枚举)
            output_path: 输出路径
            solutions: 方案列表
            module: 组件参数
            inverter: 逆变器参数
            roof_zones: 屋面分区
            risks: 风险列表
            shading_matrix: 遮挡系数矩阵
            environment_params: 环境参数
            **kwargs: 其他参数传递给具体导出器
            
        Returns:
            ExportResult对象
        """
        if isinstance(format, str):
            format = format.lower()
            if format in ['md', 'markdown']:
                format_enum = ExportFormat.MARKDOWN
            elif format == 'csv':
                format_enum = ExportFormat.CSV
            elif format == 'json':
                format_enum = ExportFormat.JSON
            else:
                return ExportResult(
                    success=False,
                    format=format,
                    message=f"不支持的导出格式: {format}，支持: markdown, csv, json"
                )
        else:
            format_enum = format
        
        if format_enum == ExportFormat.MARKDOWN:
            return self._md_exporter.export(
                solutions=solutions,
                module=module,
                inverter=inverter,
                roof_zones=roof_zones,
                risks=risks,
                shading_matrix=shading_matrix,
                environment_params=environment_params,
                output_path=output_path,
                **kwargs
            )
        
        elif format_enum == ExportFormat.CSV:
            return self._csv_exporter.export(
                solutions=solutions,
                module=module,
                inverter=inverter,
                roof_zones=roof_zones,
                risks=risks,
                output_path=output_path,
                **kwargs
            )
        
        elif format_enum == ExportFormat.JSON:
            return self._json_exporter.export(
                solutions=solutions,
                module=module,
                inverter=inverter,
                roof_zones=roof_zones,
                risks=risks,
                shading_matrix=shading_matrix,
                environment_params=environment_params,
                output_path=output_path,
                **kwargs
            )
        
        return ExportResult(
            success=False,
            format=str(format_enum),
            message="未知的导出格式"
        )
    
    def export_all(
        self,
        output_dir: Union[str, Path],
        base_name: str = "pv_analysis",
        solutions: List[ConfigurationSolution] = None,
        module: Optional[PVModule] = None,
        inverter: Optional[InverterMPPT] = None,
        roof_zones: Optional[List[RoofZone]] = None,
        risks: Optional[List[RiskItem]] = None,
        shading_matrix: Optional[List[List[float]]] = None,
        environment_params: Optional[Dict] = None
    ) -> Dict[str, ExportResult]:
        """导出所有格式的报告
        
        Args:
            output_dir: 输出目录
            base_name: 文件名基础
            solutions: 方案列表
            module: 组件参数
            inverter: 逆变器参数
            roof_zones: 屋面分区
            risks: 风险列表
            shading_matrix: 遮挡系数矩阵
            environment_params: 环境参数
            
        Returns:
            格式到ExportResult的映射
        """
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        results = {}
        
        md_path = output_dir / f"{base_name}.md"
        results['markdown'] = self.export(
            format='markdown',
            output_path=md_path,
            solutions=solutions or [],
            module=module,
            inverter=inverter,
            roof_zones=roof_zones,
            risks=risks,
            shading_matrix=shading_matrix,
            environment_params=environment_params
        )
        
        results['csv'] = self.export(
            format='csv',
            output_path=output_dir,
            solutions=solutions or [],
            module=module,
            inverter=inverter,
            roof_zones=roof_zones,
            risks=risks
        )
        
        json_path = output_dir / f"{base_name}.json"
        results['json'] = self.export(
            format='json',
            output_path=json_path,
            solutions=solutions or [],
            module=module,
            inverter=inverter,
            roof_zones=roof_zones,
            risks=risks,
            shading_matrix=shading_matrix,
            environment_params=environment_params
        )
        
        return results
