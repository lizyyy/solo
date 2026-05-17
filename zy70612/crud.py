from sqlalchemy.orm import Session
from datetime import datetime
import json

import schemas
from database import (
    Store, PriceTagVersion, PriceTagItem, Confirmation, Discrepancy,
    VersionStoreAssignment, ConfirmationType, DiscrepancyStatus, VersionStatus
)


def create_store(db: Session, store: schemas.StoreCreate):
    db_store = Store(**store.dict())
    db.add(db_store)
    db.commit()
    db.refresh(db_store)
    return db_store


def get_store(db: Session, store_id: int):
    return db.query(Store).filter(Store.id == store_id).first()


def get_stores(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Store).offset(skip).limit(limit).all()


def create_price_tag_version(db: Session, version: schemas.PriceTagVersionCreate):
    db_version = PriceTagVersion(**version.dict())
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    return db_version


def get_price_tag_version(db: Session, version_id: int):
    return db.query(PriceTagVersion).filter(PriceTagVersion.id == version_id).first()


def get_price_tag_version_by_code(db: Session, version_code: str):
    return db.query(PriceTagVersion).filter(PriceTagVersion.version_code == version_code).first()


def get_price_tag_versions(db: Session, skip: int = 0, limit: int = 100):
    return db.query(PriceTagVersion).offset(skip).limit(limit).all()


def update_version_status(db: Session, version_id: int, status: VersionStatus):
    version = db.query(PriceTagVersion).filter(PriceTagVersion.id == version_id).first()
    if version:
        version.status = status
        db.commit()
        db.refresh(version)
    return version


def close_version(db: Session, version_id: int, closed_by: str):
    version = db.query(PriceTagVersion).filter(PriceTagVersion.id == version_id).first()
    if version:
        version.status = VersionStatus.CLOSED
        version.closed_at = datetime.utcnow()
        version.closed_by = closed_by
        db.commit()
        db.refresh(version)
    return version


