import copy
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from .evidence import EvidenceRecord, ProcessingStatus


@dataclass
class DiffItem:
    business_no: str
    expected_amount: float
    actual_amount: float
    diff_amount: float
    diff_type: str
    evidence_records: List[EvidenceRecord] = field(default_factory=list)
    needs_supervisor_review: bool = False
    supervisor_review_reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "business_no": self.business_no,
            "expected_amount": self.expected_amount,
            "actual_amount": self.actual_amount,
            "diff_amount": self.diff_amount,
            "diff_type": self.diff_type,
            "evidence_records": [r.to_dict() for r in self.evidence_records],
            "needs_supervisor_review": self.needs_supervisor_review,
            "supervisor_review_reason": self.supervisor_review_reason,
        }


@dataclass
class DiffListVersion:
    version: int
    items: List[DiffItem] = field(default_factory=list)
    snapshot: str = field(default_factory=lambda: datetime.now().isoformat())
    trigger: str = ""
    operator: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "version": self.version,
            "items": [item.to_dict() for item in self.items],
            "snapshot": self.snapshot,
            "trigger": self.trigger,
            "operator": self.operator,
        }


@dataclass
class DiffList:
    diff_list_id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    current_version: int = 0
    versions: List[DiffListVersion] = field(default_factory=list)

    def _deep_copy_items(self, items: List[DiffItem]) -> List[DiffItem]:
        return copy.deepcopy(items)

    def _current_items(self) -> List[DiffItem]:
        if self.versions:
            return self.versions[-1].items
        return []

    def commit(
        self,
        items: List[DiffItem],
        trigger: str,
        operator: str,
    ) -> DiffListVersion:
        new_version_num = self.current_version + 1
        version = DiffListVersion(
            version=new_version_num,
            items=self._deep_copy_items(items),
            trigger=trigger,
            operator=operator,
        )
        self.versions.append(version)
        self.current_version = new_version_num
        return version

    def rollback(self, target_version: int) -> Optional[DiffListVersion]:
        if target_version < 1 or target_version >= len(self.versions):
            return None
        target = self.versions[target_version - 1]
        restored_items = self._deep_copy_items(target.items)
        rollback_version = DiffListVersion(
            version=self.current_version + 1,
            items=restored_items,
            trigger=f"rollback_to_v{target_version}",
            operator="system",
        )
        self.versions.append(rollback_version)
        self.current_version = rollback_version.version
        return rollback_version

    def to_dict(self) -> Dict[str, Any]:
        return {
            "diff_list_id": self.diff_list_id,
            "current_version": self.current_version,
            "versions": [v.to_dict() for v in self.versions],
        }
