from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class BaselineVersion(Base):
    __tablename__ = "baseline_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String(50), nullable=False, comment="版本号")
    name = Column(String(255), nullable=False, comment="版本名称")
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=True, comment="关联设备")
    group_id = Column(Integer, ForeignKey("equipment_groups.id"), nullable=True, comment="关联分组")
    baseline_type = Column(String(50), nullable=False, comment="基线类型: equipment, group")
    start_date = Column(DateTime, nullable=False, comment="基线开始日期")
    end_date = Column(DateTime, nullable=False, comment="基线结束日期")
    
    baseline_value = Column(Float, nullable=False, comment="基准能效值 (kWh/产量单位)")
    baseline_std = Column(Float, nullable=True, comment="基线标准差")
    baseline_formula = Column(JSON, nullable=True, comment="基线计算公式参数")
    is_active = Column(Boolean, default=False, comment="是否当前激活版本")
    
    status = Column(String(50), default="draft", comment="状态: draft, active, deprecated")
    replace_reason = Column(Text, nullable=True, comment="更换原因")
    
    data_points_count = Column(Integer, default=0, comment="数据点数量")
    excluded_points_count = Column(Integer, default=0, comment="剔除异常点数量")
    
    description = Column(Text, nullable=True, comment="描述")
    created_by = Column(String(100), nullable=True, comment="创建人")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    equipment = relationship("Equipment", back_populates="baselines")
    group = relationship("EquipmentGroup", back_populates="baselines")
    savings = relationship("EnergySaving", back_populates="baseline")


class EnergyData(Base):
    __tablename__ = "energy_data"
    
    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, comment="设备ID")
    record_date = Column(DateTime, nullable=False, index=True, comment="记录日期时间")
    
    energy_consumption = Column(Float, nullable=False, comment="能耗值 (kWh)")
    energy_type = Column(String(50), default="electricity", comment="能源类型: electricity, gas, steam")
    
    is_outlier = Column(Boolean, default=False, comment="是否异常值")
    outlier_reason = Column(String(255), nullable=True, comment="异常原因")
    
    source = Column(String(100), nullable=True, comment="数据来源")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    equipment = relationship("Equipment", back_populates="energy_data")


class ProductionData(Base):
    __tablename__ = "production_data"
    
    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, comment="设备ID")
    record_date = Column(DateTime, nullable=False, index=True, comment="记录日期时间")
    
    production_quantity = Column(Float, nullable=False, comment="产量")
    production_unit = Column(String(50), nullable=False, comment="产量单位")
    shift = Column(String(50), nullable=True, comment="班次")
    
    is_outlier = Column(Boolean, default=False, comment="是否异常值")
    outlier_reason = Column(String(255), nullable=True, comment="异常原因")
    
    source = Column(String(100), nullable=True, comment="数据来源")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    equipment = relationship("Equipment", back_populates="production_data")


class EnergySaving(Base):
    __tablename__ = "energy_savings"
    
    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("equipment.id"), nullable=False, comment="设备ID")
    baseline_id = Column(Integer, ForeignKey("baseline_versions.id"), nullable=False, comment="基线版本ID")
    
    calculation_date = Column(DateTime, nullable=False, index=True, comment="计算日期")
    period_start = Column(DateTime, nullable=False, comment="统计周期开始")
    period_end = Column(DateTime, nullable=False, comment="统计周期结束")
    
    actual_energy = Column(Float, nullable=False, comment="实际能耗 (kWh)")
    baseline_energy = Column(Float, nullable=False, comment="基准能耗 (kWh)")
    saving_energy = Column(Float, nullable=False, comment="节能量 (kWh)")
    saving_rate = Column(Float, nullable=False, comment="节能率 (%)")
    
    normalized_production = Column(Float, nullable=False, comment="归一化产量")
    data_points_count = Column(Integer, default=0, comment="数据点数量")
    
    status = Column(String(50), default="calculated", comment="状态: calculated, approved, rejected")
    remark = Column(Text, nullable=True, comment="备注")
    
    created_by = Column(String(100), nullable=True, comment="计算人")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    equipment = relationship("Equipment", back_populates="savings")
    baseline = relationship("BaselineVersion", back_populates="savings")
