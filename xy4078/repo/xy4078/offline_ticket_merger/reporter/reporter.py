"""报告生成模块"""

import csv
import io
import json
from abc import ABC, abstractmethod
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..inventory import reconcile_inventory
from ..models import (
    AuditReport,
    ConflictType,
    InventoryCheckResult,
    MergeConflict,
    MergeResult,
    PhotoItem,
    SparePart,
    WorkOrder,
    WorkOrderSnapshot,
)


class ReportGenerator(ABC):
    def __init__(self):
        self._indent_level = 0
    
    @abstractmethod
    def generate(self, report: AuditReport) -> str:
        pass
    
    def _build_summary(self, merge_result: MergeResult) -> Dict[str, Any]:
        total_conflicts = len(merge_result.conflicts)
        resolved_conflicts = sum(1 for c in merge_result.conflicts if c.is_resolved)
        unresolved_conflicts = total_conflicts - resolved_conflicts
        
        conflict_by_type: Dict[str, int] = defaultdict(int)
        conflict_by_severity: Dict[str, int] = defaultdict(int)
        
        for conflict in merge_result.conflicts:
            conflict_by_type[conflict.conflict_type.value] += 1
            conflict_by_severity[conflict.severity] += 1
        
        inventory_overconsumed = sum(
            1 for ic in merge_result.inventory_checks if ic.is_overconsumed
        )
        
        summary = {
            "execution": {
                "total_input_tickets": merge_result.total_input_tickets,
                "total_work_orders": merge_result.total_work_orders,
                "unique_tickets": merge_result.unique_tickets,
                "merged_at": merge_result.merged_at.isoformat() if merge_result.merged_at else None,
            },
            "conflicts": {
                "total": total_conflicts,
                "resolved": resolved_conflicts,
                "unresolved": unresolved_conflicts,
                "by_type": dict(conflict_by_type),
                "by_severity": dict(conflict_by_severity),
                "duplicate_tickets": merge_result.duplicate_tickets_found,
                "field_conflicts": merge_result.field_conflicts_found,
                "inventory_issues": merge_result.inventory_issues_found,
            },
            "inventory": {
                "total_parts_checked": len(merge_result.inventory_checks),
                "overconsumed_parts": inventory_overconsumed,
            },
            "merged_work_orders": len(merge_result.merged_work_orders),
        }
        
        return summary
    
    def _build_details(self, merge_result: MergeResult) -> Dict[str, Any]:
        work_order_details: List[Dict[str, Any]] = []
        
        for snapshot in merge_result.merged_work_orders:
            wo = snapshot.work_order
            
            wo_conflicts = [
                c for c in merge_result.conflicts
                if c.work_order_id == wo.id or c.ticket_number == wo.ticket_number
            ]
            
            work_order_details.append({
                "ticket_number": wo.ticket_number,
                "device_id": wo.device_id,
                "device_name": wo.device_name,
                "status": wo.status.value if hasattr(wo.status, "value") else str(wo.status),
                "engineer": wo.engineer_name or wo.engineer_id,
                "conflicts_count": len(wo_conflicts),
                "resolved_conflicts": snapshot.resolved_conflicts,
                "unresolved_conflicts": snapshot.unresolved_conflicts,
                "merge_strategy": snapshot.merge_strategy_used.value if hasattr(snapshot.merge_strategy_used, "value") else str(snapshot.merge_strategy_used),
                "photos_count": len(wo.photos),
                "spare_parts_count": len(wo.spare_parts),
                "created_at": wo.created_at.isoformat() if wo.created_at else None,
                "updated_at": wo.updated_at.isoformat() if wo.updated_at else None,
            })
        
        conflict_details: List[Dict[str, Any]] = []
        for conflict in merge_result.conflicts:
            conflict_details.append({
                "id": conflict.id,
                "type": conflict.conflict_type.value if hasattr(conflict.conflict_type, "value") else str(conflict.conflict_type),
                "ticket_number": conflict.ticket_number,
                "field_name": conflict.field_name,
                "severity": conflict.severity,
                "is_resolved": conflict.is_resolved,
                "resolution": conflict.resolution,
                "source_tickets": conflict.source_tickets,
                "source_engineers": conflict.source_engineers,
                "description": conflict.description,
                "values": conflict.values,
            })
        
        inventory_details: List[Dict[str, Any]] = []
        for ic in merge_result.inventory_checks:
            inventory_details.append({
                "part_number": ic.part_number,
                "part_name": ic.part_name,
                "available": ic.available_quantity,
                "requested": ic.requested_quantity,
                "total_consumed": ic.total_consumed,
                "is_overconsumed": ic.is_overconsumed,
                "overconsumption_amount": ic.overconsumption_amount,
                "consuming_tickets": ic.consuming_tickets,
                "consuming_engineers": ic.consuming_engineers,
            })
        
        return {
            "work_orders": work_order_details,
            "conflicts": conflict_details,
            "inventory_checks": inventory_details,
        }


