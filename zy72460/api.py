import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from models import (
    RecordSource,
    ConflictResolution,
    ImportStatus,
)
from core import (
    create_session as create_memory_session,
    import_inspection_points,
    import_records,
    import_crack_records,
    detect_conflicts,
    resolve_conflict,
    get_pending_conflicts,
    get_boundary_points,
    get_point_records,
)
from checks import run_all_checks, generate_map_export
from workflow import (
    format_conflict_evidence,
    generate_handover_report,
    get_step_description,
    trace_record_to_export,
    trace_conflict_to_source,
    advance_step,
)
from persistence import (
    DATA_DIR,
    EXPORT_DIR,
    save_session,
    write_handover_report,
    write_handover_report_text,
)
from database import (
    get_db,
    save_session_to_db,
    load_session_from_db,
    list_sessions_from_db,
    init_db,
)


app = FastAPI(
    title="雨水花园积水复核 API",
    description="市政巡检员小付可通过 API 完成导入、复核、补录、导出的业务闭环",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(EXPORT_DIR, exist_ok=True)
app.mount("/api/exports", StaticFiles(directory=EXPORT_DIR), name="exports")

init_db()

sessions_cache: Dict[str, Any] = {}


def _load_or_create(session_id: str, db: Session):
    if session_id in sessions_cache:
        return sessions_cache[session_id]
    session = load_session_from_db(db, session_id)
    if session:
        sessions_cache[session_id] = session
        return session
    raise HTTPException(status_code=404, detail=f"会话 {session_id} 不存在")


def _persist(session, db):
    save_session(session)
    save_session_to_db(db, session)
    sessions_cache[session.session_id] = session


class GeoPointIn(BaseModel):
    lat: float
    lng: float
    street: str
    is_boundary: bool = False
    adjacent_streets: List[str] = Field(default_factory=list)


class PointIn(BaseModel):
    point_id: str
    name: str
    location: GeoPointIn
    point_type: str = "雨水花园"


class RecordIn(BaseModel):
    record_id: Optional[str] = None
    point_id: str
    inspector: str
    inspect_time: str
    has_waterlogging: bool
    water_depth_cm: Optional[float] = None
    ramp_accessible: Optional[bool] = None
    ramp_note: Optional[str] = None
    remarks: Optional[str] = None
    is_supplementary: bool = False


class CrackRecordIn(BaseModel):
    crack_id: Optional[str] = None
    point_id: str
    inspector: str
    inspect_time: str
    has_crack: bool
    crack_description: Optional[str] = None
    crack_width_mm: Optional[float] = None
    missing_3d_coords: bool = False
    x_coord: Optional[float] = None
    y_coord: Optional[float] = None
    z_coord: Optional[float] = None
    remarks: Optional[str] = None


class ConflictResolveIn(BaseModel):
    conflict_id: str
    resolution: str
    reason: Optional[str] = None
    resolved_by: str = "小付"


class SessionCreateIn(BaseModel):
    session_id: Optional[str] = None
    task_name: str = "雨水花园积水复核"


@app.get("/")
def root():
    return {
        "name": "雨水花园积水复核 API",
        "version": "2.0.0",
        "endpoints": {
            "sessions": "/api/sessions",
            "session_detail": "/api/sessions/{session_id}",
            "import_points": "/api/sessions/{session_id}/points",
            "import_records": "/api/sessions/{session_id}/records",
            "import_cracks": "/api/sessions/{session_id}/cracks",
            "detect_conflicts": "/api/sessions/{session_id}/conflicts/detect",
            "resolve_conflict": "/api/sessions/{session_id}/conflicts/{conflict_id}",
            "pending_conflicts": "/api/sessions/{session_id}/conflicts/pending",
            "run_checks": "/api/sessions/{session_id}/checks",
            "export_map": "/api/sessions/{session_id}/export",
            "handover_report": "/api/sessions/{session_id}/report",
            "trace_record": "/api/sessions/{session_id}/trace/record/{record_id}",
            "trace_conflict": "/api/sessions/{session_id}/trace/conflict/{conflict_id}",
            "advance_step": "/api/sessions/{session_id}/step/advance",
        },
    }


@app.get("/api/sessions")
def list_sessions(db: Session = Depends(get_db)):
    return {"sessions": list_sessions_from_db(db)}


@app.post("/api/sessions")
def create_session(body: SessionCreateIn, db: Session = Depends(get_db)):
    session = create_memory_session(body.session_id)
    session.task_name = body.task_name
    _persist(session, db)
    return {
        "session_id": session.session_id,
        "task_name": session.task_name,
        "current_step": session.current_step,
        "step_description": get_step_description(session.current_step),
        "created_at": session.created_at.isoformat(),
    }


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str, db: Session = Depends(get_db)):
    session = _load_or_create(session_id, db)
    return {
        "session_id": session.session_id,
        "task_name": session.task_name,
        "current_step": session.current_step,
        "step_description": get_step_description(session.current_step),
        "summary": {
            "total_points": len(session.inspection_points),
            "total_records": len(session.records),
            "total_crack_records": len(session.crack_records),
            "total_import_batches": len(session.import_batches),
            "total_conflicts": len(session.conflicts),
            "pending_conflicts": len(get_pending_conflicts(session)),
            "boundary_points": len(get_boundary_points(session)),
            "export_count": len(session.export_history),
            "audit_count": len(session.audit_log),
        },
        "points": [p.to_dict() for p in session.inspection_points.values()],
        "import_batches": [b.to_dict() for b in session.import_batches],
    }


