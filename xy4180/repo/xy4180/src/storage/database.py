import os
import json
from datetime import datetime
from pathlib import Path
from typing import Optional, TypeVar, Generic, List, Dict, Any
from contextlib import contextmanager

from sqlalchemy import create_engine, text, and_, or_
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError

from src.models.models import (
    Base, Team, Material, BorrowRecord, BorrowItem,
    ReturnRecord, ReturnItem, DamageRecord, AuditLog,
    AnomalyRecord, MaterialStatus, ReturnStatus
)


T = TypeVar('T')


class DatabaseManager:
    _instance = None
    _engine = None
    _session_local = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._engine is None:
            self._initialize_database()
    
    def _initialize_database(self):
        data_dir = Path(__file__).parent.parent.parent / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        
        db_path = data_dir / "recycle_station.db"
        db_url = f"sqlite:///{db_path}"
        
        self._engine = create_engine(
            db_url,
            echo=False,
            connect_args={"check_same_thread": False}
        )
        
        self._session_local = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self._engine
        )
        
        Base.metadata.create_all(bind=self._engine)
    
    @contextmanager
    def get_session(self):
        session = self._session_local()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            raise e
        finally:
            session.close()
    
    def get_engine(self):
        return self._engine


class BaseDAO(Generic[T]):
    model: type[T] = None
    
    def __init__(self, db_manager: Optional[DatabaseManager] = None):
        self.db_manager = db_manager or DatabaseManager()
    
    def create(self, **kwargs) -> T:
        with self.db_manager.get_session() as session:
            entity = self.model(**kwargs)
            session.add(entity)
            session.flush()
            session.refresh(entity)
            return self._detach(session, entity)
    
    def get_by_id(self, entity_id: int) -> Optional[T]:
        with self.db_manager.get_session() as session:
            entity = session.query(self.model).filter_by(id=entity_id).first()
            if entity:
                return self._detach(session, entity)
            return None
    
    def get_all(self) -> List[T]:
        with self.db_manager.get_session() as session:
            entities = session.query(self.model).all()
            return [self._detach(session, e) for e in entities]
    
    def update(self, entity_id: int, **kwargs) -> Optional[T]:
        with self.db_manager.get_session() as session:
            entity = session.query(self.model).filter_by(id=entity_id).first()
            if entity:
                for key, value in kwargs.items():
                    if hasattr(entity, key):
                        setattr(entity, key, value)
                session.flush()
                session.refresh(entity)
                return self._detach(session, entity)
            return None
    
    def delete(self, entity_id: int) -> bool:
        with self.db_manager.get_session() as session:
            entity = session.query(self.model).filter_by(id=entity_id).first()
            if entity:
                session.delete(entity)
                return True
            return False
    
    def _detach(self, session: Session, entity: T) -> T:
        session.expunge(entity)
        return entity


class TeamDAO(BaseDAO[Team]):
    model = Team
    
    def get_by_code(self, team_code: str) -> Optional[Team]:
        with self.db_manager.get_session() as session:
            entity = session.query(Team).filter_by(team_code=team_code).first()
            if entity:
                return self._detach(session, entity)
            return None
    
    def get_by_booth(self, booth_number: str) -> List[Team]:
        with self.db_manager.get_session() as session:
            entities = session.query(Team).filter_by(booth_number=booth_number).all()
            return [self._detach(session, e) for e in entities]
    
    def search(self, keyword: str) -> List[Team]:
        with self.db_manager.get_session() as session:
            entities = session.query(Team).filter(
                or_(
                    Team.team_code.contains(keyword),
                    Team.team_name.contains(keyword),
                    Team.booth_number.contains(keyword)
                )
            ).all()
            return [self._detach(session, e) for e in entities]


