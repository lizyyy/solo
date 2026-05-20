from sqlalchemy.orm import Session
from sqlalchemy import and_
import models, schemas
from datetime import datetime
import hashlib
import json


def create_batch(db: Session, batch: schemas.BatchCreate):
    db_batch = models.Batch(
        batch_no=batch.batch_no,
        name=batch.name,
        status="created"
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def get_batch_by_no(db: Session, batch_no: str):
    return db.query(models.Batch).filter(models.Batch.batch_no == batch_no).first()


def get_batch_by_hash(db: Session, material_hash: str):
    return db.query(models.Batch).filter(models.Batch.material_hash == material_hash).first()


def update_batch_hash(db: Session, batch_id: int, material_hash: str):
    db_batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if db_batch:
        db_batch.material_hash = material_hash
        db.commit()
        db.refresh(db_batch)
    return db_batch


def update_batch_status(db: Session, batch_id: int, status: str, report_path: str = None):
    db_batch = db.query(models.Batch).filter(models.Batch.id == batch_id).first()
    if db_batch:
        db_batch.status = status
        db_batch.processed_at = datetime.now()
        if report_path:
            db_batch.report_path = report_path
        db.commit()
        db.refresh(db_batch)
    return db_batch


def calculate_material_hash(materials: list):
    sorted_materials = sorted(materials, key=lambda x: x.get('line_number', 0))
    material_str = json.dumps([m.dict() if hasattr(m, 'dict') else m for m in sorted_materials], sort_keys=True, default=str)
    return hashlib.md5(material_str.encode('utf-8')).hexdigest()


def create_raw_materials(db: Session, batch_id: int, materials: list):
    for material in materials:
        db_material = models.RawMaterial(
            batch_id=batch_id,
            line_number=material.line_number,
            sku_name=material.sku_name,
            sku_code=material.sku_code,
            quantity=material.quantity,
            location_code=material.location_code,
            location_name=material.location_name,
            inventory_time=material.inventory_time,
            expiry_date=material.expiry_date
        )
        db.add(db_material)
    db.commit()


def get_raw_materials_by_batch(db: Session, batch_id: int):
    return db.query(models.RawMaterial).filter(models.RawMaterial.batch_id == batch_id).all()


def get_raw_material_by_id(db: Session, material_id: int):
    return db.query(models.RawMaterial).filter(models.RawMaterial.id == material_id).first()


def update_raw_material_error(db: Session, material_id: int, error_message: str):
    db_material = db.query(models.RawMaterial).filter(models.RawMaterial.id == material_id).first()
    if db_material:
        db_material.is_error = True
        db_material.error_message = error_message
        db.commit()
        db.refresh(db_material)
    return db_material


def create_sku_alias(db: Session, alias: schemas.SkuAliasCreate):
    db_alias = models.SkuAlias(
        canonical_sku=alias.canonical_sku,
        alias_sku=alias.alias_sku
    )
    db.add(db_alias)
    db.commit()
    db.refresh(db_alias)
    return db_alias


def get_canonical_sku(db: Session, sku_code: str):
    alias = db.query(models.SkuAlias).filter(models.SkuAlias.alias_sku == sku_code).first()
    if alias:
        return alias.canonical_sku
    return sku_code


def create_process_record(db: Session, batch_id: int, raw_material_id: int, canonical_sku: str,
                         adjusted_quantity: int, priority_score: float, status: str, step: str,
                         message: str = None, inventory_time_diff: int = None):
    db_record = models.ProcessRecord(
        batch_id=batch_id,
        raw_material_id=raw_material_id,
        canonical_sku=canonical_sku,
        adjusted_quantity=adjusted_quantity,
        priority_score=priority_score,
        inventory_time_diff=inventory_time_diff,
        status=status,
        step=step,
        message=message
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def get_process_records_by_material(db: Session, raw_material_id: int):
    return db.query(models.ProcessRecord).filter(models.ProcessRecord.raw_material_id == raw_material_id).all()


def get_process_records_by_batch(db: Session, batch_id: int):
    return db.query(models.ProcessRecord).filter(models.ProcessRecord.batch_id == batch_id).all()


def create_location_inventory_time(db: Session, location_code: str, standard_time: datetime):
    existing = db.query(models.LocationInventoryTime).filter(
        models.LocationInventoryTime.location_code == location_code
    ).first()
    if existing:
        existing.standard_inventory_time = standard_time
        db.commit()
        db.refresh(existing)
        return existing
    db_location = models.LocationInventoryTime(
        location_code=location_code,
        standard_inventory_time=standard_time
    )
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location


def get_standard_inventory_time(db: Session, location_code: str):
    location = db.query(models.LocationInventoryTime).filter(
        models.LocationInventoryTime.location_code == location_code
    ).first()
    if location:
        return location.standard_inventory_time
    return None


def get_all_sku_aliases(db: Session):
    return db.query(models.SkuAlias).all()
