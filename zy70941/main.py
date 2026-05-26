from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional, List
from datetime import datetime
import os

from app.models import (
    BatchRequest,
    ProcessResult,
    BatchStatusResponse,
    Waybill,
    TrackEvent,
    PenaltyRule,
)
from app.services import ReconciliationService
from app.utils import (
    parse_waybill_csv,
    parse_tracks_json,
    parse_rules_json,
    read_file_content,
)

app = FastAPI(
    title="物流调度核对系统 API",
    description="用于处理运单 CSV、轨迹 JSON 和扣罚规则，自动核对干线晚点、破损和中转责任",
    version="1.0.0",
)

service = ReconciliationService()


@app.get("/")
def root():
    return {
        "service": "物流调度核对系统",
        "version": "1.0.0",
        "endpoints": {
            "POST /api/v1/process": "处理批次数据（JSON方式）",
            "POST /api/v1/process/upload": "处理批次数据（文件上传方式）",
            "GET /api/v1/batch/{batch_id}": "查询批次处理状态",
            "GET /api/v1/health": "健康检查",
        },
    }


@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.post("/api/v1/process", response_model=ProcessResult)
def process_batch(request: BatchRequest):
    try:
        result = service.process_batch(
            batch_id=request.batch_id,
            waybills=request.waybills,
            tracks=request.tracks,
            rules=request.rules,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@app.post("/api/v1/process/upload")
async def process_batch_upload(
    batch_id: Optional[str] = Form(None),
    waybill_file: UploadFile = File(..., description="运单 CSV 文件"),
    track_file: UploadFile = File(..., description="轨迹 JSON 文件"),
    rules_file: UploadFile = File(..., description="扣罚规则 JSON 文件"),
):
    try:
        if not batch_id:
            batch_id = service.generate_batch_id()

        waybill_content = (await waybill_file.read()).decode("utf-8")
        track_content = (await track_file.read()).decode("utf-8")
        rules_content = (await rules_file.read()).decode("utf-8")

        waybills = parse_waybill_csv(waybill_content)
        tracks = parse_tracks_json(track_content)
        rules = parse_rules_json(rules_content)

        result = service.process_batch(
            batch_id=batch_id,
            waybills=waybills,
            tracks=tracks,
            rules=rules,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文件处理失败: {str(e)}")


@app.get("/api/v1/batch/{batch_id}", response_model=BatchStatusResponse)
def get_batch_status(batch_id: str):
    exists = service.is_batch_processed(batch_id)
    status_data = service.get_batch_status(batch_id)

    if exists and status_data:
        return BatchStatusResponse(
            batch_id=batch_id,
            exists=True,
            status="processed",
            created_at=status_data.get("processing_time"),
            message=f"批次 {batch_id} 已处理完成",
        )
    else:
        return BatchStatusResponse(
            batch_id=batch_id,
            exists=False,
            status="not_found",
            created_at=None,
            message=f"批次 {batch_id} 不存在",
        )


@app.post("/api/v1/process/local")
def process_local_files(
    batch_id: Optional[str] = None,
    waybill_path: str = "./samples/waybills.csv",
    track_path: str = "./samples/tracks.json",
    rules_path: str = "./samples/rules.json",
):
    try:
        if not batch_id:
            batch_id = service.generate_batch_id()

        if not os.path.exists(waybill_path):
            raise HTTPException(status_code=404, detail=f"运单文件不存在: {waybill_path}")
        if not os.path.exists(track_path):
            raise HTTPException(status_code=404, detail=f"轨迹文件不存在: {track_path}")
        if not os.path.exists(rules_path):
            raise HTTPException(status_code=404, detail=f"规则文件不存在: {rules_path}")

        waybill_content = read_file_content(waybill_path)
        track_content = read_file_content(track_path)
        rules_content = read_file_content(rules_path)

        waybills = parse_waybill_csv(waybill_content)
        tracks = parse_tracks_json(track_content)
        rules = parse_rules_json(rules_content)

        result = service.process_batch(
            batch_id=batch_id,
            waybills=waybills,
            tracks=tracks,
            rules=rules,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"本地文件处理失败: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
