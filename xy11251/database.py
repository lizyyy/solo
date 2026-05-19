import json
import uuid
from datetime import datetime, timedelta
from contextlib import contextmanager
from typing import Optional, Dict, Any, List
from sqlalchemy import create_engine, and_, or_
from sqlalchemy.orm import sessionmaker, Session
from models import (
    Base, Order, ShortageRecord, CompensationRecord,
    SettlementRecord, OperationLog, IdempotentLock,
    ShortageStatus, OperationType, OperationStatus
)


class DatabaseConfig:
    def __init__(self, db_url: str = "sqlite:///shortage_system.db"):
        self.db_url = db_url
        self.engine = create_engine(db_url, echo=False)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def create_tables(self):
        Base.metadata.create_all(bind=self.engine)


db_config = DatabaseConfig()


@contextmanager
def get_db_session():
    session: Session = db_config.SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def generate_no(prefix: str) -> str:
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    random_str = str(uuid.uuid4().hex)[:8].upper()
    return f"{prefix}{timestamp}{random_str}"


class IdempotentService:
    @staticmethod
    def acquire_lock(
        session: Session,
        idempotent_key: str,
        operation_type: str,
        resource_id: Optional[str] = None,
        expire_hours: int = 24
    ) -> Optional[IdempotentLock]:
        existing = session.query(IdempotentLock).filter(
            IdempotentLock.idempotent_key == idempotent_key
        ).first()

        if existing:
            if existing.expired_at > datetime.now():
                return None
            session.delete(existing)
            session.flush()

        lock = IdempotentLock(
            idempotent_key=idempotent_key,
            operation_type=operation_type,
            resource_id=resource_id,
            expired_at=datetime.now() + timedelta(hours=expire_hours)
        )
        session.add(lock)
        session.flush()
        return lock

    @staticmethod
    def get_cached_result(session: Session, idempotent_key: str) -> Optional[Dict[str, Any]]:
        lock = session.query(IdempotentLock).filter(
            IdempotentLock.idempotent_key == idempotent_key
        ).first()
        if lock and lock.result_data:
            return json.loads(lock.result_data)
        return None

    @staticmethod
    def set_result(session: Session, idempotent_key: str, result: Dict[str, Any]):
        lock = session.query(IdempotentLock).filter(
            IdempotentLock.idempotent_key == idempotent_key
        ).first()
        if lock:
            lock.result_data = json.dumps(result, ensure_ascii=False)


class OrderRepository:
    @staticmethod
    def get_by_order_no(session: Session, order_no: str) -> Optional[Order]:
        return session.query(Order).filter(Order.order_no == order_no).first()

    @staticmethod
    def create(session: Session, order_data: Dict[str, Any]) -> Order:
        order = Order(**order_data)
        session.add(order)
        session.flush()
        return order

    @staticmethod
    def get_or_create(session: Session, order_no: str, order_data: Dict[str, Any]) -> Order:
        order = OrderRepository.get_by_order_no(session, order_no)
        if not order:
            order_data["order_no"] = order_no
            order = OrderRepository.create(session, order_data)
        return order


