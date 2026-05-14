from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.approval import (
    ApprovalChainCreate,
    ApprovalChainResponse,
    ApprovalStepResponse,
    ApprovalStepUpdate,
)
from app.crud import approval as approval_crud
from app.crud import migration as migration_crud

router = APIRouter(prefix="/approval", tags=["审批链路"])

@router.get("/chain/{migration_id}", response_model=ApprovalChainResponse)
def get_approval_chain(migration_id: int, db: Session = Depends(get_db)):
    chain = approval_crud.get_approval_chain_by_migration(db, migration_id=migration_id)
    if chain is None:
        raise HTTPException(status_code=404, detail="审批链路不存在")
    return chain

@router.post("/chain/{migration_id}", response_model=ApprovalChainResponse)
def create_approval_chain(migration_id: int, chain_data: ApprovalChainCreate, db: Session = Depends(get_db)):
    migration = migration_crud.get_migration(db, migration_id=migration_id)
    if migration is None:
        raise HTTPException(status_code=404, detail="迁移脚本不存在")
    existing_chain = approval_crud.get_approval_chain_by_migration(db, migration_id=migration_id)
    if existing_chain:
        raise HTTPException(status_code=400, detail="审批链路已存在")
    return approval_crud.create_approval_chain(db, migration_id=migration_id, steps_data=chain_data.steps)

@router.post("/chain/{chain_id}/start", response_model=ApprovalChainResponse)
def start_approval_chain(chain_id: int, db: Session = Depends(get_db)):
    chain = approval_crud.get_approval_chain(db, chain_id=chain_id)
    if chain is None:
        raise HTTPException(status_code=404, detail="审批链路不存在")
    return approval_crud.start_approval_chain(db, chain_id=chain_id)

@router.post("/step/{step_id}/approve", response_model=ApprovalStepResponse)
def approve_step(step_id: int, approver: str, comment: str = None, db: Session = Depends(get_db)):
    step = approval_crud.approve_step(db, step_id=step_id, approver=approver, comment=comment)
    if step is None:
        raise HTTPException(status_code=404, detail="审批步骤不存在或无法审批")
    return step

@router.post("/step/{step_id}/reject", response_model=ApprovalStepResponse)
def reject_step(step_id: int, approver: str, comment: str = None, db: Session = Depends(get_db)):
    step = approval_crud.reject_step(db, step_id=step_id, approver=approver, comment=comment)
    if step is None:
        raise HTTPException(status_code=404, detail="审批步骤不存在或无法驳回")
    return step