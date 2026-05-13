from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app import schemas, services
from app.database import get_db

router = APIRouter()


@router.post("/records", response_model=schemas.FreshnessRecord, status_code=status.HTTP_201_CREATED)
def create_freshness_record(record: schemas.FreshnessRecordCreate, db: Session = Depends(get_db)):
    dataset = services.get_dataset(db, dataset_id=record.dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=schemas.ErrorResponse(
                error_code="DATASET_NOT_FOUND",
                message=f"数据集 '{record.dataset_id}' 不存在",
                timestamp=datetime.now(timezone.utc)
            ).dict()
        )
    
    if not dataset.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=schemas.ErrorResponse(
                error_code="DATASET_INACTIVE",
                message=f"数据集 '{record.dataset_id}' 已停用",
                timestamp=datetime.now(timezone.utc)
            ).dict()
        )
    
    if record.request_id:
        existing_response = services.check_idempotent_request(
            db, request_id=record.request_id,
            dataset_id=record.dataset_id,
            operation_type="create_freshness_record"
        )
        if existing_response:
            return existing_response
    
    db_record = services.create_freshness_record(db=db, record=record, dataset=dataset)
    
    if record.request_id:
        services.save_idempotent_request(
            db, request_id=record.request_id,
            dataset_id=record.dataset_id,
            operation_type="create_freshness_record",
            response_data=schemas.FreshnessRecord.from_orm(db_record).dict()
        )
    
    return db_record


@router.post("/check", response_model=schemas.FreshnessCheckResult)
def check_freshness(check_request: schemas.FreshnessCheckRequest, db: Session = Depends(get_db)):
    dataset = services.get_dataset(db, dataset_id=check_request.dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=schemas.ErrorResponse(
                error_code="DATASET_NOT_FOUND",
                message=f"数据集 '{check_request.dataset_id}' 不存在",
                timestamp=datetime.now(timezone.utc)
            ).dict()
        )
    
    if not dataset.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=schemas.ErrorResponse(
                error_code="DATASET_INACTIVE",
                message=f"数据集 '{check_request.dataset_id}' 已停用",
                timestamp=datetime.now(timezone.utc)
            ).dict()
        )
    
    result = services.check_dataset_freshness(db=db, check_request=check_request)
    
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=schemas.ErrorResponse(
                error_code="NO_FRESHNESS_DATA",
                message=f"数据集 '{check_request.dataset_id}' 尚无新鲜度记录",
                timestamp=datetime.now(timezone.utc)
            ).dict()
        )
    
    return result


@router.post("/watermark/advance", response_model=schemas.WatermarkAdvanceResult)
def advance_watermark(request: schemas.WatermarkAdvanceRequest, db: Session = Depends(get_db)):
    dataset = services.get_dataset(db, dataset_id=request.dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=schemas.ErrorResponse(
                error_code="DATASET_NOT_FOUND",
                message=f"数据集 '{request.dataset_id}' 不存在",
                timestamp=datetime.now(timezone.utc)
            ).dict()
        )
    
    if not dataset.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=schemas.ErrorResponse(
                error_code="DATASET_INACTIVE",
                message=f"数据集 '{request.dataset_id}' 已停用",
                timestamp=datetime.now(timezone.utc)
            ).dict()
        )
    
    result = services.advance_watermark(db=db, request=request)
    return result


@router.get("/history", response_model=schemas.PaginatedFreshnessRecords)
def get_freshness_history(
    dataset_id: str = None,
    start_time: datetime = None,
    end_time: datetime = None,
    query_consumer: str = None,
    is_expired: bool = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    params = schemas.HistoryQueryParams(
        dataset_id=dataset_id,
        start_time=start_time,
        end_time=end_time,
        query_consumer=query_consumer,
        is_expired=is_expired,
        limit=limit,
        offset=offset
    )
    
    total, records = services.query_freshness_history(db=db, params=params)
    
    return schemas.PaginatedFreshnessRecords(
        total=total,
        limit=limit,
        offset=offset,
        records=records
    )


@router.get("/records/{record_id}", response_model=schemas.FreshnessRecord)
def get_freshness_record(record_id: str, db: Session = Depends(get_db)):
    from app import models
    record = db.query(models.FreshnessRecord).filter(models.FreshnessRecord.id == record_id).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=schemas.ErrorResponse(
                error_code="RECORD_NOT_FOUND",
                message=f"新鲜度记录 '{record_id}' 不存在",
                timestamp=datetime.now(timezone.utc)
            ).dict()
        )
    return record
