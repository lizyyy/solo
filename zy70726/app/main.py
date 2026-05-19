from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import pandas as pd
import io
from fastapi.responses import StreamingResponse

from . import models, schemas, crud
from .database import get_db, init_db

app = FastAPI(
    title="构建缓存驱逐影响分析API",
    description="用于分析和管理CI构建缓存驱逐的后端API，支持影响评估、缓存筛选、批量驱逐等功能",
    version="1.0.0"
)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": exc.detail.get("error_code", "UNKNOWN_ERROR") if isinstance(exc.detail, dict) else "UNKNOWN_ERROR",
            "message": exc.detail.get("message", str(exc.detail)) if isinstance(exc.detail, dict) else str(exc.detail),
            "details": exc.detail.get("details", None) if isinstance(exc.detail, dict) else None
        }
    )


@app.get("/")
async def root():
    return {"message": "Build Cache Eviction Impact Analysis API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.post("/projects/", response_model=schemas.Project, status_code=status.HTTP_201_CREATED)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    db_project = crud.get_project(db, project_id=project.id)
    if db_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "PROJECT_EXISTS", "message": "Project already exists"}
        )
    return crud.create_project(db=db, project=project)


@app.get("/projects/", response_model=List[schemas.Project])
def get_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    projects = crud.get_projects(db, skip=skip, limit=limit)
    return projects


@app.get("/projects/{project_id}", response_model=schemas.Project)
def get_project(project_id: str, db: Session = Depends(get_db)):
    db_project = crud.get_project(db, project_id=project_id)
    if db_project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "PROJECT_NOT_FOUND", "message": "Project not found"}
        )
    return db_project


@app.post("/cache/", response_model=schemas.CacheEntry, status_code=status.HTTP_201_CREATED)
def create_cache_entry(cache_entry: schemas.CacheEntryCreate, db: Session = Depends(get_db)):
    db_project = crud.get_project(db, project_id=cache_entry.project_id)
    if not db_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "PROJECT_NOT_FOUND", "message": "Referenced project does not exist"}
        )
    return crud.create_cache_entry(db=db, cache_entry=cache_entry)


@app.get("/cache/", response_model=List[schemas.CacheEntry])
def get_cache_entries(
    project_id: Optional[str] = None,
    min_size: Optional[int] = None,
    max_size: Optional[int] = None,
    min_hits: Optional[int] = None,
    max_hits: Optional[int] = None,
    days_since_access: Optional[int] = None,
    is_protected: Optional[bool] = None,
    sort_by: str = "size",
    sort_order: str = "desc",
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    entries = crud.get_cache_entries(
        db,
        project_id=project_id,
        min_size=min_size,
        max_size=max_size,
        min_hits=min_hits,
        max_hits=max_hits,
        days_since_access=days_since_access,
        is_protected=is_protected,
        skip=skip,
        limit=limit,
        sort_by=sort_by,
        sort_order=sort_order
    )
    return entries


@app.get("/cache/{cache_entry_id}", response_model=schemas.CacheEntry)
def get_cache_entry(cache_entry_id: str, db: Session = Depends(get_db)):
    db_entry = crud.get_cache_entry(db, cache_entry_id=cache_entry_id)
    if db_entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "CACHE_ENTRY_NOT_FOUND", "message": "Cache entry not found"}
        )
    return db_entry


@app.patch("/cache/{cache_entry_id}", response_model=schemas.CacheEntry)
def update_cache_entry(cache_entry_id: str, update: schemas.CacheEntryUpdate, db: Session = Depends(get_db)):
    db_entry = crud.update_cache_entry(db, cache_entry_id=cache_entry_id, cache_entry_update=update)
    if db_entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "CACHE_ENTRY_NOT_FOUND", "message": "Cache entry not found"}
        )
    return db_entry


