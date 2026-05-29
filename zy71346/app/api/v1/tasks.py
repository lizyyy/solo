from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ...database import get_db
from ...models import TaskStatus
from ...schemas import (
    ComparisonTaskCreate, ComparisonTaskUpdate, ComparisonTaskStatusUpdate,
    ComparisonTaskImport, ComparisonTaskResponse, ComparisonTaskDetailResponse,
    DenoiseParamsCreate, DenoiseParamsUpdate, DenoiseParamsResponse,
    AudioSegmentCreate, AudioSegmentUpdate, AudioSegmentResponse,
    ListeningRecordCreate, ListeningRecordUpdate, ListeningRecordResponse,
    ProcessingResultResponse, AnomalyRecordResponse, AnomalyRecordResolve,
    ComparisonReportExport, ComparisonReportResponse,
    BatchProcessRequest, BatchProcessResponse, TaskMetricsResponse
)
from ... import crud
from ...services.batch_processor import BatchProcessor
from ...services.report_exporter import ReportExporter

router = APIRouter(prefix="/tasks", tags=["对比任务"])


@router.post(
    "",
    response_model=ComparisonTaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建对比任务"
)
def create_task(
    task_data: ComparisonTaskCreate,
    db: Session = Depends(get_db)
):
    if task_data.batch_no:
        existing = crud.get_task_by_batch_no(db, task_data.batch_no)
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"批次号 {task_data.batch_no} 已存在"
            )
    task = crud.create_task(db, task_data)
    db.commit()
    db.refresh(task)
    return crud.get_task_response(db, task)


@router.post(
    "/{task_id}/import",
    response_model=ComparisonTaskDetailResponse,
    summary="导入任务数据（音频、参数、试听记录）"
)
def import_task_data(
    task_id: int,
    import_data: ComparisonTaskImport,
    db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    try:
        task = crud.import_task_data(db, task_id, import_data)
        db.commit()
        db.refresh(task)
        return crud.get_task_detail_response(db, task)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "",
    response_model=List[ComparisonTaskResponse],
    summary="查询任务列表"
)
def list_tasks(
    skip: int = 0,
    limit: int = 100,
    status: Optional[TaskStatus] = None,
    db: Session = Depends(get_db)
):
    tasks = crud.list_tasks(db, skip=skip, limit=limit, status=status)
    return [crud.get_task_response(db, t) for t in tasks]


@router.get(
    "/{task_id}",
    response_model=ComparisonTaskDetailResponse,
    summary="查询任务详情"
)
def get_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    return crud.get_task_detail_response(db, task)


@router.get(
    "/batch/{batch_no}",
    response_model=ComparisonTaskDetailResponse,
    summary="按批次号查询任务"
)
def get_task_by_batch_no(
    batch_no: str,
    db: Session = Depends(get_db)
):
    task = crud.get_task_by_batch_no(db, batch_no)
    if not task:
        raise HTTPException(status_code=404, detail=f"批次号 {batch_no} 不存在")
    return crud.get_task_detail_response(db, task)


@router.patch(
    "/{task_id}",
    response_model=ComparisonTaskResponse,
    summary="修正任务信息"
)
def update_task(
    task_id: int,
    update_data: ComparisonTaskUpdate,
    db: Session = Depends(get_db)
):
    task = crud.update_task(db, task_id, update_data)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    db.commit()
    db.refresh(task)
    return crud.get_task_response(db, task)


@router.patch(
    "/{task_id}/status",
    response_model=ComparisonTaskResponse,
    summary="推进任务状态"
)
def update_task_status(
    task_id: int,
    status_data: ComparisonTaskStatusUpdate,
    db: Session = Depends(get_db)
):
    task = crud.update_task_status(db, task_id, status_data)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    db.commit()
    db.refresh(task)
    return crud.get_task_response(db, task)


