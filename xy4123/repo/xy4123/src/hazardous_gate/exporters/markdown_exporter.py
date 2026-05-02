from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from hazardous_gate.models.database import CourseUsage, ReturnRecord, UsageStatus
from hazardous_gate.storage.crud import CourseUsageCRUD


class MarkdownExporter:
    @staticmethod
    def format_decimal(value: Optional[Decimal]) -> str:
        if value is None:
            return "N/A"
        return f"{value.normalize():f}"

    @staticmethod
    def format_date(value: Optional[date]) -> str:
        if value is None:
            return "N/A"
        return value.strftime("%Y-%m-%d")

    @staticmethod
    def format_datetime(value: Optional[datetime]) -> str:
        if value is None:
            return "N/A"
        return value.strftime("%Y-%m-%d %H:%M:%S")

    @classmethod
    async def export_usage_trace(
        cls,
        db: AsyncSession,
        usage_id: int,
    ) -> str:
        usage = await CourseUsageCRUD.get_by_id(db, usage_id, load_items=True)
        if not usage:
            return "# 追溯报告\n\n**错误：未找到领用单**"

        from hazardous_gate.storage.crud import ReturnRecordCRUD
        return_records = await ReturnRecordCRUD.get_by_usage(db, usage_id)

        lines = []

        lines.append("# 危化品领用追溯报告")
        lines.append("")
        lines.append(f"> 生成时间: {cls.format_datetime(datetime.now())}")
        lines.append("")

        lines.append("## 一、领用单基本信息")
        lines.append("")
        lines.append("| 字段 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 领用单号 | {usage.usage_number} |")
        lines.append(f"| 课程名称 | {usage.course_name} |")
        lines.append(f"| 教师姓名 | {usage.teacher_name} |")
        lines.append(f"| 教师工号 | {usage.teacher_id} |")
        lines.append(f"| 班级 | {usage.class_name or 'N/A'} |")
        lines.append(f"| 学生人数 | {usage.student_count or 'N/A'} |")
        lines.append(f"| 实验日期 | {cls.format_date(usage.experiment_date)} |")
        lines.append(f"| 状态 | {usage.status.value if isinstance(usage.status, UsageStatus) else usage.status} |")
        lines.append(f"| 审批人 | {usage.approved_by or 'N/A'} |")
        lines.append(f"| 审批时间 | {cls.format_datetime(usage.approved_at)} |")
        lines.append(f"| 废液去向 | {usage.waste_destination or 'N/A'} |")
        lines.append(f"| 备注 | {usage.remarks or 'N/A'} |")
        lines.append("")

        lines.append("## 二、领用试剂明细")
        lines.append("")
        lines.append("| 序号 | 试剂名称 | CAS号 | 批号 | 浓度 | 单位 | 申请数量 | 批准数量 | 已发放 | 已归还 | 已废弃 |")
        lines.append("|------|----------|-------|------|------|------|----------|----------|--------|--------|--------|")

        for idx, item in enumerate(usage.items, 1):
            batch = item.batch
            reagent = batch.reagent if batch else None
            reagent_name = reagent.name if reagent else "N/A"
            cas_number = reagent.cas_number if reagent else "N/A"
            batch_number = batch.batch_number if batch else "N/A"

            conc_val = cls.format_decimal(batch.concentration if batch else None)
            conc_unit = batch.concentration_unit if batch else ""
            concentration = f"{conc_val} {conc_unit}" if conc_val != "N/A" else "N/A"

            lines.append(
                f"| {idx} | {reagent_name} | {cas_number} | {batch_number} | "
                f"{concentration} | {item.unit} | "
                f"{cls.format_decimal(item.requested_quantity)} | "
                f"{cls.format_decimal(item.approved_quantity)} | "
                f"{cls.format_decimal(item.issued_quantity)} | "
                f"{cls.format_decimal(item.returned_quantity)} | "
                f"{cls.format_decimal(item.waste_quantity)} |"
            )
        lines.append("")

        has_safe_info = any(
            item.batch and item.batch.reagent for item in usage.items
        )
        if has_safe_info:
            lines.append("## 三、试剂安全信息")
            lines.append("")
            added_reagents: set[int] = set()
            for item in usage.items:
                batch = item.batch
                reagent = batch.reagent if batch else None
                if not reagent:
                    continue
                if reagent.id in added_reagents:
                    continue
                added_reagents.add(reagent.id)

                lines.append(f"### {reagent.name} ({reagent.cas_number})")
                lines.append("")

                hazard_level = reagent.hazard_level
                if hasattr(hazard_level, 'value'):
                    hazard_str = hazard_level.value
                else:
                    hazard_str = str(hazard_level)
                lines.append(f"- **危险等级**: {hazard_str}")

                storage_group = reagent.storage_group
                if hasattr(storage_group, 'value'):
                    storage_str = storage_group.value
                else:
                    storage_str = str(storage_group)
                lines.append(f"- **储存分组**: {storage_str}")

                lines.append(f"- **储柜分类**: {reagent.cabinet_type}")
                lines.append(f"- **最低授权等级**: {reagent.min_authorization_level}")
                if reagent.safety_info:
                    lines.append(f"- **安全信息**: {reagent.safety_info}")
                lines.append("")

        if return_records:
            lines.append("## 四、归还/废弃记录")
            lines.append("")

            for record in return_records:
                lines.append(f"### {record.return_type}记录: {record.return_number}")
                lines.append("")
                lines.append("| 字段 | 值 |")
                lines.append("|------|-----|")
                lines.append(f"| 处理人 | {record.handler} |")
                lines.append(f"| 归还数量 | {cls.format_decimal(record.total_returned_quantity)} |")
                lines.append(f"| 废弃数量 | {cls.format_decimal(record.total_waste_quantity)} |")
                lines.append(f"| 废液去向 | {record.waste_destination or 'N/A'} |")
                lines.append(f"| 容器状态 | {record.container_status or 'N/A'} |")
                lines.append(f"| 时间 | {cls.format_datetime(record.created_at)} |")
                lines.append("")

                if record.items:
                    lines.append("**明细:**")
                    lines.append("")
                    lines.append("| 试剂 | 归还数量 | 废弃数量 | 单位 | 状况 | 备注 |")
                    lines.append("|------|----------|----------|------|------|------|")
                    for r_item in record.items:
                        usage_item = None
                        for u_item in usage.items:
                            if u_item.id == r_item.usage_item_id:
                                usage_item = u_item
                                break
                        reagent_name = "N/A"
                        if usage_item and usage_item.batch and usage_item.batch.reagent:
                            reagent_name = usage_item.batch.reagent.name
                        lines.append(
                            f"| {reagent_name} | {cls.format_decimal(r_item.returned_quantity)} | "
                            f"{cls.format_decimal(r_item.waste_quantity)} | {r_item.unit} | "
                            f"{r_item.condition or 'N/A'} | {r_item.remarks or 'N/A'} |"
                        )
                    lines.append("")

        lines.append("## 五、追溯摘要")
        lines.append("")

        total_requested = sum(item.requested_quantity for item in usage.items)
        total_issued = sum(item.issued_quantity or Decimal("0") for item in usage.items)
        total_returned = sum(item.returned_quantity for item in usage.items)
        total_waste = sum(item.waste_quantity for item in usage.items)

        lines.append(f"- **申请试剂总数**: {cls.format_decimal(total_requested)}")
        lines.append(f"- **实际发放总数**: {cls.format_decimal(total_issued)}")
        lines.append(f"- **已归还总数**: {cls.format_decimal(total_returned)}")
        lines.append(f"- **已废弃总数**: {cls.format_decimal(total_waste)}")

        if total_issued > 0:
            remaining = total_issued - total_returned - total_waste
            lines.append(f"- **剩余未结清**: {cls.format_decimal(remaining)}")

        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("*本报告由危化品领用闸门系统自动生成*")

        return "\n".join(lines)

    @classmethod
    async def export_usage_list_summary(
        cls,
        usages: list[CourseUsage],
        title: str = "领用单汇总报告",
    ) -> str:
        lines = []

        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"> 生成时间: {cls.format_datetime(datetime.now())}")
        lines.append(f"> 共 {len(usages)} 条记录")
        lines.append("")

        lines.append("## 汇总表")
        lines.append("")
        lines.append("| 领用单号 | 课程 | 教师 | 实验日期 | 状态 | 审批人 | 生成时间 |")
        lines.append("|----------|------|------|----------|------|--------|----------|")

        for usage in usages:
            lines.append(
                f"| {usage.usage_number} | {usage.course_name} | {usage.teacher_name} | "
                f"{cls.format_date(usage.experiment_date)} | "
                f"{usage.status.value if hasattr(usage.status, 'value') else usage.status} | "
                f"{usage.approved_by or 'N/A'} | "
                f"{cls.format_datetime(usage.created_at)} |"
            )

        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("*本报告由危化品领用闸门系统自动生成*")

        return "\n".join(lines)