class MaterialDAO(BaseDAO[Material]):
    model = Material
    
    def get_by_barcode(self, barcode: str) -> Optional[Material]:
        with self.db_manager.get_session() as session:
            entity = session.query(Material).filter_by(barcode=barcode).first()
            if entity:
                return self._detach(session, entity)
            return None
    
    def get_by_type(self, material_type: str) -> List[Material]:
        with self.db_manager.get_session() as session:
            entities = session.query(Material).filter_by(
                material_type=material_type
            ).all()
            return [self._detach(session, e) for e in entities]
    
    def get_by_status(self, status: MaterialStatus) -> List[Material]:
        with self.db_manager.get_session() as session:
            entities = session.query(Material).filter_by(status=status).all()
            return [self._detach(session, e) for e in entities]
    
    def search(self, keyword: str) -> List[Material]:
        with self.db_manager.get_session() as session:
            entities = session.query(Material).filter(
                or_(
                    Material.barcode.contains(keyword),
                    Material.material_name.contains(keyword),
                    Material.material_type.contains(keyword)
                )
            ).all()
            return [self._detach(session, e) for e in entities]
    
    def update_status(self, material_id: int, status: MaterialStatus) -> Optional[Material]:
        return self.update(material_id, status=status)


class BorrowRecordDAO(BaseDAO[BorrowRecord]):
    model = BorrowRecord
    
    def get_by_code(self, borrow_code: str) -> Optional[BorrowRecord]:
        with self.db_manager.get_session() as session:
            entity = session.query(BorrowRecord).filter_by(
                borrow_code=borrow_code
            ).first()
            if entity:
                return self._detach(session, entity)
            return None
    
    def get_by_team(self, team_id: int) -> List[BorrowRecord]:
        with self.db_manager.get_session() as session:
            entities = session.query(BorrowRecord).filter_by(
                team_id=team_id
            ).all()
            return [self._detach(session, e) for e in entities]
    
    def get_by_status(self, status: ReturnStatus) -> List[BorrowRecord]:
        with self.db_manager.get_session() as session:
            entities = session.query(BorrowRecord).filter_by(status=status).all()
            return [self._detach(session, e) for e in entities]
    
    def get_by_deposit_slip(self, deposit_slip_code: str) -> Optional[BorrowRecord]:
        with self.db_manager.get_session() as session:
            entity = session.query(BorrowRecord).filter_by(
                deposit_slip_code=deposit_slip_code
            ).first()
            if entity:
                return self._detach(session, entity)
            return None
    
    def get_overdue(self) -> List[BorrowRecord]:
        now = datetime.now()
        with self.db_manager.get_session() as session:
            entities = session.query(BorrowRecord).filter(
                and_(
                    BorrowRecord.expected_return_date < now,
                    BorrowRecord.status != ReturnStatus.COMPLETED
                )
            ).all()
            return [self._detach(session, e) for e in entities]
    
    def get_with_items(self, borrow_id: int) -> Optional[BorrowRecord]:
        with self.db_manager.get_session() as session:
            entity = session.query(BorrowRecord).filter_by(
                id=borrow_id
            ).first()
            if entity:
                _ = entity.borrow_items
                return self._detach(session, entity)
            return None


class BorrowItemDAO(BaseDAO[BorrowItem]):
    model = BorrowItem
    
    def get_by_borrow_record(self, borrow_record_id: int) -> List[BorrowItem]:
        with self.db_manager.get_session() as session:
            entities = session.query(BorrowItem).filter_by(
                borrow_record_id=borrow_record_id
            ).all()
            return [self._detach(session, e) for e in entities]
    
    def get_by_material(self, material_id: int) -> List[BorrowItem]:
        with self.db_manager.get_session() as session:
            entities = session.query(BorrowItem).filter_by(
                material_id=material_id
            ).all()
            return [self._detach(session, e) for e in entities]
    
    def get_unreturned(self) -> List[BorrowItem]:
        with self.db_manager.get_session() as session:
            entities = session.query(BorrowItem).filter_by(
                is_returned=False
            ).all()
            return [self._detach(session, e) for e in entities]


