from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import pandas as pd
from io import BytesIO

from . import models, schemas
from .models import EndpointStatus


def get_page_module(db: Session, page_module_id: int):
    return db.query(models.PageModule).filter(models.PageModule.id == page_module_id).first()


def get_page_modules(db: Session, skip: int = 0, limit: int = 100, name: str = None, status: str = None):
    query = db.query(models.PageModule)
    if name:
        query = query.filter(models.PageModule.name.contains(name))
    if status:
        query = query.filter(models.PageModule.status == status)
    return query.offset(skip).limit(limit).all()


def create_page_module(db: Session, page_module: schemas.PageModuleCreate, created_by: str = None):
    db_page_module = models.PageModule(
        **page_module.model_dump(),
        created_by=created_by
    )
    db.add(db_page_module)
    db.commit()
    db.refresh(db_page_module)
    return db_page_module


def update_page_module(db: Session, page_module_id: int, page_module: schemas.PageModuleUpdate):
    db_page_module = get_page_module(db, page_module_id)
    if db_page_module:
        update_data = page_module.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_page_module, key, value)
        db.commit()
        db.refresh(db_page_module)
    return db_page_module


def delete_page_module(db: Session, page_module_id: int):
    db_page_module = get_page_module(db, page_module_id)
    if db_page_module:
        db.delete(db_page_module)
        db.commit()
    return db_page_module


def get_upstream_api(db: Session, upstream_api_id: int):
    return db.query(models.UpstreamApi).filter(models.UpstreamApi.id == upstream_api_id).first()


def get_upstream_apis(db: Session, skip: int = 0, limit: int = 100, name: str = None, base_url: str = None):
    query = db.query(models.UpstreamApi)
    if name:
        query = query.filter(models.UpstreamApi.name.contains(name))
    if base_url:
        query = query.filter(models.UpstreamApi.base_url.contains(base_url))
    return query.offset(skip).limit(limit).all()


def create_upstream_api(db: Session, upstream_api: schemas.UpstreamApiCreate):
    db_upstream_api = models.UpstreamApi(**upstream_api.model_dump())
    db.add(db_upstream_api)
    db.commit()
    db.refresh(db_upstream_api)
    return db_upstream_api


def update_upstream_api(db: Session, upstream_api_id: int, upstream_api: schemas.UpstreamApiUpdate):
    db_upstream_api = get_upstream_api(db, upstream_api_id)
    if db_upstream_api:
        update_data = upstream_api.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_upstream_api, key, value)
        db.commit()
        db.refresh(db_upstream_api)
    return db_upstream_api


def delete_upstream_api(db: Session, upstream_api_id: int):
    db_upstream_api = get_upstream_api(db, upstream_api_id)
    if db_upstream_api:
        db.delete(db_upstream_api)
        db.commit()
    return db_upstream_api


def get_bff_endpoint(db: Session, endpoint_id: int):
    return db.query(models.BffEndpoint).filter(models.BffEndpoint.id == endpoint_id).first()


def get_bff_endpoints(db: Session, skip: int = 0, limit: int = 100, name: str = None, path: str = None,
                      status: str = None, page_module_id: int = None):
    query = db.query(models.BffEndpoint)
    if name:
        query = query.filter(models.BffEndpoint.name.contains(name))
    if path:
        query = query.filter(models.BffEndpoint.path.contains(path))
    if status:
        query = query.filter(models.BffEndpoint.status == status)
    if page_module_id:
        query = query.filter(models.BffEndpoint.page_module_id == page_module_id)
    return query.offset(skip).limit(limit).all()


def create_bff_endpoint(db: Session, endpoint: schemas.BffEndpointCreate, created_by: str = None):
    endpoint_data = endpoint.model_dump(exclude={"upstreams", "fields"})
    db_endpoint = models.BffEndpoint(**endpoint_data, created_by=created_by)
    db.add(db_endpoint)
    db.commit()
    db.refresh(db_endpoint)

    if endpoint.upstreams:
        for upstream in endpoint.upstreams:
            db_upstream = models.EndpointUpstream(
                endpoint_id=db_endpoint.id,
                **upstream.model_dump()
            )
            db.add(db_upstream)

    if endpoint.fields:
        for field in endpoint.fields:
            db_field = models.AggregateField(
                endpoint_id=db_endpoint.id,
                **field.model_dump()
            )
            db.add(db_field)

    db.commit()
    db.refresh(db_endpoint)
    return db_endpoint


def update_bff_endpoint(db: Session, endpoint_id: int, endpoint: schemas.BffEndpointUpdate):
    db_endpoint = get_bff_endpoint(db, endpoint_id)
    if db_endpoint:
        update_data = endpoint.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_endpoint, key, value)
        db.commit()
        db.refresh(db_endpoint)
    return db_endpoint


def delete_bff_endpoint(db: Session, endpoint_id: int):
    db_endpoint = get_bff_endpoint(db, endpoint_id)
    if db_endpoint:
        db.delete(db_endpoint)
        db.commit()
    return db_endpoint


