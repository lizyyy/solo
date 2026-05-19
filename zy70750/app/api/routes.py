from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.constants import ErrorCode, TaskStatus
from app.schemas import schemas
from app.models import models

router = APIRouter(prefix="/api/v1", tags=["core"])


@router.get("/directories", response_model=List[schemas.LogDirectory])
def list_directories(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.LogDirectory)
    if is_active is not None:
        query = query.filter(models.LogDirectory.is_active == is_active)
    return query.offset(skip).limit(limit).all()


@router.post("/directories", response_model=schemas.LogDirectory)
def create_directory(
    directory: schemas.LogDirectoryCreate,
    db: Session = Depends(get_db)
):
    if not directory.name or not directory.path:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Missing required fields: name and path are required",
                "error_code": ErrorCode.MISSING_FIELD
            }
        )

    existing = db.query(models.LogDirectory).filter(
        models.LogDirectory.path == directory.path
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Directory path already exists",
                "error_code": ErrorCode.VALIDATION_ERROR
            }
        )

    db_directory = models.LogDirectory(**directory.model_dump())
    db.add(db_directory)
    db.commit()
    db.refresh(db_directory)
    return db_directory


@router.get("/rules", response_model=List[schemas.MaskingRule])
def list_rules(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.MaskingRule)
    if is_active is not None:
        query = query.filter(models.MaskingRule.is_active == is_active)
    return query.order_by(models.MaskingRule.priority.desc()).offset(skip).limit(limit).all()


@router.post("/rules", response_model=schemas.MaskingRule)
def create_rule(
    rule: schemas.MaskingRuleCreate,
    db: Session = Depends(get_db)
):
    if not rule.name or not rule.pattern:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Missing required fields: name and pattern are required",
                "error_code": ErrorCode.MISSING_FIELD
            }
        )

    db_rule = models.MaskingRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.get("/retained-fields", response_model=List[schemas.RetainedField])
def list_retained_fields(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.RetainedField)
    if is_active is not None:
        query = query.filter(models.RetainedField.is_active == is_active)
    return query.offset(skip).limit(limit).all()


@router.post("/retained-fields", response_model=schemas.RetainedField)
def create_retained_field(
    field: schemas.RetainedFieldCreate,
    db: Session = Depends(get_db)
):
    if not field.field_name:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Missing required field: field_name is required",
                "error_code": ErrorCode.MISSING_FIELD
            }
        )

    db_field = models.RetainedField(**field.model_dump())
    db.add(db_field)
    db.commit()
    db.refresh(db_field)
    return db_field


@router.get("/risk-words", response_model=List[schemas.RiskWord])
def list_risk_words(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.RiskWord)
    if is_active is not None:
        query = query.filter(models.RiskWord.is_active == is_active)
    if category:
        query = query.filter(models.RiskWord.category == category)
    return query.offset(skip).limit(limit).all()


@router.post("/risk-words", response_model=schemas.RiskWord)
def create_risk_word(
    word: schemas.RiskWordCreate,
    db: Session = Depends(get_db)
):
    if not word.word:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Missing required field: word is required",
                "error_code": ErrorCode.MISSING_FIELD
            }
        )

    existing = db.query(models.RiskWord).filter(
        models.RiskWord.word == word.word
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Risk word already exists",
                "error_code": ErrorCode.VALIDATION_ERROR
            }
        )

    db_word = models.RiskWord(**word.model_dump())
    db.add(db_word)
    db.commit()
    db.refresh(db_word)
    return db_word


@router.get("/tasks", response_model=List[schemas.RegressionTask])
def list_tasks(
    skip: int = 0,
    limit: int = 100,
    status: Optional[TaskStatus] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.RegressionTask)
    if status:
        query = query.filter(models.RegressionTask.status == status)
    return query.order_by(models.RegressionTask.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/tasks/{task_id}", response_model=schemas.RegressionTask)
def get_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    task = db.query(models.RegressionTask).filter(
        models.RegressionTask.id == task_id
    ).first()
    if not task:
        raise HTTPException(
            status_code=404,
            detail={
                "message": f"Task {task_id} not found",
                "error_code": ErrorCode.NOT_FOUND
            }
        )
    return task


@router.post("/tasks", response_model=schemas.RegressionTask)
def create_task(
    task: schemas.RegressionTaskCreate,
    db: Session = Depends(get_db)
):
    if not task.name or not task.log_directory_id:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Missing required fields: name and log_directory_id are required",
                "error_code": ErrorCode.MISSING_FIELD
            }
        )

    log_dir = db.query(models.LogDirectory).filter(
        models.LogDirectory.id == task.log_directory_id
    ).first()
    if not log_dir:
        raise HTTPException(
            status_code=404,
            detail={
                "message": "Log directory not found",
                "error_code": ErrorCode.NOT_FOUND
            }
        )

    db_task = models.RegressionTask(**task.model_dump())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.get("/tasks/{task_id}/results", response_model=List[schemas.RegressionResult])
def get_task_results(
    task_id: int,
    skip: int = 0,
    limit: int = 100,
    is_matched: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.RegressionResult).filter(
        models.RegressionResult.task_id == task_id
    )
    if is_matched is not None:
        query = query.filter(models.RegressionResult.is_matched == is_matched)
    return query.offset(skip).limit(limit).all()


@router.get("/tasks/{task_id}/diffs", response_model=List[schemas.DiffReport])
def get_task_diffs(
    task_id: int,
    skip: int = 0,
    limit: int = 100,
    is_reviewed: Optional[bool] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.DiffReport).filter(
        models.DiffReport.task_id == task_id
    )
    if is_reviewed is not None:
        query = query.filter(models.DiffReport.is_reviewed == is_reviewed)
    if severity:
        query = query.filter(models.DiffReport.severity == severity)
    return query.offset(skip).limit(limit).all()


@router.get("/tasks/{task_id}/failed-records", response_model=List[schemas.FailedRecord])
def get_task_failed_records(
    task_id: int,
    skip: int = 0,
    limit: int = 100,
    is_resolved: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.FailedRecord).filter(
        models.FailedRecord.task_id == task_id
    )
    if is_resolved is not None:
        query = query.filter(models.FailedRecord.is_resolved == is_resolved)
    return query.offset(skip).limit(limit).all()
