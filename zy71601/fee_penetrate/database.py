from contextlib import contextmanager
from typing import Generator, Optional, Dict, Any, List, Tuple
from datetime import datetime
from decimal import Decimal
from sqlalchemy import create_engine, and_
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import IntegrityError

from .config import Config
from .models import (
    Base, ImportBatch, ChangeHistory, ImportStatus,
    Product, FeeRule, SalesChannel, NavFlow, CustomerShare,
    ChannelRebate, ChannelAllocation, FeeAccrual, AnomalyRecord,
    AuditReport, Attachment
)


class Database:
    _instance = None
    _engine = None
    _SessionLocal = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._init_engine()
        return cls._instance

    @classmethod
    def _init_engine(cls):
        Config.init_dirs()
        cls._engine = create_engine(
            Config.get_db_url(),
            echo=False,
            connect_args={"check_same_thread": False}
        )
        cls._SessionLocal = sessionmaker(
            autocommit=False, autoflush=False, bind=cls._engine
        )
        Base.metadata.create_all(bind=cls._engine)

    @classmethod
    def reset_engine(cls):
        cls._instance = None
        cls._engine = None
        cls._SessionLocal = None

    @contextmanager
    def get_session(self) -> Generator[Session, None, None]:
        session = self._SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()

    def create_batch(
        self,
        source_type: str,
        operator: str,
        source_file: Optional[str] = None,
        remark: Optional[str] = None
    ) -> ImportBatch:
        with self.get_session() as session:
            batch_no = f"BATCH{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
            batch = ImportBatch(
                batch_no=batch_no,
                source_type=source_type,
                source_file=source_file,
                operator=operator,
                remark=remark
            )
            session.add(batch)
            session.flush()
            batch_id = batch.id
            return ImportBatch(
                id=batch_id,
                batch_no=batch_no,
                source_type=source_type,
                source_file=source_file,
                operator=operator,
                remark=remark,
                import_time=batch.import_time
            )

    def log_change(
        self,
        batch_id: int,
        entity_type: str,
        entity_id: int,
        field_name: str,
        old_value: Optional[str],
        new_value: Optional[str],
        change_type: str,
        operator: str,
        reason: Optional[str] = None
    ):
        with self.get_session() as session:
            change = ChangeHistory(
                batch_id=batch_id,
                entity_type=entity_type,
                entity_id=entity_id,
                field_name=field_name,
                old_value=old_value,
                new_value=new_value,
                change_type=change_type,
                operator=operator,
                reason=reason
            )
            session.add(change)

    def update_batch_stats(
        self,
        batch_id: int,
        new_records: int = 0,
        skip_records: int = 0,
        update_records: int = 0,
        conflict_records: int = 0
    ):
        with self.get_session() as session:
            batch = session.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
            if batch:
                batch.new_records += new_records
                batch.skip_records += skip_records
                batch.update_records += update_records
                batch.conflict_records += conflict_records
                batch.total_records += new_records + skip_records + update_records + conflict_records

    def _compare_fields(
        self,
        existing,
        new_data: Dict[str, Any],
        exclude_fields: List[str] = None
    ) -> List[Tuple[str, Any, Any]]:
        exclude_fields = exclude_fields or ["id", "created_at", "updated_at", "import_batch_id"]
        changes = []
        for field, new_value in new_data.items():
            if field in exclude_fields:
                continue
            old_value = getattr(existing, field)
            if isinstance(old_value, Decimal) and isinstance(new_value, Decimal):
                if old_value != new_value:
                    changes.append((field, old_value, new_value))
            elif old_value != new_value:
                changes.append((field, old_value, new_value))
        return changes

    def upsert_entity(
        self,
        session: Session,
        model_class,
        unique_keys: Dict[str, Any],
        data: Dict[str, Any],
        batch_id: int,
        operator: str,
        update_mode: str = "prompt",
        import_reason: Optional[str] = None
    ) -> Tuple[str, Optional[int], List[Tuple[str, Any, Any]]]:
        """
        增量导入核心逻辑
        :return: (status, entity_id, changes)
            status: 'new' | 'skip' | 'update' | 'conflict'
        """
        query = session.query(model_class)
        filters = [getattr(model_class, k) == v for k, v in unique_keys.items()]
        existing = query.filter(and_(*filters)).first()

        data["import_batch_id"] = batch_id

        if not existing:
            entity = model_class(**data)
            session.add(entity)
            session.flush()
            return "new", entity.id, []

        changes = self._compare_fields(existing, data)

        if not changes:
            return "skip", existing.id, []

        if update_mode == "skip":
            return "skip", existing.id, []
        elif update_mode == "conflict":
            return "conflict", existing.id, changes
        elif update_mode == "force":
            for field, old_value, new_value in changes:
                setattr(existing, field, new_value)
                self.log_change(
                    batch_id=batch_id,
                    entity_type=model_class.__name__,
                    entity_id=existing.id,
                    field_name=field,
                    old_value=str(old_value) if old_value is not None else None,
                    new_value=str(new_value) if new_value is not None else None,
                    change_type="update",
                    operator=operator,
                    reason=import_reason
                )
            return "update", existing.id, changes
        else:
            return "conflict", existing.id, changes

    def get_change_history(
        self,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        batch_id: Optional[int] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        with self.get_session() as session:
            query = session.query(ChangeHistory).order_by(ChangeHistory.change_time.desc())
            if entity_type:
                query = query.filter(ChangeHistory.entity_type == entity_type)
            if entity_id:
                query = query.filter(ChangeHistory.entity_id == entity_id)
            if batch_id:
                query = query.filter(ChangeHistory.batch_id == batch_id)
            records = query.limit(limit).all()
            return [
                {
                    "id": r.id,
                    "batch_id": r.batch_id,
                    "entity_type": r.entity_type,
                    "entity_id": r.entity_id,
                    "field_name": r.field_name,
                    "old_value": r.old_value,
                    "new_value": r.new_value,
                    "change_type": r.change_type,
                    "operator": r.operator,
                    "reason": r.reason,
                    "change_time": r.change_time,
                }
                for r in records
            ]

    def get_batch(self, batch_id: int) -> Optional[Dict[str, Any]]:
        with self.get_session() as session:
            batch = session.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
            if batch:
                return {
                    "id": batch.id,
                    "batch_no": batch.batch_no,
                    "source_type": batch.source_type,
                    "source_file": batch.source_file,
                    "operator": batch.operator,
                    "remark": batch.remark,
                    "import_time": batch.import_time,
                    "total_records": batch.total_records,
                    "new_records": batch.new_records,
                    "skip_records": batch.skip_records,
                    "update_records": batch.update_records,
                    "conflict_records": batch.conflict_records,
                }
            return None

    def list_batches(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self.get_session() as session:
            records = (
                session.query(ImportBatch)
                .order_by(ImportBatch.import_time.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "id": b.id,
                    "batch_no": b.batch_no,
                    "source_type": b.source_type,
                    "source_file": b.source_file,
                    "operator": b.operator,
                    "remark": b.remark,
                    "import_time": b.import_time,
                    "total_records": b.total_records,
                    "new_records": b.new_records,
                    "skip_records": b.skip_records,
                    "update_records": b.update_records,
                    "conflict_records": b.conflict_records,
                }
                for b in records
            ]

    def add_attachment(
        self,
        attachment_type: str,
        entity_type: str,
        entity_id: int,
        file_name: str,
        file_path: str,
        uploaded_by: str,
        file_size: Optional[int] = None,
        description: Optional[str] = None,
        is_verbal_note: bool = False,
        verbal_note_content: Optional[str] = None,
        verbal_note_from: Optional[str] = None,
        import_batch_id: Optional[int] = None
    ) -> Attachment:
        with self.get_session() as session:
            attachment = Attachment(
                attachment_type=attachment_type,
                entity_type=entity_type,
                entity_id=entity_id,
                file_name=file_name,
                file_path=file_path,
                file_size=file_size,
                uploaded_by=uploaded_by,
                description=description,
                is_verbal_note=is_verbal_note,
                verbal_note_content=verbal_note_content,
                verbal_note_from=verbal_note_from,
                import_batch_id=import_batch_id
            )
            session.add(attachment)
            session.flush()
            att_id = attachment.id
            return Attachment(
                id=att_id,
                attachment_type=attachment_type,
                entity_type=entity_type,
                entity_id=entity_id,
                file_name=file_name,
                file_path=file_path,
                file_size=file_size,
                uploaded_by=uploaded_by,
                description=description,
                is_verbal_note=is_verbal_note,
                verbal_note_content=verbal_note_content,
                verbal_note_from=verbal_note_from,
                import_batch_id=import_batch_id,
                uploaded_at=attachment.uploaded_at
            )

    def get_attachments(
        self,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        attachment_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        with self.get_session() as session:
            query = session.query(Attachment).order_by(Attachment.uploaded_at.desc())
            if entity_type:
                query = query.filter(Attachment.entity_type == entity_type)
            if entity_id:
                query = query.filter(Attachment.entity_id == entity_id)
            if attachment_type:
                query = query.filter(Attachment.attachment_type == attachment_type)
            records = query.all()
            return [
                {
                    "id": r.id,
                    "attachment_type": r.attachment_type,
                    "entity_type": r.entity_type,
                    "entity_id": r.entity_id,
                    "file_name": r.file_name,
                    "file_path": r.file_path,
                    "file_size": r.file_size,
                    "uploaded_by": r.uploaded_by,
                    "description": r.description,
                    "is_verbal_note": r.is_verbal_note,
                    "verbal_note_content": r.verbal_note_content,
                    "verbal_note_from": r.verbal_note_from,
                    "uploaded_at": r.uploaded_at,
                }
                for r in records
            ]
