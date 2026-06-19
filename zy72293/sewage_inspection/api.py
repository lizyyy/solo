from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .models import (
    CoordinateRow,
    FloorProfile,
    InspectionProject,
    NextAction,
    ObstacleRemark,
    OcclusionPoint,
    OcclusionStatus,
    PhotoLocation,
    WorkflowPhase,
)
from .core import (
    add_review_note,
    advance_workflow,
    detect_inconsistencies,
    generate_occlusion_report,
    resolve_occlusion_points,
    _phase_label,
    _status_label,
    _next_action_label,
    _find_obstacle_remark,
    _find_floor_profile,
)
from .workflow import WorkflowEngine


app = FastAPI(title="污水厂池体巡检路线 — 遮挡点管理系统")


@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_static_dir = Path(__file__).parent / "web" / "static"
if _static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")

engine = WorkflowEngine()


class CreateProjectRequest(BaseModel):
    name: str
    plant_name: str = ""
    created_by: str = "unknown"


class ImportObstaclesRequest(BaseModel):
    obstacles: list[dict]


class ImportFloorProfilesRequest(BaseModel):
    floor_profiles: list[dict]


class ImportCoordinatesRequest(BaseModel):
    coordinates: list[dict]


class EscalateRequest(BaseModel):
    target: str = "safety_officer"


class ReviewCommentRequest(BaseModel):
    comment: str
    reviewer: str = "safety_officer"


class ResolveOcclusionRequest(BaseModel):
    point_label: str
    x: float
    y: float
    z: float
    verified: bool = False
    resolved_by: str = "web-user"
    note: str = ""


class LoadSampleRequest(BaseModel):
    name: str
    plant_name: str = ""
    by: str = "unknown"


def _serialize_occlusion(op: OcclusionPoint, project: InspectionProject) -> dict:
    obstacle_remark_summary = ""
    if op.obstacle_remark_id:
        r = _find_obstacle_remark(project, op.obstacle_remark_id)
        if r:
            obstacle_remark_summary = r.location + " - " + r.description

    floor_profile_summary = ""
    if op.floor_profile_id:
        p = _find_floor_profile(project, op.floor_profile_id)
        if p:
            floor_profile_summary = p.floor_name

    audit_trail = []
    for entry in op.audit_trail:
        audit_trail.append({
            "timestamp": entry.timestamp,
            "action": entry.action,
            "from_status": entry.from_status,
            "to_status": entry.to_status,
            "from_reason": entry.from_reason,
            "to_reason": entry.to_reason,
            "from_missing_material": entry.from_missing_material,
            "to_missing_material": entry.to_missing_material,
            "from_next_action": entry.from_next_action,
            "to_next_action": entry.to_next_action,
            "changed_by": entry.changed_by,
            "change_cause": entry.change_cause,
            "note": entry.note,
        })

    return {
        "id": op.id,
        "photo_location_id": op.photo_location_id,
        "photo_ref": op.photo_ref,
        "x": op.point_x,
        "y": op.point_y,
        "z": op.point_z,
        "status": op.status.value,
        "status_label": _status_label(op.status),
        "reason": op.reason,
        "missing_material": op.missing_material,
        "next_action": op.next_action.value,
        "next_action_label": _next_action_label(op.next_action),
        "obstacle_remark_id": op.obstacle_remark_id,
        "floor_profile_id": op.floor_profile_id,
        "resolved_by": op.resolved_by,
        "resolved_at": op.resolved_at,
        "original_reason": op.original_reason,
        "original_missing_material": op.original_missing_material,
        "original_next_action": op.original_next_action,
        "obstacle_remark_summary": obstacle_remark_summary,
        "floor_profile_summary": floor_profile_summary,
        "audit_trail": audit_trail,
        "created_at": op.created_at,
        "updated_at": op.updated_at,
    }


def _has_coord_match(op: OcclusionPoint, project: InspectionProject) -> bool:
    for row in project.coordinate_rows:
        if (
            abs(row.x - op.point_x) <= 0.5
            and abs(row.y - op.point_y) <= 0.5
            and abs(row.z - op.point_z) <= 0.5
        ):
            return True
    return False


def _project_summary(p: InspectionProject) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "plant_name": p.plant_name,
        "created_by": p.created_by,
        "created_at": p.created_at,
        "current_phase": p.current_phase.value,
        "current_phase_label": _phase_label(p.current_phase),
    }


def _project_detail(p: InspectionProject) -> dict:
    pending = sum(1 for op in p.occlusion_points if op.status == OcclusionStatus.PENDING_REVIEW)
    resolved = sum(1 for op in p.occlusion_points if op.status == OcclusionStatus.RESOLVED)
    escalated = sum(1 for op in p.occlusion_points if op.status == OcclusionStatus.ESCALATED_SAFETY)
    return {
        **_project_summary(p),
        "stats": {
            "obstacle_remarks": len(p.obstacle_remarks),
            "floor_profiles": len(p.floor_profiles),
            "photo_locations": len(p.photo_locations),
            "coordinate_rows": len(p.coordinate_rows),
            "occlusion_points": len(p.occlusion_points),
            "pending_review": pending,
            "resolved": resolved,
            "escalated": escalated,
        },
        "obstacle_remarks": [r.model_dump() for r in p.obstacle_remarks],
        "floor_profiles": [fp.model_dump() for fp in p.floor_profiles],
        "photo_locations": [pl.model_dump() for pl in p.photo_locations],
        "coordinate_rows": [cr.model_dump() for cr in p.coordinate_rows],
        "occlusion_points": [_serialize_occlusion(op, p) for op in p.occlusion_points],
    }


@app.get("/")
async def dashboard():
    return FileResponse(str(_static_dir / "index.html"))


