"""数据库模型定义"""

import enum
from datetime import datetime, timedelta
from typing import Optional, List

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Float,
    ForeignKey,
    Enum as SQLEnum,
)
from sqlalchemy.orm import relationship, DeclarativeBase


class Base(DeclarativeBase):
    """基础模型类"""
    pass


class CheckType(enum.Enum):
    """检查类型枚举"""
    DIALOGUE_OVERLAP = "dialogue_overlap"
    MISSING_SCENE = "missing_scene"
    VOLUNTEER_CONFLICT = "volunteer_conflict"


class CheckStatus(enum.Enum):
    """检查结果状态枚举"""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    DISMISSED = "dismissed"


class Severity(enum.Enum):
    """问题严重程度枚举"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Screening(Base):
    """场次表"""
    __tablename__ = "screenings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    movie_name = Column(String(255), nullable=False, comment="电影名称")
    screening_time = Column(DateTime, nullable=False, comment="放映时间")
    duration = Column(Float, nullable=False, comment="时长（分钟）")
    location = Column(String(255), comment="放映地点")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")
    
    subtitles = relationship("Subtitle", back_populates="screening", cascade="all, delete-orphan")
    narrations = relationship("Narration", back_populates="screening", cascade="all, delete-orphan")
    volunteer_schedules = relationship("VolunteerSchedule", back_populates="screening", cascade="all, delete-orphan")
    check_results = relationship("CheckResult", back_populates="screening", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Screening(id={self.id}, movie='{self.movie_name}')>"


class Subtitle(Base):
    """字幕表"""
    __tablename__ = "subtitles"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    screening_id = Column(Integer, ForeignKey("screenings.id"), nullable=False, index=True)
    index = Column(Integer, nullable=False, comment="字幕序号")
    start_time = Column(Float, nullable=False, comment="开始时间（秒）")
    end_time = Column(Float, nullable=False, comment="结束时间（秒）")
    text = Column(Text, nullable=False, comment="字幕文本")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    
    screening = relationship("Screening", back_populates="subtitles")
    
    def __repr__(self):
        return f"<Subtitle(id={self.id}, index={self.index}, time={self.start_time}-{self.end_time})>"


class Narration(Base):
    """口述稿表"""
    __tablename__ = "narrations"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    screening_id = Column(Integer, ForeignKey("screenings.id"), nullable=False, index=True)
    index = Column(Integer, nullable=False, comment="段落序号")
    start_time = Column(Float, nullable=False, comment="开始时间（秒）")
    end_time = Column(Float, nullable=False, comment="结束时间（秒）")
    text = Column(Text, nullable=False, comment="口述文本")
    is_critical = Column(Integer, default=0, comment="是否关键场景（1=是，0=否）")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    
    screening = relationship("Screening", back_populates="narrations")
    
    def __repr__(self):
        return f"<Narration(id={self.id}, index={self.index}, critical={self.is_critical})>"


class VolunteerSchedule(Base):
    """志愿者排班表"""
    __tablename__ = "volunteer_schedules"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    screening_id = Column(Integer, ForeignKey("screenings.id"), nullable=False, index=True)
    volunteer_name = Column(String(100), nullable=False, comment="志愿者姓名")
    role = Column(String(50), comment="角色（口述、引导等）")
    start_time = Column(DateTime, nullable=False, comment="开始时间")
    end_time = Column(DateTime, nullable=False, comment="结束时间")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    
    screening = relationship("Screening", back_populates="volunteer_schedules")
    
    def __repr__(self):
        return f"<VolunteerSchedule(id={self.id}, volunteer='{self.volunteer_name}')>"


class CheckResult(Base):
    """检查结果表"""
    __tablename__ = "check_results"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    screening_id = Column(Integer, ForeignKey("screenings.id"), nullable=False, index=True)
    check_type = Column(SQLEnum(CheckType), nullable=False, comment="检查类型")
    severity = Column(SQLEnum(Severity), default=Severity.MEDIUM, comment="严重程度")
    status = Column(SQLEnum(CheckStatus), default=CheckStatus.PENDING, comment="状态")
    description = Column(Text, nullable=False, comment="问题描述")
    related_ids = Column(String(500), comment="关联ID列表（JSON格式）")
    time_start = Column(Float, comment="问题开始时间（秒）")
    time_end = Column(Float, comment="问题结束时间（秒）")
    notes = Column(Text, comment="复核备注")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")
    
    screening = relationship("Screening", back_populates="check_results")
    
    def __repr__(self):
        return f"<CheckResult(id={self.id}, type={self.check_type.value}, status={self.status.value})>"
