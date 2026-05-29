from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session

from .models import (
    ComparisonTask, TaskStatus, DenoiseParams, AudioSegment,
    ListeningRecord, ProcessingResult, AnomalyRecord, ComparisonReport
)
from .schemas import (
    ComparisonTaskCreate, ComparisonTaskUpdate, ComparisonTaskStatusUpdate,
    ComparisonTaskImport, DenoiseParamsCreate, DenoiseParamsUpdate,
    AudioSegmentCreate, AudioSegmentUpdate,
    ListeningRecordCreate, ListeningRecordUpdate,
    ProcessingResultCreate, ProcessingResultUpdate,
    AnomalyRecordCreate, AnomalyRecordResolve,
    ComparisonTaskResponse, ComparisonTaskDetailResponse,
    DenoiseParamsResponse, AudioSegmentResponse,
    ListeningRecordResponse, ProcessingResultResponse,
    AnomalyRecordResponse, ComparisonReportResponse
)
from .services.anomaly_detector import AnomalyDetector


def generate_batch_no() -> str:
    now = datetime.now()
    return f"BAT{now.strftime('%Y%m%d')}{now.strftime('%H%M%S')}{now.strftime('%f')[:3]}"


def _count_related(db: Session, task_id: int) -> dict:
    return {
        "params_count": db.query(DenoiseParams).filter(
            DenoiseParams.task_id == task_id
        ).count(),
        "audio_segments_count": db.query(AudioSegment).filter(
            AudioSegment.task_id == task_id
        ).count(),
        "listening_records_count": db.query(ListeningRecord).filter(
            ListeningRecord.task_id == task_id
        ).count(),
        "processing_results_count": db.query(ProcessingResult).filter(
            ProcessingResult.task_id == task_id
        ).count(),
        "anomalies_count": db.query(AnomalyRecord).filter(
            AnomalyRecord.task_id == task_id, AnomalyRecord.resolved == False
        ).count(),
        "reports_count": db.query(ComparisonReport).filter(
            ComparisonReport.task_id == task_id
        ).count(),
    }


def get_task_response(db: Session, task: ComparisonTask) -> ComparisonTaskResponse:
    counts = _count_related(db, task.id)
    return ComparisonTaskResponse(
        id=task.id,
        batch_no=task.batch_no,
        name=task.name,
        description=task.description,
        status=task.status,
        created_by=task.created_by,
        manual_notes=task.manual_notes,
        source_metadata=task.source_metadata,
        created_at=task.created_at,
        updated_at=task.updated_at,
        **counts
    )


def get_task_detail_response(
    db: Session, task: ComparisonTask
) -> ComparisonTaskDetailResponse:
    counts = _count_related(db, task.id)
    return ComparisonTaskDetailResponse(
        id=task.id,
        batch_no=task.batch_no,
        name=task.name,
        description=task.description,
        status=task.status,
        created_by=task.created_by,
        manual_notes=task.manual_notes,
        source_metadata=task.source_metadata,
        created_at=task.created_at,
        updated_at=task.updated_at,
        **counts,
        params=[DenoiseParamsResponse.model_validate(p) for p in task.params],
        audio_segments=[
            AudioSegmentResponse.model_validate(a) for a in task.audio_segments
        ],
        listening_records=[
            ListeningRecordResponse.model_validate(l) for l in task.listening_records
        ],
        processing_results=[
            ProcessingResultResponse.model_validate(r) for r in task.processing_results
        ],
        anomalies=[
            AnomalyRecordResponse.model_validate(a) for a in task.anomalies
        ],
        reports=[
            ComparisonReportResponse.model_validate(r) for r in task.reports
        ],
    )


def create_task(
    db: Session, task_data: ComparisonTaskCreate
) -> ComparisonTask:
    batch_no = task_data.batch_no or generate_batch_no()
    task = ComparisonTask(
        batch_no=batch_no,
        name=task_data.name,
        description=task_data.description,
        created_by=task_data.created_by,
        manual_notes=task_data.manual_notes,
        source_metadata=task_data.source_metadata,
        status=TaskStatus.CREATED
    )
    db.add(task)
    db.flush()
    return task


