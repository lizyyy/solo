from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json

from app.database import get_db
from app import schemas, models
from app.services.replay_service import ReplayService
from app.services.diff_service import DiffService, ToleranceService
from app.services.confirmation_service import ConfirmationService, ReleaseService
from app.services.export_service import ExportService

router = APIRouter(prefix="/api/v1", tags=["verification"])


@router.post("/gray-versions", response_model=schemas.GrayVersion)
def create_gray_version(
    request: schemas.GrayVersionBase,
    db: Session = Depends(get_db)
):
    existing = db.query(models.GrayVersion).filter(
        models.GrayVersion.version == request.version
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Gray version {request.version} already exists"
        )

    db_gray_version = models.GrayVersion(
        version=request.version,
        description=request.description,
        target_url=request.target_url,
        base_url=request.base_url,
        created_by=request.created_by,
        status=models.VerificationStatus.PENDING
    )
    db.add(db_gray_version)
    db.commit()
    db.refresh(db_gray_version)

    timeline = models.Timeline(
        gray_version_id=db_gray_version.id,
        action="version_created",
        actor=request.created_by,
        details={"version": request.version}
    )
    db.add(timeline)
    db.commit()

    return db_gray_version


@router.get("/gray-versions", response_model=List[schemas.GrayVersion])
def list_gray_versions(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(models.GrayVersion)
    if status:
        query = query.filter(models.GrayVersion.status == status)
    return query.order_by(models.GrayVersion.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/gray-versions/{version}", response_model=schemas.GrayVersion)
def get_gray_version(version: str, db: Session = Depends(get_db)):
    gray_version = db.query(models.GrayVersion).filter(
        models.GrayVersion.version == version
    ).first()
    if not gray_version:
        raise HTTPException(status_code=404, detail="Gray version not found")
    return gray_version


@router.post("/gray-versions/{version}/requests", response_model=List[schemas.HistoryRequest])
def add_requests(
    version: str,
    requests: List[schemas.HistoryRequestBase],
    db: Session = Depends(get_db)
):
    gray_version = db.query(models.GrayVersion).filter(
        models.GrayVersion.version == version
    ).first()
    if not gray_version:
        raise HTTPException(status_code=404, detail="Gray version not found")

    existing_request_ids = {
        r.request_id for r in db.query(models.HistoryRequest).filter(
            models.HistoryRequest.gray_version_id == gray_version.id
        ).all()
    }

    added_count = 0
    for req in requests:
        if req.request_id in existing_request_ids:
            continue
        db_request = models.HistoryRequest(
            gray_version_id=gray_version.id,
            request_id=req.request_id,
            method=req.method,
            path=req.path,
            headers=req.headers,
            query_params=req.query_params,
            request_body=req.request_body,
            base_response=req.base_response,
            base_status_code=req.base_status_code,
            base_response_time=req.base_response_time
        )
        db.add(db_request)
        added_count += 1
    db.commit()

    timeline = models.Timeline(
        gray_version_id=gray_version.id,
        action="requests_added",
        actor="api",
        details={"added_count": added_count}
    )
    db.add(timeline)
    db.commit()

    return db.query(models.HistoryRequest).filter(
        models.HistoryRequest.gray_version_id == gray_version.id
    ).order_by(models.HistoryRequest.created_at.desc()).limit(added_count).all()


@router.get("/gray-versions/{version}/requests", response_model=List[schemas.HistoryRequest])
def list_requests(
    version: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    gray_version = db.query(models.GrayVersion).filter(
        models.GrayVersion.version == version
    ).first()
    if not gray_version:
        raise HTTPException(status_code=404, detail="Gray version not found")

    return db.query(models.HistoryRequest).filter(
        models.HistoryRequest.gray_version_id == gray_version.id
    ).order_by(models.HistoryRequest.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/gray-versions/{version}/replay")
async def start_replay(
    version: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    gray_version = db.query(models.GrayVersion).filter(
        models.GrayVersion.version == version
    ).first()
    if not gray_version:
        raise HTTPException(status_code=404, detail="Gray version not found")

    if gray_version.status == models.VerificationStatus.REPLAYING:
        raise HTTPException(
            status_code=409,
            detail="Replay already in progress"
        )

    if gray_version.status == models.VerificationStatus.RELEASED:
        raise HTTPException(
            status_code=409,
            detail="Version already released"
        )

    request_count = db.query(models.HistoryRequest).filter(
        models.HistoryRequest.gray_version_id == gray_version.id
    ).count()
    
    if request_count == 0:
        raise HTTPException(
            status_code=400,
            detail="No requests found for this version, add requests first"
        )

    replay_service = ReplayService(db)
    
    async def run_replay():
        result = await replay_service.replay_all_requests(gray_version)
        if "error" not in result:
            diff_service = DiffService(db)
            diff_service.calculate_all_diffs(gray_version)
            tolerance_service = ToleranceService(db)
            tolerance_service.apply_tolerance_rules(gray_version)

    background_tasks.add_task(run_replay)

    return {
        "status": "started",
        "version": version,
        "request_count": request_count,
        "message": "Replay started in background"
    }


@router.post("/gray-versions/{version}/confirmers")
def add_confirmers(
    version: str,
    confirmers: List[schemas.ConfirmerBase],
    db: Session = Depends(get_db)
):
    gray_version = db.query(models.GrayVersion).filter(
        models.GrayVersion.version == version
    ).first()
    if not gray_version:
        raise HTTPException(status_code=404, detail="Gray version not found")

    from app.schemas import model_to_dict
    confirmation_service = ConfirmationService(db)
    new_confirmers = confirmation_service.add_confirmers(
        gray_version.id,
        [model_to_dict(c) for c in confirmers]
    )

    return new_confirmers


@router.post("/gray-versions/{version}/confirm")
def confirm_version(
    version: str,
    confirmation: schemas.ConfirmerConfirm,
    db: Session = Depends(get_db)
):
    gray_version = db.query(models.GrayVersion).filter(
        models.GrayVersion.version == version
    ).first()
    if not gray_version:
        raise HTTPException(status_code=404, detail="Gray version not found")

    confirmation_service = ConfirmationService(db)
    try:
        result = confirmation_service.confirm(
            gray_version.id,
            confirmation.user_id,
            confirmation.confirmed,
            confirmation.comment
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result


@router.get("/gray-versions/{version}/confirmation-status")
def get_confirmation_status(version: str, db: Session = Depends(get_db)):
    gray_version = db.query(models.GrayVersion).filter(
        models.GrayVersion.version == version
    ).first()
    if not gray_version:
        raise HTTPException(status_code=404, detail="Gray version not found")

    confirmation_service = ConfirmationService(db)
    return confirmation_service.get_confirmation_status(gray_version.id)


@router.get("/gray-versions/{version}/diffs", response_model=List[schemas.ResponseDiff])
def list_diffs(
    version: str,
    level: Optional[str] = None,
    only_untolerated: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    gray_version = db.query(models.GrayVersion).filter(
        models.GrayVersion.version == version
    ).first()
    if not gray_version:
        raise HTTPException(status_code=404, detail="Gray version not found")

    query = db.query(models.ResponseDiff).join(models.HistoryRequest).filter(
        models.HistoryRequest.gray_version_id == gray_version.id
    )

    if level:
        query = query.filter(models.ResponseDiff.level == level)
    if only_untolerated:
        query = query.filter(models.ResponseDiff.is_tolerated == False)

    return query.offset(skip).limit(limit).all()


@router.post("/tolerance-rules", response_model=schemas.ToleranceRule)
def create_tolerance_rule(
    rule: schemas.ToleranceRuleBase,
    db: Session = Depends(get_db)
):
    db_rule = models.ToleranceRule(
        name=rule.name,
        description=rule.description,
        path_pattern=rule.path_pattern,
        diff_type=rule.diff_type,
        tolerance_type=rule.tolerance_type,
        tolerance_value=rule.tolerance_value,
        is_active=rule.is_active,
        created_by=rule.created_by
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@router.get("/tolerance-rules", response_model=List[schemas.ToleranceRule])
def list_tolerance_rules(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.ToleranceRule)
    if is_active is not None:
        query = query.filter(models.ToleranceRule.is_active == is_active)
    return query.all()


@router.post("/gray-versions/{version}/release")
def release_version(
    version: str,
    request: dict,
    db: Session = Depends(get_db)
):
    gray_version = db.query(models.GrayVersion).filter(
        models.GrayVersion.version == version
    ).first()
    if not gray_version:
        raise HTTPException(status_code=404, detail="Gray version not found")

    release_service = ReleaseService(db)
    try:
        conclusion = release_service.create_release_conclusion(
            gray_version.id,
            request.get("conclusion_type", "release"),
            request.get("summary", ""),
            request.get("released_by", "system")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return conclusion


@router.get("/gray-versions/{version}/verification-result")
def get_verification_result(version: str, db: Session = Depends(get_db)):
    gray_version = db.query(models.GrayVersion).filter(
        models.GrayVersion.version == version
    ).first()
    if not gray_version:
        raise HTTPException(status_code=404, detail="Gray version not found")

    requests = db.query(models.HistoryRequest).filter(
        models.HistoryRequest.gray_version_id == gray_version.id
    ).all()

    diffs = db.query(models.ResponseDiff).join(models.HistoryRequest).filter(
        models.HistoryRequest.gray_version_id == gray_version.id
    ).all()

    replayed_count = sum(1 for r in requests if r.gray_response is not None)
    critical_diffs = sum(1 for d in diffs if d.level == models.DiffLevel.CRITICAL)
    error_diffs = sum(1 for d in diffs if d.level == models.DiffLevel.ERROR)
    warning_diffs = sum(1 for d in diffs if d.level == models.DiffLevel.WARNING)
    tolerated_diffs = sum(1 for d in diffs if d.is_tolerated)

    return {
        "gray_version": gray_version,
        "total_requests": len(requests),
        "replayed_requests": replayed_count,
        "total_diffs": len(diffs),
        "critical_diffs": critical_diffs,
        "error_diffs": error_diffs,
        "warning_diffs": warning_diffs,
        "tolerated_diffs": tolerated_diffs,
        "status": gray_version.status
    }


@router.post("/export/json")
def export_json(
    export_request: schemas.ExportRequest,
    db: Session = Depends(get_db)
):
    export_service = ExportService(db)
    result = export_service.export_verification_summary(
        version=export_request.version,
        start_date=export_request.start_date,
        end_date=export_request.end_date,
        include_diffs=export_request.include_diffs,
        include_timeline=export_request.include_timeline
    )
    return result


@router.post("/export/excel")
def export_excel(
    export_request: schemas.ExportRequest,
    db: Session = Depends(get_db)
):
    export_service = ExportService(db)
    excel_data = export_service.export_to_excel(
        version=export_request.version,
        start_date=export_request.start_date,
        end_date=export_request.end_date
    )

    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=gray_verification_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        }
    )


@router.get("/gray-versions/{version}/timeline", response_model=List[schemas.Timeline])
def get_timeline(
    version: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    gray_version = db.query(models.GrayVersion).filter(
        models.GrayVersion.version == version
    ).first()
    if not gray_version:
        raise HTTPException(status_code=404, detail="Gray version not found")

    return db.query(models.Timeline).filter(
        models.Timeline.gray_version_id == gray_version.id
    ).order_by(models.Timeline.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/verification-jobs")
async def create_verification_job(
    job: schemas.VerificationJobCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    existing = db.query(models.GrayVersion).filter(
        models.GrayVersion.version == job.version
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Gray version {job.version} already exists"
        )

    db_gray_version = models.GrayVersion(
        version=job.version,
        description=job.description,
        target_url=job.target_url,
        base_url=job.base_url,
        created_by=job.created_by,
        status=models.VerificationStatus.PENDING
    )
    db.add(db_gray_version)
    db.commit()
    db.refresh(db_gray_version)

    db_requests = []
    for req in job.requests:
        db_request = models.HistoryRequest(
            gray_version_id=db_gray_version.id,
            request_id=req.request_id,
            method=req.method,
            path=req.path,
            headers=req.headers,
            query_params=req.query_params,
            request_body=req.request_body,
            base_response=req.base_response,
            base_status_code=req.base_status_code,
            base_response_time=req.base_response_time
        )
        db_requests.append(db_request)
    db.bulk_save_objects(db_requests)
    db.commit()

    from app.schemas import model_to_dict
    confirmation_service = ConfirmationService(db)
    confirmation_service.add_confirmers(
        db_gray_version.id,
        [model_to_dict(c) for c in job.confirmers]
    )

    async def run_verification():
        replay_service = ReplayService(db)
        await replay_service.replay_all_requests(db_gray_version)
        
        diff_service = DiffService(db)
        diff_service.calculate_all_diffs(db_gray_version)
        
        tolerance_service = ToleranceService(db)
        tolerance_service.apply_tolerance_rules(db_gray_version)

    background_tasks.add_task(run_verification)

    timeline = models.Timeline(
        gray_version_id=db_gray_version.id,
        action="verification_job_created",
        actor=job.created_by,
        details={"version": job.version, "requests_count": len(job.requests)}
    )
    db.add(timeline)
    db.commit()

    return {
        "status": "created",
        "version": job.version,
        "requests_count": len(job.requests),
        "message": "Verification job created, replay started in background"
    }
