from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.schemas.schemas import (
    BatchCreate, BatchResponse, BatchListResponse,
    CodeBatchBind, CodeBatchUnbind, BindingResponse,
    InspectionReportCreate, InspectionReportResponse, ReportListResponse
)
from app.services import (
    create_batch, get_batches, get_batch_by_id,
    bind_codes_to_batch, unbind_codes_from_batch, get_batch_bindings,
    create_inspection_report, get_reports
)

router = APIRouter(prefix="/api/batches", tags=["批次管理"])


@router.post("", response_model=BatchResponse)
def api_create_batch(
    data: BatchCreate,
    db: Session = Depends(get_db)
):
    return create_batch(db, data)


@router.get("", response_model=BatchListResponse)
def api_list_batches(
    skip: int = 0,
    limit: int = 100,
    cooperative_id: Optional[str] = None,
    farmer_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    batches, total = get_batches(db, skip, limit, cooperative_id, farmer_id)
    return {"batches": batches, "total": total}


@router.get("/{batch_id}", response_model=BatchResponse)
def api_get_batch(
    batch_id: int,
    db: Session = Depends(get_db)
):
    batch = get_batch_by_id(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.post("/bind")
def api_bind_codes(
    data: CodeBatchBind,
    db: Session = Depends(get_db)
):
    bindings, invalid = bind_codes_to_batch(db, data.codes, data.batch_id)
    return {
        "bound_count": len(bindings),
        "invalid_count": len(invalid),
        "bindings": [{"id": b.id, "code_id": b.code_id} for b in bindings],
        "invalid_codes": invalid
    }


@router.post("/unbind")
def api_unbind_codes(
    data: CodeBatchUnbind,
    db: Session = Depends(get_db)
):
    unbound, invalid = unbind_codes_from_batch(db, data.codes)
    return {
        "unbound_count": len(unbound),
        "invalid_count": len(invalid),
        "unbound_codes": [{"id": b.id, "code_id": b.code_id} for b in unbound],
        "invalid_codes": invalid
    }


@router.get("/{batch_id}/bindings")
def api_get_batch_bindings(
    batch_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    bindings, total = get_batch_bindings(db, batch_id, skip, limit)
    return {
        "bindings": [
            {
                "id": b.id,
                "code_id": b.code_id,
                "batch_id": b.batch_id,
                "status": b.status,
                "bound_at": b.bound_at,
                "unbound_at": b.unbound_at
            }
            for b in bindings
        ],
        "total": total
    }


@router.post("/{batch_id}/reports", response_model=InspectionReportResponse)
def api_create_report_for_batch(
    batch_id: int,
    data: InspectionReportCreate,
    db: Session = Depends(get_db)
):
    data.batch_id = batch_id
    return create_inspection_report(db, data)
