from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Boolean, Text, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import enum

Base = declarative_base()

class ImportSourceType(enum.Enum):
    SCHEDULE_CSV = "schedule_csv"
    GPS_JSON = "gps_json"
    APPEAL_FORM = "appeal_form"

class RecordStatus(enum.Enum):
    PENDING = "pending"
    VALID = "valid"
    INVALID = "invalid"
    PROCESSED = "processed"

class AnomalyType(enum.Enum):
    NONE = "none"
    LATE_ARRIVAL = "late_arrival"
    EARLY_DEPARTURE = "early_departure"
    MISSING_STOP = "missing_stop"
    SPEEDING = "speeding"
    ROUTE_DEVIATION = "route_deviation"
    DRIVER_ABSENT = "driver_absent"
    PARENT_APPEAL = "parent_appeal"
    GPS_MISMATCH = "gps_mismatch"

class Responsibility(enum.Enum):
    UNASSIGNED = "unassigned"
    DRIVER = "driver"
    TRAFFIC = "traffic"
    SCHOOL = "school"
    PARENT = "parent"
    WEATHER = "weather"
    OTHER = "other"

class ImportFile(Base):
    __tablename__ = 'import_files'
    
    id = Column(Integer, primary_key=True)
    filename = Column(String(255), nullable=False)
    source_type = Column(String(50), nullable=False)
    import_time = Column(DateTime, default=datetime.now)
    total_records = Column(Integer, default=0)
    valid_records = Column(Integer, default=0)
    invalid_records = Column(Integer, default=0)
    status = Column(String(50), default='completed')
    
    raw_records = relationship("RawRecord", back_populates="import_file", cascade="all, delete-orphan")
    bad_records = relationship("BadRecord", back_populates="import_file", cascade="all, delete-orphan")

class RawRecord(Base):
    __tablename__ = 'raw_records'
    
    id = Column(Integer, primary_key=True)
    import_file_id = Column(Integer, ForeignKey('import_files.id'))
    record_type = Column(String(50), nullable=False)
    raw_data = Column(Text, nullable=False)
    line_number = Column(Integer)
    status = Column(String(50), default='pending')
    created_at = Column(DateTime, default=datetime.now)
    
    import_file = relationship("ImportFile", back_populates="raw_records")

class BadRecord(Base):
    __tablename__ = 'bad_records'
    
    id = Column(Integer, primary_key=True)
    import_file_id = Column(Integer, ForeignKey('import_files.id'))
    record_type = Column(String(50), nullable=False)
    raw_data = Column(Text, nullable=False)
    line_number = Column(Integer)
    failure_reason = Column(Text, nullable=False)
    correction_suggestion = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    resolved = Column(Boolean, default=False)
    
    import_file = relationship("ImportFile", back_populates="bad_records")

class Bus(Base):
    __tablename__ = 'buses'
    
    id = Column(Integer, primary_key=True)
    bus_number = Column(String(50), unique=True, nullable=False)
    plate_number = Column(String(50))
    capacity = Column(Integer)
    route_id = Column(Integer, ForeignKey('routes.id'))
    status = Column(String(50), default='active')
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    route = relationship("Route", back_populates="buses")
    drivers = relationship("Driver", back_populates="bus")

class Driver(Base):
    __tablename__ = 'drivers'
    
    id = Column(Integer, primary_key=True)
    employee_id = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    phone = Column(String(20))
    bus_id = Column(Integer, ForeignKey('buses.id'))
    status = Column(String(50), default='active')
    created_at = Column(DateTime, default=datetime.now)
    
    bus = relationship("Bus", back_populates="drivers")
    check_ins = relationship("DriverCheckIn", back_populates="driver")

class Route(Base):
    __tablename__ = 'routes'
    
    id = Column(Integer, primary_key=True)
    route_code = Column(String(50), unique=True, nullable=False)
    route_name = Column(String(255), nullable=False)
    description = Column(Text)
    direction = Column(String(20))
    created_at = Column(DateTime, default=datetime.now)
    
    buses = relationship("Bus", back_populates="route")
    stops = relationship("RouteStop", back_populates="route", order_by="RouteStop.stop_order")
    schedules = relationship("RouteSchedule", back_populates="route")

class RouteStop(Base):
    __tablename__ = 'route_stops'
    
    id = Column(Integer, primary_key=True)
    route_id = Column(Integer, ForeignKey('routes.id'))
    stop_name = Column(String(255), nullable=False)
    stop_order = Column(Integer, nullable=False)
    latitude = Column(Float)
    longitude = Column(Float)
    address = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    
    route = relationship("Route", back_populates="stops")

