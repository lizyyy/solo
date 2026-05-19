from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import (
    GrayBatchCreate,
    GrayBatchUpdate,
    GrayBatchResponse,
    MetricWindowCreate,
    MetricWindowResponse,
    GapSegmentCreate,
    GapSegmentResponse,
    BackfillSourceCreate,
    BackfillSourceResponse,
    AuditRecordResponse,
    ResultSnapshotResponse,
    ExceptionLogResponse,
    StatusTransitionRequest,
    ManualCorrectionRequest,
    BatchStatus,
)
from app.services import (
    BatchService,
    AuditService,
    SnapshotService,
    ExceptionService,
)
from app.services.window_service import WindowService, GapSegmentService, BackfillSourceService
from app.services.validation_service import ValidationService
import json

router = APIRouter()


@router.post("/batches/", response_model=GrayBatchResponse)
def create_batch(batch: GrayBatchCreate, db: Session = Depends(get_db)):
    try:
        batch_service = BatchService(db)
        return batch_service.create_batch(batch)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/batches/", response_model=List[GrayBatchResponse])
def list_batches(
    skip: int = 0,
    limit: int = 100,
    status: Optional[BatchStatus] = None,
    db: Session = Depends(get_db),
):
    batch_service = BatchService(db)
    return batch_service.list_batches(skip=skip, limit=limit, status=status)


@router.get("/batches/{batch_id}", response_model=GrayBatchResponse)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch_service = BatchService(db)
    db_batch = batch_service.get_batch(batch_id)
    if not db_batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return db_batch


@router.put("/batches/{batch_id}", response_model=GrayBatchResponse)
def update_batch(
    batch_id: int, batch_update: GrayBatchUpdate, db: Session = Depends(get_db)
):
    batch_service = BatchService(db)
    db_batch = batch_service.update_batch(batch_id, batch_update)
    if not db_batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return db_batch


@router.post("/batches/{batch_id}/transition", response_model=GrayBatchResponse)
def transition_batch_status(
    batch_id: int, request: StatusTransitionRequest, db: Session = Depends(get_db)
):
    try:
        batch_service = BatchService(db)
        db_batch = batch_service.transition_status(
            batch_id, request.target_status, request.operator, request.comment
        )
        if not db_batch:
            raise HTTPException(status_code=404, detail="批次不存在")
        return db_batch
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batches/{batch_id}/cancel", response_model=GrayBatchResponse)
def cancel_batch(
    batch_id: int,
    operator: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
):
    try:
        batch_service = BatchService(db)
        db_batch = batch_service.cancel_batch(batch_id, operator, reason)
        if not db_batch:
            raise HTTPException(status_code=404, detail="批次不存在")
        return db_batch
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batches/{batch_id}/rollback", response_model=GrayBatchResponse)
def rollback_batch(
    batch_id: int,
    operator: str,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
):
    try:
        batch_service = BatchService(db)
        db_batch = batch_service.rollback_batch(batch_id, operator, reason)
        if not db_batch:
            raise HTTPException(status_code=404, detail="批次不存在")
        return db_batch
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/batches/{batch_id}/process")
def process_batch(
    batch_id: int, operator: str, db: Session = Depends(get_db)
):
    batch_service = BatchService(db)
    db_batch = batch_service.get_batch(batch_id)
    if not db_batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    valid, msg = ValidationService.validate_batch_for_processing(db_batch)
    if not valid:
        raise HTTPException(status_code=400, detail=msg)

    try:
        db_batch = batch_service.transition_status(
            batch_id, BatchStatus.PROCESSING, operator, "开始执行回填"
        )

        gap_service = GapSegmentService(db)
        for window in db_batch.metric_windows:
            for gap in window.gap_segments:
                if not gap.is_backfilled:
                    gap_service.mark_backfilled(gap.id, gap.expected_points)

        snapshot_service = SnapshotService(db)
        snapshot_service.create_batch_result_snapshot(batch_id, operator)

        db_batch = batch_service.transition_status(
            batch_id, BatchStatus.COMPLETED, operator, "回填执行完成"
        )

        return {"message": "批次处理完成", "batch_id": batch_id, "status": db_batch.status}
    except Exception as e:
        exception_service = ExceptionService(db)
        exception_service.log_exception(
            operation="process_batch",
            original_input=json.dumps({"batch_id": batch_id, "operator": operator}),
            error_message=str(e),
            batch_id=batch_id,
        )
        raise HTTPException(status_code=500, detail=f"处理批次时发生错误: {str(e)}")


