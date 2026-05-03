from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship, DeclarativeBase
from datetime import datetime


class Base(DeclarativeBase):
    pass


class VehicleTemperature(Base):
    __tablename__ = "vehicle_temperatures"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vehicle_id = Column(String(50), nullable=False, index=True)
    route_id = Column(String(50), nullable=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    temperature = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_vehicle_time', 'vehicle_id', 'timestamp'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "vehicle_id": self.vehicle_id,
            "route_id": self.route_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "temperature": self.temperature,
        }


class DrugBatch(Base):
    __tablename__ = "drug_batches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_number = Column(String(100), nullable=False, unique=True, index=True)
    drug_name = Column(String(200), nullable=False)
    production_date = Column(DateTime, nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    min_temp = Column(Float, nullable=True)
    max_temp = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "batch_number": self.batch_number,
            "drug_name": self.drug_name,
            "production_date": self.production_date.isoformat() if self.production_date else None,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "min_temp": self.min_temp,
            "max_temp": self.max_temp,
        }


class HandoverScan(Base):
    __tablename__ = "handover_scans"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scan_time = Column(DateTime, nullable=False, index=True)
    batch_number = Column(String(100), nullable=False, index=True)
    vehicle_id = Column(String(50), nullable=False, index=True)
    scan_type = Column(String(20), nullable=False)
    operator = Column(String(100), nullable=True)
    location = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_batch_vehicle_time', 'batch_number', 'vehicle_id', 'scan_time'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "scan_time": self.scan_time.isoformat() if self.scan_time else None,
            "batch_number": self.batch_number,
            "vehicle_id": self.vehicle_id,
            "scan_type": self.scan_type,
            "operator": self.operator,
            "location": self.location,
        }


class TemperatureRule(Base):
    __tablename__ = "temperature_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    rule_name = Column(String(100), nullable=False)
    drug_category = Column(String(100), nullable=True)
    min_temp = Column(Float, nullable=False)
    max_temp = Column(Float, nullable=False)
    allowed_exceed_duration_minutes = Column(Integer, nullable=True, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "rule_name": self.rule_name,
            "drug_category": self.drug_category,
            "min_temp": self.min_temp,
            "max_temp": self.max_temp,
            "allowed_exceed_duration_minutes": self.allowed_exceed_duration_minutes,
        }


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    route_id = Column(String(50), nullable=False, unique=True, index=True)
    vehicle_id = Column(String(50), nullable=False, index=True)
    departure_time = Column(DateTime, nullable=False)
    arrival_time = Column(DateTime, nullable=True)
    start_location = Column(String(200), nullable=True)
    end_location = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "route_id": self.route_id,
            "vehicle_id": self.vehicle_id,
            "departure_time": self.departure_time.isoformat() if self.departure_time else None,
            "arrival_time": self.arrival_time.isoformat() if self.arrival_time else None,
            "start_location": self.start_location,
            "end_location": self.end_location,
        }


class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_type = Column(String(50), nullable=False, index=True)
    severity = Column(String(20), nullable=False)
    description = Column(Text, nullable=False)
    batch_number = Column(String(100), nullable=True, index=True)
    vehicle_id = Column(String(50), nullable=True, index=True)
    route_id = Column(String(50), nullable=True, index=True)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    exceed_minutes = Column(Integer, nullable=True)
    temperature = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index('idx_issue_type_batch', 'issue_type', 'batch_number'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "issue_type": self.issue_type,
            "severity": self.severity,
            "description": self.description,
            "batch_number": self.batch_number,
            "vehicle_id": self.vehicle_id,
            "route_id": self.route_id,
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "exceed_minutes": self.exceed_minutes,
            "temperature": self.temperature,
        }
