from fastapi import FastAPI, HTTPException, Header, Depends
from typing import Optional, List
from datetime import datetime, timedelta

from app.models import (
    VisitorCreate, VisitorUpdate, VisitorResponse,
    Permission, ParkingSpot, AnomalyRecord, AuditLog
)
from app.services import (
    VisitorService, PermissionService, ParkingService,
    AnomalyService, AuditService, SummaryService
)
from app.storage import storage

app = FastAPI(
    title="企业门禁访客预约 API",
    description="解决访客预约改时间后，门禁权限、接待人和车位授权不一致的问题",
    version="1.0.0"
)


def get_actor(x_actor: Optional[str] = Header(None, description="操作人标识")) -> str:
    return x_actor or "system"


@app.get("/")
def root():
    return {
        "service": "企业门禁访客预约 API",
        "version": "1.0.0",
        "endpoints": {
            "visitors": "/api/visitors",
            "anomalies": "/api/anomalies",
            "summary": "/api/visitors/{id}/summary"
        }
    }


@app.post("/api/visitors", response_model=VisitorResponse, status_code=201)
def create_visitor(data: VisitorCreate, actor: str = Depends(get_actor)):
    try:
        return VisitorService.create_visitor(data, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/visitors/{visitor_id}", response_model=VisitorResponse)
def get_visitor(visitor_id: str):
    visitor = storage.get_visitor(visitor_id)
    if not visitor:
        raise HTTPException(status_code=404, detail=f"访客单不存在: {visitor_id}")
    return visitor


@app.post("/api/visitors/{visitor_id}/approve", response_model=VisitorResponse)
def approve_visitor(visitor_id: str, actor: str = Depends(get_actor)):
    try:
        return VisitorService.approve_visitor(visitor_id, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/visitors/{visitor_id}/reschedule", response_model=VisitorResponse)
def reschedule_visitor(visitor_id: str, data: VisitorUpdate, actor: str = Depends(get_actor)):
    try:
        return VisitorService.reschedule_visitor(visitor_id, data, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/visitors/{visitor_id}/cancel", response_model=VisitorResponse)
def cancel_visitor(visitor_id: str, actor: str = Depends(get_actor)):
    try:
        return VisitorService.cancel_visitor(visitor_id, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/visitors/{visitor_id}/checkin", response_model=VisitorResponse)
def checkin(visitor_id: str, actor: str = Depends(get_actor)):
    try:
        return VisitorService.checkin(visitor_id, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/visitors/{visitor_id}/checkout", response_model=VisitorResponse)
def checkout(visitor_id: str, actor: str = Depends(get_actor)):
    try:
        return VisitorService.checkout(visitor_id, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/visitors/{visitor_id}/permission", response_model=Optional[Permission])
def get_permission(visitor_id: str):
    return PermissionService.get_permission(visitor_id)


@app.get("/api/visitors/{visitor_id}/parking", response_model=Optional[ParkingSpot])
def get_parking(visitor_id: str):
    return ParkingService.get_parking(visitor_id)


@app.get("/api/visitors/{visitor_id}/history", response_model=List[VisitorResponse])
def get_visitor_history(visitor_id: str):
    history = storage.get_visitor_history(visitor_id)
    if not history:
        visitor = storage.get_visitor(visitor_id)
        if not visitor:
            raise HTTPException(status_code=404, detail=f"访客单不存在: {visitor_id}")
    return history


@app.get("/api/visitors/{visitor_id}/audit", response_model=List[AuditLog])
def get_audit_logs(visitor_id: str):
    logs = AuditService.get_logs(visitor_id)
    visitor = storage.get_visitor(visitor_id)
    if not visitor and not logs:
        raise HTTPException(status_code=404, detail=f"访客单不存在: {visitor_id}")
    return logs


@app.get("/api/visitors/{visitor_id}/summary")
def get_visitor_summary(visitor_id: str):
    summary = SummaryService.get_visitor_summary(visitor_id)
    if "error" in summary:
        raise HTTPException(status_code=404, detail=summary["error"])
    return summary


@app.get("/api/anomalies", response_model=List[AnomalyRecord])
def get_anomalies(visitor_id: Optional[str] = None, unresolved_only: bool = False):
    return AnomalyService.get_anomalies(visitor_id=visitor_id, unresolved_only=unresolved_only)


@app.post("/api/anomalies/{anomaly_id}/resolve", response_model=AnomalyRecord)
def resolve_anomaly(anomaly_id: str, actor: str = Depends(get_actor)):
    try:
        return AnomalyService.resolve_anomaly(anomaly_id, actor)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/pending-actions")
def get_pending_actions():
    unresolved = AnomalyService.get_anomalies(unresolved_only=True)
    return {
        "unresolved_anomalies": [a.model_dump() for a in unresolved],
        "count": len(unresolved)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
