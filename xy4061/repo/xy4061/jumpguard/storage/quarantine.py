import os
import json
from datetime import datetime
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any, Set


@dataclass
class QuarantineItem:
    rule_id: str
    severity: str
    category: str
    description: str
    affected_entity: str
    entity_type: str
    evidence: Dict[str, Any]
    discovered_at: str
    is_remediated: bool = False
    remediation_action: Optional[str] = None
    remediation_plan: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_id": self.rule_id,
            "severity": self.severity,
            "category": self.category,
            "description": self.description,
            "affected_entity": self.affected_entity,
            "entity_type": self.entity_type,
            "evidence": self.evidence,
            "discovered_at": self.discovered_at,
            "is_remediated": self.is_remediated,
            "remediation_action": self.remediation_action,
            "remediation_plan": self.remediation_plan,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "QuarantineItem":
        return cls(
            rule_id=data.get("rule_id", ""),
            severity=data.get("severity", "medium"),
            category=data.get("category", ""),
            description=data.get("description", ""),
            affected_entity=data.get("affected_entity", ""),
            entity_type=data.get("entity_type", ""),
            evidence=data.get("evidence", {}),
            discovered_at=data.get("discovered_at", datetime.now().isoformat()),
            is_remediated=data.get("is_remediated", False),
            remediation_action=data.get("remediation_action"),
            remediation_plan=data.get("remediation_plan"),
        )


class QuarantineManager:
    QUARANTINE_FILENAME = "quarantine.json"

    RULE_ORPHAN_ACCOUNT = "orphan_account"
    RULE_GROUP_DRIFT = "group_drift"
    RULE_SUDO_OVERREACH = "sudo_overreach"
    RULE_ASSET_ENV_MISMATCH = "asset_env_mismatch"
    RULE_DUPLICATE_ACCOUNT = "duplicate_account"
    RULE_BAD_ROW = "bad_row"

    CATEGORY_ACCOUNT = "account"
    CATEGORY_GROUP = "group"
    CATEGORY_SUDO = "sudo"
    CATEGORY_ASSET = "asset"
    CATEGORY_DATA_QUALITY = "data_quality"

    RULE_TO_CATEGORY = {
        RULE_ORPHAN_ACCOUNT: CATEGORY_ACCOUNT,
        RULE_GROUP_DRIFT: CATEGORY_GROUP,
        RULE_SUDO_OVERREACH: CATEGORY_SUDO,
        RULE_ASSET_ENV_MISMATCH: CATEGORY_ASSET,
        RULE_DUPLICATE_ACCOUNT: CATEGORY_ACCOUNT,
        RULE_BAD_ROW: CATEGORY_DATA_QUALITY,
    }

    def __init__(self, state_dir: str):
        self.state_dir = os.path.abspath(state_dir)
        self._items: List[QuarantineItem] = []

    def _ensure_dir(self) -> None:
        os.makedirs(self.state_dir, exist_ok=True)

    @property
    def items(self) -> List[QuarantineItem]:
        if not self._items:
            self._load()
        return self._items

    def add_item(
        self,
        rule_id: str,
        severity: str,
        description: str,
        affected_entity: str,
        entity_type: str,
        evidence: Dict[str, Any],
    ) -> QuarantineItem:
        item = QuarantineItem(
            rule_id=rule_id,
            severity=severity,
            category=self.RULE_TO_CATEGORY.get(rule_id, "unknown"),
            description=description,
            affected_entity=affected_entity,
            entity_type=entity_type,
            evidence=evidence,
            discovered_at=datetime.now().isoformat(),
        )
        self._items.append(item)
        return item

    def add_items(self, items: List[QuarantineItem]) -> None:
        self._items.extend(items)

    def save(self) -> None:
        self._ensure_dir()
        quarantine_path = os.path.join(self.state_dir, self.QUARANTINE_FILENAME)
        
        data = {
            "items": [item.to_dict() for item in self._items],
            "generated_at": datetime.now().isoformat(),
            "total_count": len(self._items),
            "stats": self._calculate_stats(),
        }

        with open(quarantine_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load(self) -> None:
        quarantine_path = os.path.join(self.state_dir, self.QUARANTINE_FILENAME)
        
        if not os.path.exists(quarantine_path):
            self._items = []
            return

        with open(quarantine_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self._items = [QuarantineItem.from_dict(i) for i in data.get("items", [])]

    def _calculate_stats(self) -> Dict[str, Any]:
        stats = {
            "by_severity": {"critical": 0, "high": 0, "medium": 0, "low": 0},
            "by_category": {},
            "by_rule": {},
            "remediated": 0,
            "pending": 0,
        }

        for item in self._items:
            stats["by_severity"][item.severity] = stats["by_severity"].get(item.severity, 0) + 1
            
            stats["by_category"][item.category] = stats["by_category"].get(item.category, 0) + 1
            
            stats["by_rule"][item.rule_id] = stats["by_rule"].get(item.rule_id, 0) + 1
            
            if item.is_remediated:
                stats["remediated"] += 1
            else:
                stats["pending"] += 1

        return stats

    def get_items_by_rule(self, rule_id: str) -> List[QuarantineItem]:
        return [i for i in self.items if i.rule_id == rule_id]

    def get_items_by_severity(self, severity: str) -> List[QuarantineItem]:
        return [i for i in self.items if i.severity == severity]

    def get_items_by_category(self, category: str) -> List[QuarantineItem]:
        return [i for i in self.items if i.category == category]

    def get_pending_items(self) -> List[QuarantineItem]:
        return [i for i in self.items if not i.is_remediated]

    def get_unique_entities(self) -> Set[str]:
        return {i.affected_entity for i in self.items}

    def mark_remediated(self, index: int, action: str) -> bool:
        if 0 <= index < len(self._items):
            self._items[index].is_remediated = True
            self._items[index].remediation_action = action
            return True
        return False

    def clear(self) -> None:
        self._items = []

    def get_stats(self) -> Dict[str, Any]:
        self._load()
        return self._calculate_stats()