def add_item_to_version(db: Session, version_id: int, item: schemas.PriceTagItemCreate):
    db_item = PriceTagItem(version_id=version_id, **item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def get_version_items(db: Session, version_id: int):
    return db.query(PriceTagItem).filter(PriceTagItem.version_id == version_id).all()


def assign_stores_to_version(db: Session, version_id: int, store_ids: list, assigned_by: str = None):
    existing = db.query(VersionStoreAssignment).filter(
        VersionStoreAssignment.version_id == version_id,
        VersionStoreAssignment.store_id.in_(store_ids)
    ).all()
    existing_store_ids = [a.store_id for a in existing]
    
    new_assignments = []
    for store_id in store_ids:
        if store_id not in existing_store_ids:
            assignment = VersionStoreAssignment(
                version_id=version_id,
                store_id=store_id,
                assigned_by=assigned_by
            )
            db.add(assignment)
            new_assignments.append(assignment)
    
    db.commit()
    return new_assignments


def get_version_assigned_stores(db: Session, version_id: int):
    assignments = db.query(VersionStoreAssignment).filter(
        VersionStoreAssignment.version_id == version_id
    ).all()
    return [a.store for a in assignments]


def create_confirmation(db: Session, confirmation: schemas.ConfirmationCreate):
    existing = db.query(Confirmation).filter(
        Confirmation.store_id == confirmation.store_id,
        Confirmation.version_id == confirmation.version_id,
        Confirmation.confirmation_type == confirmation.confirmation_type
    ).first()
    
    if existing:
        discrepancy = Discrepancy(
            version_id=confirmation.version_id,
            store_id=confirmation.store_id,
            discrepancy_type="duplicate_confirmation",
            description=f"重复确认: {confirmation.confirmation_type} 确认已存在",
            original_input=json.dumps(confirmation.dict(), default=str),
            detected_by="system"
        )
        db.add(discrepancy)
        db.commit()
        return None, "Duplicate confirmation"
    
    db_confirmation = Confirmation(**confirmation.dict())
    db.add(db_confirmation)
    db.commit()
    db.refresh(db_confirmation)
    return db_confirmation, None


def get_confirmations(db: Session, version_id: int = None, store_id: int = None):
    query = db.query(Confirmation)
    if version_id:
        query = query.filter(Confirmation.version_id == version_id)
    if store_id:
        query = query.filter(Confirmation.store_id == store_id)
    return query.all()


def get_confirmation(db: Session, confirmation_id: int):
    return db.query(Confirmation).filter(Confirmation.id == confirmation_id).first()


def create_discrepancy(db: Session, discrepancy: schemas.DiscrepancyCreate):
    db_discrepancy = Discrepancy(**discrepancy.dict())
    db.add(db_discrepancy)
    db.commit()
    db.refresh(db_discrepancy)
    return db_discrepancy


def get_discrepancies(db: Session, version_id: int = None, store_id: int = None, status: DiscrepancyStatus = None):
    query = db.query(Discrepancy)
    if version_id:
        query = query.filter(Discrepancy.version_id == version_id)
    if store_id:
        query = query.filter(Discrepancy.store_id == store_id)
    if status:
        query = query.filter(Discrepancy.status == status)
    return query.all()


def get_discrepancy(db: Session, discrepancy_id: int):
    return db.query(Discrepancy).filter(Discrepancy.id == discrepancy_id).first()


def resolve_discrepancy(db: Session, discrepancy_id: int, resolution: str, resolved_by: str, correct_action: str):
    discrepancy = db.query(Discrepancy).filter(Discrepancy.id == discrepancy_id).first()
    if discrepancy:
        discrepancy.status = DiscrepancyStatus.RESOLVED
        discrepancy.resolved_at = datetime.utcnow()
        discrepancy.resolved_by = resolved_by
        discrepancy.resolution = resolution
        discrepancy.correct_action = correct_action
        db.commit()
        db.refresh(discrepancy)
    return discrepancy


def get_version_status_summary(db: Session, version_id: int):
    version = get_price_tag_version(db, version_id)
    if not version:
        return None
    
    assigned_stores = get_version_assigned_stores(db, version_id)
    confirmations = get_confirmations(db, version_id=version_id)
    discrepancies = get_discrepancies(db, version_id=version_id)
    
    store_statuses = []
    start_confirmed_count = 0
    end_confirmed_count = 0
    
    for store in assigned_stores:
        store_confirmations = [c for c in confirmations if c.store_id == store.id]
        store_discrepancies = [d for d in discrepancies if d.store_id == store.id]
        
        start_confirmation = next((c for c in store_confirmations if c.confirmation_type == ConfirmationType.START), None)
        end_confirmation = next((c for c in store_confirmations if c.confirmation_type == ConfirmationType.END), None)
        
        start_confirmed = start_confirmation is not None
        end_confirmed = end_confirmation is not None
        
        if start_confirmed:
            start_confirmed_count += 1
        if end_confirmed:
            end_confirmed_count += 1
        
        store_statuses.append(schemas.StoreConfirmationStatus(
            store_id=store.id,
            store_name=store.name,
            store_code=store.store_code,
            start_confirmed=start_confirmed,
            start_confirmed_at=start_confirmation.confirmed_at if start_confirmation else None,
            start_confirmed_by=start_confirmation.confirmed_by if start_confirmation else None,
            end_confirmed=end_confirmed,
            end_confirmed_at=end_confirmation.confirmed_at if end_confirmation else None,
            end_confirmed_by=end_confirmation.confirmed_by if end_confirmation else None,
            has_discrepancies=len(store_discrepancies) > 0
        ))
    
    total_stores = len(assigned_stores)
    pending_stores = total_stores - end_confirmed_count
    
    return schemas.VersionStatusSummary(
        version_id=version.id,
        version_code=version.version_code,
        name=version.name,
        status=version.status,
        promotion_start=version.promotion_start,
        promotion_end=version.promotion_end,
        total_stores=total_stores,
        start_confirmed_count=start_confirmed_count,
        end_confirmed_count=end_confirmed_count,
        pending_stores=pending_stores,
        has_discrepancies=len(discrepancies) > 0,
        store_statuses=store_statuses
    )


def datetime_to_str(dt):
    return dt.isoformat() if dt else None

def generate_export_report(db: Session, version_id: int):
    version = get_price_tag_version(db, version_id)
    if not version:
        return None
    
    summary = get_version_status_summary(db, version_id)
    items = get_version_items(db, version_id)
    discrepancies = get_discrepancies(db, version_id=version_id)
    
    return {
        "version": {
            "id": version.id,
            "version_code": version.version_code,
            "name": version.name,
            "status": version.status,
            "promotion_start": datetime_to_str(version.promotion_start),
            "promotion_end": datetime_to_str(version.promotion_end),
            "created_by": version.created_by
        },
        "summary": json.loads(summary.model_dump_json()) if summary else None,
        "items": [
            {
                "id": item.id,
                "version_id": item.version_id,
                "barcode": item.barcode,
                "product_name": item.product_name,
                "original_price": item.original_price,
                "promotion_price": item.promotion_price,
                "unit": item.unit,
                "created_at": datetime_to_str(item.created_at)
            }
            for item in items
        ],
        "discrepancies": [
            {
                "id": d.id,
                "store_id": d.store_id,
                "discrepancy_type": d.discrepancy_type,
                "description": d.description,
                "original_input": d.original_input,
                "status": d.status,
                "detected_at": datetime_to_str(d.detected_at),
                "detected_by": d.detected_by,
                "resolved_at": datetime_to_str(d.resolved_at),
                "resolved_by": d.resolved_by,
                "resolution": d.resolution,
                "correct_action": d.correct_action
            }
            for d in discrepancies
        ],
        "exported_at": datetime_to_str(datetime.utcnow())
    }


def revoke_confirmation(db: Session, confirmation_id: int, revoked_by: str, reason: str):
    confirmation = get_confirmation(db, confirmation_id)
    if not confirmation:
        return None
    
    discrepancy = Discrepancy(
        version_id=confirmation.version_id,
        store_id=confirmation.store_id,
        discrepancy_type="confirmation_revoked",
        description=f"确认撤回: {confirmation.confirmation_type}, 原因: {reason}",
        original_input=json.dumps({
            "confirmation_id": confirmation_id,
            "revoked_by": revoked_by,
            "reason": reason,
            "original_confirmation": {
                "confirmed_by": confirmation.confirmed_by,
                "confirmed_at": confirmation.confirmed_at,
                "confirmation_type": confirmation.confirmation_type
            }
        }, default=str),
        detected_by=revoked_by
    )
    db.add(discrepancy)
    db.delete(confirmation)
    db.commit()
    return discrepancy