class ReturnRecordDAO(BaseDAO[ReturnRecord]):
    model = ReturnRecord
    
    def get_by_code(self, return_code: str) -> Optional[ReturnRecord]:
        with self.db_manager.get_session() as session:
            entity = session.query(ReturnRecord).filter_by(
                return_code=return_code
            ).first()
            if entity:
                return self._detach(session, entity)
            return None
    
    def get_by_borrow_record(self, borrow_record_id: int) -> List[ReturnRecord]:
        with self.db_manager.get_session() as session:
            entities = session.query(ReturnRecord).filter_by(
                borrow_record_id=borrow_record_id
            ).all()
            return [self._detach(session, e) for e in entities]
    
    def get_by_team(self, team_id: int) -> List[ReturnRecord]:
        with self.db_manager.get_session() as session:
            entities = session.query(ReturnRecord).filter_by(
                team_id=team_id
            ).all()
            return [self._detach(session, e) for e in entities]
    
    def get_with_items(self, return_id: int) -> Optional[ReturnRecord]:
        with self.db_manager.get_session() as session:
            entity = session.query(ReturnRecord).filter_by(id=return_id).first()
            if entity:
                _ = entity.return_items
                return self._detach(session, entity)
            return None


class ReturnItemDAO(BaseDAO[ReturnItem]):
    model = ReturnItem
    
    def get_by_return_record(self, return_record_id: int) -> List[ReturnItem]:
        with self.db_manager.get_session() as session:
            entities = session.query(ReturnItem).filter_by(
                return_record_id=return_record_id
            ).all()
            return [self._detach(session, e) for e in entities]
    
    def get_by_material(self, material_id: int) -> List[ReturnItem]:
        with self.db_manager.get_session() as session:
            entities = session.query(ReturnItem).filter_by(
                material_id=material_id
            ).all()
            return [self._detach(session, e) for e in entities]


class DamageRecordDAO(BaseDAO[DamageRecord]):
    model = DamageRecord
    
    def get_by_return_record(self, return_record_id: int) -> List[DamageRecord]:
        with self.db_manager.get_session() as session:
            entities = session.query(DamageRecord).filter_by(
                return_record_id=return_record_id
            ).all()
            return [self._detach(session, e) for e in entities]
    
    def get_by_material(self, material_id: int) -> List[DamageRecord]:
        with self.db_manager.get_session() as session:
            entities = session.query(DamageRecord).filter_by(
                material_id=material_id
            ).all()
            return [self._detach(session, e) for e in entities]
    
    def get_unapproved(self) -> List[DamageRecord]:
        with self.db_manager.get_session() as session:
            entities = session.query(DamageRecord).filter_by(
                is_approved=False
            ).all()
            return [self._detach(session, e) for e in entities]


class AuditLogDAO(BaseDAO[AuditLog]):
    model = AuditLog
    
    def get_by_entity(self, entity_type: str, entity_id: int) -> List[AuditLog]:
        with self.db_manager.get_session() as session:
            entities = session.query(AuditLog).filter_by(
                entity_type=entity_type,
                entity_id=entity_id
            ).order_by(AuditLog.created_at.desc()).all()
            return [self._detach(session, e) for e in entities]
    
    def get_recent(self, limit: int = 50) -> List[AuditLog]:
        with self.db_manager.get_session() as session:
            entities = session.query(AuditLog).order_by(
                AuditLog.created_at.desc()
            ).limit(limit).all()
            return [self._detach(session, e) for e in entities]
    
    def get_undoable(self) -> List[AuditLog]:
        with self.db_manager.get_session() as session:
            entities = session.query(AuditLog).filter_by(
                is_undone=False
            ).order_by(AuditLog.created_at.desc()).all()
            return [self._detach(session, e) for e in entities]
    
    def log_operation(
        self,
        operation_type: str,
        entity_type: str,
        entity_id: int,
        before_data: Optional[Dict[str, Any]] = None,
        after_data: Optional[Dict[str, Any]] = None,
        operation_data: Optional[Dict[str, Any]] = None,
        operator: Optional[str] = None
    ) -> AuditLog:
        return self.create(
            operation_type=operation_type,
            entity_type=entity_type,
            entity_id=entity_id,
            before_data=json.dumps(before_data, ensure_ascii=False) if before_data else None,
            after_data=json.dumps(after_data, ensure_ascii=False) if after_data else None,
            operation_data=json.dumps(operation_data, ensure_ascii=False) if operation_data else None,
            operator=operator
        )


