from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any
from datetime import datetime
import hashlib
import json


RECORD_STATUS = [
    "pending",      # 待处理
    "processing",   # 处理中
    "confirmed",    # 已确认
    "on_hold",      # 已搁置
]


@dataclass
class UnitConfig:
    unit_id: str
    name: str
    hp: int
    attack: int
    defense: int
    speed: int
    skills: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BattleMaterial:
    material_id: str
    source: str
    units: List[UnitConfig]
    terrain: str
    weather: str
    turn_order: List[str]
    special_rules: List[str] = field(default_factory=list)
    version: str = "1.0"

    def compute_hash(self) -> str:
        data = {
            "units": sorted([u.to_dict() for u in self.units], key=lambda x: x["unit_id"]),
            "terrain": self.terrain,
            "weather": self.weather,
            "turn_order": self.turn_order,
            "special_rules": sorted(self.special_rules),
        }
        raw = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "material_id": self.material_id,
            "source": self.source,
            "units": [u.to_dict() for u in self.units],
            "terrain": self.terrain,
            "weather": self.weather,
            "turn_order": self.turn_order,
            "special_rules": self.special_rules,
            "version": self.version,
            "content_hash": self.compute_hash(),
        }


@dataclass
class TurnResult:
    turn_number: int
    acting_unit: str
    target_unit: str
    action: str
    damage: int
    remaining_hp: Dict[str, int]
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BattleResult:
    winner: str
    total_turns: int
    turn_results: List[TurnResult]
    final_hp: Dict[str, int]
    balance_score: float
    issues: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "winner": self.winner,
            "total_turns": self.total_turns,
            "turn_results": [t.to_dict() for t in self.turn_results],
            "final_hp": self.final_hp,
            "balance_score": self.balance_score,
            "issues": self.issues,
        }


@dataclass
class ChangeLogEntry:
    timestamp: str
    operator: str
    field_changed: str
    old_value: Any
    new_value: Any
    reason: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class BattleRecord:
    record_id: str
    material: BattleMaterial
    result: Optional[BattleResult] = None
    status: str = "pending"
    operator: str = ""
    pending_reason: str = ""
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    change_log: List[ChangeLogEntry] = field(default_factory=list)
    material_hash_history: List[str] = field(default_factory=list)
    notes: str = ""

    def __post_init__(self):
        content_hash = self.material.compute_hash()
        if content_hash not in self.material_hash_history:
            self.material_hash_history.append(content_hash)

    def is_duplicate(self, other_material: BattleMaterial) -> bool:
        return other_material.compute_hash() in self.material_hash_history

    def set_status(self, status: str, operator: str, reason: str = "") -> None:
        if status not in RECORD_STATUS:
            raise ValueError(f"Invalid status: {status}")
        old_status = self.status
        self.status = status
        self.updated_at = datetime.now().isoformat()
        self.change_log.append(ChangeLogEntry(
            timestamp=self.updated_at,
            operator=operator,
            field_changed="status",
            old_value=old_status,
            new_value=status,
            reason=reason,
        ))
        if status == "pending":
            self.pending_reason = reason

    def set_result(self, result: BattleResult, operator: str) -> None:
        old_result = self.result.to_dict() if self.result else None
        self.result = result
        self.updated_at = datetime.now().isoformat()
        self.change_log.append(ChangeLogEntry(
            timestamp=self.updated_at,
            operator=operator,
            field_changed="result",
            old_value=str(old_result),
            new_value=str(result.to_dict()),
            reason="战斗计算完成",
        ))

    def update_material(self, material: BattleMaterial, operator: str, reason: str) -> Dict[str, Any]:
        old_dict = self.material.to_dict()
        new_dict = material.to_dict()
        diff = self._diff_materials(old_dict, new_dict)
        self.material = material
        self.updated_at = datetime.now().isoformat()
        content_hash = material.compute_hash()
        if content_hash not in self.material_hash_history:
            self.material_hash_history.append(content_hash)
        for field_name, (old_val, new_val) in diff.items():
            self.change_log.append(ChangeLogEntry(
                timestamp=self.updated_at,
                operator=operator,
                field_changed=field_name,
                old_value=str(old_val),
                new_value=str(new_val),
                reason=reason,
            ))
        return diff

    @staticmethod
    def _diff_materials(old: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Any]:
        diff = {}
        for key in old.keys() & new.keys():
            if key == "units":
                for i, (o, n) in enumerate(zip(old[key], new[key])):
                    for uk in o.keys() & n.keys():
                        if o[uk] != n[uk]:
                            diff[f"units[{i}].{uk}"] = (o[uk], n[uk])
            elif key == "turn_order":
                if old[key] != new[key]:
                    diff["turn_order"] = (old[key], new[key])
            elif key == "special_rules":
                if sorted(old[key]) != sorted(new[key]):
                    diff["special_rules"] = (old[key], new[key])
            elif key not in ["material_id", "version", "content_hash"]:
                if old[key] != new[key]:
                    diff[key] = (old[key], new[key])
        return diff

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "material": self.material.to_dict(),
            "result": self.result.to_dict() if self.result else None,
            "status": self.status,
            "operator": self.operator,
            "pending_reason": self.pending_reason,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "change_log": [c.to_dict() for c in self.change_log],
            "material_hash_history": self.material_hash_history,
            "notes": self.notes,
        }
