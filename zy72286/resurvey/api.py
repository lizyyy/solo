from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from typing import Optional, List, Dict, Any
import os
import json
import tempfile

from .workflow import ThreeStepWorkflow
from .self_check import SelfChecker
from .exporter import DataExporter, UnifiedDataSource

app = FastAPI(title="老旧小区楼间距复测系统 API")

_workflow_cache: Dict[str, ThreeStepWorkflow] = {}


def _get_workflow(project_id: Optional[str] = None) -> ThreeStepWorkflow:
    if project_id and project_id in _workflow_cache:
        return _workflow_cache[project_id]
    workflow = ThreeStepWorkflow()
    _workflow_cache[workflow.project.project_id] = workflow
    return workflow


@app.get("/")
async def root():
    return {
        "name": "老旧小区楼间距复测系统 API",
        "version": "0.1.0",
        "endpoints": {
            "POST /api/v1/import": "步骤1: 导入障碍物备注",
            "POST /api/v1/sketch": "步骤2: 补看楼层剖面草图",
            "POST /api/v1/export": "步骤3: 导出截图更新",
            "POST /api/v1/supplement": "补录路线（处理长度未重算）",
            "POST /api/v1/recalculate": "客户复核后重算",
            "GET /api/v1/records": "获取所有记录",
            "GET /api/v1/records/{record_id}": "获取单条记录详情",
            "GET /api/v1/self-check": "运行自检",
            "GET /api/v1/evidence": "获取证据摘要",
            "GET /api/v1/needs-review": "获取待客户复核记录",
            "GET /api/v1/download/excel": "下载Excel导出",
        }
    }


@app.post("/api/v1/import")
async def import_obstacle_remarks(
    file: UploadFile = File(...),
    operator: str = Form("许工"),
    project_id: Optional[str] = Form(None),
):
    """步骤1: 导入障碍物备注"""
    workflow = _get_workflow(project_id)

    suffix = os.path.splitext(file.filename)[1] if file.filename else ".csv"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        result = workflow.step1_import_obstacle_remarks(tmp_path, operator)
    finally:
        os.unlink(tmp_path)

    return {
        "project_id": workflow.project.project_id,
        "step": 1,
        "name": "导入障碍物备注",
        "completed": True,
        "result": result,
        "evidence_summary": workflow.get_evidence_for_api()["summary"],
    }


@app.post("/api/v1/sketch")
async def add_floor_sketch(
    project_id: str = Form(...),
    record_id: str = Form(...),
    sketch_file: UploadFile = File(...),
    building: str = Form(...),
    floors: int = Form(...),
    review_note: str = Form("已补看楼层剖面草图，无异常"),
    reviewer: str = Form("许工"),
):
    """步骤2: 补看楼层剖面草图"""
    if project_id not in _workflow_cache:
        raise HTTPException(status_code=404, detail=f"项目不存在: {project_id}")

    workflow = _workflow_cache[project_id]

    suffix = os.path.splitext(sketch_file.filename)[1] if sketch_file.filename else ".png"
    sketch_path = os.path.join("data", f"{record_id}_sketch{suffix}")
    os.makedirs("data", exist_ok=True)

    content = await sketch_file.read()
    with open(sketch_path, "wb") as f:
        f.write(content)

    result = workflow.step2_review_floor_sketches(
        record_id, sketch_path, building, floors, review_note, reviewer
    )

    return {
        "project_id": project_id,
        "step": 2,
        "name": "补看楼层剖面草图",
        "completed": result.get("completed", False),
        "result": result,
        "evidence": workflow.data_source.get_evidence_summary(record_id),
    }


@app.post("/api/v1/export")
async def export_data(
    project_id: str = Form(...),
    operator: str = Form("许工"),
):
    """步骤3: 导出截图更新"""
    if project_id not in _workflow_cache:
        raise HTTPException(status_code=404, detail=f"项目不存在: {project_id}")

    workflow = _workflow_cache[project_id]
    os.makedirs("data", exist_ok=True)

    excel_path = os.path.join("data", f"{project_id}_export.xlsx")
    json_path = os.path.join("data", f"{project_id}_export.json")

    result = workflow.step3_export(excel_path, json_path, operator)

    return {
        "project_id": project_id,
        "step": 3,
        "name": "导出截图更新",
        "completed": result.get("completed", False),
        "result": result,
        "download_urls": {
            "excel": f"/api/v1/download/excel?project_id={project_id}",
            "json": f"/api/v1/download/json?project_id={project_id}",
        },
        "evidence_summary": workflow.get_evidence_for_api(),
    }


