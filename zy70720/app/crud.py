from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime

from app import models, schemas
from app.models import IncidentStatus, SubscriberStatus


def get_incident(db: Session, incident_id: str):
    return db.query(models.Incident).filter(models.Incident.id == incident_id).first()


def get_incidents(db: Session, skip: int = 0, limit: int = 100, is_active: Optional[bool] = None):
    query = db.query(models.Incident)
    if is_active is not None:
        query = query.filter(models.Incident.is_active == is_active)
    return query.offset(skip).limit(limit).all()


def create_incident(db: Session, incident: schemas.IncidentCreate):
    db_incident = models.Incident(
        id=incident.id,
        title=incident.title,
        description=incident.description
    )
    db.add(db_incident)
    db.commit()
    db.refresh(db_incident)
    return db_incident


def update_incident(db: Session, incident_id: str, incident_update: schemas.IncidentUpdate):
    db_incident = get_incident(db, incident_id)
    if not db_incident:
        return None
    
    update_data = incident_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_incident, key, value)
    
    db.commit()
    db.refresh(db_incident)
    return db_incident


def update_incident_status(db: Session, incident_id: str, status: IncidentStatus):
    db_incident = get_incident(db, incident_id)
    if not db_incident:
        return None
    
    db_incident.current_status = status
    if status == IncidentStatus.CLOSED:
        db_incident.is_active = False
    
    db.commit()
    db.refresh(db_incident)
    return db_incident


def close_incident(db: Session, incident_id: str):
    return update_incident_status(db, incident_id, IncidentStatus.CLOSED)


def get_announcements_by_incident(db: Session, incident_id: str):
    return db.query(models.Announcement).filter(
        models.Announcement.incident_id == incident_id
    ).order_by(models.Announcement.version.desc()).all()


def get_latest_announcement_version(db: Session, incident_id: str) -> int:
    db.commit()
    count = db.query(models.Announcement).filter(
        models.Announcement.incident_id == incident_id
    ).count()
    return count


def create_announcement(db: Session, announcement: schemas.AnnouncementCreate):
    version = get_latest_announcement_version(db, announcement.incident_id) + 1
    
    db_announcement = models.Announcement(
        incident_id=announcement.incident_id,
        version=version,
        service_status=announcement.service_status,
        content=announcement.content,
        created_by=announcement.created_by
    )
    db.add(db_announcement)
    db.commit()
    db.refresh(db_announcement)
    return db_announcement


def get_subscribers_by_incident(db: Session, incident_id: str):
    return db.query(models.Subscriber).filter(
        models.Subscriber.incident_id == incident_id
    ).all()


def get_subscriber(db: Session, subscriber_id: int):
    return db.query(models.Subscriber).filter(models.Subscriber.id == subscriber_id).first()


def create_subscriber(db: Session, subscriber: schemas.SubscriberCreate):
    existing = db.query(models.Subscriber).filter(
        and_(
            models.Subscriber.incident_id == subscriber.incident_id,
            models.Subscriber.name == subscriber.name
        )
    ).first()
    
    if existing:
        return existing
    
    db_subscriber = models.Subscriber(
        incident_id=subscriber.incident_id,
        name=subscriber.name,
        email=subscriber.email
    )
    db.add(db_subscriber)
    db.commit()
    db.refresh(db_subscriber)
    return db_subscriber


def update_subscriber_status(db: Session, subscriber_id: int, status: SubscriberStatus):
    db_subscriber = get_subscriber(db, subscriber_id)
    if not db_subscriber:
        return None
    
    db_subscriber.status = status
    db.commit()
    db.refresh(db_subscriber)
    return db_subscriber


def get_confirmation(db: Session, incident_id: str, announcement_id: int, subscriber_id: int):
    return db.query(models.Confirmation).filter(
        and_(
            models.Confirmation.incident_id == incident_id,
            models.Confirmation.announcement_id == announcement_id,
            models.Confirmation.subscriber_id == subscriber_id
        )
    ).first()


def get_confirmations_by_incident(db: Session, incident_id: str):
    return db.query(models.Confirmation).filter(
        models.Confirmation.incident_id == incident_id
    ).all()


def create_confirmation(db: Session, confirmation: schemas.ConfirmationCreate):
    existing = get_confirmation(
        db,
        confirmation.incident_id,
        confirmation.announcement_id,
        confirmation.subscriber_id
    )
    
    if existing:
        return existing, False
    
    db_confirmation = models.Confirmation(
        incident_id=confirmation.incident_id,
        announcement_id=confirmation.announcement_id,
        subscriber_id=confirmation.subscriber_id,
        notes=confirmation.notes
    )
    db.add(db_confirmation)
    db.commit()
    db.refresh(db_confirmation)
    
    subscriber = get_subscriber(db, confirmation.subscriber_id)
    if subscriber and subscriber.status == SubscriberStatus.PENDING:
        update_subscriber_status(db, confirmation.subscriber_id, SubscriberStatus.CONFIRMED)
    
    return db_confirmation, True


def get_correction_logs_by_incident(db: Session, incident_id: str):
    return db.query(models.CorrectionLog).filter(
        models.CorrectionLog.incident_id == incident_id
    ).order_by(models.CorrectionLog.created_at.desc()).all()


def create_correction_log(db: Session, log: schemas.CorrectionLogCreate):
    db_log = models.CorrectionLog(
        incident_id=log.incident_id,
        original_input=log.original_input,
        processed_by=log.processed_by,
        conclusion=log.conclusion,
        correction_type=log.correction_type
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


def export_incident_data(db: Session, incident_id: str) -> Optional[dict]:
    incident = get_incident(db, incident_id)
    if not incident:
        return None
    
    announcements = get_announcements_by_incident(db, incident_id)
    subscribers = get_subscribers_by_incident(db, incident_id)
    confirmations = get_confirmations_by_incident(db, incident_id)
    correction_logs = get_correction_logs_by_incident(db, incident_id)
    
    return {
        "incident_id": incident.id,
        "title": incident.title,
        "description": incident.description,
        "current_status": incident.current_status.value,
        "review_summary": incident.review_summary,
        "announcements": [
            {
                "version": a.version,
                "service_status": a.service_status,
                "content": a.content,
                "created_by": a.created_by,
                "created_at": a.created_at.isoformat()
            }
            for a in announcements
        ],
        "subscribers": [
            {
                "name": s.name,
                "email": s.email,
                "status": s.status.value,
                "subscribed_at": s.subscribed_at.isoformat()
            }
            for s in subscribers
        ],
        "confirmations": [
            {
                "announcement_version": next((a.version for a in announcements if a.id == c.announcement_id), None),
                "subscriber_name": next((s.name for s in subscribers if s.id == c.subscriber_id), None),
                "confirmed_at": c.confirmed_at.isoformat(),
                "notes": c.notes
            }
            for c in confirmations
        ],
        "correction_logs": [
            {
                "original_input": l.original_input,
                "processed_by": l.processed_by,
                "conclusion": l.conclusion,
                "correction_type": l.correction_type,
                "created_at": l.created_at.isoformat()
            }
            for l in correction_logs
        ],
        "exported_at": datetime.now().isoformat()
    }
