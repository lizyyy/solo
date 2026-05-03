from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum


class ReviewAction(Enum):
    """
    复核操作类型
    """
    CONFIRM = "确认风险"
    DISMISS = "驳回风险"
    ADD_NOTE = "添加备注"
    EDIT_RISK = "编辑风险"


@dataclass
class ReviewRecord:
    """
    单条复核记录
    """
    record_id: str
    risk_id: str
    case_id: str
    action: ReviewAction
    reviewer: Optional[str] = None
    timestamp: datetime = None
    notes: Optional[str] = None
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    metadata: Dict = field(default_factory=dict)
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()
    
    def to_dict(self) -> Dict:
        """
        转换为字典
        """
        return {
            "record_id": self.record_id,
            "risk_id": self.risk_id,
            "case_id": self.case_id,
            "action": self.action.value,
            "action_code": self.action.name,
            "reviewer": self.reviewer,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "notes": self.notes,
            "previous_status": self.previous_status,
            "new_status": self.new_status,
            "metadata": self.metadata
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'ReviewRecord':
        """
        从字典创建对象
        """
        # 解析操作类型
        action_code = data.get("action_code", data.get("action", "ADD_NOTE"))
        try:
            action = ReviewAction[action_code]
        except KeyError:
            action = ReviewAction.ADD_NOTE
        
        # 解析时间
        timestamp = datetime.fromisoformat(data["timestamp"]) if data.get("timestamp") else None
        
        return cls(
            record_id=data["record_id"],
            risk_id=data["risk_id"],
            case_id=data["case_id"],
            action=action,
            reviewer=data.get("reviewer"),
            timestamp=timestamp,
            notes=data.get("notes"),
            previous_status=data.get("previous_status"),
            new_status=data.get("new_status"),
            metadata=data.get("metadata", {})
        )


@dataclass
class Review:
    """
    完整的复核记录集
    """
    case_id: str
    records: List[ReviewRecord] = field(default_factory=list)
    
    def add_record(self, record: ReviewRecord):
        """
        添加复核记录
        """
        self.records.append(record)
        # 按时间排序
        self.records.sort(key=lambda x: x.timestamp if x.timestamp else datetime.min)
    
    def get_records_for_risk(self, risk_id: str) -> List[ReviewRecord]:
        """
        获取指定风险的所有复核记录
        """
        return [
            record for record in self.records
            if record.risk_id == risk_id
        ]
    
    def get_records_in_range(self, start_time: datetime, end_time: datetime) -> List[ReviewRecord]:
        """
        获取指定时间范围内的复核记录
        """
        return [
            record for record in self.records
            if record.timestamp and start_time <= record.timestamp <= end_time
        ]
    
    def to_dict(self) -> Dict:
        """
        转换为字典
        """
        return {
            "case_id": self.case_id,
            "records": [record.to_dict() for record in self.records]
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Review':
        """
        从字典创建对象
        """
        records = []
        for record_data in data.get("records", []):
            records.append(ReviewRecord.from_dict(record_data))
        
        return cls(
            case_id=data["case_id"],
            records=records
        )
