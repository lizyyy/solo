from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, func
from datetime import datetime, timedelta
import uuid
from typing import List, Optional, Tuple
from . import models, schemas


def get_project(db: Session, project_id: str):
    return db.query(models.Project).filter(models.Project.id == project_id).first()


def get_projects(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Project).offset(skip).limit(limit).all()


def create_project(db: Session, project: schemas.ProjectCreate):
    db_project = models.Project(
        id=project.id,
        name=project.name,
        description=project.description
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


def get_cache_entry(db: Session, cache_entry_id: str):
    return db.query(models.CacheEntry).filter(models.CacheEntry.id == cache_entry_id).first()


def get_cache_entry_by_key(db: Session, cache_key: str):
    return db.query(models.CacheEntry).filter(models.CacheEntry.cache_key == cache_key).first()


def get_cache_entries(
    db: Session,
    project_id: Optional[str] = None,
    min_size: Optional[int] = None,
    max_size: Optional[int] = None,
    min_hits: Optional[int] = None,
    max_hits: Optional[int] = None,
    days_since_access: Optional[int] = None,
    is_protected: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    sort_by: str = "size",
    sort_order: str = "desc"
):
    query = db.query(models.CacheEntry)

    if project_id:
        query = query.filter(models.CacheEntry.project_id == project_id)
    if min_size:
        query = query.filter(models.CacheEntry.size_bytes >= min_size)
    if max_size:
        query = query.filter(models.CacheEntry.size_bytes <= max_size)
    if min_hits:
        query = query.filter(models.CacheEntry.hit_count >= min_hits)
    if max_hits:
        query = query.filter(models.CacheEntry.hit_count <= max_hits)
    if days_since_access:
        cutoff_date = datetime.utcnow() - timedelta(days=days_since_access)
        query = query.filter(models.CacheEntry.last_accessed_at <= cutoff_date)
    if is_protected is not None:
        query = query.filter(models.CacheEntry.is_protected == is_protected)

    if sort_by == "size":
        order_col = models.CacheEntry.size_bytes
    elif sort_by == "hits":
        order_col = models.CacheEntry.hit_count
    elif sort_by == "last_accessed":
        order_col = models.CacheEntry.last_accessed_at
    else:
        order_col = models.CacheEntry.created_at

    if sort_order == "desc":
        query = query.order_by(desc(order_col))
    else:
        query = query.order_by(asc(order_col))

    return query.offset(skip).limit(limit).all()


def create_cache_entry(db: Session, cache_entry: schemas.CacheEntryCreate):
    db_cache_entry = models.CacheEntry(
        id=cache_entry.id,
        cache_key=cache_entry.cache_key,
        project_id=cache_entry.project_id,
        size_bytes=cache_entry.size_bytes,
        hit_count=cache_entry.hit_count,
        is_protected=cache_entry.is_protected
    )
    db.add(db_cache_entry)
    db.commit()
    db.refresh(db_cache_entry)
    return db_cache_entry


def update_cache_entry(db: Session, cache_entry_id: str, cache_entry_update: schemas.CacheEntryUpdate):
    db_cache_entry = get_cache_entry(db, cache_entry_id)
    if not db_cache_entry:
        return None

    update_data = cache_entry_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_cache_entry, key, value)

    db.commit()
    db.refresh(db_cache_entry)
    return db_cache_entry


def increment_hit_count(db: Session, cache_entry_id: str):
    db_cache_entry = get_cache_entry(db, cache_entry_id)
    if db_cache_entry:
        db_cache_entry.hit_count += 1
        db_cache_entry.last_accessed_at = datetime.utcnow()
        db.commit()
        db.refresh(db_cache_entry)
    return db_cache_entry


def delete_cache_entry(db: Session, cache_entry_id: str):
    db_cache_entry = get_cache_entry(db, cache_entry_id)
    if db_cache_entry:
        db.delete(db_cache_entry)
        db.commit()
    return db_cache_entry


