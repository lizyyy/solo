from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, date

from app.db.database import get_db
from app.schemas.schemas import ApiResponse, HandoffRecordResponse, PatientSummary
from app.models.models import PatientStatus, HandoffRecord, AnesthesiaRecord
from app.services.status_service import StatusJudgmentService
from app.services.anomaly_service import AnomalyDetectionService

router = APIRouter()

@router.get("/handoff/{handoff_id}", response_model=ApiResponse)
async def get_handoff(
    handoff_id: str,
    db: Session = Depends(get_db)
):
    service = StatusJudgmentService(db)
    handoff = service.get_handoff_record(handoff_id)
    
    if not handoff:
        raise HTTPException(status_code=404, detail=f"交接记录 {handoff_id} 不存在")
    
    return ApiResponse(
        success=True,
        message="获取交接记录成功",
        data=HandoffRecordResponse.from_orm(handoff).dict()
    )

@router.get("/patient/{patient_id}", response_model=ApiResponse)
async def get_patient_handoffs(
    patient_id: str,
    db: Session = Depends(get_db)
):
    service = StatusJudgmentService(db)
    handoffs = service.get_patient_handoffs(patient_id)
    
    return ApiResponse(
        success=True,
        message=f"获取患者 {patient_id} 的交接记录共 {len(handoffs)} 条",
        data=[HandoffRecordResponse.from_orm(h).dict() for h in handoffs]
    )

@router.get("/all", response_model=ApiResponse)
async def get_all_handoffs(
    start_date: Optional[str] = Query(None, description="开始日期 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期 YYYY-MM-DD"),
    status: Optional[PatientStatus] = Query(None, description="状态筛选"),
    db: Session = Depends(get_db)
):
    service = StatusJudgmentService(db)
    
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误, 请使用 YYYY-MM-DD")
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误, 请使用 YYYY-MM-DD")
    
    handoffs = service.get_all_handoffs(start_dt, end_dt, status)
    
    return ApiResponse(
        success=True,
        message=f"获取交接记录共 {len(handoffs)} 条",
        data=[HandoffRecordResponse.from_orm(h).dict() for h in handoffs]
    )

@router.get("/anomaly/check/{patient_id}", response_model=ApiResponse)
async def check_patient_anomalies(
    patient_id: str,
    db: Session = Depends(get_db)
):
    service = AnomalyDetectionService(db)
    results = service.check_all_anomalies(patient_id)
    
    return ApiResponse(
        success=True,
        message="异常检测完成",
        data=results
    )

@router.get("/status/determine/{patient_id}", response_model=ApiResponse)
async def determine_patient_status(
    patient_id: str,
    db: Session = Depends(get_db)
):
    service = StatusJudgmentService(db)
    result = service.determine_patient_status(patient_id)
    
    return ApiResponse(
        success=True,
        message=f"状态判定: {result['status'].value}",
        data={
            "patient_id": patient_id,
            "status": result["status"].value,
            "status_reason": result["status_reason"],
            "high_risk_count": result["high_risk_count"],
            "medium_risk_count": result["medium_risk_count"],
            "has_awakening_timeout": result["has_awakening_timeout"],
            "has_infusion_interruption": result["has_infusion_interruption"],
            "has_temp_oxygen_abnormal": result["has_temp_oxygen_abnormal"],
            "has_medication_conflicts": result["has_medication_conflicts"],
            "abnormal_details": result["abnormal_details"]
        }
    )

@router.get("/summary/{patient_id}", response_model=ApiResponse)
async def get_patient_summary(
    patient_id: str,
    db: Session = Depends(get_db)
):
    anomaly_service = AnomalyDetectionService(db)
    status_service = StatusJudgmentService(db)
    
    anesthesia = db.query(AnesthesiaRecord).filter(
        AnesthesiaRecord.patient_id == patient_id
    ).order_by(AnesthesiaRecord.created_at.desc()).first()
    
    anomalies = anomaly_service.check_all_anomalies(patient_id)
    status_result = status_service.determine_patient_status(patient_id)
    
    handoff = status_service.get_handoff_record(
        db.query(HandoffRecord).filter(
            HandoffRecord.patient_id == patient_id
        ).order_by(HandoffRecord.created_at.desc()).first().handoff_id
    ) if db.query(HandoffRecord).filter(HandoffRecord.patient_id == patient_id).first() else None
    
    summary = PatientSummary(
        patient_id=patient_id,
        patient_name=anesthesia.patient_name if anesthesia else None,
        species=anesthesia.species if anesthesia else None,
        breed=anesthesia.breed if anesthesia else None,
        anesthesia_status=anomalies["awakening_timeout"]["details"],
        awakening_timeout=anomalies["awakening_timeout"]["has_timeout"],
        infusion_status=anomalies["infusion_interruption"]["details"],
        has_infusion_interruption=anomalies["infusion_interruption"]["has_interruption"],
        temperature_status=anomalies["temp_oxygen_abnormal"]["details"],
        oxygen_status=anomalies["temp_oxygen_abnormal"]["details"],
        medication_count=len(anomalies["medication_conflicts"].get("active_medications", [])),
        has_medication_conflict=anomalies["medication_conflicts"]["has_conflict"],
        overall_status=status_result["status"],
        handoff_id=handoff.handoff_id if handoff else None
    )
    
    return ApiResponse(
        success=True,
        message="获取患者摘要成功",
        data=summary.dict()
    )
