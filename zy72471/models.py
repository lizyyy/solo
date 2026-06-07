from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict, Any
from enum import Enum


class RecordStatus(str, Enum):
    NORMAL = "正常"
    NEEDS_REVIEW = "待复核"
    SUPPLEMENTED = "已补录"
    OLD_STANDARD = "旧口径"
    PENDING_CORRECTION = "待整改"


class CorrectionSource(str, Enum):
    RAMP_SUPPLEMENT = "坡道补录"
    REDLINE_NOTE = "红线图备注"
    MANUAL = "人工修正"


@dataclass
class BuildingSetbackRecord:
    record_id: str
    building_name: str
    address: str
    bus_card_time: str
    initial_score: float
    current_score: float = 0.0
    status: RecordStatus = RecordStatus.NORMAL
    redline_note: Optional[str] = None
    ramp_supplemented: bool = False
    corrections: List[Dict[str, Any]] = field(default_factory=list)
    history: List[Dict[str, Any]] = field(default_factory=list)
    suggestion: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def add_history(self, action: str, operator: str, detail: str):
        self.history.append({
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "action": action,
            "operator": operator,
            "detail": detail
        })
        self.updated_at = datetime.now()

    def add_correction(self, source: CorrectionSource, content: str, operator: str):
        self.corrections.append({
            "source": source.value,
            "content": content,
            "operator": operator,
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
        self.add_history(
            action="修正记录",
            operator=operator,
            detail=f"来源: {source.value}, 内容: {content}"
        )


@dataclass
class ProcessingResult:
    record_id: str
    building_name: str
    final_score: float
    status: RecordStatus
    suggestion: str
    history_count: int
    correction_count: int
    display_message: str
