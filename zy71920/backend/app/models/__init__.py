from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base


class Artwork(Base):
    __tablename__ = "artworks"

    id = Column(Integer, primary_key=True, index=True)
    artwork_id = Column(String, index=True)
    title = Column(String)
    artist = Column(String)
    width = Column(Float)
    height = Column(Float)
    depth = Column(Float, nullable=True)
    unit = Column(String, default="cm")
    medium = Column(String, nullable=True)
    year = Column(String, nullable=True)
    wall_location = Column(String, nullable=True)
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    status = Column(String, default="pending")
    issues = Column(JSON, default=list)
    needs_confirmation = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lightings = relationship("Lighting", back_populates="artwork")
    version_history = relationship("VersionHistory", back_populates="artwork")


class Wall(Base):
    __tablename__ = "walls"

    id = Column(Integer, primary_key=True, index=True)
    wall_id = Column(String, index=True)
    name = Column(String)
    width = Column(Float)
    height = Column(Float)
    location = Column(String, nullable=True)
    version = Column(Integer, default=1)
    uploaded_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Lighting(Base):
    __tablename__ = "lightings"

    id = Column(Integer, primary_key=True, index=True)
    artwork_id = Column(Integer, ForeignKey("artworks.id"))
    light_type = Column(String)
    intensity = Column(Integer)
    color_temp = Column(Integer, nullable=True)
    angle = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    is_locked = Column(Boolean, default=False)
    locked_by = Column(String, nullable=True)
    locked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    artwork = relationship("Artwork", back_populates="lightings")


class VersionHistory(Base):
    __tablename__ = "version_history"

    id = Column(Integer, primary_key=True, index=True)
    artwork_id = Column(Integer, ForeignKey("artworks.id"))
    version_number = Column(Integer)
    field_name = Column(String)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    changed_by = Column(String, nullable=True)
    change_reason = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    artwork = relationship("Artwork", back_populates="version_history")


class ImportSession(Base):
    __tablename__ = "import_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_name = Column(String)
    filename = Column(String)
    total_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    warning_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    issues = Column(JSON, default=list)
    created_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
