from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Image(Base):
    __tablename__ = "images"
    
    id = Column(Integer, primary_key=True, index=True)
    original_url = Column(String, unique=True, index=True)
    file_name = Column(String)
    file_path = Column(String)
    upload_date = Column(DateTime, default=datetime.utcnow)
    copyright_expiry_date = Column(DateTime)
    copyright_holder = Column(String)
    license_type = Column(String)
    status = Column(String, default="normal")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    usages = relationship("ImageUsage", back_populates="image", cascade="all, delete-orphan")
    replacements = relationship("ReplacementRecord", foreign_keys="ReplacementRecord.old_image_id", back_populates="old_image")

class ImageUsage(Base):
    __tablename__ = "image_usages"
    
    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(Integer, ForeignKey("images.id"))
    page_url = Column(String, index=True)
    page_title = Column(String)
    usage_location = Column(String)
    is_active = Column(Boolean, default=True)
    added_at = Column(DateTime, default=datetime.utcnow)
    
    image = relationship("Image", back_populates="usages")

class ReplacementRecord(Base):
    __tablename__ = "replacement_records"
    
    id = Column(Integer, primary_key=True, index=True)
    old_image_id = Column(Integer, ForeignKey("images.id"))
    new_image_id = Column(Integer, ForeignKey("images.id"))
    page_url = Column(String)
    old_url = Column(String)
    new_url = Column(String)
    status = Column(String, default="pending")
    initiated_by = Column(String)
    initiated_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    replacement_key = Column(String, unique=True, index=True)
    
    old_image = relationship("Image", foreign_keys=[old_image_id], back_populates="replacements")
    new_image = relationship("Image", foreign_keys=[new_image_id])

class CopyrightExtension(Base):
    __tablename__ = "copyright_extensions"
    
    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(Integer, ForeignKey("images.id"))
    previous_expiry_date = Column(DateTime)
    new_expiry_date = Column(DateTime)
    extended_by = Column(String)
    reason = Column(Text)
    extended_at = Column(DateTime, default=datetime.utcnow)
