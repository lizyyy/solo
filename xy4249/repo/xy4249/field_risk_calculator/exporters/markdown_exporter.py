from typing import List, Dict, Any
from datetime import datetime

from ..risk.models import RiskAssessment, RiskLevel, RiskCategory
from ..terrain.calculator import RouteSegment, RouteStatistics
from ..parsers.weight_parser import TeamMember


class MarkdownExporter:
    def __init__(self):
        pass

    def export(self, assessment: RiskAssessment, segments: List[RouteSegment], 
               stats: RouteStatistics, team_members: List[TeamMember]) -> str:
        md_content = []
        
        md_content.append(f"# 野外踏勘风险评估报告")
        md_content.append(f"")
        md_content.append(f"**生成时间**: {assessment.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        md_content.append(f"**评估ID**: {assessment.assessment_id}")
        md_content.append(f"")

        md_content.append(f"## 总体风险等级")
        md_content.append(f"")
        md_content.append(self._render_risk_level(assessment.overall_risk_level))
        md_content.append(f"")

        md_content.append(f"### 风险统计")
        md_content.append(f"")
        md_content.append(f"| 风险等级 | 数量 |")
        md_content.append(f"|----------|------|")
        for level, count in assessment.risk_count_by_level.items():
            md_content.append(f"| {level.value} | {count} |")
        md_content.append(f"")

        md_content.append(f"| 风险类别 | 数量 |")
        md_content.append(f"|----------|------|")
        for category, count in assessment.risk_count_by_category.items():
            md_content.append(f"| {category.value} | {count} |")
        md_content.append(f"")

        md_content.append(f"## 路线统计")
        md_content.append(f"")
        md_content.append(f"| 指标 | 值 |")
        md_content.append(f"|------|-----|")
        md_content.append(f"| 路线总长 | {stats.total_distance_2d/1000:.2f} km |")
        md_content.append(f"| 3D距离 | {stats.total_distance_3d/1000:.2f} km |")
        md_content.append(f"| 累计爬升 | {stats.total_elevation_gain:.0f} m |")
        md_content.append(f"| 累计下降 | {stats.total_elevation_loss:.0f} m |")
        md_content.append(f"| 最低海拔 | {stats.min_elevation:.0f} m |")
        md_content.append(f"| 最高海拔 | {stats.max_elevation:.0f} m |")
        md_content.append(f"| 最大坡度 | {stats.max_slope_percent:.1f}% |")
        md_content.append(f"| 预计耗时 | {stats.estimated_total_time:.1f} 小时 |")
        md_content.append(f"| 预计耗水 | {stats.estimated_total_water:.1f} 升/人 |")
        md_content.append(f"")

        md_content.append(f"## 队员负重情况")
        md_content.append(f"")
        md_content.append(f"| 姓名 | 角色 | 体重(kg) | 负重(kg) | 建议最大(kg) | 负重比例 | 状态 |")
        md_content.append(f"|------|------|----------|----------|--------------|----------|------|")
        for member in team_members:
            status = "⚠️ 超限" if member.pack_weight > member.max_recommended_weight else "✅ 正常"
            md_content.append(f"| {member.name} | {member.role} | {member.body_weight:.1f} | {member.pack_weight:.1f} | {member.max_recommended_weight:.1f} | {member.weight_ratio:.1f}% | {status} |")
        md_content.append(f"")

        md_content.append(f"## 风险点详情")
        md_content.append(f"")

        critical_risks = [r for r in assessment.risk_points if r.level == RiskLevel.CRITICAL]
        high_risks = [r for r in assessment.risk_points if r.level == RiskLevel.HIGH]
        medium_risks = [r for r in assessment.risk_points if r.level == RiskLevel.MEDIUM]
        low_risks = [r for r in assessment.risk_points if r.level == RiskLevel.LOW]

        if critical_risks:
            md_content.append(f"### 🔴 极高风险 ({len(critical_risks)}个)")
            md_content.append(f"")
            for risk in critical_risks:
                md_content.append(self._render_risk_point(risk))

        if high_risks:
            md_content.append(f"### 🟠 高风险 ({len(high_risks)}个)")
            md_content.append(f"")
            for risk in high_risks:
                md_content.append(self._render_risk_point(risk))

        if medium_risks:
            md_content.append(f"### 🟡 中风险 ({len(medium_risks)}个)")
            md_content.append(f"")
            for risk in medium_risks:
                md_content.append(self._render_risk_point(risk))

        if low_risks:
            md_content.append(f"### 🟢 低风险 ({len(low_risks)}个)")
            md_content.append(f"")
            for risk in low_risks:
                md_content.append(self._render_risk_point(risk))

        if assessment.retreat_points:
            md_content.append(f"## 撤返点")
            md_content.append(f"")
            md_content.append(f"| 名称 | 距离起点 | 原因 | 风险等级 | 建议 |")
            md_content.append(f"|------|----------|------|----------|------|")
            for rp in assessment.retreat_points:
                name = rp.name or f"撤返点-{rp.point_id}"
                md_content.append(f"| {name} | {rp.distance_from_start/1000:.2f}km | {rp.reason} | {rp.risk_level.value} | {rp.safety_assessment} |")
            md_content.append(f"")

        if assessment.supply_points:
            md_content.append(f"## 补给点")
            md_content.append(f"")
            md_content.append(f"| 名称 | 类型 | 距离上一点 |")
            md_content.append(f"|------|------|------------|")
            for sp in assessment.supply_points:
                ptype = "应急" if sp.is_emergency else "常规"
                md_content.append(f"| {sp.name or sp.point_id} | {ptype} | {sp.distance_from_last/1000:.2f}km |")
            md_content.append(f"")

        md_content.append(f"## 路线分段详情")
        md_content.append(f"")
        md_content.append(f"| 分段 | 距离(m) | 爬升(m) | 下降(m) | 坡度(%) | 坡度等级 | 预计耗时(h) | 预计耗水(L) |")
        md_content.append(f"|------|---------|---------|---------|---------|----------|-------------|-------------|")
        for seg in segments:
            slope_sign = "+" if seg.is_uphill else "-"
            md_content.append(f"| {seg.segment_id+1} | {seg.distance_2d:.0f} | {seg.elevation_gain:.0f} | {seg.elevation_loss:.0f} | {slope_sign}{seg.avg_slope_percent:.1f} | {seg.slope_category} | {seg.estimated_time:.2f} | {seg.water_consumption:.2f} |")
        md_content.append(f"")

        md_content.append(f"## 综合建议")
        md_content.append(f"")
        for rec in assessment.recommendations:
            md_content.append(f"- {rec}")
        md_content.append(f"")

        md_content.append(f"---")
        md_content.append(f"*此报告由野外踏勘风险计算员自动生成*")

        return "\n".join(md_content)

    def _render_risk_level(self, level: RiskLevel) -> str:
        if level == RiskLevel.CRITICAL:
            return "**🔴 极高风险 - 强烈建议重新评估行程**"
        elif level == RiskLevel.HIGH:
            return "**🟠 高风险 - 需谨慎对待**"
        elif level == RiskLevel.MEDIUM:
            return "**🟡 中风险 - 注意安全**"
        else:
            return "**🟢 低风险 - 条件良好**"

    def _render_risk_point(self, risk) -> str:
        lines = []
        lines.append(f"#### {risk.risk_id}: {risk.description}")
        lines.append(f"")
        lines.append(f"**类别**: {risk.category.value}")
        lines.append(f"**等级**: {risk.level.value}")
        
        if risk.location and 'lat' in risk.location:
            lines.append(f"**位置**: {risk.location['lat']:.6f}°N, {risk.location['lon']:.6f}°E")
            if risk.location.get('elevation'):
                lines.append(f"**海拔**: {risk.location['elevation']:.0f}m")
        
        if risk.details:
            lines.append(f"")
            lines.append(f"**详情**:")
            for key, value in risk.details.items():
                if isinstance(value, float):
                    lines.append(f"- {key}: {value:.2f}")
                else:
                    lines.append(f"- {key}: {value}")
        
        lines.append(f"")
        lines.append(f"**建议**:")
        for rec in risk.recommendations:
            lines.append(f"- {rec}")
        
        lines.append(f"")
        return "\n".join(lines)

    def write(self, file_path: str, assessment: RiskAssessment, 
              segments: List[RouteSegment], stats: RouteStatistics,
              team_members: List[TeamMember]) -> None:
        content = self.export(assessment, segments, stats, team_members)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
