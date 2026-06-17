from __future__ import annotations

from fastapi import FastAPI, HTTPException

from .models import DashboardSummary, Evidence, ExportDelta, MaintenanceRecord, RecordInput, RemarkInput
from .service import WarningService, build_demo_service

app = FastAPI(title="塔吊维保阈值预警", version="0.1.0")
service: WarningService = build_demo_service()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/records", response_model=list[MaintenanceRecord])
def list_records() -> list[MaintenanceRecord]:
    return service.list_records()


@app.post("/records/analyze", response_model=MaintenanceRecord)
def analyze_record(payload: RecordInput) -> MaintenanceRecord:
    return service.analyze(payload)


@app.get("/records/{record_id}", response_model=MaintenanceRecord)
def get_record(record_id: str) -> MaintenanceRecord:
    try:
        return service.get_record(record_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/records/{record_id}/evidence", response_model=MaintenanceRecord)
def add_evidence(record_id: str, payload: Evidence) -> MaintenanceRecord:
    try:
        return service.add_evidence(record_id, payload)
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/records/{record_id}/remarks", response_model=ExportDelta)
def add_remark(record_id: str, payload: RemarkInput) -> ExportDelta:
    try:
        return service.add_remark(record_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/assistant/worklist")
def assistant_worklist() -> list[dict[str, str]]:
    return service.assistant_worklist()


@app.get("/supervisor/evidence-gaps", response_model=DashboardSummary)
def supervisor_dashboard() -> DashboardSummary:
    return service.supervisor_dashboard()


@app.get("/exports/{record_id}/preview")
def export_preview(record_id: str) -> dict[str, str]:
    try:
        return service.export_preview(record_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
