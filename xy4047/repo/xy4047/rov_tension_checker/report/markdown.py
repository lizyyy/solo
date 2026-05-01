"""Markdown 报告导出模块"""

from datetime import datetime
from pathlib import Path
from typing import List, Optional

from rov_tension_checker.storage.models import AnalysisRecord, AnalysisSampleRecord
from rov_tension_checker.analysis.risk_engine import RiskSeverity, RiskType


class MarkdownReporter:
    def __init__(self):
        self.severity_icons = {
            RiskSeverity.CRITICAL: "🔴",
            RiskSeverity.WARNING: "🟡",
            RiskSeverity.LOW: "🟢"
        }
        
        self.risk_type_names = {
            RiskType.TENSION_EXCEEDED: "张力超限",
            RiskType.TENSION_WARNING: "张力预警",
            RiskType.BENDING_RADIUS_VIOLATION: "弯曲半径违规",
            RiskType.BENDING_RADIUS_WARNING: "弯曲半径预警",
            RiskType.INSUFFICIENT_CABLE: "放缆不足",
            RiskType.ANGLE_ABRUPT_CHANGE: "角度突变",
            RiskType.CURRENT_ABRUPT_CHANGE: "海流突变",
            RiskType.COLLISION_RISK: "擦碰风险",
            RiskType.SLACK_CABLE: "缆线松弛"
        }
    
    def generate_report(self, record: AnalysisRecord) -> str:
        lines: List[str] = []
        
        lines.append(self._generate_header(record))
        lines.append("")
        
        lines.append(self._generate_summary(record))
        lines.append("")
        
        lines.append(self._generate_statistics(record))
        lines.append("")
        
        lines.append(self._generate_risks_section(record))
        lines.append("")
        
        lines.append(self._generate_samples_section(record))
        lines.append("")
        
        lines.append(self._generate_footer())
        
        return "\n".join(lines)
    
    def _generate_header(self, record: AnalysisRecord) -> str:
        lines = [
            "# ROV 放缆张力校核报告",
            "",
            f"**项目名称**: {record.project_name}",
            f"**管线编号**: {record.pipeline_id}",
            f"**作业日期**: {record.survey_date.strftime('%Y-%m-%d')}",
            f"**分析时间**: {record.created_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"**分析ID**: {record.analysis_id}",
        ]
        return "\n".join(lines)
    
    def _generate_summary(self, record: AnalysisRecord) -> str:
        lines = [
            "## 风险概览",
            "",
        ]
        
        if record.critical_risk_count > 0:
            lines.append(f"🔴 **关键风险**: {record.critical_risk_count} 处")
        if record.warning_risk_count > 0:
            lines.append(f"🟡 **预警风险**: {record.warning_risk_count} 处")
        
        if record.critical_risk_count == 0 and record.warning_risk_count == 0:
            lines.append("✅ 本批次数据未检测到风险")
        
        if record.risk_summary:
            lines.append("")
            lines.append("### 风险类型统计")
            lines.append("")
            lines.append("| 风险类型 | 数量 |")
            lines.append("|----------|------|")
            for risk_type, count in record.risk_summary.items():
                type_name = self._get_risk_type_name(risk_type)
                lines.append(f"| {type_name} | {count} |")
        
        return "\n".join(lines)
    
    def _get_risk_type_name(self, risk_type: str) -> str:
        try:
            rt = RiskType(risk_type)
            return self.risk_type_names.get(rt, risk_type)
        except ValueError:
            return risk_type
    
    def _generate_statistics(self, record: AnalysisRecord) -> str:
        lines = [
            "## 数据统计",
            "",
            "### 采样情况",
            "",
            f"- 总采样点数: {record.sample_count}",
        ]
        
        lines.append("")
        lines.append("### 缆线张力")
        if record.max_top_tension is not None:
            lines.append(f"- 最大顶端张力: {record.max_top_tension:.1f} N")
        if record.min_top_tension is not None:
            lines.append(f"- 最小顶端张力: {record.min_top_tension:.1f} N")
        if record.avg_top_tension is not None:
            lines.append(f"- 平均顶端张力: {record.avg_top_tension:.1f} N")
        
        lines.append("")
        lines.append("### 弯曲半径")
        if record.min_bending_radius is not None:
            lines.append(f"- 最小弯曲半径: {record.min_bending_radius:.3f} m")
            if record.min_bending_radius_location:
                lines.append(f"- 最小半径位置: {record.min_bending_radius_location}")
        
        lines.append("")
        lines.append("### 放缆长度")
        if record.min_cable_length is not None:
            lines.append(f"- 最小放缆长度: {record.min_cable_length:.1f} m")
        if record.max_cable_length is not None:
            lines.append(f"- 最大放缆长度: {record.max_cable_length:.1f} m")
        if record.avg_cable_length is not None:
            lines.append(f"- 平均放缆长度: {record.avg_cable_length:.1f} m")
        
        lines.append("")
        lines.append("### 作业深度")
        if record.min_depth is not None:
            lines.append(f"- 最浅深度: {record.min_depth:.1f} m")
        if record.max_depth is not None:
            lines.append(f"- 最深深度: {record.max_depth:.1f} m")
        if record.avg_depth is not None:
            lines.append(f"- 平均深度: {record.avg_depth:.1f} m")
        
        lines.append("")
        lines.append("### 海流情况")
        if record.max_current_speed is not None:
            lines.append(f"- 最大海流速度: {record.max_current_speed:.2f} m/s")
        if record.avg_current_speed is not None:
            lines.append(f"- 平均海流速度: {record.avg_current_speed:.2f} m/s")
        
        lines.append("")
        lines.append("### 水平偏移")
        if record.max_horizontal_offset is not None:
            lines.append(f"- 最大水平偏移: {record.max_horizontal_offset:.1f} m")
        if record.avg_horizontal_offset is not None:
            lines.append(f"- 平均水平偏移: {record.avg_horizontal_offset:.1f} m")
        
        return "\n".join(lines)
    
    def _generate_risks_section(self, record: AnalysisRecord) -> str:
        lines = [
            "## 风险详情",
            "",
        ]
        
        critical_risks = [
            s for s in record.samples
            if any(r.severity == RiskSeverity.CRITICAL for r in s.risks)
        ]
        
        warning_risks = [
            s for s in record.samples
            if any(r.severity == RiskSeverity.WARNING for r in s.risks)
            and not any(r.severity == RiskSeverity.CRITICAL for r in s.risks)
        ]
        
        if critical_risks:
            lines.append("### 🔴 关键风险")
            lines.append("")
            for sample in critical_risks:
                for risk in sample.risks:
                    if risk.severity == RiskSeverity.CRITICAL:
                        lines.append(f"**时间**: {sample.timestamp.strftime('%H:%M:%S')}")
                        lines.append(f"**类型**: {self.risk_type_names.get(risk.risk_type, risk.risk_type.value)}")
                        lines.append(f"**描述**: {risk.description}")
                        lines.append("")
        
        if warning_risks:
            lines.append("### 🟡 预警风险")
            lines.append("")
            for sample in warning_risks[:20]:
                for risk in sample.risks:
                    if risk.severity == RiskSeverity.WARNING:
                        lines.append(f"- [{sample.timestamp.strftime('%H:%M:%S')}] {self.risk_type_names.get(risk.risk_type, risk.risk_type.value)}: {risk.description}")
            
            if len(warning_risks) > 20:
                lines.append(f"\n... 还有 {len(warning_risks) - 20} 处预警风险")
        
        if not critical_risks and not warning_risks:
            lines.append("本次分析未检测到风险。")
        
        return "\n".join(lines)
    
    def _generate_samples_section(self, record: AnalysisRecord) -> str:
        lines = [
            "## 采样数据摘要",
            "",
            "以下为数据的采样点摘要（前10个和后10个）：",
            "",
            "| 序号 | 时间 | 深度(m) | 放缆长度(m) | 水平偏移(m) | 顶端张力(N) | 弯曲半径(m) | 风险 |",
            "|------|------|---------|-------------|-------------|-------------|-------------|------|",
        ]
        
        display_samples = record.samples[:10] + record.samples[-10:] if len(record.samples) > 20 else record.samples
        
        for sample in display_samples:
            risk_markers = []
            for risk in sample.risks:
                icon = self.severity_icons.get(risk.severity, "")
                risk_markers.append(icon)
            
            risk_str = "".join(risk_markers) if risk_markers else "-"
            
            lines.append(
                f"| {sample.sample_index + 1} "
                f"| {sample.timestamp.strftime('%H:%M:%S')} "
                f"| {sample.rov_depth:.1f if sample.rov_depth else '-'} "
                f"| {sample.rov_cable_length:.1f if sample.rov_cable_length else '-'} "
                f"| {sample.horizontal_offset:.1f if sample.horizontal_offset else '-'} "
                f"| {sample.top_tension:.0f if sample.top_tension else '-'} "
                f"| {sample.minimum_bending_radius:.3f if sample.minimum_bending_radius else '-'} "
                f"| {risk_str} |"
            )
        
        if len(record.samples) > 20:
            lines.append(f"\n... 中间 {len(record.samples) - 20} 个采样点已省略")
        
        return "\n".join(lines)
    
    def _generate_footer(self) -> str:
        lines = [
            "---",
            "",
            "**报告生成工具**: ROV 放缆张力校核器",
            f"**报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        ]
        return "\n".join(lines)
    
    def save_report(self, record: AnalysisRecord, output_path: str) -> str:
        content = self.generate_report(record)
        
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return str(path)
