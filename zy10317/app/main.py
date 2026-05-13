from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.database import get_db, engine, Base
from app.models import ChannelStatus, BatchStatus
from app.schemas import (
    ChannelCreate, ChannelUpdate, ChannelResponse, ChannelDetailResponse,
    WatermarkCreate, WatermarkResponse, WatermarkAdvanceResponse,
    BatchCreate, BatchUpdate, BatchResponse,
    ConfirmationCreate, ConfirmationResponse,
    RollbackPointCreate, RollbackPointResponse, RollbackExecute,
    DiffSummaryCreate, DiffSummaryResponse,
    ApiResponse
)
from app.services import (
    ChannelService, WatermarkService, BatchService,
    ConfirmationService, RollbackService, DiffService
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="数据同步水位 API",
    description="用于管理数据同步通道、水位推进、批次确认、回退重放和差异扫描的 API 服务",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_model=ApiResponse, summary="API 健康检查")
async def root():
    return ApiResponse(
        success=True,
        code=200,
        message="数据同步水位 API 服务运行正常",
        data={"version": "1.0.0", "status": "healthy"}
    )


@app.post("/api/channels", response_model=ApiResponse, summary="创建同步通道")
async def create_channel(channel: ChannelCreate, db: Session = Depends(get_db)):
    result = ChannelService.create_channel(db, channel)
    return ApiResponse(
        success=True,
        code=201,
        message="通道创建成功",
        data={"channel": ChannelResponse.model_validate(result).model_dump()}
    )


@app.get("/api/channels", response_model=ApiResponse, summary="获取通道列表")
async def list_channels(status: Optional[ChannelStatus] = None, db: Session = Depends(get_db)):
    channels = ChannelService.list_channels(db, status)
    return ApiResponse(
        success=True,
        code=200,
        message="获取通道列表成功",
        data={
            "channels": [ChannelResponse.model_validate(c).model_dump() for c in channels],
            "total": len(channels)
        }
    )


@app.get("/api/channels/{channel_code}", response_model=ApiResponse, summary="获取通道详情")
async def get_channel(channel_code: str, db: Session = Depends(get_db)):
    channel = ChannelService.get_channel_or_404(db, channel_code)
    recent_watermarks = WatermarkService.get_watermark_history(db, channel_code, limit=10)
    recent_batches = BatchService.list_batches(db, channel_code, limit=10)
    active_rollback_points = RollbackService.list_rollback_points(db, channel_code, active_only=True)
    recent_diff_summaries = DiffService.get_diff_history(db, channel_code, limit=5)

    return ApiResponse(
        success=True,
        code=200,
        message="获取通道详情成功",
        data={
            "channel": ChannelResponse.model_validate(channel).model_dump(),
            "recent_watermarks": [WatermarkResponse.model_validate(w).model_dump() for w in recent_watermarks],
            "recent_batches": [BatchResponse.model_validate(b).model_dump() for b in recent_batches],
            "active_rollback_points": [RollbackPointResponse.model_validate(r).model_dump() for r in active_rollback_points],
            "recent_diff_summaries": [DiffSummaryResponse.model_validate(d).model_dump() for d in recent_diff_summaries]
        }
    )


@app.put("/api/channels/{channel_code}", response_model=ApiResponse, summary="更新通道信息")
async def update_channel(channel_code: str, update: ChannelUpdate, db: Session = Depends(get_db)):
    result = ChannelService.update_channel(db, channel_code, update)
    return ApiResponse(
        success=True,
        code=200,
        message="通道更新成功",
        data={"channel": ChannelResponse.model_validate(result).model_dump()}
    )


@app.post("/api/watermarks/advance", response_model=ApiResponse, summary="推进水位")
async def advance_watermark(watermark: WatermarkCreate, db: Session = Depends(get_db)):
    result, is_idempotent = WatermarkService.advance_watermark(db, watermark)
    channel = ChannelService.get_channel(db, watermark.channel_code)

    return ApiResponse(
        success=True,
        code=200,
        message="水位推进成功" if not is_idempotent else "水位已存在（幂等返回）",
        data={
            "watermark": WatermarkResponse.model_validate(result).model_dump(),
            "is_idempotent": is_idempotent,
            "previous_watermark": channel.current_watermark if not is_idempotent else watermark.watermark_value,
            "new_watermark": watermark.watermark_value
        }
    )


@app.get("/api/watermarks/{channel_code}/history", response_model=ApiResponse, summary="获取水位历史")
async def get_watermark_history(channel_code: str, limit: int = 20, db: Session = Depends(get_db)):
    watermarks = WatermarkService.get_watermark_history(db, channel_code, limit)
    return ApiResponse(
        success=True,
        code=200,
        message="获取水位历史成功",
        data={
            "watermarks": [WatermarkResponse.model_validate(w).model_dump() for w in watermarks],
            "total": len(watermarks)
        }
    )


