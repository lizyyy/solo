from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List


@dataclass
class CalculationParams:
    boundary_premium_rate_low: float = 0.0
    boundary_premium_rate_high: float = 2.0
    default_face_value: float = 100.0
    default_face_value_unit: str = "元"
    unit_conversion: Dict[str, Dict[str, float]] = field(default_factory=lambda: {
        "元": {"元": 1.0, "万元": 0.0001, "角": 10.0, "分": 100.0},
        "万元": {"元": 10000.0, "万元": 1.0, "角": 100000.0, "分": 1000000.0},
        "角": {"元": 0.1, "万元": 0.00001, "角": 1.0, "分": 10.0},
        "分": {"元": 0.01, "万元": 0.000001, "角": 0.1, "分": 1.0},
    })
    premium_rate_interpretation: Dict[str, str] = field(default_factory=lambda: {
        "negative": "转股溢价率为负，转股有利可图，处于转股边界内",
        "within_boundary": "转股溢价率在边界区间内，建议关注转股机会",
        "near_boundary": "转股溢价率接近边界，需密切关注价格变动",
        "above_boundary": "转股溢价率高于边界，转股不划算",
    })
    remarks: List[Dict[str, Any]] = field(default_factory=lambda: [
        {"key": "boundary_premium_rate_low", "remark": "小岑2025年11月确认：低于0%时转股肯定划算，这是硬边界"},
        {"key": "boundary_premium_rate_high", "remark": "小岑2025年11月确认：2%是常规操作边界，超过基本不考虑转股"},
        {"key": "default_face_value", "remark": "可转债面值默认100元，特殊情况看募集说明书"},
        {"key": "unit_conversion", "remark": "单位换算表，2025年Q4统一，之前有些表用万元做单位坑了不少人"},
        {"key": "formula_conversion_value", "remark": "转股价值=面值/转股价×正股价，别搞反了，去年有次算反了亏大了"},
        {"key": "formula_premium_rate", "remark": "转股溢价率=(转债价格-转股价值)/转股价值×100%，分母是转股价值不是转债价格"},
    ])

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def get_remark(self, key: str) -> str:
        for item in self.remarks:
            if item["key"] == key:
                return item["remark"]
        return ""
