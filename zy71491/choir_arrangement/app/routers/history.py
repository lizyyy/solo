from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.business.history_tracker import HistoryTracker
from app.schemas import ArrangementHistoryCreate, ArrangementHistory as ArrangementHistorySchema

router = APIRouter(prefix="/history", tags=["history"])


@router.get("/", response_model=List[ArrangementHistorySchema])
def list_history(rehearsal_id: int = None, action_type: str = None,
                 limit: int = 100, db: Session = Depends(get_db)):
    tracker = HistoryTracker(db)
    return tracker.get_history(rehearsal_id, action_type, limit)


@router.get("/rehearsal/{rehearsal_id}", response_model=List[ArrangementHistorySchema])
def get_rehearsal_history(rehearsal_id: int, limit: int = 100, db: Session = Depends(get_db)):
    tracker = HistoryTracker(db)
    return tracker.get_history(rehearsal_id=rehearsal_id, limit=limit)


@router.post("/log")
def log_manual_change(history_entry: ArrangementHistoryCreate, db: Session = Depends(get_db)):
    tracker = HistoryTracker(db)
    entry = tracker.log_change(
        rehearsal_id=history_entry.rehearsal_id,
        action_type=history_entry.action_type,
        field_name=history_entry.field_name,
        old_value=history_entry.old_value,
        new_value=history_entry.new_value,
        changed_by=history_entry.changed_by,
        reason=history_entry.reason
    )
    return {"success": True, "history_id": entry.id}


@router.get("/rehearsal/{rehearsal_id}/manual-changes")
def get_manual_changes(rehearsal_id: int, db: Session = Depends(get_db)):
    tracker = HistoryTracker(db)
    all_history = tracker.get_history(rehearsal_id=rehearsal_id)

    manual_changes = [
        h for h in all_history
        if h.changed_by == "manual" or h.action_type == "manual_override"
    ]

    return {
        "rehearsal_id": rehearsal_id,
        "manual_change_count": len(manual_changes),
        "changes": manual_changes
    }


@router.get("/action-types")
def get_action_types(db: Session = Depends(get_db)):
    from app.models import ArrangementHistory
    from sqlalchemy import distinct

    types = db.query(distinct(ArrangementHistory.action_type)).all()
    return {
        "action_types": [t[0] for t in types]
    }
