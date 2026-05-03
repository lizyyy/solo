import csv
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from models.workbench import Workbench, WorkbenchItem
from models.issue import Issue
from models.enums import IssueSeverity, IssueType, OrderStatus


@dataclass
class ExportResult:
    success: bool = True
    message: str = ""
    file_path: Optional[str] = None
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


class CSVExporter:
    ISSUE_HEADERS = [
        "问题编号",
        "模型编号",
        "问题类型",
        "严重程度",
        "问题标题",
        "问题描述",
        "复核状态",
        "复核人",
        "复核备注",
        "复核时间",
        "是否解决",
        "解决方案",
        "解决时间",
        "发现时间",
    ]

    ORDER_HEADERS = [
        "模型编号",
        "订单编号",
        "患者姓名",
        "医生姓名",
        "诊所名称",
        "牙位",
        "修复类型",
        "材料",
        "比色",
        "是否加急",
        "订单日期",
        "交付日期",
        "当前状态",
        "返工次数",
        "是否有未解决问题",
        "问题数量",
        "未解决问题数",
        "复核备注",
    ]

    def __init__(self):
        self.export_time = datetime.now()

    def export_issues(
        self,
        workbench: Workbench,
        file_path: Path,
        model_ids: Optional[List[str]] = None,
        include_resolved: bool = True,
    ) -> ExportResult:
        result = ExportResult()

        try:
            issues = self._get_all_issues(workbench, model_ids)

            if not include_resolved:
                issues = [i for i in issues if not i.is_resolved]

            if not issues:
                result.success = True
                result.message = "没有问题需要导出"
                return result

            rows = []
            for issue in issues:
                row = [
                    issue.issue_id,
                    issue.model_id,
                    issue.issue_type.value,
                    issue.severity.value,
                    issue.title,
                    issue.description,
                    issue.review_status.value,
                    issue.reviewer_name or "",
                    issue.reviewer_notes,
                    issue.reviewed_at.strftime('%Y-%m-%d %H:%M') if issue.reviewed_at else "",
                    "是" if issue.is_resolved else "否",
                    issue.resolution,
                    issue.resolved_at.strftime('%Y-%m-%d %H:%M') if issue.resolved_at else "",
                    issue.created_at.strftime('%Y-%m-%d %H:%M') if issue.created_at else "",
                ]
                rows.append(row)

            self._write_csv(file_path, self.ISSUE_HEADERS, rows)

            result.success = True
            result.message = f"成功导出 {len(rows)} 条问题记录"
            result.file_path = str(file_path)

        except Exception as e:
            result.success = False
            result.errors.append(f"导出失败: {str(e)}")

        return result

    def export_orders(
        self,
        workbench: Workbench,
        file_path: Path,
        model_ids: Optional[List[str]] = None,
    ) -> ExportResult:
        result = ExportResult()

        try:
            items = self._get_items(workbench, model_ids)

            if not items:
                result.success = False
                result.errors.append("没有可导出的数据")
                return result

            rows = []
            for item in items:
                row = self._build_order_row(item)
                rows.append(row)

            self._write_csv(file_path, self.ORDER_HEADERS, rows)

            result.success = True
            result.message = f"成功导出 {len(rows)} 条订单记录"
            result.file_path = str(file_path)

        except Exception as e:
            result.success = False
            result.errors.append(f"导出失败: {str(e)}")

        return result

    def _get_all_issues(
        self,
        workbench: Workbench,
        model_ids: Optional[List[str]] = None
    ) -> List[Issue]:
        all_issues = []

        if model_ids:
            for model_id in model_ids:
                item = workbench.get_item(model_id)
                if item:
                    all_issues.extend(item.issues)
        else:
            for item in workbench.items.values():
                all_issues.extend(item.issues)

        all_issues.sort(
            key=lambda x: {
                "严重": 0,
                "高": 1,
                "中": 2,
                "低": 3,
            }.get(x.severity.value, 99)
        )

        return all_issues

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

    def _build_order_row(self, item: WorkbenchItem) -> List[Any]:
        order = item.order
        status = item.processing_status

        row = [
            item.model_id,
            order.order_id if order else "",
            order.patient_name if order else "",
            order.doctor_name if order else "",
            order.clinic_name or "" if order else "",
            ", ".join(order.tooth_positions) if order and order.tooth_positions else "",
            order.restoration_type or "" if order else "",
            order.material or "" if order else "",
            order.shade or "" if order else "",
            "是" if (order and order.is_urgent) else "否",
            order.order_date.strftime('%Y-%m-%d') if order and order.order_date else "",
            order.delivery_date.strftime('%Y-%m-%d') if order and order.delivery_date else "",
            status.current_status.value if status else "",
            len(status.rework_records) if status else 0,
            "是" if item.has_issues else "否",
            item.issue_count,
            item.unresolved_issue_count,
            item.review_notes,
        ]

        return row

    def _write_csv(
        self,
        file_path: Path,
        headers: List[str],
        rows: List[List[Any]]
    ) -> None:
        file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            writer.writerows(rows)

    def export_rework_summary(
        self,
        workbench: Workbench,
        file_path: Path,
    ) -> ExportResult:
        result = ExportResult()

        try:
            headers = [
                "模型编号",
                "订单编号",
                "患者姓名",
                "返工次数",
                "当前状态",
                "第1次返工原因",
                "第1次返工日期",
                "第1次是否解决",
                "第2次返工原因",
                "第2次返工日期",
                "第2次是否解决",
                "第3次返工原因",
                "第3次返工日期",
                "第3次是否解决",
            ]

            rows = []
            for item in workbench.items.values():
                status = item.processing_status
                if not status or not status.rework_records:
                    continue

                order = item.order
                records = status.rework_records[:3]

                row = [
                    item.model_id,
                    order.order_id if order else "",
                    order.patient_name if order else "",
                    len(status.rework_records),
                    status.current_status.value,
                ]

                for i in range(3):
                    if i < len(records):
                        record = records[i]
                        row.extend([
                            record.rework_reason,
                            record.rework_date.strftime('%Y-%m-%d') if record.rework_date else "",
                            "是" if record.is_resolved else "否",
                        ])
                    else:
                        row.extend(["", "", ""])

                rows.append(row)

            if rows:
                self._write_csv(file_path, headers, rows)
                result.success = True
                result.message = f"成功导出 {len(rows)} 条返工记录"
                result.file_path = str(file_path)
            else:
                result.success = True
                result.message = "没有返工记录需要导出"

        except Exception as e:
            result.success = False
            result.errors.append(f"导出失败: {str(e)}")

        return result
