"""Markdown报告导出器"""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

from ..core.fluidics import SimulationResult, TimeSegmentResult
from ..core.units import convert
from ..core.rules import RuleEvaluationResult, RuleViolation, RuleSeverity
from ..validators.topology_validator import ValidationResult


class MarkdownExporter:
    """Markdown报告导出器"""
    
    def __init__(self):
        self.report_sections: List[str] = []
    
    def add_header(self, title: str, level: int = 1) -> "MarkdownExporter":
        """添加标题"""
        prefix = "#" * level
        self.report_sections.append(f"{prefix} {title}\n")
        return self
    
    def add_paragraph(self, text: str) -> "MarkdownExporter":
        """添加段落"""
        self.report_sections.append(f"{text}\n")
        return self
    
    def add_table(self, headers: List[str], rows: List[List[Any]]) -> "MarkdownExporter":
        """添加表格"""
        if not headers:
            return self
        
        # 表头
        header_line = "| " + " | ".join(str(h) for h in headers) + " |"
        self.report_sections.append(header_line)
        
        # 分隔线
        separator = "| " + " | ".join(["---"] * len(headers)) + " |"
        self.report_sections.append(separator)
        
        # 数据行
        for row in rows:
            row_line = "| " + " | ".join(str(cell) for cell in row) + " |"
            self.report_sections.append(row_line)
        
        self.report_sections.append("")
        return self
    
    def add_list(self, items: List[str], ordered: bool = False) -> "MarkdownExporter":
        """添加列表"""
        for i, item in enumerate(items):
            if ordered:
                self.report_sections.append(f"{i + 1}. {item}")
            else:
                self.report_sections.append(f"- {item}")
        self.report_sections.append("")
        return self
    
    def add_code_block(self, code: str, language: str = "") -> "MarkdownExporter":
        """添加代码块"""
        self.report_sections.append(f"```{language}")
        self.report_sections.append(code)
        self.report_sections.append("```")
        self.report_sections.append("")
        return self
    
    def add_horizontal_rule(self) -> "MarkdownExporter":
        """添加分隔线"""
        self.report_sections.append("---\n")
        return self
    
    def generate_report(
        self,
        simulation_result: SimulationResult,
        rule_results: List[RuleEvaluationResult],
        validation_result: Optional[ValidationResult] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        生成完整的Markdown报告
        
        Args:
            simulation_result: 仿真结果
            rule_results: 规则评估结果
            validation_result: 校验结果（可选）
            metadata: 元数据
        
        Returns:
            Markdown格式的报告字符串
        """
        self.report_sections = []
        
        # 标题
        self.add_header("流量配平小助手 - 仿真分析报告", 1)
        
        # 生成时间
        generate_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.add_paragraph(f"**生成时间**: {generate_time}")
        
        if metadata:
            if "chip_name" in metadata:
                self.add_paragraph(f"**芯片名称**: {metadata['chip_name']}")
            if "version" in metadata:
                self.add_paragraph(f"**版本**: {metadata['version']}")
        
        self.add_horizontal_rule()
        
        # 执行摘要
        self.add_header("执行摘要", 2)
        
        # 汇总统计
        summary_rows = []
        total_time_min = simulation_result.total_time / 60.0
        summary_rows.append(["总仿真时间", f"{simulation_result.total_time:.1f} 秒 ({total_time_min:.2f} 分钟)"])
        
        max_p_bar = convert(simulation_result.max_pressure_drop, "Pa", "bar", "pressure")
        summary_rows.append(["最大压降", f"{max_p_bar:.4f} bar ({simulation_result.max_pressure_drop:.2e} Pa)"])
        
        summary_rows.append(["最大比例偏差", f"{simulation_result.max_relative_deviation:.2f}%"])
        
        total_dead_ul = convert(simulation_result.total_dead_volume, "m3", "uL", "volume")
        summary_rows.append(["系统死体积", f"{total_dead_ul:.4f} μL"])
        
        # 风险数量
        all_violations: List[RuleViolation] = []
        for rr in rule_results:
            all_violations.extend(rr.violations)
        
        critical_count = sum(1 for v in all_violations if v.severity == RuleSeverity.CRITICAL)
        high_count = sum(1 for v in all_violations if v.severity == RuleSeverity.HIGH)
        medium_count = sum(1 for v in all_violations if v.severity == RuleSeverity.MEDIUM)
        low_count = sum(1 for v in all_violations if v.severity == RuleSeverity.LOW)
        
        summary_rows.append(["严重风险", f"{critical_count} 个"])
        summary_rows.append(["高风险", f"{high_count} 个"])
        summary_rows.append(["中风险", f"{medium_count} 个"])
        summary_rows.append(["低风险", f"{low_count} 个"])
        
        self.add_table(["指标", "数值"], summary_rows)
        
        # 总体状态
        if critical_count > 0 or high_count > 0:
            self.add_paragraph("⚠️ **状态**: 检测到高风险问题，建议在实验前修复")
        elif medium_count > 0:
            self.add_paragraph("⚠️ **状态**: 检测到中等风险问题，建议注意")
        else:
            self.add_paragraph("✅ **状态**: 未检测到明显风险，可以进行实验")
        
        self.add_horizontal_rule()
        
        # 风险详情
        if all_violations:
            self.add_header("风险详情", 2)
            
            # 按严重程度排序
            severity_order = {
                RuleSeverity.CRITICAL: 0,
                RuleSeverity.HIGH: 1,
                RuleSeverity.MEDIUM: 2,
                RuleSeverity.LOW: 3,
                RuleSeverity.INFO: 4,
            }
            sorted_violations = sorted(all_violations, key=lambda v: severity_order.get(v.severity, 999))
            
            risk_rows = []
            for v in sorted_violations:
                severity_icon = {
                    RuleSeverity.CRITICAL: "🔴",
                    RuleSeverity.HIGH: "🟠",
                    RuleSeverity.MEDIUM: "🟡",
                    RuleSeverity.LOW: "🔵",
                    RuleSeverity.INFO: "ℹ️",
                }.get(v.severity, "❓")
                
                value_str = f"{v.value:.4f} {v.unit}" if v.value is not None else "N/A"
                risk_rows.append([
                    severity_icon,
                    v.rule_name,
                    v.message,
                    value_str,
                    v.location or "N/A",
                ])
            
            self.add_table(["严重程度", "规则", "描述", "数值", "位置"], risk_rows)
            
            # 详细修复建议
            if any(v.suggestion for v in sorted_violations):
                self.add_header("修复建议", 3)
                suggestions = []
                for v in sorted_violations:
                    if v.suggestion:
                        suggestions.append(f"**{v.rule_name}**: {v.suggestion}")
                self.add_list(suggestions)
            
            self.add_horizontal_rule()
        
        # 时间段详情
        self.add_header("时间段详情", 2)
        
        for seg_idx, segment in enumerate(simulation_result.time_segments):
            self.add_header(f"时间段 {seg_idx + 1}: {segment.time_start:.1f}s - {segment.time_end:.1f}s", 3)
            
            # 流量信息
            if segment.inlet_flow_rates:
                self.add_paragraph("**入口流量**:")
                flow_rows = []
                for inlet_id, flow_m3s in segment.inlet_flow_rates.items():
                    flow_ul_min = convert(flow_m3s, "m3/s", "μL/min", "flow_rate")
                    flow_rows.append([inlet_id, f"{flow_ul_min:.4f} μL/min", f"{flow_m3s:.2e} m³/s"])
                self.add_table(["入口", "流量 (μL/min)", "流量 (m³/s)"], flow_rows)
            
            # 混合比例
            if segment.mixing_ratios:
                self.add_paragraph("**混合比例**:")
                ratio_rows = []
                for ratio in segment.mixing_ratios:
                    ratio_rows.append([
                        ratio.reagent_name,
                        f"{ratio.target_ratio:.1%}",
                        f"{ratio.actual_ratio:.1%}",
                        f"{ratio.deviation:+.2%}",
                        f"{ratio.relative_deviation:+.2f}%",
                    ])
                self.add_table(
                    ["试剂", "目标比例", "实际比例", "绝对偏差", "相对偏差"],
                    ratio_rows
                )
            
            # 通道压降
            if segment.channel_pressure_drops:
                self.add_paragraph("**通道压降**:")
                pressure_rows = []
                for ch_id, p_drop in segment.channel_pressure_drops.items():
                    p_drop_bar = convert(p_drop, "Pa", "bar", "pressure")
                    pressure_rows.append([ch_id, f"{p_drop_bar:.6f} bar", f"{p_drop:.2e} Pa"])
                self.add_table(["通道", "压降 (bar)", "压降 (Pa)"], pressure_rows)
        
        self.add_horizontal_rule()
        
        # 校验结果（如果有）
        if validation_result and validation_result.issues:
            self.add_header("数据校验结果", 2)
            
            if validation_result.errors:
                self.add_paragraph(f"❌ **错误**: {len(validation_result.errors)} 个")
                error_rows = []
                for e in validation_result.errors:
                    error_rows.append([e.code, e.message, e.location or "N/A"])
                self.add_table(["错误码", "描述", "位置"], error_rows)
            
            if validation_result.warnings:
                self.add_paragraph(f"⚠️ **警告**: {len(validation_result.warnings)} 个")
                warn_rows = []
                for w in validation_result.warnings:
                    warn_rows.append([w.code, w.message, w.location or "N/A"])
                self.add_table(["警告码", "描述", "位置"], warn_rows)
        
        self.add_horizontal_rule()
        
        # 附录
        self.add_header("附录", 2)
        
        self.add_paragraph("**单位说明**:")
        unit_info = [
            "流量: μL/min (微升/分钟), m³/s (立方米/秒)",
            "压力: Pa (帕斯卡), bar (巴)",
            "体积: μL (微升), m³ (立方米)",
            "时间: s (秒), min (分钟)",
            "黏度: mPa·s (毫帕秒), cP (厘泊)",
        ]
        self.add_list(unit_info)
        
        self.add_paragraph("**规则说明**:")
        rule_info = [
            "🔴 Critical (严重): 必须修复，否则实验可能失败",
            "🟠 High (高): 强烈建议修复",
            "🟡 Medium (中): 建议注意，可能影响结果",
            "🔵 Low (低): 轻微问题，建议优化",
            "ℹ️ Info (信息): 仅供参考",
        ]
        self.add_list(rule_info)
        
        return "\n".join(self.report_sections)
    
    def export(
        self,
        output_path: str,
        simulation_result: SimulationResult,
        rule_results: List[RuleEvaluationResult],
        validation_result: Optional[ValidationResult] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        导出Markdown报告到文件
        
        Args:
            output_path: 输出文件路径
            simulation_result: 仿真结果
            rule_results: 规则评估结果
            validation_result: 校验结果
            metadata: 元数据
        
        Returns:
            输出文件路径
        """
        report = self.generate_report(
            simulation_result=simulation_result,
            rule_results=rule_results,
            validation_result=validation_result,
            metadata=metadata,
        )
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(report)
        
        return str(path)
