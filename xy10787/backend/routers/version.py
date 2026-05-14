from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import VersionRelease
from schemas import VersionReleaseResponse, VersionReleaseCreate, BatchOperationResponse
from services.version_service import VersionService

router = APIRouter(prefix="/api/version", tags=["版本管理"])


@router.get("", response_model=List[VersionReleaseResponse])
def get_versions(
    skip: int = 0,
    limit: int = 100,
    language_pack_id: Optional[int] = None,
    is_published: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    return VersionService.get_versions(
        db, skip=skip, limit=limit, language_pack_id=language_pack_id, is_published=is_published
    )


@router.get("/{version_id}", response_model=VersionReleaseResponse)
def get_version(version_id: int, db: Session = Depends(get_db)):
    version = VersionService.get_version(db, version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@router.post("", response_model=VersionReleaseResponse)
def create_version(version: VersionReleaseCreate, db: Session = Depends(get_db)):
    return VersionService.create_version(db, version)


@router.post("/{version_id}/publish", response_model=VersionReleaseResponse)
def publish_version(
    version_id: int,
    x_operator: str = Header(default="system"),
    x_idempotency_key: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    version = VersionService.publish_version(
        db, version_id, x_operator, x_idempotency_key
    )
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version


@router.post("/{version_id}/regenerate-report", response_model=BatchOperationResponse)
def regenerate_report(version_id: int, db: Session = Depends(get_db)):
    report = VersionService.regenerate_coverage_report(db, version_id)
    if not report:
        raise HTTPException(status_code=404, detail="Version not found")
    return {
        "success": 1,
        "failed": 0,
        "total": 1,
        "errors": []
    }
