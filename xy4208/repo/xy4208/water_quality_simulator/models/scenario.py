from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field, field_validator


class ActionType(str, Enum):
    WATER_CHANGE = "water_change"
    AERATION = "aeration"
    PROBIOTICS = "probiotics"
    CHEMICAL_TREATMENT = "chemical_treatment"


class WaterChangePlan(BaseModel):
    plan_id: str = Field(..., description="计划唯一标识")
    start_time: datetime = Field(..., description="开始时间")
    duration_hours: float = Field(..., gt=0, description="持续时间(小时)")
    exchange_rate: float = Field(..., ge=0, le=1.0, description="换水速率(体积比例/小时)")
    total_exchange_ratio: float = Field(..., ge=0, le=1.0, description="总换水比例")
    source_water_ph: float = Field(8.0, ge=0, le=14, description="水源pH值")
    source_water_salinity: float = Field(0.0, ge=0, description="水源盐度(‰)")
    source_water_ammonia: float = Field(0.0, ge=0, description="水源氨氮(mg/L)")
    source_water_nitrite: float = Field(0.0, ge=0, description="水源亚硝酸盐(mg/L)")
    is_urgent: bool = Field(False, description="是否紧急换水")
    notes: Optional[str] = Field(None, description="备注")

    @field_validator("total_exchange_ratio")
    @classmethod
    def validate_exchange_ratio(cls, v: float, info: dict) -> float:
        if "duration_hours" in info.data and "exchange_rate" in info.data:
            expected = info.data["duration_hours"] * info.data["exchange_rate"]
            if abs(v - expected) > 0.01:
                raise ValueError(
                    f"总换水比例 {v} 与计算值 {expected:.3f} 不一致"
                )
        return v

    def get_end_time(self) -> datetime:
        return self.start_time + timedelta(hours=self.duration_hours)


class AerationPlan(BaseModel):
    plan_id: str = Field(..., description="计划唯一标识")
    start_time: datetime = Field(..., description="开始时间")
    duration_hours: float = Field(..., gt=0, description="持续时间(小时)")
    aeration_rate: float = Field(..., ge=0, description="曝气速率(mg/L/小时)")
    aeration_intensity: str = Field("normal", description="曝气强度: low, normal, high")
    use_oxygenator: bool = Field(False, description="是否使用增氧机")
    notes: Optional[str] = Field(None, description="备注")

    def get_end_time(self) -> datetime:
        return self.start_time + timedelta(hours=self.duration_hours)


class ProbioticsPlan(BaseModel):
    plan_id: str = Field(..., description="计划唯一标识")
    application_time: datetime = Field(..., description="施用时间")
    probiotics_type: str = Field(..., description="益生菌类型")
    dosage: float = Field(..., gt=0, description="投加量(g/立方米)")
    expected_efficiency: float = Field(0.3, ge=0, le=1.0, description="预期处理效率")
    last_application_time: Optional[datetime] = Field(None, description="上次施用时间")
    minimum_interval_hours: float = Field(24.0, ge=0, description="最小施用间隔(小时)")
    notes: Optional[str] = Field(None, description="备注")

    def check_interval_conflict(self) -> bool:
        if self.last_application_time is None:
            return False
        hours_since_last = (self.application_time - self.last_application_time).total_seconds() / 3600
        return hours_since_last < self.minimum_interval_hours


class Scenario(BaseModel):
    scenario_id: str = Field(..., description="方案唯一标识")
    scenario_name: str = Field(..., description="方案名称")
    pond_id: str = Field(..., description="池塘ID")
    created_at: datetime = Field(default_factory=datetime.now)
    description: Optional[str] = Field(None, description="方案描述")

    water_change_plans: List[WaterChangePlan] = Field(default_factory=list, description="换水计划列表")
    aeration_plans: List[AerationPlan] = Field(default_factory=list, description="曝气计划列表")
    probiotics_plans: List[ProbioticsPlan] = Field(default_factory=list, description="补菌计划列表")

    is_baseline: bool = Field(False, description="是否为基准方案(无干预)")
    simulation_params_override: Optional[Dict[str, Any]] = Field(None, description="模拟参数覆盖")

    def add_water_change_plan(self, plan: WaterChangePlan) -> None:
        self.water_change_plans.append(plan)
        self.water_change_plans.sort(key=lambda p: p.start_time)

    def add_aeration_plan(self, plan: AerationPlan) -> None:
        self.aeration_plans.append(plan)
        self.aeration_plans.sort(key=lambda p: p.start_time)

    def add_probiotics_plan(self, plan: ProbioticsPlan) -> None:
        self.probiotics_plans.append(plan)
        self.probiotics_plans.sort(key=lambda p: p.application_time)

    def get_total_water_exchange(self) -> float:
        return sum(p.total_exchange_ratio for p in self.water_change_plans)

    def check_probiotics_conflicts(self) -> List[Dict[str, Any]]:
        conflicts = []
        for i, plan in enumerate(self.probiotics_plans):
            if plan.check_interval_conflict():
                conflicts.append({
                    "plan_id": plan.plan_id,
                    "conflict_type": "interval",
                    "message": f"益生菌施用间隔不足，上次施用时间: {plan.last_application_time}",
                })
        return conflicts

    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "scenario_name": self.scenario_name,
            "pond_id": self.pond_id,
            "created_at": self.created_at.isoformat(),
            "description": self.description,
            "is_baseline": self.is_baseline,
            "water_change_plans": [
                {
                    "plan_id": p.plan_id,
                    "start_time": p.start_time.isoformat(),
                    "duration_hours": p.duration_hours,
                    "exchange_rate": p.exchange_rate,
                    "total_exchange_ratio": p.total_exchange_ratio,
                    "is_urgent": p.is_urgent,
                }
                for p in self.water_change_plans
            ],
            "aeration_plans": [
                {
                    "plan_id": p.plan_id,
                    "start_time": p.start_time.isoformat(),
                    "duration_hours": p.duration_hours,
                    "aeration_rate": p.aeration_rate,
                    "aeration_intensity": p.aeration_intensity,
                }
                for p in self.aeration_plans
            ],
            "probiotics_plans": [
                {
                    "plan_id": p.plan_id,
                    "application_time": p.application_time.isoformat(),
                    "probiotics_type": p.probiotics_type,
                    "dosage": p.dosage,
                }
                for p in self.probiotics_plans
            ],
        }
