from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app import schemas, services, models
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
            ).model_dump()
        )
    
    if not dataset.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=schemas.ErrorResponse(
                error_code="DATASET_INACTIVE",
                message=f"数据集 '{record.dataset_id}' 已停用",
                timestamp=datetime.now(timezone.utc)
            ).model_dump()
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
            response_data=schemas.FreshnessRecord.model_validate(db_record).model_dump()
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
            ).model_dump()
        )
    
    if not dataset.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=schemas.ErrorResponse(
                error_code="DATASET_INACTIVE",
                message=f"数据集 '{check_request.dataset_id}' 已停用",
                timestamp=datetime.now(timezone.utc)
            ).model_dump()
        )
    
    result = services.check_dataset_freshness(db=db, check_request=check_request)
    
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=schemas.ErrorResponse(
                error_code="NO_FRESHNESS_DATA",
                message=f"数据集 '{check_request.dataset_id}' 尚无新鲜度记录",
                timestamp=datetime.now(timezone.utc)
            ).model_dump()
        )
    
    services.check_and_trigger_notifications(db=db, dataset=dataset, freshness_result=result)
    
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
            ).model_dump()
        )
    
    if not dataset.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=schemas.ErrorResponse(
                error_code="DATASET_INACTIVE",
                message=f"数据集 '{request.dataset_id}' 已停用",
                timestamp=datetime.now(timezone.utc)
            ).model_dump()
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
    
    validated_records = [schemas.FreshnessRecord.model_validate(r) for r in records]
    
    return schemas.PaginatedFreshnessRecords(
        total=total,
        limit=limit,
        offset=offset,
        records=validated_records
    )


@router.get("/records/{record_id}", response_model=schemas.FreshnessRecord)
def get_freshness_record(record_id: str, db: Session = Depends(get_db)):
    record = db.query(models.FreshnessRecord).filter(models.FreshnessRecord.id == record_id).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=schemas.ErrorResponse(
                error_code="RECORD_NOT_FOUND",
                message=f"新鲜度记录 '{record_id}' 不存在",
                timestamp=datetime.now(timezone.utc)
            ).model_dump()
        )
    return record


@router.post("/export")
def export_freshness_data(
    export_format: schemas.ExportFormat,
    dataset_id: str = None,
    start_time: datetime = None,
    end_time: datetime = None,
    query_consumer: str = None,
    is_expired: bool = None,
    limit: int = 1000,
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
    
    content, media_type = services.export_freshness_records(
        db=db,
        params=params,
        export_format=export_format.format,
        include_metadata=export_format.include_metadata
    )
    
    from fastapi.responses import Response
    return Response(content=content, media_type=media_type)


@router.post("/subscriptions", response_model=schemas.Subscription, status_code=status.HTTP_201_CREATED)
def create_subscription(sub: schemas.SubscriptionCreate, db: Session = Depends(get_db)):
    dataset = services.get_dataset(db, dataset_id=sub.dataset_id)
    if dataset is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=schemas.ErrorResponse(
                error_code="DATASET_NOT_FOUND",
                message=f"数据集 '{sub.dataset_id}' 不存在",
                timestamp=datetime.now(timezone.utc)
            ).model_dump()
        )
    
    return services.create_subscription(db=db, sub=sub)


@router.get("/subscriptions", response_model=list[schemas.Subscription])
def list_subscriptions(dataset_id: str = None, subscriber: str = None, db: Session = Depends(get_db)):
    query = db.query(models.Subscription)
    if dataset_id:
        query = query.filter(models.Subscription.dataset_id == dataset_id)
    if subscriber:
        query = query.filter(models.Subscription.subscriber == subscriber)
    return query.order_by(models.Subscription.created_at.desc()).all()


@router.get("/subscriptions/{sub_id}", response_model=schemas.Subscription)
def get_subscription(sub_id: str, db: Session = Depends(get_db)):
    sub = services.get_subscriptions(db, sub_id=sub_id)
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=schemas.ErrorResponse(
                error_code="SUBSCRIPTION_NOT_FOUND",
                message=f"订阅 '{sub_id}' 不存在",
                timestamp=datetime.now(timezone.utc)
            ).model_dump()
        )
    return sub


@router.patch("/subscriptions/{sub_id}", response_model=schemas.Subscription)
def update_subscription(sub_id: str, sub_update: schemas.SubscriptionUpdate, db: Session = Depends(get_db)):
    updated = services.update_subscription(db, sub_id=sub_id, sub_update=sub_update)
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=schemas.ErrorResponse(
                error_code="SUBSCRIPTION_NOT_FOUND",
                message=f"订阅 '{sub_id}' 不存在",
                timestamp=datetime.now(timezone.utc)
            ).model_dump()
        )
    return updated


@router.delete("/subscriptions/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subscription(sub_id: str, db: Session = Depends(get_db)):
    deleted = services.delete_subscription(db, sub_id=sub_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=schemas.ErrorResponse(
                error_code="SUBSCRIPTION_NOT_FOUND",
                message=f"订阅 '{sub_id}' 不存在",
                timestamp=datetime.now(timezone.utc)
            ).model_dump()
        )
    return None


@router.get("/notifications", response_model=list[schemas.Notification])
def list_notifications(subscriber: str = None, db: Session = Depends(get_db)):
    query = db.query(models.Notification)
    if subscriber:
        query = query.filter(models.Notification.subscriber == subscriber)
    return query.order_by(models.Notification.created_at.desc()).limit(100).all()
