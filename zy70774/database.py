from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./changelog_impact.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"
    NEEDS_REVIEW = "needs_review"
    ERROR = "error"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ChangeLog(Base):
    __tablename__ = "changelogs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    version = Column(String(50))
    release_date = Column(DateTime)
    status = Column(Enum(ProcessingStatus), default=ProcessingStatus.PENDING)
    risk_level = Column(Enum(RiskLevel), default=RiskLevel.LOW)
    needs_human_review = Column(Boolean, default=False)
    review_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    processed_by = Column(String(100))

    tags = relationship("ModuleTag", back_populates="changelog", cascade="all, delete-orphan")
    interfaces = relationship("Interface", back_populates="changelog", cascade="all, delete-orphan")
    customer_impacts = relationship("CustomerImpact", back_populates="changelog", cascade="all, delete-orphan")
    risk_words = relationship("RiskWordMatch", back_populates="changelog", cascade="all, delete-orphan")


class ModuleTag(Base):
    __tablename__ = "module_tags"

    id = Column(Integer, primary_key=True, index=True)
    changelog_id = Column(Integer, ForeignKey("changelogs.id"))
    tag_name = Column(String(100), nullable=False)
    confidence = Column(Integer, default=100)
    source = Column(String(50))

    changelog = relationship("ChangeLog", back_populates="tags")


class Interface(Base):
    __tablename__ = "interfaces"

    id = Column(Integer, primary_key=True, index=True)
    changelog_id = Column(Integer, ForeignKey("changelogs.id"))
    interface_name = Column(String(255), nullable=False)
    interface_type = Column(String(50))
    method = Column(String(20))
    path = Column(String(500))
    change_type = Column(String(50))
    description = Column(Text)

    changelog = relationship("ChangeLog", back_populates="interfaces")


class RiskWordMatch(Base):
    __tablename__ = "risk_word_matches"

    id = Column(Integer, primary_key=True, index=True)
    changelog_id = Column(Integer, ForeignKey("changelogs.id"))
    word = Column(String(100), nullable=False)
    risk_level = Column(Enum(RiskLevel))
    context = Column(Text)
    position = Column(Integer)

    changelog = relationship("ChangeLog", back_populates="risk_words")


class CustomerImpact(Base):
    __tablename__ = "customer_impacts"

    id = Column(Integer, primary_key=True, index=True)
    changelog_id = Column(Integer, ForeignKey("changelogs.id"))
    customer_segment = Column(String(100), nullable=False)
    impact_description = Column(Text)
    affected_features = Column(Text)
    action_required = Column(Boolean, default=False)
    action_description = Column(Text)

    changelog = relationship("ChangeLog", back_populates="customer_impacts")


class RiskWordLibrary(Base):
    __tablename__ = "risk_word_library"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String(100), nullable=False, unique=True)
    risk_level = Column(Enum(RiskLevel), nullable=False)
    category = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    
    risk_words = [
        ("废弃", RiskLevel.CRITICAL, "兼容性"),
        ("deprecate", RiskLevel.CRITICAL, "兼容性"),
        ("移除", RiskLevel.CRITICAL, "兼容性"),
        ("remove", RiskLevel.CRITICAL, "兼容性"),
        ("删除", RiskLevel.CRITICAL, "兼容性"),
        ("delete", RiskLevel.CRITICAL, "兼容性"),
        ("中断", RiskLevel.HIGH, "可用性"),
        ("break", RiskLevel.HIGH, "可用性"),
        ("不兼容", RiskLevel.HIGH, "兼容性"),
        ("incompatible", RiskLevel.HIGH, "兼容性"),
        ("修改", RiskLevel.MEDIUM, "变更"),
        ("modify", RiskLevel.MEDIUM, "变更"),
        ("变更", RiskLevel.MEDIUM, "变更"),
        ("change", RiskLevel.MEDIUM, "变更"),
        ("更新", RiskLevel.LOW, "常规"),
        ("update", RiskLevel.LOW, "常规"),
        ("修复", RiskLevel.LOW, "常规"),
        ("fix", RiskLevel.LOW, "常规"),
        ("新增", RiskLevel.LOW, "新增"),
        ("add", RiskLevel.LOW, "新增"),
        ("优化", RiskLevel.LOW, "优化"),
        ("optimize", RiskLevel.LOW, "优化"),
    ]
    
    for word, level, category in risk_words:
        existing = session.query(RiskWordLibrary).filter_by(word=word).first()
        if not existing:
            session.add(RiskWordLibrary(word=word, risk_level=level, category=category))
    
    session.commit()
    session.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
