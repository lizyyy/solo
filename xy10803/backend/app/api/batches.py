from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..api.deps import get_db
from ..schemas.seed_batch import SeedBatchSchema, SeedBatchCreate
from ..schemas.common import Response
from ..services.batch_service import BatchService

router = APIRouter(prefix="/batches", tags=["batches"])


@router.get("/", response_model=Response[List[SeedBatchSchema]])
def list_batches(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    sandbox_id: int = None,
    db: Session = Depends(get_db)
):
    batches = BatchService.list_batches(db, skip=skip, limit=limit, status=status, sandbox_id=sandbox_id)
    return Response(data=batches, message="Batches retrieved successfully")


@router.get("/{batch_id}", response_model=Response[SeedBatchSchema])
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = BatchService.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return Response(data=batch, message="Batch retrieved successfully")


@router.post("/", response_model=Response[SeedBatchSchema])
def create_batch(batch_create: SeedBatchCreate, db: Session = Depends(get_db)):
    batch = BatchService.create_batch(db, batch_create)
    return Response(data=batch, message="Batch created successfully", code=201)


@router.post("/{batch_id}/execute", response_model=Response[Dict[str, Any]])
def execute_batch(batch_id: int, db: Session = Depends(get_db)):
    success, message = BatchService.execute_batch(db, batch_id)
    batch = BatchService.get_batch(db, batch_id)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return Response(data={"batch_id": batch_id, "status": batch.status if batch else "unknown"}, message=message or "Batch executed successfully")


@router.get("/{batch_id}/report", response_model=Response[Dict[str, Any]])
def get_batch_report(batch_id: int, db: Session = Depends(get_db)):
    report = BatchService.get_batch_report(db, batch_id)
    if not report:
        raise HTTPException(status_code=404, detail="Batch not found")
    return Response(data=report, message="Batch report retrieved successfully")
