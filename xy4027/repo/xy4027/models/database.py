from datetime import datetime
from typing import Optional, List
from enum import Enum

from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean, 
    DateTime, Text, ForeignKey, Enum as SQLAlchemyEnum
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker, Session


Base = declarative_base()


class MarkStatus(str, Enum):
    KEEP = "keep"
    MUTE = "mute"
    BEEP = "beep"
    REVIEW = "review"


class RiskLevel(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RuleType(str, Enum):
    PHONE = "phone"
    EMAIL = "email"
    ID_CARD = "id_card"
    BANK_CARD = "bank_card"
    ADDRESS = "address"
    CUSTOM = "custom"


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    audio_path = Column(String(1024), nullable=True)
    audio_duration = Column(Float, nullable=True)
    
    transcription_path = Column(String(1024), nullable=True)
    transcription_format = Column(String(20), nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    segments = relationship("Segment", back_populates="project", cascade="all, delete-orphan")
    hits = relationship("SensitiveHit", back_populates="project", cascade="all, delete-orphan")
    custom_rules = relationship("CustomRule", back_populates="project", cascade="all, delete-orphan")


class Segment(Base):
    __tablename__ = "segments"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    text = Column(Text, nullable=False)
    
    is_overlapping = Column(Boolean, default=False)
    overlap_with = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    
    project = relationship("Project", back_populates="segments")
    hits = relationship("SensitiveHit", back_populates="segment", cascade="all, delete-orphan")


class SensitiveHit(Base):
    __tablename__ = "sensitive_hits"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    segment_id = Column(Integer, ForeignKey("segments.id"), nullable=False, index=True)
    
    rule_type = Column(SQLAlchemyEnum(RuleType), nullable=False)
    rule_name = Column(String(255), nullable=True)
    
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    
    matched_text = Column(Text, nullable=False)
    context_before = Column(Text, nullable=True)
    context_after = Column(Text, nullable=True)
    
    risk_level = Column(SQLAlchemyEnum(RiskLevel), default=RiskLevel.MEDIUM)
    mark_status = Column(SQLAlchemyEnum(MarkStatus), default=MarkStatus.REVIEW)
    is_duplicate = Column(Boolean, default=False)
    duplicate_of = Column(Integer, nullable=True)
    
    is_manual = Column(Boolean, default=False)
    manual_note = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    project = relationship("Project", back_populates="hits")
    segment = relationship("Segment", back_populates="hits")


class CustomRule(Base):
    __tablename__ = "custom_rules"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    rule_type = Column(SQLAlchemyEnum(RuleType), default=RuleType.CUSTOM)
    
    pattern = Column(String(1024), nullable=False)
    is_regex = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    risk_level = Column(SQLAlchemyEnum(RiskLevel), default=RiskLevel.MEDIUM)
    
    created_at = Column(DateTime, default=datetime.now)
    
    project = relationship("Project", back_populates="custom_rules")


def get_database_path() -> str:
    import os
    home = os.path.expanduser("~")
    app_data = os.path.join(home, ".desensitize_scissors")
    if not os.path.exists(app_data):
        os.makedirs(app_data)
    return os.path.join(app_data, "projects.db")


def get_engine(db_path: Optional[str] = None):
    if db_path is None:
        db_path = get_database_path()
    return create_engine(f"sqlite:///{db_path}", echo=False)


def init_db(engine):
    Base.metadata.create_all(engine)


def get_session_factory(engine):
    return sessionmaker(bind=engine)


class DatabaseManager:
    def __init__(self, db_path: Optional[str] = None):
        self.engine = get_engine(db_path)
        init_db(self.engine)
        self.Session = sessionmaker(bind=self.engine)
    
    def get_session(self) -> Session:
        return self.Session()
    
    def create_project(self, name: str, description: str = "") -> Project:
        session = self.get_session()
        try:
            project = Project(name=name, description=description)
            session.add(project)
            session.commit()
            session.refresh(project)
            return project
        finally:
            session.close()
    
    def get_project(self, project_id: int) -> Optional[Project]:
        session = self.get_session()
        try:
            return session.query(Project).filter(Project.id == project_id).first()
        finally:
            session.close()
    
    def get_all_projects(self) -> List[Project]:
        session = self.get_session()
        try:
            return session.query(Project).order_by(Project.updated_at.desc()).all()
        finally:
            session.close()
    
    def update_project(self, project_id: int, **kwargs) -> bool:
        session = self.get_session()
        try:
            project = session.query(Project).filter(Project.id == project_id).first()
            if project:
                for key, value in kwargs.items():
                    setattr(project, key, value)
                project.updated_at = datetime.now()
                session.commit()
                return True
            return False
        finally:
            session.close()
    
    def delete_project(self, project_id: int) -> bool:
        session = self.get_session()
        try:
            project = session.query(Project).filter(Project.id == project_id).first()
            if project:
                session.delete(project)
                session.commit()
                return True
            return False
        finally:
            session.close()
    
    def add_segments(self, project_id: int, segments_data: List[dict]) -> int:
        session = self.get_session()
        try:
            project = session.query(Project).filter(Project.id == project_id).first()
            if not project:
                return 0
            
            for seg_data in segments_data:
                segment = Segment(
                    project_id=project_id,
                    start_time=seg_data["start_time"],
                    end_time=seg_data["end_time"],
                    text=seg_data["text"],
                    is_overlapping=seg_data.get("is_overlapping", False),
                    overlap_with=seg_data.get("overlap_with")
                )
                session.add(segment)
            
            session.commit()
            return len(segments_data)
        finally:
            session.close()
    
    def get_project_segments(self, project_id: int) -> List[Segment]:
        session = self.get_session()
        try:
            return session.query(Segment).filter(
                Segment.project_id == project_id
            ).order_by(Segment.start_time).all()
        finally:
            session.close()
    
    def clear_project_segments(self, project_id: int) -> bool:
        session = self.get_session()
        try:
            session.query(Segment).filter(Segment.project_id == project_id).delete()
            session.commit()
            return True
        finally:
            session.close()
    
    def add_hits(self, project_id: int, hits_data: List[dict]) -> int:
        session = self.get_session()
        try:
            project = session.query(Project).filter(Project.id == project_id).first()
            if not project:
                return 0
            
            for hit_data in hits_data:
                hit = SensitiveHit(
                    project_id=project_id,
                    segment_id=hit_data.get("segment_id"),
                    rule_type=hit_data["rule_type"],
                    rule_name=hit_data.get("rule_name"),
                    start_time=hit_data["start_time"],
                    end_time=hit_data["end_time"],
                    matched_text=hit_data["matched_text"],
                    context_before=hit_data.get("context_before"),
                    context_after=hit_data.get("context_after"),
                    risk_level=hit_data.get("risk_level", RiskLevel.MEDIUM),
                    mark_status=hit_data.get("mark_status", MarkStatus.REVIEW),
                    is_duplicate=hit_data.get("is_duplicate", False),
                    duplicate_of=hit_data.get("duplicate_of"),
                    is_manual=hit_data.get("is_manual", False),
                    manual_note=hit_data.get("manual_note")
                )
                session.add(hit)
            
            session.commit()
            return len(hits_data)
        finally:
            session.close()
    
    def get_project_hits(self, project_id: int) -> List[SensitiveHit]:
        session = self.get_session()
        try:
            return session.query(SensitiveHit).filter(
                SensitiveHit.project_id == project_id
            ).order_by(SensitiveHit.start_time).all()
        finally:
            session.close()
    
    def update_hit_status(self, hit_id: int, status: MarkStatus, note: str = "") -> bool:
        session = self.get_session()
        try:
            hit = session.query(SensitiveHit).filter(SensitiveHit.id == hit_id).first()
            if hit:
                hit.mark_status = status
                if note:
                    hit.manual_note = note
                hit.updated_at = datetime.now()
                session.commit()
                return True
            return False
        finally:
            session.close()
    
    def clear_project_hits(self, project_id: int) -> bool:
        session = self.get_session()
        try:
            session.query(SensitiveHit).filter(SensitiveHit.project_id == project_id).delete()
            session.commit()
            return True
        finally:
            session.close()
    
    def add_custom_rule(self, project_id: int, name: str, pattern: str, 
                        is_regex: bool = False, risk_level: RiskLevel = RiskLevel.MEDIUM) -> Optional[CustomRule]:
        session = self.get_session()
        try:
            rule = CustomRule(
                project_id=project_id,
                name=name,
                pattern=pattern,
                is_regex=is_regex,
                risk_level=risk_level
            )
            session.add(rule)
            session.commit()
            session.refresh(rule)
            return rule
        finally:
            session.close()
    
    def get_project_rules(self, project_id: int) -> List[CustomRule]:
        session = self.get_session()
        try:
            return session.query(CustomRule).filter(
                CustomRule.project_id == project_id,
                CustomRule.is_active == True
            ).all()
        finally:
            session.close()
