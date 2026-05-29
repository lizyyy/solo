from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Homework, Comment
from schemas import CommentCreate, CommentResponse, VALID_COMMENT_TYPES

router = APIRouter(prefix="/api/homework", tags=["comments"])


@router.post("/{homework_id}/comments", response_model=CommentResponse, status_code=201)
def add_comment(
    homework_id: int,
    comment: CommentCreate,
    db: Session = Depends(get_db),
):
    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")

    if comment.comment_type not in VALID_COMMENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid comment_type. Must be one of: {VALID_COMMENT_TYPES}",
        )

    c = Comment(
        homework_id=homework_id,
        teacher_comment=comment.teacher_comment,
        comment_type=comment.comment_type,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/{homework_id}/comments", response_model=list[CommentResponse])
def list_comments(
    homework_id: int,
    comment_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    hw = db.query(Homework).filter(Homework.id == homework_id).first()
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")

    query = db.query(Comment).filter(Comment.homework_id == homework_id)
    if comment_type:
        query = query.filter(Comment.comment_type == comment_type)
    return query.order_by(Comment.created_at.desc()).all()
