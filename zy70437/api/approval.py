from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import (
    ApprovalRecord, ReplayResult, WarehouseHandover,
    ReplayStatus, ApprovalAction, Batch
)
from schemas import (
    ApprovalRecordCreate, ApprovalRecord as ApprovalRecordSchema,
    WarehouseHandoverCreate, WarehouseHandover as WarehouseHandoverSchema
)

router = APIRouter(prefix="/approvals", tags=["审批管理"])

@router.post("/warehouse-handovers", response_model=WarehouseHandoverSchema)
def create_warehouse_handover(
    handover_data: WarehouseHandoverCreate,
    db: Session = Depends(get_db)
):
    existing = db.query(WarehouseHandover).filter(
        WarehouseHandover.handover_number == handover_data.handover_number
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"交接单号 {handover_data.handover_number} 已存在")
    
    handover = WarehouseHandover(**handover_data.dict())
    db.add(handover)
    db.commit()
    db.refresh(handover)
    
    return handover

@router.get("/warehouse-handovers", response_model=List[WarehouseHandoverSchema])
def list_warehouse_handovers(
    responsibility_team: str = None,
    handed_by: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(WarehouseHandover)
    
    if responsibility_team:
        query = query.filter(WarehouseHandover.responsibility_team == responsibility_team)
    if handed_by:
        query = query.filter(WarehouseHandover.handed_by == handed_by)
    
    return query.order_by(WarehouseHandover.handed_at.desc()).offset(skip).limit(limit).all()

@router.get("/warehouse-handovers/{handover_id}", response_model=WarehouseHandoverSchema)
def get_warehouse_handover(handover_id: int, db: Session = Depends(get_db)):
    handover = db.query(WarehouseHandover).filter(WarehouseHandover.id == handover_id).first()
    if not handover:
        raise HTTPException(status_code=404, detail="仓库交接单不存在")
    return handover

@router.post("/", response_model=ApprovalRecordSchema)
def create_approval(
    approval_data: ApprovalRecordCreate,
    db: Session = Depends(get_db)
):
    replay_result = db.query(ReplayResult).filter(
        ReplayResult.id == approval_data.replay_result_id
    ).first()
    if not replay_result:
        raise HTTPException(status_code=404, detail="重放结果不存在")
    
    previous_status = replay_result.status
    
    if approval_data.action == ApprovalAction.APPROVE:
        new_status = ReplayStatus.APPROVED
    elif approval_data.action == ApprovalAction.REJECT:
        new_status = ReplayStatus.REJECTED
    else:
        new_status = previous_status
    
    if approval_data.warehouse_handover_id:
        handover = db.query(WarehouseHandover).filter(
            WarehouseHandover.id == approval_data.warehouse_handover_id
        ).first()
        if not handover:
            raise HTTPException(status_code=404, detail="仓库交接单不存在")
    
    approval = ApprovalRecord(
        **approval_data.dict(),
        batch_id=replay_result.batch_id,
        previous_status=previous_status,
        new_status=new_status
    )
    
    db.add(approval)
    
    replay_result.status = new_status
    
    db.commit()
    db.refresh(approval)
    db.refresh(replay_result)
    
    _update_batch_status(replay_result.batch_id, db)
    
    return approval

def _update_batch_status(batch_id: int, db: Session):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        return
    
    results = db.query(ReplayResult).filter(ReplayResult.batch_id == batch_id).all()
    
    success_count = 0
    approved_count = 0
    blocked_count = 0
    rejected_count = 0
    
    for r in results:
        if r.status == ReplayStatus.SUCCESS:
            success_count += 1
        elif r.status == ReplayStatus.APPROVED:
            approved_count += 1
        elif r.status == ReplayStatus.BLOCKED:
            blocked_count += 1
        elif r.status == ReplayStatus.REJECTED:
            rejected_count += 1
    
    batch.success_count = success_count + approved_count
    batch.blocked_count = blocked_count
    
    if blocked_count > 0 and (success_count + approved_count) > 0:
        batch.status = "partial_success"
    elif blocked_count > 0:
        batch.status = "approval_required"
    else:
        batch.status = "success"
    
    db.commit()

@router.get("/", response_model=List[ApprovalRecordSchema])
def list_approvals(
    batch_id: int = None,
    replay_result_id: int = None,
    responsibility_team: str = None,
    action: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ApprovalRecord)
    
    if batch_id:
        query = query.filter(ApprovalRecord.batch_id == batch_id)
    if replay_result_id:
        query = query.filter(ApprovalRecord.replay_result_id == replay_result_id)
    if responsibility_team:
        query = query.filter(ApprovalRecord.responsibility_team == responsibility_team)
    if action:
        query = query.filter(ApprovalRecord.action == action)
    
    return query.order_by(ApprovalRecord.approved_at.desc()).offset(skip).limit(limit).all()

@router.get("/{approval_id}", response_model=ApprovalRecordSchema)
def get_approval(approval_id: int, db: Session = Depends(get_db)):
    approval = db.query(ApprovalRecord).filter(ApprovalRecord.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="审批记录不存在")
    return approval

@router.get("/{approval_id}/handover-original")
def get_approval_handover_original(approval_id: int, db: Session = Depends(get_db)):
    approval = db.query(ApprovalRecord).filter(ApprovalRecord.id == approval_id).first()
    if not approval:
        raise HTTPException(status_code=404, detail="审批记录不存在")
    
    if not approval.warehouse_handover_id:
        raise HTTPException(status_code=404, detail="该审批未关联仓库交接单")
    
    handover = db.query(WarehouseHandover).filter(
        WarehouseHandover.id == approval.warehouse_handover_id
    ).first()
    
    return {
        "handover_number": handover.handover_number,
        "responsibility_team": handover.responsibility_team,
        "original_records": handover.original_records,
        "handover_note": handover.handover_note,
        "handed_by": handover.handed_by,
        "received_by": handover.received_by,
        "handed_at": handover.handed_at
    }
