from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from models.workbench import Workbench, WorkbenchItem
from models.enums import OrderStatus, IssueSeverity


@dataclass
class ExportResult:
    success: bool = True
    message: str = ""
    file_path: Optional[str] = None
    errors: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


class MarkdownExporter:
    def __init__(self):
        self.export_time = datetime.now()

    def export(
        self,
        workbench: Workbench,
        file_path: Path,
        include_issues: bool = True,
        include_photos: bool = True,
        include_stl: bool = True,
        model_ids: Optional[List[str]] = None,
    ) -> ExportResult:
        result = ExportResult()

        try:
            items = self._get_items(workbench, model_ids)

            if not items:
                result.success = False
                result.errors.append("没有可导出的数据")
                return result

            markdown = self._generate_markdown(
                workbench, items, include_issues, include_photos, include_stl
            )

            with open(file_path, "w", encoding="utf-8") as f:
                f.write(markdown)

            result.success = True
            result.message = f"成功导出 {len(items)} 条记录"
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

    def _generate_markdown(
        self,
        workbench: Workbench,
        items: List[WorkbenchItem],
        include_issues: bool,
        include_photos: bool,
        include_stl: bool,
    ) -> str:
        lines = []

        lines.append("# 义齿加工交付单")
        lines.append("")
        lines.append(f"> 生成时间：{self.export_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> 总订单数：{len(items)}")
        lines.append(f"> 问题订单数：{len([i for i in items if i.has_issues])}")
        lines.append("")

        lines.append("---")
        lines.append("")

        items_with_issues = [i for i in items if i.has_issues]
        items_without_issues = [i for i in items if not i.has_issues]

        if items_with_issues:
            lines.append("## ⚠️ 待处理问题订单")
            lines.append("")
            for item in items_with_issues:
                lines.extend(self._generate_item_section(
                    item, include_issues, include_photos, include_stl, True
                ))

        if items_without_issues:
            lines.append("## ✅ 正常订单")
            lines.append("")
            for item in items_without_issues:
                lines.extend(self._generate_item_section(
                    item, include_issues, include_photos, include_stl, False
                ))

        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("> 此文档由「取模返工复核台」系统自动生成")
        lines.append(f"> 工作台：{workbench.name}")

        return "\n".join(lines)

    def _generate_item_section(
        self,
        item: WorkbenchItem,
        include_issues: bool,
        include_photos: bool,
        include_stl: bool,
        has_issues: bool,
    ) -> List[str]:
        lines = []

        status_icon = "❌" if has_issues else "✅"
        order_id = item.order.order_id if item.order else item.model_id
        lines.append(f"### {status_icon} {item.model_id} - 订单 {order_id}")
        lines.append("")

        if item.order:
            lines.append("#### 基本信息")
            lines.append("")
            lines.append(f"- **患者姓名**：{item.order.patient_name}")
            lines.append(f"- **医生姓名**：{item.order.doctor_name}")
            if item.order.clinic_name:
                lines.append(f"- **诊所名称**：{item.order.clinic_name}")
            lines.append(f"- **牙位**：{', '.join(item.order.tooth_positions) if item.order.tooth_positions else '未指定'}")
            if item.order.restoration_type:
                lines.append(f"- **修复类型**：{item.order.restoration_type}")
            if item.order.material:
                lines.append(f"- **材料**：{item.order.material}")
            if item.order.shade:
                lines.append(f"- **比色**：{item.order.shade}")
            if item.order.is_urgent:
                lines.append(f"- **⚠️ 加急订单**")
            if item.order.delivery_date:
                lines.append(f"- **交付日期**：{item.order.delivery_date}")
            lines.append("")

        if item.processing_status:
            lines.append("#### 加工状态")
            lines.append("")
            lines.append(f"- **当前状态**：{item.processing_status.current_status.value}")
            if item.processing_status.received_date:
                lines.append(f"- **接收日期**：{item.processing_status.received_date.strftime('%Y-%m-%d %H:%M')}")
            if item.processing_status.expected_delivery_date:
                lines.append(f"- **预计交付**：{item.processing_status.expected_delivery_date.strftime('%Y-%m-%d %H:%M')}")
            if item.processing_status.responsible_technician:
                lines.append(f"- **负责技师**：{item.processing_status.responsible_technician}")

            rework_records = item.processing_status.rework_records
            if rework_records:
                lines.append(f"- **返工次数**：{len(rework_records)}")
                lines.append("")
                lines.append("**返工记录**：")
                lines.append("")
                for i, record in enumerate(rework_records, 1):
                    status = "✅ 已解决" if record.is_resolved else "❌ 未解决"
                    lines.append(f"**第{i}次返工 ({status})**：")
                    lines.append(f"- 原因：{record.rework_reason}")
                    if record.rework_date:
                        lines.append(f"- 返工日期：{record.rework_date.strftime('%Y-%m-%d')}")
                    if record.responsible_person:
                        lines.append(f"- 负责人：{record.responsible_person}")
                    if record.solution:
                        lines.append(f"- 解决方案：{record.solution}")
                    lines.append("")
            lines.append("")

        if include_issues and item.issues:
            lines.append("#### ⚠️ 问题清单")
            lines.append("")

            critical_issues = [i for i in item.issues if i.severity == IssueSeverity.CRITICAL]
            high_issues = [i for i in item.issues if i.severity == IssueSeverity.HIGH]
            medium_issues = [i for i in item.issues if i.severity == IssueSeverity.MEDIUM]
            low_issues = [i for i in item.issues if i.severity == IssueSeverity.LOW]

            for severity_name, issues in [
                ("🔴 严重", critical_issues),
                ("🟠 高", high_issues),
                ("🟡 中", medium_issues),
                ("🟢 低", low_issues),
            ]:
                if issues:
                    lines.append(f"**{severity_name}级别问题**：")
                    lines.append("")
                    for issue in issues:
                        status = "✅ 已解决" if issue.is_resolved else "⏳ 未解决"
                        lines.append(f"- **[{status}] {issue.title}**")
                        if issue.description:
                            lines.append(f"  描述：{issue.description}")
                        if issue.reviewer_notes:
                            lines.append(f"  复核备注：{issue.reviewer_notes}")
                        lines.append("")

        if include_photos and item.photos:
            lines.append("#### 📷 取模照片")
            lines.append("")
            lines.append(f"共 {len(item.photos)} 张照片：")
            lines.append("")
            for photo in item.photos:
                taken_time = photo.taken_at.strftime('%Y-%m-%d %H:%M') if photo.taken_at else "未知"
                lines.append(f"- **{photo.photo_type.value}**：{photo.file_name}（{taken_time}）")
            lines.append("")

        if include_stl and item.stl_files:
            lines.append("#### 📁 STL文件")
            lines.append("")
            lines.append(f"共 {len(item.stl_files)} 个STL文件：")
            lines.append("")
            for stl in item.stl_files:
                jaw_info = f"（{stl.jaw}）" if stl.jaw else ""
                size_mb = stl.file_size / 1024 / 1024
                lines.append(f"- **{stl.file_name}** {jaw_info} - {size_mb:.2f} MB")
            lines.append("")

        if item.review_notes:
            lines.append("#### 📝 复核备注")
            lines.append("")
            lines.append(item.review_notes)
            lines.append("")

        lines.append("---")
        lines.append("")

        return lines
