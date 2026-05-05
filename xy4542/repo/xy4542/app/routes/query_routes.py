from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List

from app.config import get_db
from app.models.models import (
    Bundle, RiskAlert, TellerPayment, SortingLog, ATMPlan, BundleTag, AuditLog
)

router = APIRouter(prefix="/query", tags=["查询接口"])


@router.get("/bundles", summary="查询扎把列表")
async def get_bundles(
    business_date: str = Query(..., description="营业日期"),
    bundle_no: Optional[str] = Query(None, description="扎把编号模糊查询"),
    teller_no: Optional[str] = Query(None, description="柜员号"),
    source: Optional[str] = Query(None, description="来源: teller/atm"),
    status: Optional[str] = Query(None, description="状态: pending/verified/rejected"),
    db: Session = Depends(get_db)
):
    query = db.query(Bundle).filter(Bundle.business_date == business_date)
    
    if bundle_no:
        query = query.filter(Bundle.bundle_no.like(f"%{bundle_no}%"))
    if teller_no:
        query = query.filter(Bundle.teller_no == teller_no)
    if source:
        query = query.filter(Bundle.source == source)
    if status:
        query = query.filter(Bundle.status == status)
    
    bundles = query.all()
    
    result = [{
        "id": b.id,
        "bundle_no": b.bundle_no,
        "denomination": b.denomination,
        "quantity": b.quantity,
        "amount": b.amount,
        "teller_no": b.teller_no,
        "source": b.source,
        "status": b.status,
        "is_duplicate": b.is_duplicate
    } for b in bundles]
    
    return {
        "success": True,
        "count": len(result),
        "data": result
    }


@router.get("/bundles/{bundle_no}", summary="查询扎把详情")
async def get_bundle_detail(
    bundle_no: str,
    business_date: str = Query(..., description="营业日期"),
    db: Session = Depends(get_db)
):
    bundle = db.query(Bundle).filter(
        Bundle.bundle_no == bundle_no,
        Bundle.business_date == business_date
    ).first()
    
    if not bundle:
        raise HTTPException(status_code=404, detail=f"未找到扎把编号: {bundle_no}")
    
    teller_payment = db.query(TellerPayment).filter(
        TellerPayment.bundle_no == bundle_no,
        TellerPayment.business_date == business_date
    ).first()
    
    sorting_logs = db.query(SortingLog).filter(
        SortingLog.bundle_no == bundle_no,
        SortingLog.business_date == business_date
    ).all()
    
    bundle_tag = db.query(BundleTag).filter(
        BundleTag.bundle_no == bundle_no
    ).first()
    
    return {
        "success": True,
        "data": {
            "basic_info": {
                "bundle_no": bundle.bundle_no,
                "denomination": bundle.denomination,
                "quantity": bundle.quantity,
                "amount": bundle.amount,
                "teller_no": bundle.teller_no,
                "source": bundle.source,
                "status": bundle.status
            },
            "teller_payment": {
                "teller_no": teller_payment.teller_no,
                "teller_name": teller_payment.teller_name,
                "amount": teller_payment.amount
            } if teller_payment else None,
            "sorting_logs_count": len(sorting_logs),
            "sorting_logs": [{
                "serial_number": sl.serial_number,
                "denomination": sl.denomination,
                "sort_result": sl.sort_result
            } for sl in sorting_logs[:10]],
            "bundle_tag": {
                "start_serial": bundle_tag.start_serial,
                "end_serial": bundle_tag.end_serial,
                "operator": bundle_tag.operator
            } if bundle_tag else None
        }
    }


@router.get("/risks", summary="查询风险预警列表")
async def get_risks(
    business_date: str = Query(..., description="营业日期"),
    is_reviewed: Optional[bool] = Query(None, description="是否已复核"),
    severity: Optional[str] = Query(None, description="严重程度: low/medium/high"),
    alert_type: Optional[str] = Query(None, description="风险类型"),
    db: Session = Depends(get_db)
):
    query = db.query(RiskAlert).filter(RiskAlert.business_date == business_date)
    
    if is_reviewed is not None:
        query = query.filter(RiskAlert.is_reviewed == is_reviewed)
    if severity:
        query = query.filter(RiskAlert.severity == severity)
    if alert_type:
        query = query.filter(RiskAlert.alert_type == alert_type)
    
    alerts = query.order_by(RiskAlert.created_at.desc()).all()
    
    result = [{
        "id": a.id,
        "alert_type": a.alert_type,
        "alert_code": a.alert_code,
        "severity": a.severity,
        "reference_id": a.reference_id,
        "description": a.description,
        "expected_value": a.expected_value,
        "actual_value": a.actual_value,
        "is_reviewed": a.is_reviewed,
        "reviewed_by": a.reviewed_by,
        "review_remark": a.review_remark,
        "created_at": a.created_at.isoformat() if a.created_at else None
    } for a in alerts]
    
    return {
        "success": True,
        "count": len(result),
        "data": result
    }


