from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Notification, NotificationStatus
from app.schemas import NotificationRead, NotificationCreate, ErrorResponse

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/", response_model=List[NotificationRead])
def list_notifications(
    status: Optional[NotificationStatus] = Query(None),
    recipient: Optional[str] = Query(None),
    notification_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Notification)
    if status:
        q = q.filter(Notification.status == status)
    if recipient:
        q = q.filter(Notification.recipient.contains(recipient))
    if notification_type:
        q = q.filter(Notification.notification_type == notification_type)
    return [NotificationRead.model_validate(n) for n in q.order_by(Notification.created_at.desc()).all()]


@router.get("/{notification_id}", response_model=NotificationRead, responses={404: {"model": ErrorResponse}})
def get_notification(notification_id: int, db: Session = Depends(get_db)):
    n = db.query(Notification).get(notification_id)
    if not n:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "通知不存在", "detail": f"notification_id={notification_id}"})
    return NotificationRead.model_validate(n)


@router.post("/", response_model=NotificationRead, status_code=201)
def create_notification(data: NotificationCreate, db: Session = Depends(get_db)):
    n = Notification(**data.model_dump())
    db.add(n)
    db.commit()
    db.refresh(n)
    return NotificationRead.model_validate(n)


@router.post("/{notification_id}/send", response_model=NotificationRead, responses={404: {"model": ErrorResponse}})
def send_notification(notification_id: int, db: Session = Depends(get_db)):
    from datetime import datetime

    n = db.query(Notification).get(notification_id)
    if not n:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "通知不存在", "detail": f"notification_id={notification_id}"})

    n.status = NotificationStatus.SENT
    n.sent_at = datetime.utcnow()
    db.commit()
    db.refresh(n)
    return NotificationRead.model_validate(n)


@router.post("/{notification_id}/read", response_model=NotificationRead, responses={404: {"model": ErrorResponse}})
def mark_read(notification_id: int, db: Session = Depends(get_db)):
    from datetime import datetime

    n = db.query(Notification).get(notification_id)
    if not n:
        raise HTTPException(status_code=404, detail={"code": 404, "message": "通知不存在", "detail": f"notification_id={notification_id}"})

    n.status = NotificationStatus.READ
    n.read_at = datetime.utcnow()
    db.commit()
    db.refresh(n)
    return NotificationRead.model_validate(n)
