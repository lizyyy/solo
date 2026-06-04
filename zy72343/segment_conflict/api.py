"""FastAPI 后端服务"""
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import tempfile
import shutil

from .processor import (
    import_segments_from_csv,
    load_project,
    supplement_questionnaire_row,
    review_gap,
    generate_report,
)
from .models import Project

app = FastAPI(title="线段相交施工冲突检测 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECTS_DIR = "projects"
os.makedirs(PROJECTS_DIR, exist_ok=True)


class SupplementRequest(BaseModel):
    project_name: str
    segment_id: int
    questionnaire_row: int


class ReviewRequest(BaseModel):
    project_name: str
    gap_index: int
    approved: bool
    note: str


def get_project_path(project_name: str) -> str:
    return os.path.join(PROJECTS_DIR, f"{project_name}.json")


@app.get("/")
def root():
    return {
        "name": "线段相交施工冲突检测系统",
        "version": "1.0.0",
        "endpoints": {
            "import": "/import (POST)",
            "projects": "/projects (GET)",
            "project": "/projects/{name} (GET)",
            "supplement": "/supplement (POST)",
            "review": "/review (POST)",
            "report": "/report/{name} (GET)",
            "3d-data": "/3d-data/{name} (GET)",
        },
    }


@app.post("/import")
async def import_csv(name: str, file: UploadFile = File(...)):
    """第一步：导入手算反例CSV"""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        project = import_segments_from_csv(tmp_path, name)
        project_path = get_project_path(name)
        project.save(project_path)

        os.unlink(tmp_path)

        return {
            "status": "success",
            "project": name,
            "segments_count": len(project.segments),
            "conflicts_count": len(project.conflicts),
            "gaps_count": len(project.gaps),
            "version": project.version,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/projects")
def list_projects():
    projects = []
    for fname in os.listdir(PROJECTS_DIR):
        if fname.endswith(".json"):
            name = fname[:-5]
            try:
                project = load_project(get_project_path(name))
                projects.append(
                    {
                        "name": name,
                        "version": project.version,
                        "segments": len(project.segments),
                        "conflicts": len(project.conflicts),
                        "gaps": len(project.gaps),
                        "updated_at": project.updated_at.isoformat(),
                    }
                )
            except:
                pass
    return {"projects": projects}


@app.get("/projects/{name}")
def get_project(name: str):
    path = get_project_path(name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")
    project = load_project(path)

    needs_qi = [
        p for p in project.parameter_versions
        if p.next_owner == "数据分析师小祁" and p.status == "needs_supplement"
    ]
    needs_review = [
        p for p in project.parameter_versions
        if p.next_owner == "教研组" and p.status in ["pending_review", "ready_for_review"]
    ]

    data = project.to_dict()
    data["todo"] = {
        "needs_qi_count": len(needs_qi),
        "needs_review_count": len(needs_review),
        "pending_gaps": len([g for g in project.gaps if g.status == "pending_supplement"]),
    }
    return data


@app.post("/supplement")
def supplement_row(req: SupplementRequest):
    """第二步：数据分析师小祁补录问卷原始行"""
    path = get_project_path(req.project_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")

    project = load_project(path)
    project = supplement_questionnaire_row(
        project, req.segment_id, req.questionnaire_row
    )
    project.save(path)

    return {
        "status": "success",
        "segment_id": req.segment_id,
        "questionnaire_row": req.questionnaire_row,
        "new_version": project.version,
    }


@app.post("/review")
def review_gap_endpoint(req: ReviewRequest):
    """教研组复核断档"""
    path = get_project_path(req.project_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")

    project = load_project(path)
    project = review_gap(project, req.gap_index, req.approved, req.note)
    project.save(path)

    return {
        "status": "success",
        "gap_index": req.gap_index,
        "approved": req.approved,
        "new_version": project.version,
    }


@app.get("/report/{name}")
def get_report(name: str):
    """第三步：生成报告"""
    path = get_project_path(name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")

    report_path = os.path.join(tempfile.gettempdir(), f"{name}_report.txt")
    project = load_project(path)
    generate_report(project, report_path)

    return FileResponse(
        report_path,
        media_type="text/plain; charset=utf-8",
        filename=f"{name}_冲突检测报告.txt",
    )


@app.get("/3d-data/{name}")
def get_3d_data(name: str):
    """获取3D可视化数据"""
    path = get_project_path(name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")

    project = load_project(path)

    segments_data = []
    for s in project.segments:
        segments_data.append(
            {
                "id": s.id,
                "name": s.name,
                "category": s.category,
                "is_deleted": s.is_deleted,
                "original_row": s.original_row_num,
                "questionnaire_row": s.questionnaire_row,
                "start": s.start.to_dict(),
                "end": s.end.to_dict(),
            }
        )

    conflicts_data = []
    for c in project.conflicts:
        conflicts_data.append(
            {
                "id": c.id,
                "segment1": c.segment1_id,
                "segment2": c.segment2_id,
                "point": c.intersection_point.to_dict(),
                "severity": c.severity,
                "distance": c.distance,
            }
        )

    gaps_data = [g.to_dict() for g in project.gaps]

    return {
        "segments": segments_data,
        "conflicts": conflicts_data,
        "gaps": gaps_data,
        "bounds": _calculate_bounds(project),
    }


def _calculate_bounds(project: Project):
    all_points = []
    for s in project.segments:
        all_points.append(s.start.to_tuple())
        all_points.append(s.end.to_tuple())
    for c in project.conflicts:
        all_points.append(c.intersection_point.to_tuple())

    if not all_points:
        return {"min": [0, 0, 0], "max": [1, 1, 1]}

    xs = [p[0] for p in all_points]
    ys = [p[1] for p in all_points]
    zs = [p[2] for p in all_points]

    return {
        "min": [min(xs), min(ys), min(zs)],
        "max": [max(xs), max(ys), max(zs)],
    }
