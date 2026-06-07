from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List


@dataclass
class DesensitizationRemark:
    id: str
    work_order_id: str
    remark_content: str
    owner: str
    create_time: datetime
    update_time: Optional[datetime] = None
    tags: List[str] = field(default_factory=list)
    is_important: bool = False
    related_rules: List[str] = field(default_factory=list)
    reviewer: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "work_order_id": self.work_order_id,
            "remark_content": self.remark_content,
            "owner": self.owner,
            "create_time": self.create_time.isoformat(),
            "update_time": self.update_time.isoformat() if self.update_time else None,
            "tags": self.tags,
            "is_important": self.is_important,
            "related_rules": self.related_rules,
            "reviewer": self.reviewer,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "DesensitizationRemark":
        return cls(
            id=data["id"],
            work_order_id=data["work_order_id"],
            remark_content=data["remark_content"],
            owner=data["owner"],
            create_time=datetime.fromisoformat(data["create_time"]),
            update_time=datetime.fromisoformat(data["update_time"]) if data.get("update_time") else None,
            tags=data.get("tags", []),
            is_important=data.get("is_important", False),
            related_rules=data.get("related_rules", []),
            reviewer=data.get("reviewer"),
        )
