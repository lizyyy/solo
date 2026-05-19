from typing import List, Optional
import pandas as pd
from io import BytesIO
from datetime import datetime

from repository import UnitOfWork
from models import (
    Application,
    OutboundRecord,
    ReturnRecord,
    InventoryRecord,
    QueryFilter,
    PaginationParams,
    PaginatedResult,
    SummaryResult,
    ApplicationStatus,
)


class QueryService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow

    def query_applications(
        self,
        filter: QueryFilter,
        pagination: Optional[PaginationParams] = None,
    ) -> PaginatedResult[Application]:
        all_applications = self.uow.applications.query(filter)
        all_applications.sort(key=lambda a: a.created_at, reverse=True)

        if pagination is None:
            pagination = PaginationParams(page=1, page_size=len(all_applications))

        total = len(all_applications)
        start = (pagination.page - 1) * pagination.page_size
        end = start + pagination.page_size
        items = all_applications[start:end]
        total_pages = (total + pagination.page_size - 1) // pagination.page_size

        return PaginatedResult(
            items=items,
            total=total,
            page=pagination.page,
            page_size=pagination.page_size,
            total_pages=total_pages,
        )

    def query_outbounds(
        self,
        filter: QueryFilter,
        pagination: Optional[PaginationParams] = None,
    ) -> PaginatedResult[OutboundRecord]:
        all_outbounds = self.uow.outbounds.query(filter)
        all_outbounds.sort(key=lambda o: o.created_at, reverse=True)

        if pagination is None:
            pagination = PaginationParams(page=1, page_size=len(all_outbounds))

        total = len(all_outbounds)
        start = (pagination.page - 1) * pagination.page_size
        end = start + pagination.page_size
        items = all_outbounds[start:end]
        total_pages = (total + pagination.page_size - 1) // pagination.page_size

        return PaginatedResult(
            items=items,
            total=total,
            page=pagination.page,
            page_size=pagination.page_size,
            total_pages=total_pages,
        )

    def get_summary(self) -> SummaryResult:
        all_applications = self.uow.applications.list_all()
        all_outbounds = self.uow.outbounds.list_all()
        all_returns = self.uow.returns.list_all()
        all_inventories = self.uow.inventories.list_all()
        all_logs = self.uow.logs.list_all()

        pending_count = sum(
            1 for a in all_applications
            if a.status in [ApplicationStatus.PENDING, ApplicationStatus.APPROVING]
        )
        approved_count = sum(1 for a in all_applications if a.status == ApplicationStatus.APPROVED)
        rejected_count = sum(1 for a in all_applications if a.status == ApplicationStatus.REJECTED)
        completed_count = sum(1 for a in all_applications if a.status == ApplicationStatus.COMPLETED)

        exception_count = sum(1 for log in all_logs if log.exception_type.value != "无")
        dangerous_count = sum(1 for a in all_applications if a.contains_dangerous_goods)

        return SummaryResult(
            total_applications=len(all_applications),
            pending_approvals=pending_count,
            approved_applications=approved_count,
            rejected_applications=rejected_count,
            completed_applications=completed_count,
            total_outbounds=len(all_outbounds),
            total_returns=len(all_returns),
            total_inventories=len(all_inventories),
            exception_count=exception_count,
            dangerous_goods_count=dangerous_count,
        )


