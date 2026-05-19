from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./env_rotation.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class VariableStatus(str, enum.Enum):
    PENDING = "pending"
    REVIEW_REQUIRED = "review_required"
    APPROVED = "approved"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ROLLED_BACK = "rolled_back"
    SKIPPED = "skipped"


class EnvFile(Base):
    __tablename__ = "env_files"
    
    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, unique=True, index=True, nullable=False)
    project_name = Column(String, index=True)
    environment = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    variables = relationship("EnvVariable", back_populates="env_file", cascade="all, delete-orphan")


class EnvVariable(Base):
    __tablename__ = "env_variables"
    
    id = Column(Integer, primary_key=True, index=True)
    env_file_id = Column(Integer, ForeignKey("env_files.id"), nullable=False)
    key = Column(String, index=True, nullable=False)
    original_value = Column(Text)
    current_value = Column(Text)
    description = Column(Text)
    category = Column(String, index=True)
    is_sensitive = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    env_file = relationship("EnvFile", back_populates="variables")
    references_from = relationship(
        "VariableReference",
        foreign_keys="VariableReference.from_variable_id",
        back_populates="from_variable",
        cascade="all, delete-orphan"
    )
    references_to = relationship(
        "VariableReference",
        foreign_keys="VariableReference.to_variable_id",
        back_populates="to_variable",
        cascade="all, delete-orphan"
    )
    rotation_items = relationship("RotationItem", back_populates="variable", cascade="all, delete-orphan")


class VariableReference(Base):
    __tablename__ = "variable_references"
    
    id = Column(Integer, primary_key=True, index=True)
    from_variable_id = Column(Integer, ForeignKey("env_variables.id"), nullable=False)
    to_variable_id = Column(Integer, ForeignKey("env_variables.id"), nullable=False)
    reference_type = Column(String)
    line_number = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    from_variable = relationship(
        "EnvVariable",
        foreign_keys=[from_variable_id],
        back_populates="references_from"
    )
    to_variable = relationship(
        "EnvVariable",
        foreign_keys=[to_variable_id],
        back_populates="references_to"
    )


class ResponsiblePerson(Base):
    __tablename__ = "responsible_persons"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, index=True)
    department = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    rotation_batches = relationship("RotationBatch", back_populates="responsible_person")


class RotationBatch(Base):
    __tablename__ = "rotation_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, unique=True, index=True, nullable=False)
    description = Column(Text)
    responsible_person_id = Column(Integer, ForeignKey("responsible_persons.id"))
    status = Column(Enum(VariableStatus), default=VariableStatus.PENDING)
    scheduled_at = Column(DateTime)
    executed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    responsible_person = relationship("ResponsiblePerson", back_populates="rotation_batches")
    items = relationship("RotationItem", back_populates="batch", cascade="all, delete-orphan")


class RotationItem(Base):
    __tablename__ = "rotation_items"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("rotation_batches.id"), nullable=False)
    variable_id = Column(Integer, ForeignKey("env_variables.id"), nullable=False)
    new_value = Column(Text)
    rollback_value = Column(Text)
    status = Column(Enum(VariableStatus), default=VariableStatus.PENDING)
    requires_review = Column(Boolean, default=False)
    review_note = Column(Text)
    executed_at = Column(DateTime)
    rolled_back_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    batch = relationship("RotationBatch", back_populates="items")
    variable = relationship("EnvVariable", back_populates="rotation_items")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