def import_task_data(
    db: Session, task_id: int, import_data: ComparisonTaskImport
) -> ComparisonTask:
    task = db.query(ComparisonTask).filter(
        ComparisonTask.id == task_id
    ).first()
    if not task:
        raise ValueError(f"Task {task_id} not found")

    for seg_data in import_data.audio_segments:
        segment = AudioSegment(
            task_id=task_id,
            **seg_data.model_dump()
        )
        db.add(segment)

    for param_data in import_data.params:
        create_params(db, task_id, param_data)

    for listen_data in import_data.listening_records:
        record = ListeningRecord(
            task_id=task_id,
            **listen_data.model_dump()
        )
        db.add(record)

    task.status = TaskStatus.IMPORTED
    db.flush()
    return task


def get_task(db: Session, task_id: int) -> Optional[ComparisonTask]:
    return db.query(ComparisonTask).filter(
        ComparisonTask.id == task_id
    ).first()


def get_task_by_batch_no(db: Session, batch_no: str) -> Optional[ComparisonTask]:
    return db.query(ComparisonTask).filter(
        ComparisonTask.batch_no == batch_no
    ).first()


def list_tasks(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: Optional[TaskStatus] = None
) -> List[ComparisonTask]:
    query = db.query(ComparisonTask)
    if status:
        query = query.filter(ComparisonTask.status == status)
    return query.order_by(ComparisonTask.created_at.desc()).offset(skip).limit(limit).all()


def update_task(
    db: Session, task_id: int, update_data: ComparisonTaskUpdate
) -> Optional[ComparisonTask]:
    task = get_task(db, task_id)
    if not task:
        return None

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(task, key, value)

    db.flush()
    return task


def update_task_status(
    db: Session, task_id: int, status_data: ComparisonTaskStatusUpdate
) -> Optional[ComparisonTask]:
    task = get_task(db, task_id)
    if not task:
        return None

    task.status = status_data.status
    if status_data.notes and task.manual_notes:
        task.manual_notes = f"{task.manual_notes}\n[{status_data.updated_by or '系统'} {datetime.utcnow().isoformat()}] {status_data.notes}"
    elif status_data.notes:
        task.manual_notes = f"[{status_data.updated_by or '系统'} {datetime.utcnow().isoformat()}] {status_data.notes}"

    db.flush()
    return task


