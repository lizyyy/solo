from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from config import SessionLocal, get_db, OperationStatus, SimulationLog
from models.schemas import SimulationLogResponse
from storage.repository import RepositoryFactory
from state_machine.state_machine import OperationStateMachine, StateEventType

router = APIRouter(
    prefix="/api/simulation",
    tags=["simulation"],
    responses={404: {"description": "Not found"}}
)


@router.post("/operations/{operation_id}/simulate", response_model=List[SimulationLogResponse])
def simulate_issue(
    operation_id: int,
    auto_transition: bool = Query(True, description="模拟成功后是否自动切换状态"),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    if operation.status not in [OperationStatus.APPROVED, OperationStatus.SIMULATED, OperationStatus.ROLLED_BACK]:
        raise HTTPException(
            status_code=400,
            detail=f"当前状态 {operation.status.value} 不支持模拟下发，请先完成审批"
        )
    
    check_results = repo.check.get_by_operation(operation_id)
    failed_checks = [c for c in check_results if not c.passed]
    high_risk_checks = [c for c in check_results if not c.passed and c.risk_level in ["high", "critical"]]
    
    if high_risk_checks:
        raise HTTPException(
            status_code=400,
            detail=f"存在高风险问题，无法执行模拟下发: {[c.message for c in high_risk_checks]}"
        )
    
    state_machine = OperationStateMachine(db)
    
    logs = repo.simulation.get_by_operation(operation_id)
    for log in logs:
        db.delete(log)
    db.commit()
    
    simulation_logs = state_machine.simulate_issue(operation)
    
    success_count = sum(1 for l in simulation_logs if l.result == "SUCCESS")
    failed_count = len(simulation_logs) - success_count
    
    if auto_transition and operation.status == OperationStatus.APPROVED and failed_count == 0:
        try:
            state_machine.trigger_event(operation, StateEventType.SIMULATE)
        except ValueError:
            pass
    
    repo.audit.log_operation(
        operation="SIMULATE",
        resource_type="operation",
        resource_id=operation_id,
        details={
            "total_steps": len(simulation_logs),
            "success_steps": success_count,
            "failed_steps": failed_count
        }
    )
    
    return simulation_logs


@router.post("/operations/{operation_id}/rollback", response_model=List[SimulationLogResponse])
def rollback_operation(
    operation_id: int,
    auto_transition: bool = Query(True, description="回滚成功后是否自动切换状态"),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    if operation.status not in [OperationStatus.ISSUED, OperationStatus.SIMULATED]:
        raise HTTPException(
            status_code=400,
            detail=f"当前状态 {operation.status.value} 不支持回滚，只能回滚已下发或已模拟的操作"
        )
    
    state_machine = OperationStateMachine(db)
    
    logs = repo.simulation.get_by_operation(operation_id)
    for log in logs:
        db.delete(log)
    db.commit()
    
    rollback_logs = state_machine.rollback_operation(operation)
    
    success_count = sum(1 for l in rollback_logs if l.result == "SUCCESS")
    failed_count = len(rollback_logs) - success_count
    
    if auto_transition and failed_count == 0:
        try:
            state_machine.trigger_event(operation, StateEventType.ROLLBACK)
        except ValueError:
            pass
    
    repo.audit.log_operation(
        operation="ROLLBACK",
        resource_type="operation",
        resource_id=operation_id,
        details={
            "total_steps": len(rollback_logs),
            "success_steps": success_count,
            "failed_steps": failed_count
        }
    )
    
    return rollback_logs


@router.post("/operations/{operation_id}/issue", response_model=List[SimulationLogResponse])
def issue_operation(
    operation_id: int,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    if operation.status != OperationStatus.SIMULATED:
        raise HTTPException(
            status_code=400,
            detail=f"当前状态 {operation.status.value} 不支持正式下发，请先完成模拟执行"
        )
    
    check_results = repo.check.get_by_operation(operation_id)
    failed_checks = [c for c in check_results if not c.passed]
    high_risk_checks = [c for c in check_results if not c.passed and c.risk_level in ["high", "critical"]]
    
    if high_risk_checks:
        raise HTTPException(
            status_code=400,
            detail=f"存在高风险问题，无法执行正式下发: {[c.message for c in high_risk_checks]}"
        )
    
    state_machine = OperationStateMachine(db)
    
    try:
        state_machine.trigger_event(operation, StateEventType.ISSUE)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    simulation_logs = repo.simulation.get_by_operation(operation_id)
    
    repo.audit.log_operation(
        operation="ISSUE",
        resource_type="operation",
        resource_id=operation_id,
        details={
            "total_steps": len(simulation_logs),
            "status": "issued"
        }
    )
    
    return simulation_logs


@router.get("/operations/{operation_id}/logs", response_model=List[SimulationLogResponse])
def get_simulation_logs(
    operation_id: int,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    return repo.simulation.get_by_operation(operation_id)


@router.get("/operations/{operation_id}/status")
def get_simulation_status(
    operation_id: int,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    logs = repo.simulation.get_by_operation(operation_id)
    
    return {
        "operation_id": operation_id,
        "operation_name": operation.name,
        "current_status": operation.status.value,
        "can_simulate": operation.status in [OperationStatus.APPROVED, OperationStatus.ROLLED_BACK],
        "can_rollback": operation.status in [OperationStatus.ISSUED, OperationStatus.SIMULATED],
        "can_issue": operation.status == OperationStatus.SIMULATED,
        "has_simulation_logs": len(logs) > 0,
        "simulation_summary": {
            "total_steps": len(logs),
            "success_steps": sum(1 for l in logs if l.result == "SUCCESS"),
            "failed_steps": sum(1 for l in logs if l.result != "SUCCESS")
        } if logs else None
    }
