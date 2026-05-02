from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import schemas, crud, services, models
from ..database import get_db

router = APIRouter(prefix="/api/samples", tags=["samples"])


@router.post("/register", response_model=schemas.Sample)
def register_sample(sample: schemas.SampleCreate, db: Session = Depends(get_db)):
    try:
        result, msg = services.SampleService.register_sample(db, sample)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scan-in")
def scan_in(request: schemas.ScanInRequest, db: Session = Depends(get_db)):
    try:
        sample, warnings = services.SampleService.scan_in(db, request)
        return {"sample": sample, "warnings": warnings}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/scan-out")
def scan_out(request: schemas.ScanOutRequest, db: Session = Depends(get_db)):
    try:
        sample, warnings = services.SampleService.scan_out(db, request)
        return {"sample": sample, "warnings": warnings}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[schemas.Sample])
def get_samples(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_samples(db, skip=skip, limit=limit)


@router.get("/{box_code}", response_model=schemas.Sample)
def get_sample_by_box_code(box_code: str, db: Session = Depends(get_db)):
    sample = crud.get_sample_by_box_code(db, box_code)
    if not sample:
        raise HTTPException(status_code=404, detail="留样不存在")
    return sample


@router.get("/{sample_id}/events", response_model=List[schemas.SampleEvent])
def get_sample_events(sample_id: int, db: Session = Depends(get_db)):
    return crud.get_sample_events_by_sample(db, sample_id)
