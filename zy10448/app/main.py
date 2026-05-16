from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import json

from .database import get_db, init_db
from . import models, schemas, services

app = FastAPI(
    title="用量异常事故API",
    description="统一管理客户用量暴涨异常事故的检测、归因、处理和导出",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/")
def root():
    return {"message": "用量异常事故API", "version": "1.0.0", "docs": "/docs"}

@app.post("/api/incidents", response_model=schemas.Incident, status_code=201)
def create_incident(
    incident_data: schemas.IncidentCreate,
    db: Session = Depends(get_db)
):
    try:
        original_input = json.dumps(incident_data.model_dump(), default=str)
        incident = services.create_incident(db, incident_data, original_input)
        return incident
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/incidents", response_model=schemas.IncidentListResponse)
def list_incidents(
    tenant_id: Optional[str] = Query(None, description="按租户ID筛选"),
    status: Optional[schemas.IncidentStatus] = Query(None, description="按状态筛选"),
    skip: int = Query(0, ge=0, description="跳过数量"),
    limit: int = Query(100, ge=1, le=1000, description="返回数量"),
    db: Session = Depends(get_db)
):
    incidents = services.list_incidents(db, tenant_id, status, skip, limit)
    total = len(incidents)
    return {
        "total": total,
        "items": incidents,
        "skip": skip,
        "limit": limit
    }

@app.get("/api/incidents/{incident_id}", response_model=schemas.Incident)
def get_incident(
    incident_id: int,
    db: Session = Depends(get_db)
):
    incident = services.get_incident(db, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@app.get("/api/incidents/key/{incident_key}", response_model=schemas.Incident)
def get_incident_by_key(
    incident_key: str,
    db: Session = Depends(get_db)
):
    incident = services.get_incident_by_key(db, incident_key)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@app.patch("/api/incidents/{incident_id}/status", response_model=schemas.Incident)
def update_incident_status(
    incident_id: int,
    status_update: schemas.StatusUpdate,
    db: Session = Depends(get_db)
):
    incident = services.update_incident_status(
        db, incident_id, status_update.status, status_update.comment
    )
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@app.post("/api/incidents/{incident_id}/clues", response_model=schemas.AttributionClue)
def add_attribution_clue(
    incident_id: int,
    clue_data: schemas.AttributionClueCreate,
    db: Session = Depends(get_db)
):
    clue = services.add_attribution_clue(db, incident_id, clue_data)
    if not clue:
        raise HTTPException(status_code=404, detail="Incident not found")
    return clue

@app.post("/api/incidents/{incident_id}/actions", response_model=schemas.ActionItem)
def add_action_item(
    incident_id: int,
    action_data: schemas.ActionItemCreate,
    db: Session = Depends(get_db)
):
    action = services.add_action_item(db, incident_id, action_data)
    if not action:
        raise HTTPException(status_code=404, detail="Incident not found")
    return action

@app.post("/api/incidents/{incident_id}/correct", response_model=schemas.Incident)
def manual_correction(
    incident_id: int,
    correction_data: schemas.ManualCorrection,
    db: Session = Depends(get_db)
):
    incident = services.manual_correction(db, incident_id, correction_data)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@app.put("/api/incidents/{incident_id}/summary", response_model=schemas.IncidentSummary)
def update_incident_summary(
    incident_id: int,
    summary_data: schemas.IncidentSummaryUpdate,
    db: Session = Depends(get_db)
):
    summary = services.update_summary(db, incident_id, summary_data)
    if not summary:
        raise HTTPException(status_code=404, detail="Incident not found")
    return summary

@app.get("/api/incidents/{incident_id}/export", response_model=schemas.ExportResponse)
def export_incident(
    incident_id: int,
    db: Session = Depends(get_db)
):
    export_data = services.export_incident_summary(db, incident_id)
    if not export_data:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    return {
        "success": True,
        "data": export_data,
        "exported_at": datetime.utcnow()
    }

@app.get("/api/tenants", response_model=list[schemas.Tenant])
def list_tenants(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    tenants = db.query(models.Tenant).offset(skip).limit(limit).all()
    return tenants
