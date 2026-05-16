from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db, init_db
from app.models import (
    PipelineCreateRequest, PipelineResponse, ShardResponse,
    ResumeRequest, StatusUpdateRequest, ShardCompleteRequest,
    ManualCorrectionRequest, PipelineStatus, ShardStatus
)
from app.service import PipelineService

app = FastAPI(title="数据管道断点续跑API", version="1.0.0")

@app.on_event("startup")
def startup_event():
    init_db()

@app.post("/api/pipelines", response_model=PipelineResponse, summary="创建管道")
def create_pipeline(request: PipelineCreateRequest, db: Session = Depends(get_db)):
    try:
        service = PipelineService(db)
        return service.create_pipeline(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/pipelines", response_model=List[PipelineResponse], summary="查询所有管道")
def get_pipelines(db: Session = Depends(get_db)):
    service = PipelineService(db)
    return service.get_all_pipelines()

@app.get("/api/pipelines/{pipeline_id}", response_model=PipelineResponse, summary="查询单个管道")
def get_pipeline(pipeline_id: int, db: Session = Depends(get_db)):
    service = PipelineService(db)
    pipeline = service.get_pipeline(pipeline_id)
    if not pipeline:
        raise HTTPException(status_code=404, detail="管道不存在")
    return pipeline

@app.get("/api/pipelines/{pipeline_id}/shards", response_model=List[ShardResponse], summary="查询管道分片")
def get_shards(pipeline_id: int, db: Session = Depends(get_db)):
    service = PipelineService(db)
    if not service.get_pipeline(pipeline_id):
        raise HTTPException(status_code=404, detail="管道不存在")
    return service.get_shards(pipeline_id)

@app.post("/api/pipelines/resume", summary="续跑管道")
def resume_pipeline(request: ResumeRequest, db: Session = Depends(get_db)):
    try:
        service = PipelineService(db)
        shards, warnings = service.resume_pipeline(request)
        return {
            "executable_shards": len(shards),
            "warnings": warnings,
            "shards": [
                {
                    "shard_index": s.shard_index,
                    "range_start": s.shard_range_start,
                    "range_end": s.shard_range_end
                }
                for s in shards
            ]
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/pipelines/{pipeline_id}/status", response_model=PipelineResponse, summary="更新管道状态")
def update_pipeline_status(pipeline_id: int, request: StatusUpdateRequest, db: Session = Depends(get_db)):
    try:
        service = PipelineService(db)
        return service.update_pipeline_status(pipeline_id, request.status, request.reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.put("/api/pipelines/{pipeline_id}/shards/{shard_index}/complete", response_model=ShardResponse, summary="完成分片")
def complete_shard(pipeline_id: int, shard_index: int, request: ShardCompleteRequest, db: Session = Depends(get_db)):
    try:
        service = PipelineService(db)
        return service.complete_shard(
            pipeline_id, shard_index, request.status,
            request.write_summary, request.failure_reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/pipelines/{pipeline_id}/manual-correction", response_model=ShardResponse, summary="人工修正")
def manual_correction(pipeline_id: int, request: ManualCorrectionRequest, db: Session = Depends(get_db)):
    try:
        service = PipelineService(db)
        return service.manual_correction(pipeline_id, request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/pipelines/{pipeline_id}/export-summary", summary="导出摘要")
def export_summary(pipeline_id: int, db: Session = Depends(get_db)):
    try:
        service = PipelineService(db)
        return service.export_summary(pipeline_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@app.get("/api/pipelines/{pipeline_id}/history", summary="查询历史记录")
def get_history(pipeline_id: int, limit: int = 100, db: Session = Depends(get_db)):
    service = PipelineService(db)
    if not service.get_pipeline(pipeline_id):
        raise HTTPException(status_code=404, detail="管道不存在")
    histories = service.get_history(pipeline_id, limit)
    return [
        {
            "id": h.id,
            "action": h.action,
            "status_before": h.status_before,
            "status_after": h.status_after,
            "conclusion": h.conclusion,
            "operator": h.operator,
            "created_at": h.created_at.isoformat(),
            "raw_input": h.raw_input
        }
        for h in histories
    ]

@app.get("/health", summary="健康检查")
def health_check():
    return {"status": "ok", "service": "pipeline-resume-api"}
