from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import FingeringAnnotation, Measure
from schemas import FingeringAnnotationCreate, FingeringAnnotationOut, MeasureCreate, MeasureOut
from audit import log_audit

router = APIRouter(prefix="/fingering", tags=["指法标注"])


@router.post("/annotations", response_model=FingeringAnnotationOut)
def create_fingering(data: FingeringAnnotationCreate, db: Session = Depends(get_db)):
    fa = FingeringAnnotation(
        score_id=data.score_id,
        version_id=data.version_id,
        measure_number=data.measure_number,
        position_in_measure=data.position_in_measure,
        jianzi_char=data.jianzi_char,
        fingering_type=data.fingering_type,
        hand=data.hand,
        string_number=data.string_number,
        technique_detail=data.technique_detail,
        is_manual_correction=data.is_manual_correction,
        correction_reason=data.correction_reason,
    )
    db.add(fa)
    db.flush()
    log_audit(db, "create", "fingering_annotation", entity_id=fa.id, version_id=data.version_id, after={
        "measure_number": data.measure_number,
        "jianzi_char": data.jianzi_char,
        "fingering_type": data.fingering_type,
        "is_manual_correction": data.is_manual_correction,
    })
    db.commit()
    db.refresh(fa)
    return fa


@router.get("/annotations", response_model=List[FingeringAnnotationOut])
def list_fingerings(
    score_id: int,
    version_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(FingeringAnnotation).filter(FingeringAnnotation.score_id == score_id)
    if version_id:
        q = q.filter(FingeringAnnotation.version_id == version_id)
    return q.order_by(FingeringAnnotation.measure_number, FingeringAnnotation.position_in_measure).all()


@router.post("/measures", response_model=MeasureOut)
def create_measure(data: MeasureCreate, db: Session = Depends(get_db)):
    m = Measure(
        score_id=data.score_id,
        version_id=data.version_id,
        measure_number=data.measure_number,
        start_position=data.start_position,
        end_position=data.end_position,
        beat_count=data.beat_count,
        time_signature=data.time_signature,
        is_manually_adjusted=data.is_manually_adjusted,
    )
    db.add(m)
    db.flush()
    log_audit(db, "create", "measure", entity_id=m.id, version_id=data.version_id, after={
        "measure_number": data.measure_number,
        "start_position": data.start_position,
        "end_position": data.end_position,
        "is_manually_adjusted": data.is_manually_adjusted,
    })
    db.commit()
    db.refresh(m)
    return m


@router.get("/measures", response_model=List[MeasureOut])
def list_measures(
    score_id: int,
    version_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Measure).filter(Measure.score_id == score_id)
    if version_id:
        q = q.filter(Measure.version_id == version_id)
    return q.order_by(Measure.measure_number).all()
