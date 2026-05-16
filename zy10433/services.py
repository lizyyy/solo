from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
import json

import database
import schemas


CONFIRMATION_DAYS = 7
MAX_RETRY_COUNT = 3


def create_subscriber(db: Session, subscriber: schemas.SubscriberCreate):
    db_subscriber = database.Subscriber(**subscriber.model_dump())
    db.add(db_subscriber)
    db.commit()
    db.refresh(db_subscriber)
    return db_subscriber


def get_subscriber(db: Session, subscriber_id: int):
    return db.query(database.Subscriber).filter(database.Subscriber.id == subscriber_id).first()


def get_subscribers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(database.Subscriber).offset(skip).limit(limit).all()


def create_api_path(db: Session, api_path: schemas.ApiPathCreate):
    db_api_path = database.ApiPath(**api_path.model_dump())
    db.add(db_api_path)
    db.commit()
    db.refresh(db_api_path)
    return db_api_path


def get_api_path(db: Session, api_path_id: int):
    return db.query(database.ApiPath).filter(database.ApiPath.id == api_path_id).first()


def get_api_paths(db: Session, skip: int = 0, limit: int = 100):
    return db.query(database.ApiPath).offset(skip).limit(limit).all()


def create_change_type(db: Session, change_type: schemas.ChangeTypeCreate):
    existing = db.query(database.ChangeType).filter(
        database.ChangeType.code == change_type.code
    ).first()
    if existing:
        return existing
    db_change_type = database.ChangeType(**change_type.model_dump())
    db.add(db_change_type)
    db.commit()
    db.refresh(db_change_type)
    return db_change_type


def get_change_type(db: Session, change_type_id: int):
    return db.query(database.ChangeType).filter(database.ChangeType.id == change_type_id).first()


def get_change_type_by_code(db: Session, code: str):
    return db.query(database.ChangeType).filter(database.ChangeType.code == code).first()


def get_change_types(db: Session, skip: int = 0, limit: int = 100):
    return db.query(database.ChangeType).offset(skip).limit(limit).all()


def create_subscription(db: Session, subscription: schemas.SubscriptionCreate):
    existing = db.query(database.Subscription).filter(
        database.Subscription.subscriber_id == subscription.subscriber_id,
        database.Subscription.api_path_id == subscription.api_path_id,
        database.Subscription.change_type_id == subscription.change_type_id
    ).first()
    
    if existing:
        return existing
    
    db_subscription = database.Subscription(**subscription.model_dump())
    db.add(db_subscription)
    db.commit()
    db.refresh(db_subscription)
    return db_subscription


def get_subscription(db: Session, subscription_id: int):
    return db.query(database.Subscription).filter(database.Subscription.id == subscription_id).first()


