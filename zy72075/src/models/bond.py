from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any


class ProcessStatus(str, Enum):
    PENDING = "待处理"
    SUCCESS = "计算成功"
    FAILED = "计算失败"
    SKIPPED = "已跳过"


@dataclass
class BondRecord:
    bond_code: str
    bond_name: str
    bond_price: Optional[float] = None
    bond_price_unit: Optional[str] = None
    conversion_price: Optional[float] = None
    conversion_price_unit: Optional[str] = None
    stock_price: Optional[float] = None
    stock_price_unit: Optional[str] = None
    conversion_ratio: Optional[float] = None
    face_value: Optional[float] = 100.0
    face_value_unit: Optional[str] = "元"
    original_source: str = ""
    raw_data: Dict[str, Any] = field(default_factory=dict)
    remark: str = ""
    line_number: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CalculationResult:
    bond_code: str
    bond_name: str
    status: ProcessStatus
    conversion_value: Optional[float] = None
    conversion_premium_rate: Optional[float] = None
    boundary_decision: Optional[str] = None
    boundary_explanation: Optional[str] = None
    formulas: Dict[str, str] = field(default_factory=dict)
    units_used: Dict[str, str] = field(default_factory=dict)
    boundary_values: Dict[str, float] = field(default_factory=dict)
    error_reason: Optional[str] = None
    warnings: list = field(default_factory=list)
    process_time: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    original_source: str = ""
    raw_data: Dict[str, Any] = field(default_factory=dict)
    remark: str = ""
    line_number: int = 0

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result["status"] = self.status.value
        return result
