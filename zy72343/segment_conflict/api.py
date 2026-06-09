"""FastAPI 后端服务

一致性保证：所有参数版本相关的统计，
统一调用 processor 中的 get_latest_parameter_versions / count_todo_by_latest_versions
确保与 CLI / 报告 / Web 面板展示的是同一份最新结果。
"""
import os
import shutil
import tempfile
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .processor import (
    import_segments_from_csv,
    load_project,
    supplement_questionnaire_row,
    review_gap,
    review_segment_parameter,
    generate_report,
    get_latest_parameter_versions,
    get_parameter_version_history,
    count_todo_by_latest_versions,
)
from .models import Project, ParameterVersion, ReviewRecord

app = FastAPI(
    title="线段相交施工冲突检测 API",
    description="全链路数据一致性：CLI / API / 报告 / Web 面板共享同一份最新参数版本",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PROJECTS_DIR = "projects"
os.makedirs(PROJECTS_DIR, exist_ok=True)


# ---------- 请求模型 ----------

class SupplementRequest(BaseModel):
    project_name: str
    segment_id: int
    questionnaire_row: int


class ReviewGapRequest(BaseModel):
    project_name: str
    gap_index: int
    approved: bool
    note: str


class ReviewParamRequest(BaseModel):
    project_name: str
    segment_id: int
    approved: bool
    note: str


# ---------- 工具函数 ----------

def get_project_path(project_name: str) -> str:
    return os.path.join(PROJECTS_DIR, f"{project_name}.json")


def _serialize_latest_pv(
    project: Project, pv: ParameterVersion
) -> Dict[str, Any]:
    """把单条最新参数版本序列化，并附完整历史列表"""
    seg = next((s for s in project.segments if s.id == pv.segment_id), None)
    history = get_parameter_version_history(project, pv.segment_id)
    data = pv.to_dict()
    data["segment_name"] = seg.name if seg else None
    data["original_row_num"] = seg.original_row_num if seg else None
    data["questionnaire_row"] = seg.questionnaire_row if seg else None
    data["is_deleted"] = seg.is_deleted if seg else None
    data["source_type"] = seg.source_type if seg else None
    data["history_count"] = len(history)
    data["history"] = [h.to_dict() for h in history]
    return data


def _todo_summary(project: Project) -> Dict[str, Any]:
    """所有入口统一的待处理摘要（基于最新参数版本去重）"""
    needs_qi, needs_review = count_todo_by_latest_versions(project)
    pending_gaps = len([g for g in project.gaps if g.status == "pending_supplement"])
    supplemented_gaps = len(
        [g for g in project.gaps if g.status in ("supplemented", "partially_resolved")]
    )
    return {
        "needs_qi_count": needs_qi,
        "needs_review_count": needs_review,
        "pending_gaps": pending_gaps,
        "supplemented_gaps_for_review": supplemented_gaps,
        "critical_conflicts": len(
            [c for c in project.conflicts if c.severity in ("critical", "high")]
        ),
        "review_records": len(project.review_records),
        "project_version": project.version,
        "consistency_note": (
            "所有计数基于最新参数版本去重结果，"
            "与 CLI status / 报告 / Web 面板一致"
        ),
    }


# ---------- 路由 ----------

@app.get("/")
def root():
    return {
        "name": "线段相交施工冲突检测系统",
        "version": "2.0.0（全链路数据一致性）",
        "consistency": (
            "CLI / API / 报告 / Web 面板"
            "统一通过 get_latest_parameter_versions() 获取最新数据"
        ),
        "endpoints": {
            "import (POST)": "/import?name=xxx  ① 导入手算反例",
            "projects (GET)": "/projects          项目列表",
            "project (GET)": "/projects/{name}   项目详情（含统一摘要、最新参数版本）",
            "latest-params (GET)": "/projects/{name}/latest-params  最新参数版本分页",
            "history (GET)": "/projects/{name}/segments/{seg_id}/history  单条变更链",
            "review-records (GET)": "/projects/{name}/review-records  复核记录链",
            "supplement (POST)": "/supplement     ② 小祁补录问卷行",
            "review-gap (POST)": "/review-gap     ③ 教研组复核断档",
            "review-param (POST)": "/review-param  ③ 教研组复核参数版本",
            "report (GET)": "/report/{name}      下载报告",
            "3d-data (GET)": "/3d-data/{name}    3D可视化数据",
        },
    }


# ① 导入
@app.post("/import")
async def import_csv(name: str, file: UploadFile = File(...)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name
        project = import_segments_from_csv(tmp_path, name)
        project_path = get_project_path(name)
        project.save(project_path)
        os.unlink(tmp_path)

        needs_qi, needs_review = count_todo_by_latest_versions(project)
        return {
            "status": "success",
            "project": name,
            "segments_count": len(project.segments),
            "conflicts_count": len(project.conflicts),
            "gaps_count": len(project.gaps),
            "version": project.version,
            "todo": _todo_summary(project),
            "consistency": (
                "此处待处理数量与 CLI status / 报告 / Web 面板完全一致，"
                f"小祁={needs_qi}, 教研组={needs_review}"
            ),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# 项目列表
@app.get("/projects")
def list_projects():
    projects = []
    for fname in sorted(os.listdir(PROJECTS_DIR)):
        if not fname.endswith(".json"):
            continue
        name = fname[:-5]
        try:
            p = load_project(get_project_path(name))
            needs_qi, needs_review = count_todo_by_latest_versions(p)
            projects.append(
                {
                    "name": name,
                    "version": p.version,
                    "segments": len(p.segments),
                    "conflicts": len(p.conflicts),
                    "gaps": len(p.gaps),
                    "needs_qi_count": needs_qi,
                    "needs_review_count": needs_review,
                    "updated_at": p.updated_at.isoformat(),
                }
            )
        except Exception as e:
            projects.append({"name": name, "error": str(e)})
    return {"projects": projects}


# 项目详情
@app.get("/projects/{name}")
def get_project(name: str):
    path = get_project_path(name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")
    project = load_project(path)

    # 最新参数版本（按 segment_id 去重）——与其他入口共享同一份数据
    latest_map = get_latest_parameter_versions(project)
    latest_params = []
    for sid in sorted(latest_map.keys()):
        latest_params.append(_serialize_latest_pv(project, latest_map[sid]))

    data = project.to_dict()
    data["todo"] = _todo_summary(project)
    data["latest_parameters"] = latest_params
    data["latest_parameters_count"] = len(latest_params)
    data["history_count_total"] = len(project.parameter_versions)
    data["consistency_warning"] = (
        "前端展示时必须使用 latest_parameters（已去重）进行列表/统计展示；"
        "parameter_versions 字段仅用于完整历史追溯，不得直接用于计数。"
    )
    return data


# 最新参数版本（分页 + 按状态筛选）
@app.get("/projects/{name}/latest-params")
def get_latest_params(
    name: str,
    status: Optional[str] = None,
    next_owner: Optional[str] = None,
    segment_id: Optional[int] = None,
):
    path = get_project_path(name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")
    project = load_project(path)
    latest_map = get_latest_parameter_versions(project)

    results = []
    for sid in sorted(latest_map.keys()):
        pv = latest_map[sid]
        if status and pv.status != status:
            continue
        if next_owner and pv.next_owner != next_owner:
            continue
        if segment_id and pv.segment_id != segment_id:
            continue
        results.append(_serialize_latest_pv(project, pv))

    needs_qi = sum(1 for r in results if r["status"] == "needs_supplement")
    needs_review = sum(
        1 for r in results if r["status"] in ("pending_review", "ready_for_review")
    )

    return {
        "total": len(results),
        "needs_qi_count_in_filter": needs_qi,
        "needs_review_count_in_filter": needs_review,
        "items": results,
    }


# 单条线段参数版本完整变更链
@app.get("/projects/{name}/segments/{segment_id}/history")
def get_segment_history(name: str, segment_id: int):
    path = get_project_path(name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")
    project = load_project(path)
    history = get_parameter_version_history(project, segment_id)
    seg = next((s for s in project.segments if s.id == segment_id), None)
    if not history and not seg:
        raise HTTPException(status_code=404, detail=f"线段{segment_id}不存在")
    return {
        "segment": seg.to_dict() if seg else None,
        "versions_count": len(history),
        "versions": [
            _serialize_latest_pv(project, pv) for pv in history
        ],
    }


# 人工复核记录链
@app.get("/projects/{name}/review-records")
def get_review_records(name: str):
    path = get_project_path(name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")
    project = load_project(path)
    return {
        "total": len(project.review_records),
        "records": [r.to_dict() for r in project.review_records],
    }


# ② 小祁补录问卷行
@app.post("/supplement")
def supplement_row(req: SupplementRequest):
    path = get_project_path(req.project_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")

    project = load_project(path)

    # 补录前快照（便于前端展示状态变更对比）
    latest_before = get_latest_parameter_versions(project)
    pv_before = latest_before.get(req.segment_id)
    before = {
        "status": pv_before.status if pv_before else None,
        "missing_materials": pv_before.missing_materials if pv_before else [],
        "next_owner": pv_before.next_owner if pv_before else None,
        "kept_reason": pv_before.kept_reason if pv_before else None,
    }

    project = supplement_questionnaire_row(
        project, req.segment_id, req.questionnaire_row
    )
    project.save(path)

    latest_after = get_latest_parameter_versions(project)
    pv_after = latest_after.get(req.segment_id)
    after = {
        "status": pv_after.status if pv_after else None,
        "missing_materials": pv_after.missing_materials if pv_after else [],
        "next_owner": pv_after.next_owner if pv_after else None,
        "kept_reason": pv_after.kept_reason if pv_after else None,
        "original_value": pv_after.original_value if pv_after else None,
        "new_value": pv_after.new_value if pv_after else None,
        "change_reason": pv_after.change_reason if pv_after else None,
    }

    return {
        "status": "success",
        "segment_id": req.segment_id,
        "questionnaire_row": req.questionnaire_row,
        "before": before,
        "after": after,
        "new_project_version": project.version,
        "todo": _todo_summary(project),
        "consistency": (
            "补录后同步更新：线段本身、断档记录、参数版本、冲突重算、项目版本号；"
            "所有入口下次读取时将看到同一份最新结果。"
        ),
    }


# ③ 教研组复核断档
@app.post("/review-gap")
def review_gap_endpoint(req: ReviewGapRequest):
    path = get_project_path(req.project_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")

    project = load_project(path)
    if not (0 <= req.gap_index < len(project.gaps)):
        raise HTTPException(status_code=400, detail="无效的断档索引")

    before_status = project.gaps[req.gap_index].status

    project = review_gap(
        project, req.gap_index, req.approved, req.note
    )
    project.save(path)

    gap_after = project.gaps[req.gap_index]

    # 找到最新添加的复核记录
    latest_review = project.review_records[-1] if project.review_records else None

    return {
        "status": "success",
        "gap_index": req.gap_index,
        "approved": req.approved,
        "before": {"status": before_status},
        "after": {
            "status": gap_after.status,
            "note": gap_after.note,
            "reviewed_by": gap_after.reviewed_by,
        },
        "review_record": latest_review.to_dict() if latest_review else None,
        "new_project_version": project.version,
        "todo": _todo_summary(project),
        "consistency": (
            "复核后同步更新：断档状态、生成复核记录链（原始说法→改后值→处理原因→下一步找谁）、"
            "相邻线段参数版本追加变更版本；不提前归到正常结果。"
        ),
    }


# ③ 教研组复核参数版本
@app.post("/review-param")
def review_param_endpoint(req: ReviewParamRequest):
    path = get_project_path(req.project_name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")
    project = load_project(path)
    project = review_segment_parameter(
        project, req.segment_id, req.approved, req.note
    )
    project.save(path)
    return {
        "status": "success",
        "new_project_version": project.version,
        "todo": _todo_summary(project),
    }


# 下载报告
@app.get("/report/{name}")
def get_report(name: str):
    path = get_project_path(name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")

    report_path = os.path.join(tempfile.gettempdir(), f"{name}_report.txt")
    project = load_project(path)
    generate_report(project, report_path)

    return FileResponse(
        report_path,
        media_type="text/plain; charset=utf-8",
        filename=f"{name}_冲突检测报告_v{project.version}.txt",
    )


# 3D 数据
@app.get("/3d-data/{name}")
def get_3d_data(name: str):
    path = get_project_path(name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="项目不存在")
    project = load_project(path)

    # 线段上挂最新参数版本的关键字段，便于前端点击追溯
    latest_map = get_latest_parameter_versions(project)

    segments_data = []
    for s in project.segments:
        pv = latest_map.get(s.id)
        segments_data.append(
            {
                "id": s.id,
                "name": s.name,
                "category": s.category,
                "is_deleted": s.is_deleted,
                "original_row": s.original_row_num,
                "questionnaire_row": s.questionnaire_row,
                "source_type": s.source_type,
                "start": s.start.to_dict(),
                "end": s.end.to_dict(),
                "trace": (
                    {
                        "status": pv.status,
                        "next_owner": pv.next_owner,
                        "missing_materials": pv.missing_materials,
                        "kept_reason": pv.kept_reason,
                        "original_value": pv.original_value,
                        "new_value": pv.new_value,
                        "change_reason": pv.change_reason,
                        "param_version": pv.version,
                    }
                    if pv
                    else None
                ),
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
                "type": c.conflict_type,
            }
        )

    gaps_data = [g.to_dict() for g in project.gaps]
    review_count = len(project.review_records)
    todo = _todo_summary(project)

    return {
        "segments": segments_data,
        "conflicts": conflicts_data,
        "gaps": gaps_data,
        "todo_summary": todo,
        "review_records_count": review_count,
        "bounds": _calculate_bounds(project),
        "consistency": (
            "3D线段上的 trace 字段即为 CLI/报告/面板展示的"
            "最新参数版本，点击追溯时数据完全一致。"
        ),
    }


def _calculate_bounds(project: Project):
    all_pts = []
    for s in project.segments:
        all_pts.append(s.start.to_tuple())
        all_pts.append(s.end.to_tuple())
    for c in project.conflicts:
        all_pts.append(c.intersection_point.to_tuple())
    if not all_pts:
        return {"min": [0, 0, 0], "max": [1, 1, 1]}
    xs = [p[0] for p in all_pts]
    ys = [p[1] for p in all_pts]
    zs = [p[2] for p in all_pts]
    return {
        "min": [min(xs), min(ys), min(zs)],
        "max": [max(xs), max(ys), max(zs)],
    }