def calculate_impact_score(db: Session, cache_entry) -> schemas.ImpactAnalysisResult:
    risk_factors = []
    impact_score = 0.0

    total_hits = db.query(func.sum(models.CacheEntry.hit_count)).scalar() or 1
    hit_ratio = cache_entry.hit_count / total_hits if total_hits > 0 else 0

    days_since_access = (datetime.utcnow() - cache_entry.last_accessed_at).days

    size_factor = min(cache_entry.size_bytes / (1024 * 1024 * 1024), 1.0)

    hit_factor = min(hit_ratio * 10, 1.0)

    recency_factor = max(0, 1.0 - (days_since_access / 30))

    if cache_entry.is_protected:
        impact_score += 0.4
        risk_factors.append("Cache entry is marked as protected")

    impact_score += size_factor * 0.3
    if size_factor > 0.5:
        risk_factors.append("Large cache size")

    impact_score += hit_factor * 0.4
    if hit_factor > 0.3:
        risk_factors.append("High hit rate")

    impact_score += recency_factor * 0.3
    if recency_factor > 0.7:
        risk_factors.append("Recently accessed")

    impact_score = min(impact_score, 1.0)

    if impact_score > 0.7:
        requires_manual_review = True
        analysis = f"HIGH IMPACT: Score {impact_score:.2f}. This cache entry has significant impact on build performance."
    elif impact_score > 0.4:
        requires_manual_review = False
        analysis = f"MEDIUM IMPACT: Score {impact_score:.2f}. Moderate impact expected."
    else:
        requires_manual_review = False
        analysis = f"LOW IMPACT: Score {impact_score:.2f}. Minimal impact expected."

    analysis += f" | Size: {cache_entry.size_bytes / (1024*1024):.1f}MB, Hits: {cache_entry.hit_count}, Last Access: {days_since_access} days ago"

    return schemas.ImpactAnalysisResult(
        impact_score=impact_score,
        impact_analysis=analysis,
        requires_manual_review=requires_manual_review,
        risk_factors=risk_factors
    )


def get_eviction_request(db: Session, eviction_request_id: str):
    return db.query(models.EvictionRequest).filter(models.EvictionRequest.id == eviction_request_id).first()


def get_eviction_requests(
    db: Session,
    status: Optional[schemas.EvictionStatus] = None,
    cache_entry_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
):
    query = db.query(models.EvictionRequest)

    if status:
        query = query.filter(models.EvictionRequest.status == status)
    if cache_entry_id:
        query = query.filter(models.EvictionRequest.cache_entry_id == cache_entry_id)

    return query.order_by(desc(models.EvictionRequest.created_at)).offset(skip).limit(limit).all()


def has_active_eviction_request(db: Session, cache_entry_id: str) -> bool:
    active_statuses = [
        schemas.EvictionStatus.PENDING,
        schemas.EvictionStatus.ANALYZING,
        schemas.EvictionStatus.APPROVED,
        schemas.EvictionStatus.NEEDS_REVIEW
    ]
    count = db.query(models.EvictionRequest).filter(
        models.EvictionRequest.cache_entry_id == cache_entry_id,
        models.EvictionRequest.status.in_(active_statuses)
    ).count()
    return count > 0


def create_eviction_request(db: Session, eviction_request: schemas.EvictionRequestCreate):
    cache_entry = get_cache_entry(db, eviction_request.cache_entry_id)
    if not cache_entry:
        return None, "CACHE_ENTRY_NOT_FOUND"

    if has_active_eviction_request(db, eviction_request.cache_entry_id):
        return None, "ACTIVE_EVICTION_EXISTS"

    impact_result = calculate_impact_score(db, cache_entry)

    status = schemas.EvictionStatus.NEEDS_REVIEW if impact_result.requires_manual_review else schemas.EvictionStatus.PENDING

    db_eviction = models.EvictionRequest(
        id=str(uuid.uuid4()),
        cache_entry_id=eviction_request.cache_entry_id,
        status=status,
        requester=eviction_request.requester,
        reason=eviction_request.reason,
        impact_score=impact_result.impact_score,
        impact_analysis=impact_result.impact_analysis,
        requires_manual_review=impact_result.requires_manual_review,
        cache_size_bytes=cache_entry.size_bytes
    )
    db.add(db_eviction)
    db.commit()
    db.refresh(db_eviction)
    return db_eviction, None


def review_eviction_request(
    db: Session,
    eviction_request_id: str,
    review: schemas.EvictionRequestReview
):
    db_eviction = get_eviction_request(db, eviction_request_id)
    if not db_eviction:
        return None, "EVICTION_NOT_FOUND"

    if db_eviction.status not in [schemas.EvictionStatus.NEEDS_REVIEW, schemas.EvictionStatus.PENDING]:
        return None, "INVALID_STATUS"

    db_eviction.review_comment = review.review_comment
    db_eviction.reviewed_by = review.reviewed_by
    db_eviction.reviewed_at = datetime.utcnow()

    if review.approved:
        db_eviction.status = schemas.EvictionStatus.APPROVED
    else:
        db_eviction.status = schemas.EvictionStatus.REJECTED

    db.commit()
    db.refresh(db_eviction)
    return db_eviction, None


def execute_eviction(db: Session, eviction_request_id: str, executed_by: Optional[str] = None):
    db_eviction = get_eviction_request(db, eviction_request_id)
    if not db_eviction:
        return None, "EVICTION_NOT_FOUND"

    if db_eviction.status == schemas.EvictionStatus.EXECUTED:
        return None, "ALREADY_EXECUTED"

    if db_eviction.status == schemas.EvictionStatus.NEEDS_REVIEW:
        return None, "NEEDS_MANUAL_REVIEW"

    if db_eviction.status not in [schemas.EvictionStatus.APPROVED, schemas.EvictionStatus.PENDING]:
        return None, "INVALID_STATUS"

    cache_entry_id = db_eviction.cache_entry_id

    db_eviction.status = schemas.EvictionStatus.EXECUTED
    db_eviction.executed_at = datetime.utcnow()
    if executed_by:
        db_eviction.reviewed_by = executed_by

    db.flush()

    cache_entry = get_cache_entry(db, cache_entry_id)
    if cache_entry:
        db.expunge(db_eviction)
        db.delete(cache_entry)

    db.commit()

    db_eviction = get_eviction_request(db, eviction_request_id)
    return db_eviction, None


