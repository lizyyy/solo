from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List

from app.models.database import get_db
from app.schemas.address import (
    AddressCreate, AddressUpdate, AddressResponse, AddressListResponse,
    AddressDetailResponse, BatchCompareRequest, ManualCorrectionRequest,
    ReviewCreate, ReviewResponse, ExportRequest, RecalculateRequest
)
from app.services import address_service, export_service

router = APIRouter(prefix="/api/addresses", tags=["addresses"])


@router.post("", response_model=AddressResponse)
def create_address(address: AddressCreate, db: Session = Depends(get_db)):
    return address_service.create_address_record(db, address)


@router.get("", response_model=AddressListResponse)
def list_addresses(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    is_failed: Optional[bool] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    total, records = address_service.get_address_records(db, skip, limit, status, is_failed, search)
    return {"total": total, "items": records}


@router.get("/{record_id}", response_model=AddressDetailResponse)
def get_address(record_id: int, db: Session = Depends(get_db)):
    record = address_service.get_address_record(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="地址记录不存在")

    operations = address_service.get_operation_logs(db, record_id)
    reviews = address_service.get_reviews(db, record_id)

    return {
        **{c.name: getattr(record, c.name) for c in record.__table__.columns},
        "operations": operations,
        "reviews": reviews
    }


@router.put("/{record_id}", response_model=AddressResponse)
def update_address(record_id: int, address_update: AddressUpdate, db: Session = Depends(get_db)):
    updated = address_service.update_address_record(db, record_id, address_update)
    if not updated:
        raise HTTPException(status_code=404, detail="地址记录不存在")
    return updated


@router.delete("/{record_id}")
def delete_address(record_id: int, db: Session = Depends(get_db)):
    success = address_service.delete_address_record(db, record_id)
    if not success:
        raise HTTPException(status_code=404, detail="地址记录不存在")
    return {"message": "删除成功"}


@router.post("/{record_id}/correction", response_model=AddressResponse)
def manual_correction(record_id: int, request: ManualCorrectionRequest, db: Session = Depends(get_db)):
    updated = address_service.manual_correction(db, record_id, request)
    if not updated:
        raise HTTPException(status_code=404, detail="地址记录不存在")
    return updated


@router.post("/{record_id}/review", response_model=ReviewResponse)
def review(record_id: int, review_data: ReviewCreate, db: Session = Depends(get_db)):
    review_record = address_service.review_record(db, record_id, review_data)
    if not review_record:
        raise HTTPException(status_code=404, detail="地址记录不存在")
    return review_record


@router.post("/compare")
def batch_compare(request: BatchCompareRequest, db: Session = Depends(get_db)):
    results = address_service.batch_compare(db, request.record_ids)
    return {"results": results}


@router.post("/export")
def export_data(export_request: ExportRequest, db: Session = Depends(get_db)):
    output, format = export_service.export_records(
        db,
        export_request.record_ids,
        export_request.status,
        export_request.is_failed,
        export_request.format
    )

    media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if format == "xlsx" else "text/csv"
    filename = f"address_records.{format}"

    return StreamingResponse(
        output,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/recalculate")
def recalculate_by_version(request: RecalculateRequest, db: Session = Depends(get_db)):
    result = address_service.recalculate_by_geocoding_version(db, "v1", request.geocoding_version)
    return result