class JsonReporter(ReportGenerator):
    def generate(self, report: AuditReport) -> str:
        output = {
            "report_id": report.id,
            "report_version": report.report_version,
            "generated_at": report.generated_at.isoformat() if report.generated_at else None,
            "repository_path": report.repository_path,
            "summary": report.summary,
            "details": report.details,
            "export_format": report.export_format,
        }
        
        return json.dumps(output, ensure_ascii=False, indent=2, default=str)


class CsvReporter(ReportGenerator):
    def generate(self, report: AuditReport) -> str:
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["=== 离线工单合并器审计报告 ==="])
        writer.writerow(["生成时间", report.generated_at.strftime("%Y-%m-%d %H:%M:%S") if report.generated_at else ""])
        writer.writerow(["报告ID", report.id])
        writer.writerow(["仓库路径", report.repository_path])
        writer.writerow([])
        
        writer.writerow(["--- 汇总摘要 ---"])
        summary = report.summary
        
        execution = summary.get("execution", {})
        writer.writerow(["输入工单包数", execution.get("total_input_tickets", 0)])
        writer.writerow(["总工单数量", execution.get("total_work_orders", 0)])
        writer.writerow(["唯一工单数量", execution.get("unique_tickets", 0)])
        writer.writerow(["合并后工单数量", summary.get("merged_work_orders", 0)])
        writer.writerow([])
        
        conflicts = summary.get("conflicts", {})
        writer.writerow(["冲突统计"])
        writer.writerow(["总冲突数", conflicts.get("total", 0)])
        writer.writerow(["已解决", conflicts.get("resolved", 0)])
        writer.writerow(["未解决", conflicts.get("unresolved", 0)])
        writer.writerow(["重复工单", conflicts.get("duplicate_tickets", 0)])
        writer.writerow(["字段冲突", conflicts.get("field_conflicts", 0)])
        writer.writerow(["库存问题", conflicts.get("inventory_issues", 0)])
        writer.writerow([])
        
        inventory = summary.get("inventory", {})
        writer.writerow(["库存检查"])
        writer.writerow(["检查备件数", inventory.get("total_parts_checked", 0)])
        writer.writerow(["超领备件数", inventory.get("overconsumed_parts", 0)])
        writer.writerow([])
        
        writer.writerow(["--- 工单详情 ---"])
        work_orders = report.details.get("work_orders", [])
        if work_orders:
            headers = ["工单编号", "设备编号", "设备名称", "状态", "工程师", "冲突数", "照片数", "备件数"]
            writer.writerow(headers)
            for wo in work_orders:
                writer.writerow([
                    wo.get("ticket_number", ""),
                    wo.get("device_id", ""),
                    wo.get("device_name", ""),
                    wo.get("status", ""),
                    wo.get("engineer", ""),
                    wo.get("conflicts_count", 0),
                    wo.get("photos_count", 0),
                    wo.get("spare_parts_count", 0),
                ])
        writer.writerow([])
        
        writer.writerow(["--- 冲突详情 ---"])
        conflicts_detail = report.details.get("conflicts", [])
        if conflicts_detail:
            headers = ["冲突ID", "类型", "工单", "字段", "严重程度", "是否解决", "描述"]
            writer.writerow(headers)
            for c in conflicts_detail:
                writer.writerow([
                    c.get("id", ""),
                    c.get("type", ""),
                    c.get("ticket_number", ""),
                    c.get("field_name", ""),
                    c.get("severity", ""),
                    "是" if c.get("is_resolved") else "否",
                    c.get("description", "")[:80] if c.get("description") else "",
                ])
        writer.writerow([])
        
        writer.writerow(["--- 库存检查详情 ---"])
        inventory_checks = report.details.get("inventory_checks", [])
        if inventory_checks:
            headers = ["备件编号", "备件名称", "可用数量", "申请数量", "已领用", "是否超领", "超领数量"]
            writer.writerow(headers)
            for ic in inventory_checks:
                writer.writerow([
                    ic.get("part_number", ""),
                    ic.get("part_name", ""),
                    ic.get("available", 0),
                    ic.get("requested", 0),
                    ic.get("total_consumed", 0),
                    "是" if ic.get("is_overconsumed") else "否",
                    ic.get("overconsumption_amount", 0),
                ])
        
        return output.getvalue()


