from sqlalchemy.orm import Session
from models import CouponSchedule, BondLedger, WarningSheet
from datetime import datetime


def check_duplicate_coupons(db: Session) -> dict:
    all_coupons = db.query(CouponSchedule).order_by(
        CouponSchedule.bond_id, CouponSchedule.payment_date, CouponSchedule.coupon_amount
    ).all()

    seen = {}
    duplicate_groups = []
    newly_flagged = []

    for c in all_coupons:
        key = (c.bond_id, str(c.payment_date), c.coupon_amount)
        if key in seen:
            if not seen[key].is_duplicate:
                seen[key].is_duplicate = True
                seen[key].quality_status = "suspect"
                if not seen[key].anomaly_notes:
                    seen[key].anomaly_notes = []
                seen[key].anomaly_notes.append(f"票息重复：与ID={c.id}（{c.payment_date}，{c.coupon_amount}万）重复")
                newly_flagged.append(seen[key].id)

            c.is_duplicate = True
            c.quality_status = "suspect"
            if not c.anomaly_notes:
                c.anomaly_notes = []
            c.anomaly_notes.append(f"票息重复：与ID={seen[key].id}（{seen[key].payment_date}，{seen[key].coupon_amount}万）重复")
            newly_flagged.append(c.id)

            group_key = key
            already = any(g["key"] == group_key for g in duplicate_groups)
            if not already:
                duplicate_groups.append({
                    "key": group_key,
                    "records": [seen[key].id, c.id],
                })
            else:
                for g in duplicate_groups:
                    if g["key"] == key:
                        if c.id not in g["records"]:
                            g["records"].append(c.id)
        else:
            seen[key] = c

    db.commit()

    affected_bonds = set()
    for g in duplicate_groups:
        for rid in g["records"]:
            coupon = db.query(CouponSchedule).filter(CouponSchedule.id == rid).first()
            if coupon:
                affected_bonds.add(coupon.bond_id)

    warning_results = []
    for bond_id in affected_bonds:
        bond = db.query(BondLedger).filter(BondLedger.id == bond_id).first()
        related_ids = []
        for g in duplicate_groups:
            for rid in g["records"]:
                coupon = db.query(CouponSchedule).filter(CouponSchedule.id == rid).first()
                if coupon and coupon.bond_id == bond_id:
                    related_ids.extend(g["records"])
        related_ids = list(set(related_ids))
        w = WarningSheet(
            bond_id=bond_id,
            warning_type="票息重复",
            warning_level="medium",
            description=f"债券{bond.bond_code if bond else bond_id}存在{len(related_ids)}条重复票息记录",
            affected_records=[{"table": "coupon_schedule", "ids": related_ids}],
            status="open",
            source_type="system",
            source_detail="票息去重校验自动生成",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(w)
        warning_results.append({
            "bond_id": bond_id,
            "bond_code": bond.bond_code if bond else None,
            "duplicate_count": len(related_ids),
            "affected_ids": related_ids,
        })

    db.commit()

    return {
        "total_scanned": len(all_coupons),
        "duplicate_groups": len(duplicate_groups),
        "newly_flagged_ids": newly_flagged,
        "warnings_created": len(warning_results),
        "details": duplicate_groups,
        "warning_summaries": warning_results,
    }