def cancel_eviction(db: Session, eviction_request_id: str):
    db_eviction = get_eviction_request(db, eviction_request_id)
    if not db_eviction:
        return None, "EVICTION_NOT_FOUND"

    if db_eviction.status in [schemas.EvictionStatus.EXECUTED, schemas.EvictionStatus.REJECTED, schemas.EvictionStatus.CANCELLED]:
        return None, "INVALID_STATUS"

    db_eviction.status = schemas.EvictionStatus.CANCELLED
    db.commit()
    db.refresh(db_eviction)
    return db_eviction, None


def get_eviction_candidates(
    db: Session,
    target_free_bytes: Optional[int] = None,
    min_days_since_access: int = 7,
    max_impact_score: float = 0.5,
    limit: int = 100
) -> List[schemas.EvictionCandidate]:
    cutoff_date = datetime.utcnow() - timedelta(days=min_days_since_access)

    cache_entries = db.query(models.CacheEntry).filter(
        models.CacheEntry.last_accessed_at <= cutoff_date,
        models.CacheEntry.is_protected == False
    ).order_by(desc(models.CacheEntry.size_bytes)).limit(limit).all()

    candidates = []
    for entry in cache_entries:
        impact_result = calculate_impact_score(db, entry)

        if impact_result.impact_score > max_impact_score:
            continue

        days_since_access = (datetime.utcnow() - entry.last_accessed_at).days

        priority_score = (entry.size_bytes / (1024 * 1024)) * (1 - impact_result.impact_score)

        candidates.append(schemas.EvictionCandidate(
            cache_entry_id=entry.id,
            cache_key=entry.cache_key,
            project_name=entry.project.name if entry.project else "Unknown",
            size_bytes=entry.size_bytes,
            hit_count=entry.hit_count,
            last_accessed_days=days_since_access,
            impact_score=impact_result.impact_score,
            priority_score=priority_score
        ))

    candidates.sort(key=lambda x: x.priority_score, reverse=True)

    if target_free_bytes:
        selected = []
        total_freed = 0
        for candidate in candidates:
            if total_freed >= target_free_bytes:
                break
            selected.append(candidate)
            total_freed += candidate.size_bytes
        return selected

    return candidates


def create_eviction_report(db: Session, eviction_ids: List[str], generated_by: Optional[str] = None):
    evictions = db.query(models.EvictionRequest).filter(
        models.EvictionRequest.id.in_(eviction_ids),
        models.EvictionRequest.status == schemas.EvictionStatus.EXECUTED
    ).all()

    total_evicted = len(evictions)
    total_space_freed = sum(e.cache_size_bytes or (e.cache_entry.size_bytes if e.cache_entry else 0) for e in evictions)
    total_impact = sum(e.impact_score or 0 for e in evictions)

    report_data = {
        "evictions": [
            {
                "id": e.id,
                "cache_key": e.cache_entry.cache_key if e.cache_entry else None,
                "size_bytes": e.cache_size_bytes or (e.cache_entry.size_bytes if e.cache_entry else 0),
                "impact_score": e.impact_score,
                "executed_at": e.executed_at.isoformat() if e.executed_at else None
            }
            for e in evictions
        ],
        "summary": {
            "total_evicted": total_evicted,
            "total_space_freed_bytes": total_space_freed,
            "total_space_freed_mb": total_space_freed / (1024 * 1024),
            "average_impact_score": total_impact / total_evicted if total_evicted > 0 else 0
        }
    }

    import json
    db_report = models.EvictionReport(
        id=str(uuid.uuid4()),
        total_evicted=total_evicted,
        total_space_freed_bytes=total_space_freed,
        total_impact_score=total_impact,
        report_data=json.dumps(report_data),
        generated_by=generated_by
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report


def get_cache_statistics(db: Session):
    total_entries = db.query(func.count(models.CacheEntry.id)).scalar() or 0
    total_size = db.query(func.sum(models.CacheEntry.size_bytes)).scalar() or 0
    total_hits = db.query(func.sum(models.CacheEntry.hit_count)).scalar() or 0
    protected_count = db.query(func.count(models.CacheEntry.id)).filter(models.CacheEntry.is_protected == True).scalar() or 0

    return {
        "total_entries": total_entries,
        "total_size_bytes": total_size,
        "total_size_mb": total_size / (1024 * 1024),
        "total_hits": total_hits,
        "protected_count": protected_count
    }
