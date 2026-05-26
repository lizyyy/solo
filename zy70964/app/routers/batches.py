from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import (
    BatchCreateRequest,
    BatchBrief,
    Message,
)
from app import services

router = APIRouter(prefix="/api/v1/batches", tags=["batches"])


@router.post("", response_model=BatchBrief)
def create_batch(req: BatchCreateRequest, db: Session = Depends(get_db)):
    try:
        batch = services.create_batch(db, req)
        db.commit()
        return batch
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=List[BatchBrief])
def list_batches(db: Session = Depends(get_db)):
    return services.list_batches(db)


@router.get("/{batch_id}", response_model=BatchBrief)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    b = services.get_batch(db, batch_id)
    if not b:
        raise HTTPException(status_code=404, detail="batch not found")
    return b


@router.post("/{batch_id}/import/csv", response_model=Message)
async def import_csv(batch_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    batch = services.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="batch not found")
    try:
        content = (await file.read()).decode("utf-8-sig")
        rows = services.parse_csv_rows(content)
        imported = services.import_qc_rows(db, batch, rows)
        db.commit()
        return Message(message=f"imported {imported} rows")
    except (ValueError, UnicodeDecodeError) as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{batch_id}/import/json", response_model=Message)
async def import_json(batch_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    batch = services.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="batch not found")
    try:
        content = (await file.read()).decode("utf-8")
        rows = services.parse_json_rows(content)
        imported = services.import_qc_rows(db, batch, rows)
        db.commit()
        return Message(message=f"imported {imported} rows")
    except (ValueError, UnicodeDecodeError) as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{batch_id}/import/appeal", response_model=Message)
async def import_appeal(batch_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    申诉单 CSV 需要包含列：item_id, appellant, content, evidence(optional)
    """
    batch = services.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="batch not found")
    try:
        content = (await file.read()).decode("utf-8-sig")
        rows = services.parse_csv_rows(content)
        from app.models import Appeal as AppealModel
        added = 0
        for row in rows:
            item_id = int(row.get("item_id"))
            ap = AppealModel(
                item_id=item_id,
                appellant=str(row.get("appellant", "")),
                content=str(row.get("content", "")),
                evidence={k: v for k, v in row.items() if k not in ("item_id", "appellant", "content")},
            )
            db.add(ap)
            added += 1
        db.commit()
        return Message(message=f"imported {added} appeals")
    except (ValueError, UnicodeDecodeError) as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