@app.post("/cache/{cache_entry_id}/hit", response_model=schemas.CacheEntry)
def increment_cache_hit(cache_entry_id: str, db: Session = Depends(get_db)):
    db_entry = crud.increment_hit_count(db, cache_entry_id=cache_entry_id)
    if db_entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "CACHE_ENTRY_NOT_FOUND", "message": "Cache entry not found"}
        )
    return db_entry


@app.get("/cache/export/")
def export_cache_entries(
    project_id: Optional[str] = None,
    format: str = "csv",
    db: Session = Depends(get_db)
):
    entries = crud.get_cache_entries(db, project_id=project_id, limit=1000)

    data = []
    for entry in entries:
        data.append({
            "id": entry.id,
            "cache_key": entry.cache_key,
            "project_id": entry.project_id,
            "project_name": entry.project.name if entry.project else "",
            "size_bytes": entry.size_bytes,
            "size_mb": entry.size_bytes / (1024 * 1024),
            "hit_count": entry.hit_count,
            "last_accessed_at": entry.last_accessed_at.isoformat(),
            "created_at": entry.created_at.isoformat(),
            "is_protected": entry.is_protected
        })

    df = pd.DataFrame(data)

    if format == "csv":
        stream = io.StringIO()
        df.to_csv(stream, index=False, encoding="utf-8")
        response = StreamingResponse(
            iter([stream.getvalue()]),
            media_type="text/csv"
        )
        response.headers["Content-Disposition"] = "attachment; filename=cache_entries.csv"
    elif format == "xlsx":
        stream = io.BytesIO()
        with pd.ExcelWriter(stream, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Cache Entries")
        stream.seek(0)
        response = StreamingResponse(
            iter([stream.getvalue()]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        response.headers["Content-Disposition"] = "attachment; filename=cache_entries.xlsx"
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "INVALID_FORMAT", "message": "Supported formats: csv, xlsx"}
        )

    return response


@app.get("/statistics/")
def get_statistics(db: Session = Depends(get_db)):
    return crud.get_cache_statistics(db)


@app.post("/evictions/", response_model=schemas.EvictionRequest, status_code=status.HTTP_201_CREATED)
def create_eviction_request(eviction_request: schemas.EvictionRequestCreate, db: Session = Depends(get_db)):
    if not eviction_request.cache_entry_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "MISSING_FIELD", "message": "cache_entry_id is required", "details": {"field": "cache_entry_id"}}
        )

    db_eviction, error_code = crud.create_eviction_request(db, eviction_request=eviction_request)

    if error_code == "CACHE_ENTRY_NOT_FOUND":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": error_code, "message": "Cache entry not found"}
        )
    elif error_code == "ACTIVE_EVICTION_EXISTS":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error_code": error_code, "message": "An active eviction request already exists for this cache entry"}
        )

    return db_eviction


@app.get("/evictions/", response_model=List[schemas.EvictionRequest])
def get_eviction_requests(
    status: Optional[schemas.EvictionStatus] = None,
    cache_entry_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.get_eviction_requests(db, status=status, cache_entry_id=cache_entry_id, skip=skip, limit=limit)


@app.get("/evictions/{eviction_id}", response_model=schemas.EvictionRequest)
def get_eviction_request(eviction_id: str, db: Session = Depends(get_db)):
    db_eviction = crud.get_eviction_request(db, eviction_request_id=eviction_id)
    if db_eviction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "EVICTION_NOT_FOUND", "message": "Eviction request not found"}
        )
    return db_eviction


@app.post("/evictions/{eviction_id}/review", response_model=schemas.EvictionRequest)
def review_eviction(eviction_id: str, review: schemas.EvictionRequestReview, db: Session = Depends(get_db)):
    db_eviction, error_code = crud.review_eviction_request(db, eviction_request_id=eviction_id, review=review)

    if error_code == "EVICTION_NOT_FOUND":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": error_code, "message": "Eviction request not found"}
        )
    elif error_code == "INVALID_STATUS":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_STATUS",
                "message": "Operation not allowed in current status",
                "details": {"allowed_statuses": ["pending", "needs_review"]}
            }
        )

    return db_eviction


