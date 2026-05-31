from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db
import schemas
from models import (
    ReviewSample, QualityInspection, CustomerServiceDialog,
    KnowledgeBaseEntry, FilterCondition, BatchTask, ExportRecord
)
from services import (
    TraceService, ChangeHistoryService, FilterService,
    BatchService, ExportService
)

router = APIRouter(prefix="/api", tags=["api"])


@router.post("/quality-inspections", response_model=schemas.QualityInspection)
def create_quality_inspection(
    data: schemas.QualityInspectionCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(QualityInspection).filter(
        QualityInspection.inspection_no == data.inspection_no
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Inspection already exists")

    inspection = QualityInspection(**data.model_dump())
    db.add(inspection)
    db.commit()
    db.refresh(inspection)
    return inspection


@router.get("/quality-inspections/{inspection_id}", response_model=schemas.QualityInspection)
def get_quality_inspection(inspection_id: int, db: Session = Depends(get_db)):
    inspection = db.query(QualityInspection).filter(
        QualityInspection.id == inspection_id
    ).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return inspection


@router.post("/customer-dialogs", response_model=schemas.CustomerServiceDialog)
def create_customer_dialog(
    data: schemas.CustomerServiceDialogCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(CustomerServiceDialog).filter(
        CustomerServiceDialog.dialog_id == data.dialog_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Dialog already exists")

    dialog = CustomerServiceDialog(**data.model_dump())
    db.add(dialog)
    db.commit()
    db.refresh(dialog)
    return dialog


@router.get("/customer-dialogs/{dialog_id}", response_model=schemas.CustomerServiceDialog)
def get_customer_dialog(dialog_id: int, db: Session = Depends(get_db)):
    dialog = db.query(CustomerServiceDialog).filter(
        CustomerServiceDialog.id == dialog_id
    ).first()
    if not dialog:
        raise HTTPException(status_code=404, detail="Dialog not found")
    return dialog


@router.post("/knowledge-entries", response_model=schemas.KnowledgeBaseEntry)
def create_knowledge_entry(
    data: schemas.KnowledgeBaseEntryCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(KnowledgeBaseEntry).filter(
        KnowledgeBaseEntry.entry_id == data.entry_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Entry already exists")

    entry = KnowledgeBaseEntry(**data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/knowledge-entries/{entry_id}", response_model=schemas.KnowledgeBaseEntry)
def get_knowledge_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(KnowledgeBaseEntry).filter(
        KnowledgeBaseEntry.id == entry_id
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.post("/review-samples", response_model=schemas.ReviewSample)
def create_review_sample(
    data: schemas.ReviewSampleCreate,
    db: Session = Depends(get_db)
):
    sample = ReviewSample(**data.model_dump())
    db.add(sample)
    db.commit()
    db.refresh(sample)
    return sample


@router.get("/review-samples", response_model=schemas.PaginatedResponse)
def list_review_samples(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    sort_by: Optional[str] = None,
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    sample_batch_no: Optional[str] = None,
    review_status: Optional[str] = None,
    is_anomaly: Optional[bool] = None,
    anomaly_type: Optional[str] = None,
    sampler: Optional[str] = None,
    reviewer: Optional[str] = None,
    has_late_data: Optional[bool] = None,
    created_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    conditions = {}
    if sample_batch_no:
        conditions["sample_batch_no"] = sample_batch_no
    if review_status:
        conditions["review_status"] = review_status
    if is_anomaly is not None:
        conditions["is_anomaly"] = is_anomaly
    if anomaly_type:
        conditions["anomaly_type"] = anomaly_type
    if sampler:
        conditions["sampler"] = sampler
    if reviewer:
        conditions["reviewer"] = reviewer
    if has_late_data:
        conditions["has_late_data"] = has_late_data

    filter_data = schemas.FilterConditionCreate(
        conditions=conditions,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        created_by=created_by,
    )

    samples, total_count, db_filter = FilterService.query_samples(db, filter_data)
    db.commit()

    total_pages = (total_count + page_size - 1) // page_size

    return schemas.PaginatedResponse(
        items=[schemas.ReviewSample.model_validate(s) for s in samples],
        total=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        filter_condition_id=db_filter.id,
        condition_hash=db_filter.condition_hash,
    )


@router.get("/review-samples/{sample_id}", response_model=schemas.ReviewSampleWithTrace)
def get_review_sample(sample_id: int, db: Session = Depends(get_db)):
    sample = db.query(ReviewSample).filter(ReviewSample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    trace = TraceService.get_sample_trace(db, sample_id)

    result = schemas.ReviewSampleWithTrace.model_validate(sample)
    result.data_timeline = trace["data_timeline"]

    if sample.inspection_id:
        result.source_type = "QUALITY_FORM"
        result.source_link = {"type": "QUALITY_FORM", "id": sample.inspection_id}
    elif sample.dialog_id:
        result.source_type = "CUSTOMER_SERVICE"
        result.source_link = {"type": "CUSTOMER_SERVICE", "id": sample.dialog_id}
    elif sample.knowledge_entry_id:
        result.source_type = "KNOWLEDGE_BASE"
        result.source_link = {"type": "KNOWLEDGE_BASE", "id": sample.knowledge_entry_id}

    return result


@router.get("/review-samples/{sample_id}/trace", response_model=schemas.TraceResponse)
def get_sample_trace(sample_id: int, db: Session = Depends(get_db)):
    try:
        trace = TraceService.get_sample_trace(db, sample_id)
        return schemas.TraceResponse(**trace)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/review-samples/{sample_id}/sensitive-check")
def check_sensitive_data(sample_id: int, db: Session = Depends(get_db)):
    try:
        return TraceService.check_sensitive_data_anomaly(db, sample_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/review-samples/{sample_id}/changes")
def get_sample_changes(sample_id: int, change_type: Optional[str] = None, db: Session = Depends(get_db)):
    sample = db.query(ReviewSample).filter(ReviewSample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    return ChangeHistoryService.get_sample_changes(db, sample_id, change_type)


@router.get("/review-samples/{sample_id}/change-summary")
def get_sample_change_summary(sample_id: int, db: Session = Depends(get_db)):
    sample = db.query(ReviewSample).filter(ReviewSample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    return ChangeHistoryService.get_change_summary(db, sample_id)


@router.put("/review-samples/{sample_id}", response_model=schemas.ReviewSample)
def update_review_sample(
    sample_id: int,
    update_data: schemas.ReviewSampleUpdate,
    operator: Optional[str] = None,
    remark: Optional[str] = None,
    db: Session = Depends(get_db)
):
    sample = db.query(ReviewSample).filter(ReviewSample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    update_dict = update_data.model_dump(exclude_unset=True)

    for field_name, new_value in update_dict.items():
        old_value = getattr(sample, field_name)
        if old_value != new_value:
            ChangeHistoryService.log_change(
                db=db,
                sample_id=sample_id,
                field_name=field_name,
                old_value=old_value,
                new_value=new_value,
                operator=operator,
                remark=remark,
            )
            setattr(sample, field_name, new_value)

    db.commit()
    db.refresh(sample)
    return sample


@router.post("/review-samples/material-supplement")
def log_material_supplement(
    sample_id: int,
    field_name: str,
    new_value: Any,
    operator: Optional[str] = None,
    remark: Optional[str] = "补材料",
    db: Session = Depends(get_db)
):
    sample = db.query(ReviewSample).filter(ReviewSample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    change = ChangeHistoryService.log_material_supplement(
        db=db,
        sample_id=sample_id,
        field_name=field_name,
        new_value=new_value,
        operator=operator,
        remark=remark,
    )
    db.commit()

    return {"status": "success", "change_id": change.id if change else None}


@router.post("/batch/review", response_model=schemas.BatchTask)
def batch_review(
    sample_ids: List[int],
    review_status: str,
    is_anomaly: bool,
    anomaly_type: Optional[str] = None,
    conclusion: Optional[str] = None,
    reviewer: Optional[str] = None,
    db: Session = Depends(get_db)
):
    task = BatchService.batch_review(
        db=db,
        sample_ids=sample_ids,
        review_status=review_status,
        is_anomaly=is_anomaly,
        anomaly_type=anomaly_type,
        conclusion=conclusion,
        reviewer=reviewer,
    )
    return task


@router.post("/batch/mark-anomaly", response_model=schemas.BatchTask)
def batch_mark_anomaly(
    sample_ids: List[int],
    anomaly_type: str,
    conclusion: Optional[str] = None,
    reviewer: Optional[str] = None,
    db: Session = Depends(get_db)
):
    task = BatchService.batch_mark_anomaly(
        db=db,
        sample_ids=sample_ids,
        anomaly_type=anomaly_type,
        conclusion=conclusion,
        reviewer=reviewer,
    )
    return task


@router.post("/batch/mark-normal", response_model=schemas.BatchTask)
def batch_mark_normal(
    sample_ids: List[int],
    conclusion: Optional[str] = None,
    reviewer: Optional[str] = None,
    db: Session = Depends(get_db)
):
    task = BatchService.batch_mark_normal(
        db=db,
        sample_ids=sample_ids,
        conclusion=conclusion,
        reviewer=reviewer,
    )
    return task


@router.get("/batch/tasks", response_model=List[schemas.BatchTask])
def list_batch_tasks(limit: int = 10, operator: Optional[str] = None, db: Session = Depends(get_db)):
    return BatchService.get_recent_tasks(db, limit=limit, operator=operator)


@router.get("/batch/tasks/{idempotency_key}", response_model=schemas.BatchTask)
def get_batch_task_status(idempotency_key: str, db: Session = Depends(get_db)):
    task = BatchService.get_task_status(db, idempotency_key)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.get("/batch/verify-idempotency")
def verify_idempotency(task_name: str, params: Dict[str, Any], db: Session = Depends(get_db)):
    return BatchService.verify_idempotency(db, task_name, params)


@router.post("/exports/weekly-report", response_model=schemas.ExportRecord)
def export_weekly_report(
    filter_condition_id: Optional[int] = None,
    sample_ids: Optional[List[int]] = None,
    exported_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    record = ExportService.export_weekly_report(
        db=db,
        filter_condition_id=filter_condition_id,
        sample_ids=sample_ids,
        exported_by=exported_by,
    )
    return record


@router.get("/exports/{export_id}/download")
def download_export(export_id: int, db: Session = Depends(get_db)):
    export = db.query(ExportRecord).filter(ExportRecord.id == export_id).first()
    if not export:
        raise HTTPException(status_code=404, detail="Export not found")

    return FileResponse(
        path=export.file_path,
        filename=export.file_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@router.get("/exports/{export_id}/verify-consistency")
def verify_export_consistency(export_id: int, current_filter_id: int, db: Session = Depends(get_db)):
    try:
        return ExportService.verify_export_consistency(db, export_id, current_filter_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/exports", response_model=List[schemas.ExportRecord])
def list_exports(limit: int = 10, exported_by: Optional[str] = None, db: Session = Depends(get_db)):
    return ExportService.get_recent_exports(db, limit=limit, exported_by=exported_by)


@router.get("/filters", response_model=List[schemas.FilterCondition])
def list_recent_filters(limit: int = 10, created_by: Optional[str] = None, db: Session = Depends(get_db)):
    return FilterService.get_recent_filters(db, limit=limit, created_by=created_by)


@router.get("/filters/{condition_hash}", response_model=schemas.FilterCondition)
def get_filter_by_hash(condition_hash: str, db: Session = Depends(get_db)):
    filter_cond = FilterService.get_filter_by_hash(db, condition_hash)
    if not filter_cond:
        raise HTTPException(status_code=404, detail="Filter not found")
    return filter_cond


@router.get("/filters/{filter_id}/samples", response_model=List[schemas.ReviewSample])
def get_filter_samples(filter_id: int, db: Session = Depends(get_db)):
    filter_cond = db.query(FilterCondition).filter(FilterCondition.id == filter_id).first()
    if not filter_cond:
        raise HTTPException(status_code=404, detail="Filter not found")

    samples = FilterService.get_filter_samples(db, filter_id)
    return [schemas.ReviewSample.model_validate(s) for s in samples]


@router.get("/config/constants")
def get_config_constants():
    from config import CHANGE_TYPES, ANOMALY_TYPES, DATA_SOURCE_TYPES
    return {
        "change_types": CHANGE_TYPES,
        "anomaly_types": ANOMALY_TYPES,
        "data_source_types": DATA_SOURCE_TYPES,
    }


@router.get("/reports/change-classification")
def get_change_classification(sample_ids: List[int], db: Session = Depends(get_db)):
    return ChangeHistoryService.classify_changes_for_report(db, sample_ids)
