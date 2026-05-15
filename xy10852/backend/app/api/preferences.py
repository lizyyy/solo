from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.preference import (
    PreferenceCreate, PreferenceResponse, PreferenceMergeRequest,
    ChangeHistoryResponse, SendInterceptionCreate, SendInterceptionResponse,
    AnomalyQueueResponse, ExportRequest, StatusAdvanceRequest, ValidationResult
)
from app.services.preference_service import PreferenceService
from app.services.export_service import ExportService
from app.models.models import ChannelType, BusinessScene, PreferenceStatus, InterceptionStatus

router = APIRouter(prefix="/preferences", tags=["preferences"])


@router.post("", response_model=PreferenceResponse)
def create_preference(preference_data: PreferenceCreate, db: Session = Depends(get_db)):
    service = PreferenceService(db)
    preference, success = service.create_preference(preference_data)
    db.commit()
    return preference


@router.get("", response_model=List[PreferenceResponse])
def get_preferences(
    user_id: Optional[str] = None,
    channel: Optional[ChannelType] = None,
    business_scene: Optional[BusinessScene] = None,
    status: Optional[PreferenceStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = PreferenceService(db)
    return service.get_user_preferences(user_id, channel, business_scene, status, skip, limit)


@router.get("/{preference_id}", response_model=PreferenceResponse)
def get_preference(preference_id: int, db: Session = Depends(get_db)):
    service = PreferenceService(db)
    preferences = service.get_user_preferences(skip=0, limit=1000)
    for p in preferences:
        if p.id == preference_id:
            return p
    raise HTTPException(status_code=404, detail="偏好配置未找到")


@router.post("/merge", response_model=Optional[PreferenceResponse])
def merge_preferences(request: PreferenceMergeRequest, db: Session = Depends(get_db)):
    service = PreferenceService(db)
    result = service.merge_preferences(request.user_id, request.channel, request.business_scene)
    if not result:
        raise HTTPException(status_code=404, detail="没有可合并的偏好配置")
    db.commit()
    return result


@router.get("/history", response_model=List[ChangeHistoryResponse])
def get_change_history(
    user_id: Optional[str] = None,
    preference_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = PreferenceService(db)
    return service.get_change_history(user_id, preference_id, skip, limit)


@router.post("/validate", response_model=ValidationResult)
def validate_before_send(
    validation_data: SendInterceptionCreate,
    db: Session = Depends(get_db)
):
    service = PreferenceService(db)
    result, _ = service.validate_before_send(
        validation_data.user_id,
        validation_data.channel,
        validation_data.business_scene
    )
    db.commit()
    return result


@router.get("/interceptions", response_model=List[SendInterceptionResponse])
def get_interceptions(
    user_id: Optional[str] = None,
    status: Optional[InterceptionStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = PreferenceService(db)
    return service.get_interceptions(user_id, status, skip, limit)


@router.get("/interceptions/report")
def get_interception_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from datetime import datetime
    service = PreferenceService(db)
    
    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None
    
    return service.generate_interception_report(start, end)


@router.get("/anomalies", response_model=List[AnomalyQueueResponse])
def get_anomaly_queue(
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = PreferenceService(db)
    return service.get_anomaly_queue(status, user_id, skip, limit)


@router.post("/anomalies/advance", response_model=AnomalyQueueResponse)
def advance_anomaly_status(
    request: StatusAdvanceRequest,
    db: Session = Depends(get_db)
):
    service = PreferenceService(db)
    anomaly = service.advance_anomaly_status(
        request.anomaly_id,
        request.target_status,
        request.resolution_note,
        request.resolver or "system"
    )
    if not anomaly:
        raise HTTPException(status_code=404, detail="异常记录未找到")
    db.commit()
    return anomaly


@router.post("/export/preferences")
def export_preferences(request: ExportRequest, db: Session = Depends(get_db)):
    service = ExportService(db)
    data, filename, content_type = service.export_preferences(request)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/export/history")
def export_history(request: ExportRequest, db: Session = Depends(get_db)):
    service = ExportService(db)
    data, filename, content_type = service.export_change_history(request)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/export/interceptions")
def export_interceptions(request: ExportRequest, db: Session = Depends(get_db)):
    service = ExportService(db)
    data, filename, content_type = service.export_interceptions(request)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/export/anomalies")
def export_anomalies(request: ExportRequest, db: Session = Depends(get_db)):
    service = ExportService(db)
    data, filename, content_type = service.export_anomaly_queue(request)
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/stats/summary")
def get_stats_summary(db: Session = Depends(get_db)):
    service = PreferenceService(db)
    
    from sqlalchemy import func
    from app.models.models import UserPreference, AnomalyQueue, SendInterception
    
    total_preferences = db.query(func.count(UserPreference.id)).scalar()
    active_preferences = db.query(func.count(UserPreference.id)).filter(
        UserPreference.status == PreferenceStatus.ACTIVE
    ).scalar()
    total_anomalies = db.query(func.count(AnomalyQueue.id)).scalar()
    pending_anomalies = db.query(func.count(AnomalyQueue.id)).filter(
        AnomalyQueue.status == "pending"
    ).scalar()
    total_interceptions = db.query(func.count(SendInterception.id)).scalar()
    blocked_interceptions = db.query(func.count(SendInterception.id)).filter(
        SendInterception.status == InterceptionStatus.BLOCKED
    ).scalar()
    
    return {
        "preferences": {
            "total": total_preferences,
            "active": active_preferences
        },
        "anomalies": {
            "total": total_anomalies,
            "pending": pending_anomalies
        },
        "interceptions": {
            "total": total_interceptions,
            "blocked": blocked_interceptions,
            "block_rate": blocked_interceptions / total_interceptions if total_interceptions > 0 else 0
        }
    }
