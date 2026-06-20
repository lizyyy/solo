from ..models import CollisionRecord, CollisionHistory
from sqlalchemy.orm import Session


def _fmt_dt(dt):
    if dt is None:
        return ""
    return dt.isoformat() if hasattr(dt, 'isoformat') else str(dt)


def _record_to_out(r: CollisionRecord, db: Session):
    history = (
        db.query(CollisionHistory)
        .filter(CollisionHistory.collision_id == r.id)
        .order_by(CollisionHistory.created_at.desc())
        .all()
    )
    return {
        "id": r.id,
        "projectName": r.project_name,
        "floor": r.floor,
        "nodeCode": r.node_code,
        "collisionType": r.collision_type,
        "elementA": r.element_a,
        "elementB": r.element_b,
        "status": r.status,
        "initialConclusion": r.initial_conclusion,
        "screenshots": r.screenshots or [],
        "clueChain": r.clue_chain or [],
        "history": [
            {
                "id": h.id,
                "collisionId": h.collision_id,
                "previousStatus": h.previous_status,
                "newStatus": h.new_status,
                "reason": h.reason,
                "operator": h.operator,
                "timestamp": _fmt_dt(h.created_at),
                "evidenceUrls": h.evidence_urls or [],
            }
            for h in history
        ],
        "isCoordinateOffset": bool(r.is_coordinate_offset),
        "coordinateOffsetNote": r.coordinate_offset_note,
        "rejudgeCount": r.rejudge_count or 0,
        "responsiblePerson": r.responsible_person,
        "isSample": bool(r.is_sample),
        "createdAt": _fmt_dt(r.created_at),
        "updatedAt": _fmt_dt(r.updated_at),
    }
