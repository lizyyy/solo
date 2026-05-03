"""数据模型定义"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime


class TubeMaterial(Enum):
    PLASTIC = "plastic"
    GLASS = "glass"
    POLYCARBONATE = "polycarbonate"


@dataclass
class TubeType:
    """管型定义"""
    id: str
    name: str
    empty_weight_g: float
    max_volume_ml: float
    material: TubeMaterial = TubeMaterial.PLASTIC
    description: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "empty_weight_g": self.empty_weight_g,
            "max_volume_ml": self.max_volume_ml,
            "material": self.material.value,
            "description": self.description
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TubeType":
        return cls(
            id=data["id"],
            name=data["name"],
            empty_weight_g=data["empty_weight_g"],
            max_volume_ml=data["max_volume_ml"],
            material=TubeMaterial(data.get("material", "plastic")),
            description=data.get("description", "")
        )


@dataclass
class Sample:
    """样品定义"""
    hole_position: int
    tube_type_id: str
    sample_volume_ml: float
    sample_density_gml: float = 1.0
    label: str = ""
    
    def total_mass_g(self, tube_type: TubeType) -> float:
        """计算总质量（管型自重 + 样品质量）"""
        sample_mass = self.sample_volume_ml * self.sample_density_gml
        return tube_type.empty_weight_g + sample_mass
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "hole_position": self.hole_position,
            "tube_type_id": self.tube_type_id,
            "sample_volume_ml": self.sample_volume_ml,
            "sample_density_gml": self.sample_density_gml,
            "label": self.label
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Sample":
        return cls(
            hole_position=data["hole_position"],
            tube_type_id=data["tube_type_id"],
            sample_volume_ml=data["sample_volume_ml"],
            sample_density_gml=data.get("sample_density_gml", 1.0),
            label=data.get("label", "")
        )


@dataclass
class Rotor:
    """转子定义"""
    id: str
    name: str
    hole_count: int
    radius_cm: float
    max_rpm: int
    description: str = ""
    usage_count: int = 0
    last_used: Optional[datetime] = None
    
    def get_opposite_hole(self, position: int) -> int:
        """获取对称孔位"""
        if position < 1 or position > self.hole_count:
            raise ValueError(f"孔位 {position} 超出范围 [1, {self.hole_count}]")
        
        half_count = self.hole_count // 2
        if position <= half_count:
            return position + half_count
        else:
            return position - half_count
    
    def get_hole_pairs(self) -> List[tuple]:
        """获取所有对称孔位对"""
        half_count = self.hole_count // 2
        pairs = []
        for i in range(1, half_count + 1):
            pairs.append((i, i + half_count))
        return pairs
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "hole_count": self.hole_count,
            "radius_cm": self.radius_cm,
            "max_rpm": self.max_rpm,
            "description": self.description,
            "usage_count": self.usage_count,
            "last_used": self.last_used.isoformat() if self.last_used else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Rotor":
        last_used = None
        if data.get("last_used"):
            try:
                last_used = datetime.fromisoformat(data["last_used"])
            except (ValueError, TypeError):
                last_used = None
        
        return cls(
            id=data["id"],
            name=data["name"],
            hole_count=data["hole_count"],
            radius_cm=data["radius_cm"],
            max_rpm=data["max_rpm"],
            description=data.get("description", ""),
            usage_count=data.get("usage_count", 0),
            last_used=last_used
        )


@dataclass
class HoleResult:
    """单个孔位计算结果"""
    hole_position: int
    tube_type_id: str
    total_mass_g: float
    mass_moment_gcm: float
    sample_volume_ml: float
    sample_density_gml: float
    label: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "hole_position": self.hole_position,
            "tube_type_id": self.tube_type_id,
            "total_mass_g": self.total_mass_g,
            "mass_moment_gcm": self.mass_moment_gcm,
            "sample_volume_ml": self.sample_volume_ml,
            "sample_density_gml": self.sample_density_gml,
            "label": self.label
        }


@dataclass
class ImbalanceInfo:
    """不平衡量信息"""
    hole_pair: tuple
    hole1_position: int
    hole2_position: int
    hole1_mass_g: float
    hole2_mass_g: float
    mass_difference_g: float
    mass_direction: str
    hole1_moment_gcm: float
    hole2_moment_gcm: float
    moment_difference_gcm: float
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "hole_pair": self.hole_pair,
            "hole1_position": self.hole1_position,
            "hole2_position": self.hole2_position,
            "hole1_mass_g": self.hole1_mass_g,
            "hole2_mass_g": self.hole2_mass_g,
            "mass_difference_g": self.mass_difference_g,
            "mass_direction": self.mass_direction,
            "hole1_moment_gcm": self.hole1_moment_gcm,
            "hole2_moment_gcm": self.hole2_moment_gcm,
            "moment_difference_gcm": self.moment_difference_gcm
        }


@dataclass
class AdjustmentSuggestion:
    """调整建议"""
    suggestion_type: str
    description: str
    hole_position: Optional[int] = None
    target_hole: Optional[int] = None
    adjustment_ml: Optional[float] = None
    priority: str = "medium"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "suggestion_type": self.suggestion_type,
            "description": self.description,
            "hole_position": self.hole_position,
            "target_hole": self.target_hole,
            "adjustment_ml": self.adjustment_ml,
            "priority": self.priority
        }


@dataclass
class ValidationError:
    """校验错误"""
    error_type: str
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_type": self.error_type,
            "message": self.message,
            "details": self.details
        }


@dataclass
class BalanceResult:
    """配平计算结果"""
    rotor_id: str
    run_rpm: int
    hole_results: List[HoleResult]
    imbalance_infos: List[ImbalanceInfo]
    adjustment_suggestions: List[AdjustmentSuggestion]
    validation_errors: List[ValidationError]
    is_balanced: bool
    max_mass_imbalance_g: float
    max_moment_imbalance_gcm: float
    timestamp: datetime = field(default_factory=datetime.now)
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "rotor_id": self.rotor_id,
            "run_rpm": self.run_rpm,
            "hole_results": [hr.to_dict() for hr in self.hole_results],
            "imbalance_infos": [ii.to_dict() for ii in self.imbalance_infos],
            "adjustment_suggestions": [as_.to_dict() for as_ in self.adjustment_suggestions],
            "validation_errors": [ve.to_dict() for ve in self.validation_errors],
            "is_balanced": self.is_balanced,
            "max_mass_imbalance_g": self.max_mass_imbalance_g,
            "max_moment_imbalance_gcm": self.max_moment_imbalance_gcm,
            "timestamp": self.timestamp.isoformat(),
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BalanceResult":
        hole_results = [HoleResult(**hr) for hr in data.get("hole_results", [])]
        imbalance_infos = [ImbalanceInfo(**ii) for ii in data.get("imbalance_infos", [])]
        adjustment_suggestions = [AdjustmentSuggestion(**as_) for as_ in data.get("adjustment_suggestions", [])]
        validation_errors = [ValidationError(**ve) for ve in data.get("validation_errors", [])]
        
        timestamp = datetime.now()
        if data.get("timestamp"):
            try:
                timestamp = datetime.fromisoformat(data["timestamp"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            rotor_id=data["rotor_id"],
            run_rpm=data["run_rpm"],
            hole_results=hole_results,
            imbalance_infos=imbalance_infos,
            adjustment_suggestions=adjustment_suggestions,
            validation_errors=validation_errors,
            is_balanced=data["is_balanced"],
            max_mass_imbalance_g=data["max_mass_imbalance_g"],
            max_moment_imbalance_gcm=data["max_moment_imbalance_gcm"],
            timestamp=timestamp,
            notes=data.get("notes", "")
        )


@dataclass
class BalanceConfig:
    """配平配置"""
    mass_imbalance_threshold_g: float = 0.1
    moment_imbalance_threshold_gcm: float = 0.5
    default_sample_density_gml: float = 1.0
    allow_partial_loading: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "mass_imbalance_threshold_g": self.mass_imbalance_threshold_g,
            "moment_imbalance_threshold_gcm": self.moment_imbalance_threshold_gcm,
            "default_sample_density_gml": self.default_sample_density_gml,
            "allow_partial_loading": self.allow_partial_loading
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BalanceConfig":
        return cls(
            mass_imbalance_threshold_g=data.get("mass_imbalance_threshold_g", 0.1),
            moment_imbalance_threshold_gcm=data.get("moment_imbalance_threshold_gcm", 0.5),
            default_sample_density_gml=data.get("default_sample_density_gml", 1.0),
            allow_partial_loading=data.get("allow_partial_loading", False)
        )