def create_params(
    db: Session, task_id: int, params_data: DenoiseParamsCreate
) -> DenoiseParams:
    task = get_task(db, task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    active_existing = [p for p in task.params if p.name == params_data.name and p.is_active]
    all_existing = [p for p in task.params if p.name == params_data.name]
    version = 1
    if all_existing:
        version = max(p.version for p in all_existing) + 1

    params = DenoiseParams(
        task_id=task_id,
        version=version,
        **params_data.model_dump()
    )
    db.add(params)
    db.flush()

    detector = AnomalyDetector(db)
    if active_existing:
        for p in active_existing:
            if p.name == params_data.name:
                detector.detect_param_override(task_id, params, [p])
                p.is_active = False
        db.flush()

    return params


def get_params(db: Session, params_id: int) -> Optional[DenoiseParams]:
    return db.query(DenoiseParams).filter(DenoiseParams.id == params_id).first()


def list_params(
    db: Session, task_id: int, active_only: bool = False
) -> List[DenoiseParams]:
    query = db.query(DenoiseParams).filter(DenoiseParams.task_id == task_id)
    if active_only:
        query = query.filter(DenoiseParams.is_active == True)
    return query.order_by(DenoiseParams.version.desc()).all()


def update_params(
    db: Session, params_id: int, update_data: DenoiseParamsUpdate
) -> Optional[DenoiseParams]:
    params = get_params(db, params_id)
    if not params:
        return None

    if update_data.params_json is not None:
        return create_params(
            db, params.task_id,
            DenoiseParamsCreate(
                name=update_data.name or params.name,
                params_json=update_data.params_json,
                source=params.source,
                manual_notes=update_data.manual_notes or params.manual_notes
            )
        )

    update_dict = update_data.model_dump(exclude_unset=True, exclude={"params_json"})
    for key, value in update_dict.items():
        setattr(params, key, value)

    db.flush()
    return params


def create_audio_segment(
    db: Session, task_id: int, segment_data: AudioSegmentCreate
) -> AudioSegment:
    task = get_task(db, task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    segment = AudioSegment(
        task_id=task_id,
        **segment_data.model_dump()
    )
    db.add(segment)
    db.flush()
    return segment


def get_audio_segment(
    db: Session, segment_id: int
) -> Optional[AudioSegment]:
    return db.query(AudioSegment).filter(AudioSegment.id == segment_id).first()


def list_audio_segments(
    db: Session, task_id: int, audio_type: Optional[str] = None
) -> List[AudioSegment]:
    query = db.query(AudioSegment).filter(AudioSegment.task_id == task_id)
    if audio_type:
        query = query.filter(AudioSegment.audio_type == audio_type)
    return query.order_by(AudioSegment.created_at.desc()).all()


def update_audio_segment(
    db: Session, segment_id: int, update_data: AudioSegmentUpdate
) -> Optional[AudioSegment]:
    segment = get_audio_segment(db, segment_id)
    if not segment:
        return None

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(segment, key, value)

    db.flush()
    return segment


def create_listening_record(
    db: Session, task_id: int, record_data: ListeningRecordCreate
) -> ListeningRecord:
    task = get_task(db, task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    record = ListeningRecord(
        task_id=task_id,
        **record_data.model_dump()
    )
    db.add(record)
    db.flush()

    if record_data.params_id:
        result = db.query(ProcessingResult).filter(
            ProcessingResult.task_id == task_id,
            ProcessingResult.audio_segment_id == record_data.audio_segment_id,
            ProcessingResult.params_id == record_data.params_id
        ).first()

        if result:
            params = db.query(DenoiseParams).filter(
                DenoiseParams.id == record_data.params_id
            ).first()
            if params:
                detector = AnomalyDetector(db)
                detector.detect_audio_quality_issue(task_id, result, record)

    return record


def get_listening_record(
    db: Session, record_id: int
) -> Optional[ListeningRecord]:
    return db.query(ListeningRecord).filter(ListeningRecord.id == record_id).first()


def list_listening_records(
    db: Session, task_id: int
) -> List[ListeningRecord]:
    return db.query(ListeningRecord).filter(
        ListeningRecord.task_id == task_id
    ).order_by(ListeningRecord.created_at.desc()).all()


def update_listening_record(
    db: Session, record_id: int, update_data: ListeningRecordUpdate
) -> Optional[ListeningRecord]:
    record = get_listening_record(db, record_id)
    if not record:
        return None

    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(record, key, value)

    db.flush()
    return record


def create_processing_result(
    db: Session, task_id: int, result_data: ProcessingResultCreate
) -> ProcessingResult:
    task = get_task(db, task_id)
    if not task:
        raise ValueError(f"Task {task_id} not found")

    result = ProcessingResult(
        task_id=task_id,
        **result_data.model_dump()
    )
    db.add(result)
    db.flush()
    return result


def list_processing_results(
    db: Session, task_id: int
) -> List[ProcessingResult]:
    return db.query(ProcessingResult).filter(
        ProcessingResult.task_id == task_id
    ).order_by(ProcessingResult.created_at.desc()).all()


def get_anomalies(
    db: Session, task_id: int, resolved: Optional[bool] = None
) -> List[AnomalyRecord]:
    query = db.query(AnomalyRecord).filter(AnomalyRecord.task_id == task_id)
    if resolved is not None:
        query = query.filter(AnomalyRecord.resolved == resolved)
    return query.order_by(AnomalyRecord.detected_at.desc()).all()


def resolve_anomaly(
    db: Session, anomaly_id: int, resolve_data: AnomalyRecordResolve
) -> Optional[AnomalyRecord]:
    anomaly = db.query(AnomalyRecord).filter(
        AnomalyRecord.id == anomaly_id
    ).first()
    if not anomaly:
        return None

    detector = AnomalyDetector(db)
    return detector.resolve_anomaly(
        anomaly_id, resolve_data.resolved_by, resolve_data.resolution_notes
    )


def list_reports(
    db: Session, task_id: Optional[int] = None
) -> List[ComparisonReport]:
    query = db.query(ComparisonReport)
    if task_id:
        query = query.filter(ComparisonReport.task_id == task_id)
    return query.order_by(ComparisonReport.created_at.desc()).all()


def get_report(
    db: Session, report_id: int
) -> Optional[ComparisonReport]:
    return db.query(ComparisonReport).filter(
        ComparisonReport.id == report_id
    ).first()