class RouteSchedule(Base):
    __tablename__ = 'route_schedules'
    
    id = Column(Integer, primary_key=True)
    route_id = Column(Integer, ForeignKey('routes.id'))
    stop_id = Column(Integer, ForeignKey('route_stops.id'))
    scheduled_arrival = Column(String(10), nullable=False)
    scheduled_departure = Column(String(10), nullable=False)
    day_of_week = Column(String(20), default='weekday')
    effective_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.now)
    
    route = relationship("Route", back_populates="schedules")
    stop = relationship("RouteStop")

class GPSRecord(Base):
    __tablename__ = 'gps_records'
    
    id = Column(Integer, primary_key=True)
    bus_id = Column(Integer, ForeignKey('buses.id'))
    route_id = Column(Integer, ForeignKey('routes.id'))
    timestamp = Column(DateTime, nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed = Column(Float)
    heading = Column(Float)
    ignition_status = Column(Boolean)
    created_at = Column(DateTime, default=datetime.now)
    
    bus = relationship("Bus")
    route = relationship("Route")

class DriverCheckIn(Base):
    __tablename__ = 'driver_check_ins'
    
    id = Column(Integer, primary_key=True)
    driver_id = Column(Integer, ForeignKey('drivers.id'))
    bus_id = Column(Integer, ForeignKey('buses.id'))
    route_id = Column(Integer, ForeignKey('routes.id'))
    check_in_time = Column(DateTime, nullable=False)
    check_in_type = Column(String(50))
    location = Column(String(255))
    created_at = Column(DateTime, default=datetime.now)
    
    driver = relationship("Driver", back_populates="check_ins")
    bus = relationship("Bus")
    route = relationship("Route")

class StudentAppeal(Base):
    __tablename__ = 'student_appeals'
    
    id = Column(Integer, primary_key=True)
    appeal_number = Column(String(50), unique=True, nullable=False)
    student_name = Column(String(100), nullable=False)
    parent_name = Column(String(100))
    parent_phone = Column(String(20))
    route_id = Column(Integer, ForeignKey('routes.id'))
    stop_id = Column(Integer, ForeignKey('route_stops.id'))
    bus_id = Column(Integer, ForeignKey('buses.id'))
    incident_date = Column(DateTime, nullable=False)
    incident_type = Column(String(100))
    description = Column(Text)
    expected_time = Column(String(10))
    actual_time = Column(String(10))
    submitted_at = Column(DateTime, default=datetime.now)
    status = Column(String(50), default='pending')
    created_at = Column(DateTime, default=datetime.now)
    
    route = relationship("Route")
    stop = relationship("RouteStop")
    bus = relationship("Bus")

class Incident(Base):
    __tablename__ = 'incidents'
    
    id = Column(Integer, primary_key=True)
    incident_number = Column(String(50), unique=True, nullable=False)
    bus_id = Column(Integer, ForeignKey('buses.id'))
    route_id = Column(Integer, ForeignKey('routes.id'))
    stop_id = Column(Integer, ForeignKey('route_stops.id'))
    driver_id = Column(Integer, ForeignKey('drivers.id'))
    incident_date = Column(DateTime, nullable=False)
    anomaly_type = Column(String(50), nullable=False)
    scheduled_time = Column(String(10))
    actual_time = Column(String(10))
    time_difference_minutes = Column(Integer)
    description = Column(Text)
    responsibility = Column(String(50), default='unassigned')
    status = Column(String(50), default='pending')
    reviewed_by = Column(String(100))
    reviewed_at = Column(DateTime)
    review_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    bus = relationship("Bus")
    route = relationship("Route")
    stop = relationship("RouteStop")
    driver = relationship("Driver")
    evidence = relationship("IncidentEvidence", back_populates="incident", cascade="all, delete-orphan")

class IncidentEvidence(Base):
    __tablename__ = 'incident_evidence'
    
    id = Column(Integer, primary_key=True)
    incident_id = Column(Integer, ForeignKey('incidents.id'))
    evidence_type = Column(String(50), nullable=False)
    source = Column(String(255))
    description = Column(Text)
    reference_id = Column(String(255))
    created_at = Column(DateTime, default=datetime.now)
    
    incident = relationship("Incident", back_populates="evidence")

def init_db(db_path='bus_scheduling.db'):
    db_url = f'sqlite:///{db_path}'
    engine = create_engine(db_url, echo=False)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    return Session()
