from datetime import datetime, date
from sqlalchemy import (
    create_engine, Column, Integer, String, Text, DateTime, Date,
    ForeignKey, Enum as SAEnum, Boolean, Float, Index
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from enum import Enum
import os


DATABASE_URL = os.environ.get('BOOK_RESERVATION_DB', 'sqlite:///./library.db')
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ReservationStatus(str, Enum):
    PENDING = "待调拨"
    IN_TRANSIT = "调拨中"
    ARRIVED = "已到馆"
    PICKED_UP = "已取书"
    OVERDUE = "逾期未取"
    CANCELLED = "已取消"
    BORROWED = "已借阅"


class TransferStatus(str, Enum):
    PENDING = "待发出"
    IN_TRANSIT = "运输中"
    ARRIVED = "已到达"
    FAILED = "调拨失败"
    CANCELLED = "已取消"


class OperationType(str, Enum):
    CREATE_RESERVATION = "创建预约"
    CANCEL_RESERVATION = "取消预约"
    CREATE_TRANSFER = "创建调拨"
    START_TRANSFER = "开始调拨"
    TRANSFER_ARRIVED = "调拨到馆"
    SEND_NOTIFICATION = "发送到馆通知"
    PICKUP_BOOK = "取书"
    CREATE_BORROW = "生成借阅"
    OVERDUE_RELEASE = "逾期释放"
    MANUAL_CORRECTION = "人工修正"


class Reader(Base):
    __tablename__ = "readers"
    
    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    reservations = relationship("Reservation", back_populates="reader")
    borrows = relationship("Borrow", back_populates="reader")


class Book(Base):
    __tablename__ = "books"
    
    id = Column(String(50), primary_key=True)
    isbn = Column(String(20), nullable=False)
    title = Column(String(200), nullable=False)
    author = Column(String(100))
    publisher = Column(String(100))
    
    holdings = relationship("Holding", back_populates="book")


class Branch(Base):
    __tablename__ = "branches"
    
    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    address = Column(String(200))
    is_active = Column(Boolean, default=True)


class Holding(Base):
    __tablename__ = "holdings"
    
    id = Column(String(50), primary_key=True)
    book_id = Column(String(50), ForeignKey("books.id"), nullable=False)
    branch_id = Column(String(50), ForeignKey("branches.id"), nullable=False)
    barcode = Column(String(50), unique=True, nullable=False)
    status = Column(String(20), default="在馆")
    location = Column(String(100))
    last_checked_at = Column(DateTime, default=datetime.utcnow)
    
    book = relationship("Book", back_populates="holdings")
    reservations = relationship("Reservation", back_populates="holding")
    transfers_from = relationship("Transfer", foreign_keys="Transfer.from_holding_id", back_populates="from_holding")
    transfers_to = relationship("Transfer", foreign_keys="Transfer.to_holding_id", back_populates="to_holding")


class Reservation(Base):
    __tablename__ = "reservations"
    
    id = Column(String(50), primary_key=True)
    request_id = Column(String(100), unique=True, nullable=False)
    reader_id = Column(String(50), ForeignKey("readers.id"), nullable=False)
    book_id = Column(String(50), ForeignKey("books.id"), nullable=False)
    pickup_branch_id = Column(String(50), ForeignKey("branches.id"), nullable=False)
    holding_id = Column(String(50), ForeignKey("holdings.id"))
    queue_position = Column(Integer)
    status = Column(SAEnum(ReservationStatus), default=ReservationStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    transferred_at = Column(DateTime)
    arrived_at = Column(DateTime)
    pickup_deadline = Column(DateTime)
    picked_up_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    remarks = Column(Text)
    
    reader = relationship("Reader", back_populates="reservations")
    holding = relationship("Holding", back_populates="reservations")
    transfers = relationship("Transfer", back_populates="reservation")
    operations = relationship("OperationLog", back_populates="reservation")


class Transfer(Base):
    __tablename__ = "transfers"
    
    id = Column(String(50), primary_key=True)
    request_id = Column(String(100), unique=True, nullable=False)
    reservation_id = Column(String(50), ForeignKey("reservations.id"), nullable=False)
    from_branch_id = Column(String(50), ForeignKey("branches.id"), nullable=False)
    to_branch_id = Column(String(50), ForeignKey("branches.id"), nullable=False)
    from_holding_id = Column(String(50), ForeignKey("holdings.id"), nullable=False)
    to_holding_id = Column(String(50), ForeignKey("holdings.id"))
    status = Column(SAEnum(TransferStatus), default=TransferStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    arrived_at = Column(DateTime)
    estimated_arrival = Column(DateTime)
    remarks = Column(Text)
    
    reservation = relationship("Reservation", back_populates="transfers")
    from_holding = relationship("Holding", foreign_keys=[from_holding_id], back_populates="transfers_from")
    to_holding = relationship("Holding", foreign_keys=[to_holding_id], back_populates="transfers_to")


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(String(50), primary_key=True)
    reservation_id = Column(String(50), ForeignKey("reservations.id"), nullable=False)
    reader_id = Column(String(50), ForeignKey("readers.id"), nullable=False)
    type = Column(String(50), default="到馆通知")
    content = Column(Text, nullable=False)
    sent_at = Column(DateTime, default=datetime.utcnow)
    channel = Column(String(20), default="短信")
    status = Column(String(20), default="已发送")


class Borrow(Base):
    __tablename__ = "borrows"
    
    id = Column(String(50), primary_key=True)
    reservation_id = Column(String(50), ForeignKey("reservations.id"), nullable=False)
    reader_id = Column(String(50), ForeignKey("readers.id"), nullable=False)
    holding_id = Column(String(50), ForeignKey("holdings.id"), nullable=False)
    borrowed_at = Column(DateTime, default=datetime.utcnow)
    due_date = Column(Date, nullable=False)
    returned_at = Column(DateTime)
    status = Column(String(20), default="借阅中")
    remarks = Column(Text)
    
    reader = relationship("Reader", back_populates="borrows")


class OperationLog(Base):
    __tablename__ = "operation_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    operation_type = Column(SAEnum(OperationType), nullable=False)
    reservation_id = Column(String(50), ForeignKey("reservations.id"))
    transfer_id = Column(String(50))
    operator = Column(String(100), default="系统")
    description = Column(Text, nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    is_manual = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    reservation = relationship("Reservation", back_populates="operations")


Index('ix_reservations_reader', Reservation.reader_id)
Index('ix_reservations_book_status', Reservation.book_id, Reservation.status)
Index('ix_operation_logs_reservation', OperationLog.reservation_id)


def init_db():
    Base.metadata.create_all(bind=engine)
