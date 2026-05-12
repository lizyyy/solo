import uuid
from datetime import datetime
from contextlib import contextmanager
from typing import Generator, Optional
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from .config import Config
from .models import (
    Base,
    ImportRecord,
    SystemLog,
)


class DatabaseManager:
    def __init__(self, config: Config):
        self.config = config
        self.engine = create_engine(f"sqlite:///{config.db_path}")
        self._SessionLocal = sessionmaker(
            bind=self.engine, autocommit=False, autoflush=False
        )

    def init_database(self) -> None:
        Base.metadata.create_all(self.engine)

    @contextmanager
    def session(self) -> Generator[Session, None, None]:
        session: Session = self._SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def log(self, level: str, message: str, context: Optional[dict] = None) -> None:
        with self.session() as session:
            log_entry = SystemLog(
                log_id=str(uuid.uuid4()),
                level=level,
                message=message,
                context=context,
                operator=self.config.operator,
            )
            session.add(log_entry)

    def create_import_record(
        self, source_type: str, source_file: Optional[str] = None
    ) -> str:
        import_id = str(uuid.uuid4())
        with self.session() as session:
            record = ImportRecord(
                import_id=import_id,
                source_type=source_type,
                source_file=source_file,
                status="running",
                operator=self.config.operator,
            )
            session.add(record)
        return import_id

    def update_import_record(
        self,
        import_id: str,
        status: str,
        total: int,
        success: int,
        skipped: int,
        failed: int,
        error_message: Optional[str] = None,
    ) -> None:
        with self.session() as session:
            record = session.query(ImportRecord).filter_by(import_id=import_id).first()
            if record:
                record.status = status
                record.total_count = total
                record.success_count = success
                record.skipped_count = skipped
                record.failed_count = failed
                record.error_message = error_message
                if status in ["completed", "failed"]:
                    record.completed_at = datetime.utcnow()

    def get_import_history(self, limit: int = 20) -> list:
        with self.session() as session:
            records = (
                session.query(ImportRecord)
                .order_by(ImportRecord.started_at.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "import_id": r.import_id[:8] + "...",
                    "source_type": r.source_type,
                    "source_file": r.source_file,
                    "status": r.status,
                    "total": r.total_count,
                    "success": r.success_count,
                    "skipped": r.skipped_count,
                    "failed": r.failed_count,
                    "started_at": r.started_at.isoformat() if r.started_at else None,
                    "completed_at": r.completed_at.isoformat() if r.completed_at else None,
                    "operator": r.operator,
                    "error": r.error_message,
                }
                for r in records
            ]

    def get_recent_logs(self, limit: int = 50) -> list:
        with self.session() as session:
            logs = (
                session.query(SystemLog)
                .order_by(SystemLog.created_at.desc())
                .limit(limit)
                .all()
            )
            return [
                {
                    "level": l.level,
                    "message": l.message,
                    "context": l.context,
                    "created_at": l.created_at.isoformat() if l.created_at else None,
                    "operator": l.operator,
                }
                for l in logs
            ]