@app.post("/api/sessions/{session_id}/points")
def add_points(session_id: str, points: List[PointIn], db: Session = Depends(get_db)):
    session = _load_or_create(session_id, db)
    points_data = []
    for p in points:
        d = p.model_dump()
        loc = d.pop("location")
        d.update(loc)
        points_data.append(d)
    session, count = import_inspection_points(session, points_data)
    _persist(session, db)
    return {"imported": count, "total_points": len(session.inspection_points)}


@app.post("/api/sessions/{session_id}/records")
def add_records(
    session_id: str,
    records: List[RecordIn],
    source: str = Query(..., description="数据源: RAMP_SURVEY / NIGHT_SAMPLING / MANUAL_REVIEW"),
    actor: str = "小付",
    db: Session = Depends(get_db),
):
    session = _load_or_create(session_id, db)
    try:
        try:
            record_source = RecordSource(source)
        except ValueError:
            record_source = RecordSource[source]
    except (ValueError, KeyError):
        raise HTTPException(status_code=400, detail=f"无效的 source: {source}")

    records_data = [r.model_dump() for r in records]
    session, imported, skipped, details, batch = import_records(
        session, records_data, record_source, is_supplementary=records[0].is_supplementary if records else False, actor=actor
    )
    _persist(session, db)
    return {
        "batch_id": batch.batch_id,
        "imported": imported,
        "reused": len(skipped),
        "total_records": len(session.records),
        "details": [d.to_dict() for d in details],
    }


@app.post("/api/sessions/{session_id}/cracks")
def add_crack_records(
    session_id: str,
    records: List[CrackRecordIn],
    actor: str = "小付",
    db: Session = Depends(get_db),
):
    session = _load_or_create(session_id, db)
    records_data = [r.model_dump() for r in records]
    session, imported, batch = import_crack_records(session, records_data, actor=actor)
    _persist(session, db)
    return {
        "batch_id": batch.batch_id,
        "imported": imported,
        "reused": batch.reused_count,
        "total_crack_records": len(session.crack_records),
        "details": [d.to_dict() for d in batch.details],
    }


@app.post("/api/sessions/{session_id}/conflicts/detect")
def api_detect_conflicts(
    session_id: str,
    actor: str = "系统",
    db: Session = Depends(get_db),
):
    session = _load_or_create(session_id, db)
    session, conflicts = detect_conflicts(session, actor=actor)
    _persist(session, db)
    return {
        "detected": len(conflicts),
        "total_conflicts": len(session.conflicts),
        "pending": len(get_pending_conflicts(session)),
        "conflicts": [format_conflict_evidence(session, c) for c in conflicts],
    }


@app.get("/api/sessions/{session_id}/conflicts/pending")
def api_pending_conflicts(session_id: str, db: Session = Depends(get_db)):
    session = _load_or_create(session_id, db)
    pending = get_pending_conflicts(session)
    return {
        "pending_count": len(pending),
        "conflicts": [format_conflict_evidence(session, c) for c in pending],
    }


