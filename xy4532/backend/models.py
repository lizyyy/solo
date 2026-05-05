from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class WindTurbine(Base):
    """风机模型"""
    __tablename__ = "wind_turbines"
    
    id = Column(Integer, primary_key=True, index=True)
    turbine_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100))
    location = Column(String(200))
    latitude = Column(Float)
    longitude = Column(Float)
    capacity = Column(Float)  # 装机容量 MW
    installation_date = Column(DateTime)
    status = Column(String(20), default="正常")
    
    blades = relationship("Blade", back_populates="turbine", cascade="all, delete-orphan")
    inspections = relationship("InspectionRecord", back_populates="turbine", cascade="all, delete-orphan")
    alarms = relationship("SCADAAllarm", back_populates="turbine", cascade="all, delete-orphan")
    work_orders = relationship("WorkOrder", back_populates="turbine", cascade="all, delete-orphan")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Blade(Base):
    """叶片模型"""
    __tablename__ = "blades"
    
    id = Column(Integer, primary_key=True, index=True)
    turbine_id = Column(Integer, ForeignKey("wind_turbines.id"), nullable=False)
    blade_number = Column(Integer, nullable=False)  # 1, 2, 3
    length = Column(Float)  # 叶片长度
    manufacturer = Column(String(100))
    installation_date = Column(DateTime)
    
    turbine = relationship("WindTurbine", back_populates="blades")
    photos = relationship("BladePhoto", back_populates="blade", cascade="all, delete-orphan")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class InspectionRecord(Base):
    """巡检记录模型"""
    __tablename__ = "inspection_records"
    
    id = Column(Integer, primary_key=True, index=True)
    turbine_id = Column(Integer, ForeignKey("wind_turbines.id"), nullable=False)
    inspection_date = Column(DateTime, nullable=False)
    inspector = Column(String(100))
    weather_conditions = Column(String(200))
    drone_track_file = Column(String(500))  # 无人机航迹文件路径
    notes = Column(Text)
    
    turbine = relationship("WindTurbine", back_populates="inspections")
    photos = relationship("BladePhoto", back_populates="inspection", cascade="all, delete-orphan")
    assessments = relationship("RiskAssessment", back_populates="inspection", cascade="all, delete-orphan")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class BladePhoto(Base):
    """叶片照片模型"""
    __tablename__ = "blade_photos"
    
    id = Column(Integer, primary_key=True, index=True)
    blade_id = Column(Integer, ForeignKey("blades.id"), nullable=False)
    inspection_id = Column(Integer, ForeignKey("inspection_records.id"), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_name = Column(String(200), nullable=False)
    segment = Column(String(50))  # 分段位置: LE, TE, PS, SS
    distance_from_root = Column(Float)  # 距离叶根距离 (米)
    image_features = Column(Text)  # 存储图像特征的JSON
    
    blade = relationship("Blade", back_populates="photos")
    inspection = relationship("InspectionRecord", back_populates="photos")
    assessments = relationship("RiskAssessment", back_populates="photo", cascade="all, delete-orphan")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SCADAAllarm(Base):
    """SCADA告警模型"""
    __tablename__ = "scada_alarms"
    
    id = Column(Integer, primary_key=True, index=True)
    turbine_id = Column(Integer, ForeignKey("wind_turbines.id"), nullable=False)
    alarm_code = Column(String(50), nullable=False)
    alarm_name = Column(String(200))
    alarm_type = Column(String(50))  # 叶片振动、温度异常等
    severity = Column(String(20))  # 低、中、高、严重
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime)
    is_active = Column(Boolean, default=True)
    description = Column(Text)
    
    turbine = relationship("WindTurbine", back_populates="alarms")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class WorkOrder(Base):
    """维修工单模型"""
    __tablename__ = "work_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    turbine_id = Column(Integer, ForeignKey("wind_turbines.id"), nullable=False)
    blade_number = Column(Integer)
    work_order_id = Column(String(50), unique=True, index=True)
    issue_type = Column(String(100))  # 裂纹、雷击、腐蚀等
    description = Column(Text)
    priority = Column(String(20))  # 紧急、高、中、低
    status = Column(String(20), default="待处理")  # 待处理、处理中、已完成
    created_time = Column(DateTime, default=datetime.utcnow)
    scheduled_time = Column(DateTime)
    completed_time = Column(DateTime)
    assigned_to = Column(String(100))
    resolution = Column(Text)
    
    turbine = relationship("WindTurbine", back_populates="work_orders")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RiskAssessment(Base):
    """风险评估模型"""
    __tablename__ = "risk_assessments"
    
    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("blade_photos.id"), nullable=False)
    inspection_id = Column(Integer, ForeignKey("inspection_records.id"), nullable=False)
    
    # AI 自动评估
    ai_risk_level = Column(String(20))  # 严重、高、中、低
    ai_risk_score = Column(Float, nullable=False)  # 0.0 - 1.0
    ai_detection_type = Column(String(100))  # 裂纹、雷击点、腐蚀、油污等
    ai_confidence = Column(Float)  # 置信度
    ai_description = Column(Text)
    
    # 人工改判
    manual_risk_level = Column(String(20))
    manual_override = Column(Boolean, default=False)
    manual_reason = Column(Text)
    manual_judge = Column(String(100))
    manual_time = Column(DateTime)
    
    # 最终结果
    final_risk_level = Column(String(20))
    final_risk_score = Column(Float)
    
    # 关联信息
    related_alarm_id = Column(Integer, ForeignKey("scada_alarms.id"))
    related_work_order_id = Column(Integer, ForeignKey("work_orders.id"))
    
    photo = relationship("BladePhoto", back_populates="assessments")
    inspection = relationship("InspectionRecord", back_populates="assessments")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
