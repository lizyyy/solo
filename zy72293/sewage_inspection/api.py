from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .models import (
    CoordinateRow,
    FloorProfile,
    InspectionProject,
    ObstacleRemark,
    OcclusionPoint,
    OcclusionStatus,
    PhotoLocation,
    WorkflowPhase,
)
from .core import (
    advance_workflow,
    detect_inconsistencies,
    generate_occlusion_report,
    resolve_occlusion_points,
    _phase_label,
    _status_label,
    _next_action_label,
)
from .workflow import WorkflowEngine

app = FastAPI(title="污水厂池体巡检路线", version="1.0.0")

static_dir = Path(__file__).parent / "web" / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

engine = WorkflowEngine()


class CreateProjectRequest(BaseModel):
    name: str
    plant_name: str = ""
    created_by: str = "api"


class ImportObstaclesRequest(BaseModel):
    obstacles: list[dict]


class ImportFloorProfilesRequest(BaseModel):
    profiles: list[dict]


class ImportCoordinatesRequest(BaseModel):
    rows: list[dict]


class EscalateRequest(BaseModel):
    target: str = "safety_officer"


@app.get("/", response_class=HTMLResponse)
async def dashboard():
    index_path = static_dir / "index.html"
    if index_path.exists():
        return index_path.read_text(encoding="utf-8")
    return "<h1>污水厂池体巡检路线</h1><p>Web看板文件未找到，请使用API。</p>"


@app.get("/api/projects")
async def list_projects():
    return engine.list_projects()


@app.post("/api/projects")
async def create_project(req: CreateProjectRequest):
    project = engine.create_project(req.name, req.plant_name, req.created_by)
    return _project_summary(project)


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    try:
        project = engine.load_project(project_id)
    except FileNotFoundError:
        raise HTTPException(404, "项目不存在")
    return _project_detail(project)


@app.post("/api/projects/{project_id}/obstacles")
async def import_obstacles(project_id: str, req: ImportObstaclesRequest):
    try:
        project = engine.import_obstacle_remarks(project_id, req.obstacles)
    except FileNotFoundError:
        raise HTTPException(404, "项目不存在")
    return _project_detail(project)


@app.post("/api/projects/{project_id}/floor-profiles")
async def import_floor_profiles(project_id: str, req: ImportFloorProfilesRequest):
    try:
        project = engine.import_floor_profiles(project_id, req.profiles)
    except FileNotFoundError:
        raise HTTPException(404, "项目不存在")
    return _project_detail(project)


@app.post("/api/projects/{project_id}/coordinates")
async def import_coordinates(project_id: str, req: ImportCoordinatesRequest):
    try:
        project = engine.import_coordinate_rows(project_id, req.rows)
    except FileNotFoundError:
        raise HTTPException(404, "项目不存在")
    return _project_detail(project)


@app.post("/api/projects/{project_id}/step")
async def run_step(project_id: str):
    try:
        project = engine.run_step(project_id)
    except FileNotFoundError:
        raise HTTPException(404, "项目不存在")
    return _project_detail(project)


@app.get("/api/projects/{project_id}/report", response_class=PlainTextResponse)
async def get_report(project_id: str):
    try:
        return engine.get_report(project_id)
    except FileNotFoundError:
        raise HTTPException(404, "项目不存在")


@app.post("/api/projects/{project_id}/occlusion/{occlusion_id}/escalate")
async def escalate_occlusion(project_id: str, occlusion_id: str, req: EscalateRequest):
    try:
        project = engine.escalate_occlusion(project_id, occlusion_id, req.target)
    except FileNotFoundError:
        raise HTTPException(404, "项目不存在")
    return _project_detail(project)


@app.get("/api/projects/{project_id}/chart-data")
async def chart_data(project_id: str):
    try:
        project = engine.load_project(project_id)
    except FileNotFoundError:
        raise HTTPException(404, "项目不存在")
    return {
        "photo_locations": [
            {
                "id": loc.id,
                "photo_ref": loc.photo_ref,
                "x": loc.x,
                "y": loc.y,
                "z": loc.z,
                "source": loc.source,
                "label": loc.label,
                "obstacle_remark_id": loc.obstacle_remark_id,
                "floor_profile_id": loc.floor_profile_id,
                "has_coordinate_match": _has_coord_match(loc, project.coordinate_rows),
            }
            for loc in project.photo_locations
        ],
        "coordinate_rows": [
            {
                "id": row.id,
                "point_label": row.point_label,
                "x": row.x,
                "y": row.y,
                "z": row.z,
                "verified": row.verified,
                "floor_profile_id": row.floor_profile_id,
            }
            for row in project.coordinate_rows
        ],
        "occlusion_points": [
            {
                "id": op.id,
                "photo_ref": op.photo_ref,
                "x": op.point_x,
                "y": op.point_y,
                "z": op.point_z,
                "status": op.status.value,
                "status_label": _status_label(op.status),
                "reason": op.reason,
                "missing_material": op.missing_material,
                "next_action_label": _next_action_label(op.next_action),
                "obstacle_remark_id": op.obstacle_remark_id,
                "floor_profile_id": op.floor_profile_id,
            }
            for op in project.occlusion_points
        ],
        "obstacle_remarks": [
            {
                "id": r.id,
                "location": r.location,
                "description": r.description,
                "severity": r.severity.value,
                "photo_refs": r.photo_refs,
            }
            for r in project.obstacle_remarks
        ],
        "floor_profiles": [
            {
                "id": p.id,
                "floor_name": p.floor_name,
                "photo_refs": p.photo_refs,
            }
            for p in project.floor_profiles
        ],
    }


def _has_coord_match(loc: PhotoLocation, rows: list[CoordinateRow]) -> bool:
    from .core import find_matching_coordinate

    return find_matching_coordinate(loc, rows) is not None


def _project_summary(project: InspectionProject) -> dict:
    return {
        "id": project.id,
        "name": project.name,
        "plant_name": project.plant_name,
        "current_phase": project.current_phase.value,
        "current_phase_label": _phase_label(project.current_phase),
    }


def _project_detail(project: InspectionProject) -> dict:
    pending = sum(1 for op in project.occlusion_points if op.status == OcclusionStatus.PENDING_REVIEW)
    resolved = sum(1 for op in project.occlusion_points if op.status == OcclusionStatus.RESOLVED)
    return {
        **_project_summary(project),
        "stats": {
            "obstacle_remarks": len(project.obstacle_remarks),
            "floor_profiles": len(project.floor_profiles),
            "photo_locations": len(project.photo_locations),
            "coordinate_rows": len(project.coordinate_rows),
            "occlusion_points": len(project.occlusion_points),
            "pending_review": pending,
            "resolved": resolved,
        },
        "obstacle_remarks": [r.model_dump() for r in project.obstacle_remarks],
        "floor_profiles": [p.model_dump() for p in project.floor_profiles],
        "photo_locations": [loc.model_dump() for loc in project.photo_locations],
        "coordinate_rows": [r.model_dump() for r in project.coordinate_rows],
        "occlusion_points": [
            {
                **op.model_dump(),
                "status_label": _status_label(op.status),
                "next_action_label": _next_action_label(op.next_action),
            }
            for op in project.occlusion_points
        ],
    }
