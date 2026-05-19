from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import pandas as pd
from io import BytesIO
from datetime import datetime
from database import get_db
import models
import schemas
import services

router = APIRouter(tags=["数据导出"])


@router.post("/records")
async def export_records(
    params: schemas.QueryParams,
    db: Session = Depends(get_db)
):
    records = services.get_all_records_for_export(db, params)

    data = []
    for rec in records:
        data.append({
            "记录编号": rec.record_number,
            "设备编号": rec.equipment_code,
            "设备名称": rec.equipment_name,
            "楼层": rec.floor,
            "区域": rec.area,
            "维保人员": rec.maintenance_person,
            "维保日期": rec.inspection_date.strftime('%Y-%m-%d') if rec.inspection_date else "",
            "下次维保日期": rec.next_inspection_date.strftime('%Y-%m-%d') if rec.next_inspection_date else "",
            "状态": rec.status,
            "是否异常": "是" if rec.has_exception else "否",
            "异常类型": rec.exception_types or "",
            "异常原因": rec.exception_reason or "",
            "处理说明": rec.readable_explanation or "",
            "处理人": rec.handled_by or "",
            "处理时间": rec.handled_at.strftime('%Y-%m-%d %H:%M:%S') if rec.handled_at else "",
            "处理备注": rec.handler_notes or "",
            "创建时间": rec.created_at.strftime('%Y-%m-%d %H:%M:%S') if rec.created_at else ""
        })

    df = pd.DataFrame(data)

    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='维保记录')

    output.seek(0)

    filename = f"维保记录导出_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/records/{record_id}/proof")
async def export_record_proof(
    record_id: int,
    db: Session = Depends(get_db)
):
    record = services.get_record_detail(db, record_id)
    if not record:
        return {"error": "记录不存在"}

    audit_logs = services.get_audit_logs_by_record(db, record_id)

    data = {
        "基本信息": [
            {"项目": "记录编号", "值": record.record_number},
            {"项目": "设备编号", "值": record.equipment_code},
            {"项目": "设备名称", "值": record.equipment_name},
            {"项目": "楼层", "值": record.floor or ""},
            {"项目": "区域", "值": record.area or ""},
            {"项目": "维保人员", "值": record.maintenance_person or ""},
            {"项目": "下次维保日期", "值": str(record.next_inspection_date) if record.next_inspection_date else ""},
            {"项目": "当前状态", "值": record.status},
            {"项目": "是否异常", "值": "是" if record.has_exception else "否"},
        ],
        "异常说明": [
            {"项目": "异常类型", "值": record.exception_types or ""},
            {"项目": "异常原因", "值": record.exception_reason or ""},
            {"项目": "处理说明", "值": record.readable_explanation or ""},
        ],
        "处理信息": [
            {"项目": "处理人", "值": record.handled_by or ""},
            {"项目": "处理时间", "值": str(record.handled_at) if record.handled_at else ""},
            {"项目": "处理备注", "值": record.handler_notes or ""},
        ],
        "操作历史": []
    }

    for log in audit_logs:
        data["操作历史"].append({
            "操作时间": str(log.action_at),
            "操作人": log.action_by,
            "操作类型": log.action_type,
            "原状态": log.from_status or "",
            "新状态": log.to_status or "",
            "原因": log.reason or "",
            "备注": log.notes or ""
        })

    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        pd.DataFrame(data["基本信息"]).to_excel(writer, index=False, sheet_name='基本信息')
        pd.DataFrame(data["异常说明"]).to_excel(writer, index=False, sheet_name='异常说明')
        pd.DataFrame(data["处理信息"]).to_excel(writer, index=False, sheet_name='处理信息')
        pd.DataFrame(data["操作历史"]).to_excel(writer, index=False, sheet_name='操作历史')

    output.seek(0)

    filename = f"维保记录证明_{record.record_number}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/exceptions/summary")
def get_exceptions_summary(db: Session = Depends(get_db)):
    total_records = db.query(models.MaintenanceRecord).count()
    exception_records = db.query(models.MaintenanceRecord).filter(
        models.MaintenanceRecord.has_exception == True
    ).count()

    overdue_count = db.query(models.MaintenanceRecord).filter(
        models.MaintenanceRecord.exception_types.contains("overdue")
    ).count()

    multiple_contracts_count = db.query(models.MaintenanceRecord).filter(
        models.MaintenanceRecord.exception_types.contains("multiple_contracts")
    ).count()

    missing_photo_count = db.query(models.MaintenanceRecord).filter(
        models.MaintenanceRecord.exception_types.contains("missing_photo")
    ).count()

    no_contract_count = db.query(models.MaintenanceRecord).filter(
        models.MaintenanceRecord.exception_types.contains("no_contract")
    ).count()

    return {
        "total_records": total_records,
        "exception_records": exception_records,
        "exception_rate": round(exception_records / total_records * 100, 2) if total_records > 0 else 0,
        "breakdown": {
            "overdue": {
                "count": overdue_count,
                "name": "过期未检",
                "description": "设备维保日期已过期，需立即安排补检"
            },
            "multiple_contracts": {
                "count": multiple_contracts_count,
                "name": "同设备多合同",
                "description": "同一设备存在多份有效维保合同，需确认是否重复付费"
            },
            "missing_photo": {
                "count": missing_photo_count,
                "name": "照片缺失",
                "description": "巡检无现场照片，需补充影像资料佐证"
            },
            "no_contract": {
                "count": no_contract_count,
                "name": "无有效合同",
                "description": "设备无有效维保合同，需立即联系供应商签署"
            }
        }
    }