class MarkdownReporter(ReportGenerator):
    def generate(self, report: AuditReport) -> str:
        lines: List[str] = []
        
        lines.append("# 离线工单合并器审计报告")
        lines.append("")
        lines.append(f"- **报告ID**: {report.id}")
        lines.append(f"- **生成时间**: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S') if report.generated_at else 'N/A'}")
        lines.append(f"- **仓库路径**: {report.repository_path}")
        lines.append(f"- **报告版本**: {report.report_version}")
        lines.append("")
        
        lines.append("## 汇总摘要")
        lines.append("")
        
        summary = report.summary
        execution = summary.get("execution", {})
        
        lines.append("### 执行统计")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 输入工单包数 | {execution.get('total_input_tickets', 0)} |")
        lines.append(f"| 总工单数量 | {execution.get('total_work_orders', 0)} |")
        lines.append(f"| 唯一工单数量 | {execution.get('unique_tickets', 0)} |")
        lines.append(f"| 合并后工单数量 | {summary.get('merged_work_orders', 0)} |")
        lines.append("")
        
        lines.append("### 冲突统计")
        lines.append("")
        
        conflicts = summary.get("conflicts", {})
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 总冲突数 | {conflicts.get('total', 0)} |")
        lines.append(f"| 已解决 | {conflicts.get('resolved', 0)} |")
        lines.append(f"| 未解决 | {conflicts.get('unresolved', 0)} |")
        lines.append(f"| 重复工单 | {conflicts.get('duplicate_tickets', 0)} |")
        lines.append(f"| 字段冲突 | {conflicts.get('field_conflicts', 0)} |")
        lines.append(f"| 库存问题 | {conflicts.get('inventory_issues', 0)} |")
        lines.append("")
        
        conflict_by_type = conflicts.get("by_type", {})
        if conflict_by_type:
            lines.append("#### 按冲突类型统计")
            lines.append("")
            lines.append("| 冲突类型 | 数量 |")
            lines.append("|----------|------|")
            for ctype, count in conflict_by_type.items():
                lines.append(f"| {ctype} | {count} |")
            lines.append("")
        
        lines.append("### 库存检查")
        lines.append("")
        
        inventory = summary.get("inventory", {})
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 检查备件数 | {inventory.get('total_parts_checked', 0)} |")
        lines.append(f"| 超领备件数 | {inventory.get('overconsumed_parts', 0)} |")
        lines.append("")
        
        lines.append("## 工单详情")
        lines.append("")
        
        work_orders = report.details.get("work_orders", [])
        if work_orders:
            lines.append("| 工单编号 | 设备编号 | 设备名称 | 状态 | 工程师 | 冲突数 | 照片 | 备件 |")
            lines.append("|----------|----------|----------|------|--------|--------|------|------|")
            for wo in work_orders:
                lines.append((
                    f"| {wo.get('ticket_number', '')} | "
                    f"{wo.get('device_id', '')} | "
                    f"{wo.get('device_name', '')} | "
                    f"{wo.get('status', '')} | "
                    f"{wo.get('engineer', '')} | "
                    f"{wo.get('conflicts_count', 0)} | "
                    f"{wo.get('photos_count', 0)} | "
                    f"{wo.get('spare_parts_count', 0)} |"
                ))
        else:
            lines.append("*无工单数据*")
        lines.append("")
        
        lines.append("## 冲突详情")
        lines.append("")
        
        conflicts_detail = report.details.get("conflicts", [])
        if conflicts_detail:
            for idx, conflict in enumerate(conflicts_detail, 1):
                status = "✅ 已解决" if conflict.get("is_resolved") else "⚠️ 未解决"
                lines.append(f"### 冲突 #{idx}: {conflict.get('type', 'unknown')} - {status}")
                lines.append("")
                lines.append(f"- **工单编号**: {conflict.get('ticket_number', 'N/A')}")
                lines.append(f"- **字段**: {conflict.get('field_name', 'N/A')}")
                lines.append(f"- **严重程度**: {conflict.get('severity', 'N/A')}")
                lines.append(f"- **来源工程师**: {', '.join(conflict.get('source_engineers', []))}")
                lines.append("")
                lines.append(f"**描述**: {conflict.get('description', 'N/A')}")
                lines.append("")
                
                values = conflict.get("values", [])
                if values:
                    lines.append("**冲突值**:")
                    lines.append("")
                    for v in values:
                        lines.append(f"- 值: `{v.get('value')}` (来自: {v.get('source', 'unknown')})")
                    lines.append("")
                
                if conflict.get("is_resolved") and conflict.get("resolution"):
                    lines.append(f"**解决方案**: {conflict.get('resolution')}")
                    lines.append("")
        else:
            lines.append("*无冲突数据*")
        lines.append("")
        
        lines.append("## 库存检查详情")
        lines.append("")
        
        inventory_checks = report.details.get("inventory_checks", [])
        if inventory_checks:
            lines.append("| 备件编号 | 备件名称 | 可用数量 | 申请数量 | 已领用 | 是否超领 | 超领数量 |")
            lines.append("|----------|----------|----------|----------|--------|----------|----------|")
            for ic in inventory_checks:
                over_mark = "⚠️" if ic.get("is_overconsumed") else ""
                lines.append((
                    f"| {ic.get('part_number', '')} | "
                    f"{ic.get('part_name', '')} | "
                    f"{ic.get('available', 0)} | "
                    f"{ic.get('requested', 0)} | "
                    f"{ic.get('total_consumed', 0)} | "
                    f"{over_mark}{'是' if ic.get('is_overconsumed') else '否'} | "
                    f"{ic.get('overconsumption_amount', 0)} |"
                ))
        else:
            lines.append("*无库存检查数据*")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由离线工单合并器自动生成*")
        
        return "\n".join(lines)


