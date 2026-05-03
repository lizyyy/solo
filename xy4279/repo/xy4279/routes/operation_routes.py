from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from config import SessionLocal, get_db, OperationStatus, Operation
from models.schemas import (
    OperationCreate, OperationUpdate, OperationResponse, 
    OperationDetailResponse, OperationStatus as SchemaStatus
)
from storage.repository import RepositoryFactory
from state_machine.state_machine import OperationStateMachine, StateEventType

router = APIRouter(
    prefix="/api/operations",
    tags=["operations"],
    responses={404: {"description": "Not found"}}
)


@router.post("/", response_model=OperationResponse, status_code=status.HTTP_201_CREATED)
def create_operation(operation: OperationCreate, db: Session = Depends(get_db)):
    repo = RepositoryFactory(db)
    try:
        new_operation = repo.operation.create(
            name=operation.name,
            description=operation.description,
            bay_id=operation.bay_id,
            bay_name=operation.bay_name,
            current_version_id=operation.current_version_id,
            target_version_id=operation.target_version_id,
            topology_id=operation.topology_id,
            plate_status_id=operation.plate_status_id,
            approval_ticket_id=operation.approval_ticket_id,
            status=OperationStatus.DRAFT
        )
        repo.audit.log_operation(
            operation="CREATE",
            resource_type="operation",
            resource_id=new_operation.id,
            details={"name": new_operation.name, "bay_id": new_operation.bay_id}
        )
        return new_operation
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[OperationResponse])
def list_operations(
    skip: int = 0, 
    limit: int = 100,
    bay_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    
    query = db.query(Operation)
    
    if bay_id:
        query = query.filter(Operation.bay_id == bay_id)
    if status:
        try:
            status_enum = OperationStatus(status)
            query = query.filter(Operation.status == status_enum)
        except ValueError:
            pass
    
    operations = query.offset(skip).limit(limit).all()
    return operations


@router.get("/{operation_id}", response_model=OperationDetailResponse)
def get_operation(operation_id: int, db: Session = Depends(get_db)):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    return operation


@router.put("/{operation_id}", response_model=OperationResponse)
def update_operation(
    operation_id: int, 
    update: OperationUpdate, 
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    update_data = update.dict(exclude_unset=True)
    if not update_data:
        return operation
    
    updated = repo.operation.update(operation_id, **update_data)
    repo.audit.log_operation(
        operation="UPDATE",
        resource_type="operation",
        resource_id=operation_id,
        details=update_data
    )
    return updated


@router.delete("/{operation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_operation(operation_id: int, db: Session = Depends(get_db)):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    if operation.status not in [OperationStatus.DRAFT, OperationStatus.CANCELLED]:
        raise HTTPException(
            status_code=400, 
            detail=f"无法删除状态为 {operation.status.value} 的操作"
        )
    
    repo.audit.log_operation(
        operation="DELETE",
        resource_type="operation",
        resource_id=operation_id,
        details={"name": operation.name}
    )
    repo.operation.delete(operation_id)


@router.post("/{operation_id}/cancel", response_model=OperationResponse)
def cancel_operation(operation_id: int, db: Session = Depends(get_db)):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    state_machine = OperationStateMachine(db)
    try:
        updated = state_machine.trigger_event(operation, StateEventType.CANCEL)
        repo.audit.log_operation(
            operation="CANCEL",
            resource_type="operation",
            resource_id=operation_id,
            details={"previous_status": operation.status.value}
        )
        return updated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{operation_id}/summary")
def get_operation_summary(operation_id: int, db: Session = Depends(get_db)):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    state_machine = OperationStateMachine(db)
    summary = state_machine.get_operation_state_summary(operation)
    return summary


@router.get("/statuses/", response_model=List[str])
def get_all_statuses():
    return [s.value for s in OperationStatus]
