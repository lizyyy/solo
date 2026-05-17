from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Date, Boolean, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
import enum
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./meeting_actions.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class ActionStatus(str, enum.Enum):
    PENDING = "待处理"
    IN_PROGRESS = "进行中"
    COMPLETED = "已完成"
    DELAYED = "已延期"
    NEEDS_REVIEW = "需人工复核"
    CANCELLED = "已取消"

class MeetingMinute(Base):
    __tablename__ = "meeting_minutes"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    meeting_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    processed = Column(Boolean, default=False)
    
    action_items = relationship("ActionItem", back_populates="meeting", cascade="all, delete-orphan")

class Person(Base):
    __tablename__ = "persons"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    alias = Column(String(200))
    department = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    action_items = relationship("ActionItem", back_populates="assignee")

class ActionItem(Base):
    __tablename__ = "action_items"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("meeting_minutes.id"))
    content = Column(Text, nullable=False)
    assignee_id = Column(Integer, ForeignKey("persons.id"))
    raw_assignee = Column(String(100))
    due_date = Column(Date)
    raw_due_date = Column(String(100))
    status = Column(Enum(ActionStatus), default=ActionStatus.PENDING)
    delay_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    needs_review = Column(Boolean, default=False)
    review_notes = Column(Text)
    
    meeting = relationship("MeetingMinute", back_populates="action_items")
    assignee = relationship("Person", back_populates="action_items")
    delay_records = relationship("DelayRecord", back_populates="action_item", cascade="all, delete-orphan")

class DelayRecord(Base):
    __tablename__ = "delay_records"
    
    id = Column(Integer, primary_key=True, index=True)
    action_item_id = Column(Integer, ForeignKey("action_items.id"))
    original_due_date = Column(Date)
    new_due_date = Column(Date)
    reason = Column(Text, nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow)
    
    action_item = relationship("ActionItem", back_populates="delay_records")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
