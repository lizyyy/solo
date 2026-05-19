from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import SessionLocal, engine
from app import models, crud, schemas
from app.models import JourneyStatus

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="合成旅程资产登记API",
    description="端到端巡检旅程资产管理 - 失败样本登记与资产管理",
    version="1.0.0"
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.exception_handler(crud.JourneyAssetError)
async def journey_asset_error_handler(request, exc: crud.JourneyAssetError):
    status_code = 400
    if exc.error_code == "NOT_FOUND":
        status_code = 404
    elif exc.error_code in ["INVALID_STATUS_TRANSITION", "DELETE_NOT_ALLOWED"]:
        status_code = 409
    elif exc.error_code in ["ALREADY_ARCHIVED"]:
        status_code = 410
    return JSONResponse(
        status_code=status_code,
        content={
            "error_code": exc.error_code,
            "message": exc.message,
            "details": exc.details
        }
    )


@app.post("/api/v1/journeys/", response_model=schemas.JourneyAssetResponse, status_code=201)
def create_journey(journey: schemas.JourneyAssetCreate, db: Session = Depends(get_db)):
    return crud.create_journey_asset(db=db, journey=journey)


@app.get("/api/v1/journeys/", response_model=List[schemas.JourneyAssetResponse])
def list_journeys(
    skip: int = 0,
    limit: int = 100,
    status: Optional[JourneyStatus] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.get_journey_assets(db=db, skip=skip, limit=limit, status=status, keyword=keyword)


@app.get("/api/v1/journeys/{journey_id}/", response_model=schemas.JourneyDetailResponse)
def get_journey(journey_id: int, db: Session = Depends(get_db)):
    return crud.get_journey_asset(db=db, journey_id=journey_id)


@app.put("/api/v1/journeys/{journey_id}/", response_model=schemas.JourneyAssetResponse)
def update_journey(journey_id: int, journey: schemas.JourneyAssetUpdate, db: Session = Depends(get_db)):
    return crud.update_journey_asset(db=db, journey_id=journey_id, journey=journey)


@app.delete("/api/v1/journeys/{journey_id}/", status_code=204)
def delete_journey(journey_id: int, db: Session = Depends(get_db)):
    crud.delete_journey_asset(db=db, journey_id=journey_id)
    return None


@app.post("/api/v1/journeys/{journey_id}/submit-review/", response_model=schemas.JourneyAssetResponse)
def submit_for_review(journey_id: int, db: Session = Depends(get_db)):
    return crud.submit_for_review(db=db, journey_id=journey_id)


@app.post("/api/v1/journeys/{journey_id}/register/", response_model=schemas.JourneyAssetResponse)
def register_journey(journey_id: int, reporter: Optional[str] = None, db: Session = Depends(get_db)):
    return crud.register_journey(db=db, journey_id=journey_id, reporter=reporter)


@app.post("/api/v1/journeys/{journey_id}/reject/", response_model=schemas.JourneyAssetResponse)
def reject_journey(
    journey_id: int,
    reason: str,
    reporter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return crud.reject_journey(db=db, journey_id=journey_id, reason=reason, reporter=reporter)


@app.post("/api/v1/journeys/{journey_id}/archive/", response_model=schemas.JourneyAssetResponse)
def archive_journey(journey_id: int, db: Session = Depends(get_db)):
    return crud.archive_journey(db=db, journey_id=journey_id)


@app.post("/api/v1/failure-samples/", response_model=schemas.FailureSampleResponse, status_code=201)
def create_failure_sample(sample: schemas.FailureSampleCreate, db: Session = Depends(get_db)):
    return crud.create_failure_sample(db=db, sample=sample)


@app.get("/api/v1/failure-samples/", response_model=List[schemas.FailureSampleResponse])
def list_failure_samples(
    journey_id: Optional[int] = None,
    archived: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.get_failure_samples(db=db, journey_id=journey_id, archived=archived, skip=skip, limit=limit)


@app.post("/api/v1/failure-samples/{sample_id}/archive/", response_model=schemas.FailureSampleResponse)
def archive_failure_sample(sample_id: int, db: Session = Depends(get_db)):
    return crud.archive_failure_sample(db=db, sample_id=sample_id)


@app.post("/api/v1/registration-reports/", response_model=schemas.RegistrationReportResponse, status_code=201)
def create_registration_report(report: schemas.RegistrationReportCreate, db: Session = Depends(get_db)):
    return crud.create_registration_report(db=db, report=report)


@app.get("/api/v1/registration-reports/", response_model=List[schemas.RegistrationReportResponse])
def list_registration_reports(
    journey_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return crud.get_registration_reports(db=db, journey_id=journey_id, skip=skip, limit=limit)


@app.get("/api/v1/health/")
def health_check():
    return {"status": "healthy", "service": "journey-asset-api"}