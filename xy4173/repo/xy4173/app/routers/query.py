from datetime import datetime, date
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Path
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc

from app.core.database import get_db
from app.models import (
    Instrument, User, ResearchGroup, Reservation, SwipeLog,
    SampleRegistration, BillingRule, Bill, Violation, Review,
    AuditLog, ImportBatch
)
from app.engine.rule_engine import RuleEngine, RuleType
from app.schemas.base import BaseResponse, SuccessResponse


router = APIRouter(prefix="/query", tags=["数据查询"])


@router.get("/reservations", response_model=SuccessResponse)
async def list_reservations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    instrument_code: Optional[str] = None,
    user_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """获取预约单列表"""
    query = db.query(Reservation)
    
    if status:
        query = query.filter(Reservation.status == status)
    if instrument_code:
        query = query.join(Instrument).filter(Instrument.instrument_code == instrument_code)
    if user_id:
        query = query.join(User).filter(User.user_id == user_id)
    if date_from:
        query = query.filter(Reservation.start_time >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(Reservation.start_time <= datetime.combine(date_to, datetime.max.time()))
    
    total = query.count()
    
    reservations = query.order_by(desc(Reservation.start_time)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return SuccessResponse(
        success=True,
        message="获取预约单列表成功",
        data={
            "total": total,
            "page": page,
            "page_size": page_size,
            "reservations": [
                {
                    "id": r.id,
                    "reservation_code": r.reservation_code,
                    "instrument_id": r.instrument_id,
                    "instrument_code": r.instrument.instrument_code if r.instrument else None,
                    "instrument_name": r.instrument.name if r.instrument else None,
                    "user_id": r.user_id,
                    "user_name": r.user.name if r.user else None,
                    "start_time": r.start_time.isoformat() if r.start_time else None,
                    "end_time": r.end_time.isoformat() if r.end_time else None,
                    "status": r.status,
                    "is_approved": r.is_approved,
                    "is_cancelled": r.is_cancelled
                }
                for r in reservations
            ]
        }
    )


@router.get("/reservations/{reservation_id}", response_model=SuccessResponse)
async def get_reservation(
    reservation_id: int = Path(..., ge=1),
    db: Session = Depends(get_db)
):
    """获取单个预约单详情"""
    reservation = db.query(Reservation).filter(Reservation.id == reservation_id).first()
    
    if not reservation:
        raise HTTPException(status_code=404, detail="预约单不存在")
    
    return SuccessResponse(
        success=True,
        message="获取预约单详情成功",
        data={
            "id": reservation.id,
            "reservation_code": reservation.reservation_code,
            "instrument_id": reservation.instrument_id,
            "instrument_code": reservation.instrument.instrument_code if reservation.instrument else None,
            "instrument_name": reservation.instrument.name if reservation.instrument else None,
            "user_id": reservation.user_id,
            "user_name": reservation.user.name if reservation.user else None,
            "research_group_id": reservation.research_group_id,
            "research_group_name": reservation.research_group.name if reservation.research_group else None,
            "start_time": reservation.start_time.isoformat() if reservation.start_time else None,
            "end_time": reservation.end_time.isoformat() if reservation.end_time else None,
            "purpose": reservation.purpose,
            "status": reservation.status,
            "is_approved": reservation.is_approved,
            "is_cancelled": reservation.is_cancelled,
            "cancelled_reason": reservation.cancelled_reason,
            "created_at": reservation.created_at.isoformat() if reservation.created_at else None
        }
    )


@router.get("/swipe-logs", response_model=SuccessResponse)
async def list_swipe_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    match_status: Optional[str] = None,
    instrument_code: Optional[str] = None,
    user_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """获取刷卡日志列表"""
    query = db.query(SwipeLog)
    
    if match_status:
        query = query.filter(SwipeLog.match_status == match_status)
    if instrument_code:
        query = query.join(Instrument).filter(Instrument.instrument_code == instrument_code)
    if user_id:
        query = query.join(User).filter(User.user_id == user_id)
    if date_from:
        query = query.filter(SwipeLog.swipe_time >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(SwipeLog.swipe_time <= datetime.combine(date_to, datetime.max.time()))
    
    total = query.count()
    
    swipe_logs = query.order_by(desc(SwipeLog.swipe_time)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return SuccessResponse(
        success=True,
        message="获取刷卡日志列表成功",
        data={
            "total": total,
            "page": page,
            "page_size": page_size,
            "swipe_logs": [
                {
                    "id": s.id,
                    "swipe_code": s.swipe_code,
                    "card_number": s.card_number,
                    "swipe_time": s.swipe_time.isoformat() if s.swipe_time else None,
                    "instrument_id": s.instrument_id,
                    "instrument_code": s.instrument.instrument_code if s.instrument else None,
                    "instrument_name": s.instrument.name if s.instrument else None,
                    "user_id": s.user_id,
                    "user_name": s.user.name if s.user else None,
                    "reservation_id": s.reservation_id,
                    "reservation_code": s.reservation.reservation_code if s.reservation else None,
                    "swipe_type": s.swipe_type,
                    "is_matched": s.is_matched,
                    "match_status": s.match_status,
                    "is_manual_release": s.is_manual_release
                }
                for s in swipe_logs
            ]
        }
    )


@router.get("/samples", response_model=SuccessResponse)
async def list_samples(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    is_overdue: Optional[bool] = None,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取样品登记列表"""
    query = db.query(SampleRegistration)
    
    if status:
        query = query.filter(SampleRegistration.status == status)
    if user_id:
        query = query.join(User).filter(User.user_id == user_id)
    
    total = query.count()
    
    samples = query.order_by(desc(SampleRegistration.registered_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return SuccessResponse(
        success=True,
        message="获取样品登记列表成功",
        data={
            "total": total,
            "page": page,
            "page_size": page_size,
            "samples": [
                {
                    "id": s.id,
                    "sample_code": s.sample_code,
                    "sample_type": s.sample_type,
                    "description": s.description,
                    "user_id": s.user_id,
                    "user_name": s.user.name if s.user else None,
                    "registered_at": s.registered_at.isoformat() if s.registered_at else None,
                    "expected_pickup_at": s.expected_pickup_at.isoformat() if s.expected_pickup_at else None,
                    "actual_pickup_at": s.actual_pickup_at.isoformat() if s.actual_pickup_at else None,
                    "max_storage_hours": s.max_storage_hours,
                    "status": s.status,
                    "is_overdue": s.is_overdue,
                    "overdue_hours": s.overdue_hours
                }
                for s in samples
            ]
        }
    )


@router.get("/violations", response_model=SuccessResponse)
async def list_violations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    violation_type: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取违规记录列表"""
    query = db.query(Violation)
    
    if violation_type:
        query = query.filter(Violation.violation_type == violation_type)
    if status:
        query = query.filter(Violation.status == status)
    if severity:
        query = query.filter(Violation.severity == severity)
    
    total = query.count()
    
    violations = query.order_by(desc(Violation.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return SuccessResponse(
        success=True,
        message="获取违规记录列表成功",
        data={
            "total": total,
            "page": page,
            "page_size": page_size,
            "violations": [
                {
                    "id": v.id,
                    "violation_code": v.violation_code,
                    "violation_type": v.violation_type,
                    "severity": v.severity,
                    "status": v.status,
                    "user_id": v.user_id,
                    "user_name": v.user.name if v.user else None,
                    "instrument_id": v.instrument_id,
                    "instrument_name": v.instrument.name if v.instrument else None,
                    "swipe_log_id": v.swipe_log_id,
                    "reservation_id": v.reservation_id,
                    "violation_time": v.violation_time.isoformat() if v.violation_time else None,
                    "description": v.description
                }
                for v in violations
            ]
        }
    )


@router.get("/bills", response_model=SuccessResponse)
async def list_bills(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    research_group_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """获取账单列表"""
    query = db.query(Bill)
    
    if status:
        query = query.filter(Bill.status == status)
    if user_id:
        query = query.join(User).filter(User.user_id == user_id)
    if research_group_id:
        query = query.filter(Bill.research_group_id == research_group_id)
    if date_from:
        query = query.filter(Bill.bill_date >= date_from)
    if date_to:
        query = query.filter(Bill.bill_date <= date_to)
    
    total = query.count()
    
    bills = query.order_by(desc(Bill.bill_date)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return SuccessResponse(
        success=True,
        message="获取账单列表成功",
        data={
            "total": total,
            "page": page,
            "page_size": page_size,
            "bills": [
                {
                    "id": b.id,
                    "bill_code": b.bill_code,
                    "user_id": b.user_id,
                    "user_name": b.user.name if b.user else None,
                    "research_group_id": b.research_group_id,
                    "research_group_name": b.research_group.name if b.research_group else None,
                    "instrument_id": b.instrument_id,
                    "instrument_name": b.instrument.name if b.instrument else None,
                    "reservation_id": b.reservation_id,
                    "bill_date": b.bill_date.isoformat() if b.bill_date else None,
                    "base_amount": b.base_amount,
                    "overtime_amount": b.overtime_amount,
                    "night_surcharge": b.night_surcharge,
                    "weekend_surcharge": b.weekend_surcharge,
                    "discount_amount": b.discount_amount,
                    "total_amount": b.total_amount,
                    "waived_amount": b.waived_amount,
                    "paid_amount": b.paid_amount,
                    "status": b.status,
                    "payment_status": b.payment_status
                }
                for b in bills
            ]
        }
    )


@router.get("/audit-logs", response_model=SuccessResponse)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    operator_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取审计日志列表"""
    query = db.query(AuditLog)
    
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if operator_id:
        query = query.filter(AuditLog.operator_id == operator_id)
    
    total = query.count()
    
    audit_logs = query.order_by(desc(AuditLog.timestamp)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return SuccessResponse(
        success=True,
        message="获取审计日志列表成功",
        data={
            "total": total,
            "page": page,
            "page_size": page_size,
            "audit_logs": [
                {
                    "id": a.id,
                    "log_code": a.log_code,
                    "action": a.action,
                    "entity_type": a.entity_type,
                    "entity_id": a.entity_id,
                    "operator_id": a.operator_id,
                    "operator_name": a.operator_name,
                    "timestamp": a.timestamp.isoformat() if a.timestamp else None,
                    "details": a.details,
                    "ip_address": a.ip_address
                }
                for a in audit_logs
            ]
        }
    )


@router.get("/instruments", response_model=SuccessResponse)
async def list_instruments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取仪器列表"""
    query = db.query(Instrument)
    
    if status:
        query = query.filter(Instrument.status == status)
    
    total = query.count()
    
    instruments = query.order_by(desc(Instrument.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return SuccessResponse(
        success=True,
        message="获取仪器列表成功",
        data={
            "total": total,
            "page": page,
            "page_size": page_size,
            "instruments": [
                {
                    "id": i.id,
                    "instrument_code": i.instrument_code,
                    "name": i.name,
                    "description": i.description,
                    "type": i.type,
                    "location": i.location,
                    "base_hourly_rate": i.base_hourly_rate,
                    "overtime_rate_multiplier": i.overtime_rate_multiplier,
                    "status": i.status,
                    "is_active": i.is_active
                }
                for i in instruments
            ]
        }
    )


@router.get("/users", response_model=SuccessResponse)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    role: Optional[str] = None,
    research_group_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """获取用户列表"""
    query = db.query(User)
    
    if role:
        query = query.filter(User.role == role)
    if research_group_id:
        query = query.filter(User.research_group_id == research_group_id)
    
    total = query.count()
    
    users = query.order_by(desc(User.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return SuccessResponse(
        success=True,
        message="获取用户列表成功",
        data={
            "total": total,
            "page": page,
            "page_size": page_size,
            "users": [
                {
                    "id": u.id,
                    "user_id": u.user_id,
                    "name": u.name,
                    "email": u.email,
                    "phone": u.phone,
                    "card_number": u.card_number,
                    "role": u.role,
                    "research_group_id": u.research_group_id,
                    "research_group_name": u.research_group.name if u.research_group else None,
                    "is_active": u.is_active
                }
                for u in users
            ]
        }
    )


@router.get("/research-groups", response_model=SuccessResponse)
async def list_research_groups(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """获取课题组列表"""
    query = db.query(ResearchGroup)
    
    total = query.count()
    
    groups = query.order_by(desc(ResearchGroup.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return SuccessResponse(
        success=True,
        message="获取课题组列表成功",
        data={
            "total": total,
            "page": page,
            "page_size": page_size,
            "research_groups": [
                {
                    "id": g.id,
                    "group_code": g.group_code,
                    "name": g.name,
                    "leader_name": g.leader_name,
                    "contact_email": g.contact_email,
                    "contact_phone": g.contact_phone,
                    "is_active": g.is_active
                }
                for g in groups
            ]
        }
    )
