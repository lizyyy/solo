"""试剂黏度解析器"""

import math
import yaml
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from pathlib import Path

from ..core.units import UnitConverter, convert


@dataclass
class ReagentViscosity:
    """试剂黏度数据"""
    reagent_id: str
    name: str
    
    # 黏度值
    viscosity_value: float
    viscosity_unit: str
    
    # 温度条件
    temperature: Optional[float] = None
    temperature_unit: str = "C"
    
    # 其他属性
    description: str = ""
    density: Optional[float] = None
    density_unit: str = "kg/m3"
    
    # 目标混合比例 (可选)
    target_ratio: Optional[float] = None


@dataclass
class ViscosityData:
    """解析后的黏度数据"""
    name: str
    description: str
    
    reagents: Dict[str, ReagentViscosity] = field(default_factory=dict)
    
    # 默认混合比例
    default_ratios: Dict[str, float] = field(default_factory=dict)  # reagent_id -> ratio
    
    # 实验温度
    experiment_temperature: float = 25.0
    experiment_temperature_unit: str = "C"


class ViscosityParser:
    """试剂黏度YAML解析器"""
    
    @classmethod
    def parse_file(cls, file_path: str) -> ViscosityData:
        """从YAML文件解析黏度数据"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"黏度文件不存在: {file_path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f) or {}
        
        return cls.parse(data)
    
    @classmethod
    def parse(cls, data: Dict[str, Any]) -> ViscosityData:
        """从字典解析黏度数据"""
        
        name = data.get("name", "试剂黏度配置")
        description = data.get("description", "")
        
        # 解析实验温度
        exp_temp = 25.0
        exp_temp_unit = "C"
        
        if "experiment_temperature" in data:
            temp_data = data["experiment_temperature"]
            if isinstance(temp_data, dict):
                exp_temp = float(temp_data.get("value", 25.0))
                exp_temp_unit = temp_data.get("unit", "C")
            else:
                exp_temp = float(temp_data)
        
        # 解析试剂列表
        reagents: Dict[str, ReagentViscosity] = {}
        reagent_list = data.get("reagents", [])
        
        for reagent_data in reagent_list:
            reagent = cls._parse_reagent(reagent_data)
            reagents[reagent.reagent_id] = reagent
        
        # 解析默认混合比例
        default_ratios: Dict[str, float] = {}
        ratios_data = data.get("target_ratios", {})
        
        for reagent_id, ratio in ratios_data.items():
            default_ratios[reagent_id] = float(ratio)
        
        # 如果试剂中定义了目标比例，合并进去
        for reagent_id, reagent in reagents.items():
            if reagent.target_ratio is not None and reagent_id not in default_ratios:
                default_ratios[reagent_id] = reagent.target_ratio
        
        return ViscosityData(
            name=name,
            description=description,
            reagents=reagents,
            default_ratios=default_ratios,
            experiment_temperature=exp_temp,
            experiment_temperature_unit=exp_temp_unit,
        )
    
    @classmethod
    def _parse_reagent(cls, data: Dict[str, Any]) -> ReagentViscosity:
        """解析单个试剂"""
        reagent_id = data.get("id")
        if not reagent_id:
            raise ValueError("试剂缺少 id 字段")
        
        name = data.get("name", reagent_id)
        
        # 解析黏度
        viscosity_value = 0.0
        viscosity_unit = "mPa·s"
        
        if "viscosity" in data:
            visc_data = data["viscosity"]
            if isinstance(visc_data, dict):
                viscosity_value = float(visc_data.get("value", 0.0))
                viscosity_unit = visc_data.get("unit", "mPa·s")
            else:
                viscosity_value = float(visc_data)
        
        # 解析温度
        temperature = None
        temperature_unit = "C"
        
        if "temperature" in data:
            temp_data = data["temperature"]
            if isinstance(temp_data, dict):
                temperature = float(temp_data.get("value"))
                temperature_unit = temp_data.get("unit", "C")
            else:
                temperature = float(temp_data)
        
        # 解析密度
        density = None
        density_unit = "kg/m3"
        
        if "density" in data:
            dens_data = data["density"]
            if isinstance(dens_data, dict):
                density = float(dens_data.get("value"))
                density_unit = dens_data.get("unit", "kg/m3")
            else:
                density = float(dens_data)
        
        # 解析目标比例
        target_ratio = None
        if "target_ratio" in data:
            target_ratio = float(data["target_ratio"])
        
        return ReagentViscosity(
            reagent_id=reagent_id,
            name=name,
            viscosity_value=viscosity_value,
            viscosity_unit=viscosity_unit,
            temperature=temperature,
            temperature_unit=temperature_unit,
            description=data.get("description", ""),
            density=density,
            density_unit=density_unit,
            target_ratio=target_ratio,
        )


def get_average_viscosity(
    viscosity_data: ViscosityData,
    ratios: Optional[Dict[str, float]] = None,
) -> float:
    """
    计算混合流体的平均黏度 (简化模型)
    
    使用对数混合规则: ln(μ_mix) = Σ(x_i * ln(μ_i))
    
    Args:
        viscosity_data: 黏度数据
        ratios: 混合比例 {reagent_id: ratio}，如未提供使用默认比例
    
    Returns:
        平均黏度 (Pa·s)
    """
    if ratios is None:
        ratios = viscosity_data.default_ratios
    
    if not ratios:
        # 如果没有比例，使用第一个试剂的黏度
        for reagent in viscosity_data.reagents.values():
            return convert(reagent.viscosity_value, reagent.viscosity_unit, "Pa·s", "viscosity")
        return 0.001  # 默认 1 cP (水的黏度)
    
    log_mu = 0.0
    total_ratio = sum(ratios.values())
    
    for reagent_id, ratio in ratios.items():
        reagent = viscosity_data.reagents.get(reagent_id)
        if reagent is None:
            continue
        
        # 归一化比例
        normalized_ratio = ratio / total_ratio if total_ratio > 0 else 0
        
        # 转换到 Pa·s
        mu_pas = convert(reagent.viscosity_value, reagent.viscosity_unit, "Pa·s", "viscosity")
        
        # 对数混合
        if mu_pas > 0:
            log_mu += normalized_ratio * math.log(mu_pas)
    
    return math.exp(log_mu) if log_mu != 0 else 0.001
