from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import ApprovalStatus
from app.schemas import (
    ApprovalBatch,
    ApprovalBatchCreate,
    ApprovalBatchUpdate,
    PermissionDeclaration,
    BatchApprovalRequest,
    StatusChangeRequest,
)
from app.services import ApprovalService

router = APIRouter(prefix="/approvals", tags=["approvals"])


@router.post("/", response_model=ApprovalBatch)
def create_batch(batch: ApprovalBatchCreate, db: Session = Depends(get_db)):
    return ApprovalService.create_batch(db, batch)


@router.get("/", response_model=List[ApprovalBatch])
def get_batches(
    status: Optional[ApprovalStatus] = None, db: Session = Depends(get_db)
):
    return ApprovalService.get_all_batches(db, status)


@router.get("/{batch_id}", response_model=ApprovalBatch)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = ApprovalService.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.put("/{batch_id}", response_model=ApprovalBatch)
def update_batch(
    batch_id: int, batch_update: ApprovalBatchUpdate, db: Session = Depends(get_db)
):
    batch = ApprovalService.update_batch(db, batch_id, batch_update)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.post("/approve", response_model=ApprovalBatch)
def approve_batch(request: BatchApprovalRequest, db: Session = Depends(get_db)):
    batch = ApprovalService.approve_batch(
        db, request.batch_number, request.approver, request.notes
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.post("/{batch_id}/reject", response_model=ApprovalBatch)
def reject_batch(
    batch_id: int, request: StatusChangeRequest, db: Session = Depends(get_db)
):
    batch = ApprovalService.reject_batch(
        db, batch_id, request.operator, request.notes
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.post("/{batch_id}/revoke", response_model=ApprovalBatch)
def revoke_batch(
    batch_id: int, request: StatusChangeRequest, db: Session = Depends(get_db)
):
    batch = ApprovalService.revoke_batch(
        db, batch_id, request.operator, request.notes
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.post("/{batch_id}/close", response_model=ApprovalBatch)
def close_batch(
    batch_id: int, request: StatusChangeRequest, db: Session = Depends(get_db)
):
    batch = ApprovalService.close_batch(
        db, batch_id, request.operator, request.notes
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.post("/{batch_id}/declarations/{declaration_id}", response_model=PermissionDeclaration)
def add_declaration_to_batch(
    batch_id: int, declaration_id: int, db: Session = Depends(get_db)
):
    declaration = ApprovalService.add_declaration_to_batch(db, batch_id, declaration_id)
    if not declaration:
        raise HTTPException(status_code=404, detail="Batch or declaration not found")
    return declaration


@router.get("/{batch_id}/declarations", response_model=List[PermissionDeclaration])
def get_batch_declarations(batch_id: int, db: Session = Depends(get_db)):
    return ApprovalService.get_batch_declarations(db, batch_id)
