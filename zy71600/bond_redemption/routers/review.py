from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import (
    BondLedger, CouponSchedule, RedemptionNotice,
    CustodyReceipt, FundCalendar, WarningSheet,
)
from schemas import WarningSheetOut, WarningResolve
from datetime import datetime

router = APIRouter()


@router.get("/warnings", response_model=List[WarningSheetOut])
def list_warnings(
    status: Optional[str] = None,
    warning_type: Optional[str] = None,
    warning_level: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    q = db.query(WarningSheet)
    if status:
        q = q.filter(WarningSheet.status == status)
    if warning_type:
        q = q.filter(WarningSheet.warning_type == warning_type)
    if warning_level:
        q = q.filter(WarningSheet.warning_level == warning_level)
    return q.order_by(WarningSheet.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/warnings/{warning_id}", response_model=WarningSheetOut)
def get_warning(warning_id: int, db: Session = Depends(get_db)):
    w = db.query(WarningSheet).filter(WarningSheet.id == warning_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="预警单不存在")
    return w


@router.put("/warnings/{warning_id}/resolve", response_model=WarningSheetOut)
def resolve_warning(warning_id: int, data: WarningResolve, db: Session = Depends(get_db)):
    w = db.query(WarningSheet).filter(WarningSheet.id == warning_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="预警单不存在")
    if w.status == "resolved":
        raise HTTPException(status_code=400, detail="该预警已复核通过")
    w.status = "resolved"
    w.resolution = data.resolution
    w.resolved_by = data.resolved_by
    w.resolved_at = datetime.now()
    w.updated_at = datetime.now()
    db.commit()
    db.refresh(w)
    return w


@router.put("/warnings/{warning_id}/reject", response_model=WarningSheetOut)
def reject_warning(warning_id: int, data: WarningResolve, db: Session = Depends(get_db)):
    w = db.query(WarningSheet).filter(WarningSheet.id == warning_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="预警单不存在")
    w.status = "rejected"
    w.resolution = data.resolution
    w.resolved_by = data.resolved_by
    w.resolved_at = datetime.now()
    w.updated_at = datetime.now()
    db.commit()
    db.refresh(w)
    return w


@router.get("/impact/{warning_id}")
def get_warning_impact(warning_id: int, db: Session = Depends(get_db)):
    w = db.query(WarningSheet).filter(WarningSheet.id == warning_id).first()
    if not w:
        raise HTTPException(status_code=404, detail="预警单不存在")

    impact = {
        "warning_id": w.id,
        "warning_type": w.warning_type,
        "description": w.description,
        "affected_records": w.affected_records or [],
        "related_flows": [],
    }

    if w.bond_id:
        bond = db.query(BondLedger).filter(BondLedger.id == w.bond_id).first()
        impact["bond_info"] = {
            "bond_code": bond.bond_code,
            "bond_name": bond.bond_name,
            "face_value": bond.face_value,
            "status": bond.status,
        } if bond else None

        coupons = db.query(CouponSchedule).filter(
            CouponSchedule.bond_id == w.bond_id,
            CouponSchedule.quality_status != "normal",
        ).all()
        for c in coupons:
            impact["related_flows"].append({
                "type": "票息",
                "id": c.id,
                "date": str(c.payment_date),
                "amount": c.coupon_amount,
                "quality": c.quality_status,
                "notes": c.anomaly_notes,
            })

        notices = db.query(RedemptionNotice).filter(
            RedemptionNotice.bond_id == w.bond_id,
            RedemptionNotice.quality_status != "normal",
        ).all()
        for n in notices:
            impact["related_flows"].append({
                "type": "赎回公告",
                "id": n.id,
                "date": str(n.redemption_date),
                "amount": n.redemption_price,
                "quality": n.quality_status,
                "is_late": n.is_late,
                "notes": n.anomaly_notes,
            })

    for ar in (w.affected_records or []):
        if isinstance(ar, dict):
            table = ar.get("table", "")
            ids = ar.get("ids", [])
            if table == "coupon_schedule" and ids:
                for cid in ids:
                    c = db.query(CouponSchedule).filter(CouponSchedule.id == cid).first()
                    if c:
                        bond = db.query(BondLedger).filter(BondLedger.id == c.bond_id).first()
                        impact["related_flows"].append({
                            "type": "票息（受影响）",
                            "id": c.id,
                            "bond_code": bond.bond_code if bond else None,
                            "date": str(c.payment_date),
                            "amount": c.coupon_amount,
                            "quality": c.quality_status,
                            "duplicate": c.is_duplicate,
                        })

    return impact


@router.get("/anomaly-summary")
def anomaly_summary(db: Session = Depends(get_db)):
    suspect_coupons = db.query(CouponSchedule).filter(CouponSchedule.quality_status != "normal").count()
    total_coupons = db.query(CouponSchedule).count()

    late_notices = db.query(RedemptionNotice).filter(RedemptionNotice.is_late == True).count()
    total_notices = db.query(RedemptionNotice).count()

    unmatched_receipts = db.query(CustodyReceipt).filter(CustodyReceipt.is_matched == False).count()
    total_receipts = db.query(CustodyReceipt).count()

    open_warnings = db.query(WarningSheet).filter(WarningSheet.status == "open").count()
    resolved_warnings = db.query(WarningSheet).filter(WarningSheet.status == "resolved").count()

    return {
        "coupon": {"total": total_coupons, "anomaly": suspect_coupons, "anomaly_rate": f"{suspect_coupons/max(total_coupons,1)*100:.1f}%"},
        "notice": {"total": total_notices, "late": late_notices, "late_rate": f"{late_notices/max(total_notices,1)*100:.1f}%"},
        "receipt": {"total": total_receipts, "unmatched": unmatched_receipts, "unmatched_rate": f"{unmatched_receipts/max(total_receipts,1)*100:.1f}%"},
        "warnings": {"open": open_warnings, "resolved": resolved_warnings},
    }
