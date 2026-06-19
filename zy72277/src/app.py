from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from src import db
from src.services import persistent_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    persistent_service.init_task("DEMO-001")
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(STATIC_DIR))


class ImportRangefinderBody(BaseModel):
    records: list
    source_batch: str
    imported_by: str


class AddRemarkBody(BaseModel):
    remark: dict
    submitted_by: str


class AddRangefinderBody(BaseModel):
    record: dict
    source_batch: str
    imported_by: str


class DecideConflictBody(BaseModel):
    operator: str
    confirm: bool


class ReviewAliasBody(BaseModel):
    reviewer: str
    is_same_object: bool


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/tasks/{task_id}/status")
async def get_status(task_id: str):
    result = db.ResultRepo.get_latest(task_id)
    version = result["version"] if result else 0
    annotations = db.AnnotationRepo.list_by_task(task_id, version)
    records = db.RangefinderRepo.list_by_task(task_id)
    remarks = db.RemarkRepo.list_by_task(task_id)
    conflicts = db.ConflictRepo.list_by_task(task_id)
    aliases = db.AliasCandidateRepo.list_by_task(task_id)
    self_check = persistent_service.run_self_check(task_id)
    pending = persistent_service.get_pending_decisions(task_id)

    return {
        "task_id": task_id,
        "version": version,
        "result_summary": {
            "version": f"v{version}",
            "total_obstacles": len(annotations),
            "total_rangefinder_records": len(records),
            "duplicate_records": sum(1 for r in records if r["is_duplicate"]),
            "total_remarks": len(remarks),
            "pending_conflicts": sum(1 for c in conflicts if c["confirm_status"] == "pending"),
            "pending_alias_reviews": sum(1 for a in aliases if a["confirm_status"] == "pending"),
            "obstacles_with_alias_issue": sum(1 for a in annotations if a["has_name_alias_issue"]),
            "obstacles_need_review": sum(1 for a in annotations if a["needs_review"]),
        },
        "self_check": self_check,
        "pending_decisions": pending,
    }


@app.post("/api/tasks/{task_id}/import-rangefinder")
async def import_rangefinder(task_id: str, body: ImportRangefinderBody):
    return persistent_service.import_rangefinder(
        task_id, body.records, body.source_batch, body.imported_by
    )


@app.post("/api/tasks/{task_id}/add-remark")
async def add_remark(task_id: str, body: AddRemarkBody):
    return persistent_service.add_remark(task_id, body.remark, body.submitted_by)


@app.post("/api/tasks/{task_id}/add-rangefinder")
async def add_rangefinder(task_id: str, body: AddRangefinderBody):
    return persistent_service.add_rangefinder_record(
        task_id, body.record, body.source_batch, body.imported_by
    )


@app.post("/api/tasks/{task_id}/conflicts/{conflict_id}/decide")
async def decide_conflict(task_id: str, conflict_id: str, body: DecideConflictBody):
    return persistent_service.decide_conflict(
        task_id, conflict_id, body.operator, body.confirm
    )


@app.post("/api/tasks/{task_id}/aliases/{candidate_id}/review")
async def review_alias(task_id: str, candidate_id: str, body: ReviewAliasBody):
    return persistent_service.review_alias(
        task_id, candidate_id, body.reviewer, body.is_same_object
    )


@app.get("/api/tasks/{task_id}/3d-view")
async def get_3d_view(task_id: str):
    return persistent_service.get_3d_view_data(task_id)


@app.get("/api/tasks/{task_id}/export")
async def get_export(task_id: str):
    return persistent_service.get_export_data(task_id)


@app.get("/api/tasks/{task_id}/self-check")
async def get_self_check(task_id: str):
    return persistent_service.run_self_check(task_id)


@app.get("/api/tasks/{task_id}/version-history")
async def get_version_history(task_id: str):
    return persistent_service.get_version_history(task_id)


@app.get("/api/tasks/{task_id}/pending-decisions")
async def get_pending_decisions(task_id: str):
    return persistent_service.get_pending_decisions(task_id)


@app.get("/api/tasks/{task_id}/logs")
async def get_logs(task_id: str):
    return db.LogRepo.list_by_task(task_id)


@app.get("/api/tasks/{task_id}/trajectory-points")
async def get_trajectory_points(task_id: str):
    return db.TrajectoryPointRepo.list_by_task(task_id)


@app.get("/api/tasks/{task_id}/rangefinder-records")
async def get_rangefinder_records(task_id: str):
    return db.RangefinderRepo.list_by_task(task_id)


@app.get("/api/tasks/{task_id}/obstacle-remarks")
async def get_obstacle_remarks(task_id: str):
    return db.RemarkRepo.list_by_task(task_id)


@app.get("/api/tasks/{task_id}/conflicts")
async def get_conflicts(task_id: str):
    return db.ConflictRepo.list_by_task(task_id)


@app.get("/api/tasks/{task_id}/alias-candidates")
async def get_alias_candidates(task_id: str):
    return db.AliasCandidateRepo.list_by_task(task_id)


@app.get("/api/tasks/{task_id}/annotations")
async def get_annotations(task_id: str, version: int = None):
    all_anns = db.AnnotationRepo.list_by_task(task_id, version)
    if version is None:
        latest = db.ResultRepo.get_latest(task_id)
        if latest:
            all_anns = [a for a in all_anns if a["version"] == latest["version"]]
    return all_anns
