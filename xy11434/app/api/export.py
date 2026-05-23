from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from typing import Optional
from sqlalchemy.orm import Session
from datetime import datetime
import io
import csv

from app.database import get_db
from app.models import User, RoleEnum, ConsumableRecord, RecordType, WorkflowStatus, DirtyRecord
from app.schemas import ExportRequest
from app.security import RoleChecker, mask_sensitive_data
from app.services import AutoChecker
import pandas as pd

router = APIRouter(prefix="/export", tags=["数据导出"])


@router.post("/records")
def export_records(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SUPERVISOR, RoleEnum.SECRETARY]))
):
    query = db.query(ConsumableRecord)

    if export_request.record_type:
        query = query.filter(ConsumableRecord.record_type == export_request.record_type)
    if export_request.status:
        query = query.filter(ConsumableRecord.status == export_request.status)
    if export_request.start_date:
        query = query.filter(ConsumableRecord.created_at >= export_request.start_date)
    if export_request.end_date:
        query = query.filter(ConsumableRecord.created_at <= export_request.end_date)

    records = query.order_by(ConsumableRecord.created_at.desc()).all()

    data = []
    for record in records:
        record_dict = {
            "记录编号": record.record_no,
            "记录类型": record.record_type.value,
            "标题": record.title,
            "部门": record.department,
            "课题组": record.research_group,
            "老师姓名": record.teacher_name,
            "耗材名称": record.material_name,
            "规格": record.specification,
            "数量": record.quantity,
            "单位": record.unit,
            "单价": record.unit_price,
            "总金额": record.total_amount,
            "供应商": record.supplier,
            "采购单号": record.purchase_order_no,
            "状态": record.status.value,
            "版本": record.version,
            "是否脏数据": "是" if record.is_dirty else "否",
            "创建人ID": record.created_by,
            "创建时间": record.created_at.strftime("%Y-%m-%d %H:%M:%S") if record.created_at else "",
            "驳回原因": record.reject_reason,
            "备注": record.remarks
        }

        if not export_request.include_sensitive:
            record_dict = mask_sensitive_data(record_dict)

        data.append(record_dict)

    df = pd.DataFrame(data)

    if export_request.export_format == "excel":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='耗材记录')

            dirty_df = pd.DataFrame(export_dirty_records_data(db))
            if not dirty_df.empty:
                dirty_df.to_excel(writer, index=False, sheet_name='脏数据记录')

            workbook = writer.book
            worksheet = writer.sheets['耗材记录']
            for idx, col in enumerate(df.columns):
                max_len = max(df[col].astype(str).str.len().max(), len(col)) + 2
                worksheet.column_dimensions[chr(65 + idx)].width = min(max_len, 50)

        output.seek(0)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"consumable_records_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
    else:
        output = io.StringIO()
        df.to_csv(output, index=False, quoting=csv.QUOTE_ALL)
        output.seek(0)
        media_type = "text/csv"
        filename = f"consumable_records_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"

    from app.services import AuditService
    AuditService.log_action(db, current_user, "export_records", "export", None,
                           {"format": export_request.export_format, "include_sensitive": export_request.include_sensitive})

    return StreamingResponse(
        output,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


def export_dirty_records_data(db: Session):
    dirty_records = db.query(DirtyRecord).order_by(DirtyRecord.created_at.desc()).all()
    data = []
    for dirty in dirty_records:
        data.append({
            "脏记录ID": dirty.id,
            "关联记录ID": dirty.original_record_id,
            "脏数据类型": dirty.dirty_type.value,
            "字段名": dirty.field_name,
            "原始值": dirty.original_value,
            "期望值": dirty.expected_value,
            "冲突描述": dirty.conflict_description,
            "处理意见": dirty.processing_opinion,
            "是否已解决": "是" if dirty.is_resolved else "否",
            "处理人ID": dirty.resolved_by,
            "处理时间": dirty.resolved_at.strftime("%Y-%m-%d %H:%M:%S") if dirty.resolved_at else "",
            "创建时间": dirty.created_at.strftime("%Y-%m-%d %H:%M:%S") if dirty.created_at else ""
        })
    return data


@router.get("/auto-check")
def run_auto_check(
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SUPERVISOR, RoleEnum.SECRETARY]))
):
    results = AutoChecker.run_all_checks(db)

    from app.services import AuditService
    AuditService.log_action(db, current_user, "run_auto_check", "auto_check")

    return {
        "check_time": datetime.now().isoformat(),
        "results": results,
        "summary": {
            "total_checks": len(results),
            "passed_checks": sum(1 for r in results.values() if r.get("passed", False)),
            "failed_checks": sum(1 for r in results.values() if not r.get("passed", True))
        }
    }


@router.post("/workflow-traces")
def export_workflow_traces(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SUPERVISOR, RoleEnum.SECRETARY]))
):
    from app.models import WorkflowLog

    query = db.query(WorkflowLog).join(ConsumableRecord)

    if export_request.record_type:
        query = query.filter(ConsumableRecord.record_type == export_request.record_type)
    if export_request.start_date:
        query = query.filter(WorkflowLog.created_at >= export_request.start_date)
    if export_request.end_date:
        query = query.filter(WorkflowLog.created_at <= export_request.end_date)

    logs = query.order_by(WorkflowLog.created_at.desc()).all()

    data = []
    for log in logs:
        data.append({
            "记录ID": log.record_id,
            "动作": log.action,
            "原状态": log.from_status.value if log.from_status else "",
            "目标状态": log.to_status.value if log.to_status else "",
            "操作人": log.operator_name,
            "操作人角色": log.operator_role.value if log.operator_role else "",
            "变更原因": log.change_reason,
            "备注": log.remarks,
            "操作时间": log.created_at.strftime("%Y-%m-%d %H:%M:%S") if log.created_at else ""
        })

    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='变更轨迹')

    output.seek(0)
    filename = f"workflow_traces_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

    from app.services import AuditService
    AuditService.log_action(db, current_user, "export_traces", "export")

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
