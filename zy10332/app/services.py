from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from app import models, schemas


def calculate_freshness_score(
    cache_updated_at: datetime,
    expected_frequency_seconds: int,
    reference_time: Optional[datetime] = None
) -> float:
    if reference_time is None:
        reference_time = datetime.now(timezone.utc)
    
    if cache_updated_at.tzinfo is None:
        cache_updated_at = cache_updated_at.replace(tzinfo=timezone.utc)
    
    age_seconds = (reference_time - cache_updated_at).total_seconds()
    
    if age_seconds <= 0:
        return 1.0
    
    ratio = age_seconds / expected_frequency_seconds
    
    if ratio <= 0.5:
        score = 1.0 - (ratio * 0.4)
    elif ratio <= 1.0:
        score = 0.8 - ((ratio - 0.5) * 0.6)
    elif ratio <= 2.0:
        score = 0.5 - ((ratio - 1.0) * 0.4)
    else:
        score = max(0.0, 0.1 - (ratio - 2.0) * 0.05)
    
    return round(max(0.0, min(1.0, score)), 4)


def is_data_expired(
    cache_updated_at: datetime,
    expected_frequency_seconds: int,
    reference_time: Optional[datetime] = None,
    expiry_multiplier: float = 1.5
) -> bool:
    if reference_time is None:
        reference_time = datetime.now(timezone.utc)
    
    if cache_updated_at.tzinfo is None:
        cache_updated_at = cache_updated_at.replace(tzinfo=timezone.utc)
    
    age_seconds = (reference_time - cache_updated_at).total_seconds()
    expiry_threshold = expected_frequency_seconds * expiry_multiplier
    
    return age_seconds > expiry_threshold


def generate_expiration_explanation(
    cache_updated_at: datetime,
    source_updated_at: datetime,
    expected_frequency_seconds: int,
    is_expired: bool,
    reference_time: Optional[datetime] = None
) -> str:
    if reference_time is None:
        reference_time = datetime.now(timezone.utc)
    
    if cache_updated_at.tzinfo is None:
        cache_updated_at = cache_updated_at.replace(tzinfo=timezone.utc)
    if source_updated_at.tzinfo is None:
        source_updated_at = source_updated_at.replace(tzinfo=timezone.utc)
    
    age_seconds = (reference_time - cache_updated_at).total_seconds()
    cache_delay = (cache_updated_at - source_updated_at).total_seconds()
    
    minutes_ago = round(age_seconds / 60, 1)
    expiry_threshold = expected_frequency_seconds * 1.5
    expiry_minutes = round(expiry_threshold / 60, 1)
    
    if is_expired:
        overdue = age_seconds - expiry_threshold
        overdue_minutes = round(overdue / 60, 1)
        return (
            f"数据已过期。缓存更新于 {minutes_ago} 分钟前，"
            f"超过阈值 {expiry_minutes} 分钟，逾期 {overdue_minutes} 分钟。"
            f"预期更新频率: {round(expected_frequency_seconds / 60, 1)} 分钟。"
        )
    else:
        remaining = expiry_threshold - age_seconds
        remaining_minutes = round(remaining / 60, 1)
        return (
            f"数据新鲜。缓存更新于 {minutes_ago} 分钟前，"
            f"距过期阈值还有 {remaining_minutes} 分钟。"
            f"数据源到缓存延迟: {round(cache_delay / 60, 1)} 分钟。"
        )


def check_watermark_consistency(
    current_watermark: Optional[str],
    new_watermark: str
) -> Tuple[bool, str]:
    if current_watermark is None:
        return True, "首次设置水位"
    
    if new_watermark == current_watermark:
        return False, "水位未变化"
    
    try:
        current_parts = current_watermark.split('.')
        new_parts = new_watermark.split('.')
        
        if len(current_parts) == len(new_parts) and all(p.isdigit() for p in current_parts + new_parts):
            for i, (c, n) in enumerate(zip(current_parts, new_parts)):
                if int(n) > int(c):
                    return True, f"水位从 {current_watermark} 推进到 {new_watermark}"
                elif int(n) < int(c):
                    return False, f"水位回退，新水位 {new_watermark} 低于当前水位 {current_watermark}"
    except (ValueError, AttributeError):
        pass
    
    if new_watermark > current_watermark:
        return True, f"水位从 {current_watermark} 更新到 {new_watermark}"
    
    return False, f"水位未推进，新值 {new_watermark} 不大于当前值 {current_watermark}"


def get_dataset(db: Session, dataset_id: str) -> Optional[models.Dataset]:
    return db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()


def get_dataset_by_name(db: Session, name: str) -> Optional[models.Dataset]:
    return db.query(models.Dataset).filter(models.Dataset.name == name).first()


def create_dataset(db: Session, dataset: schemas.DatasetCreate) -> models.Dataset:
    db_dataset = models.Dataset(**dataset.dict())
    db.add(db_dataset)
    db.commit()
    db.refresh(db_dataset)
    return db_dataset


def update_dataset(db: Session, dataset_id: str, dataset_update: schemas.DatasetUpdate) -> Optional[models.Dataset]:
    db_dataset = get_dataset(db, dataset_id)
    if not db_dataset:
        return None
    
    update_data = dataset_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_dataset, field, value)
    
    db.commit()
    db.refresh(db_dataset)
    return db_dataset


def check_idempotent_request(db: Session, request_id: str, dataset_id: str, operation_type: str) -> Optional[Dict[str, Any]]:
    if not request_id:
        return None
    
    existing = db.query(models.IdempotentRequest).filter(
        models.IdempotentRequest.request_id == request_id,
        models.IdempotentRequest.dataset_id == dataset_id,
        models.IdempotentRequest.operation_type == operation_type
    ).first()
    
    if existing:
        return existing.response_data
    return None


