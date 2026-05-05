from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.db.database import get_db
from app.schemas.schemas import ApiResponse, HandoffRecordResponse, StatusChangeRequest
from app.models.models import PatientStatus
from app.services.status_service import StatusJudgmentService

router = APIRouter()

@router.post("/create", response_model=ApiResponse)
async def create_handoff(
    patient_id: str = Body(..., embed=True, description="患者ID"),
    shift_date: Optional[str] = Body(None, embed=True, description="交接日期 YYYY-MM-DD"),
    nurse_name: Optional[str] = Body(None, embed=True, description="护士姓名"),
    review_notes: Optional[str] = Body(None, embed=True, description="复核备注"),
    db: Session = Depends(get_db)
):
    service = StatusJudgmentService(db)
    
    if shift_date:
        try:
            shift_dt = datetime.strptime(shift_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误, 请使用 YYYY-MM-DD")
    else:
        shift_dt = datetime.now()
    
    handoff = service.create_handoff_record(
        patient_id=patient_id,
        shift_date=shift_dt,
        nurse_name=nurse_name,
        review_notes=review_notes
    )
    
    return ApiResponse(
        success=True,
        message=f"创建交接记录成功: {handoff.handoff_id}",
        data=HandoffRecordResponse.from_orm(handoff).dict()
    )

@router.put("/status/{handoff_id}", response_model=ApiResponse)
async def change_status(
    handoff_id: str,
    request: StatusChangeRequest,
    db: Session = Depends(get_db)
):
    service = StatusJudgmentService(db)
    
    handoff = service.update_handoff_status(
        handoff_id=handoff_id,
        new_status=request.new_status,
        review_notes=request.review_notes,
        reviewed_by=request.reviewed_by
    )
    
    if not handoff:
        raise HTTPException(status_code=404, detail=f"交接记录 {handoff_id} 不存在")
    
    return ApiResponse(
        success=True,
        message=f"状态改判成功: {request.new_status.value}",
        data=HandoffRecordResponse.from_orm(handoff).dict()
    )

@router.put("/notes/{handoff_id}", response_model=ApiResponse)
async def add_review_notes(
    handoff_id: str,
    notes: str = Body(..., embed=True, description="复核备注"),
    reviewed_by: Optional[str] = Body(None, embed=True, description="复核人"),
    db: Session = Depends(get_db)
):
    service = StatusJudgmentService(db)
    
    handoff = service.get_handoff_record(handoff_id)
    if not handoff:
        raise HTTPException(status_code=404, detail=f"交接记录 {handoff_id} 不存在")
    
    existing_notes = handoff.nurse_review_notes or ""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_notes = f"{existing_notes}\n[{timestamp}] {reviewed_by or '护士'}: {notes}".strip()
    
    handoff.nurse_review_notes = new_notes
    db.commit()
    db.refresh(handoff)
    
    return ApiResponse(
        success=True,
        message="添加复核备注成功",
        data=HandoffRecordResponse.from_orm(handoff).dict()
    )

@router.post("/batch-create", response_model=ApiResponse)
async def create_batch_handoffs(
    patient_ids: list = Body(..., embed=True, description="患者ID列表"),
    shift_date: Optional[str] = Body(None, embed=True, description="交接日期 YYYY-MM-DD"),
    nurse_name: Optional[str] = Body(None, embed=True, description="护士姓名"),
    db: Session = Depends(get_db)
):
    service = StatusJudgmentService(db)
    
    if shift_date:
        try:
            shift_dt = datetime.strptime(shift_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误, 请使用 YYYY-MM-DD")
    else:
        shift_dt = datetime.now()
    
    results = []
    errors = []
    
    for patient_id in patient_ids:
        try:
            handoff = service.create_handoff_record(
                patient_id=patient_id,
                shift_date=shift_dt,
                nurse_name=nurse_name
            )
            results.append({
                "patient_id": patient_id,
                "handoff_id": handoff.handoff_id,
                "status": handoff.status.value,
                "success": True
            })
        except Exception as e:
            errors.append({
                "patient_id": patient_id,
                "error": str(e)
            })
    
    return ApiResponse(
        success=len(errors) == 0,
        message=f"批量创建完成: 成功 {len(results)} 条, 失败 {len(errors)} 条",
        data={
            "success_count": len(results),
            "failed_count": len(errors),
            "results": results,
            "errors": errors
        }
    )
