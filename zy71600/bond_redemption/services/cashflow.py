from datetime import date
from sqlalchemy.orm import Session
from models import BondLedger, CouponSchedule, RedemptionNotice, CustodyReceipt, FundCalendar, WarningSheet
from schemas import CashFlowItem, CashFlowSchedule, ReceiptMatchResult


def build_cashflow_schedule(db: Session, start_date: date = None, end_date: date = None) -> CashFlowSchedule:
    items = []

    coupons = db.query(CouponSchedule).filter(CouponSchedule.is_duplicate == False)
    if start_date:
        coupons = coupons.filter(CouponSchedule.payment_date >= start_date)
    if end_date:
        coupons = coupons.filter(CouponSchedule.payment_date <= end_date)
    for c in coupons.all():
        bond = db.query(BondLedger).filter(BondLedger.id == c.bond_id).first()
        items.append(CashFlowItem(
            date=c.payment_date,
            bond_code=bond.bond_code if bond else "UNKNOWN",
            bond_name=bond.bond_name if bond else "UNKNOWN",
            flow_type="票息支出",
            amount=c.coupon_amount,
            source_table="coupon_schedule",
            source_id=c.id,
            quality_status=c.quality_status,
            anomaly_notes=c.anomaly_notes,
        ))

    notices = db.query(RedemptionNotice).filter(RedemptionNotice.is_latest == True)
    if start_date:
        notices = notices.filter(RedemptionNotice.redemption_date >= start_date)
    if end_date:
        notices = notices.filter(RedemptionNotice.redemption_date <= end_date)
    for n in notices.all():
        bond = db.query(BondLedger).filter(BondLedger.id == n.bond_id).first()
        items.append(CashFlowItem(
            date=n.redemption_date,
            bond_code=bond.bond_code if bond else "UNKNOWN",
            bond_name=bond.bond_name if bond else "UNKNOWN",
            flow_type="赎回本金",
            amount=n.redemption_price,
            source_table="redemption_notice",
            source_id=n.id,
            quality_status=n.quality_status,
            anomaly_notes=n.anomaly_notes,
        ))

    items.sort(key=lambda x: x.date)

    total_outflow = sum(i.amount for i in items)
    total_inflow = 0.0
    if start_date and end_date:
        cal_entries = db.query(FundCalendar).filter(
            FundCalendar.calendar_date >= start_date,
            FundCalendar.calendar_date <= end_date,
        ).all()
        total_inflow = sum(c.expected_inflow for c in cal_entries)

    gap_items = []
    for item in items:
        if item.quality_status != "normal":
            gap_items.append(item)
        else:
            cal = db.query(FundCalendar).filter(FundCalendar.calendar_date == item.date).first()
            if cal and cal.expected_inflow < item.amount:
                gap_items.append(item)

    warnings = []
    for gi in gap_items:
        w_type = "数据异常" if gi.quality_status != "normal" else "资金缺口"
        w_level = "high" if gi.quality_status == "error" else ("medium" if gi.quality_status == "suspect" else "info")
        warnings.append({
            "date": str(gi.date),
            "bond_code": gi.bond_code,
            "flow_type": gi.flow_type,
            "amount": gi.amount,
            "warning_type": w_type,
            "warning_level": w_level,
            "notes": gi.anomaly_notes,
        })

    return CashFlowSchedule(
        items=items,
        total_outflow=total_outflow,
        total_inflow=total_inflow,
        gap_items=gap_items,
        warnings=warnings,
    )
