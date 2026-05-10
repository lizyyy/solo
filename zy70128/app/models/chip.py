from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from app.models.base import BaseModel


class ChipBatch(BaseModel):
    """芯片数据批次"""

    __tablename__ = "chip_batches"

    race_id = Column(Integer, ForeignKey("races.id"), nullable=False, index=True)
    batch_name = Column(String(100), nullable=False)
    import_status = Column(String(20), nullable=False, default="PENDING")  # PENDING, PROCESSING, COMPLETED, FAILED
    total_records = Column(Integer, default=0, nullable=False)
    processed_records = Column(Integer, default=0, nullable=False)
    error_count = Column(Integer, default=0, nullable=False)
    imported_by = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    race = relationship("Race", back_populates="chip_batches")
    chip_data = relationship("ChipData", back_populates="batch", cascade="all, delete-orphan")


class ChipData(BaseModel):
    """芯片原始数据"""

    __tablename__ = "chip_data"

    batch_id = Column(Integer, ForeignKey("chip_batches.id"), nullable=False, index=True)
    chip_id = Column(String(50), nullable=False, index=True)
    bib_number = Column(String(20), nullable=True, index=True)
    athlete_id = Column(String(50), nullable=True, index=True)
    timing_point = Column(String(50), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    raw_data = Column(Text, nullable=True)
    is_valid = Column(Boolean, default=True, nullable=False)
    validation_error = Column(Text, nullable=True)

    batch = relationship("ChipBatch", back_populates="chip_data")
