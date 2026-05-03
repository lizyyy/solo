from sqlalchemy import create_engine, Column, Integer, String, Float, Date, Time, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from config import settings

engine = create_engine(
    settings.DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Scene(Base):
    __tablename__ = "scenes"

    id = Column(Integer, primary_key=True, index=True)
    scene_number = Column(String(50), unique=True, index=True)
    description = Column(Text)
    location_id = Column(Integer, ForeignKey("locations.id"))
    is_night = Column(Boolean, default=False)
    is_interior = Column(Boolean, default=False)
    cast = Column(Text)
    estimated_duration_minutes = Column(Integer, default=60)

    location = relationship("Location", back_populates="scenes")
    shooting_plans = relationship("ShootingPlan", back_populates="scene")


class Crew(Base):
    __tablename__ = "crew"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True)
    role = Column(String(100))
    is_actor = Column(Boolean, default=False)
    group_name = Column(String(100), nullable=True)
    availability_start = Column(Date, nullable=True)
    availability_end = Column(Date, nullable=True)

    shooting_plans = relationship("ShootingPlan", back_populates="assigned_crew")


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), index=True)
    address = Column(Text, nullable=True)
    is_exterior = Column(Boolean, default=False)
    is_sound_stage = Column(Boolean, default=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    scenes = relationship("Scene", back_populates="location")
    weather_records = relationship("Weather", back_populates="location")


class Weather(Base):
    __tablename__ = "weather"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("locations.id"))
    date = Column(Date, index=True)
    condition = Column(String(100))
    temperature = Column(Float, nullable=True)
    precipitation_probability = Column(Float, default=0.0)
    is_rainy = Column(Boolean, default=False)

    location = relationship("Location", back_populates="weather_records")


class ShootingPlan(Base):
    __tablename__ = "shooting_plans"

    id = Column(Integer, primary_key=True, index=True)
    scene_id = Column(Integer, ForeignKey("scenes.id"))
    date = Column(Date, index=True)
    start_time = Column(Time)
    end_time = Column(Time)
    crew_id = Column(Integer, ForeignKey("crew.id"), nullable=True)
    notes = Column(Text, nullable=True)

    scene = relationship("Scene", back_populates="shooting_plans")
    assigned_crew = relationship("Crew", back_populates="shooting_plans")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
