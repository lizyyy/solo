from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import TeacherComment, AuditLog
from schemas import CommentCreate, CommentOut

router = APIRouter(prefix="/api/comments", tags=["comments"])


@router.post("", response_model=CommentOut)
def create_comment(data: CommentCreate, db: Session = Depends(get_db)):
    existing_current = (
        db.query(TeacherComment)
        .filter(
            TeacherComment.student_id == data.student_id,
            TeacherComment.week_start == data.week_start,
            TeacherComment.is_current == True,
        )
        .first()
    )

    if existing_current:
        before_state = {
            "id": existing_current.id,
            "content": existing_current.content,
            "version": existing_current.version,
            "is_current": True,
        }
        existing_current.is_current = False
        new_version = existing_current.version + 1
        db.commit()

        new_comment = TeacherComment(
            student_id=data.student_id,
            week_start=data.week_start,
            week_end=data.week_end,
            content=data.content,
            version=new_version,
            supersedes_id=existing_current.id,
            is_current=True,
        )
        db.add(new_comment)
        db.commit()
        db.refresh(new_comment)

        after_state = {
            "id": new_comment.id,
            "content": new_comment.content,
            "version": new_comment.version,
            "supersedes_id": existing_current.id,
            "is_current": True,
        }
        _log_audit(
            db,
            "teacher_comment",
            new_comment.id,
            "override",
            before_state,
            after_state,
        )

        return new_comment

    new_comment = TeacherComment(
        student_id=data.student_id,
        week_start=data.week_start,
        week_end=data.week_end,
        content=data.content,
        version=1,
        is_current=True,
    )
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)

    _log_audit(
        db,
        "teacher_comment",
        new_comment.id,
        "create",
        None,
        {"id": new_comment.id, "content": new_comment.content, "version": 1},
    )

    return new_comment


@router.get("/history/{student_id}")
def get_comment_history(
    student_id: int,
    week_start: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    query = db.query(TeacherComment).filter(
        TeacherComment.student_id == student_id
    )
    if week_start:
        query = query.filter(TeacherComment.week_start == week_start)

    comments = query.order_by(TeacherComment.week_start.desc(), TeacherComment.version.desc()).all()

    history = []
    for c in comments:
        entry = {
            "id": c.id,
            "week_start": c.week_start.isoformat(),
            "week_end": c.week_end.isoformat(),
            "content": c.content,
            "version": c.version,
            "supersedes_id": c.supersedes_id,
            "is_current": c.is_current,
            "created_at": c.created_at.isoformat(),
        }
        if c.supersedes_id:
            superseded = db.query(TeacherComment).get(c.supersedes_id)
            if superseded:
                entry["supersedes_content"] = superseded.content
                entry["supersedes_version"] = superseded.version
        history.append(entry)

    return {"student_id": student_id, "history": history}


@router.get("/current/{student_id}", response_model=Optional[CommentOut])
def get_current_comment(
    student_id: int,
    week_start: datetime = ...,
    db: Session = Depends(get_db),
):
    comment = (
        db.query(TeacherComment)
        .filter(
            TeacherComment.student_id == student_id,
            TeacherComment.week_start == week_start,
            TeacherComment.is_current == True,
        )
        .first()
    )
    if not comment:
        return None
    return comment


def _log_audit(db, entity_type, entity_id, action, before, after):
    log = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        before_state=before,
        after_state=after,
        operator="teacher",
    )
    db.add(log)
    db.commit()