@router.get("/tellers", summary="查询柜员缴款汇总")
async def get_teller_summary(
    business_date: str = Query(..., description="营业日期"),
    db: Session = Depends(get_db)
):
    teller_payments = db.query(
        TellerPayment.teller_no,
        TellerPayment.teller_name,
        func.count(TellerPayment.id).label("bundle_count"),
        func.sum(TellerPayment.amount).label("total_amount")
    ).filter(
        TellerPayment.business_date == business_date
    ).group_by(
        TellerPayment.teller_no,
        TellerPayment.teller_name
    ).all()
    
    result = [{
        "teller_no": tp.teller_no,
        "teller_name": tp.teller_name,
        "bundle_count": tp.bundle_count,
        "total_amount": tp.total_amount
    } for tp in teller_payments]
    
    total_amount = sum(tp.total_amount or 0 for tp in teller_payments)
    total_bundles = sum(tp.bundle_count for tp in teller_payments)
    
    return {
        "success": True,
        "summary": {
            "teller_count": len(result),
            "total_bundles": total_bundles,
            "total_amount": total_amount
        },
        "data": result
    }


@router.get("/atm-plans", summary="查询ATM加钞计划")
async def get_atm_plans(
    business_date: str = Query(..., description="营业日期"),
    atm_no: Optional[str] = Query(None, description="ATM编号"),
    db: Session = Depends(get_db)
):
    query = db.query(ATMPlan).filter(ATMPlan.business_date == business_date)
    
    if atm_no:
        query = query.filter(ATMPlan.atm_no == atm_no)
    
    plans = query.all()
    
    result = [{
        "id": p.id,
        "atm_no": p.atm_no,
        "atm_location": p.atm_location,
        "box_no": p.box_no,
        "denomination": p.denomination,
        "plan_quantity": p.plan_quantity,
        "plan_amount": p.plan_amount,
        "actual_quantity": p.actual_quantity,
        "actual_amount": p.actual_amount,
        "bundle_nos": p.bundle_nos,
        "source_file": p.source_file
    } for p in plans]
    
    return {
        "success": True,
        "count": len(result),
        "data": result
    }


@router.get("/audit-logs", summary="查询审计日志")
async def get_audit_logs(
    business_date: str = Query(..., description="营业日期"),
    operation_type: Optional[str] = Query(None, description="操作类型"),
    db: Session = Depends(get_db)
):
    query = db.query(AuditLog).filter(AuditLog.business_date == business_date)
    
    if operation_type:
        query = query.filter(AuditLog.operation_type == operation_type)
    
    logs = query.order_by(AuditLog.created_at.desc()).all()
    
    result = [{
        "id": l.id,
        "operation_type": l.operation_type,
        "operator": l.operator,
        "details": l.details,
        "created_at": l.created_at.isoformat() if l.created_at else None
    } for l in logs]
    
    return {
        "success": True,
        "count": len(result),
        "data": result
    }


@router.get("/stats", summary="查询统计信息")
async def get_stats(
    business_date: str = Query(..., description="营业日期"),
    db: Session = Depends(get_db)
):
    total_bundles = db.query(func.count(Bundle.id)).filter(
        Bundle.business_date == business_date
    ).scalar() or 0
    
    total_amount = db.query(func.sum(Bundle.amount)).filter(
        Bundle.business_date == business_date
    ).scalar() or 0
    
    total_risks = db.query(func.count(RiskAlert.id)).filter(
        RiskAlert.business_date == business_date
    ).scalar() or 0
    
    pending_risks = db.query(func.count(RiskAlert.id)).filter(
        RiskAlert.business_date == business_date,
        RiskAlert.is_reviewed == False
    ).scalar() or 0
    
    teller_count = db.query(TellerPayment.teller_no).filter(
        TellerPayment.business_date == business_date
    ).distinct().count()
    
    atm_count = db.query(ATMPlan.atm_no).filter(
        ATMPlan.business_date == business_date
    ).distinct().count()
    
    return {
        "success": True,
        "data": {
            "business_date": business_date,
            "total_bundles": total_bundles,
            "total_amount": total_amount,
            "teller_count": teller_count,
            "atm_count": atm_count,
            "total_risks": total_risks,
            "pending_risks": pending_risks,
            "reviewed_risks": total_risks - pending_risks
        }
    }
