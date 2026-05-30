from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Arrangement, Rehearsal, Member
from app.schemas import ArrangementCreate, ArrangementUpdate, Arrangement as ArrangementSchema

router = APIRouter(prefix="/arrangements", tags=["arrangements"])


@router.get("/rehearsal/{rehearsal_id}", response_model=List[ArrangementSchema])
def list_arrangements(rehearsal_id: int, db: Session = Depends(get_db)):
    return db.query(Arrangement).filter(Arrangement.rehearsal_id == rehearsal_id).all()


@router.get("/{arrangement_id}", response_model=ArrangementSchema)
def get_arrangement(arrangement_id: int, db: Session = Depends(get_db)):
    arrangement = db.query(Arrangement).filter(Arrangement.id == arrangement_id).first()
    if not arrangement:
        raise HTTPException(status_code=404, detail=f"排表项ID[{arrangement_id}]不存在")
    return arrangement


@router.post("/", response_model=ArrangementSchema)
def create_arrangement(arrangement: ArrangementCreate, db: Session = Depends(get_db)):
    rehearsal = db.query(Rehearsal).filter(
        Rehearsal.id == arrangement.rehearsal_id
    ).first()
    if not rehearsal:
        raise HTTPException(status_code=404, detail=f"排练ID[{arrangement.rehearsal_id}]不存在")

    member = db.query(Member).filter(Member.id == arrangement.member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail=f"成员ID[{arrangement.member_id}]不存在")

    from app.business.position_conflict import PositionConflictDetector
    detector = PositionConflictDetector(db)

    if arrangement.position_row is not None and arrangement.position_col is not None:
        check_result = detector.validate_position(
            arrangement.rehearsal_id,
            arrangement.position_row,
            arrangement.position_col
        )
        if not check_result["valid"]:
            raise HTTPException(
                status_code=400,
                detail=check_result["message"]
            )

    db_arr = Arrangement(**arrangement.dict())
    db.add(db_arr)
    db.commit()
    db.refresh(db_arr)

    from app.business.history_tracker import HistoryTracker
    tracker = HistoryTracker(db)
    tracker.log_arrangement_create(
        arrangement.rehearsal_id,
        arrangement.member_id,
        arrangement.position_row,
        arrangement.position_col,
        arrangement.is_manual
    )

    return db_arr


@router.patch("/{arrangement_id}", response_model=ArrangementSchema)
def update_arrangement(arrangement_id: int, arr_update: ArrangementUpdate,
                       db: Session = Depends(get_db)):
    arrangement = db.query(Arrangement).filter(Arrangement.id == arrangement_id).first()
    if not arrangement:
        raise HTTPException(status_code=404, detail=f"排表项ID[{arrangement_id}]不存在")

    update_data = arr_update.dict(exclude_unset=True)

    from app.business.position_conflict import PositionConflictDetector
    detector = PositionConflictDetector(db)

    new_row = update_data.get("position_row", arrangement.position_row)
    new_col = update_data.get("position_col", arrangement.position_col)

    if new_row is not None and new_col is not None:
        check_result = detector.validate_position(
            arrangement.rehearsal_id,
            new_row,
            new_col,
            exclude_arrangement_id=arrangement_id
        )
        if not check_result["valid"]:
            raise HTTPException(
                status_code=400,
                detail=check_result["message"]
            )

    from app.business.history_tracker import HistoryTracker
    tracker = HistoryTracker(db)

    for key, value in update_data.items():
        old_value = str(getattr(arrangement, key))
        new_value = str(value)
        if old_value != new_value:
            tracker.log_arrangement_update(
                arrangement.rehearsal_id,
                arrangement_id,
                key,
                old_value,
                new_value,
                update_data.get("is_manual", arrangement.is_manual)
            )
        setattr(arrangement, key, value)

    db.commit()
    db.refresh(arrangement)
    return arrangement


@router.delete("/{arrangement_id}")
def delete_arrangement(arrangement_id: int, is_manual: bool = False, db: Session = Depends(get_db)):
    arrangement = db.query(Arrangement).filter(Arrangement.id == arrangement_id).first()
    if not arrangement:
        raise HTTPException(status_code=404, detail=f"排表项ID[{arrangement_id}]不存在")

    rehearsal_id = arrangement.rehearsal_id
    member_id = arrangement.member_id

    db.delete(arrangement)
    db.commit()

    from app.business.history_tracker import HistoryTracker
    tracker = HistoryTracker(db)
    tracker.log_arrangement_delete(rehearsal_id, arrangement_id, member_id, is_manual)

    return {"success": True, "message": "排表项已删除"}


@router.get("/rehearsal/{rehearsal_id}/conflicts")
def check_arrangement_conflicts(rehearsal_id: int, db: Session = Depends(get_db)):
    from app.business.position_conflict import PositionConflictDetector
    detector = PositionConflictDetector(db)
    return detector.detect_conflicts(rehearsal_id)


@router.post("/generate/{rehearsal_id}")
def generate_arrangement(rehearsal_id: int, db: Session = Depends(get_db)):
    rehearsal = db.query(Rehearsal).filter(Rehearsal.id == rehearsal_id).first()
    if not rehearsal:
        raise HTTPException(status_code=404, detail=f"排练ID[{rehearsal_id}]不存在")

    from app.business.orchestrator import ArrangementOrchestrator
    orchestrator = ArrangementOrchestrator(db)
    return orchestrator.generate_arrangement(rehearsal.rehearsal_date)


@router.post("/save/{rehearsal_id}")
def save_arrangement(rehearsal_id: int, arrangements: List[dict],
                     is_manual: bool = False, db: Session = Depends(get_db)):
    from app.business.orchestrator import ArrangementOrchestrator
    orchestrator = ArrangementOrchestrator(db)
    result = orchestrator.save_arrangement(rehearsal_id, arrangements, is_manual)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["error"])

    return result
