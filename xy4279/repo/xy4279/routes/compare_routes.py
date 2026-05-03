from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from config import SessionLocal, get_db, OperationStatus
from models.schemas import VersionCompareResult
from storage.repository import RepositoryFactory
from state_machine.state_machine import OperationStateMachine, StateEventType
from rules.rule_engine import InterlockRuleEngine

router = APIRouter(
    prefix="/api/compare",
    tags=["compare"],
    responses={404: {"description": "Not found"}}
)


@router.get("/versions/{current_version_id}/{target_version_id}", response_model=VersionCompareResult)
def compare_versions(
    current_version_id: int,
    target_version_id: int,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    
    current_ver = repo.setting.get_by_id(current_version_id)
    if not current_ver:
        raise HTTPException(status_code=404, detail=f"当前版本 (ID: {current_version_id}) 不存在")
    
    target_ver = repo.setting.get_by_id(target_version_id)
    if not target_ver:
        raise HTTPException(status_code=404, detail=f"目标版本 (ID: {target_version_id}) 不存在")
    
    current_values = repo.setting.get_values(current_version_id)
    target_values = repo.setting.get_values(target_version_id)
    
    rule_engine = InterlockRuleEngine()
    comparison = rule_engine.compare_versions(
        current_ver, target_ver, current_values, target_values
    )
    
    return VersionCompareResult(**comparison)


@router.get("/operations/{operation_id}", response_model=VersionCompareResult)
def compare_operation_versions(
    operation_id: int,
    auto_transition: bool = Query(True, description="比对成功后是否自动切换状态"),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    if not operation.current_version_id or not operation.target_version_id:
        raise HTTPException(
            status_code=400,
            detail="操作缺少当前版本或目标版本，请先导入定值"
        )
    
    current_ver = repo.setting.get_by_id(operation.current_version_id)
    target_ver = repo.setting.get_by_id(operation.target_version_id)
    
    if not current_ver:
        raise HTTPException(status_code=404, detail="当前版本不存在")
    if not target_ver:
        raise HTTPException(status_code=404, detail="目标版本不存在")
    
    current_values = repo.setting.get_values(operation.current_version_id)
    target_values = repo.setting.get_values(operation.target_version_id)
    
    rule_engine = InterlockRuleEngine()
    comparison = rule_engine.compare_versions(
        current_ver, target_ver, current_values, target_values
    )
    
    if auto_transition and operation.status == OperationStatus.IMPORTED:
        state_machine = OperationStateMachine(db)
        try:
            state_machine.trigger_event(operation, StateEventType.COMPARE)
        except ValueError:
            pass
    
    repo.audit.log_operation(
        operation="COMPARE",
        resource_type="operation",
        resource_id=operation_id,
        details={
            "current_version": current_ver.version,
            "target_version": target_ver.version,
            "changed_count": comparison["changed_values"],
            "added_count": comparison["added_values"],
            "removed_count": comparison["removed_values"]
        }
    )
    
    return VersionCompareResult(**comparison)


@router.get("/operations/{operation_id}/changes")
def get_operation_changes(
    operation_id: int,
    show_unchanged: bool = Query(False, description="是否显示未变更的定值"),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    if not operation.current_version_id or not operation.target_version_id:
        raise HTTPException(
            status_code=400,
            detail="操作缺少当前版本或目标版本"
        )
    
    current_ver = repo.setting.get_by_id(operation.current_version_id)
    target_ver = repo.setting.get_by_id(operation.target_version_id)
    
    current_values = repo.setting.get_values(operation.current_version_id)
    target_values = repo.setting.get_values(operation.target_version_id)
    
    current_dict = {v.name: v for v in current_values}
    target_dict = {v.name: v for v in target_values}
    
    all_names = set(current_dict.keys()) | set(target_dict.keys())
    
    changes = []
    additions = []
    removals = []
    unchanged = []
    
    for name in all_names:
        curr = current_dict.get(name)
        targ = target_dict.get(name)
        
        if curr and targ:
            if curr.value != targ.value:
                changes.append({
                    "name": name,
                    "category": curr.category,
                    "group_name": curr.group_name,
                    "old_value": curr.value,
                    "new_value": targ.value,
                    "unit": curr.unit or targ.unit,
                    "description": curr.description or targ.description
                })
            elif show_unchanged:
                unchanged.append({
                    "name": name,
                    "category": curr.category,
                    "group_name": curr.group_name,
                    "value": curr.value,
                    "unit": curr.unit,
                    "description": curr.description
                })
        elif targ and not curr:
            additions.append({
                "name": name,
                "category": targ.category,
                "group_name": targ.group_name,
                "value": targ.value,
                "unit": targ.unit,
                "description": targ.description
            })
        elif curr and not targ:
            removals.append({
                "name": name,
                "category": curr.category,
                "group_name": curr.group_name,
                "value": curr.value,
                "unit": curr.unit,
                "description": curr.description
            })
    
    return {
        "operation_id": operation_id,
        "current_version": current_ver.version if current_ver else None,
        "target_version": target_ver.version if target_ver else None,
        "summary": {
            "total": len(all_names),
            "changed": len(changes),
            "added": len(additions),
            "removed": len(removals),
            "unchanged": len(unchanged) if show_unchanged else len(all_names) - len(changes) - len(additions) - len(removals)
        },
        "changes": changes,
        "additions": additions,
        "removals": removals,
        "unchanged": unchanged if show_unchanged else []
    }
