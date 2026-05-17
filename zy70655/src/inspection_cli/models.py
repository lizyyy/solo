from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List


class DefectType(Enum):
    SAFETY = "安全项"
    MAINTENANCE = "保养项"
    ENVIRONMENT = "环境项"
    OPERATION = "操作项"


class RiskLevel(Enum):
    HIGH = "高风险"
    MEDIUM = "中风险"
    LOW = "低风险"


@dataclass
class InspectionRecord:
    date: str
    device_id: str
    check_item: str
    team: str
    defect_type: DefectType
    is_completed: bool
    inspector: Optional[str] = None
    remark: Optional[str] = None
    risk_level: RiskLevel = RiskLevel.LOW
    rectification_deadline: Optional[str] = None
    rectification_person: Optional[str] = None
    is_rectified: bool = False

    def validate(self) -> List[str]:
        errors = []
        if not self.date:
            errors.append("日期不能为空")
        if not self.device_id:
            errors.append("设备编号不能为空")
        if not self.check_item:
            errors.append("检查项不能为空")
        if not self.team:
            errors.append("班组不能为空")
        return errors


@dataclass
class TeamSummary:
    team: str
    total_items: int = 0
    completed_items: int = 0
    safety_defects: int = 0
    maintenance_defects: int = 0
    high_risk: int = 0
    medium_risk: int = 0
    low_risk: int = 0

    @property
    def completion_rate(self) -> float:
        if self.total_items == 0:
            return 0.0
        return round((self.completed_items / self.total_items) * 100, 2)


@dataclass
class InspectionReport:
    report_date: str
    generated_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    records: List[InspectionRecord] = field(default_factory=list)
    team_summaries: List[TeamSummary] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
