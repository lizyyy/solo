from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .database import get_db
from . import services

router = APIRouter()


class RecordItem(BaseModel):
    raw_data: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    metric_x: Optional[float] = None
    metric_y: Optional[float] = None
    metric_z: Optional[float] = None
    distance: Optional[float] = None
    recorded_at: Optional[str] = None
    model_params_version: Optional[str] = None
    model_params_reason: Optional[str] = None


class ImportRequest(BaseModel):
    batch_id: str
    records: List[RecordItem]


class RemarkRequest(BaseModel):
    record_id: str
    author: str
    content: str


class RemarkUpdateRequest(BaseModel):
    new_content: str
    changed_by: str
    reason: Optional[str] = None


class CrewBriefingRequest(BaseModel):
    record_id: str
    why_kept: str
    missing_materials: str
    next_step_owner: str
    next_step_description: str
    param_version: Optional[str] = None
    param_tradeoff_reason: Optional[str] = None


@router.post("/import")
def import_records(req: ImportRequest, db: Session = Depends(get_db)):
    records = [r.model_dump() for r in req.records]
    result = services.import_rangefinder_records(db, req.batch_id, records)
    return result


@router.post("/remark")
def add_remark(req: RemarkRequest, db: Session = Depends(get_db)):
    try:
        remark = services.add_obstacle_remark(db, req.record_id, req.author, req.content)
        return {"id": remark.id, "created_at": remark.created_at}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/remark/{remark_id}")
def update_remark(remark_id: str, req: RemarkUpdateRequest, db: Session = Depends(get_db)):
    try:
        remark = services.update_obstacle_remark(
            db, remark_id, req.new_content, req.changed_by, req.reason
        )
        return {"id": remark.id, "updated_at": remark.updated_at}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/remark/{remark_id}/history")
def remark_history(remark_id: str, db: Session = Depends(get_db)):
    logs = services.get_remark_change_history(db, remark_id)
    return [
        {
            "id": l.id,
            "field_name": l.field_name,
            "old_value": l.old_value,
            "new_value": l.new_value,
            "changed_by": l.changed_by,
            "changed_at": l.changed_at,
            "reason": l.reason,
        }
        for l in logs
    ]


@router.post("/crew-briefing")
def crew_briefing(req: CrewBriefingRequest, db: Session = Depends(get_db)):
    try:
        report = services.update_crew_briefing(
            db,
            req.record_id,
            req.why_kept,
            req.missing_materials,
            req.next_step_owner,
            req.next_step_description,
            req.param_version,
            req.param_tradeoff_reason,
        )
        return {"id": report.id, "generated_at": report.generated_at}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/traceback/{record_id}")
def traceback(record_id: str, db: Session = Depends(get_db)):
    try:
        return services.get_traceback(db, record_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/snapshot-history/{record_id}")
def snapshot_history(record_id: str, db: Session = Depends(get_db)):
    snapshots = services.get_snapshot_history(db, record_id)
    return [
        {
            "id": s.id,
            "stage": s.stage.value,
            "snapshot_data": s.snapshot_data,
            "model_params_version": s.model_params_version,
            "model_params_reason": s.model_params_reason,
            "created_at": s.created_at,
        }
        for s in snapshots
    ]


@router.get("/report/{report_id}")
def get_report(report_id: str, db: Session = Depends(get_db)):
    try:
        text = services.generate_report_text(db, report_id)
        return {"report_text": text}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/records")
def list_records(
    batch_id: Optional[str] = None,
    coord_type: Optional[str] = None,
    needs_review: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    from .models import RangefinderRecord
    q = db.query(RangefinderRecord)
    if batch_id:
        q = q.filter(RangefinderRecord.batch_id == batch_id)
    if coord_type:
        q = q.filter(RangefinderRecord.coord_type == coord_type)
    if needs_review is not None:
        q = q.filter(RangefinderRecord.needs_review == needs_review)
    records = q.all()
    return [
        {
            "id": r.id,
            "batch_id": r.batch_id,
            "coord_type": r.coord_type.value,
            "needs_review": r.needs_review,
            "distance": r.distance,
            "recorded_at": r.recorded_at,
            "imported_at": r.imported_at,
        }
        for r in records
    ]
