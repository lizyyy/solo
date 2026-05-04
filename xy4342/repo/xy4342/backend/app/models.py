from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from enum import Enum
from .database import Base

class IssueSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class IssueStatus(str, Enum):
    OPEN = "open"
    DISMISSED = "dismissed"
    CONFIRMED = "confirmed"
    FIXED = "fixed"

class IssueCategory(str, Enum):
    COSTUME = "costume"
    PROP = "prop"
    TIMELINE = "timeline"
    ADDRESS = "address"
    SIMILARITY = "similarity"
    OTHER = "other"

class Chapter(Base):
    __tablename__ = "chapters"

    id = Column(Integer, primary_key=True, index=True)
    chapter_number = Column(Integer, nullable=False)
    chapter_title = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    panels = relationship("Panel", back_populates="chapter", cascade="all, delete-orphan")
    dialogues = relationship("Dialogue", back_populates="chapter", cascade="all, delete-orphan")

class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    full_name = Column(String(200))
    aliases = Column(Text)
    costume_default = Column(Text)
    costume_variants = Column(Text)
    props_default = Column(Text)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Panel(Base):
    __tablename__ = "panels"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"))
    panel_number = Column(Integer, nullable=False)
    page_number = Column(Integer)
    time_of_day = Column(String(50))
    location = Column(String(255))
    characters_present = Column(Text)
    costumes = Column(Text)
    props = Column(Text)
    action = Column(Text)
    sketch_path = Column(String(500))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chapter = relationship("Chapter", back_populates="panels")
    dialogues = relationship("Dialogue", back_populates="panel", cascade="all, delete-orphan")

class Dialogue(Base):
    __tablename__ = "dialogues"

    id = Column(Integer, primary_key=True, index=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"))
    panel_id = Column(Integer, ForeignKey("panels.id"))
    speaker = Column(String(100))
    address_to = Column(String(100))
    content = Column(Text, nullable=False)
    panel_number = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chapter = relationship("Chapter", back_populates="dialogues")
    panel = relationship("Panel", back_populates="dialogues")

class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(SQLEnum(IssueCategory), nullable=False)
    severity = Column(SQLEnum(IssueSeverity), default=IssueSeverity.MEDIUM)
    status = Column(SQLEnum(IssueStatus), default=IssueStatus.OPEN)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    affected_panels = Column(Text)
    affected_chapters = Column(Text)
    rule_name = Column(String(100))
    confidence = Column(Integer, default=100)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    reviews = relationship("Review", back_populates="issue", cascade="all, delete-orphan")

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"))
    reviewer = Column(String(100), default="主笔")
    comment = Column(Text)
    decision = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    issue = relationship("Issue", back_populates="reviews")
