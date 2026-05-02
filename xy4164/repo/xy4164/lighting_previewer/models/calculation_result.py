"""计算结果数据模型"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ZoneResult:
    zone_id: str
    zone_name: str
    crop_type: str
    
    natural_dli: float
    supplemental_dli: float
    total_dli: float
    target_dli: float
    min_dli: float
    max_dli: float
    
    natural_light_hours: float
    supplemental_light_hours: float
    
    blue_red_ratio: float
    spectrum_analysis: Dict[str, float]
    
    estimated_energy: float
    estimated_cost: float
    
    risk_level: str
    warnings: List[str]
    
    hourly_analysis: Dict[int, Dict] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "zone_id": self.zone_id,
            "zone_name": self.zone_name,
            "crop_type": self.crop_type,
            "natural_dli": self.natural_dli,
            "supplemental_dli": self.supplemental_dli,
            "total_dli": self.total_dli,
            "target_dli": self.target_dli,
            "min_dli": self.min_dli,
            "max_dli": self.max_dli,
            "natural_light_hours": self.natural_light_hours,
            "supplemental_light_hours": self.supplemental_light_hours,
            "blue_red_ratio": self.blue_red_ratio,
            "spectrum_analysis": self.spectrum_analysis,
            "estimated_energy": self.estimated_energy,
            "estimated_cost": self.estimated_cost,
            "risk_level": self.risk_level,
            "warnings": self.warnings,
            "hourly_analysis": self.hourly_analysis
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "ZoneResult":
        return cls(
            zone_id=data["zone_id"],
            zone_name=data["zone_name"],
            crop_type=data["crop_type"],
            natural_dli=data["natural_dli"],
            supplemental_dli=data["supplemental_dli"],
            total_dli=data["total_dli"],
            target_dli=data["target_dli"],
            min_dli=data["min_dli"],
            max_dli=data["max_dli"],
            natural_light_hours=data["natural_light_hours"],
            supplemental_light_hours=data["supplemental_light_hours"],
            blue_red_ratio=data["blue_red_ratio"],
            spectrum_analysis=data["spectrum_analysis"],
            estimated_energy=data["estimated_energy"],
            estimated_cost=data["estimated_cost"],
            risk_level=data["risk_level"],
            warnings=data["warnings"],
            hourly_analysis=data.get("hourly_analysis", {})
        )
    
    @property
    def dli_status(self) -> str:
        if self.total_dli < self.min_dli:
            return "deficient"
        elif self.total_dli > self.max_dli:
            return "excessive"
        elif self.total_dli >= self.target_dli * 0.95 and self.total_dli <= self.target_dli * 1.05:
            return "optimal"
        else:
            return "acceptable"
    
    @property
    def dli_deficit(self) -> float:
        return max(0, self.target_dli - self.total_dli)
    
    @property
    def dli_excess(self) -> float:
        return max(0, self.total_dli - self.max_dli)


@dataclass
class CalculationResult:
    result_id: str
    calculated_at: str
    base_date: str
    
    zone_results: List[ZoneResult] = field(default_factory=list)
    
    total_natural_dli: float = 0.0
    total_supplemental_dli: float = 0.0
    total_dli: float = 0.0
    
    total_estimated_energy: float = 0.0
    total_estimated_cost: float = 0.0
    
    budget_limit: Optional[float] = None
    budget_utilization: float = 0.0
    
    overall_risk_level: str = "low"
    all_warnings: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict:
        return {
            "result_id": self.result_id,
            "calculated_at": self.calculated_at,
            "base_date": self.base_date,
            "zone_results": [z.to_dict() for z in self.zone_results],
            "total_natural_dli": self.total_natural_dli,
            "total_supplemental_dli": self.total_supplemental_dli,
            "total_dli": self.total_dli,
            "total_estimated_energy": self.total_estimated_energy,
            "total_estimated_cost": self.total_estimated_cost,
            "budget_limit": self.budget_limit,
            "budget_utilization": self.budget_utilization,
            "overall_risk_level": self.overall_risk_level,
            "all_warnings": self.all_warnings
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> "CalculationResult":
        return cls(
            result_id=data["result_id"],
            calculated_at=data["calculated_at"],
            base_date=data.get("base_date", ""),
            zone_results=[ZoneResult.from_dict(z) for z in data.get("zone_results", [])],
            total_natural_dli=data.get("total_natural_dli", 0.0),
            total_supplemental_dli=data.get("total_supplemental_dli", 0.0),
            total_dli=data.get("total_dli", 0.0),
            total_estimated_energy=data.get("total_estimated_energy", 0.0),
            total_estimated_cost=data.get("total_estimated_cost", 0.0),
            budget_limit=data.get("budget_limit"),
            budget_utilization=data.get("budget_utilization", 0.0),
            overall_risk_level=data.get("overall_risk_level", "low"),
            all_warnings=data.get("all_warnings", [])
        )
    
    def get_zone_result(self, zone_id: str) -> Optional[ZoneResult]:
        for zr in self.zone_results:
            if zr.zone_id == zone_id:
                return zr
        return None
    
    @property
    def deficient_zones(self) -> List[ZoneResult]:
        return [z for z in self.zone_results if z.dli_status == "deficient"]
    
    @property
    def excessive_zones(self) -> List[ZoneResult]:
        return [z for z in self.zone_results if z.dli_status == "excessive"]
    
    @property
    def zones_at_risk(self) -> List[ZoneResult]:
        return [z for z in self.zone_results if z.risk_level in ["high", "medium"]]
    
    @property
    def budget_status(self) -> str:
        if self.budget_limit is None:
            return "unknown"
        if self.total_estimated_cost > self.budget_limit:
            return "over_budget"
        elif self.total_estimated_cost > self.budget_limit * 0.9:
            return "warning"
        else:
            return "under_budget"
