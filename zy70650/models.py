from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import enum

Base = declarative_base()

class FuelTypeEnum(str, enum.Enum):
    GASOLINE = "汽油"
    DIESEL = "柴油"
    ELECTRIC = "电动"

class AbnormalLevelEnum(str, enum.Enum):
    MILD = "轻微"
    MODERATE = "中等"
    SEVERE = "严重"

class AbnormalStatusEnum(str, enum.Enum):
    PENDING = "待处理"
    REVIEWING = "复核中"
    RESOLVED = "已处理"
    DISMISSED = "已忽略"

class AbnormalTypeEnum(str, enum.Enum):
    FUEL_THEFT = "疑似偷油"
    MILEAGE_ERROR = "里程录错"
    HIGH_CONSUMPTION = "油耗过高"
    MISMATCH = "数据不匹配"

class Driver(Base):
    __tablename__ = "drivers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    id_card = Column(String(50), unique=True)
    created_at = Column(DateTime)
    
    vehicles = relationship("Vehicle", back_populates="driver")

class Vehicle(Base):
    __tablename__ = "vehicles"
    
    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String(20), unique=True, nullable=False)
    vehicle_type = Column(String(50))
    fuel_type = Column(String(20))
    tank_capacity = Column(Float)
    standard_fuel_consumption = Column(Float)
    driver_id = Column(Integer, ForeignKey("drivers.id"))
    created_at = Column(DateTime)
    
    driver = relationship("Driver", back_populates="vehicles")
    fuel_records = relationship("FuelRecord", back_populates="vehicle")
    mileage_records = relationship("MileageRecord", back_populates="vehicle")
    routes = relationship("Route", back_populates="vehicle")
    abnormal_reports = relationship("AbnormalReport", back_populates="vehicle")

class FuelRecord(Base):
    __tablename__ = "fuel_records"
    
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    card_number = Column(String(50), nullable=False)
    fuel_date = Column(DateTime, nullable=False)
    fuel_amount = Column(Float, nullable=False)
    fuel_price = Column(Float)
    total_cost = Column(Float)
    odometer = Column(Float)
    station = Column(String(200))
    created_at = Column(DateTime)
    
    vehicle = relationship("Vehicle", back_populates="fuel_records")

class MileageRecord(Base):
    __tablename__ = "mileage_records"
    
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    gps_device_id = Column(String(50))
    record_date = Column(DateTime, nullable=False)
    start_mileage = Column(Float, nullable=False)
    end_mileage = Column(Float, nullable=False)
    distance = Column(Float, nullable=False)
    start_location = Column(String(200))
    end_location = Column(String(200))
    created_at = Column(DateTime)
    
    vehicle = relationship("Vehicle", back_populates="mileage_records")

class Route(Base):
    __tablename__ = "routes"
    
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    route_name = Column(String(200), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    start_location = Column(String(200))
    end_location = Column(String(200))
    total_distance = Column(Float)
    total_fuel = Column(Float)
    created_at = Column(DateTime)
    
    vehicle = relationship("Vehicle", back_populates="routes")

class AbnormalReport(Base):
    __tablename__ = "abnormal_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=False)
    route_id = Column(Integer, ForeignKey("routes.id"))
    abnormal_type = Column(String(50), nullable=False)
    abnormal_level = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    actual_fuel_consumption = Column(Float)
    expected_fuel_consumption = Column(Float)
    deviation_rate = Column(Float)
    description = Column(Text)
    handler = Column(String(100))
    handle_comment = Column(Text)
    handled_at = Column(DateTime)
    created_at = Column(DateTime)
    
    vehicle = relationship("Vehicle", back_populates="abnormal_reports")
