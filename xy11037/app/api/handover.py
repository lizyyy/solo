from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse

from app.models.models import HandoverRecord, HandoverHistory, ShiftStatus
from app.models.database import db
from app.schemas.handover import (
    HandoverCreate,
    HandoverUpdate,
    HandoverSign,
    HandoverWithdraw,
    HandoverManualProcess,
    HandoverManualComplete,
    ErrorResponse
)

router = APIRouter(prefix="/api/handover", tags=["handover"])


@router.post("/", response_model=HandoverRecord, summary="创建交接记录")
async def create_handover(data: HandoverCreate):
    try:
        record = db.create_record(data.model_dump())
        return record
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=ErrorResponse(
                error="创建失败",
                detail=str(e),
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )


@router.get("/", response_model=List[HandoverRecord], summary="获取交接记录列表")
async def list_handovers(
    status: ShiftStatus = None,
    shift_date: str = None,
    nurse_name: str = None
):
    records = db.list_records()
    
    if status:
        records = [r for r in records if r.status == status]
    if shift_date:
        records = [r for r in records if r.shift_date == shift_date]
    if nurse_name:
        records = [r for r in records if nurse_name in [r.on_duty_nurse, r.off_duty_nurse]]
    
    return records


@router.get("/{record_id}", response_model=HandoverRecord, summary="获取交接记录详情")
async def get_handover(record_id: str):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error="记录不存在",
                detail=f"ID为 {record_id} 的交接记录未找到",
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )
    return record


@router.get("/{record_id}/history", response_model=List[HandoverHistory], summary="获取修改历史")
async def get_handover_history(record_id: str):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error="记录不存在",
                detail=f"ID为 {record_id} 的交接记录未找到",
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )
    return db.get_history(record_id)


@router.put("/{record_id}", response_model=HandoverRecord, summary="更新交接记录")
async def update_handover(record_id: str, data: HandoverUpdate):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error="记录不存在",
                detail=f"ID为 {record_id} 的交接记录未找到",
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )
    
    remarks = data.remarks or ""
    update_data = {k: v for k, v in data.model_dump().items() if v is not None and k != "remarks"}
    
    updated = db.update_record(record_id, update_data, "系统", remarks)
    return updated


@router.post("/{record_id}/submit", response_model=HandoverRecord, summary="提交交接记录")
async def submit_handover(record_id: str, submitted_by: str = Query(..., description="提交人姓名")):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error="记录不存在",
                detail=f"ID为 {record_id} 的交接记录未找到",
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )
    
    if record.status not in [ShiftStatus.DRAFT, ShiftStatus.WITHDRAWN]:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error="状态错误",
                detail=f"只有草稿或已撤回状态的记录才能提交，当前状态: {record.status}",
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )
    
    return db.submit_record(record_id, submitted_by)


@router.post("/{record_id}/withdraw", response_model=HandoverRecord, summary="撤回交接记录")
async def withdraw_handover(record_id: str, data: HandoverWithdraw):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error="记录不存在",
                detail=f"ID为 {record_id} 的交接记录未找到",
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )
    
    if record.status not in [ShiftStatus.SUBMITTED, ShiftStatus.PENDING_MANUAL]:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error="状态错误",
                detail=f"只有已提交或待人工处理状态的记录才能撤回，当前状态: {record.status}",
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )
    
    return db.withdraw_record(record_id, data.withdrawn_by, data.reason)


@router.post("/{record_id}/sign", response_model=HandoverRecord, summary="签字确认")
async def sign_handover(record_id: str, data: HandoverSign):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error="记录不存在",
                detail=f"ID为 {record_id} 的交接记录未找到",
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )
    
    if data.signer not in [record.on_duty_nurse, record.off_duty_nurse]:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error="无权签字",
                detail=f"只有交接双方 {record.on_duty_nurse} 和 {record.off_duty_nurse} 可以签字",
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )
    
    return db.sign_record(record_id, data.signer, data.signature)


@router.post("/{record_id}/manual-process", response_model=HandoverRecord, summary="标记人工处理")
async def flag_manual_process(record_id: str, data: HandoverManualProcess):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error="记录不存在",
                detail=f"ID为 {record_id} 的交接记录未找到",
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )
    
    return db.flag_manual_process(record_id, data.flagged_by, data.reason)


@router.post("/{record_id}/manual-complete", response_model=HandoverRecord, summary="完成人工处理")
async def complete_manual_process(record_id: str, data: HandoverManualComplete):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error="记录不存在",
                detail=f"ID为 {record_id} 的交接记录未找到",
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )
    
    if record.status != ShiftStatus.PENDING_MANUAL:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error="状态错误",
                detail=f"只有待人工处理状态的记录才能完成人工处理，当前状态: {record.status}",
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )
    
    return db.process_manual(record_id, data.processed_by, data.notes, data.new_status)


@router.get("/{record_id}/export", summary="导出交接记录")
async def export_handover(record_id: str, format: str = Query("json", description="导出格式: json 或 table")):
    record = db.get_record(record_id)
    if not record:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error="记录不存在",
                detail=f"ID为 {record_id} 的交接记录未找到",
                timestamp=datetime.now().isoformat()
            ).model_dump()
        )
    
    business_data = {
        "交接编号": record.id,
        "交接日期": record.shift_date,
        "班次类型": record.shift_type,
        "接班护士": record.on_duty_nurse,
        "交班护士": record.off_duty_nurse,
        "接班签字": record.on_duty_signature or "未签字",
        "交班签字": record.off_duty_signature or "未签字",
        "状态": record.status,
        "新生儿数量": record.baby_count,
        "产妇情况记录": record.maternal_conditions,
        "新生儿情况记录": record.baby_conditions,
        "特殊注意事项": record.special_notes,
        "设备状态": record.equipment_status,
        "急救物品检查": record.emergency_supplies,
        "下一班工作任务": record.next_shift_tasks,
        "人工处理备注": record.manual_process_notes,
        "版本号": record.version,
        "创建时间": record.created_at.isoformat(),
        "更新时间": record.updated_at.isoformat(),
        "修改历史": record.history
    }
    
    if format == "table":
        import io
        import csv
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        writer.writerow(["字段", "内容"])
        for key, value in business_data.items():
            if isinstance(value, list):
                writer.writerow([key, "详见下方详情"])
            else:
                writer.writerow([key, value])
        
        return JSONResponse(
            content={
                "format": "table",
                "data": business_data,
                "csv_preview": output.getvalue()
            }
        )
    
    return JSONResponse(content=business_data)


@router.get("/export/all", summary="批量导出所有交接记录")
async def export_all_handovers(format: str = Query("json", description="导出格式: json 或 table")):
    records = db.list_records()
    
    business_list = []
    for record in records:
        business_data = {
            "交接编号": record.id,
            "交接日期": record.shift_date,
            "班次类型": record.shift_type,
            "接班护士": record.on_duty_nurse,
            "交班护士": record.off_duty_nurse,
            "状态": record.status,
            "新生儿数量": record.baby_count,
            "特殊注意事项": record.special_notes,
            "版本号": record.version,
            "创建时间": record.created_at.isoformat(),
            "更新时间": record.updated_at.isoformat()
        }
        business_list.append(business_data)
    
    return JSONResponse(content=business_list)
