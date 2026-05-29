from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..models.session import get_db
from ..models.enums import DiagnosisStatus
from ..models.schemas import (
    DiagnosisRecordCreate, DiagnosisRecordResponse, DiagnosisRecordUpdate,
    QueueMetricsCreate, QueueMetricsResponse, ConsumerLogCreate,
    ConsumerLogResponse, DiagnosisWithExplanation, ExplainableScore,
    ExportRequest, BatchDiagnosisRequest, DiagnosisSummary
)
from ..services.diagnosis_service import DiagnosisOrchestrationService

router = APIRouter(prefix="/api/diagnosis", tags=["diagnosis"])


@router.post("", response_model=DiagnosisRecordResponse)
def create_diagnosis(
    request: DiagnosisRecordCreate,
    db: Session = Depends(get_db)
):
    try:
        record = DiagnosisOrchestrationService.create_diagnosis(db, request)
        return record
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[DiagnosisSummary])
def list_diagnoses(
    queue_name: Optional[str] = None,
    status: Optional[DiagnosisStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    records, _ = DiagnosisOrchestrationService.list_diagnoses(
        db, queue_name, status, skip, limit
    )
    summaries = []
    for record in records:
        latest_backlog = record.metrics[-1].backlog_count if record.metrics else None
        summaries.append(DiagnosisSummary(
            id=record.id,
            queue_name=record.queue_name,
            status=record.status,
            primary_cause=record.primary_cause,
            alert_level=record.alert_level,
            overall_score=record.overall_score,
            created_at=record.created_at,
            updated_at=record.updated_at,
            edge_case_count=len(record.edge_cases),
            latest_backlog=latest_backlog
        ))
    return summaries


@router.get("/{diagnosis_id}", response_model=DiagnosisRecordResponse)
def get_diagnosis(
    diagnosis_id: int,
    db: Session = Depends(get_db)
):
    from ..models.database import DiagnosisRecord
    record = db.query(DiagnosisRecord).filter(
        DiagnosisRecord.id == diagnosis_id
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Diagnosis not found")
    return record


@router.get("/{diagnosis_id}/explain", response_model=DiagnosisWithExplanation)
def get_diagnosis_with_explanation(
    diagnosis_id: int,
    db: Session = Depends(get_db)
):
    try:
        return DiagnosisOrchestrationService.get_explainable_diagnosis(
            db, diagnosis_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{diagnosis_id}/explain/{metric_name}", response_model=ExplainableScore)
def get_metric_explanation(
    diagnosis_id: int,
    metric_name: str,
    db: Session = Depends(get_db)
):
    try:
        explanation = DiagnosisOrchestrationService.get_metric_explanation(
            db, diagnosis_id, metric_name
        )
        if not explanation:
            raise HTTPException(
                status_code=404,
                detail=f"Metric '{metric_name}' not found in diagnosis {diagnosis_id}"
            )
        return explanation
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{diagnosis_id}/metrics", response_model=List[QueueMetricsResponse])
def add_metrics(
    diagnosis_id: int,
    metrics: List[QueueMetricsCreate],
    db: Session = Depends(get_db)
):
    try:
        return DiagnosisOrchestrationService.add_metrics(db, diagnosis_id, metrics)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{diagnosis_id}/logs", response_model=List[ConsumerLogResponse])
def add_consumer_logs(
    diagnosis_id: int,
    logs: List[ConsumerLogCreate],
    db: Session = Depends(get_db)
):
    try:
        return DiagnosisOrchestrationService.add_consumer_logs(db, diagnosis_id, logs)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{diagnosis_id}/process", response_model=DiagnosisRecordResponse)
def process_diagnosis(
    diagnosis_id: int,
    expected_interval: int = Query(60, description="Expected metric interval in seconds"),
    db: Session = Depends(get_db)
):
    try:
        return DiagnosisOrchestrationService.process_diagnosis(
            db, diagnosis_id, expected_interval
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{diagnosis_id}/review", response_model=DiagnosisRecordResponse)
def update_manual_review(
    diagnosis_id: int,
    update: DiagnosisRecordUpdate,
    db: Session = Depends(get_db)
):
    try:
        return DiagnosisOrchestrationService.update_manual_review(
            db, diagnosis_id, update
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{diagnosis_id}/export")
def export_diagnosis(
    diagnosis_id: int,
    request: ExportRequest,
    db: Session = Depends(get_db)
):
    try:
        result = DiagnosisOrchestrationService.export_diagnosis(
            db,
            request.diagnosis_id,
            request.format,
            request.include_raw_data
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/batch", response_model=DiagnosisRecordResponse)
def batch_create_and_process(
    request: BatchDiagnosisRequest,
    db: Session = Depends(get_db)
):
    try:
        return DiagnosisOrchestrationService.batch_diagnosis(db, request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