@router.post(
    "/{task_id}/params",
    response_model=DenoiseParamsResponse,
    status_code=status.HTTP_201_CREATED,
    summary="添加降噪参数"
)
def add_params(
    task_id: int,
    params_data: DenoiseParamsCreate,
    db: Session = Depends(get_db)
):
    try:
        params = crud.create_params(db, task_id, params_data)
        db.commit()
        db.refresh(params)
        return params
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{task_id}/params",
    response_model=List[DenoiseParamsResponse],
    summary="查询参数列表"
)
def list_params(
    task_id: int,
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    return crud.list_params(db, task_id, active_only=active_only)


@router.patch(
    "/params/{params_id}",
    response_model=DenoiseParamsResponse,
    summary="修正降噪参数（自动生成新版本）"
)
def update_params(
    params_id: int,
    update_data: DenoiseParamsUpdate,
    db: Session = Depends(get_db)
):
    params = crud.update_params(db, params_id, update_data)
    if not params:
        raise HTTPException(status_code=404, detail=f"参数 {params_id} 不存在")
    db.commit()
    db.refresh(params)
    return params


@router.post(
    "/{task_id}/segments",
    response_model=AudioSegmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="添加音频片段"
)
def add_audio_segment(
    task_id: int,
    segment_data: AudioSegmentCreate,
    db: Session = Depends(get_db)
):
    try:
        segment = crud.create_audio_segment(db, task_id, segment_data)
        db.commit()
        db.refresh(segment)
        return segment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{task_id}/segments",
    response_model=List[AudioSegmentResponse],
    summary="查询音频片段列表"
)
def list_audio_segments(
    task_id: int,
    audio_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    return crud.list_audio_segments(db, task_id, audio_type=audio_type)


@router.patch(
    "/segments/{segment_id}",
    response_model=AudioSegmentResponse,
    summary="修正音频片段信息"
)
def update_audio_segment(
    segment_id: int,
    update_data: AudioSegmentUpdate,
    db: Session = Depends(get_db)
):
    segment = crud.update_audio_segment(db, segment_id, update_data)
    if not segment:
        raise HTTPException(status_code=404, detail=f"片段 {segment_id} 不存在")
    db.commit()
    db.refresh(segment)
    return segment


@router.get(
    "/{task_id}/segments/{segment_id}/preview",
    summary="获取片段试听地址"
)
def get_segment_preview(
    task_id: int,
    segment_id: int,
    params_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    processor = BatchProcessor(db)
    url = processor.get_segment_preview_url(task_id, segment_id, params_id)
    if not url:
        raise HTTPException(status_code=404, detail="音频文件不存在")
    return {"preview_url": url}


@router.post(
    "/{task_id}/listening",
    response_model=ListeningRecordResponse,
    status_code=status.HTTP_201_CREATED,
    summary="添加试听记录"
)
def add_listening_record(
    task_id: int,
    record_data: ListeningRecordCreate,
    db: Session = Depends(get_db)
):
    try:
        record = crud.create_listening_record(db, task_id, record_data)
        db.commit()
        db.refresh(record)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{task_id}/listening",
    response_model=List[ListeningRecordResponse],
    summary="查询试听记录列表"
)
def list_listening_records(
    task_id: int,
    db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    return crud.list_listening_records(db, task_id)


@router.patch(
    "/listening/{record_id}",
    response_model=ListeningRecordResponse,
    summary="修正试听记录"
)
def update_listening_record(
    record_id: int,
    update_data: ListeningRecordUpdate,
    db: Session = Depends(get_db)
):
    record = crud.update_listening_record(db, record_id, update_data)
    if not record:
        raise HTTPException(status_code=404, detail=f"记录 {record_id} 不存在")
    db.commit()
    db.refresh(record)
    return record


@router.post(
    "/batch-process",
    response_model=BatchProcessResponse,
    summary="批量处理降噪对比"
)
def batch_process(
    request: BatchProcessRequest,
    db: Session = Depends(get_db)
):
    processor = BatchProcessor(db)
    try:
        result = processor.process_batch(request)
        db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{task_id}/results",
    response_model=List[ProcessingResultResponse],
    summary="查询处理结果"
)
def list_processing_results(
    task_id: int,
    db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    return crud.list_processing_results(db, task_id)


@router.get(
    "/{task_id}/metrics",
    response_model=TaskMetricsResponse,
    summary="获取指标对比结果"
)
def get_task_metrics(
    task_id: int,
    db: Session = Depends(get_db)
):
    exporter = ReportExporter(db)
    try:
        return exporter.calculate_metrics(task_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get(
    "/{task_id}/anomalies",
    response_model=List[AnomalyRecordResponse],
    summary="查询异常记录"
)
def get_anomalies(
    task_id: int,
    resolved: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    return crud.get_anomalies(db, task_id, resolved=resolved)


@router.patch(
    "/anomalies/{anomaly_id}/resolve",
    response_model=AnomalyRecordResponse,
    summary="标记异常已解决"
)
def resolve_anomaly(
    anomaly_id: int,
    resolve_data: AnomalyRecordResolve,
    db: Session = Depends(get_db)
):
    anomaly = crud.resolve_anomaly(db, anomaly_id, resolve_data)
    if not anomaly:
        raise HTTPException(status_code=404, detail=f"异常 {anomaly_id} 不存在")
    db.commit()
    db.refresh(anomaly)
    return anomaly


@router.post(
    "/{task_id}/export",
    response_model=ComparisonReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="导出对比报告"
)
def export_report(
    task_id: int,
    export_request: ComparisonReportExport,
    db: Session = Depends(get_db)
):
    exporter = ReportExporter(db)
    try:
        report = exporter.export_report(task_id, export_request)
        db.commit()
        db.refresh(report)
        return report
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/{task_id}/reports",
    response_model=List[ComparisonReportResponse],
    summary="查询报告列表"
)
def list_reports(
    task_id: int,
    db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    return crud.list_reports(db, task_id)


@router.get(
    "/reports/{report_id}",
    response_model=ComparisonReportResponse,
    summary="查询报告详情"
)
def get_report(
    report_id: int,
    db: Session = Depends(get_db)
):
    report = crud.get_report(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"报告 {report_id} 不存在")
    return report
