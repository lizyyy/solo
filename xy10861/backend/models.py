from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_URL = f"sqlite:///{os.path.join(BASE_DIR, 'data', 'env_diff.db')}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Environment(Base):
    __tablename__ = "environments"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True)
    description = Column(Text, nullable=True)
    is_protected = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    variables = relationship("EnvVariable", back_populates="environment", cascade="all, delete-orphan")

class EnvVariable(Base):
    __tablename__ = "env_variables"
    
    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id"))
    key = Column(String(255), index=True)
    value = Column(Text)
    is_sensitive = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    environment = relationship("Environment", back_populates="variables")

class DiffSnapshot(Base):
    __tablename__ = "diff_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    env1_id = Column(Integer, ForeignKey("environments.id"))
    env2_id = Column(Integer, ForeignKey("environments.id"))
    diff_data = Column(Text)
    created_by = Column(String(100), default="system")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    env1 = relationship("Environment", foreign_keys=[env1_id])
    env2 = relationship("Environment", foreign_keys=[env2_id])

class ChangeRequest(Base):
    __tablename__ = "change_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    description = Column(Text, nullable=True)
    source_env_id = Column(Integer, ForeignKey("environments.id"))
    target_env_id = Column(Integer, ForeignKey("environments.id"))
    variable_key = Column(String(255))
    source_value = Column(Text)
    target_value = Column(Text)
    proposed_value = Column(Text)
    is_sensitive = Column(Boolean, default=False)
    status = Column(String(50), default="pending")
    requested_by = Column(String(100))
    approved_by = Column(String(100), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    source_env = relationship("Environment", foreign_keys=[source_env_id])
    target_env = relationship("Environment", foreign_keys=[target_env_id])

class SyncRecord(Base):
    __tablename__ = "sync_records"
    
    id = Column(Integer, primary_key=True, index=True)
    change_request_id = Column(Integer, ForeignKey("change_requests.id"), nullable=True)
    source_env_id = Column(Integer, ForeignKey("environments.id"))
    target_env_id = Column(Integer, ForeignKey("environments.id"))
    variable_key = Column(String(255))
    old_value = Column(Text)
    new_value = Column(Text)
    synced_by = Column(String(100))
    status = Column(String(50), default="success")
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    change_request = relationship("ChangeRequest")
    source_env = relationship("Environment", foreign_keys=[source_env_id])
    target_env = relationship("Environment", foreign_keys=[target_env_id])

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
