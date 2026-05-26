from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Body
from fastapi.responses import JSONResponse
from typing import Optional, List
from datetime import datetime
import os

from app.models import (
    BatchRequest,
    ProcessResult,
    BatchStatusResponse,
    LocalProcessRequest,
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
            "POST /api/v1/process/local": "处理本地文件数据",
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
        waybill_content = (await waybill_file.read()).decode("utf-8")
        track_content = (await track_file.read()).decode("utf-8")
        rules_content = (await rules_file.read()).decode("utf-8")

        content_hash = service.generate_content_hash(waybill_content, track_content, rules_content)

        if not batch_id:
            existing_batch = service.get_batch_by_content_hash(content_hash)
            if existing_batch:
                cached = service.get_batch_status(existing_batch)
                return ProcessResult(
                    batch_id=existing_batch,
                    status="duplicate",
                    normal_count=cached["normal_count"],
                    pending_count=cached["pending_count"],
                    failed_count=cached["failed_count"],
                    normal_items=cached["normal_items"],
                    pending_items=cached["pending_items"],
                    failed_items=cached["failed_items"],
                    processing_time=cached["processing_time"],
                    message=f"相同内容的批次已存在（批次ID: {existing_batch}），请勿重复提交相同文件",
                )
            batch_id = service.generate_batch_id()
        else:
            if service.is_batch_processed(batch_id):
                cached = service.get_batch_status(batch_id)
                return ProcessResult(
                    batch_id=batch_id,
                    status="duplicate",
                    normal_count=cached["normal_count"],
                    pending_count=cached["pending_count"],
                    failed_count=cached["failed_count"],
                    normal_items=cached["normal_items"],
                    pending_items=cached["pending_items"],
                    failed_items=cached["failed_items"],
                    processing_time=cached["processing_time"],
                    message=f"批次 {batch_id} 已处理完成，重复提交无效",
                )

        waybills = parse_waybill_csv(waybill_content)
        tracks = parse_tracks_json(track_content)
        rules = parse_rules_json(rules_content)

        result = service.process_batch(
            batch_id=batch_id,
            waybills=waybills,
            tracks=tracks,
            rules=rules,
        )

        service.register_content_hash(content_hash, batch_id)

        return result
    except HTTPException:
        raise
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
def process_local_files(request: LocalProcessRequest = Body(...)):
    try:
        if not os.path.exists(request.waybill_path):
            raise HTTPException(status_code=404, detail=f"运单文件不存在: {request.waybill_path}")
        if not os.path.exists(request.track_path):
            raise HTTPException(status_code=404, detail=f"轨迹文件不存在: {request.track_path}")
        if not os.path.exists(request.rules_path):
            raise HTTPException(status_code=404, detail=f"规则文件不存在: {request.rules_path}")

        waybill_content = read_file_content(request.waybill_path)
        track_content = read_file_content(request.track_path)
        rules_content = read_file_content(request.rules_path)

        content_hash = service.generate_content_hash(waybill_content, track_content, rules_content)

        batch_id = request.batch_id
        if not batch_id:
            existing_batch = service.get_batch_by_content_hash(content_hash)
            if existing_batch:
                cached = service.get_batch_status(existing_batch)
                return ProcessResult(
                    batch_id=existing_batch,
                    status="duplicate",
                    normal_count=cached["normal_count"],
                    pending_count=cached["pending_count"],
                    failed_count=cached["failed_count"],
                    normal_items=cached["normal_items"],
                    pending_items=cached["pending_items"],
                    failed_items=cached["failed_items"],
                    processing_time=cached["processing_time"],
                    message=f"相同内容的批次已存在（批次ID: {existing_batch}），请勿重复提交相同文件",
                )
            batch_id = service.generate_batch_id()
        else:
            if service.is_batch_processed(batch_id):
                cached = service.get_batch_status(batch_id)
                return ProcessResult(
                    batch_id=batch_id,
                    status="duplicate",
                    normal_count=cached["normal_count"],
                    pending_count=cached["pending_count"],
                    failed_count=cached["failed_count"],
                    normal_items=cached["normal_items"],
                    pending_items=cached["pending_items"],
                    failed_items=cached["failed_items"],
                    processing_time=cached["processing_time"],
                    message=f"批次 {batch_id} 已处理完成，重复提交无效",
                )

        waybills = parse_waybill_csv(waybill_content)
        tracks = parse_tracks_json(track_content)
        rules = parse_rules_json(rules_content)

        result = service.process_batch(
            batch_id=batch_id,
            waybills=waybills,
            tracks=tracks,
            rules=rules,
        )

        service.register_content_hash(content_hash, batch_id)

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"本地文件处理失败: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
