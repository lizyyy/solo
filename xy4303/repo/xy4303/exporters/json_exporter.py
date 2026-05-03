import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from models.workbench import Workbench, WorkbenchItem
from models.enums import IssueSeverity, IssueType, OrderStatus


@dataclass
class ExportResult:
    success: bool = True
    message: str = ""
    file_path: Optional[str] = None
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


class JSONExporter:
    def __init__(self):
        self.export_time = datetime.now()

    def export_audit_package(
        self,
        workbench: Workbench,
        file_path: Path,
        model_ids: Optional[List[str]] = None,
        include_full_data: bool = True,
    ) -> ExportResult:
        result = ExportResult()

        try:
            items = self._get_items(workbench, model_ids)

            package = {
                "audit_info": {
                    "export_time": self.export_time.isoformat(),
                    "workbench_name": workbench.name,
                    "workbench_created_at": workbench.created_at.isoformat() if workbench.created_at else None,
                    "exported_items_count": len(items),
                    "export_version": "1.0",
                },
                "summary": self._generate_summary(items),
                "items": [],
            }

            for item in items:
                item_data = self._serialize_item(item, include_full_data)
                package["items"].append(item_data)

            file_path.parent.mkdir(parents=True, exist_ok=True)

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(package, f, ensure_ascii=False, indent=2, default=str)

            result.success = True
            result.message = f"成功导出审计包，包含 {len(items)} 条记录"
            result.file_path = str(file_path)

        except Exception as e:
            result.success = False
            result.errors.append(f"导出失败: {str(e)}")

        return result

    def _get_items(
        self,
        workbench: Workbench,
        model_ids: Optional[List[str]] = None
    ) -> List[WorkbenchItem]:
        if model_ids:
            items = []
            for model_id in model_ids:
                item = workbench.get_item(model_id)
                if item:
                    items.append(item)
            return items
        return list(workbench.items.values())

    def _generate_summary(self, items: List[WorkbenchItem]) -> Dict[str, Any]:
        total_items = len(items)
        items_with_issues = len([i for i in items if i.has_issues])
        items_without_issues = total_items - items_with_issues

        total_issues = sum(i.issue_count for i in items)
        total_unresolved = sum(i.unresolved_issue_count for i in items)

        severity_counts = {"严重": 0, "高": 0, "中": 0, "低": 0}
        type_counts = {}

        for item in items:
            for issue in item.issues:
                severity_counts[issue.severity.value] = severity_counts.get(issue.severity.value, 0) + 1
                type_name = issue.issue_type.value
                type_counts[type_name] = type_counts.get(type_name, 0) + 1

        rework_count = sum(
            len(item.processing_status.rework_records)
            for item in items
            if item.processing_status
        )

        status_counts = {}
        for item in items:
            if item.processing_status:
                status = item.processing_status.current_status.value
                status_counts[status] = status_counts.get(status, 0) + 1

        return {
            "total_items": total_items,
            "items_with_issues": items_with_issues,
            "items_without_issues": items_without_issues,
            "total_issues": total_issues,
            "total_unresolved_issues": total_unresolved,
            "issues_by_severity": severity_counts,
            "issues_by_type": type_counts,
            "total_rework_records": rework_count,
            "items_by_status": status_counts,
        }

    def _serialize_item(
        self,
        item: WorkbenchItem,
        include_full_data: bool
    ) -> Dict[str, Any]:
        data = {
            "model_id": item.model_id,
            "internal_id": item.internal_id,
            "has_issues": item.has_issues,
            "issue_count": item.issue_count,
            "unresolved_issue_count": item.unresolved_issue_count,
            "is_locked": item.is_locked,
            "review_notes": item.review_notes,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        }

        if item.order:
            data["order"] = item.order.to_dict()

        if item.patient:
            data["patient"] = item.patient.to_dict()

        if item.processing_status:
            data["processing_status"] = item.processing_status.to_dict()

        if include_full_data:
            data["photos"] = [p.to_dict() for p in item.photos]
            data["stl_files"] = [s.to_dict() for s in item.stl_files]
            data["issues"] = [i.to_dict() for i in item.issues]
        else:
            data["photo_count"] = len(item.photos)
            data["stl_file_count"] = len(item.stl_files)
            data["issue_summary"] = self._summarize_issues(item.issues)

        return data

    def _summarize_issues(self, issues: list) -> Dict[str, Any]:
        if not issues:
            return {"count": 0}

        by_severity = {}
        by_type = {}
        unresolved = 0

        for issue in issues:
            sev = issue.severity.value
            typ = issue.issue_type.value

            by_severity[sev] = by_severity.get(sev, 0) + 1
            by_type[typ] = by_type.get(typ, 0) + 1

            if not issue.is_resolved:
                unresolved += 1

        return {
            "count": len(issues),
            "unresolved": unresolved,
            "by_severity": by_severity,
            "by_type": by_type,
        }

    def export_workbench_state(
        self,
        workbench: Workbench,
        file_path: Path,
    ) -> ExportResult:
        result = ExportResult()

        try:
            data = {
                "export_time": self.export_time.isoformat(),
                "workbench": workbench.to_dict(),
            }

            file_path.parent.mkdir(parents=True, exist_ok=True)

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)

            result.success = True
            result.message = f"成功导出工作台状态，共 {workbench.item_count} 条记录"
            result.file_path = str(file_path)

        except Exception as e:
            result.success = False
            result.errors.append(f"导出失败: {str(e)}")

        return result

    def export_daily_report(
        self,
        workbench: Workbench,
        file_path: Path,
    ) -> ExportResult:
        result = ExportResult()

        try:
            today = datetime.now().date()

            report = {
                "report_date": today.isoformat(),
                "report_time": self.export_time.isoformat(),
                "workbench_name": workbench.name,
                "statistics": {
                    "total_orders": workbench.item_count,
                    "orders_with_issues": len(workbench.items_with_issues),
                    "total_issues": workbench.total_issues,
                    "unresolved_issues": workbench.total_unresolved_issues,
                },
                "urgent_items": [],
                "overdue_items": [],
                "rework_items": [],
                "recent_activity": [],
            }

            for item in workbench.items.values():
                if item.order and item.order.is_urgent:
                    report["urgent_items"].append({
                        "model_id": item.model_id,
                        "patient_name": item.order.patient_name if item.order else "",
                        "doctor_name": item.order.doctor_name if item.order else "",
                        "status": item.processing_status.current_status.value if item.processing_status else "",
                        "issues": item.issue_count,
                    })

                if item.processing_status:
                    days = item.processing_status.days_until_delivery
                    if days is not None and days < 0:
                        report["overdue_items"].append({
                            "model_id": item.model_id,
                            "patient_name": item.order.patient_name if item.order else "",
                            "days_overdue": abs(days),
                            "status": item.processing_status.current_status.value,
                        })

                    if item.processing_status.rework_count > 0:
                        report["rework_items"].append({
                            "model_id": item.model_id,
                            "patient_name": item.order.patient_name if item.order else "",
                            "rework_count": item.processing_status.rework_count,
                            "has_unresolved": item.processing_status.has_unresolved_rework,
                            "status": item.processing_status.current_status.value,
                        })

            file_path.parent.mkdir(parents=True, exist_ok=True)

            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2, default=str)

            result.success = True
            result.message = f"成功导出日报"
            result.file_path = str(file_path)

        except Exception as e:
            result.success = False
            result.errors.append(f"导出失败: {str(e)}")

        return result