class ExportService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow
        self.query_service = QueryService(uow)

    def export_applications_to_excel(
        self,
        filter: QueryFilter,
        include_summary: bool = True,
    ) -> bytes:
        result = self.query_service.query_applications(filter)
        applications = result.items

        app_data = []
        for app in applications:
            for item in app.items:
                app_data.append({
                    "申请单号": app.id,
                    "申请人ID": app.applicant_id,
                    "申请人": app.applicant_name,
                    "部门": app.department or "",
                    "申请用途": app.purpose,
                    "申请状态": app.status.value,
                    "试剂名称": item.reagent_name,
                    "规格": item.specification,
                    "申请数量": item.quantity,
                    "单位": item.unit,
                    "危险等级": item.danger_level,
                    "异常类型": app.exception_type.value,
                    "异常信息": app.exception_message or "",
                    "驳回原因": app.rejection_reason or "",
                    "提交次数": app.resubmit_count + 1,
                    "创建时间": app.created_at.strftime("%Y-%m-%d %H:%M:%S") if app.created_at else "",
                    "完成时间": app.completed_at.strftime("%Y-%m-%d %H:%M:%S") if app.completed_at else "",
                })

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            if app_data:
                df_detail = pd.DataFrame(app_data)
                df_detail.to_excel(writer, sheet_name='申请明细', index=False)

            if include_summary:
                summary = self.query_service.get_summary()
                summary_data = [
                    {"指标": "总申请数", "数值": summary.total_applications},
                    {"指标": "待审批数", "数值": summary.pending_approvals},
                    {"指标": "已通过数", "数值": summary.approved_applications},
                    {"指标": "已驳回数", "数值": summary.rejected_applications},
                    {"指标": "已完成数", "数值": summary.completed_applications},
                    {"指标": "总出库数", "数值": summary.total_outbounds},
                    {"指标": "总归还数", "数值": summary.total_returns},
                    {"指标": "总盘点数", "数值": summary.total_inventories},
                    {"指标": "异常记录数", "数值": summary.exception_count},
                    {"指标": "危险品申请数", "数值": summary.dangerous_goods_count},
                ]
                df_summary = pd.DataFrame(summary_data)
                df_summary.to_excel(writer, sheet_name='统计汇总', index=False)

        return output.getvalue()

    def export_outbounds_to_excel(
        self,
        filter: QueryFilter,
    ) -> bytes:
        result = self.query_service.query_outbounds(filter)
        outbounds = result.items

        out_data = []
        for out in outbounds:
            for item in out.items:
                out_data.append({
                    "出库单号": out.id,
                    "关联申请号": out.application_id or "",
                    "操作员ID": out.operator_id,
                    "操作员": out.operator_name,
                    "领用人ID": out.receiver_id,
                    "领用人": out.receiver_name,
                    "部门": out.department or "",
                    "用途": out.purpose or "",
                    "试剂名称": item.reagent_name,
                    "规格": item.specification,
                    "批次号": item.batch_no,
                    "出库数量": item.quantity,
                    "单位": item.unit,
                    "存放位置": item.location or "",
                    "异常类型": out.exception_type.value,
                    "异常信息": out.exception_message or "",
                    "备注": out.remark or "",
                    "创建时间": out.created_at.strftime("%Y-%m-%d %H:%M:%S") if out.created_at else "",
                })

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            if out_data:
                df_detail = pd.DataFrame(out_data)
                df_detail.to_excel(writer, sheet_name='出库明细', index=False)

        return output.getvalue()

    def export_inventory_to_excel(self) -> bytes:
        inventories = self.uow.inventory.list_all()
        reagents = self.uow.reagents.list_all()
        reagent_map = {r.id: r for r in reagents}

        inv_data = []
        for inv in inventories:
            reagent = reagent_map.get(inv.reagent_id)
            inv_data.append({
                "库存ID": inv.id,
                "试剂ID": inv.reagent_id,
                "试剂名称": reagent.name if reagent else "",
                "批次号": inv.batch_no,
                "总数量": inv.quantity,
                "可用数量": inv.available_quantity,
                "单位": inv.unit,
                "存放位置": inv.location or "",
                "供应商": inv.supplier or "",
                "生产日期": inv.production_date.strftime("%Y-%m-%d") if inv.production_date else "",
                "有效期至": inv.expiry_date.strftime("%Y-%m-%d") if inv.expiry_date else "",
                "是否过期": "是" if inv.is_expired else "否",
                "危险等级": reagent.danger_level.value if reagent else "",
                "创建时间": inv.created_at.strftime("%Y-%m-%d %H:%M:%S") if inv.created_at else "",
            })

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            if inv_data:
                df_detail = pd.DataFrame(inv_data)
                df_detail.to_excel(writer, sheet_name='库存明细', index=False)

        return output.getvalue()

    def export_operation_logs_to_excel(self) -> bytes:
        logs = self.uow.logs.list_all()
        logs.sort(key=lambda l: l.created_at, reverse=True)

        log_data = []
        for log in logs:
            log_data.append({
                "日志ID": log.id,
                "操作类型": log.operation_type.value,
                "操作员ID": log.operator_id,
                "操作员": log.operator_name,
                "目标类型": log.target_type,
                "目标ID": log.target_id,
                "异常类型": log.exception_type.value,
                "异常信息": log.exception_message or "",
                "备注": log.remark or "",
                "操作时间": log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else "",
            })

        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            if log_data:
                df_detail = pd.DataFrame(log_data)
                df_detail.to_excel(writer, sheet_name='操作日志', index=False)

        return output.getvalue()

    def save_to_file(self, data: bytes, file_path: str):
        with open(file_path, 'wb') as f:
            f.write(data)
