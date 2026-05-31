from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Boolean, Text, UniqueConstraint

from database import Base


class MealRecord(Base):
    __tablename__ = "meal_records"

    id = Column(Integer, primary_key=True, index=True)
    record_date = Column(Date, nullable=False, index=True)
    meal_type = Column(String(20), nullable=False)
    dish_name = Column(String(100), nullable=False)
    predicted_count = Column(Integer, default=0)
    actual_count = Column(Integer, default=0)
    unit = Column(String(20), default="份")
    price = Column(Float, default=0.0)
    category = Column(String(50))
    notes = Column(Text)
    batch_id = Column(String(50), index=True)
    is_reviewed = Column(Boolean, default=False)
    reviewed_by = Column(String(50))
    reviewed_at = Column(DateTime)
    is_corrected = Column(Boolean, default=False)
    corrected_by = Column(String(50))
    corrected_at = Column(DateTime)
    correction_reason = Column(String(200))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('record_date', 'meal_type', 'dish_name', name='_date_meal_dish_uc'),
    )


class PredictionBatch(Base):
    __tablename__ = "prediction_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), unique=True, nullable=False, index=True)
    batch_name = Column(String(100))
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    model_version = Column(String(50))
    model_description = Column(Text)
    status = Column(String(20), default="pending")
    total_records = Column(Integer, default=0)
    created_by = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    error_message = Column(Text)


class ImportHistory(Base):
    __tablename__ = "import_history"

    id = Column(Integer, primary_key=True, index=True)
    import_id = Column(String(50), unique=True, nullable=False, index=True)
    file_name = Column(String(200), nullable=False)
    file_type = Column(String(20))
    total_rows = Column(Integer, default=0)
    success_rows = Column(Integer, default=0)
    failed_rows = Column(Integer, default=0)
    status = Column(String(20), default="processing")
    error_details = Column(Text)
    imported_by = Column(String(50))
    imported_at = Column(DateTime, default=datetime.utcnow)


class CorrectionLog(Base):
    __tablename__ = "correction_logs"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, index=True)
    field_name = Column(String(50))
    old_value = Column(Text)
    new_value = Column(Text)
    reason = Column(String(200))
    corrected_by = Column(String(50))
    corrected_at = Column(DateTime, default=datetime.utcnow)


class SystemConfig(Base):
    __tablename__ = "system_configs"

    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String(100), unique=True, nullable=False)
    config_value = Column(Text)
    description = Column(String(200))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
