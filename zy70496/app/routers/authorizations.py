from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from app.models import get_db
from app.schemas import (
    DownloadAuthorizationCreate,
    DownloadAuthorization,
    AuthorizationQueryFilter,
)
from app.services.evidence_service import AuthorizationService

router = APIRouter(prefix="/authorizations", tags=["authorizations"])


@router.post("/", response_model=DownloadAuthorization)
def create_authorization(
    auth_data: DownloadAuthorizationCreate,
    db: Session = Depends(get_db),
):
    return AuthorizationService.create_authorization(db, auth_data)


@router.get("/", response_model=List[DownloadAuthorization])
def list_authorizations(
    batch_id: Optional[str] = None,
    authorized_to: Optional[str] = None,
    authorized_by: Optional[str] = None,
    is_used: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    filter_params = AuthorizationQueryFilter(
        batch_id=batch_id,
        authorized_to=authorized_to,
        authorized_by=authorized_by,
        is_used=is_used,
    )
    return AuthorizationService.list_authorizations(db, filter_params, skip, limit)


@router.get("/{auth_id}", response_model=DownloadAuthorization)
def get_authorization(auth_id: str, db: Session = Depends(get_db)):
    authorization = AuthorizationService.get_authorization(db, auth_id)
    if not authorization:
        raise HTTPException(status_code=404, detail="授权未找到")
    return authorization


@router.post("/{auth_id}/use", response_model=DownloadAuthorization)
def use_authorization(
    auth_id: str,
    used_by: str,
    db: Session = Depends(get_db),
):
    authorization = AuthorizationService.use_authorization(db, auth_id, used_by)
    if not authorization:
        raise HTTPException(status_code=400, detail="授权无效或已过期")
    return authorization
