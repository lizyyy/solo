from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, JSON
from sqlalchemy.sql import func

from .database import Base


class CollisionRecord(Base):
    __tablename__ = "collision_records"

    id = Column(String(32), primary_key=True, index=True)
    project_name = Column(String(128), index=True, nullable=False)
    floor = Column(String(32), index=True, nullable=False)
    node_code = Column(String(64), index=True, nullable=False)
    collision_type = Column(String(64), nullable=False)
    element_a = Column(String(128), nullable=False)
    element_b = Column(String(128), nullable=False)
    status = Column(String(32), index=True, nullable=False)
    initial_conclusion = Column(Text, nullable=False)
    screenshots = Column(JSON, nullable=False)
    clue_chain = Column(JSON, nullable=False)
    is_coordinate_offset = Column(Boolean, default=False, index=True)
    coordinate_offset_note = Column(Text, nullable=True)
    rejudge_count = Column(Integer, default=0)
    responsible_person = Column(String(64), nullable=False)
    is_sample = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CollisionHistory(Base):
    __tablename__ = "collision_history"

    id = Column(String(64), primary_key=True)
    collision_id = Column(String(32), index=True, nullable=False)
    previous_status = Column(String(32), nullable=False)
    new_status = Column(String(32), nullable=False)
    reason = Column(Text, nullable=False)
    operator = Column(String(64), nullable=False)
    evidence_urls = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
