from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
import io

from app.core.database import get_db
from app import schemas
from app.services import (
    list_records, get_record, process_record, return_record,
    list_logs, export_records_csv,
)

router = APIRouter(prefix="/records", tags=["记录"])


@router.get("", response_model=schemas.RecordListResp, summary="查询记录")
def api_list_records(
    batch_id: Optional[int] = None,
    unit_name: Optional[str] = None,
    contract_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0, limit: int = 100,
    db: Session = Depends(get_db),
):
    total, items = list_records(
        db, batch_id=batch_id, unit_name=unit_name,
        contract_id=contract_id, status=status, skip=skip, limit=limit,
    )
    return {"total": total, "items": items}


@router.get("/{record_id}", response_model=schemas.RecordResp, summary="记录详情")
def api_get_record(record_id: int, db: Session = Depends(get_db)):
    rec = get_record(db, record_id)
    if not rec:
        raise HTTPException(404, "记录不存在")
    return rec


@router.post("/{record_id}/process", response_model=schemas.RecordResp, summary="标记处理/放行")
def api_process_record(record_id: int, data: schemas.RecordProcess,
                       db: Session = Depends(get_db)):
    rec = process_record(db, record_id, data)
    if not rec:
        raise HTTPException(404, "记录不存在")
    return rec


@router.post("/{record_id}/return", response_model=schemas.RecordResp, summary="退回记录")
def api_return_record(record_id: int, data: schemas.RecordReturn,
                      db: Session = Depends(get_db)):
    rec = return_record(db, record_id, data)
    if not rec:
        raise HTTPException(404, "记录不存在")
    return rec


@router.get("/{record_id}/logs", response_model=schemas.AuditLogListResp, summary="记录溯源日志")
def api_record_logs(record_id: int, skip: int = 0, limit: int = 100,
                    db: Session = Depends(get_db)):
    total, items = list_logs(db, record_id=record_id, skip=skip, limit=limit)
    return {"total": total, "items": items}


@router.get("/export/csv", summary="按条件导出明细 CSV")
def api_export(
    batch_id: Optional[int] = Query(None),
    unit_name: Optional[str] = Query(None),
    contract_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    csv_content = export_records_csv(
        db, batch_id=batch_id, unit_name=unit_name,
        contract_id=contract_id, status=status,
    )
    buf = io.BytesIO(csv_content.encode("utf-8-sig"))
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=records.csv"},
    )
