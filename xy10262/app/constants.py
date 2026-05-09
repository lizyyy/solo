from enum import Enum


class QueueStatus(str, Enum):
    WAITING = "waiting"
    INSPECTION_PENDING = "inspection_pending"
    INSPECTING = "inspecting"
    PASSED = "passed"
    DETAINED = "detained"


class InspectionPriority(str, Enum):
    HIGHEST = "highest"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


TEMP_NORMAL_LOW = -18.0
TEMP_NORMAL_HIGH = 0.0
TEMP_WARNING_LOW = -22.0
TEMP_WARNING_HIGH = 5.0

RISK_CARGO_TYPES = {
    "疫苗": RiskLevel.CRITICAL,
    "药品": RiskLevel.HIGH,
    "生鲜肉类": RiskLevel.HIGH,
    "海鲜": RiskLevel.MEDIUM,
    "乳制品": RiskLevel.MEDIUM,
    "冷冻食品": RiskLevel.LOW,
}

QUEUE_STATUS_FLOW = [
    QueueStatus.WAITING,
    QueueStatus.INSPECTION_PENDING,
    QueueStatus.INSPECTING,
]

FINAL_STATUSES = [QueueStatus.PASSED, QueueStatus.DETAINED]
