from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any, List


class RecordStatus(Enum):
    CONFIRMED = "已确认"
    PENDING = "待补"
    MANUAL_MODIFIED = "人工修改"


class AnomalyType(Enum):
    MISSING_ROUND = "回合缺失"
    DUPLICATE_ACTION = "重复行动"
    ABNORMAL_DAMAGE = "伤害异常"
    ABNORMAL_HEALING = "治疗异常"
    SCORE_GAP = "分差过大"
    INVALID_TEAM = "阵营错误"
    MISSING_FIELD = "字段缺失"
    ORDER_ERROR = "回合顺序错误"


@dataclass
class BattleRecord:
    round_num: int
    team: str
    player_id: str
    action_type: str
    result: str
    damage: Optional[int] = None
    healing: Optional[int] = None
    score_change: Optional[int] = None
    target: Optional[str] = None
    notes: Optional[str] = None
    status: RecordStatus = RecordStatus.CONFIRMED
    import_source: str = ""
    import_time: datetime = field(default_factory=datetime.now)
    manual_modify_reason: Optional[str] = None
    record_id: str = field(init=False)

    def __post_init__(self):
        self.record_id = f"{self.round_num}_{self.team}_{self.player_id}_{self.action_type}_{int(self.import_time.timestamp())}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "记录ID": self.record_id,
            "回合": self.round_num,
            "阵营": self.team,
            "玩家ID": self.player_id,
            "行动类型": self.action_type,
            "结果": self.result,
            "伤害": self.damage,
            "治疗": self.healing,
            "分数变化": self.score_change,
            "目标": self.target,
            "备注": self.notes,
            "状态": self.status.value,
            "导入来源": self.import_source,
            "导入时间": self.import_time.strftime("%Y-%m-%d %H:%M:%S"),
            "人工修改原因": self.manual_modify_reason,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "BattleRecord":
        status = RecordStatus(data.get("状态", "已确认"))
        record = cls(
            round_num=int(data.get("回合", 0)),
            team=str(data.get("阵营", "")),
            player_id=str(data.get("玩家ID", "")),
            action_type=str(data.get("行动类型", "")),
            result=str(data.get("结果", "")),
            damage=int(data["伤害"]) if data.get("伤害") else None,
            healing=int(data["治疗"]) if data.get("治疗") else None,
            score_change=int(data["分数变化"]) if data.get("分数变化") else None,
            target=str(data["目标"]) if data.get("目标") else None,
            notes=str(data["备注"]) if data.get("备注") else None,
            status=status,
            import_source=str(data.get("导入来源", "")),
            manual_modify_reason=str(data.get("人工修改原因")) if data.get("人工修改原因") else None,
        )
        if "记录ID" in data:
            record.record_id = data["记录ID"]
        return record


@dataclass
class Anomaly:
    anomaly_type: AnomalyType
    description: str
    affected_records: List[str]
    round_num: Optional[int] = None
    severity: str = "warning"
    resolved: bool = False
    resolve_note: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "异常类型": self.anomaly_type.value,
            "描述": self.description,
            "影响记录": ", ".join(self.affected_records),
            "关联回合": self.round_num,
            "严重程度": self.severity,
            "是否已解决": self.resolved,
            "解决说明": self.resolve_note,
        }


@dataclass
class ImportSession:
    session_id: str
    source_file: str
    import_time: datetime
    record_count: int
    records: List[str]
    can_rollback: bool = True
    rollback_note: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "会话ID": self.session_id,
            "来源文件": self.source_file,
            "导入时间": self.import_time.strftime("%Y-%m-%d %H:%M:%S"),
            "记录数量": self.record_count,
            "记录ID列表": ", ".join(self.records),
            "可撤回": self.can_rollback,
            "撤回说明": self.rollback_note,
        }
