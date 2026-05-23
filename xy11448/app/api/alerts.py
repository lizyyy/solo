from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.auth import get_current_active_user, allow_data_entry, allow_reviewer, allow_supervisor
from app.models import User, PileAlert, DataQuality, AlertStatus
from app.schemas import PileAlertCreate, PileAlertUpdate, PileAlert as PileAlertSchema
from app.services import DataQualityService

router = APIRouter()


@router.post("/", response_model=PileAlertSchema, dependencies=[Depends(allow_data_entry)])
def create_alert(
    alert: PileAlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    is_valid, issues = DataQualityService.validate_pile_alert(db, alert.model_dump())
    
    if not is_valid:
        DataQualityService.save_failed_data(
            db, "pile_alert", alert.model_dump(), "; ".join(issues)
        )
        raise HTTPException(status_code=400, detail=f"数据校验失败: {', '.join(issues)}")
    
    db_alert = PileAlert(
        **alert.model_dump(),
        created_by=current_user.id,
        data_quality=DataQuality.VALID if is_valid else DataQuality.INVALID,
        quality_issue="; ".join(issues) if issues else None
    )
    db.add(db_alert)
    db.commit()
    db.refresh(db_alert)
    return db_alert


@router.post("/batch", dependencies=[Depends(allow_data_entry)])
def create_alerts_batch(
    alerts: list[PileAlertCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    success_count = 0
    failed_count = 0
    results = []
    
    for alert in alerts:
        is_valid, issues = DataQualityService.validate_pile_alert(db, alert.model_dump())
        
        if is_valid:
            db_alert = PileAlert(
                **alert.model_dump(),
                created_by=current_user.id,
                data_quality=DataQuality.VALID
            )
            db.add(db_alert)
            success_count += 1
            results.append({"success": True, "alert_code": alert.alert_code})
        else:
            DataQualityService.save_failed_data(
                db, "pile_alert", alert.model_dump(), "; ".join(issues)
            )
            failed_count += 1
            results.append({"success": False, "alert_code": alert.alert_code, "error": ", ".join(issues)})
    
    db.commit()
    return {
        "success": True,
        "message": f"成功导入{success_count}条，失败{failed_count}条",
        "success_count": success_count,
        "failed_count": failed_count,
        "details": results
    }


@router.get("/", response_model=list[PileAlertSchema])
def list_alerts(
    skip: int = 0,
    limit: int = 100,
    pile_id: Optional[int] = None,
    alert_type: Optional[str] = None,
    status: Optional[AlertStatus] = None,
    data_quality: Optional[DataQuality] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(PileAlert)
    if pile_id:
        query = query.filter(PileAlert.pile_id == pile_id)
    if alert_type:
        query = query.filter(PileAlert.alert_type == alert_type)
    if status:
        query = query.filter(PileAlert.status == status)
    if data_quality:
        query = query.filter(PileAlert.data_quality == data_quality)
    
    alerts = query.order_by(PileAlert.start_time.desc()).offset(skip).limit(limit).all()
    return alerts


@router.get("/{alert_id}", response_model=PileAlertSchema)
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    alert = db.query(PileAlert).filter(PileAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="告警不存在")
    return alert


@router.put("/{alert_id}", response_model=PileAlertSchema, dependencies=[Depends(allow_data_entry)])
def update_alert(
    alert_id: int,
    alert_update: PileAlertUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_alert = db.query(PileAlert).filter(PileAlert.id == alert_id).first()
    if not db_alert:
        raise HTTPException(status_code=404, detail="告警不存在")
    
    for field, value in alert_update.model_dump(exclude_unset=True).items():
        setattr(db_alert, field, value)
    
    db.commit()
    db.refresh(db_alert)
    return db_alert


@router.post("/{alert_id}/review", dependencies=[Depends(allow_reviewer)])
def review_alert(
    alert_id: int,
    is_valid: bool,
    review_comment: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_alert = db.query(PileAlert).filter(PileAlert.id == alert_id).first()
    if not db_alert:
        raise HTTPException(status_code=404, detail="告警不存在")
    
    db_alert.data_quality = DataQuality.VALID if is_valid else DataQuality.INVALID
    db_alert.quality_issue = review_comment
    db_alert.reviewed_by = current_user.id
    
    db.commit()
    return {"success": True, "message": "复核完成", "data_quality": db_alert.data_quality}


@router.delete("/{alert_id}", dependencies=[Depends(allow_supervisor)])
def delete_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_alert = db.query(PileAlert).filter(PileAlert.id == alert_id).first()
    if not db_alert:
        raise HTTPException(status_code=404, detail="告警不存在")
    
    db.delete(db_alert)
    db.commit()
    return {"success": True, "message": "删除成功"}