class ShortageRepository:
    @staticmethod
    def get_by_shortage_no(session: Session, shortage_no: str) -> Optional[ShortageRecord]:
        return session.query(ShortageRecord).filter(ShortageRecord.shortage_no == shortage_no).first()

    @staticmethod
    def get_by_order_product(session: Session, order_id: int, product_id: str, sku_id: Optional[str] = None) -> Optional[ShortageRecord]:
        query = session.query(ShortageRecord).filter(
            and_(
                ShortageRecord.order_id == order_id,
                ShortageRecord.product_id == product_id
            )
        )
        if sku_id:
            query = query.filter(ShortageRecord.sku_id == sku_id)
        return query.first()

    @staticmethod
    def create(session: Session, shortage_data: Dict[str, Any]) -> ShortageRecord:
        shortage_data["shortage_no"] = generate_no("ST")
        shortage = ShortageRecord(**shortage_data)
        session.add(shortage)
        session.flush()
        return shortage

    @staticmethod
    def update_status(session: Session, shortage_id: int, status: ShortageStatus, **kwargs):
        shortage = session.query(ShortageRecord).filter(ShortageRecord.id == shortage_id).first()
        if shortage:
            shortage.status = status.value
            for key, value in kwargs.items():
                if hasattr(shortage, key):
                    setattr(shortage, key, value)
            session.flush()

    @staticmethod
    def query(
        session: Session,
        status: Optional[str] = None,
        operator: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        order_no: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        query = session.query(ShortageRecord).join(Order)

        if status:
            query = query.filter(ShortageRecord.status == status)
        if order_no:
            query = query.filter(Order.order_no.like(f"%{order_no}%"))
        if start_time:
            query = query.filter(ShortageRecord.created_at >= start_time)
        if end_time:
            query = query.filter(ShortageRecord.created_at <= end_time)

        total = query.count()
        records = query.order_by(ShortageRecord.created_at.desc()) \
            .offset((page - 1) * page_size).limit(page_size).all()

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "records": records
        }


class CompensationRepository:
    @staticmethod
    def get_by_compensation_no(session: Session, compensation_no: str) -> Optional[CompensationRecord]:
        return session.query(CompensationRecord).filter(CompensationRecord.compensation_no == compensation_no).first()

    @staticmethod
    def get_by_shortage_id(session: Session, shortage_id: int) -> List[CompensationRecord]:
        return session.query(CompensationRecord).filter(
            and_(
                CompensationRecord.shortage_id == shortage_id,
                CompensationRecord.is_rolled_back == 0
            )
        ).all()

    @staticmethod
    def create(session: Session, compensation_data: Dict[str, Any]) -> CompensationRecord:
        compensation_data["compensation_no"] = generate_no("CP")
        compensation = CompensationRecord(**compensation_data)
        session.add(compensation)
        session.flush()
        return compensation


class SettlementRepository:
    @staticmethod
    def get_by_settlement_no(session: Session, settlement_no: str) -> Optional[SettlementRecord]:
        return session.query(SettlementRecord).filter(SettlementRecord.settlement_no == settlement_no).first()

    @staticmethod
    def get_by_shortage_id(session: Session, shortage_id: int) -> Optional[SettlementRecord]:
        return session.query(SettlementRecord).filter(SettlementRecord.shortage_id == shortage_id).first()

    @staticmethod
    def create(session: Session, settlement_data: Dict[str, Any]) -> SettlementRecord:
        settlement_data["settlement_no"] = generate_no("SL")
        settlement = SettlementRecord(**settlement_data)
        session.add(settlement)
        session.flush()
        return settlement


class OperationLogRepository:
    @staticmethod
    def create(session: Session, log_data: Dict[str, Any]) -> OperationLog:
        if "batch_no" not in log_data or not log_data["batch_no"]:
            log_data["batch_no"] = generate_no("BT")

        log = OperationLog(**log_data)
        session.add(log)
        session.flush()
        return log

    @staticmethod
    def query(
        session: Session,
        operation_type: Optional[str] = None,
        operation_status: Optional[str] = None,
        operator: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        query = session.query(OperationLog)

        if operation_type:
            query = query.filter(OperationLog.operation_type == operation_type)
        if operation_status:
            query = query.filter(OperationLog.operation_status == operation_status)
        if operator:
            query = query.filter(OperationLog.operator == operator)
        if start_time:
            query = query.filter(OperationLog.operated_at >= start_time)
        if end_time:
            query = query.filter(OperationLog.operated_at <= end_time)

        total = query.count()
        records = query.order_by(OperationLog.operated_at.desc()) \
            .offset((page - 1) * page_size).limit(page_size).all()

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "records": records
        }
