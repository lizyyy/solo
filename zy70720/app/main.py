from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import engine, get_db, Base
from app import models, schemas, crud
from app.models import IncidentStatus

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="事故状态页公告版本回执后端API",
    description="管理事故公告版本、订阅方确认回执、复盘摘要的后端服务",
    version="1.0.0"
)


@app.post("/api/incidents", response_model=schemas.IncidentResponse, tags=["事故管理"])
def create_incident(incident: schemas.IncidentCreate, db: Session = Depends(get_db)):
    db_incident = crud.get_incident(db, incident_id=incident.id)
    if db_incident:
        raise HTTPException(status_code=400, detail="事故编号已存在")
    return crud.create_incident(db=db, incident=incident)


@app.get("/api/incidents", response_model=List[schemas.IncidentResponse], tags=["事故管理"])
def read_incidents(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = Query(None, description="是否只查询活跃事故"),
    db: Session = Depends(get_db)
):
    incidents = crud.get_incidents(db, skip=skip, limit=limit, is_active=is_active)
    return incidents


@app.get("/api/incidents/{incident_id}", response_model=schemas.IncidentDetailResponse, tags=["事故管理"])
def read_incident(incident_id: str, db: Session = Depends(get_db)):
    db_incident = crud.get_incident(db, incident_id=incident_id)
    if db_incident is None:
        raise HTTPException(status_code=404, detail="事故不存在")
    
    return {
        **db_incident.__dict__,
        "announcements_count": len(db_incident.announcements),
        "subscribers_count": len(db_incident.subscribers),
        "confirmations_count": len(db_incident.confirmations)
    }


@app.put("/api/incidents/{incident_id}", response_model=schemas.IncidentResponse, tags=["事故管理"])
def update_incident(
    incident_id: str,
    incident_update: schemas.IncidentUpdate,
    db: Session = Depends(get_db)
):
    db_incident = crud.update_incident(db, incident_id, incident_update)
    if db_incident is None:
        raise HTTPException(status_code=404, detail="事故不存在")
    return db_incident


@app.post("/api/incidents/{incident_id}/status", response_model=schemas.IncidentResponse, tags=["事故管理"])
def update_incident_status(
    incident_id: str,
    status_update: schemas.StatusUpdate,
    db: Session = Depends(get_db)
):
    db_incident = crud.get_incident(db, incident_id=incident_id)
    if db_incident is None:
        raise HTTPException(status_code=404, detail="事故不存在")
    
    if not db_incident.is_active:
        raise HTTPException(status_code=400, detail="事故已关闭，无法更新状态")
    
    return crud.update_incident_status(db, incident_id, status_update.status)


@app.post("/api/incidents/{incident_id}/close", response_model=schemas.IncidentResponse, tags=["事故管理"])
def close_incident(incident_id: str, db: Session = Depends(get_db)):
    db_incident = crud.get_incident(db, incident_id=incident_id)
    if db_incident is None:
        raise HTTPException(status_code=404, detail="事故不存在")
    
    if not db_incident.is_active:
        raise HTTPException(status_code=400, detail="事故已关闭")
    
    return crud.close_incident(db, incident_id)


@app.post("/api/announcements", response_model=schemas.AnnouncementResponse, tags=["公告管理"])
def create_announcement(announcement: schemas.AnnouncementCreate, db: Session = Depends(get_db)):
    db_incident = crud.get_incident(db, incident_id=announcement.incident_id)
    if db_incident is None:
        raise HTTPException(status_code=404, detail="事故不存在")
    
    if not db_incident.is_active:
        raise HTTPException(status_code=400, detail="事故已关闭，无法创建新公告")
    
    return crud.create_announcement(db=db, announcement=announcement)


@app.get("/api/incidents/{incident_id}/announcements", response_model=List[schemas.AnnouncementResponse], tags=["公告管理"])
def read_incident_announcements(incident_id: str, db: Session = Depends(get_db)):
    db_incident = crud.get_incident(db, incident_id=incident_id)
    if db_incident is None:
        raise HTTPException(status_code=404, detail="事故不存在")
    
    return crud.get_announcements_by_incident(db, incident_id=incident_id)


