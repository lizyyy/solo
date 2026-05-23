from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_active_user, allow_supervisor, allow_all_authenticated
from app.models import User, SupervisorComment
from app.schemas import SupervisorCommentCreate, SupervisorComment as SupervisorCommentSchema

router = APIRouter()


@router.post("/", response_model=SupervisorCommentSchema, dependencies=[Depends(allow_supervisor)])
def create_comment(
    comment: SupervisorCommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_comment = SupervisorComment(
        **comment.model_dump(),
        created_by=current_user.id
    )
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment


@router.get("/", response_model=list[SupervisorCommentSchema])
def list_comments(
    skip: int = 0,
    limit: int = 100,
    related_type: Optional[str] = None,
    related_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(SupervisorComment)
    if related_type:
        query = query.filter(SupervisorComment.related_type == related_type)
    if related_id:
        query = query.filter(SupervisorComment.related_id == related_id)
    
    comments = query.order_by(SupervisorComment.comment_time.desc()).offset(skip).limit(limit).all()
    return comments


@router.get("/{comment_id}", response_model=SupervisorCommentSchema)
def get_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    comment = db.query(SupervisorComment).filter(SupervisorComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="批注不存在")
    return comment


@router.delete("/{comment_id}", dependencies=[Depends(allow_supervisor)])
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    db_comment = db.query(SupervisorComment).filter(SupervisorComment.id == comment_id).first()
    if not db_comment:
        raise HTTPException(status_code=404, detail="批注不存在")
    
    db.delete(db_comment)
    db.commit()
    return {"success": True, "message": "删除成功"}