@router.post("/metric-windows/", response_model=MetricWindowResponse)
def create_metric_window(window: MetricWindowCreate, db: Session = Depends(get_db)):
    try:
        window_service = WindowService(db)
        return window_service.create_metric_window(window)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/metric-windows/", response_model=List[MetricWindowResponse])
def list_metric_windows(
    batch_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    window_service = WindowService(db)
    return window_service.list_metric_windows(batch_id=batch_id, skip=skip, limit=limit)


@router.get("/metric-windows/{window_id}", response_model=MetricWindowResponse)
def get_metric_window(window_id: int, db: Session = Depends(get_db)):
    window_service = WindowService(db)
    db_window = window_service.get_metric_window(window_id)
    if not db_window:
        raise HTTPException(status_code=404, detail="指标窗口不存在")
    return db_window


@router.post("/gap-segments/", response_model=GapSegmentResponse)
def create_gap_segment(gap: GapSegmentCreate, db: Session = Depends(get_db)):
    try:
        gap_service = GapSegmentService(db)
        return gap_service.create_gap_segment(gap)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/gap-segments/", response_model=List[GapSegmentResponse])
def list_gap_segments(
    metric_window_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    gap_service = GapSegmentService(db)
    return gap_service.list_gap_segments(metric_window_id=metric_window_id, skip=skip, limit=limit)


@router.post("/backfill-sources/", response_model=BackfillSourceResponse)
def create_backfill_source(source: BackfillSourceCreate, db: Session = Depends(get_db)):
    try:
        source_service = BackfillSourceService(db)
        return source_service.create_backfill_source(source)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/backfill-sources/", response_model=List[BackfillSourceResponse])
def list_backfill_sources(
    gap_segment_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    source_service = BackfillSourceService(db)
    return source_service.list_backfill_sources(gap_segment_id=gap_segment_id, skip=skip, limit=limit)


@router.get("/audit-records/", response_model=List[AuditRecordResponse])
def list_audit_records(
    batch_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    audit_service = AuditService(db)
    return audit_service.list_audit_records(batch_id=batch_id, skip=skip, limit=limit)


@router.post("/manual-correction")
def manual_correction(request: ManualCorrectionRequest, db: Session = Depends(get_db)):
    gap_service = GapSegmentService(db)
    gap = gap_service.get_gap_segment(request.gap_segment_id)
    if not gap:
        raise HTTPException(status_code=404, detail="缺口片段不存在")

    try:
        snapshot_service = SnapshotService(db)
        snapshot_service.create_snapshot(
            batch_id=gap.metric_window.batch_id,
            snapshot_type="manual_correction",
            snapshot_data=json.dumps(
                {
                    "gap_segment_id": request.gap_segment_id,
                    "corrected_data": request.corrected_data,
                    "reason": request.reason,
                    "operator": request.operator,
                },
                ensure_ascii=False,
            ),
            created_by=request.operator,
        )

        return {"message": "人工修正已记录", "gap_segment_id": request.gap_segment_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"记录人工修正时发生错误: {str(e)}")


@router.get("/snapshots/", response_model=List[ResultSnapshotResponse])
def list_snapshots(
    batch_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    snapshot_service = SnapshotService(db)
    return snapshot_service.list_snapshots(batch_id=batch_id, skip=skip, limit=limit)


@router.get("/snapshots/{snapshot_id}/export")
def export_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    snapshot_service = SnapshotService(db)
    result = snapshot_service.export_snapshot(snapshot_id)
    if not result:
        raise HTTPException(status_code=404, detail="快照不存在")
    return result


@router.get("/exception-logs/", response_model=List[ExceptionLogResponse])
def list_exception_logs(
    batch_id: Optional[int] = None,
    handled: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    exception_service = ExceptionService(db)
    return exception_service.list_exception_logs(
        batch_id=batch_id, handled=handled, skip=skip, limit=limit
    )


@router.post("/exception-logs/{log_id}/handle", response_model=ExceptionLogResponse)
def handle_exception_log(
    log_id: int, handler: str, conclusion: str, db: Session = Depends(get_db)
):
    exception_service = ExceptionService(db)
    db_log = exception_service.handle_exception(log_id, handler, conclusion)
    if not db_log:
        raise HTTPException(status_code=404, detail="异常日志不存在")
    return db_log
