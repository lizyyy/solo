from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class BatteryPack(Base):
    __tablename__ = "battery_packs"
    
    id = Column(Integer, primary_key=True, index=True)
    battery_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100))
    purchase_date = Column(DateTime)
    initial_cycles = Column(Integer, default=0)
    cell_count = Column(Integer, default=6)
    capacity_mah = Column(Integer)
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    charge_records = relationship("ChargeRecord", back_populates="battery", cascade="all, delete-orphan")
    flight_records = relationship("FlightRecord", back_populates="battery", cascade="all, delete-orphan")
    cell_voltage_readings = relationship("CellVoltageReading", back_populates="battery", cascade="all, delete-orphan")
    maintenance_notes = relationship("MaintenanceNote", back_populates="battery", cascade="all, delete-orphan")


class ChargeRecord(Base):
    __tablename__ = "charge_records"
    
    id = Column(Integer, primary_key=True, index=True)
    battery_id = Column(String(50), ForeignKey("battery_packs.battery_id"), nullable=False, index=True)
    charge_start_time = Column(DateTime, index=True)
    charge_end_time = Column(DateTime, index=True)
    start_voltage = Column(Float)
    end_voltage = Column(Float)
    charge_current = Column(Float)
    capacity_charged_mah = Column(Float)
    cycle_count = Column(Integer)
    charger_id = Column(String(50))
    import_source = Column(String(100))
    import_hash = Column(String(64), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    battery = relationship("BatteryPack", back_populates="charge_records")


class FlightRecord(Base):
    __tablename__ = "flight_records"
    
    id = Column(Integer, primary_key=True, index=True)
    battery_id = Column(String(50), ForeignKey("battery_packs.battery_id"), nullable=False, index=True)
    flight_date = Column(DateTime, index=True)
    flight_duration_min = Column(Float)
    start_voltage = Column(Float)
    end_voltage = Column(Float)
    min_voltage = Column(Float)
    avg_current = Column(Float)
    max_current = Column(Float)
    temperature_c = Column(Float)
    cycle_count = Column(Integer)
    has_low_voltage_alert = Column(Boolean, default=False)
    low_voltage_alert_time = Column(DateTime)
    low_voltage_alert_value = Column(Float)
    drone_id = Column(String(50))
    mission_name = Column(String(200))
    import_source = Column(String(100))
    import_hash = Column(String(64), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    battery = relationship("BatteryPack", back_populates="flight_records")


class CellVoltageReading(Base):
    __tablename__ = "cell_voltage_readings"
    
    id = Column(Integer, primary_key=True, index=True)
    battery_id = Column(String(50), ForeignKey("battery_packs.battery_id"), nullable=False, index=True)
    reading_time = Column(DateTime, index=True)
    cell_1_voltage = Column(Float)
    cell_2_voltage = Column(Float)
    cell_3_voltage = Column(Float)
    cell_4_voltage = Column(Float)
    cell_5_voltage = Column(Float)
    cell_6_voltage = Column(Float)
    cell_7_voltage = Column(Float)
    cell_8_voltage = Column(Float)
    cell_9_voltage = Column(Float)
    cell_10_voltage = Column(Float)
    cell_11_voltage = Column(Float)
    cell_12_voltage = Column(Float)
    total_voltage = Column(Float)
    max_cell_voltage = Column(Float)
    min_cell_voltage = Column(Float)
    voltage_diff = Column(Float)
    reading_source = Column(String(50))
    import_hash = Column(String(64), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    battery = relationship("BatteryPack", back_populates="cell_voltage_readings")


class MaintenanceNote(Base):
    __tablename__ = "maintenance_notes"
    
    id = Column(Integer, primary_key=True, index=True)
    battery_id = Column(String(50), ForeignKey("battery_packs.battery_id"), nullable=False, index=True)
    note_date = Column(DateTime, index=True)
    note_type = Column(String(20))
    title = Column(String(200))
    content = Column(Text)
    author = Column(String(50))
    is_sealed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    battery = relationship("BatteryPack", back_populates="maintenance_notes")


class QuarantineRecord(Base):
    __tablename__ = "quarantine_records"
    
    id = Column(Integer, primary_key=True, index=True)
    import_session_id = Column(String(64), index=True)
    source_type = Column(String(20))
    source_file = Column(String(200))
    row_number = Column(Integer)
    raw_data = Column(Text)
    error_type = Column(String(50))
    error_message = Column(Text)
    battery_id_extracted = Column(String(50))
    timestamp_extracted = Column(DateTime)
    is_resolved = Column(Boolean, default=False)
    resolution_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime)


class SystemConfig(Base):
    __tablename__ = "system_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String(100), unique=True, index=True, nullable=False)
    config_value = Column(Text)
    config_type = Column(String(20), default="string")
    description = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
