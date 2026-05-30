from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import StudentAnnotation
from schemas import StudentAnnotationCreate, StudentAnnotationOut
from audit import log_audit

router = APIRouter(prefix="/annotations", tags=["学生批注"])


@router.post("", response_model=StudentAnnotationOut)
def create_annotation(data: StudentAnnotationCreate, db: Session = Depends(get_db)):
    ann = StudentAnnotation(
        score_id=data.score_id,
        version_id=data.version_id,
        measure_number=data.measure_number,
        student_name=data.student_name,
        content=data.content,
        annotation_type=data.annotation_type,
    )
    db.add(ann)
    db.flush()
    log_audit(db, "annotate", "student_annotation", entity_id=ann.id, version_id=data.version_id, after={
        "student_name": data.student_name,
        "measure_number": data.measure_number,
        "content": data.content[:200],
    })
    db.commit()
    db.refresh(ann)
    return ann


@router.get("", response_model=List[StudentAnnotationOut])
def list_annotations(
    score_id: int,
    version_id: Optional[int] = None,
    resolved: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    q = db.query(StudentAnnotation).filter(StudentAnnotation.score_id == score_id)
    if version_id:
        q = q.filter(StudentAnnotation.version_id == version_id)
    if resolved is not None:
        q = q.filter(StudentAnnotation.is_resolved == resolved)
    return q.order_by(StudentAnnotation.created_at.desc()).all()


@router.patch("/{annotation_id}/resolve", response_model=StudentAnnotationOut)
def resolve_annotation(annotation_id: int, db: Session = Depends(get_db)):
    ann = db.query(StudentAnnotation).filter(StudentAnnotation.id == annotation_id).first()
    if not ann:
        raise HTTPException(404, "批注不存在")
    before = {"is_resolved": ann.is_resolved}
    ann.is_resolved = True
    ann.resolved_at = datetime.utcnow()
    db.flush()
    log_audit(db, "update", "student_annotation", entity_id=ann.id, version_id=ann.version_id,
              before=before, after={"is_resolved": True}, note="批注标记为已解决")
    db.commit()
    db.refresh(ann)
    return ann
