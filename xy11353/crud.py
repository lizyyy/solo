from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime
import models, schemas


def get_visitor(db: Session, visitor_id: int):
    return db.query(models.Visitor).filter(models.Visitor.id == visitor_id).first()


def get_visitor_by_id_card(db: Session, id_card: str):
    return db.query(models.Visitor).filter(models.Visitor.id_card == id_card).first()


def get_visitor_by_plate(db: Session, plate_number: str):
    return db.query(models.Visitor).filter(models.Visitor.license_plate == plate_number).first()


def get_visitors(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Visitor).offset(skip).limit(limit).all()


def create_visitor(db: Session, visitor: schemas.VisitorCreate):
    db_visitor = models.Visitor(**visitor.model_dump())
    db.add(db_visitor)
    db.commit()
    db.refresh(db_visitor)
    return db_visitor


def update_visitor(db: Session, visitor_id: int, visitor_update: schemas.VisitorUpdate):
    db_visitor = get_visitor(db, visitor_id)
    if db_visitor:
        update_data = visitor_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_visitor, key, value)
        db.commit()
        db.refresh(db_visitor)
    return db_visitor


def delete_visitor(db: Session, visitor_id: int):
    db_visitor = get_visitor(db, visitor_id)
    if db_visitor:
        db.delete(db_visitor)
        db.commit()
    return db_visitor


def get_temporary_plate(db: Session, plate_id: int):
    return db.query(models.TemporaryPlate).filter(models.TemporaryPlate.id == plate_id).first()


def get_temporary_plate_by_number(db: Session, plate_number: str):
    return db.query(models.TemporaryPlate).filter(
        models.TemporaryPlate.plate_number == plate_number,
        models.TemporaryPlate.is_active == True
    ).first()


def create_temporary_plate(db: Session, plate: schemas.TemporaryPlateCreate):
    db_plate = models.TemporaryPlate(**plate.model_dump())
    db.add(db_plate)
    db.commit()
    db.refresh(db_plate)
    return db_plate


def deactivate_temporary_plate(db: Session, plate_id: int):
    db_plate = get_temporary_plate(db, plate_id)
    if db_plate:
        db_plate.is_active = False
        db.commit()
        db.refresh(db_plate)
    return db_plate


def get_blacklist_entry(db: Session, blacklist_id: int):
    return db.query(models.Blacklist).filter(models.Blacklist.id == blacklist_id).first()


def get_blacklist_by_identifier(db: Session, identifier: str):
    return db.query(models.Blacklist).filter(
        models.Blacklist.identifier == identifier,
        models.Blacklist.is_active == True
    ).first()


def is_blacklisted(db: Session, identifier: str) -> bool:
    entry = get_blacklist_by_identifier(db, identifier)
    if entry:
        if entry.expires_at is None or entry.expires_at > datetime.now():
            return True
    return False


def create_blacklist_entry(db: Session, blacklist: schemas.BlacklistCreate):
    db_blacklist = models.Blacklist(**blacklist.model_dump())
    db.add(db_blacklist)
    db.commit()
    db.refresh(db_blacklist)
    return db_blacklist


def remove_from_blacklist(db: Session, blacklist_id: int):
    db_entry = get_blacklist_entry(db, blacklist_id)
    if db_entry:
        db_entry.is_active = False
        db.commit()
        db.refresh(db_entry)
    return db_entry


def get_verification_record(db: Session, record_id: int):
    return db.query(models.VerificationRecord).filter(models.VerificationRecord.id == record_id).first()


def get_verification_records(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.VerificationRecord).order_by(
        models.VerificationRecord.verified_at.desc()
    ).offset(skip).limit(limit).all()


def create_verification_record(db: Session, record: schemas.VerificationRecordCreate):
    db_record = models.VerificationRecord(**record.model_dump())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def query_verification_records(db: Session, filters: schemas.QueryFilters, skip: int = 0, limit: int = 100):
    query = db.query(models.VerificationRecord)
    
    conditions = []
    if filters.responsible_person:
        query = query.join(models.Visitor).filter(
            models.Visitor.responsible_person == filters.responsible_person
        )
    if filters.start_date:
        conditions.append(models.VerificationRecord.verified_at >= filters.start_date)
    if filters.end_date:
        conditions.append(models.VerificationRecord.verified_at <= filters.end_date)
    if filters.status:
        conditions.append(models.VerificationRecord.status == filters.status)
    if filters.exception_type:
        conditions.append(models.VerificationRecord.exception_type == filters.exception_type)
    if filters.gate_number:
        conditions.append(models.VerificationRecord.gate_number == filters.gate_number)
    
    if conditions:
        query = query.filter(and_(*conditions))
    
    return query.order_by(models.VerificationRecord.verified_at.desc()).offset(skip).limit(limit).all()


def query_visitors(db: Session, filters: schemas.QueryFilters, skip: int = 0, limit: int = 100):
    query = db.query(models.Visitor)
    
    conditions = []
    if filters.responsible_person:
        conditions.append(models.Visitor.responsible_person == filters.responsible_person)
    if filters.start_date:
        conditions.append(models.Visitor.expected_start >= filters.start_date)
    if filters.end_date:
        conditions.append(models.Visitor.expected_end <= filters.end_date)
    if filters.status:
        conditions.append(models.Visitor.status == filters.status)
    if filters.gate_number:
        conditions.append(models.Visitor.gate_number == filters.gate_number)
    
    if conditions:
        query = query.filter(and_(*conditions))
    
    return query.order_by(models.Visitor.created_at.desc()).offset(skip).limit(limit).all()