class AnomalyRecordDAO(BaseDAO[AnomalyRecord]):
    model = AnomalyRecord
    
    def get_by_type(self, anomaly_type: str) -> List[AnomalyRecord]:
        with self.db_manager.get_session() as session:
            entities = session.query(AnomalyRecord).filter_by(
                anomaly_type=anomaly_type
            ).all()
            return [self._detach(session, e) for e in entities]
    
    def get_unresolved(self) -> List[AnomalyRecord]:
        with self.db_manager.get_session() as session:
            entities = session.query(AnomalyRecord).filter_by(
                is_resolved=False
            ).all()
            return [self._detach(session, e) for e in entities]
    
    def get_by_team(self, team_id: int) -> List[AnomalyRecord]:
        with self.db_manager.get_session() as session:
            entities = session.query(AnomalyRecord).filter_by(
                team_id=team_id
            ).all()
            return [self._detach(session, e) for e in entities]


class DAOFactory:
    _instances: Dict[type, Any] = {}
    
    @classmethod
    def get_team_dao(cls) -> TeamDAO:
        if TeamDAO not in cls._instances:
            cls._instances[TeamDAO] = TeamDAO()
        return cls._instances[TeamDAO]
    
    @classmethod
    def get_material_dao(cls) -> MaterialDAO:
        if MaterialDAO not in cls._instances:
            cls._instances[MaterialDAO] = MaterialDAO()
        return cls._instances[MaterialDAO]
    
    @classmethod
    def get_borrow_record_dao(cls) -> BorrowRecordDAO:
        if BorrowRecordDAO not in cls._instances:
            cls._instances[BorrowRecordDAO] = BorrowRecordDAO()
        return cls._instances[BorrowRecordDAO]
    
    @classmethod
    def get_borrow_item_dao(cls) -> BorrowItemDAO:
        if BorrowItemDAO not in cls._instances:
            cls._instances[BorrowItemDAO] = BorrowItemDAO()
        return cls._instances[BorrowItemDAO]
    
    @classmethod
    def get_return_record_dao(cls) -> ReturnRecordDAO:
        if ReturnRecordDAO not in cls._instances:
            cls._instances[ReturnRecordDAO] = ReturnRecordDAO()
        return cls._instances[ReturnRecordDAO]
    
    @classmethod
    def get_return_item_dao(cls) -> ReturnItemDAO:
        if ReturnItemDAO not in cls._instances:
            cls._instances[ReturnItemDAO] = ReturnItemDAO()
        return cls._instances[ReturnItemDAO]
    
    @classmethod
    def get_damage_record_dao(cls) -> DamageRecordDAO:
        if DamageRecordDAO not in cls._instances:
            cls._instances[DamageRecordDAO] = DamageRecordDAO()
        return cls._instances[DamageRecordDAO]
    
    @classmethod
    def get_audit_log_dao(cls) -> AuditLogDAO:
        if AuditLogDAO not in cls._instances:
            cls._instances[AuditLogDAO] = AuditLogDAO()
        return cls._instances[AuditLogDAO]
    
    @classmethod
    def get_anomaly_record_dao(cls) -> AnomalyRecordDAO:
        if AnomalyRecordDAO not in cls._instances:
            cls._instances[AnomalyRecordDAO] = AnomalyRecordDAO()
        return cls._instances[AnomalyRecordDAO]
