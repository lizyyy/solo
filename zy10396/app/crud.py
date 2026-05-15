from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app.models import (
    Caller, ApiGroup, ResourcePrice, CallRecord, AllocationRule,
    MonthlyResult, AdjustmentRecord, IdempotentRecord, AllocationStatus
)
from app import schemas


def get_idempotent_record(db: Session, key: str) -> Optional[IdempotentRecord]:
    return db.query(IdempotentRecord).filter(IdempotentRecord.key == key).first()


def create_idempotent_record(
    db: Session, key: str, request_type: str, response_data: str = "", expire_days: int = 30
) -> IdempotentRecord:
    db_record = IdempotentRecord(
        key=key,
        request_type=request_type,
        response_data=response_data,
        expires_at=datetime.utcnow() + timedelta(days=expire_days)
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def get_caller(db: Session, caller_id: int) -> Optional[Caller]:
    return db.query(Caller).filter(Caller.id == caller_id).first()


def get_caller_by_code(db: Session, code: str) -> Optional[Caller]:
    return db.query(Caller).filter(Caller.code == code).first()


def get_callers(db: Session, skip: int = 0, limit: int = 100, is_active: Optional[bool] = None) -> List[Caller]:
    query = db.query(Caller)
    if is_active is not None:
        query = query.filter(Caller.is_active == is_active)
    return query.offset(skip).limit(limit).all()


def create_caller(db: Session, caller: schemas.CallerCreate) -> Caller:
    db_caller = Caller(**caller.model_dump())
    db.add(db_caller)
    db.commit()
    db.refresh(db_caller)
    return db_caller


def update_caller(db: Session, caller_id: int, caller_update: schemas.CallerUpdate) -> Optional[Caller]:
    db_caller = get_caller(db, caller_id)
    if db_caller:
        update_data = caller_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_caller, key, value)
        db.commit()
        db.refresh(db_caller)
    return db_caller


def get_api_group(db: Session, api_group_id: int) -> Optional[ApiGroup]:
    return db.query(ApiGroup).filter(ApiGroup.id == api_group_id).first()


def get_api_group_by_code(db: Session, code: str) -> Optional[ApiGroup]:
    return db.query(ApiGroup).filter(ApiGroup.code == code).first()


def get_api_groups(db: Session, skip: int = 0, limit: int = 100, is_active: Optional[bool] = None) -> List[ApiGroup]:
    query = db.query(ApiGroup)
    if is_active is not None:
        query = query.filter(ApiGroup.is_active == is_active)
    return query.offset(skip).limit(limit).all()


def create_api_group(db: Session, api_group: schemas.ApiGroupCreate) -> ApiGroup:
    db_api_group = ApiGroup(**api_group.model_dump())
    db.add(db_api_group)
    db.commit()
    db.refresh(db_api_group)
    return db_api_group


def get_latest_resource_price_version(db: Session, api_group_id: int) -> int:
    max_version = db.query(func.max(ResourcePrice.version))\
        .filter(ResourcePrice.api_group_id == api_group_id)\
        .scalar()
    return max_version or 0


def create_resource_price(db: Session, resource_price: schemas.ResourcePriceCreate) -> ResourcePrice:
    version = get_latest_resource_price_version(db, resource_price.api_group_id) + 1
    db_resource_price = ResourcePrice(**resource_price.model_dump(), version=version)
    db.add(db_resource_price)
    db.commit()
    db.refresh(db_resource_price)
    return db_resource_price


def get_resource_price_for_date(
    db: Session, api_group_id: int, target_date: datetime
) -> Optional[ResourcePrice]:
    return db.query(ResourcePrice).filter(
        ResourcePrice.api_group_id == api_group_id,
        ResourcePrice.is_active == True,
        ResourcePrice.effective_date <= target_date,
        or_(ResourcePrice.expiry_date.is_(None), ResourcePrice.expiry_date >= target_date)
    ).order_by(ResourcePrice.version.desc()).first()


def create_call_record(db: Session, call_record: schemas.CallRecordCreate) -> CallRecord:
    db_call_record = CallRecord(**call_record.model_dump())
    db.add(db_call_record)
    db.commit()
    db.refresh(db_call_record)
    return db_call_record


def aggregate_call_records(
    db: Session, month: str, caller_id: Optional[int] = None, api_group_id: Optional[int] = None
) -> List[Tuple[int, int, int]]:
    start_date = datetime.strptime(month, "%Y-%m")
    end_date = (start_date.replace(day=28) + timedelta(days=4)).replace(day=1)
    
    query = db.query(
        CallRecord.caller_id,
        CallRecord.api_group_id,
        func.sum(CallRecord.call_count).label("total_calls")
    ).filter(
        CallRecord.call_date >= start_date,
        CallRecord.call_date < end_date
    )
    
    if caller_id:
        query = query.filter(CallRecord.caller_id == caller_id)
    if api_group_id:
        query = query.filter(CallRecord.api_group_id == api_group_id)
    
    return query.group_by(CallRecord.caller_id, CallRecord.api_group_id).all()


def get_latest_rule_version(db: Session) -> int:
    max_version = db.query(func.max(AllocationRule.version)).scalar()
    return max_version or 0


def create_allocation_rule(db: Session, rule: schemas.AllocationRuleCreate) -> AllocationRule:
    version = get_latest_rule_version(db) + 1
    db_rule = AllocationRule(**rule.model_dump(), version=version)
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


def get_allocation_rule(db: Session, rule_id: int) -> Optional[AllocationRule]:
    return db.query(AllocationRule).filter(AllocationRule.id == rule_id).first()


