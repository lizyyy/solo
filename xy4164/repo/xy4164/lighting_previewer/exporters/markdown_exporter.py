"""Markdown方案导出器"""

from typing import Optional
from datetime import datetime

from ..models import (
    LightPlan, SupplementInterval,
    CalculationResult, ZoneResult,
    ValidationResult, ValidationIssue,
    CropZone, LEDSpectrum, SensorData, ElectricityPrice
)


class MarkdownExporter:
    
    def __init__(self):
        pass
    
    def export_full_plan(
        self,
        light_plan: LightPlan,
        calculation_result: CalculationResult,
        validation_result: Optional[ValidationResult] = None,
        zones: list = None,
        spectra: list = None,
        output_path: Optional[str] = None
    ) -> str:
        
        lines = []
        
        lines.append("# 补光配方预演方案")
        lines.append("")
        lines.append(f"**方案名称**: {light_plan.plan_name}")
        lines.append(f"**创建时间**: {light_plan.created_at}")
        lines.append(f"**基准日期**: {light_plan.base_date or '未指定'}")
        lines.append("")
        
        lines.append("## 一、执行摘要")
        lines.append("")
        
        lines.append("### 1.1 光照指标概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总日光积分 (DLI) | {calculation_result.total_dli:.1f} mol/m²/day |")
        lines.append(f"| 其中: 自然光照 | {calculation_result.total_natural_dli:.1f} mol/m²/day |")
        lines.append(f"| 其中: 人工补光 | {calculation_result.total_supplemental_dli:.1f} mol/m²/day |")
        lines.append("")
        
        lines.append("### 1.2 能耗与成本概览")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 预计总能耗 | {calculation_result.total_estimated_energy:.2f} kWh |")
        lines.append(f"| 预计总成本 | {calculation_result.total_estimated_cost:.2f} 元 |")
        if calculation_result.budget_limit is not None:
            lines.append(f"| 预算额度 | {calculation_result.budget_limit:.2f} 元 |")
            lines.append(f"| 预算使用率 | {calculation_result.budget_utilization * 100:.1f}% |")
            lines.append(f"| 预算状态 | {self._format_budget_status(calculation_result.budget_status)} |")
        lines.append("")
        
        lines.append("### 1.3 风险评估")
        lines.append("")
        lines.append(f"**整体风险等级**: {self._format_risk_level(calculation_result.overall_risk_level)}")
        lines.append("")
        
        if calculation_result.deficient_zones:
            lines.append(f"⚠️ DLI不足分区: {len(calculation_result.deficient_zones)} 个")
        if calculation_result.excessive_zones:
            lines.append(f"⚠️ DLI过量分区: {len(calculation_result.excessive_zones)} 个")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 二、分区详细分析")
        lines.append("")
        
        for zone_result in calculation_result.zone_results:
            lines.append(f"### 分区 {zone_result.zone_id}: {zone_result.zone_name}")
            lines.append("")
            
            lines.append("#### 2.1 DLI分析")
            lines.append("")
            lines.append("| 项目 | 数值 | 状态 |")
            lines.append("|------|------|------|")
            lines.append(f"| 自然光照DLI | {zone_result.natural_dli:.1f} mol/m²/day | - |")
            lines.append(f"| 人工补光DLI | {zone_result.supplemental_dli:.1f} mol/m²/day | - |")
            lines.append(f"| **总计DLI** | **{zone_result.total_dli:.1f} mol/m²/day** | {self._format_dli_status(zone_result.dli_status)} |")
            lines.append(f"| 目标DLI | {zone_result.target_dli:.1f} mol/m²/day | - |")
            lines.append(f"| 最小阈值 | {zone_result.min_dli:.1f} mol/m²/day | - |")
            lines.append(f"| 最大阈值 | {zone_result.max_dli:.1f} mol/m²/day | - |")
            lines.append("")
            
            if zone_result.dli_deficit > 0:
                lines.append(f"⚠️ **DLI缺口**: {zone_result.dli_deficit:.1f} mol/m²/day")
            if zone_result.dli_excess > 0:
                lines.append(f"⚠️ **DLI过量**: {zone_result.dli_excess:.1f} mol/m²/day (烧苗风险!)")
            lines.append("")
            
            lines.append("#### 2.2 光谱分析")
            lines.append("")
            lines.append("| 项目 | 数值 |")
            lines.append("|------|------|")
            lines.append(f"| 蓝光比例 | {zone_result.spectrum_analysis.get('blue_ratio', 0):.2%} |")
            lines.append(f"| 红光比例 | {zone_result.spectrum_analysis.get('red_ratio', 0):.2%} |")
            lines.append(f"| 远红光比例 | {zone_result.spectrum_analysis.get('far_red_ratio', 0):.2%} |")
            lines.append(f"| **蓝红比 (B:R)** | **{zone_result.blue_red_ratio:.2f}** |")
            lines.append("")
            
            lines.append("#### 2.3 能耗与成本")
            lines.append("")
            lines.append("| 项目 | 数值 |")
            lines.append("|------|------|")
            lines.append(f"| 预计能耗 | {zone_result.estimated_energy:.2f} kWh |")
            lines.append(f"| 预计成本 | {zone_result.estimated_cost:.2f} 元 |")
            lines.append(f"| 自然光照时长 | {zone_result.natural_light_hours:.1f} 小时 |")
            lines.append(f"| 人工补光时长 | {zone_result.supplemental_light_hours:.1f} 小时 |")
            lines.append("")
            
            lines.append("#### 2.4 风险等级")
            lines.append("")
            lines.append(f"**风险等级**: {self._format_risk_level(zone_result.risk_level)}")
            if zone_result.warnings:
                lines.append("")
                lines.append("**警告**:")
                for warning in zone_result.warnings:
                    lines.append(f"- {warning}")
            lines.append("")
            
            lines.append("---")
            lines.append("")
        
        lines.append("## 三、补光时段安排")
        lines.append("")
        
        zone_intervals = {}
        for interval in light_plan.intervals:
            zid = interval.zone_id
            if zid not in zone_intervals:
                zone_intervals[zid] = []
            zone_intervals[zid].append(interval)
        
        for zid, intervals in zone_intervals.items():
            zone_name = zid
            if zones:
                for z in zones:
                    if z.zone_id == zid:
                        zone_name = z.zone_name
                        break
            
            lines.append(f"### 分区 {zid}: {zone_name}")
            lines.append("")
            lines.append("| 时段 | 功率 | 预计PPFD | 预计DLI贡献 | 能耗 | 成本 | 优先级 |")
            lines.append("|------|------|----------|-------------|------|------|--------|")
            
            for interval in intervals:
                lines.append(
                    f"| {interval.start_hour:02d}:00 - {interval.end_hour:02d}:00 | "
                    f"{interval.power_percentage:.0f}% | "
                    f"{interval.estimated_ppfd:.1f} μmol/m²/s | "
                    f"{interval.estimated_dli_contribution:.2f} mol/m² | "
                    f"{interval.estimated_energy:.2f} kWh | "
                    f"{interval.estimated_cost:.2f} 元 | "
                    f"{self._format_priority(interval.priority)} |"
                )
            lines.append("")
        
        lines.append("---")
        lines.append("")
        
        if validation_result:
            lines.append("## 四、数据校验结果")
            lines.append("")
            
            lines.append(f"**校验状态**: {'✅ 通过' if validation_result.is_valid else '❌ 失败'}")
            if validation_result.has_critical:
                lines.append(f"**严重问题**: {len(validation_result.critical_issues)} 个")
            if validation_result.has_warnings:
                lines.append(f"**警告**: {len(validation_result.warning_issues)} 个")
            lines.append("")
            
            if validation_result.issues:
                lines.append("### 4.1 问题详情")
                lines.append("")
                lines.append("| 严重程度 | 类别 | 问题描述 | 建议操作 |")
                lines.append("|----------|------|----------|----------|")
                
                for issue in validation_result.issues:
                    lines.append(
                        f"| {self._format_severity(issue.severity)} | "
                        f"{self._format_category(issue.category)} | "
                        f"{issue.message} | "
                        f"{issue.suggested_action or '-'} |"
                    )
                lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 五、操作建议")
        lines.append("")
        
        suggestions = []
        
        if calculation_result.deficient_zones:
            suggestions.append(
                f"1. **DLI不足**: 以下分区需要增加补光 - "
                f"{', '.join([z.zone_name for z in calculation_result.deficient_zones])}"
            )
        
        if calculation_result.excessive_zones:
            suggestions.append(
                f"2. **DLI过量风险**: 以下分区建议减少补光 - "
                f"{', '.join([z.zone_name for z in calculation_result.excessive_zones])}"
            )
        
        if calculation_result.budget_status == "over_budget":
            suggestions.append(
                f"3. **预算超限**: 当前成本 {calculation_result.total_estimated_cost:.2f} 元 "
                f"超出预算 {calculation_result.budget_limit:.2f} 元。"
                f"建议优先在谷电时段补光，或降低部分分区的功率。"
            )
        
        if suggestions:
            for s in suggestions:
                lines.append(s)
                lines.append("")
        else:
            lines.append("✅ 当前方案各项指标均在合理范围内。")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("*此方案由补光配方预演器生成*")
        lines.append(f"*生成时间: {datetime.now().isoformat()}*")
        
        content = "\n".join(lines)
        
        if output_path:
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
        
        return content
    
    def _format_dli_status(self, status: str) -> str:
        status_map = {
            "deficient": "❌ 不足",
            "excessive": "❌ 过量",
            "optimal": "✅ 最优",
            "acceptable": "⚠️ 可接受"
        }
        return status_map.get(status, status)
    
    def _format_risk_level(self, level: str) -> str:
        level_map = {
            "high": "🔴 高风险",
            "medium": "🟡 中风险",
            "low": "🟢 低风险"
        }
        return level_map.get(level, level)
    
    def _format_budget_status(self, status: str) -> str:
        status_map = {
            "over_budget": "❌ 超限",
            "warning": "⚠️ 接近上限",
            "under_budget": "✅ 预算内",
            "unknown": "未设置预算"
        }
        return status_map.get(status, status)
    
    def _format_priority(self, priority) -> str:
        from ..models import PriorityLevel
        priority_map = {
            PriorityLevel.HIGH: "🔴 高",
            PriorityLevel.MEDIUM: "🟡 中",
            PriorityLevel.LOW: "🟢 低"
        }
        return priority_map.get(priority, str(priority))
    
    def _format_severity(self, severity) -> str:
        from ..models import IssueSeverity
        severity_map = {
            IssueSeverity.CRITICAL: "🔴 严重",
            IssueSeverity.WARNING: "🟡 警告",
            IssueSeverity.INFO: "ℹ️ 信息"
        }
        return severity_map.get(severity, str(severity))
    
    def _format_category(self, category) -> str:
        from ..models import IssueCategory
        category_map = {
            IssueCategory.SENSOR_MISSING: "传感器缺测",
            IssueCategory.SENSOR_ANOMALY: "传感器异常",
            IssueCategory.POWER_CONFLICT: "功率冲突",
            IssueCategory.THRESHOLD_VIOLATION: "阈值越界",
            IssueCategory.BUDGET_EXCEEDED: "预算超限",
            IssueCategory.DATA_INCONSISTENCY: "数据不一致",
            IssueCategory.SPECTRUM_MISMATCH: "光谱不匹配"
        }
        return category_map.get(category, str(category))