def get_subscriptions(db: Session, subscriber_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(database.Subscription)
    if subscriber_id:
        query = query.filter(database.Subscription.subscriber_id == subscriber_id)
    return query.offset(skip).limit(limit).all()


def find_matching_subscriptions(db: Session, api_path_id: int, change_type_id: int):
    return db.query(database.Subscription).filter(
        database.Subscription.api_path_id == api_path_id,
        database.Subscription.change_type_id == change_type_id,
        database.Subscription.is_active == True
    ).all()


def create_api_change(db: Session, api_change: schemas.ApiChangeCreate):
    db_api_change = database.ApiChange(**api_change.model_dump())
    db.add(db_api_change)
    db.commit()
    db.refresh(db_api_change)
    return db_api_change


def get_api_change(db: Session, api_change_id: int):
    return db.query(database.ApiChange).filter(database.ApiChange.id == api_change_id).first()


def get_api_changes(db: Session, is_processed: Optional[bool] = None, skip: int = 0, limit: int = 100):
    query = db.query(database.ApiChange)
    if is_processed is not None:
        query = query.filter(database.ApiChange.is_processed == is_processed)
    return query.offset(skip).limit(limit).all()


def mark_manual_correction(db: Session, api_change_id: int, correction_note: str):
    db_api_change = get_api_change(db, api_change_id)
    if db_api_change:
        db_api_change.need_manual_correction = True
        db_api_change.correction_note = correction_note
        db_api_change.is_processed = False
        db.commit()
        db.refresh(db_api_change)
    return db_api_change


def manual_correction_done(db: Session, api_change_id: int, processing_result: str):
    db_api_change = get_api_change(db, api_change_id)
    if db_api_change:
        db_api_change.need_manual_correction = False
        db_api_change.processing_result = processing_result
        db.commit()
        db.refresh(db_api_change)
    return db_api_change


def generate_batch_number() -> str:
    import random
    import string
    random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"BATCH-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}-{random_suffix}"


def is_duplicate_notification(db: Session, subscription_id: int, api_change_id: int) -> bool:
    existing = db.query(database.Notification).filter(
        database.Notification.subscription_id == subscription_id,
        database.Notification.api_change_id == api_change_id,
        database.Notification.is_duplicate == False
    ).first()
    return existing is not None


def check_confirmation_timeout(db: Session):
    now = datetime.utcnow()
    expired_notifications = db.query(database.Notification).filter(
        database.Notification.status == "pending",
        database.Notification.confirm_deadline < now
    ).all()
    
    for notification in expired_notifications:
        notification.status = "expired"
    
    db.commit()
    return len(expired_notifications)


def process_api_change(db: Session, api_change_id: int) -> Tuple[int, int]:
    db_api_change = get_api_change(db, api_change_id)
    if not db_api_change or db_api_change.is_processed:
        return 0, 0
    
    matching_subscriptions = find_matching_subscriptions(
        db, db_api_change.api_path_id, db_api_change.change_type_id
    )
    
    if not matching_subscriptions:
        db_api_change.is_processed = True
        db_api_change.processing_result = "No matching subscriptions found"
        db.commit()
        return 0, 0
    
    batch_number = generate_batch_number()
    db_batch = database.NotificationBatch(
        batch_number=batch_number,
        api_change_id=api_change_id,
        status="processing"
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    
    notification_count = 0
    duplicate_count = 0
    
    for subscription in matching_subscriptions:
        is_duplicate = is_duplicate_notification(db, subscription.id, api_change_id)
        
        if is_duplicate:
            duplicate_count += 1
            continue
        
        confirm_deadline = datetime.utcnow() + timedelta(days=CONFIRMATION_DAYS)
        
        db_notification = database.Notification(
            batch_id=db_batch.id,
            subscription_id=subscription.id,
            subscriber_id=subscription.subscriber_id,
            api_change_id=api_change_id,
            status="pending",
            confirm_deadline=confirm_deadline,
            is_duplicate=False
        )
        db.add(db_notification)
        notification_count += 1
    
    db_batch.status = "completed"
    db_api_change.is_processed = True
    db_api_change.processing_result = f"Created {notification_count} notifications, skipped {duplicate_count} duplicates"
    db.commit()
    
    return notification_count, duplicate_count


def retry_batch(db: Session, batch_id: int) -> Optional[int]:
    db_batch = db.query(database.NotificationBatch).filter(database.NotificationBatch.id == batch_id).first()
    if not db_batch or db_batch.retry_count >= MAX_RETRY_COUNT:
        return None
    
    pending_notifications = db.query(database.Notification).filter(
        database.Notification.batch_id == batch_id,
        database.Notification.status.in_(["pending", "expired"])
    ).all()
    
    for notification in pending_notifications:
        notification.status = "pending"
        notification.confirm_deadline = datetime.utcnow() + timedelta(days=CONFIRMATION_DAYS)
    
    db_batch.retry_count += 1
    db_batch.last_retry_at = datetime.utcnow()
    db_batch.status = "retried"
    db.commit()
    
    return len(pending_notifications)


def get_notification(db: Session, notification_id: int):
    return db.query(database.Notification).filter(database.Notification.id == notification_id).first()


def get_notifications(db: Session, subscriber_id: Optional[int] = None, status: Optional[str] = None, skip: int = 0, limit: int = 100):
    query = db.query(database.Notification)
    if subscriber_id:
        query = query.filter(database.Notification.subscriber_id == subscriber_id)
    if status:
        query = query.filter(database.Notification.status == status)
    return query.offset(skip).limit(limit).all()


def confirm_notification(db: Session, notification_id: int, confirmation_note: Optional[str] = None):
    db_notification = get_notification(db, notification_id)
    if db_notification and db_notification.status == "pending":
        db_notification.status = "confirmed"
        db_notification.confirmed_at = datetime.utcnow()
        db_notification.confirmation_note = confirmation_note
        db.commit()
        db.refresh(db_notification)
    return db_notification


def get_batches(db: Session, api_change_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(database.NotificationBatch)
    if api_change_id:
        query = query.filter(database.NotificationBatch.api_change_id == api_change_id)
    return query.offset(skip).limit(limit).all()


def generate_subscription_report(db: Session, subscriber_id: Optional[int] = None) -> schemas.SubscriptionReport:
    query = db.query(database.Notification)
    if subscriber_id:
        query = query.filter(database.Notification.subscriber_id == subscriber_id)
    
    notifications = query.all()
    
    items = []
    for notification in notifications:
        subscription = db.query(database.Subscription).filter(
            database.Subscription.id == notification.subscription_id
        ).first()
        subscriber = db.query(database.Subscriber).filter(
            database.Subscriber.id == notification.subscriber_id
        ).first()
        
        api_path = None
        change_type = None
        if subscription:
            api_path = db.query(database.ApiPath).filter(
                database.ApiPath.id == subscription.api_path_id
            ).first()
            change_type = db.query(database.ChangeType).filter(
                database.ChangeType.id == subscription.change_type_id
            ).first()
        
        api_change = db.query(database.ApiChange).filter(
            database.ApiChange.id == notification.api_change_id
        ).first()
        
        items.append(schemas.SubscriptionReportItem(
            subscriber_name=subscriber.name if subscriber else "",
            subscriber_email=subscriber.email if subscriber else "",
            api_path=api_path.path if api_path else "",
            api_method=api_path.method if api_path else "",
            change_type=change_type.name if change_type else "",
            change_title=api_change.title if api_change else "",
            notification_status=notification.status,
            confirmed_at=notification.confirmed_at,
            confirm_deadline=notification.confirm_deadline
        ))
    
    pending_count = sum(1 for item in items if item.notification_status == "pending")
    confirmed_count = sum(1 for item in items if item.notification_status == "confirmed")
    expired_count = sum(1 for item in items if item.notification_status == "expired")
    
    return schemas.SubscriptionReport(
        generated_at=datetime.utcnow(),
        total_items=len(items),
        pending_count=pending_count,
        confirmed_count=confirmed_count,
        expired_count=expired_count,
        items=items
    )
