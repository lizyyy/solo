from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class ApiDocument(Base):
    __tablename__ = "api_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)
    url = Column(String(500), nullable=False)
    raw_content = Column(Text, nullable=False)
    processed_content = Column(JSON)
    auth_type = Column(String(50), default="none")
    auth_config = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    execution_records = relationship("ExecutionRecord", back_populates="document")
    favorites = relationship("Favorite", back_populates="document")

class ExecutionRecord(Base):
    __tablename__ = "execution_records"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("api_documents.id"))
    request_params = Column(JSON)
    raw_request = Column(JSON)
    is_dirty = Column(Boolean, default=False)
    dirty_reasons = Column(JSON)
    is_blocked = Column(Boolean, default=False)
    error_message = Column(Text)
    status = Column(String(50), default="pending")
    response_data = Column(JSON)
    executed_at = Column(DateTime, default=datetime.utcnow)
    corrected_params = Column(JSON)
    correction_explanation = Column(Text)
    
    document = relationship("ApiDocument", back_populates="execution_records")

class Favorite(Base):
    __tablename__ = "favorites"
    
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("api_documents.id"))
    example_params = Column(JSON)
    note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    document = relationship("ApiDocument", back_populates="favorites")
