from pathlib import Path
from typing import List, Optional
from sqlalchemy.orm import Session

from .. import models, schemas
from ..utils import (
    generate_batch_no,
    generate_content_hash,
    generate_file_hash,
    store_material_content,
    sanitize_filename,
)
from ..config import MATERIAL_TYPES


def create_batch(db: Session, batch_in: schemas.BatchCreate) -> models.Batch:
    batch_no = generate_batch_no()
    db_batch = models.Batch(
        batch_no=batch_no,
        name=batch_in.name,
        description=batch_in.description,
        status="created",
    )
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return db_batch


def get_batch(db: Session, batch_id: int) -> Optional[models.Batch]:
    return db.query(models.Batch).filter(models.Batch.id == batch_id).first()


def get_batch_by_no(db: Session, batch_no: str) -> Optional[models.Batch]:
    return db.query(models.Batch).filter(models.Batch.batch_no == batch_no).first()


def list_batches(db: Session, skip: int = 0, limit: int = 100) -> List[models.Batch]:
    return db.query(models.Batch).order_by(models.Batch.created_at.desc()).offset(skip).limit(limit).all()


def get_batch_detail(db: Session, batch_id: int) -> Optional[schemas.BatchDetail]:
    batch = get_batch(db, batch_id)
    if not batch:
        return None
    material_count = db.query(models.Material).filter(models.Material.batch_id == batch_id).count()
    anomaly_count = db.query(models.Anomaly).filter(models.Anomaly.batch_id == batch_id).count()
    report_count = db.query(models.AnalysisReport).filter(models.AnalysisReport.batch_id == batch_id).count()
    return schemas.BatchDetail(
        **{c.name: getattr(batch, c.name) for c in batch.__table__.columns},
        material_count=material_count,
        anomaly_count=anomaly_count,
        report_count=report_count,
    )


def import_material(db: Session, material_in: schemas.MaterialCreate) -> models.Material:
    batch = get_batch(db, material_in.batch_id)
    if not batch:
        raise ValueError(f"Batch {material_in.batch_id} not found")
    if material_in.material_type not in MATERIAL_TYPES:
        raise ValueError(f"Invalid material type: {material_in.material_type}")

    content = material_in.content or ""
    file_path = material_in.file_path

    if content and not file_path:
        filename = sanitize_filename(material_in.name)
        if not filename.endswith((".txt", ".log", ".json", ".xml", ".html")):
            filename = f"{filename}.txt"
        file_path = str(
            store_material_content(
                batch.batch_no,
                material_in.material_type,
                content,
                filename=filename,
            )
        )

    content_hash = None
    if content:
        content_hash = generate_content_hash(content)
    elif file_path and Path(file_path).exists():
        content_hash = generate_file_hash(Path(file_path))

    db_material = models.Material(
        batch_id=material_in.batch_id,
        material_type=material_in.material_type,
        name=material_in.name,
        source=material_in.source,
        file_path=file_path,
        content_hash=content_hash,
        meta=material_in.meta,
    )
    db.add(db_material)
    db.commit()
    db.refresh(db_material)
    return db_material


def get_material(db: Session, material_id: int) -> Optional[models.Material]:
    return db.query(models.Material).filter(models.Material.id == material_id).first()


def get_material_detail(db: Session, material_id: int) -> Optional[schemas.MaterialDetail]:
    material = get_material(db, material_id)
    if not material:
        return None
    content_preview = None
    if material.file_path and Path(material.file_path).exists():
        try:
            with open(material.file_path, "r", encoding="utf-8") as f:
                content_preview = f.read(2000)
        except Exception:
            content_preview = "[Binary file or unreadable content]"
    material_dict = {c.name: getattr(material, c.name) for c in material.__table__.columns}
    return schemas.MaterialDetail(**material_dict, content_preview=content_preview)


def list_materials(db: Session, batch_id: Optional[int] = None, material_type: Optional[str] = None,
                   skip: int = 0, limit: int = 100) -> List[models.Material]:
    query = db.query(models.Material)
    if batch_id:
        query = query.filter(models.Material.batch_id == batch_id)
    if material_type:
        query = query.filter(models.Material.material_type == material_type)
    return query.order_by(models.Material.created_at.desc()).offset(skip).limit(limit).all()


def get_material_content(material_id: int, db: Session) -> Optional[str]:
    material = get_material(db, material_id)
    if not material or not material.file_path:
        return None
    file_path = Path(material.file_path)
    if not file_path.exists():
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return None
