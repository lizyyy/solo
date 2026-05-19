import pandas as pd
from io import BytesIO
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from .models import ReagentRecord, RecordStatus, ExceptionType
from .services import query_records


def export_records_to_excel(
    db: Session,
    recipient_id: Optional[int] = None,
    created_by_id: Optional[int] = None,
    approved_by_id: Optional[int] = None,
    status: Optional[RecordStatus] = None,
    exception_type: Optional[ExceptionType] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None
) -> BytesIO:
    total, records = query_records(
        db, recipient_id, created_by_id, approved_by_id,
        status, exception_type, start_date, end_date,
        page=1, page_size=10000
    )
    data = []
    for record in records:
        reagent = record.reagent
        recipient = record.recipient
        creator = record.creator
        approver = record.approver
        data.append({
            "记录ID": record.id,
            "试剂名称": reagent.name if reagent else "",
            "CAS号": reagent.cas_number if reagent else "",
            "危险等级": reagent.hazard_level.value if reagent else "",
            "领用数量": record.quantity,
            "单位": reagent.unit if reagent else "",
            "领用人": recipient.name if recipient else "",
            "领人工号": recipient.employee_id if recipient else "",
            "领用人角色": recipient.role.value if recipient else "",
            "用途": record.purpose or "",
            "状态": record.status.value,
            "异常类型": record.exception_type.value if record.exception_type != ExceptionType.NONE else "",
            "异常信息": record.exception_message or "",
            "创建人": creator.name if creator else "",
            "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S") if record.created_at else "",
            "审批人": approver.name if approver else "",
            "审批时间": record.approved_at.strftime("%Y-%m-%d %H:%M:%S") if record.approved_at else "",
            "发放时间": record.dispensed_at.strftime("%Y-%m-%d %H:%M:%S") if record.dispensed_at else "",
            "批次ID": record.batch_id or "",
            "存放位置": reagent.location if reagent else "",
            "生产厂家": reagent.manufacturer if reagent else "",
            "批号": reagent.batch_number if reagent else ""
        })
    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="领用记录")
        workbook = writer.book
        worksheet = writer.sheets["领用记录"]
        for column in worksheet.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            worksheet.column_dimensions[column_letter].width = adjusted_width
    output.seek(0)
    return output


def export_batch_operation_to_excel(batch_result: dict, operation_name: str) -> BytesIO:
    success_data = []
    failed_data = []
    for idx, record_id in enumerate(batch_result.get("success_ids", [])):
        success_data.append({
            "序号": idx + 1,
            "记录ID": record_id,
            "状态": "成功"
        })
    for item in batch_result.get("failed_items", []):
        failed_data.append({
            "序号": item.get("index", item.get("record_id", 0)),
            "记录ID": item.get("record_id", ""),
            "异常类型": item.get("exception_type", ""),
            "错误信息": item.get("message", ""),
            "状态": "失败"
        })
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        summary_data = [{
            "批次ID": batch_result.get("batch_id", ""),
            "操作类型": operation_name,
            "总数": batch_result.get("total_count", 0),
            "成功数": batch_result.get("success_count", 0),
            "失败数": batch_result.get("failed_count", 0),
            "状态": batch_result.get("status", "")
        }]
        pd.DataFrame(summary_data).to_excel(writer, index=False, sheet_name="汇总")
        if success_data:
            pd.DataFrame(success_data).to_excel(writer, index=False, sheet_name="成功记录")
        if failed_data:
            pd.DataFrame(failed_data).to_excel(writer, index=False, sheet_name="失败记录")
    output.seek(0)
    return output
