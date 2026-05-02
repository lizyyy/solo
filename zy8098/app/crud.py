from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from typing import List, Optional
from . import models, schemas


def get_meal(db: Session, meal_id: int):
    return db.query(models.Meal).filter(models.Meal.id == meal_id).first()


def get_meals(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Meal).offset(skip).limit(limit).all()


def get_meals_by_filters(db: Session, date: str, meal_type: str, dish_name: Optional[str] = None):
    query = db.query(models.Meal).filter(
        and_(
            models.Meal.date == date,
            models.Meal.meal_type == meal_type
        )
    )
    if dish_name:
        query = query.filter(models.Meal.dish_name == dish_name)
    return query.all()


def create_meal(db: Session, meal: schemas.MealCreate):
    db_meal = models.Meal(**meal.model_dump())
    db.add(db_meal)
    db.commit()
    db.refresh(db_meal)
    return db_meal


def get_sample(db: Session, sample_id: int):
    return db.query(models.Sample).filter(models.Sample.id == sample_id).first()


def get_sample_by_box_code(db: Session, box_code: str):
    return db.query(models.Sample).filter(models.Sample.box_code == box_code).first()


def get_samples(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Sample).offset(skip).limit(limit).all()


def create_sample(db: Session, sample: schemas.SampleCreate, retention_hours: int = 48):
    expiry_time = datetime.utcnow() + timedelta(hours=retention_hours)
    db_sample = models.Sample(
        **sample.model_dump(),
        expiry_time=expiry_time
    )
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample


def update_sample_status(db: Session, sample_id: int, status: str):
    sample = db.query(models.Sample).filter(models.Sample.id == sample_id).first()
    if sample:
        sample.status = status
        db.commit()
        db.refresh(sample)
    return sample


def get_sample_event(db: Session, event_id: int):
    return db.query(models.SampleEvent).filter(models.SampleEvent.id == event_id).first()


def get_sample_events_by_sample(db: Session, sample_id: int):
    return db.query(models.SampleEvent).filter(
        models.SampleEvent.sample_id == sample_id
    ).order_by(models.SampleEvent.sequence_number).all()


def create_sample_event(db: Session, event: schemas.SampleEventCreate):
    max_seq = db.query(models.SampleEvent).filter(
        models.SampleEvent.sample_id == event.sample_id
    ).count()
    db_event = models.SampleEvent(
        **event.model_dump(),
        sequence_number=max_seq + 1
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


def get_fridge(db: Session, fridge_id: int):
    return db.query(models.Fridge).filter(models.Fridge.id == fridge_id).first()


def get_fridge_by_code(db: Session, fridge_code: str):
    return db.query(models.Fridge).filter(models.Fridge.fridge_code == fridge_code).first()


def get_fridges(db: Session):
    return db.query(models.Fridge).all()


def create_fridge(db: Session, fridge: schemas.FridgeCreate):
    db_fridge = models.Fridge(**fridge.model_dump())
    db.add(db_fridge)
    db.commit()
    db.refresh(db_fridge)
    return db_fridge


def get_fridge_rule(db: Session, rule_id: int):
    return db.query(models.FridgeRule).filter(models.FridgeRule.id == rule_id).first()


def get_fridge_rule_by_fridge_code(db: Session, fridge_code: str):
    return db.query(models.FridgeRule).filter(
        models.FridgeRule.fridge_code == fridge_code
    ).order_by(models.FridgeRule.priority.desc()).first()


def get_fridge_rules(db: Session):
    return db.query(models.FridgeRule).all()


def create_fridge_rule(db: Session, rule: schemas.FridgeRuleCreate):
    db_rule = models.FridgeRule(**rule.model_dump())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


def get_expiring_samples(db: Session, hours_threshold: float = 2.0):
    now = datetime.utcnow()
    threshold = now + timedelta(hours=hours_threshold)
    return db.query(models.Sample).filter(
        and_(
            models.Sample.status.in_(["registered", "in_fridge"]),
            models.Sample.expiry_time <= threshold
        )
    ).all()


def reorder_events(db: Session, sample_id: int):
    events = db.query(models.SampleEvent).filter(
        models.SampleEvent.sample_id == sample_id
    ).order_by(models.SampleEvent.event_time).all()
    
    for idx, event in enumerate(events, start=1):
        event.sequence_number = idx
    
    db.commit()
    return events