@app.post("/api/subscribers", response_model=schemas.SubscriberResponse, tags=["订阅方管理"])
def create_subscriber(subscriber: schemas.SubscriberCreate, db: Session = Depends(get_db)):
    db_incident = crud.get_incident(db, incident_id=subscriber.incident_id)
    if db_incident is None:
        raise HTTPException(status_code=404, detail="事故不存在")
    
    return crud.create_subscriber(db=db, subscriber=subscriber)


@app.get("/api/incidents/{incident_id}/subscribers", response_model=List[schemas.SubscriberResponse], tags=["订阅方管理"])
def read_incident_subscribers(incident_id: str, db: Session = Depends(get_db)):
    db_incident = crud.get_incident(db, incident_id=incident_id)
    if db_incident is None:
        raise HTTPException(status_code=404, detail="事故不存在")
    
    return crud.get_subscribers_by_incident(db, incident_id=incident_id)


@app.post("/api/confirmations", tags=["确认回执管理"])
def create_confirmation(confirmation: schemas.ConfirmationCreate, db: Session = Depends(get_db)):
    db_incident = crud.get_incident(db, incident_id=confirmation.incident_id)
    if db_incident is None:
        raise HTTPException(status_code=404, detail="事故不存在")
    
    db_subscriber = crud.get_subscriber(db, subscriber_id=confirmation.subscriber_id)
    if db_subscriber is None:
        raise HTTPException(status_code=404, detail="订阅方不存在")
    
    if db_subscriber.incident_id != confirmation.incident_id:
        raise HTTPException(status_code=400, detail="订阅方不属于该事故")
    
    db_announcement = db.query(models.Announcement).filter(
        models.Announcement.id == confirmation.announcement_id
    ).first()
    if db_announcement is None:
        raise HTTPException(status_code=404, detail="公告不存在")
    
    if db_announcement.incident_id != confirmation.incident_id:
        raise HTTPException(status_code=400, detail="公告不属于该事故")
    
    result, is_new = crud.create_confirmation(db=db, confirmation=confirmation)
    
    if not is_new:
        return {
            "data": result,
            "message": "回执已存在，跳过重复确认"
        }
    
    return {
        "data": result,
        "message": "确认成功"
    }


@app.get("/api/incidents/{incident_id}/confirmations", response_model=List[schemas.ConfirmationResponse], tags=["确认回执管理"])
def read_incident_confirmations(incident_id: str, db: Session = Depends(get_db)):
    db_incident = crud.get_incident(db, incident_id=incident_id)
    if db_incident is None:
        raise HTTPException(status_code=404, detail="事故不存在")
    
    return crud.get_confirmations_by_incident(db, incident_id=incident_id)


@app.post("/api/correction-logs", response_model=schemas.CorrectionLogResponse, tags=["人工修正"])
def create_correction_log(log: schemas.CorrectionLogCreate, db: Session = Depends(get_db)):
    db_incident = crud.get_incident(db, incident_id=log.incident_id)
    if db_incident is None:
        raise HTTPException(status_code=404, detail="事故不存在")
    
    return crud.create_correction_log(db=db, log=log)


@app.get("/api/incidents/{incident_id}/correction-logs", response_model=List[schemas.CorrectionLogResponse], tags=["人工修正"])
def read_incident_correction_logs(incident_id: str, db: Session = Depends(get_db)):
    db_incident = crud.get_incident(db, incident_id=incident_id)
    if db_incident is None:
        raise HTTPException(status_code=404, detail="事故不存在")
    
    return crud.get_correction_logs_by_incident(db, incident_id=incident_id)


@app.get("/api/incidents/{incident_id}/export", response_model=schemas.IncidentExport, tags=["导出"])
def export_incident(incident_id: str, db: Session = Depends(get_db)):
    export_data = crud.export_incident_data(db, incident_id=incident_id)
    if export_data is None:
        raise HTTPException(status_code=404, detail="事故不存在")
    
    return export_data


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
