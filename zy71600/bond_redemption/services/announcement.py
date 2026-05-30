from sqlalchemy.orm import Session
from models import RedemptionNotice
from datetime import datetime


def manage_notice_versions(db: Session, bond_id: int) -> dict:
    notices = db.query(RedemptionNotice).filter(
        RedemptionNotice.bond_id == bond_id
    ).order_by(RedemptionNotice.notice_version).all()

    if not notices:
        return {"bond_id": bond_id, "versions": 0, "latest": None}

    for n in notices:
        n.is_latest = False
    notices[-1].is_latest = True
    db.commit()

    version_list = []
    for n in notices:
        version_list.append({
            "id": n.id,
            "version": n.notice_version,
            "notice_date": str(n.notice_date),
            "redemption_date": str(n.redemption_date),
            "redemption_price": n.redemption_price,
            "is_latest": n.is_latest,
            "is_late": n.is_late,
            "quality_status": n.quality_status,
        })

    latest = notices[-1]
    return {
        "bond_id": bond_id,
        "versions": len(notices),
        "latest": {
            "id": latest.id,
            "version": latest.notice_version,
            "notice_date": str(latest.notice_date),
            "redemption_date": str(latest.redemption_date),
            "redemption_price": latest.redemption_price,
            "is_late": latest.is_late,
        },
        "all_versions": version_list,
    }
