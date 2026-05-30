from sqlalchemy.orm import Session
from models import BondLedger, CouponSchedule, RedemptionNotice, CustodyReceipt, WarningSheet
from schemas import ReceiptMatchResult
from datetime import datetime


def match_receipts(db: Session) -> ReceiptMatchResult:
    matched = []
    missing_receipt = []
    unmatched_receipt = []

    receipts = db.query(CustodyReceipt).all()
    for r in receipts:
        r.is_matched = False
        r.matched_to = None

    receipt_lookup = {}
    for r in receipts:
        key = (r.bond_id, str(r.receipt_date))
        if key not in receipt_lookup:
            receipt_lookup[key] = []
        receipt_lookup[key].append(r)

    coupons = db.query(CouponSchedule).filter(CouponSchedule.is_duplicate == False).all()
    coupon_matched = set()
    for c in coupons:
        bond = db.query(BondLedger).filter(BondLedger.id == c.bond_id).first()
        key = (c.bond_id, str(c.payment_date))
        found = receipt_lookup.get(key, [])
        if found:
            r = found[0]
            r.is_matched = True
            existing_to = r.matched_to or ""
            r.matched_to = f"{existing_to};coupon_schedule:{c.id}".strip(";")
            coupon_matched.add(c.id)
            matched.append({
                "receipt_id": r.id,
                "bond_code": bond.bond_code if bond else None,
                "receipt_date": str(r.receipt_date),
                "receipt_amount": r.receipt_amount,
                "matched_to": f"票息ID={c.id}",
                "coupon_amount": c.coupon_amount,
            })
        else:
            missing_receipt.append({
                "bond_id": c.bond_id,
                "bond_code": bond.bond_code if bond else None,
                "flow_type": "票息",
                "payment_date": str(c.payment_date),
                "expected_amount": c.coupon_amount,
            })

    notices = db.query(RedemptionNotice).filter(RedemptionNotice.is_latest == True).all()
    for n in notices:
        bond = db.query(BondLedger).filter(BondLedger.id == n.bond_id).first()
        key = (n.bond_id, str(n.redemption_date))
        found = receipt_lookup.get(key, [])
        if found:
            r = found[0]
            r.is_matched = True
            existing_to = r.matched_to or ""
            r.matched_to = f"{existing_to};redemption_notice:{n.id}".strip(";")
            matched.append({
                "receipt_id": r.id,
                "bond_code": bond.bond_code if bond else None,
                "receipt_date": str(r.receipt_date),
                "receipt_amount": r.receipt_amount,
                "matched_to": f"赎回公告ID={n.id}",
                "redemption_price": n.redemption_price,
            })
        else:
            missing_receipt.append({
                "bond_id": n.bond_id,
                "bond_code": bond.bond_code if bond else None,
                "flow_type": "赎回本金",
                "payment_date": str(n.redemption_date),
                "expected_amount": n.redemption_price,
            })

    for r in receipts:
        if not r.is_matched:
            bond = db.query(BondLedger).filter(BondLedger.id == r.bond_id).first()
            unmatched_receipt.append({
                "receipt_id": r.id,
                "bond_code": bond.bond_code if bond else None,
                "receipt_date": str(r.receipt_date),
                "receipt_amount": r.receipt_amount,
                "receipt_no": r.receipt_no,
            })

    db.commit()

    if missing_receipt:
        w = WarningSheet(
            warning_type="托管回执缺失",
            warning_level="high",
            description=f"共{len(missing_receipt)}笔现金流缺少托管回执",
            affected_records=[{"table": "missing_receipt", "count": len(missing_receipt)}],
            status="open",
            source_type="system",
            source_detail="回执匹配校验自动生成",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(w)

    if unmatched_receipt:
        w = WarningSheet(
            warning_type="回执无匹配",
            warning_level="medium",
            description=f"共{len(unmatched_receipt)}笔回执未匹配到预期现金流",
            affected_records=[{"table": "unmatched_receipt", "count": len(unmatched_receipt)}],
            status="open",
            source_type="system",
            source_detail="回执匹配校验自动生成",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(w)

    db.commit()

    return ReceiptMatchResult(
        matched=matched,
        missing_receipt=missing_receipt,
        unmatched_receipt=unmatched_receipt,
    )