@app.post("/api/batches", response_model=ApiResponse, summary="创建批次")
async def create_batch(batch: BatchCreate, db: Session = Depends(get_db)):
    result = BatchService.create_batch(db, batch)
    return ApiResponse(
        success=True,
        code=201,
        message="批次创建成功",
        data={"batch": BatchResponse.model_validate(result).model_dump()}
    )


@app.get("/api/batches", response_model=ApiResponse, summary="获取批次列表")
async def list_batches(
    channel_code: Optional[str] = None,
    status: Optional[BatchStatus] = None,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    batches = BatchService.list_batches(db, channel_code, status, limit)
    return ApiResponse(
        success=True,
        code=200,
        message="获取批次列表成功",
        data={
            "batches": [BatchResponse.model_validate(b).model_dump() for b in batches],
            "total": len(batches)
        }
    )


@app.get("/api/batches/{batch_id}", response_model=ApiResponse, summary="获取批次详情")
async def get_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = BatchService.get_batch_or_404(db, batch_id)
    confirmations = ConfirmationService.get_confirmations_by_batch(db, batch_id)
    return ApiResponse(
        success=True,
        code=200,
        message="获取批次详情成功",
        data={
            "batch": BatchResponse.model_validate(batch).model_dump(),
            "confirmations": [ConfirmationResponse.model_validate(c).model_dump() for c in confirmations]
        }
    )


@app.put("/api/batches/{batch_id}/status", response_model=ApiResponse, summary="更新批次状态")
async def update_batch_status(batch_id: str, update: BatchUpdate, db: Session = Depends(get_db)):
    result = BatchService.update_batch_status(db, batch_id, update)
    return ApiResponse(
        success=True,
        code=200,
        message="批次状态更新成功",
        data={"batch": BatchResponse.model_validate(result).model_dump()}
    )


@app.post("/api/confirmations", response_model=ApiResponse, summary="消费确认")
async def create_confirmation(confirmation: ConfirmationCreate, db: Session = Depends(get_db)):
    result, is_idempotent = ConfirmationService.create_confirmation(db, confirmation)
    return ApiResponse(
        success=True,
        code=200,
        message="消费确认成功" if not is_idempotent else "消费已确认（幂等返回）",
        data={
            "confirmation": ConfirmationResponse.model_validate(result).model_dump(),
            "is_idempotent": is_idempotent
        }
    )


@app.post("/api/rollback-points", response_model=ApiResponse, summary="创建回退点")
async def create_rollback_point(rollback: RollbackPointCreate, db: Session = Depends(get_db)):
    result = RollbackService.create_rollback_point(db, rollback)
    return ApiResponse(
        success=True,
        code=201,
        message="回退点创建成功",
        data={"rollback_point": RollbackPointResponse.model_validate(result).model_dump()}
    )


@app.post("/api/rollback/execute", response_model=ApiResponse, summary="执行回退")
async def execute_rollback(rollback: RollbackExecute, db: Session = Depends(get_db)):
    result = RollbackService.execute_rollback(db, rollback)
    return ApiResponse(
        success=True,
        code=200,
        message="回退执行成功",
        data=result
    )


@app.get("/api/rollback-points/{channel_code}", response_model=ApiResponse, summary="获取回退点列表")
async def list_rollback_points(channel_code: str, active_only: bool = True, db: Session = Depends(get_db)):
    points = RollbackService.list_rollback_points(db, channel_code, active_only)
    return ApiResponse(
        success=True,
        code=200,
        message="获取回退点列表成功",
        data={
            "rollback_points": [RollbackPointResponse.model_validate(p).model_dump() for p in points],
            "total": len(points)
        }
    )


@app.post("/api/diff-summaries", response_model=ApiResponse, summary="创建差异摘要")
async def create_diff_summary(diff: DiffSummaryCreate, db: Session = Depends(get_db)):
    result = DiffService.create_diff_summary(db, diff)
    return ApiResponse(
        success=True,
        code=201,
        message="差异摘要创建成功",
        data={"diff_summary": DiffSummaryResponse.model_validate(result).model_dump()}
    )


@app.get("/api/diff-summaries", response_model=ApiResponse, summary="获取差异历史")
async def get_diff_history(
    channel_code: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    diffs = DiffService.get_diff_history(db, channel_code, limit)
    return ApiResponse(
        success=True,
        code=200,
        message="获取差异历史成功",
        data={
            "diff_summaries": [DiffSummaryResponse.model_validate(d).model_dump() for d in diffs],
            "total": len(diffs)
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
