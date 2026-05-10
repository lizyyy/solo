from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from app.models.models import DataVersion, WarmupTask
from app.services.data_source import data_source_factory


class VersionService:
    @staticmethod
    def generate_version(strategy: str, checksum: str) -> str:
        if strategy == "timestamp":
            return datetime.utcnow().strftime("%Y%m%d%H%M%S")
        elif strategy == "checksum":
            return checksum[:16]
        elif strategy == "timestamp_checksum":
            ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
            return f"{ts}_{checksum[:8]}"
        return datetime.utcnow().strftime("%Y%m%d%H%M%S")

    @classmethod
    def create_or_get_version(
        cls,
        db: Session,
        task: WarmupTask,
        force_version: Optional[str] = None
    ) -> tuple[str, str, int]:
        data_source = data_source_factory.get(task.data_source_type)
        data = data_source.fetch_data(task.data_source_config)
        checksum = data_source.get_checksum(data)
        
        if force_version:
            version = force_version
        else:
            version = cls.generate_version(task.version_strategy, checksum)
        
        existing = db.query(DataVersion).filter(
            DataVersion.task_id == task.id,
            DataVersion.version == version
        ).first()
        
        if existing:
            if existing.data_checksum != checksum:
                raise ValueError(
                    f"版本冲突: 版本 {version} 已存在但数据不一致。"
                    f"现有校验和: {existing.data_checksum[:12]}, "
                    f"当前校验和: {checksum[:12]}"
                )
            return existing.version, existing.data_checksum, existing.data_count
        
        new_version = DataVersion(
            version=version,
            task_id=task.id,
            data_checksum=checksum,
            data_count=len(data)
        )
        db.add(new_version)
        db.commit()
        db.refresh(new_version)
        
        return new_version.version, checksum, len(data)

    @classmethod
    def get_latest_version(cls, db: Session, task_id: int) -> Optional[DataVersion]:
        return db.query(DataVersion).filter(
            DataVersion.task_id == task_id
        ).order_by(DataVersion.id.desc()).first()

    @classmethod
    def verify_data_consistency(
        cls,
        db: Session,
        task: WarmupTask,
        version: str
    ) -> bool:
        data_version = db.query(DataVersion).filter(
            DataVersion.task_id == task.id,
            DataVersion.version == version
        ).first()
        
        if not data_version:
            return False
        
        data_source = data_source_factory.get(task.data_source_type)
        data = data_source.fetch_data(task.data_source_config)
        current_checksum = data_source.get_checksum(data)
        
        return data_version.data_checksum == current_checksum


version_service = VersionService()
