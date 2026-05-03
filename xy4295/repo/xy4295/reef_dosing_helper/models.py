"""
数据模型和配置模块
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
import warnings


@dataclass
class TankParams:
    """缸体基本参数"""
    tank_id: str = "default"
    tank_name: str = "未命名缸体"
    total_volume: float = 0.0  # 总水量，单位：升
    display_volume: float = 0.0  # 主缸水量，单位：升
    sump_volume: float = 0.0  # 底缸水量，单位：升
    
    target_kh_min: float = 7.0  # 目标KH最小值 (dKH)
    target_kh_max: float = 9.0  # 目标KH最大值 (dKH)
    target_ca_min: float = 400.0  # 目标钙最小值 (ppm)
    target_ca_max: float = 450.0  # 目标钙最大值 (ppm)
    target_mg_min: float = 1250.0  # 目标镁最小值 (ppm)
    target_mg_max: float = 1350.0  # 目标镁最大值 (ppm)
    target_salinity_min: float = 1.024  # 目标盐度最小值 (sg)
    target_salinity_max: float = 1.026  # 目标盐度最大值 (sg)
    
    daily_evaporation_rate: float = 0.0  # 每日蒸发量，单位：升/天
    
    def validate(self) -> List[str]:
        """验证缸体参数，返回警告列表"""
        warnings = []
        
        if self.total_volume <= 0:
            warnings.append("缸体总水量必须大于0")
        
        if self.target_kh_min >= self.target_kh_max:
            warnings.append("KH目标最小值应小于最大值")
        
        if self.target_ca_min >= self.target_ca_max:
            warnings.append("钙目标最小值应小于最大值")
        
        if self.target_mg_min >= self.target_mg_max:
            warnings.append("镁目标最小值应小于最大值")
        
        if self.target_salinity_min >= self.target_salinity_max:
            warnings.append("盐度目标最小值应小于最大值")
        
        if self.target_kh_min < 5 or self.target_kh_max > 12:
            warnings.append(f"KH目标范围 {self.target_kh_min}-{self.target_kh_max} dKH 超出常规范围 (5-12 dKH)")
        
        if self.target_ca_min < 350 or self.target_ca_max > 500:
            warnings.append(f"钙目标范围 {self.target_ca_min}-{self.target_ca_max} ppm 超出常规范围 (350-500 ppm)")
        
        if self.target_mg_min < 1100 or self.target_mg_max > 1500:
            warnings.append(f"镁目标范围 {self.target_mg_min}-{self.target_mg_max} ppm 超出常规范围 (1100-1500 ppm)")
        
        if self.target_salinity_min < 1.020 or self.target_salinity_max > 1.030:
            warnings.append(f"盐度目标范围 {self.target_salinity_min}-{self.target_salinity_max} sg 超出常规范围 (1.020-1.030 sg)")
        
        return warnings
    
    def get_target_midpoint(self, param: str) -> float:
        """获取目标范围中点"""
        midpoints = {
            'kh': (self.target_kh_min + self.target_kh_max) / 2,
            'ca': (self.target_ca_min + self.target_ca_max) / 2,
            'mg': (self.target_mg_min + self.target_mg_max) / 2,
            'salinity': (self.target_salinity_min + self.target_salinity_max) / 2,
        }
        return midpoints.get(param.lower(), 0.0)


@dataclass
class DailyReading:
    """每日检测数据"""
    date: datetime
    kh: Optional[float] = None  # dKH
    ca: Optional[float] = None  # ppm
    mg: Optional[float] = None  # ppm
    salinity: Optional[float] = None  # sg
    evaporation: Optional[float] = None  # 升/天
    notes: str = ""
    
    def get_missing_params(self) -> List[str]:
        """获取缺失的参数列表"""
        missing = []
        if self.kh is None:
            missing.append('KH')
        if self.ca is None:
            missing.append('钙')
        if self.mg is None:
            missing.append('镁')
        if self.salinity is None:
            missing.append('盐度')
        if self.evaporation is None:
            missing.append('蒸发量')
        return missing


@dataclass
class SupplementConfig:
    """补剂配置"""
    name: str
    param: str  # 'kh', 'ca', 'mg', 'salinity'
    concentration: float  # 浓度，单位取决于补剂类型
    concentration_unit: str  # 'meq/L', 'ppm/mL', 'g/L' 等
    max_daily_dosage: float  # 最大每日投加量，单位：毫升/100升
    safety_threshold: float  # 单次投加安全阈值，单位：浓度变化
    
    def validate(self) -> List[str]:
        """验证补剂配置"""
        warnings = []
        if self.concentration <= 0:
            warnings.append(f"补剂 {self.name} 浓度必须大于0")
        if self.max_daily_dosage <= 0:
            warnings.append(f"补剂 {self.name} 最大每日投加量必须大于0")
        if self.safety_threshold <= 0:
            warnings.append(f"补剂 {self.name} 安全阈值必须大于0")
        return warnings


@dataclass
class DosingPlan:
    """投加计划"""
    date: datetime
    tank_params: TankParams
    
    kh_dosage: Optional[float] = None  # 毫升
    kh_concentration_change: Optional[float] = None  # dKH
    kh_warnings: List[str] = field(default_factory=list)
    
    ca_dosage: Optional[float] = None  # 毫升
    ca_concentration_change: Optional[float] = None  # ppm
    ca_warnings: List[str] = field(default_factory=list)
    
    mg_dosage: Optional[float] = None  # 毫升
    mg_concentration_change: Optional[float] = None  # ppm
    mg_warnings: List[str] = field(default_factory=list)
    
    top_up_water: Optional[float] = None  # 升
    salinity_adjustment: Optional[float] = None  # 盐度变化
    salinity_warnings: List[str] = field(default_factory=list)
    
    all_warnings: List[str] = field(default_factory=list)
    
    def get_all_warnings(self) -> List[str]:
        """获取所有警告"""
        warnings = []
        warnings.extend(self.kh_warnings)
        warnings.extend(self.ca_warnings)
        warnings.extend(self.mg_warnings)
        warnings.extend(self.salinity_warnings)
        warnings.extend(self.all_warnings)
        return warnings


@dataclass
class DosingResult:
    """完整投加结果"""
    tank_params: TankParams
    historical_readings: List[DailyReading]
    future_plans: List[DosingPlan]
    supplement_configs: Dict[str, SupplementConfig]
    overall_warnings: List[str] = field(default_factory=list)
    
    def has_warnings(self) -> bool:
        """检查是否有警告"""
        if self.overall_warnings:
            return True
        for plan in self.future_plans:
            if plan.get_all_warnings():
                return True
        return False


# 默认补剂配置
DEFAULT_SUPPLEMENTS = {
    'kh': SupplementConfig(
        name='KH提升液',
        param='kh',
        concentration=1.0,  # 1 meq/mL
        concentration_unit='meq/mL',
        max_daily_dosage=5.0,  # 5 mL/100L/天
        safety_threshold=1.0,  # 单次变化不超过1 dKH
    ),
    'ca': SupplementConfig(
        name='钙提升液',
        param='ca',
        concentration=100000.0,  # 100,000 ppm/mL
        concentration_unit='ppm/mL',
        max_daily_dosage=5.0,  # 5 mL/100L/天
        safety_threshold=20.0,  # 单次变化不超过20 ppm
    ),
    'mg': SupplementConfig(
        name='镁提升液',
        param='mg',
        concentration=50000.0,  # 50,000 ppm/mL
        concentration_unit='ppm/mL',
        max_daily_dosage=5.0,  # 5 mL/100L/天
        safety_threshold=30.0,  # 单次变化不超过30 ppm
    ),
    'salt': SupplementConfig(
        name='海盐',
        param='salinity',
        concentration=35.0,  # 35 ppt/1kg
        concentration_unit='ppt/kg',
        max_daily_dosage=100.0,  # 100g/100L/天
        safety_threshold=0.001,  # 单次变化不超过0.001 sg
    ),
}

# 单位转换因子
UNIT_CONVERSIONS = {
    'kh': {
        'meq/L_to_dKH': 0.5,  # 1 meq/L = 0.5 dKH
        'dKH_to_meq/L': 2.0,  # 1 dKH = 2 meq/L
    },
    'salinity': {
        'sg_to_ppt': lambda sg: (sg - 1) * 1000,
        'ppt_to_sg': lambda ppt: 1 + ppt / 1000,
    },
}