@app.get("/api/projects")
async def list_projects():
    return engine.list_projects()


@app.post("/api/projects", status_code=201)
async def create_project(req: CreateProjectRequest):
    project = engine.create_project(req.name, req.plant_name, req.created_by)
    return _project_detail(project)


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    try:
        project = engine.load_project(project_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="项目不存在")
    return _project_detail(project)


@app.post("/api/projects/{project_id}/obstacles")
async def import_obstacles(project_id: str, req: ImportObstaclesRequest):
    try:
        project = engine.import_obstacle_remarks(project_id, req.obstacles)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="项目不存在")
    return _project_detail(project)


@app.post("/api/projects/{project_id}/floor-profiles")
async def import_floor_profiles(project_id: str, req: ImportFloorProfilesRequest):
    try:
        project = engine.import_floor_profiles(project_id, req.floor_profiles)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="项目不存在")
    return _project_detail(project)


@app.post("/api/projects/{project_id}/coordinates")
async def import_coordinates(project_id: str, req: ImportCoordinatesRequest):
    try:
        project = engine.import_coordinate_rows(project_id, req.coordinates)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="项目不存在")
    return _project_detail(project)


@app.post("/api/projects/{project_id}/step")
async def run_step(project_id: str):
    try:
        project = engine.run_step(project_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="项目不存在")
    return _project_detail(project)


@app.get("/api/projects/{project_id}/report")
async def get_report(project_id: str):
    try:
        report = engine.get_report(project_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"report": report}


@app.post("/api/projects/{project_id}/occlusion/{occlusion_id}/escalate")
async def escalate_occlusion(project_id: str, occlusion_id: str, req: EscalateRequest):
    try:
        project = engine.escalate_occlusion(project_id, occlusion_id, req.target)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="项目不存在")
    return _project_detail(project)


@app.post("/api/projects/{project_id}/occlusion/{occlusion_id}/comment")
async def add_review_comment(project_id: str, occlusion_id: str, req: ReviewCommentRequest):
    try:
        project = engine.add_review_comment(project_id, occlusion_id, req.comment, req.reviewer)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="项目不存在")
    return _project_detail(project)


@app.post("/api/projects/{project_id}/occlusion/{occlusion_id}/resolve")
async def resolve_occlusion(project_id: str, occlusion_id: str, req: ResolveOcclusionRequest):
    try:
        project = engine.load_project(project_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="项目不存在")

    occlusion = None
    for op in project.occlusion_points:
        if op.id == occlusion_id:
            occlusion = op
            break

    if occlusion is None:
        raise HTTPException(status_code=404, detail="遮挡点不存在")

    row = CoordinateRow(
        point_label=req.point_label,
        x=req.x,
        y=req.y,
        z=req.z,
        floor_profile_id=occlusion.floor_profile_id,
        verified=req.verified,
    )
    project.coordinate_rows.append(row)

    resolved = resolve_occlusion_points(project, resolved_by=req.resolved_by or "web-user")
    engine.save_project(project)

    return _project_detail(project)


@app.post("/api/load-sample")
async def load_sample(req: LoadSampleRequest):
    project = engine.create_project(req.name, req.plant_name, req.by)

    sample_dir = Path(__file__).resolve().parent.parent / "sample_data"

    obstacles_path = sample_dir / "obstacles.json"
    if obstacles_path.exists():
        data = json.loads(obstacles_path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data = [data]
        project = engine.import_obstacle_remarks(project.id, data)

    floor_profiles_path = sample_dir / "floor_profiles.json"
    if floor_profiles_path.exists():
        data = json.loads(floor_profiles_path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data = [data]
        project = engine.import_floor_profiles(project.id, data)

    coordinates_path = sample_dir / "coordinates.json"
    if coordinates_path.exists():
        data = json.loads(coordinates_path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data = [data]
        project = engine.import_coordinate_rows(project.id, data)

    return _project_detail(project)


@app.get("/api/sample-files")
async def sample_files():
    sample_dir = Path(__file__).resolve().parent.parent / "sample_data"
    result = {}
    for name in ("obstacles", "floor_profiles", "coordinates"):
        path = sample_dir / (name + ".json")
        if path.exists():
            result[name] = json.loads(path.read_text(encoding="utf-8"))
        else:
            result[name] = None
    return result


@app.get("/api/projects/{project_id}/chart-data")
async def chart_data(project_id: str):
    try:
        project = engine.load_project(project_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="项目不存在")

    pending = sum(1 for op in project.occlusion_points if op.status == OcclusionStatus.PENDING_REVIEW)
    resolved = sum(1 for op in project.occlusion_points if op.status == OcclusionStatus.RESOLVED)
    escalated = sum(1 for op in project.occlusion_points if op.status == OcclusionStatus.ESCALATED_SAFETY)
    confirmed = sum(1 for op in project.occlusion_points if op.status == OcclusionStatus.CONFIRMED)

    return {
        "obstacle_count": len(project.obstacle_remarks),
        "floor_profile_count": len(project.floor_profiles),
        "photo_location_count": len(project.photo_locations),
        "coordinate_row_count": len(project.coordinate_rows),
        "occlusion_total": len(project.occlusion_points),
        "occlusion_pending": pending,
        "occlusion_resolved": resolved,
        "occlusion_escalated": escalated,
        "occlusion_confirmed": confirmed,
    }


if __name__ == "__main__":
    import uvicorn

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind")
    args = parser.parse_args()

    host = args.host
    port = args.port

    print("=" * 50)
    print("  Sewage Inspection API Server")
    print("  URL: http://" + host + ":" + str(port))
    print("=" * 50)

    uvicorn.run(app, host=host, port=port)
