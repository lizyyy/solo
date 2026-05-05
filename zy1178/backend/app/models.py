from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), index=True)
    description = Column(Text, nullable=True)
    location = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    roofs = relationship("Roof", back_populates="project", cascade="all, delete-orphan")
    obstacles = relationship("Obstacle", back_populates="project", cascade="all, delete-orphan")
    panels = relationship("Panel", back_populates="project", cascade="all, delete-orphan")
    hourly_data = relationship("HourlyData", back_populates="project", cascade="all, delete-orphan")
    layouts = relationship("Layout", back_populates="project", cascade="all, delete-orphan")
    calculation_results = relationship("CalculationResult", back_populates="project", cascade="all, delete-orphan")

class Roof(Base):
    __tablename__ = "roofs"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String(100), default="主屋顶")
    coordinates = Column(Text, nullable=False)
    area = Column(Float, nullable=False)
    inclination = Column(Float, default=0)
    azimuth = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="roofs")

class Obstacle(Base):
    __tablename__ = "obstacles"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String(100), default="障碍物")
    coordinates = Column(Text, nullable=False)
    height = Column(Float, nullable=False)
    type = Column(String(50), default="unknown")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="obstacles")

class Panel(Base):
    __tablename__ = "panels"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    model = Column(String(100), default="标准组件")
    power = Column(Float, nullable=False)
    efficiency = Column(Float, nullable=False)
    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)
    temperature_coefficient = Column(Float, default=-0.38)
    lifetime = Column(Integer, default=25)
    degradation_rate = Column(Float, default=0.5)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="panels")

class HourlyData(Base):
    __tablename__ = "hourly_data"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    timestamp = Column(DateTime, nullable=False)
    global_irradiance = Column(Float, nullable=False)
    direct_irradiance = Column(Float, nullable=True)
    diffuse_irradiance = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    wind_speed = Column(Float, nullable=True)
    electricity_price = Column(Float, nullable=False)
    feed_in_tariff = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="hourly_data")

class Layout(Base):
    __tablename__ = "layouts"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String(100), default="方案1")
    panel_positions = Column(Text, nullable=False)
    panel_count = Column(Integer, nullable=False)
    total_power = Column(Float, nullable=False)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="layouts")
    calculation_results = relationship("CalculationResult", back_populates="layout")

class CalculationResult(Base):
    __tablename__ = "calculation_results"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    layout_id = Column(Integer, ForeignKey("layouts.id"))
    shading_map = Column(Text, nullable=True)
    shading_hours = Column(Float, default=0)
    shading_loss_ratio = Column(Float, default=0)
    installable_capacity = Column(Float, nullable=False)
    actual_capacity = Column(Float, nullable=False)
    annual_generation = Column(Float, nullable=False)
    monthly_generation = Column(Text, nullable=True)
    annual_revenue = Column(Float, nullable=False)
    monthly_revenue = Column(Text, nullable=True)
    initial_investment = Column(Float, nullable=True)
    payback_period = Column(Float, nullable=True)
    net_present_value = Column(Float, nullable=True)
    internal_rate_of_return = Column(Float, nullable=True)
    risk_factors = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="calculation_results")
    layout = relationship("Layout", back_populates="calculation_results")
