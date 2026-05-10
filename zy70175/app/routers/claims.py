from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ClaimStatus
from app.schemas import (
    ClaimCreate,
    ClaimOut,
    ClaimApprove,
    ClaimReject,
    ReconciliationCreate,
    ReconciliationOut,
)
from app.services.claim_service import ClaimService
from app.services.reconciliation_service import ReconciliationService

router = APIRouter(prefix="/claims", tags=["认领/审批"])

claim_service = ClaimService()
recon_service = ReconciliationService()


@router.post("", response_model=ClaimOut, status_code=201)
def create_claim(data: ClaimCreate, db: Session = Depends(get_db)):
    return claim_service.create(db, data)


@router.get("", response_model=List[ClaimOut])
def list_claims(
    status: Optional[ClaimStatus] = Query(None),
    receipt_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    return claim_service.list(db, status=status, receipt_id=receipt_id)


@router.get("/{claim_id}", response_model=ClaimOut)
def get_claim(claim_id: int, db: Session = Depends(get_db)):
    return claim_service.get(db, claim_id)


@router.post("/{claim_id}/approve", response_model=ClaimOut)
def approve_claim(claim_id: int, data: ClaimApprove, db: Session = Depends(get_db)):
    return claim_service.approve(db, claim_id, data)


@router.post("/{claim_id}/reject", response_model=ClaimOut)
def reject_claim(claim_id: int, data: ClaimReject, db: Session = Depends(get_db)):
    return claim_service.reject(db, claim_id, data)


@router.post("/{claim_id}/reconcile", response_model=List[ReconciliationOut], status_code=201)
def reconcile_claim(
    claim_id: int,
    data: ReconciliationCreate,
    db: Session = Depends(get_db),
):
    data.claim_id = claim_id
    return recon_service.reconcile(db, data)


@router.get("/{claim_id}/reconciliations", response_model=List[ReconciliationOut])
def list_reconciliations(claim_id: int, db: Session = Depends(get_db)):
    return recon_service.list_by_claim(db, claim_id)
