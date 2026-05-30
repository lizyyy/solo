import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from app.database import Base


class AuthStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    RETURNED = "returned"


class Show(Base):
    __tablename__ = "shows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    producer = Column(String(200), nullable=False)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    contracts = relationship("AuthContract", back_populates="show")


class IntroMusic(Base):
    __tablename__ = "intro_musics"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    artist = Column(String(200), nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    current_version = Column(String(50), nullable=False, default="v1")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    file_versions = relationship("FileVersion", back_populates="intro_music", order_by="FileVersion.created_at.desc()")
    contracts = relationship("AuthContract", back_populates="intro_music")


class FileVersion(Base):
    __tablename__ = "file_versions"

    id = Column(Integer, primary_key=True, index=True)
    intro_music_id = Column(Integer, ForeignKey("intro_musics.id"), nullable=False)
    version = Column(String(50), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_hash = Column(String(64), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    intro_music = relationship("IntroMusic", back_populates="file_versions")


class AuthContract(Base):
    __tablename__ = "auth_contracts"

    id = Column(Integer, primary_key=True, index=True)
    show_id = Column(Integer, ForeignKey("shows.id"), nullable=False)
    intro_music_id = Column(Integer, ForeignKey("intro_musics.id"), nullable=False)
    status = Column(Enum(AuthStatus), default=AuthStatus.PENDING, nullable=False)
    authorized_episode_count = Column(Integer, nullable=False)
    used_episode_count = Column(Integer, default=0, nullable=False)
    auth_start_date = Column(Date, nullable=False)
    auth_end_date = Column(Date, nullable=False)
    locked_file_version = Column(String(50), nullable=True)
    contract_ref = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    show = relationship("Show", back_populates="contracts")
    intro_music = relationship("IntroMusic", back_populates="contracts")
    episode_usages = relationship("EpisodeUsage", back_populates="contract", order_by="EpisodeUsage.used_at.desc()")
    audit_logs = relationship("AuditLog", back_populates="contract", order_by="AuditLog.created_at.desc()")


class EpisodeUsage(Base):
    __tablename__ = "episode_usages"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("auth_contracts.id"), nullable=False)
    episode_number = Column(Integer, nullable=False)
    episode_title = Column(String(300), nullable=False)
    file_version_used = Column(String(50), nullable=False)
    used_at = Column(DateTime, default=datetime.utcnow)

    contract = relationship("AuthContract", back_populates="episode_usages")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    contract_id = Column(Integer, ForeignKey("auth_contracts.id"), nullable=False)
    action = Column(String(100), nullable=False)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=True)
    reason = Column(Text, nullable=False)
    operator = Column(String(200), nullable=False)
    detail = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    contract = relationship("AuthContract", back_populates="audit_logs")
