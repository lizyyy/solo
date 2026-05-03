from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from config import SessionLocal, get_db, OperationStatus, CheckResult
from models.schemas import CheckResultResponse, InterlockCheckResult
from storage.repository import RepositoryFactory
from state_machine.state_machine import OperationStateMachine, StateEventType
from rules.rule_engine import InterlockRuleEngine, CheckType

router = APIRouter(
    prefix="/api/check",
    tags=["check"],
    responses={404: {"description": "Not found"}}
)


@router.post("/operations/{operation_id}", response_model=List[CheckResultResponse])
def run_interlock_check(
    operation_id: int,
    check_types: Optional[List[str]] = Query(None, description="指定检查类型，留空则执行全部检查"),
    auto_transition: bool = Query(True, description="检查通过后是否自动切换状态"),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    if operation.status not in [OperationStatus.COMPARED, OperationStatus.CHECKED]:
        raise HTTPException(
            status_code=400,
            detail=f"当前状态 {operation.status.value} 不支持联锁检查，请先完成版本比对"
        )
    
    for result in repo.check.get_by_operation(operation_id):
        db.delete(result)
    db.commit()
    
    rule_engine = InterlockRuleEngine()
    
    all_check_types = [
        CheckType.VERSION_CONSISTENCY.value,
        CheckType.PLATE_SEQUENCE.value,
        CheckType.APPROVAL_COMPLETENESS.value,
        CheckType.TOPOLOGY_INTERLOCK.value,
        CheckType.SETTING_RANGE.value
    ]
    
    selected_checks = check_types if check_types else all_check_types
    
    results = []
    
    if CheckType.VERSION_CONSISTENCY.value in selected_checks:
        results.extend(rule_engine.check_version_consistency(operation, db))
    
    if CheckType.PLATE_SEQUENCE.value in selected_checks:
        results.extend(rule_engine.check_plate_sequence(operation, db))
    
    if CheckType.APPROVAL_COMPLETENESS.value in selected_checks:
        results.extend(rule_engine.check_approval_completeness(operation, db))
    
    if CheckType.TOPOLOGY_INTERLOCK.value in selected_checks:
        results.extend(rule_engine.check_topology_interlock(operation, db))
    
    if CheckType.SETTING_RANGE.value in selected_checks:
        results.extend(rule_engine.check_setting_range(operation, db))
    
    for result in results:
        db.add(result)
    db.commit()
    
    if auto_transition and operation.status == OperationStatus.COMPARED:
        state_machine = OperationStateMachine(db)
        try:
            state_machine.trigger_event(operation, StateEventType.CHECK)
        except ValueError:
            pass
    
    passed_count = sum(1 for r in results if r.passed)
    failed_count = len(results) - passed_count
    high_risk_count = sum(1 for r in results if not r.passed and r.risk_level in ["high", "critical"])
    
    repo.audit.log_operation(
        operation="CHECK",
        resource_type="operation",
        resource_id=operation_id,
        details={
            "total_checks": len(results),
            "passed": passed_count,
            "failed": failed_count,
            "high_risk": high_risk_count,
            "check_types": selected_checks
        }
    )
    
    return results


@router.get("/operations/{operation_id}", response_model=List[CheckResultResponse])
def get_check_results(
    operation_id: int,
    include_passed: bool = Query(True, description="是否包含通过的检查"),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    results = repo.check.get_by_operation(operation_id)
    
    if not include_passed:
        results = [r for r in results if not r.passed]
    
    return results


@router.get("/operations/{operation_id}/high-risk", response_model=List[CheckResultResponse])
def get_high_risk_results(
    operation_id: int,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    return repo.check.get_high_risk_checks(operation_id)


@router.get("/operations/{operation_id}/summary")
def get_check_summary(
    operation_id: int,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    results = repo.check.get_by_operation(operation_id)
    
    if not results:
        return {
            "operation_id": operation_id,
            "status": operation.status.value,
            "has_check_results": False,
            "message": "尚未执行联锁检查"
        }
    
    passed = sum(1 for r in results if r.passed)
    failed = len(results) - passed
    
    risk_summary = {
        "critical": sum(1 for r in results if not r.passed and r.risk_level == "critical"),
        "high": sum(1 for r in results if not r.passed and r.risk_level == "high"),
        "medium": sum(1 for r in results if not r.passed and r.risk_level == "medium"),
        "low": sum(1 for r in results if not r.passed and r.risk_level == "low")
    }
    
    can_approve = (
        risk_summary["critical"] == 0 and
        risk_summary["high"] == 0
    )
    
    return {
        "operation_id": operation_id,
        "operation_name": operation.name,
        "bay_id": operation.bay_id,
        "bay_name": operation.bay_name,
        "current_status": operation.status.value,
        "has_check_results": True,
        "summary": {
            "total": len(results),
            "passed": passed,
            "failed": failed
        },
        "risk_summary": risk_summary,
        "can_approve": can_approve,
        "blocking_issues": [
            {
                "check_type": r.check_type,
                "risk_level": r.risk_level,
                "message": r.message,
                "details": r.details
            }
            for r in results
            if not r.passed and r.risk_level in ["high", "critical"]
        ]
    }


@router.get("/types", response_model=List[str])
def get_available_check_types():
    return [
        CheckType.VERSION_CONSISTENCY.value,
        CheckType.PLATE_SEQUENCE.value,
        CheckType.APPROVAL_COMPLETENESS.value,
        CheckType.TOPOLOGY_INTERLOCK.value,
        CheckType.SETTING_RANGE.value
    ]
