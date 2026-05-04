from sqlalchemy import Column, Integer, String, Date, Text, ForeignKey, DateTime, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime, date
from app.database import Base
import enum


class DrynessStatus(str, enum.Enum):
    NOT_DRY = "not_dry"
    PARTIALLY_DRY = "partially_dry"
    DRY = "dry"


class FiringResult(str, enum.Enum):
    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILURE = "failure"


class Work(Base):
    __tablename__ = "works"
    
    id = Column(Integer, primary_key=True, index=True)
    student_name = Column(String(255), nullable=False, index=True)
    work_description = Column(Text, nullable=True)
    dryness_status = Column(SQLEnum(DrynessStatus), nullable=False, default=DrynessStatus.NOT_DRY)
    glaze_type = Column(String(255), nullable=False)
    expected_pickup_date = Column(Date, nullable=False)
    temperature_zone = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    kiln_loadings = relationship("KilnLoading", back_populates="work", cascade="all, delete-orphan")
    
    @property
    def is_dry(self) -> bool:
        return self.dryness_status == DrynessStatus.DRY
    
    @property
    def is_delayed(self) -> bool:
        if not self.expected_pickup_date:
            return False
        today = date.today()
        if self.expected_pickup_date < today:
            return True
        return False


class KilnSession(Base):
    __tablename__ = "kiln_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_name = Column(String(255), nullable=False)
    target_temperature_zone = Column(String(50), nullable=False)
    scheduled_firing_date = Column(Date, nullable=False)
    max_capacity = Column(Integer, nullable=False, default=50)
    is_fired = Column(Boolean, default=False)
    firing_start_time = Column(DateTime, nullable=True)
    firing_end_time = Column(DateTime, nullable=True)
    firing_result = Column(SQLEnum(FiringResult), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    kiln_loadings = relationship("KilnLoading", back_populates="kiln_session", cascade="all, delete-orphan")
    
    @property
    def current_load(self) -> int:
        return len(self.kiln_loadings)
    
    @property
    def is_overloaded(self) -> bool:
        return self.current_load > self.max_capacity
    
    @property
    def is_ready_to_fire(self) -> bool:
        if self.is_fired:
            return False
        return 0 < self.current_load <= self.max_capacity


class KilnLoading(Base):
    __tablename__ = "kiln_loadings"
    
    id = Column(Integer, primary_key=True, index=True)
    work_id = Column(Integer, ForeignKey("works.id"), nullable=False, index=True)
    kiln_session_id = Column(Integer, ForeignKey("kiln_sessions.id"), nullable=False, index=True)
    position_notes = Column(Text, nullable=True)
    loading_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    work = relationship("Work", back_populates="kiln_loadings")
    kiln_session = relationship("KilnSession", back_populates="kiln_loadings")
