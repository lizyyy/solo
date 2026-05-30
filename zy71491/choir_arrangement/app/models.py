from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    voice_part = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    absences = relationship("Absence", back_populates="member")
    arrangements = relationship("Arrangement", back_populates="member")


class Absence(Base):
    __tablename__ = "absences"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    rehearsal_date = Column(String, nullable=False)
    reason = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    member = relationship("Member", back_populates="absences")


class Rehearsal(Base):
    __tablename__ = "rehearsals"

    id = Column(Integer, primary_key=True, index=True)
    rehearsal_date = Column(String, unique=True, nullable=False)
    difficulty = Column(Integer, default=1)
    notes = Column(Text)
    status = Column(String, default="draft")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    arrangements = relationship("Arrangement", back_populates="rehearsal")


class Arrangement(Base):
    __tablename__ = "arrangements"

    id = Column(Integer, primary_key=True, index=True)
    rehearsal_id = Column(Integer, ForeignKey("rehearsals.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    position_row = Column(Integer)
    position_col = Column(Integer)
    is_substitute = Column(Boolean, default=False)
    substituted_for = Column(Integer)
    is_manual = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    member = relationship("Member", back_populates="arrangements")
    rehearsal = relationship("Rehearsal", back_populates="arrangements")


class SubstitutePool(Base):
    __tablename__ = "substitute_pool"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False)
    voice_part = Column(String, nullable=False)
    priority = Column(Integer, default=0)
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ArrangementHistory(Base):
    __tablename__ = "arrangement_history"

    id = Column(Integer, primary_key=True, index=True)
    rehearsal_id = Column(Integer, nullable=False)
    action_type = Column(String, nullable=False)
    field_name = Column(String)
    old_value = Column(Text)
    new_value = Column(Text)
    changed_by = Column(String)
    reason = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
