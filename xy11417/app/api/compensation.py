import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import RoleChecker
from app.core.config import UserRole, TaskStatus
from app.models import User, RepairTask, Compensation, ProcessLog, RepairOrder
from app.schemas import CompensationRequest

router = APIRouter()

@router.post("/tasks/{task_id}", 
             dependencies=[Depends(RoleChecker([UserRole.MANAGER]))])
def create_compensation(
    task_id: str,
    compensation_data: CompensationRequest,
    current_user: User = Depends(RoleChecker([UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    task = db.query(RepairTask).filter(RepairTask.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    compensation_id = f"COMP-{uuid.uuid4().hex[:10].upper()}"
    
    compensation = Compensation(
        compensation_id=compensation_id,
        task_id=task_id,
        amount=compensation_data.amount,
        reason=compensation_data.reason,
        compensation_type=compensation_data.compensation_type,
        status="pending",
        approved_by=current_user.id,
        approved_at=datetime.utcnow()
    )
    db.add(compensation)
    
    task.compensation_amount += compensation_data.amount
    task.compensation_reason = compensation_data.reason
    task.status = TaskStatus.COMPENSATED.value
    task.compensated_at = datetime.utcnow()
    task.compensated_by = current_user.id
    
    if task.order_id:
        order = db.query(RepairOrder).filter(
            RepairOrder.order_id == task.order_id
        ).first()
        if order:
            order.total_compensation += compensation_data.amount
    
    log = ProcessLog(
        task_id=task_id,
        action="compensation_created",
        status_before=task.status,
        status_after=TaskStatus.COMPENSATED.value,
        details={
            "compensation_id": compensation_id,
            "amount": compensation_data.amount,
            "reason": compensation_data.reason
        },
        performed_by=current_user.id
    )
    db.add(log)
    
    db.commit()
    
    return {
        "message": "Compensation created successfully",
        "compensation_id": compensation_id,
        "amount": compensation_data.amount
    }

@router.get("/", 
            response_model=list[dict],
            dependencies=[Depends(RoleChecker([UserRole.MANAGER]))])
def list_compensations(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    current_user: User = Depends(RoleChecker([UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    query = db.query(Compensation)
    
    if status:
        query = query.filter(Compensation.status == status)
    
    compensations = query.order_by(
        Compensation.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return [
        {
            "compensation_id": c.compensation_id,
            "task_id": c.task_id,
            "amount": c.amount,
            "reason": c.reason,
            "compensation_type": c.compensation_type,
            "status": c.status,
            "created_at": c.created_at
        }
        for c in compensations
    ]

@router.post("/{compensation_id}/disburse",
             dependencies=[Depends(RoleChecker([UserRole.MANAGER]))])
def disburse_compensation(
    compensation_id: str,
    transaction_id: str = None,
    current_user: User = Depends(RoleChecker([UserRole.MANAGER])),
    db: Session = Depends(get_db)
):
    compensation = db.query(Compensation).filter(
        Compensation.compensation_id == compensation_id
    ).first()
    
    if not compensation:
        raise HTTPException(status_code=404, detail="Compensation not found")
    
    compensation.status = "disbursed"
    compensation.disbursed_at = datetime.utcnow()
    compensation.transaction_id = transaction_id
    
    db.commit()
    
    return {
        "message": "Compensation disbursed successfully",
        "compensation_id": compensation_id,
        "status": "disbursed"
    }
