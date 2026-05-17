import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from database import Base


class AppealStatus(str, enum.Enum):
    BANNED = "已封禁"
    APPEALING = "申诉中"
    RESTORED = "已恢复"
    MAINTAINED = "维持封禁"


class AppealSource(str, enum.Enum):
    MANUAL = "人工申诉"
    BATCH_IMPORT = "批量导入"
    AUTO_REVIEW = "自动复核"


class Appeal(Base):
    __tablename__ = "appeals"

    id = Column(Integer, primary_key=True, index=True)
    image_url = Column(String(500), nullable=False, index=True)
    image_hash = Column(String(64), index=True)
    review_tags = Column(String(200), nullable=False)
    model_version = Column(String(50), nullable=False)
    appeal_material = Column(Text)
    status = Column(Enum(AppealStatus), default=AppealStatus.BANNED, index=True)
    source = Column(Enum(AppealSource), default=AppealSource.MANUAL)
    operator = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    history = relationship("AppealHistory", back_populates="appeal", cascade="all, delete-orphan")


class AppealHistory(Base):
    __tablename__ = "appeal_history"

    id = Column(Integer, primary_key=True, index=True)
    appeal_id = Column(Integer, ForeignKey("appeals.id"), nullable=False)
    old_status = Column(Enum(AppealStatus))
    new_status = Column(Enum(AppealStatus), nullable=False)
    source = Column(Enum(AppealSource), nullable=False)
    operator = Column(String(100), nullable=False)
    remark = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    appeal = relationship("Appeal", back_populates="history")