@app.post("/api/v1/supplement")
async def supplement_route(
    project_id: str = Form(...),
    record_id: str = Form(...),
    new_points: str = Form(...),
    remark: str = Form(""),
    operator: str = Form("许工"),
    auto_recalculate: bool = Form(False),
):
    """补录路线（处理长度未重算）"""
    if project_id not in _workflow_cache:
        raise HTTPException(status_code=404, detail=f"项目不存在: {project_id}")

    workflow = _workflow_cache[project_id]

    try:
        points = json.loads(new_points)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="路线点JSON格式无效")

    result = workflow.handle_length_not_recalculated(
        record_id, points, remark, operator, auto_recalculate
    )

    return {
        "project_id": project_id,
        "action": "handle_length_not_recalculated",
        "completed": True,
        "auto_recalculated": result["auto_recalculated"],
        "needs_customer_review": result["needs_customer_review"],
        "result": result,
        "evidence": result["evidence"],
    }


@app.post("/api/v1/recalculate")
async def recalculate_after_review(
    project_id: str = Form(...),
    record_id: str = Form(...),
    operator: str = Form("许工"),
):
    """客户复核后重算"""
    if project_id not in _workflow_cache:
        raise HTTPException(status_code=404, detail=f"项目不存在: {project_id}")

    workflow = _workflow_cache[project_id]
    result = workflow.recalculate_after_review(record_id, operator)

    return {
        "project_id": project_id,
        "action": "recalculate_after_review",
        "completed": True,
        "result": result,
        "evidence": result["evidence"],
    }


@app.get("/api/v1/records")
async def get_records(project_id: Optional[str] = None):
    """获取所有记录"""
    workflow = _get_workflow(project_id)
    return {
        "project_id": workflow.project.project_id,
        "data_source": "统一数据源",
        "records": workflow.data_source.get_all_records(),
    }


@app.get("/api/v1/records/{record_id}")
async def get_record_detail(record_id: str, project_id: Optional[str] = None):
    """获取单条记录详情"""
    workflow = _get_workflow(project_id)
    detail = workflow.data_source.get_record_detail(record_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"记录不存在: {record_id}")
    return {
        "project_id": workflow.project.project_id,
        "data_source": "统一数据源",
        "record": detail,
        "evidence": workflow.data_source.get_evidence_summary(record_id),
    }


@app.get("/api/v1/self-check")
async def run_self_check(project_id: Optional[str] = None):
    """运行自检"""
    workflow = _get_workflow(project_id)
    checker = SelfChecker(workflow.project)
    return {
        "project_id": workflow.project.project_id,
        "self_check": checker.get_summary(),
    }


@app.get("/api/v1/evidence")
async def get_evidence(project_id: Optional[str] = None):
    """获取证据摘要"""
    workflow = _get_workflow(project_id)
    return workflow.get_evidence_for_api()


@app.get("/api/v1/needs-review")
async def get_needs_review(project_id: Optional[str] = None):
    """获取待客户复核记录"""
    workflow = _get_workflow(project_id)
    checker = SelfChecker(workflow.project)
    return {
        "project_id": workflow.project.project_id,
        "needing_customer_review": checker.get_records_needing_customer_review(),
    }


@app.get("/api/v1/download/excel")
async def download_excel(project_id: str):
    """下载Excel导出"""
    excel_path = os.path.join("data", f"{project_id}_export.xlsx")
    if not os.path.exists(excel_path):
        raise HTTPException(status_code=404, detail="导出文件不存在，请先调用 /api/v1/export")
    return FileResponse(
        excel_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"{project_id}_楼间距复测报告.xlsx",
    )


@app.get("/api/v1/download/json")
async def download_json(project_id: str):
    """下载JSON导出"""
    json_path = os.path.join("data", f"{project_id}_export.json")
    if not os.path.exists(json_path):
        raise HTTPException(status_code=404, detail="导出文件不存在，请先调用 /api/v1/export")
    return FileResponse(
        json_path,
        media_type="application/json",
        filename=f"{project_id}_楼间距复测报告.json",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
