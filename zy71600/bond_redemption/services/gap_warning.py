from datetime import date
from sqlalchemy.orm import Session
from models import BondLedger, CouponSchedule, RedemptionNotice, FundCalendar, WarningSheet
from schemas import CashFlowItem
from datetime import datetime


def detect_gaps(db: Session, start_date: date = None, end_date: date = None) -> dict:
    outflows = {}

    coupons = db.query(CouponSchedule).filter(CouponSchedule.is_duplicate == False)
    if start_date:
        coupons = coupons.filter(CouponSchedule.payment_date >= start_date)
    if end_date:
        coupons = coupons.filter(CouponSchedule.payment_date <= end_date)
    for c in coupons.all():
        d = str(c.payment_date)
        if d not in outflows:
            outflows[d] = 0.0
        outflows[d] += c.coupon_amount

    notices = db.query(RedemptionNotice).filter(RedemptionNotice.is_latest == True)
    if start_date:
        notices = notices.filter(RedemptionNotice.redemption_date >= start_date)
    if end_date:
        notices = notices.filter(RedemptionNotice.redemption_date <= end_date)
    for n in notices.all():
        d = str(n.redemption_date)
        if d not in outflows:
            outflows[d] = 0.0
        outflows[d] += n.redemption_price

    gaps = []
    for d_str, outflow_amount in sorted(outflows.items()):
        cal = db.query(FundCalendar).filter(FundCalendar.calendar_date == d_str).first()
        available = cal.expected_inflow if cal else 0.0
        gap = outflow_amount - available
        if gap > 0:
            gaps.append({
                "date": d_str,
                "outflow": outflow_amount,
                "available_funds": available,
                "gap": gap,
                "has_calendar": cal is not None,
                "calendar_quality": cal.quality_status if cal else None,
            })

    warning_results = []
    for g in gaps:
        level = "high" if g["gap"] > 1000 else ("medium" if g["gap"] > 100 else "info")
        if not g["has_calendar"]:
            level = "high"
        w = WarningSheet(
            warning_type="资金缺口",
            warning_level=level,
            description=f"{g['date']}资金缺口{g['gap']:.2f}万元（需求{g['outflow']:.2f}，可用{g['available_funds']:.2f}）",
            affected_records=[{"date": g["date"], "gap": g["gap"]}],
            status="open",
            source_type="system",
            source_detail="缺口预警自动生成",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(w)
        warning_results.append({
            "warning_id": None,
            "date": g["date"],
            "gap": g["gap"],
            "level": level,
        })

    db.commit()

    for i, w in enumerate(db.query(WarningSheet).filter(
        WarningSheet.warning_type == "资金缺口",
        WarningSheet.source_detail == "缺口预警自动生成"
    ).order_by(WarningSheet.id.desc()).limit(len(gaps)).all()):
        if i < len(warning_results):
            warning_results[i]["warning_id"] = w.id

    return {
        "total_outflow_dates": len(outflows),
        "gap_dates": len(gaps),
        "total_gap_amount": sum(g["gap"] for g in gaps),
        "gaps": gaps,
        "warnings_created": len(warning_results),
        "warning_summaries": warning_results,
    }
