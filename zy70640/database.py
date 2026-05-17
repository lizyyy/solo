from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./marathon_supply.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    km_marker = Column(Float)
    type = Column(String)
    max_capacity = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    supply_records = relationship("SupplyRecord", back_populates="station")
    gap_records = relationship("GapRecord", back_populates="station")


class SupplyCategory(Base):
    __tablename__ = "supply_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    unit = Column(String)
    per_person_consumption = Column(Float)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

    supply_records = relationship("SupplyRecord", back_populates="category")
    gap_records = relationship("GapRecord", back_populates="category")


class RaceConfig(Base):
    __tablename__ = "race_configs"

    id = Column(Integer, primary_key=True, index=True)
    race_name = Column(String)
    total_runners = Column(Integer)
    expected_dropout_rate = Column(Float, default=0.05)
    backup_ratio_water = Column(Float, default=0.2)
    backup_ratio_salt = Column(Float, default=0.3)
    backup_ratio_gel = Column(Float, default=0.25)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SupplyRecord(Base):
    __tablename__ = "supply_records"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"))
    category_id = Column(Integer, ForeignKey("supply_categories.id"))
    allocated_quantity = Column(Integer)
    backup_quantity = Column(Integer, default=0)
    total_required = Column(Integer, default=0)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    station = relationship("Station", back_populates="supply_records")
    category = relationship("SupplyCategory", back_populates="supply_records")
    gap_records = relationship("GapRecord", back_populates="supply_record")


class GapRecord(Base):
    __tablename__ = "gap_records"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"))
    category_id = Column(Integer, ForeignKey("supply_categories.id"))
    supply_record_id = Column(Integer, ForeignKey("supply_records.id"))
    gap_quantity = Column(Integer)
    gap_level = Column(String)
    priority = Column(Integer)
    status = Column(String, default="open")
    suggestion = Column(Text)
    handler = Column(String)
    conclusion = Column(Text)
    raw_input = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    station = relationship("Station", back_populates="gap_records")
    category = relationship("SupplyCategory", back_populates="gap_records")
    supply_record = relationship("SupplyRecord", back_populates="gap_records")
    transfer_logs = relationship("TransferLog", back_populates="gap_record")


class TransferLog(Base):
    __tablename__ = "transfer_logs"

    id = Column(Integer, primary_key=True, index=True)
    gap_record_id = Column(Integer, ForeignKey("gap_records.id"))
    from_station_id = Column(Integer, ForeignKey("stations.id"))
    to_station_id = Column(Integer, ForeignKey("stations.id"))
    category_id = Column(Integer, ForeignKey("supply_categories.id"))
    transfer_quantity = Column(Integer)
    operator = Column(String)
    notes = Column(Text)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

    gap_record = relationship("GapRecord", back_populates="transfer_logs")
    from_station = relationship("Station", foreign_keys=[from_station_id])
    to_station = relationship("Station", foreign_keys=[to_station_id])
    category = relationship("SupplyCategory", foreign_keys=[category_id])


class ExceptionLog(Base):
    __tablename__ = "exception_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String)
    raw_input = Column(Text)
    handler = Column(String)
    conclusion = Column(Text)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(SupplyCategory).count() == 0:
            categories = [
                SupplyCategory(name="水", unit="瓶", per_person_consumption=0.5, description="矿泉水"),
                SupplyCategory(name="盐丸", unit="粒", per_person_consumption=0.3, description="电解质补充"),
                SupplyCategory(name="能量胶", unit="支", per_person_consumption=0.4, description="碳水化合物补充"),
            ]
            db.add_all(categories)
            db.commit()
    finally:
        db.close()
