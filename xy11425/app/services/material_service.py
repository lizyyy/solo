from typing import Optional, List, Tuple, Dict, Any
from datetime import datetime
import os
import hashlib
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import (
    Material,
    MaterialType,
    Batch,
    BatchStatus,
    VisitorRecord,
    AuditLog,
)
from ..config import settings
from .state_machine import VisitorStateMachine
from .batch_service import BatchService


class MaterialService:
    @staticmethod
    def _calculate_file_hash(file_path: str) -> str:
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    @staticmethod
    def upload_material(
        db: Session,
        batch_id: int,
        material_type: MaterialType,
        file_name: str,
        file_content: bytes,
        uploaded_by: str,
        metadata: Optional[Dict] = None,
    ) -> Tuple[Optional[Material], Optional[str]]:
        batch = BatchService.get_batch(db, batch_id)
        if not batch:
            return None, "批次不存在"

        upload_dir = os.path.join(settings.UPLOAD_DIR, str(batch_id))
        os.makedirs(upload_dir, exist_ok=True)

        file_path = os.path.join(upload_dir, file_name)
        counter = 1
        while os.path.exists(file_path):
            name, ext = os.path.splitext(file_name)
            file_path = os.path.join(upload_dir, f"{name}_{counter}{ext}")
            counter += 1

        with open(file_path, "wb") as f:
            f.write(file_content)

        file_size = len(file_content)
        file_hash = MaterialService._calculate_file_hash(file_path)

        existing_material = (
            db.query(Material)
            .filter(
                Material.batch_id == batch_id,
                Material.file_hash == file_hash,
            )
            .first()
        )
        if existing_material:
            os.remove(file_path)
            return existing_material, "file_exists"

        material = Material(
            batch_id=batch_id,
            material_type=material_type.value,
            file_name=file_name,
            file_path=file_path,
            file_size=file_size,
            file_hash=file_hash,
            uploaded_by=uploaded_by,
            metadata=metadata or {},
        )
        db.add(material)

        current_materials = (
            db.query(func.count(Material.id))
            .filter(Material.batch_id == batch_id)
            .scalar()
        )

        db.commit()
        db.refresh(material)

        if batch.status == BatchStatus.CREATED:
            BatchService.change_state(
                db,
                batch_id,
                BatchStatus.MATERIALS_UPLOADED,
                uploaded_by,
                f"上传材料: {file_name}",
                {"material_id": material.id, "material_type": material_type.value},
            )

        return material, "uploaded"

    @staticmethod
    def get_material(
        db: Session,
        material_id: int,
    ) -> Optional[Material]:
        return db.query(Material).filter(Material.id == material_id).first()

    @staticmethod
    def list_materials(
        db: Session,
        batch_id: Optional[int] = None,
        material_type: Optional[MaterialType] = None,
        parsed: Optional[bool] = None,
    ) -> Tuple[List[Material], int]:
        query = db.query(Material)

        if batch_id:
            query = query.filter(Material.batch_id == batch_id)
        if material_type:
            query = query.filter(Material.material_type == material_type.value)
        if parsed is not None:
            query = query.filter(Material.parsed == parsed)

        total = query.count()
        materials = query.order_by(Material.uploaded_at.desc()).all()

        return materials, total

    @staticmethod
    def mark_parsed(
        db: Session,
        material_id: int,
        error: Optional[str] = None,
    ) -> Optional[Material]:
        material = MaterialService.get_material(db, material_id)
        if not material:
            return None

        material.parsed = True
        material.parsed_at = datetime.utcnow()
        material.parse_error = error

        db.commit()
        db.refresh(material)

        return material

    @staticmethod
    def delete_material(
        db: Session,
        material_id: int,
        deleted_by: str,
    ) -> bool:
        material = MaterialService.get_material(db, material_id)
        if not material:
            return False

        if os.path.exists(material.file_path):
            try:
                os.remove(material.file_path)
            except OSError:
                pass

        db.query(VisitorRecord).filter(VisitorRecord.material_id == material_id).update(
            {"material_id": None}
        )

        db.delete(material)
        db.commit()

        return True
