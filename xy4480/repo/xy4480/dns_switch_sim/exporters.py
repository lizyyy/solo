import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional
from collections import defaultdict

from .models import (
    SimulationResult, CheckResult, CheckResultType,
    ReviewItem, ReviewStatus, SwitchPlan, SwitchStep,
    SwitchPhase, Region, CDNVendor
)


class MarkdownExporter:
    RESULT_ICONS: Dict[CheckResultType, str] = {
        CheckResultType.PASS: "✅",
        CheckResultType.WARNING: "⚠️",
        CheckResultType.FAIL: "❌",
        CheckResultType.INFO: "ℹ️",
    }

    RESULT_COLORS: Dict[CheckResultType, str] = {
        CheckResultType.PASS: "green",
        CheckResultType.WARNING: "yellow",
        CheckResultType.FAIL: "red",
        CheckResultType.INFO: "blue",
    }

    PHASE_NAMES: Dict[SwitchPhase, str] = {
        SwitchPhase.TTL_LOWER: "降低 TTL",
        SwitchPhase.TRAFFIC_SHIFT: "流量切换",
        SwitchPhase.STABILIZATION: "稳定期",
        SwitchPhase.ROLLBACK: "回滚",
        SwitchPhase.COMPLETE: "完成",
    }

    REGION_NAMES: Dict[Region, str] = {
        Region.CN_MAIN: "中国大陆",
        Region.CN_HK: "香港",
        Region.CN_TW: "台湾",
        Region.APAC: "亚太",
        Region.NA: "北美",
        Region.EU: "欧洲",
        Region.SA: "南美",
        Region.AF: "非洲",
        Region.GLOBAL: "全球",
    }

    VENDOR_NAMES: Dict[CDNVendor, str] = {
        CDNVendor.CDN_A: "CDN 服务商 A",
        CDNVendor.CDN_B: "CDN 服务商 B",
        CDNVendor.ORIGIN: "备用源站",
    }

    @classmethod
    def export(
        cls,
        simulation_result: SimulationResult,
        switch_plan: SwitchPlan,
        output_path: Path,
    ) -> None:
        markdown = cls._generate_markdown(simulation_result, switch_plan)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(markdown)

    @classmethod
    def _generate_markdown(
        cls,
        result: SimulationResult,
        plan: SwitchPlan,
    ) -> str:
        lines = []
        
        lines.append(f"# DNS 切换演练报告 - {plan.name}")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> 模拟时间: {result.simulated_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> 模拟 ID: `{result.simulation_id}`")
        lines.append("")
        
        lines.append("## 📋 演练概览")
        lines.append("")
        lines.append("| 项目 | 详情 |")
        lines.append("|------|------|")
        lines.append(f"| 域名 | `{plan.domain}` |")
        lines.append(f"| 原始供应商 | {cls.VENDOR_NAMES.get(plan.original_vendor, plan.original_vendor.value)} |")
        lines.append(f"| 目标供应商 | {cls.VENDOR_NAMES.get(plan.target_vendor, plan.target_vendor.value)} |")
        lines.append(f"| 回滚供应商 | {cls.VENDOR_NAMES.get(plan.rollback_vendor, plan.rollback_vendor.value)} |")
        lines.append(f"| 计划开始时间 | {plan.planned_start_time.strftime('%Y-%m-%d %H:%M:%S')} |")
        lines.append("")
        
        lines.append("## ⏰ 切换步骤时间线")
        lines.append("")
        lines.append("```mermaid")
        lines.append("gantt")
        lines.append("    title DNS 切换时间线")
        lines.append("    dateFormat  YYYY-MM-DD HH:mm")
        lines.append("    axisFormat  %H:%M")
        
        steps_sorted = sorted(plan.steps, key=lambda s: s.start_time)
        for step in steps_sorted:
            phase_name = cls.PHASE_NAMES.get(step.phase, step.phase.value)
            region_name = cls.REGION_NAMES.get(step.region, step.region.value)
            start_str = step.start_time.strftime("%Y-%m-%d %H:%M")
            duration_min = step.duration_minutes
            lines.append(f"    {phase_name} ({region_name}) :active, {start_str}, {duration_min}m")
        
        lines.append("```")
        lines.append("")
        
        lines.append("## 🌍 区域生效状态")
        lines.append("")
        lines.append("| 区域 | 状态 |")
        lines.append("|------|------|")
        
        for region, is_effective in result.effective_regions.items():
            region_name = cls.REGION_NAMES.get(region, region.value)
            status_icon = "✅ 已生效" if is_effective else "⏳ 传播中"
            lines.append(f"| {region_name} | {status_icon} |")
        
        lines.append("")
        
        lines.append("## 🔍 检查结果汇总")
        lines.append("")
        
        stats = defaultdict(int)
        for check in result.check_results:
            stats[check.result] += 1
        
        lines.append(f"- ✅ 通过: {stats.get(CheckResultType.PASS, 0)} 项")
        lines.append(f"- ⚠️ 警告: {stats.get(CheckResultType.WARNING, 0)} 项")
        lines.append(f"- ❌ 失败: {stats.get(CheckResultType.FAIL, 0)} 项")
        lines.append(f"- ℹ️ 信息: {stats.get(CheckResultType.INFO, 0)} 项")
        lines.append("")
        
        lines.append("### 详细检查结果")
        lines.append("")
        
        check_types: Dict[str, List[CheckResult]] = defaultdict(list)
        for check in result.check_results:
            check_types[check.check_type].append(check)
        
        type_names = {
            "ttl_not_lowered": "📌 TTL 降低检查",
            "cname_drift": "🔗 CNAME 漂移检查",
            "probe_failure": "📡 探测结果检查",
            "rollback_window": "🔙 回滚窗口检查",
        }
        
        for check_type, checks in check_types.items():
            section_title = type_names.get(check_type, f"🔍 {check_type}")
            lines.append(f"#### {section_title}")
            lines.append("")
            lines.append("| 状态 | 区域 | 描述 | 详情 |")
            lines.append("|------|------|------|------|")
            
            for check in checks:
                icon = cls.RESULT_ICONS.get(check.result, "")
                region_name = cls.REGION_NAMES.get(check.region, check.region.value if check.region else "-")
                details_str = cls._format_details(check.details)
                lines.append(f"| {icon} | {region_name} | {check.message} | {details_str} |")
            
            lines.append("")
        
        lines.append("## 🔙 回滚状态")
        lines.append("")
        
        if result.rollback_available:
            lines.append(f"- **回滚可用**: ✅ 是")
            if result.rollback_window_minutes is not None:
                lines.append(f"- **剩余回滚窗口**: {result.rollback_window_minutes} 分钟")
            else:
                lines.append(f"- **剩余回滚窗口**: 未在回滚阶段")
        else:
            lines.append(f"- **回滚可用**: ❌ 否（当前阶段不可回滚）")
        
        lines.append("")
        
        lines.append("## 📝 人工复核项")
        lines.append("")
        
        needs_review = [item for item in result.review_items if item.status == ReviewStatus.NEEDS_REVIEW]
        pending = [item for item in result.review_items if item.status == ReviewStatus.PENDING]
        approved = [item for item in result.review_items if item.status == ReviewStatus.APPROVED]
        rejected = [item for item in result.review_items if item.status == ReviewStatus.REJECTED]
        
        lines.append(f"- 📋 待复核: {len(needs_review)} 项")
        lines.append(f"- ⏳ 待处理: {len(pending)} 项")
        lines.append(f"- ✅ 已批准: {len(approved)} 项")
        lines.append(f"- ❌ 已拒绝: {len(rejected)} 项")
        lines.append("")
        
        if needs_review:
            lines.append("### 需要立即复核的项")
            lines.append("")
            lines.append("| 复核项 ID | 关联检查 | 状态 | 处理人 | 备注 |")
            lines.append("|-----------|----------|------|--------|------|")
            
            for item in needs_review:
                reviewer = item.reviewer or "-"
                comment = item.comment or "-"
                lines.append(f"| `{item.item_id}` | `{item.check_result_id}` | ⚠️ 需要复核 | {reviewer} | {comment} |")
            
            lines.append("")
        
        lines.append("## 📋 操作建议")
        lines.append("")
        
        failures = [c for c in result.check_results if c.result == CheckResultType.FAIL]
        warnings = [c for c in result.check_results if c.result == CheckResultType.WARNING]
        
        if failures:
            lines.append("### ⚠️ 紧急操作（失败项）")
            lines.append("")
            for check in failures:
                region_name = cls.REGION_NAMES.get(check.region, check.region.value if check.region else "")
                lines.append(f"1. **{check.check_type}** ({region_name}): {check.message}")
                lines.append(f"   - 建议: 立即检查并处理")
            lines.append("")
        
        if warnings:
            lines.append("### 📌 建议操作（警告项）")
            lines.append("")
            for check in warnings:
                region_name = cls.REGION_NAMES.get(check.region, check.region.value if check.region else "")
                lines.append(f"1. **{check.check_type}** ({region_name}): {check.message}")
            lines.append("")
        
        if not failures and not warnings:
            lines.append("✅ **所有检查项通过，可以继续执行切换计划**")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由 DNS 切换演练工具自动生成*")
        
        return "\n".join(lines)

    @classmethod
    def _format_details(cls, details: Dict[str, Any]) -> str:
        if not details:
            return "-"
        
        parts = []
        for key, value in details.items():
            if isinstance(value, float):
                value = f"{value:.2f}"
            parts.append(f"`{key}: {value}`")
        
        return " ".join(parts)


class JSONAuditExporter:
    @classmethod
    def export(
        cls,
        simulation_result: SimulationResult,
        switch_plan: SwitchPlan,
        output_path: Path,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        audit_data = cls._generate_audit_data(simulation_result, switch_plan, extra_metadata)
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2, default=cls._json_default)

    @classmethod
    def _generate_audit_data(
        cls,
        result: SimulationResult,
        plan: SwitchPlan,
        extra_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        audit: Dict[str, Any] = {
            "audit_version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "simulation": {
                "id": result.simulation_id,
                "plan_id": result.plan_id,
                "domain": result.domain,
                "simulated_time": result.simulated_time.isoformat(),
                "rollback_available": result.rollback_available,
                "rollback_window_minutes": result.rollback_window_minutes,
            },
            "switch_plan": {
                "plan_id": plan.plan_id,
                "name": plan.name,
                "domain": plan.domain,
                "original_vendor": plan.original_vendor.value,
                "target_vendor": plan.target_vendor.value,
                "rollback_vendor": plan.rollback_vendor.value,
                "created_at": plan.created_at.isoformat(),
                "planned_start_time": plan.planned_start_time.isoformat(),
                "steps": [
                    {
                        "step_id": step.step_id,
                        "phase": step.phase.value,
                        "description": step.description,
                        "target_vendor": step.target_vendor.value,
                        "region": step.region.value,
                        "start_time": step.start_time.isoformat(),
                        "duration_minutes": step.duration_minutes,
                        "traffic_percent": step.traffic_percent,
                    }
                    for step in plan.steps
                ],
            },
            "effective_regions": {
                region.value: is_effective
                for region, is_effective in result.effective_regions.items()
            },
            "check_results": [
                {
                    "check_id": check.check_id,
                    "check_type": check.check_type,
                    "description": check.description,
                    "result": check.result.value,
                    "message": check.message,
                    "region": check.region.value if check.region else None,
                    "domain": check.domain,
                    "timestamp": check.timestamp.isoformat(),
                    "details": check.details,
                }
                for check in result.check_results
            ],
            "review_items": [
                {
                    "item_id": item.item_id,
                    "check_result_id": item.check_result_id,
                    "reviewer": item.reviewer,
                    "status": item.status.value,
                    "comment": item.comment,
                    "reviewed_at": item.reviewed_at.isoformat() if item.reviewed_at else None,
                }
                for item in result.review_items
            ],
            "summary": cls._generate_summary(result),
        }
        
        if extra_metadata:
            audit["metadata"] = extra_metadata
        
        return audit

    @classmethod
    def _generate_summary(cls, result: SimulationResult) -> Dict[str, Any]:
        from collections import defaultdict
        
        stats = defaultdict(int)
        for check in result.check_results:
            stats[check.result.value] += 1
        
        review_stats = defaultdict(int)
        for item in result.review_items:
            review_stats[item.status.value] += 1
        
        return {
            "total_checks": len(result.check_results),
            "checks_by_result": dict(stats),
            "total_review_items": len(result.review_items),
            "reviews_by_status": dict(review_stats),
            "effective_regions_count": sum(1 for v in result.effective_regions.values() if v),
            "rollback_available": result.rollback_available,
        }

    @staticmethod
    def _json_default(obj: Any) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if hasattr(obj, "value"):
            return obj.value
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
