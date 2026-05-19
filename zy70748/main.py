from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db, init_db
from schemas import (
    Incident, IncidentCreate, IncidentUpdate, StatusTransition,
    AttributionClue, AttributionClueCreate, ProcessAction,
    IncidentQuery, IncidentExport, ConflictResponse
)
from services import IncidentService

app = FastAPI(title="用量异常事故归因处理摘要API", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    init_db()


@app.post("/api/v1/incidents", response_model=Incident, status_code=201)
def create_incident(data: IncidentCreate, db: Session = Depends(get_db)):
    service = IncidentService(db)
    incident, created = service.create_incident(data)
    if not created:
        raise HTTPException(
            status_code=409,
            detail={
                "conflict": True,
                "existing_incident_id": incident.id,
                "message": "相同租户、相同指标在重叠时间窗口已存在事故"
            }
        )
    return incident


@app.get("/api/v1/incidents/{incident_id}", response_model=Incident)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    service = IncidentService(db)
    incident = service.get_incident(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="事故不存在")
    return incident


@app.get("/api/v1/incidents", response_model=List[Incident])
def list_incidents(
    tenant_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    start_time_from: Optional[datetime] = Query(None),
    start_time_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    service = IncidentService(db)
    query = IncidentQuery(
        tenant_id=tenant_id,
        status=status,
        start_time_from=start_time_from,
        start_time_to=start_time_to,
        page=page,
        page_size=page_size
    )
    incidents, _ = service.query_incidents(query)
    return incidents


@app.post("/api/v1/incidents/{incident_id}/status", response_model=Incident)
def transition_status(incident_id: str, transition: StatusTransition, db: Session = Depends(get_db)):
    service = IncidentService(db)
    incident = service.transition_status(incident_id, transition)
    if not incident:
        raise HTTPException(status_code=404, detail="事故不存在")
    return incident


@app.post("/api/v1/incidents/{incident_id}/clues", response_model=AttributionClue, status_code=201)
def add_clue(incident_id: str, clue_data: AttributionClueCreate, db: Session = Depends(get_db)):
    service = IncidentService(db)
    clue = service.add_clue(incident_id, clue_data)
    if not clue:
        raise HTTPException(status_code=404, detail="事故不存在")
    return clue


@app.get("/api/v1/incidents/{incident_id}/clues", response_model=List[AttributionClue])
def get_clues(incident_id: str, db: Session = Depends(get_db)):
    service = IncidentService(db)
    if not service.get_incident(incident_id):
        raise HTTPException(status_code=404, detail="事故不存在")
    return service.get_clues(incident_id)


@app.get("/api/v1/incidents/{incident_id}/actions", response_model=List[ProcessAction])
def get_actions(incident_id: str, db: Session = Depends(get_db)):
    service = IncidentService(db)
    if not service.get_incident(incident_id):
        raise HTTPException(status_code=404, detail="事故不存在")
    return service.get_actions(incident_id)


@app.patch("/api/v1/incidents/{incident_id}", response_model=Incident)
def manual_correct(
    incident_id: str,
    update_data: IncidentUpdate,
    operator: str = Query(...),
    db: Session = Depends(get_db)
):
    service = IncidentService(db)
    incident = service.manual_correct(incident_id, update_data, operator)
    if not incident:
        raise HTTPException(status_code=404, detail="事故不存在")
    return incident


@app.post("/api/v1/incidents/{incident_id}/withdraw", response_model=Incident)
def withdraw_incident(
    incident_id: str,
    operator: str = Query(...),
    reason: str = Query(...),
    db: Session = Depends(get_db)
):
    service = IncidentService(db)
    incident = service.withdraw_incident(incident_id, operator, reason)
    if not incident:
        raise HTTPException(status_code=404, detail="事故不存在")
    return incident


@app.post("/api/v1/incidents/{incident_id}/close", response_model=Incident)
def close_incident(
    incident_id: str,
    operator: str = Query(...),
    conclusion: str = Query(...),
    db: Session = Depends(get_db)
):
    service = IncidentService(db)
    incident = service.close_incident(incident_id, operator, conclusion)
    if not incident:
        raise HTTPException(status_code=404, detail="事故不存在")
    return incident


@app.get("/api/v1/incidents/{incident_id}/export", response_model=IncidentExport)
def export_incident(incident_id: str, db: Session = Depends(get_db)):
    service = IncidentService(db)
    export_data = service.export_incident(incident_id)
    if not export_data:
        raise HTTPException(status_code=404, detail="事故不存在")
    return export_data


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "incident-usage-api"}
