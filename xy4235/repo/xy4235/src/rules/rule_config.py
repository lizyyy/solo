from dataclasses import dataclass, field
from typing import Dict, Any, Optional
from enum import Enum


class Species(Enum):
    """
    物种类型
    """
    DOG = "犬"
    CAT = "猫"
    OTHER = "其他"


@dataclass
class RuleConfig:
    """
    规则配置类
    包含所有风险检测规则的配置参数
    """
    
    # 体温相关配置
    hypothermia_threshold_mild: float = 37.0  # 轻度低体温阈值 (°C)
    hypothermia_threshold_severe: float = 35.0  # 严重低体温阈值 (°C)
    hypothermia_duration_minutes: int = 5  # 低体温持续时间阈值 (分钟)
    
    # 血氧相关配置
    spo2_normal_min: float = 95.0  # 正常血氧最低值 (%)
    spo2_critical_min: float = 90.0  # 临界血氧最低值 (%)
    spo2_drop_threshold: float = 5.0  # 血氧掉点阈值 (%) - 短时间内下降超过此值视为掉点
    spo2_drop_window_minutes: int = 2  # 血氧掉点检测时间窗口 (分钟)
    
    # 血压相关配置
    map_normal_min: float = 60.0  # 正常平均压最低值 (mmHg)
    map_normal_max: float = 120.0  # 正常平均压最高值 (mmHg)
    map_critical_min: float = 50.0  # 临界平均压最低值 (mmHg)
    map_critical_max: float = 160.0  # 临界平均压最高值 (mmHg)
    
    # 心率相关配置
    hr_normal_min_dog: float = 60.0  # 犬正常心率最低值 (bpm)
    hr_normal_max_dog: float = 140.0  # 犬正常心率最高值 (bpm)
    hr_normal_min_cat: float = 100.0  # 猫正常心率最低值 (bpm)
    hr_normal_max_cat: float = 220.0  # 猫正常心率最高值 (bpm)
    
    # 用药时间相关配置
    medication_interval_minutes: Dict[str, int] = field(default_factory=lambda: {
        "阿曲库铵": 30,  # 肌松药追加间隔
        "维库溴铵": 45,
        "罗库溴铵": 35,
        "芬太尼": 30,  # 镇痛药追加间隔
        "吗啡": 120,
        "布托啡诺": 60,
    })
    default_medication_interval_minutes: int = 60  # 默认用药间隔 (分钟)
    
    # 复苏评分相关配置
    recovery_score_min: int = 6  # 复苏评分最低值 (满分10分，低于此值需要关注)
    recovery_score_critical: int = 3  # 复苏评分临界值
    
    # 物种特定配置
    species_configs: Dict[str, Dict[str, Any]] = field(default_factory=lambda: {
        "DOG": {
            "hr_normal_min": 60.0,
            "hr_normal_max": 140.0,
            "temperature_normal_min": 37.5,
            "temperature_normal_max": 39.0,
        },
        "CAT": {
            "hr_normal_min": 100.0,
            "hr_normal_max": 220.0,
            "temperature_normal_min": 37.8,
            "temperature_normal_max": 39.5,
        }
    })
    
    def get_hr_range(self, species: str = "DOG") -> tuple:
        """
        获取指定物种的心率正常范围
        """
        species = species.upper()
        if species in self.species_configs:
            config = self.species_configs[species]
            return (config.get("hr_normal_min", 60.0), config.get("hr_normal_max", 140.0))
        return (self.hr_normal_min_dog, self.hr_normal_max_dog)
    
    def get_temperature_range(self, species: str = "DOG") -> tuple:
        """
        获取指定物种的体温正常范围
        """
        species = species.upper()
        if species in self.species_configs:
            config = self.species_configs[species]
            return (config.get("temperature_normal_min", 37.5), config.get("temperature_normal_max", 39.0))
        return (37.5, 39.0)
    
    def get_medication_interval(self, medication_name: str) -> int:
        """
        获取指定药物的追加间隔
        """
        name_lower = medication_name.lower()
        
        for key, interval in self.medication_interval_minutes.items():
            if key.lower() in name_lower or name_lower in key.lower():
                return interval
        
        return self.default_medication_interval_minutes


# 默认规则配置
DEFAULT_RULE_CONFIG = RuleConfig()
