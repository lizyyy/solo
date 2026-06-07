from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, FileResponse
from typing import List, Optional
from datetime import datetime, timedelta
import io
import pandas as pd

from .models import (
    FeatureRecord,
    CheckParameters,
    ConflictResolution,
    CheckStep,
    RecordStatus,
)
from .workflow import workflow_manager

app = FastAPI(title="时间窗特征穿越检查系统")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
async def root():
    with open("app/static/index.html", "r", encoding="utf-8") as f:
        return f.read()


@app.post("/api/sessions")
async def create_session(created_by: str = "xiaomeng"):
    session = workflow_manager.create_session(created_by)
    return {"session_id": session.session_id, "message": "会话创建成功"}


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    session = workflow_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    store = workflow_manager.get_result_store(session_id)
    return store.get_summary_data()


@app.post("/api/sessions/{session_id}/step1/import")
async def step1_import(
    session_id: str,
    records: List[FeatureRecord],
    parameters: Optional[CheckParameters] = None,
):
    try:
        session = workflow_manager.step1_import_bucket(session_id, records, parameters)
        store = workflow_manager.get_result_store(session_id)
        return {
            "message": "步骤1完成：线上实验桶导入成功",
            "session": store.get_summary_data(),
            "records": store.get_all_records_for_api(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/sessions/{session_id}/step2/negatives")
async def step2_negatives(
    session_id: str,
    records: List[FeatureRecord],
):
    try:
        session = workflow_manager.step2_review_negatives(session_id, records)
        store = workflow_manager.get_result_store(session_id)
        return {
            "message": "步骤2完成：负样本列表导入并检测完成",
            "session": store.get_summary_data(),
            "records": store.get_all_records_for_api(),
            "conflicts": store.get_conflicts_for_api(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/sessions/{session_id}/conflicts")
async def get_conflicts(session_id: str):
    session = workflow_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    store = workflow_manager.get_result_store(session_id)
    return {"conflicts": store.get_conflicts_for_api()}


@app.post("/api/sessions/{session_id}/conflicts/{record_id}/resolve")
async def resolve_conflict(
    session_id: str,
    record_id: str,
    resolution: ConflictResolution,
    resolved_by: str,
):
    try:
        session = workflow_manager.resolve_conflict(
            session_id, record_id, resolution, resolved_by
        )
        store = workflow_manager.get_result_store(session_id)
        return {
            "message": "冲突处理完成",
            "conflicts": store.get_conflicts_for_api(),
            "records": store.get_all_records_for_api(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/sessions/{session_id}/step3/summary")
async def step3_summary(
    session_id: str,
    summary: str,
    reviewer: Optional[str] = None,
):
    try:
        session = workflow_manager.step3_update_summary(session_id, summary, reviewer)
        store = workflow_manager.get_result_store(session_id)
        return {
            "message": "步骤3完成：摘要更新，检查流程结束",
            "session": store.get_summary_data(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/sessions/{session_id}/resupplement")
async def resupplement_records(
    session_id: str,
    records: List[FeatureRecord],
):
    try:
        session = workflow_manager.resupplement_and_recalculate(session_id, records)
        store = workflow_manager.get_result_store(session_id)
        return {
            "message": "补录并重算完成",
            "session": store.get_summary_data(),
            "records": store.get_all_records_for_api(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/sessions/{session_id}/records")
async def get_records(session_id: str):
    session = workflow_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    store = workflow_manager.get_result_store(session_id)
    return {"records": store.get_all_records_for_api()}


@app.get("/api/sessions/{session_id}/export")
async def export_records(session_id: str):
    session = workflow_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    store = workflow_manager.get_result_store(session_id)
    records = store.get_all_records_for_export()

    df = pd.DataFrame(records)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="检查明细")
    output.seek(0)

    return FileResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"time_window_check_{session_id}.xlsx",
    )


@app.post("/api/sessions/{session_id}/self-check/consistency")
async def check_consistency(session_id: str):
    session = workflow_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    store = workflow_manager.get_result_store(session_id)

    from .self_check import check_export_consistency

    page_data = store.get_all_records_for_page()
    api_data = store.get_all_records_for_api()
    detail_data = store.get_all_records_for_export()

    result = check_export_consistency(page_data, api_data, detail_data)
    return {"result": result.dict()}
