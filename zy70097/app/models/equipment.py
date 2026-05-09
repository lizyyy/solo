from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Equipment(Base):
    __tablename__ = "equipment"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, comment="设备名称")
    code = Column(String(100), unique=True, nullable=False, comment="设备编号")
    type = Column(String(100), nullable=False, comment="设备类型")
    group_id = Column(Integer, ForeignKey("equipment_groups.id"), nullable=True, comment="所属分组")
    install_date = Column(DateTime, nullable=True, comment="安装日期")
    replace_date = Column(DateTime, nullable=True, comment="更换日期")
    status = Column(String(50), default="active", comment="状态: active, inactive, replaced")
    description = Column(Text, nullable=True, comment="描述")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    group = relationship("EquipmentGroup", back_populates="equipments")
    energy_data = relationship("EnergyData", back_populates="equipment")
    production_data = relationship("ProductionData", back_populates="equipment")
    baselines = relationship("BaselineVersion", back_populates="equipment")
    savings = relationship("EnergySaving", back_populates="equipment")


class EquipmentGroup(Base):
    __tablename__ = "equipment_groups"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, comment="分组名称")
    code = Column(String(100), unique=True, nullable=False, comment="分组编号")
    description = Column(Text, nullable=True, comment="描述")
    parent_id = Column(Integer, ForeignKey("equipment_groups.id"), nullable=True, comment="父分组")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    equipments = relationship("Equipment", back_populates="group")
    children = relationship("EquipmentGroup", backref="parent", remote_side=[id])
    baselines = relationship("BaselineVersion", back_populates="group")
