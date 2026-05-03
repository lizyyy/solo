from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from config import SessionLocal, get_db, OperationStatus
from models.schemas import RiskQueryResponse
from storage.repository import RepositoryFactory
from rules.rule_engine import CheckType

router = APIRouter(
    prefix="/api/risk",
    tags=["risk"],
    responses={404: {"description": "Not found"}}
)


@router.get("/operations/{operation_id}", response_model=List[RiskQueryResponse])
def query_operation_risks(
    operation_id: int,
    risk_level: Optional[str] = Query(None, description="按风险等级过滤: critical, high, medium, low"),
    include_passed: bool = Query(False, description="是否包含通过的检查"),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    check_results = repo.check.get_by_operation(operation_id)
    
    if not check_results:
        return []
    
    filtered_results = check_results
    
    if risk_level:
        filtered_results = [r for r in filtered_results if r.risk_level == risk_level]
    
    if not include_passed:
        filtered_results = [r for r in filtered_results if not r.passed]
    
    risk_responses = []
    
    for result in filtered_results:
        mitigation = _get_mitigation_suggestion(result.check_type, result.details)
        
        affected_items = []
        if result.details:
            if isinstance(result.details, dict):
                for key, value in result.details.items():
                    affected_items.append({
                        "field": key,
                        "value": str(value)
                    })
        
        risk_responses.append(RiskQueryResponse(
            risk_type=result.check_type,
            description=result.message,
            affected_items=affected_items,
            risk_level=result.risk_level,
            mitigation=mitigation
        ))
    
    return risk_responses


@router.get("/operations/{operation_id}/summary")
def get_risk_summary(
    operation_id: int,
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    operation = repo.operation.get_by_id(operation_id)
    
    if not operation:
        raise HTTPException(status_code=404, detail="操作不存在")
    
    check_results = repo.check.get_by_operation(operation_id)
    
    if not check_results:
        return {
            "operation_id": operation_id,
            "has_risks": False,
            "message": "尚未执行联锁检查"
        }
    
    passed_count = sum(1 for r in check_results if r.passed)
    failed_count = len(check_results) - passed_count
    
    risk_counts = {
        "critical": sum(1 for r in check_results if not r.passed and r.risk_level == "critical"),
        "high": sum(1 for r in check_results if not r.passed and r.risk_level == "high"),
        "medium": sum(1 for r in check_results if not r.passed and r.risk_level == "medium"),
        "low": sum(1 for r in check_results if not r.passed and r.risk_level == "low")
    }
    
    has_blocking_risks = risk_counts["critical"] > 0 or risk_counts["high"] > 0
    
    critical_risks = [
        {
            "check_type": r.check_type,
            "message": r.message,
            "details": r.details
        }
        for r in check_results
        if not r.passed and r.risk_level == "critical"
    ]
    
    high_risks = [
        {
            "check_type": r.check_type,
            "message": r.message,
            "details": r.details
        }
        for r in check_results
        if not r.passed and r.risk_level == "high"
    ]
    
    return {
        "operation_id": operation_id,
        "operation_name": operation.name,
        "bay_id": operation.bay_id,
        "bay_name": operation.bay_name,
        "current_status": operation.status.value,
        "summary": {
            "total_checks": len(check_results),
            "passed": passed_count,
            "failed": failed_count,
            "risk_counts": risk_counts
        },
        "has_blocking_risks": has_blocking_risks,
        "can_proceed": not has_blocking_risks,
        "critical_risks": critical_risks,
        "high_risks": high_risks
    }


@router.get("/bay/{bay_id}")
def get_bay_risks(
    bay_id: str,
    risk_level: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    
    operations = repo.operation.get_by_bay(bay_id)
    
    if not operations:
        return {
            "bay_id": bay_id,
            "operations_count": 0,
            "message": "该间隔暂无操作记录"
        }
    
    all_risks = []
    
    for operation in operations:
        check_results = repo.check.get_by_operation(operation.id)
        
        for result in check_results:
            if not result.passed:
                if risk_level and result.risk_level != risk_level:
                    continue
                
                all_risks.append({
                    "operation_id": operation.id,
                    "operation_name": operation.name,
                    "operation_status": operation.status.value,
                    "check_type": result.check_type,
                    "risk_level": result.risk_level,
                    "message": result.message,
                    "details": result.details
                })
    
    return {
        "bay_id": bay_id,
        "operations_count": len(operations),
        "risks_count": len(all_risks),
        "risks": all_risks
    }


@router.get("/all")
def get_all_risks(
    risk_level: Optional[str] = Query(None),
    include_passed: bool = Query(False),
    db: Session = Depends(get_db)
):
    repo = RepositoryFactory(db)
    
    operations = repo.operation.get_all()
    
    risk_summary = {
        "total_operations": len(operations),
        "risk_counts": {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0
        },
        "operations_with_risks": [],
        "high_risk_operations": []
    }
    
    for operation in operations:
        check_results = repo.check.get_by_operation(operation.id)
        
        if not check_results:
            continue
        
        operation_risks = {
            "operation_id": operation.id,
            "operation_name": operation.name,
            "bay_id": operation.bay_id,
            "bay_name": operation.bay_name,
            "status": operation.status.value,
            "risks": []
        }
        
        has_high_risk = False
        
        for result in check_results:
            if not result.passed or include_passed:
                if risk_level and result.risk_level != risk_level:
                    continue
                
                operation_risks["risks"].append({
                    "check_type": result.check_type,
                    "risk_level": result.risk_level,
                    "passed": result.passed,
                    "message": result.message
                })
                
                if not result.passed:
                    if result.risk_level in ["critical", "high"]:
                        has_high_risk = True
                    risk_summary["risk_counts"][result.risk_level] += 1
        
        if operation_risks["risks"]:
            risk_summary["operations_with_risks"].append(operation_risks)
            
            if has_high_risk:
                risk_summary["high_risk_operations"].append({
                    "operation_id": operation.id,
                    "operation_name": operation.name,
                    "bay_id": operation.bay_id,
                    "bay_name": operation.bay_name,
                    "status": operation.status.value
                })
    
    risk_summary["operations_with_risks_count"] = len(risk_summary["operations_with_risks"])
    risk_summary["high_risk_operations_count"] = len(risk_summary["high_risk_operations"])
    
    return risk_summary


@router.get("/types")
def get_risk_types():
    return {
        "risk_types": [
            {
                "type": CheckType.VERSION_CONSISTENCY.value,
                "name": "版本一致性",
                "description": "检查定值版本是否属于同一间隔，防止拿错版本",
                "typical_risk_levels": ["critical", "high"]
            },
            {
                "type": CheckType.PLATE_SEQUENCE.value,
                "name": "压板投退顺序",
                "description": "检查压板投退顺序是否正确，功能压板需先于出口压板",
                "typical_risk_levels": ["high", "medium"]
            },
            {
                "type": CheckType.APPROVAL_COMPLETENESS.value,
                "name": "审批票完整性",
                "description": "检查审批票是否完整签字，防止漏签下发",
                "typical_risk_levels": ["high", "medium"]
            },
            {
                "type": CheckType.TOPOLOGY_INTERLOCK.value,
                "name": "一次拓扑联锁",
                "description": "检查一次拓扑联锁条件，如接地刀闸与断路器状态",
                "typical_risk_levels": ["critical", "high"]
            },
            {
                "type": CheckType.SETTING_RANGE.value,
                "name": "定值范围",
                "description": "检查定值是否在合理范围内",
                "typical_risk_levels": ["high", "medium", "low"]
            }
        ]
    }


def _get_mitigation_suggestion(check_type: str, details: dict = None) -> str:
    mitigation_map = {
        "version_consistency": "请确认定值版本是否属于正确的间隔，检查版本号和间隔ID是否匹配。",
        "plate_sequence": "请调整压板投退顺序：先投入保护功能压板，再投入出口压板；退出时先退出出口压板，再退出功能压板。",
        "approval_completeness": "请检查审批票签字情况，确保所有必需的签字环节都已完成，且签字顺序正确。",
        "topology_interlock": "请检查一次设备状态：断路器、隔离开关、接地刀闸的状态是否符合联锁要求。",
        "setting_range": "请核对定值数值，确保在合理范围内。参考：动作电流0.1-100A，时间定值0-100s等。"
    }
    
    base_mitigation = mitigation_map.get(check_type, "请仔细检查相关配置。")
    
    if details:
        if check_type == "version_consistency":
            current_bay = details.get("current_bay_id")
            target_bay = details.get("target_bay_id")
            if current_bay and target_bay and current_bay != target_bay:
                return f"当前版本间隔 {current_bay} 与目标版本间隔 {target_bay} 不一致！{base_mitigation}"
        elif check_type == "plate_sequence":
            func_plate = details.get("function_plate")
            exit_plate = details.get("exit_plate")
            if func_plate and exit_plate:
                return f"功能压板 {func_plate} 应在出口压板 {exit_plate} 之前投入。{base_mitigation}"
    
    return base_mitigation