def transition_endpoint_status(db: Session, endpoint_id: int, new_status: EndpointStatus, reason: str = None):
    db_endpoint = get_bff_endpoint(db, endpoint_id)
    if db_endpoint:
        valid_transitions = {
            EndpointStatus.DRAFT: [EndpointStatus.ACTIVE],
            EndpointStatus.ACTIVE: [EndpointStatus.DEGRADED, EndpointStatus.DISABLED, EndpointStatus.DRAFT],
            EndpointStatus.DEGRADED: [EndpointStatus.ACTIVE, EndpointStatus.DISABLED],
            EndpointStatus.DISABLED: [EndpointStatus.ACTIVE, EndpointStatus.DRAFT],
            EndpointStatus.ERROR: [EndpointStatus.DRAFT, EndpointStatus.DISABLED]
        }

        if new_status not in valid_transitions.get(db_endpoint.status, []):
            raise ValueError(f"Invalid status transition from {db_endpoint.status} to {new_status}")

        db_endpoint.status = new_status
        db.commit()
        db.refresh(db_endpoint)
    return db_endpoint


def get_call_history(db: Session, history_id: int):
    return db.query(models.CallHistory).filter(models.CallHistory.id == history_id).first()


def get_call_histories(db: Session, endpoint_id: int = None, request_id: str = None,
                       skip: int = 0, limit: int = 100, error_only: bool = False,
                       start_date: datetime = None, end_date: datetime = None):
    query = db.query(models.CallHistory)
    if endpoint_id:
        query = query.filter(models.CallHistory.endpoint_id == endpoint_id)
    if request_id:
        query = query.filter(models.CallHistory.request_id == request_id)
    if error_only:
        query = query.filter(or_(
            models.CallHistory.error_message.isnot(None),
            models.CallHistory.response_status >= 400
        ))
    if start_date:
        query = query.filter(models.CallHistory.created_at >= start_date)
    if end_date:
        query = query.filter(models.CallHistory.created_at <= end_date)
    return query.order_by(models.CallHistory.created_at.desc()).offset(skip).limit(limit).all()


def export_call_history(db: Session, endpoint_id: int = None, start_date: datetime = None,
                        end_date: datetime = None, format: str = "xlsx"):
    histories = get_call_histories(db, endpoint_id=endpoint_id, start_date=start_date,
                                   end_date=end_date, limit=10000)

    data = []
    for h in histories:
        data.append({
            "id": h.id,
            "endpoint_id": h.endpoint_id,
            "request_id": h.request_id,
            "request_method": h.request_method,
            "request_path": h.request_path,
            "response_status": h.response_status,
            "response_time_ms": round(h.response_time_ms, 2),
            "cache_hit": h.cache_hit,
            "degraded": h.degraded,
            "error_message": h.error_message,
            "created_at": h.created_at.isoformat() if h.created_at else None
        })

    df = pd.DataFrame(data)

    if format == "xlsx":
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="CallHistory")
        output.seek(0)
        return output.getvalue()
    elif format == "csv":
        return df.to_csv(index=False).encode("utf-8")
    else:
        return df.to_json(orient="records").encode("utf-8")


def batch_import_endpoints(db: Session, endpoints_data: List[Dict[str, Any]], created_by: str = None):
    success_count = 0
    failed_count = 0
    errors = []
    imported_ids = []

    for idx, data in enumerate(endpoints_data):
        try:
            endpoint = schemas.BffEndpointCreate(**data)
            db_endpoint = create_bff_endpoint(db, endpoint, created_by)
            imported_ids.append(db_endpoint.id)
            success_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(f"Row {idx + 1}: {str(e)}")

    return {
        "success_count": success_count,
        "failed_count": failed_count,
        "errors": errors,
        "imported_ids": imported_ids
    }


def get_endpoint_statistics(db: Session, endpoint_id: int, days: int = 7):
    start_date = datetime.now() - timedelta(days=days)
    histories = get_call_histories(db, endpoint_id=endpoint_id, start_date=start_date, limit=10000)

    total_calls = len(histories)
    error_calls = sum(1 for h in histories if h.error_message or (h.response_status and h.response_status >= 400))
    cache_hits = sum(1 for h in histories if h.cache_hit)
    degraded_calls = sum(1 for h in histories if h.degraded)
    avg_response_time = sum(h.response_time_ms for h in histories if h.response_time_ms) / len(
        histories) if histories else 0

    return {
        "total_calls": total_calls,
        "success_rate": round((total_calls - error_calls) / total_calls * 100, 2) if total_calls > 0 else 0,
        "error_rate": round(error_calls / total_calls * 100, 2) if total_calls > 0 else 0,
        "cache_hit_rate": round(cache_hits / total_calls * 100, 2) if total_calls > 0 else 0,
        "degraded_rate": round(degraded_calls / total_calls * 100, 2) if total_calls > 0 else 0,
        "avg_response_time_ms": round(avg_response_time, 2),
        "period_days": days
    }