def generate_audit_report(
    merge_result: MergeResult,
    repository_path: str,
    inventory_parts: Optional[List[SparePart]] = None,
) -> AuditReport:
    merged_work_orders = [s.work_order for s in merge_result.merged_work_orders]
    
    if inventory_parts:
        reconciliation = reconcile_inventory(merged_work_orders, inventory_parts)
        
        inventory_checks: List[InventoryCheckResult] = []
        for part_number, rec in reconciliation.items():
            inventory_checks.append(InventoryCheckResult(
                part_number=part_number,
                part_name=rec.get("part_name", "Unknown"),
                available_quantity=rec.get("initial_quantity", 0),
                requested_quantity=rec.get("consumed_quantity", 0),
                total_consumed=rec.get("consumed_quantity", 0),
                is_overconsumed=rec.get("is_shortage", False),
                overconsumption_amount=rec.get("shortage_amount", 0),
                consuming_tickets=[c.get("ticket", "") for c in rec.get("consumed_by", [])],
                consuming_engineers=[c.get("engineer", "") for c in rec.get("consumed_by", [])],
            ))
        
        merge_result.inventory_checks = inventory_checks
        merge_result.inventory_issues_found = sum(1 for ic in inventory_checks if ic.is_overconsumed)
    
    reporter = MarkdownReporter()
    summary = reporter._build_summary(merge_result)
    details = reporter._build_details(merge_result)
    
    return AuditReport(
        repository_path=repository_path,
        merge_result=merge_result,
        summary=summary,
        details=details,
        export_format="markdown",
    )


def export_report(
    report: AuditReport,
    format: str = "markdown",
    output_path: Optional[Path] = None,
) -> str:
    format_lower = format.lower()
    
    if format_lower in ["md", "markdown"]:
        reporter = MarkdownReporter()
    elif format_lower == "csv":
        reporter = CsvReporter()
    elif format_lower == "json":
        reporter = JsonReporter()
    else:
        raise ValueError(f"Unknown format: {format}. Supported: markdown, csv, json")
    
    report.export_format = format_lower
    content = reporter.generate(report)
    
    if output_path:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(content, encoding="utf-8")
        report.export_path = str(output_path)
    
    return content