def get_active_allocation_rule(db: Session, target_date: datetime) -> Optional[AllocationRule]:
    return db.query(AllocationRule).filter(
        AllocationRule.is_active == True,
        AllocationRule.effective_date <= target_date,
        or_(AllocationRule.expiry_date.is_(None), AllocationRule.expiry_date >= target_date)
    ).order_by(AllocationRule.version.desc()).first()


def get_monthly_result_by_idempotency(db: Session, idempotency_key: str) -> Optional[MonthlyResult]:
    return db.query(MonthlyResult).filter(MonthlyResult.idempotency_key == idempotency_key).first()


def calculate_allocated_cost(raw_cost: float, rule: AllocationRule) -> float:
    if rule.allocation_type == "proportional":
        return round(raw_cost, rule.rounding_precision)
    elif rule.allocation_type == "fixed":
        return round(raw_cost, rule.rounding_precision)
    else:
        return round(raw_cost, rule.rounding_precision)


def create_monthly_result(
    db: Session, month: str, caller_id: int, api_group_id: int,
    rule: AllocationRule, total_calls: int, idempotency_key: str
) -> MonthlyResult:
    target_date = datetime.strptime(month, "%Y-%m")
    resource_price = get_resource_price_for_date(db, api_group_id, target_date)
    
    if not resource_price:
        raise ValueError(f"No active resource price found for API group {api_group_id}")
    
    unit_price = resource_price.unit_price
    raw_cost = total_calls * unit_price
    allocated_cost = calculate_allocated_cost(raw_cost, rule)
    
    db_result = MonthlyResult(
        month=month,
        caller_id=caller_id,
        api_group_id=api_group_id,
        rule_id=rule.id,
        rule_version=rule.version,
        total_calls=total_calls,
        unit_price=unit_price,
        raw_cost=raw_cost,
        allocated_cost=allocated_cost,
        status=AllocationStatus.DRAFT,
        idempotency_key=idempotency_key
    )
    db.add(db_result)
    db.commit()
    db.refresh(db_result)
    return db_result


def validate_monthly_result(db: Session, result_id: int) -> Optional[MonthlyResult]:
    db_result = db.query(MonthlyResult).filter(MonthlyResult.id == result_id).first()
    if db_result and db_result.status == AllocationStatus.DRAFT:
        db_result.status = AllocationStatus.VALIDATED
        db.commit()
        db.refresh(db_result)
    return db_result


def update_result_status(
    db: Session, result_id: int, status: AllocationStatus, failure_reason: Optional[str] = None
) -> Optional[MonthlyResult]:
    db_result = db.query(MonthlyResult).filter(MonthlyResult.id == result_id).first()
    if db_result:
        db_result.status = status
        if failure_reason:
            db_result.failure_reason = failure_reason
        db.commit()
        db.refresh(db_result)
    return db_result


def get_monthly_results(
    db: Session, month: Optional[str] = None, caller_id: Optional[int] = None,
    api_group_id: Optional[int] = None, status: Optional[AllocationStatus] = None,
    skip: int = 0, limit: int = 100
) -> List[MonthlyResult]:
    query = db.query(MonthlyResult)
    
    if month:
        query = query.filter(MonthlyResult.month == month)
    if caller_id:
        query = query.filter(MonthlyResult.caller_id == caller_id)
    if api_group_id:
        query = query.filter(MonthlyResult.api_group_id == api_group_id)
    if status:
        query = query.filter(MonthlyResult.status == status)
    
    return query.order_by(MonthlyResult.created_at.desc()).offset(skip).limit(limit).all()


def create_adjustment_record(
    db: Session, monthly_result_id: int, adjustment: schemas.AdjustmentRecordCreate
) -> Tuple[MonthlyResult, AdjustmentRecord]:
    db_result = db.query(MonthlyResult).filter(MonthlyResult.id == monthly_result_id).first()
    if not db_result:
        raise ValueError("Monthly result not found")
    
    previous_cost = db_result.allocated_cost
    new_cost = previous_cost + adjustment.adjustment_amount
    
    db_adjustment = AdjustmentRecord(
        monthly_result_id=monthly_result_id,
        **adjustment.model_dump(),
        previous_cost=previous_cost,
        new_cost=new_cost
    )
    
    db_result.allocated_cost = new_cost
    db_result.status = AllocationStatus.ADJUSTED
    
    db.add(db_adjustment)
    db.commit()
    db.refresh(db_result)
    db.refresh(db_adjustment)
    
    return db_result, db_adjustment


def trial_calculate_cost(
    db: Session, month: str, rule_id: int,
    caller_id: Optional[int] = None, api_group_id: Optional[int] = None
) -> Tuple[List[dict], float]:
    rule = get_allocation_rule(db, rule_id)
    if not rule:
        raise ValueError(f"Allocation rule {rule_id} not found")
    
    aggregated_records = aggregate_call_records(db, month, caller_id, api_group_id)
    
    results = []
    total_cost = 0.0
    target_date = datetime.strptime(month, "%Y-%m")
    
    for caller_id_val, api_group_id_val, total_calls in aggregated_records:
        resource_price = get_resource_price_for_date(db, api_group_id_val, target_date)
        if not resource_price:
            continue
        
        caller = get_caller(db, caller_id_val)
        api_group = get_api_group(db, api_group_id_val)
        
        raw_cost = total_calls * resource_price.unit_price
        allocated_cost = calculate_allocated_cost(raw_cost, rule)
        total_cost += allocated_cost
        
        results.append({
            "caller_id": caller_id_val,
            "caller_name": caller.name if caller else "Unknown",
            "api_group_id": api_group_id_val,
            "api_group_name": api_group.name if api_group else "Unknown",
            "total_calls": total_calls,
            "unit_price": resource_price.unit_price,
            "raw_cost": raw_cost,
            "allocated_cost": allocated_cost
        })
    
    return results, round(total_cost, rule.rounding_precision)