@app.post("/evictions/{eviction_id}/execute", response_model=schemas.EvictionRequest)
def execute_eviction(eviction_id: str, executed_by: Optional[str] = None, db: Session = Depends(get_db)):
    db_eviction, error_code = crud.execute_eviction(db, eviction_request_id=eviction_id, executed_by=executed_by)

    if error_code == "EVICTION_NOT_FOUND":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": error_code, "message": "Eviction request not found"}
        )
    elif error_code == "ALREADY_EXECUTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "ALREADY_PROCESSED",
                "message": "This eviction request has already been executed"
            }
        )
    elif error_code == "NEEDS_MANUAL_REVIEW":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "NEEDS_MANUAL_REVIEW",
                "message": "This eviction requires manual review before execution"
            }
        )
    elif error_code == "INVALID_STATUS":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_STATUS",
                "message": "Operation not allowed in current status",
                "details": {"allowed_statuses": ["pending", "approved"]}
            }
        )

    return db_eviction


@app.post("/evictions/{eviction_id}/cancel", response_model=schemas.EvictionRequest)
def cancel_eviction(eviction_id: str, db: Session = Depends(get_db)):
    db_eviction, error_code = crud.cancel_eviction(db, eviction_request_id=eviction_id)

    if error_code == "EVICTION_NOT_FOUND":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": error_code, "message": "Eviction request not found"}
        )
    elif error_code == "INVALID_STATUS":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": "INVALID_STATUS",
                "message": "Operation not allowed in current status",
                "details": {"allowed_statuses": ["pending", "approved", "needs_review"]}
            }
        )

    return db_eviction


@app.get("/evictions/candidates/", response_model=List[schemas.EvictionCandidate])
def get_eviction_candidates(
    target_free_mb: Optional[float] = None,
    min_days_since_access: int = 7,
    max_impact_score: float = 0.5,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    target_free_bytes = int(target_free_mb * 1024 * 1024) if target_free_mb else None
    candidates = crud.get_eviction_candidates(
        db,
        target_free_bytes=target_free_bytes,
        min_days_since_access=min_days_since_access,
        max_impact_score=max_impact_score,
        limit=limit
    )
    return candidates


@app.post("/evictions/bulk/", response_model=schemas.BulkEvictionResult)
def bulk_create_evictions(bulk_request: schemas.BulkEvictionRequest, db: Session = Depends(get_db)):
    results = []
    success_count = 0
    failed_count = 0

    for cache_entry_id in bulk_request.cache_entry_ids:
        eviction_req = schemas.EvictionRequestCreate(
            cache_entry_id=cache_entry_id,
            requester=bulk_request.requester,
            reason=bulk_request.reason
        )
        db_eviction, error_code = crud.create_eviction_request(db, eviction_request=eviction_req)

        if db_eviction:
            success_count += 1
            results.append({
                "cache_entry_id": cache_entry_id,
                "status": "success",
                "eviction_id": db_eviction.id,
                "impact_score": db_eviction.impact_score
            })
        else:
            failed_count += 1
            results.append({
                "cache_entry_id": cache_entry_id,
                "status": "failed",
                "error_code": error_code
            })

    return schemas.BulkEvictionResult(
        success_count=success_count,
        failed_count=failed_count,
        results=results
    )


@app.post("/reports/evictions/", response_model=schemas.EvictionReport, status_code=status.HTTP_201_CREATED)
def create_eviction_report(eviction_ids: List[str], generated_by: Optional[str] = None, db: Session = Depends(get_db)):
    if not eviction_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error_code": "MISSING_FIELD", "message": "eviction_ids is required"}
        )
    return crud.create_eviction_report(db, eviction_ids=eviction_ids, generated_by=generated_by)
