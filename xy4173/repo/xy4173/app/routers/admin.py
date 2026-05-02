from datetime import datetime
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func

from app.core.database import get_db, init_db
from app.models import (
    Instrument, User, ResearchGroup, Reservation, SwipeLog,
    SampleRegistration, BillingRule, Bill, Violation, Review,
    AuditLog, ImportBatch
)
from app.engine.rule_engine import RuleEngine, RuleType
from app.engine.state_machine import (
    BillStateMachine, ViolationStateMachine, BillState, ViolationState
)
from app.schemas.base import SuccessResponse
from app.utils.code_generator import (
    generate_reservation_code, generate_swipe_code, generate_sample_code,
    generate_violation_code, generate_bill_code
)


router = APIRouter(prefix="/admin", tags=["系统管理"])


@router.post("/init-db", response_model=SuccessResponse)
async def initialize_database(
    db: Session = Depends(get_db)
):
    """初始化数据库"""
    try:
        init_db()
        return SuccessResponse(
            success=True,
            message="数据库初始化成功",
            data={
                "timestamp": datetime.now().isoformat()
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"数据库初始化失败: {str(e)}")


@router.get("/stats", response_model=SuccessResponse)
async def get_system_statistics(
    db: Session = Depends(get_db)
):
    """获取系统统计信息"""
    try:
        total_instruments = db.query(Instrument).count()
        total_users = db.query(User).count()
        total_research_groups = db.query(ResearchGroup).count()
        total_reservations = db.query(Reservation).count()
        total_swipe_logs = db.query(SwipeLog).count()
        total_samples = db.query(SampleRegistration).count()
        total_violations = db.query(Violation).count()
        total_bills = db.query(Bill).count()
        
        matched_swipes = db.query(SwipeLog).filter(SwipeLog.is_matched == True).count()
        unmatched_swipes = total_swipe_logs - matched_swipes
        
        overdue_samples = sum(1 for s in db.query(SampleRegistration).all() if s.is_overdue)
        
        pending_violations = db.query(Violation).filter(
            Violation.status == ViolationState.PENDING.value
        ).count()
        
        pending_bills = db.query(Bill).filter(
            Bill.status == BillState.PENDING.value
        ).count()
        
        approved_bills = db.query(Bill).filter(
            Bill.status == BillState.APPROVED.value
        ).count()
        
        total_bill_amount = db.query(func.sum(Bill.total_amount)).scalar() or 0
        paid_amount = db.query(func.sum(Bill.paid_amount)).scalar() or 0
        waived_amount = db.query(func.sum(Bill.waived_amount)).scalar() or 0
        
        violations_by_type = db.query(
            Violation.violation_type,
            func.count(Violation.id).label("count")
        ).group_by(Violation.violation_type).all()
        
        return SuccessResponse(
            success=True,
            message="获取系统统计成功",
            data={
                "instruments": {
                    "total": total_instruments
                },
                "users": {
                    "total": total_users,
                    "research_groups": total_research_groups
                },
                "reservations": {
                    "total": total_reservations
                },
                "swipe_logs": {
                    "total": total_swipe_logs,
                    "matched": matched_swipes,
                    "unmatched": unmatched_swipes
                },
                "samples": {
                    "total": total_samples,
                    "overdue": overdue_samples
                },
                "violations": {
                    "total": total_violations,
                    "pending": pending_violations,
                    "by_type": {v.violation_type: v.count for v in violations_by_type}
                },
                "bills": {
                    "total": total_bills,
                    "pending": pending_bills,
                    "approved": approved_bills,
                    "total_amount": float(total_bill_amount),
                    "paid_amount": float(paid_amount),
                    "waived_amount": float(waived_amount)
                }
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取统计信息失败: {str(e)}")


@router.post("/run-rules", response_model=SuccessResponse)
async def run_all_business_rules(
    db: Session = Depends(get_db)
):
    """运行所有业务规则检查"""
    try:
        engine = RuleEngine(db)
        
        rule_types = [
            RuleType.TIME_OVERLAP,
            RuleType.NO_RESERVATION_SWIPE,
            RuleType.CROSS_GROUP_USAGE,
            RuleType.SAMPLE_OVERDUE,
            RuleType.RESERVATION_NO_SHOW,
        ]
        
        results = {}
        total_violations_found = 0
        
        for rule_type in rule_types:
            result = engine.run_rule(rule_type)
            results[rule_type.value] = {
                "success": result.success,
                "message": result.message,
                "violations_created": len(result.violations),
                "violations": [
                    {
                        "violation_code": v.violation_code,
                        "violation_type": v.violation_type,
                        "severity": v.severity
                    }
                    for v in result.violations
                ]
            }
            total_violations_found += len(result.violations)
        
        return SuccessResponse(
            success=True,
            message=f"规则执行完成，发现 {total_violations_found} 个违规",
            data={
                "timestamp": datetime.now().isoformat(),
                "total_violations_found": total_violations_found,
                "rule_results": results
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"规则执行失败: {str(e)}")


@router.post("/run-rule/{rule_type}", response_model=SuccessResponse)
async def run_specific_rule(
    rule_type: str = Path(..., description="规则类型"),
    db: Session = Depends(get_db)
):
    """运行指定规则检查"""
    try:
        rule_type_map = {
            "time_overlap": RuleType.TIME_OVERLAP,
            "no_reservation_swipe": RuleType.NO_RESERVATION_SWIPE,
            "cross_group_usage": RuleType.CROSS_GROUP_USAGE,
            "sample_overdue": RuleType.SAMPLE_OVERDUE,
            "reservation_no_show": RuleType.RESERVATION_NO_SHOW,
        }
        
        if rule_type not in rule_type_map:
            raise HTTPException(
                status_code=400,
                detail=f"未知的规则类型: {rule_type}。可用类型: {list(rule_type_map.keys())}"
            )
        
        engine = RuleEngine(db)
        result = engine.run_rule(rule_type_map[rule_type])
        
        return SuccessResponse(
            success=result.success,
            message=result.message,
            data={
                "rule_type": rule_type,
                "violations_created": len(result.violations),
                "violations": [
                    {
                        "violation_code": v.violation_code,
                        "violation_type": v.violation_type,
                        "severity": v.severity,
                        "description": v.description
                    }
                    for v in result.violations
                ]
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"规则执行失败: {str(e)}")


@router.post("/instruments", response_model=SuccessResponse)
async def create_instrument(
    instrument_code: str = Body(..., embed=True),
    name: str = Body(..., embed=True),
    base_hourly_rate: float = Body(..., embed=True),
    type: Optional[str] = Body(None, embed=True),
    location: Optional[str] = Body(None, embed=True),
    description: Optional[str] = Body(None, embed=True),
    overtime_rate_multiplier: float = Body(1.5, embed=True),
    db: Session = Depends(get_db)
):
    """创建仪器"""
    existing = db.query(Instrument).filter(
        Instrument.instrument_code == instrument_code
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="仪器编号已存在")
    
    instrument = Instrument(
        instrument_code=instrument_code,
        name=name,
        description=description,
        type=type,
        location=location,
        base_hourly_rate=base_hourly_rate,
        overtime_rate_multiplier=overtime_rate_multiplier,
        is_active=True
    )
    db.add(instrument)
    db.commit()
    db.refresh(instrument)
    
    return SuccessResponse(
        success=True,
        message="仪器创建成功",
        data={
            "id": instrument.id,
            "instrument_code": instrument.instrument_code,
            "name": instrument.name
        }
    )


@router.post("/research-groups", response_model=SuccessResponse)
async def create_research_group(
    group_code: str = Body(..., embed=True),
    name: str = Body(..., embed=True),
    leader_name: Optional[str] = Body(None, embed=True),
    contact_email: Optional[str] = Body(None, embed=True),
    contact_phone: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    """创建课题组"""
    existing = db.query(ResearchGroup).filter(
        ResearchGroup.group_code == group_code
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="课题组编号已存在")
    
    group = ResearchGroup(
        group_code=group_code,
        name=name,
        leader_name=leader_name,
        contact_email=contact_email,
        contact_phone=contact_phone,
        is_active=True
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    
    return SuccessResponse(
        success=True,
        message="课题组创建成功",
        data={
            "id": group.id,
            "group_code": group.group_code,
            "name": group.name
        }
    )


@router.post("/users", response_model=SuccessResponse)
async def create_user(
    user_id: str = Body(..., embed=True),
    name: str = Body(..., embed=True),
    role: str = Body("student", embed=True),
    research_group_id: Optional[int] = Body(None, embed=True),
    card_number: Optional[str] = Body(None, embed=True),
    email: Optional[str] = Body(None, embed=True),
    phone: Optional[str] = Body(None, embed=True),
    db: Session = Depends(get_db)
):
    """创建用户"""
    existing = db.query(User).filter(User.user_id == user_id).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="用户编号已存在")
    
    if research_group_id:
        group = db.query(ResearchGroup).filter(ResearchGroup.id == research_group_id).first()
        if not group:
            raise HTTPException(status_code=400, detail="课题组不存在")
    
    user = User(
        user_id=user_id,
        name=name,
        role=role,
        research_group_id=research_group_id,
        card_number=card_number,
        email=email,
        phone=phone,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return SuccessResponse(
        success=True,
        message="用户创建成功",
        data={
            "id": user.id,
            "user_id": user.user_id,
            "name": user.name,
            "role": user.role
        }
    )


@router.post("/billing-rules", response_model=SuccessResponse)
async def create_billing_rule(
    rule_code: str = Body(..., embed=True),
    name: str = Body(..., embed=True),
    base_hourly_rate: float = Body(..., embed=True),
    instrument_id: Optional[int] = Body(None, embed=True),
    research_group_id: Optional[int] = Body(None, embed=True),
    overtime_rate_multiplier: float = Body(1.5, embed=True),
    overtime_start_hours: int = Body(4, embed=True),
    night_rate_multiplier: float = Body(2.0, embed=True),
    night_start_time: str = Body("22:00", embed=True),
    night_end_time: str = Body("08:00", embed=True),
    weekend_rate_multiplier: float = Body(1.5, embed=True),
    discount_rate: float = Body(1.0, embed=True),
    priority: int = Body(0, embed=True),
    is_active: bool = Body(True, embed=True),
    db: Session = Depends(get_db)
):
    """创建计费规则"""
    existing = db.query(BillingRule).filter(BillingRule.rule_code == rule_code).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="计费规则编号已存在")
    
    rule = BillingRule(
        rule_code=rule_code,
        name=name,
        instrument_id=instrument_id,
        research_group_id=research_group_id,
        base_hourly_rate=base_hourly_rate,
        overtime_rate_multiplier=overtime_rate_multiplier,
        overtime_start_hours=overtime_start_hours,
        night_rate_multiplier=night_rate_multiplier,
        night_start_time=night_start_time,
        night_end_time=night_end_time,
        weekend_rate_multiplier=weekend_rate_multiplier,
        discount_rate=discount_rate,
        priority=priority,
        is_active=is_active
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    return SuccessResponse(
        success=True,
        message="计费规则创建成功",
        data={
            "id": rule.id,
            "rule_code": rule.rule_code,
            "name": rule.name,
            "base_hourly_rate": float(rule.base_hourly_rate)
        }
    )
