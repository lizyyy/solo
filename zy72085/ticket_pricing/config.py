from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional


@dataclass
class UnitConfig:
    name: str
    symbol: str
    to_base: float  


@dataclass
class PricingFormula:
    name: str
    description: str
    source: str  
    variables: List[str]
    expression: str


@dataclass
class BoundaryRule:
    variable: str
    min_value: Optional[float]
    max_value: Optional[float]
    unit: str
    severity: str  


@dataclass
class TierThreshold:
    tier: str
    min_price: float
    max_price: float
    color: str


@dataclass
class Config:
    base_currency: str = "CNY"
    base_time_unit: str = "day"
    
    units: Dict[str, UnitConfig] = field(default_factory=lambda: {
        "CNY": UnitConfig("人民币元", "¥", 1.0),
        "USD": UnitConfig("美元", "$", 7.2),
        "EUR": UnitConfig("欧元", "€", 7.8),
        "day": UnitConfig("天", "天", 1.0),
        "hour": UnitConfig("小时", "小时", 1/24),
        "minute": UnitConfig("分钟", "分钟", 1/1440),
        "person": UnitConfig("人", "人", 1.0),
        "seat": UnitConfig("座", "座", 1.0),
    })
    
    formulas: Dict[str, PricingFormula] = field(default_factory=lambda: {
        "base_price": PricingFormula(
            name="基础票价",
            description="演出基础票价计算",
            source="课堂讲义-第3章第2节",
            variables=["production_cost", "expected_attendance", "profit_margin"],
            expression="(production_cost / expected_attendance) * (1 + profit_margin)"
        ),
        "dynamic_multiplier": PricingFormula(
            name="动态倍率",
            description="基于时间和需求的动态价格调整",
            source="课堂讲义-第4章第1节",
            variables=["days_to_show", "ticket_sold_rate", "weekend_factor"],
            expression="1.0 + (1 / (days_to_show + 1)) * 0.3 + (ticket_sold_rate - 0.5) * 0.5 + weekend_factor * 0.2"
        ),
        "final_price": PricingFormula(
            name="最终票价",
            description="基础票价乘以动态倍率",
            source="课堂讲义-第4章第2节",
            variables=["base_price", "dynamic_multiplier"],
            expression="base_price * dynamic_multiplier"
        )
    })
    
    boundaries: List[BoundaryRule] = field(default_factory=lambda: [
        BoundaryRule("production_cost", 10000, 10000000, "CNY", "error"),
        BoundaryRule("expected_attendance", 50, 50000, "person", "error"),
        BoundaryRule("profit_margin", 0.05, 1.0, "ratio", "warning"),
        BoundaryRule("days_to_show", 0, 365, "day", "error"),
        BoundaryRule("ticket_sold_rate", 0, 1.0, "ratio", "error"),
        BoundaryRule("weekend_factor", 0, 1, "binary", "error"),
        BoundaryRule("base_price", 10, 5000, "CNY", "warning"),
        BoundaryRule("final_price", 5, 10000, "CNY", "error"),
    ])
    
    tiers: List[TierThreshold] = field(default_factory=lambda: [
        TierThreshold("经济档", 0, 100, "#4CAF50"),
        TierThreshold("普通档", 100, 300, "#2196F3"),
        TierThreshold("中档", 300, 600, "#FF9800"),
        TierThreshold("高档", 600, 1200, "#9C27B0"),
        TierThreshold("VIP档", 1200, float('inf'), "#F44336"),
    ])
    
    lecture_notes: Dict[str, str] = field(default_factory=lambda: {
        "profit_margin_range": "课堂讲义建议利润率在15%-50%之间",
        "dynamic_adjustment": "课堂讲义指出动态调整不应超过±50%",
        "weekend_definition": "课堂讲义定义周末为周五、周六、周日",
    })
    
    def get_tier(self, price: float) -> TierThreshold:
        for tier in self.tiers:
            if tier.min_price <= price < tier.max_price:
                return tier
        return self.tiers[-1]
    
    def convert_unit(self, value: float, from_unit: str, to_unit: str) -> float:
        if from_unit == to_unit:
            return value
        if from_unit not in self.units or to_unit not in self.units:
            raise ValueError(f"未知单位: {from_unit} 或 {to_unit}")
        base_value = value * self.units[from_unit].to_base
        return base_value / self.units[to_unit].to_base