@app.put("/api/sessions/{session_id}/conflicts/{conflict_id}")
def api_resolve_conflict(
    session_id: str,
    conflict_id: str,
    body: ConflictResolveIn,
    db: Session = Depends(get_db),
):
    session = _load_or_create(session_id, db)
    try:
        resolution = ConflictResolution(body.resolution)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"无效的 resolution: {body.resolution}")

    session, conflict = resolve_conflict(
        session, conflict_id, resolution, body.resolved_by, reason=body.reason
    )
    if not conflict:
        raise HTTPException(status_code=404, detail=f"冲突 {conflict_id} 不存在")
    _persist(session, db)
    return {"conflict_id": conflict_id, "resolution": resolution.value}


@app.post("/api/sessions/{session_id}/checks")
def api_run_checks(session_id: str, db: Session = Depends(get_db)):
    session = _load_or_create(session_id, db)
    session, results = run_all_checks(session)
    _persist(session, db)
    return {
        "passed": sum(1 for r in results if r.passed),
        "total": len(results),
        "checks": [r.to_dict() for r in results],
    }


@app.post("/api/sessions/{session_id}/export")
def api_export_map(
    session_id: str,
    exported_by: str = "小付",
    db: Session = Depends(get_db),
):
    session = _load_or_create(session_id, db)
    session, export = generate_map_export(session, exported_by)
    _persist(session, db)
    return {
        "export_id": export.export_id,
        "export_time": export.export_time.isoformat(),
        "file_hash": export.file_hash,
        "file_path": export.file_path,
        "file_path_txt": export.file_path.replace(".json", ".txt") if export.file_path else None,
        "file_url": f"/api/exports/{session_id}/map_export_{export.export_id}.json",
        "file_url_txt": f"/api/exports/{session_id}/map_export_{export.export_id}.txt",
        "point_count": export.point_count,
        "boundary_points": export.boundary_points,
        "conflict_points": export.conflict_points,
        "record_count": len(export.records_snapshot),
        "conflict_count": len(export.conflicts_snapshot),
        "audit_count": len(export.audit_snapshot),
    }


@app.get("/api/sessions/{session_id}/exports")
def api_list_exports(session_id: str, db: Session = Depends(get_db)):
    session = _load_or_create(session_id, db)
    return {
        "exports": [
            {
                "export_id": e.export_id,
                "export_time": e.export_time.isoformat(),
                "file_hash": e.file_hash,
                "file_path": e.file_path,
                "file_url": f"/api/exports/{session_id}/map_export_{e.export_id}.json",
            }
            for e in session.export_history
        ]
    }


@app.get("/api/sessions/{session_id}/report")
def api_get_report(session_id: str, db: Session = Depends(get_db)):
    session = _load_or_create(session_id, db)
    report = generate_handover_report(session)
    return report


@app.post("/api/sessions/{session_id}/report")
def api_write_report(session_id: str, db: Session = Depends(get_db)):
    session = _load_or_create(session_id, db)
    report = generate_handover_report(session)
    json_path = write_handover_report(session, report)
    txt_path = write_handover_report_text(session, report)
    return {
        "session_id": session_id,
        "report_json": json_path,
        "report_txt": txt_path,
        "report_url": f"/api/exports/{session_id}/handover_report.json",
        "report_url_txt": f"/api/exports/{session_id}/handover_report.txt",
    }


@app.get("/api/sessions/{session_id}/trace/record/{record_id}")
def api_trace_record(session_id: str, record_id: str, db: Session = Depends(get_db)):
    session = _load_or_create(session_id, db)
    return trace_record_to_export(session, record_id)


@app.get("/api/sessions/{session_id}/trace/conflict/{conflict_id}")
def api_trace_conflict(session_id: str, conflict_id: str, db: Session = Depends(get_db)):
    session = _load_or_create(session_id, db)
    return trace_conflict_to_source(session, conflict_id)


@app.post("/api/sessions/{session_id}/step/advance")
def api_advance_step(session_id: str, db: Session = Depends(get_db)):
    session = _load_or_create(session_id, db)
    old_step = session.current_step
    session = advance_step(session)
    _persist(session, db)
    return {
        "old_step": old_step,
        "new_step": session.current_step,
        "step_description": get_step_description(session.current_step),
    }


@app.get("/api/sessions/{session_id}/batches")
def api_list_batches(session_id: str, db: Session = Depends(get_db)):
    session = _load_or_create(session_id, db)
    return {
        "batches": [b.to_dict() for b in session.import_batches]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