def save_idempotent_request(db: Session, request_id: str, dataset_id: str, operation_type: str, response_data: Dict[str, Any]) -> None:
    if not request_id:
        return
    
    db_request = models.IdempotentRequest(
        request_id=request_id,
        dataset_id=dataset_id,
        operation_type=operation_type,
        response_data=response_data
    )
    db.add(db_request)
    db.commit()


def create_freshness_record(db: Session, record: schemas.FreshnessRecordCreate, dataset: models.Dataset) -> models.FreshnessRecord:
    reference_time = datetime.now(timezone.utc)
    
    freshness_score = calculate_freshness_score(
        record.cache_updated_at,
        dataset.expected_frequency_seconds,
        reference_time
    )
    
    is_expired = is_data_expired(
        record.cache_updated_at,
        dataset.expected_frequency_seconds,
        reference_time
    )
    
    is_fresh = not is_expired and freshness_score >= 0.5
    
    explanation = generate_expiration_explanation(
        record.cache_updated_at,
        record.source_updated_at,
        dataset.expected_frequency_seconds,
        is_expired,
        reference_time
    )
    
    db_record = models.FreshnessRecord(
        **record.dict(exclude={'request_id'}),
        is_fresh=is_fresh,
        freshness_score=freshness_score,
        is_expired=is_expired,
        expiration_explanation=explanation,
        request_id=record.request_id
    )
    
    db.add(db_record)
    
    dataset.latest_source_updated_at = record.source_updated_at
    dataset.latest_cache_updated_at = record.cache_updated_at
    if record.sync_watermark:
        dataset.current_watermark = record.sync_watermark
    
    db.commit()
    db.refresh(db_record)
    return db_record


def check_dataset_freshness(db: Session, check_request: schemas.FreshnessCheckRequest) -> Optional[schemas.FreshnessCheckResult]:
    dataset = get_dataset(db, check_request.dataset_id)
    if not dataset or not dataset.is_active:
        return None
    
    if not dataset.latest_cache_updated_at or not dataset.latest_source_updated_at:
        return None
    
    reference_time = check_request.reference_time or datetime.now(timezone.utc)
    
    freshness_score = calculate_freshness_score(
        dataset.latest_cache_updated_at,
        dataset.expected_frequency_seconds,
        reference_time
    )
    
    is_expired = is_data_expired(
        dataset.latest_cache_updated_at,
        dataset.expected_frequency_seconds,
        reference_time
    )
    
    is_fresh = not is_expired and freshness_score >= 0.5
    
    explanation = generate_expiration_explanation(
        dataset.latest_cache_updated_at,
        dataset.latest_source_updated_at,
        dataset.expected_frequency_seconds,
        is_expired,
        reference_time
    )
    
    if dataset.latest_cache_updated_at.tzinfo is None:
        cache_updated = dataset.latest_cache_updated_at.replace(tzinfo=timezone.utc)
    else:
        cache_updated = dataset.latest_cache_updated_at
    
    last_sync_age = (reference_time - cache_updated).total_seconds()
    
    return schemas.FreshnessCheckResult(
        dataset_id=dataset.id,
        dataset_name=dataset.name,
        is_fresh=is_fresh,
        freshness_score=freshness_score,
        is_expired=is_expired,
        expiration_explanation=explanation,
        source_updated_at=dataset.latest_source_updated_at,
        cache_updated_at=dataset.latest_cache_updated_at,
        sync_watermark=dataset.current_watermark,
        expected_frequency_seconds=dataset.expected_frequency_seconds,
        last_sync_age_seconds=round(last_sync_age, 2),
        checked_at=reference_time,
        query_consumer=check_request.query_consumer
    )


def advance_watermark(db: Session, request: schemas.WatermarkAdvanceRequest) -> Optional[schemas.WatermarkAdvanceResult]:
    dataset = get_dataset(db, request.dataset_id)
    if not dataset or not dataset.is_active:
        return None
    
    old_watermark = dataset.current_watermark
    is_advanced, message = check_watermark_consistency(old_watermark, request.new_watermark)
    
    if is_advanced:
        dataset.current_watermark = request.new_watermark
        dataset.latest_source_updated_at = request.source_updated_at
        db.commit()
        db.refresh(dataset)
    
    return schemas.WatermarkAdvanceResult(
        dataset_id=request.dataset_id,
        old_watermark=old_watermark,
        new_watermark=request.new_watermark,
        is_advanced=is_advanced,
        message=message,
        advanced_at=datetime.now(timezone.utc)
    )


def query_freshness_history(db: Session, params: schemas.HistoryQueryParams) -> Tuple[int, list]:
    query = db.query(models.FreshnessRecord)
    
    if params.dataset_id:
        query = query.filter(models.FreshnessRecord.dataset_id == params.dataset_id)
    if params.start_time:
        query = query.filter(models.FreshnessRecord.recorded_at >= params.start_time)
    if params.end_time:
        query = query.filter(models.FreshnessRecord.recorded_at <= params.end_time)
    if params.query_consumer:
        query = query.filter(models.FreshnessRecord.query_consumer == params.query_consumer)
    if params.is_expired is not None:
        query = query.filter(models.FreshnessRecord.is_expired == params.is_expired)
    
    total = query.count()
    
    records = query.order_by(models.FreshnessRecord.recorded_at.desc())\
                   .offset(params.offset)\
                   .limit(params.limit)\
                   .all()
    
    return total, records
