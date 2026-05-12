from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Optional, Dict, List, Any
from enum import Enum
import uuid


class ResourceStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ProjectStatus(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class BillStatus(Enum):
    RAW = "raw"
    IMPORTED = "imported"
    FIXED = "fixed"
    UNASSIGNED = "unassigned"
    INACTIVE_PROJECT = "inactive_project"


@dataclass
class Tag:
    project: Optional[str] = None
    env: Optional[str] = None
    owner: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "project": self.project,
            "env": self.env,
            "owner": self.owner
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Tag":
        return cls(
            project=data.get("project"),
            env=data.get("env"),
            owner=data.get("owner")
        )

    def is_complete(self) -> bool:
        return all([self.project, self.env, self.owner])

    def diff(self, other: "Tag") -> Dict[str, Dict[str, Any]]:
        changes = {}
        for field_name in ["project", "env", "owner"]:
            old_val = getattr(self, field_name)
            new_val = getattr(other, field_name)
            if old_val != new_val:
                changes[field_name] = {
                    "before": old_val,
                    "after": new_val
                }
        return changes


@dataclass
class CloudBill:
    bill_id: str
    resource_id: str
    resource_type: str
    cost: float
    currency: str
    billing_period: str
    billing_date: str
    provider: str
    raw_tags: Tag
    fixed_tags: Optional[Tag] = None
    status: BillStatus = BillStatus.RAW
    is_manual_fix: bool = False
    import_batch_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    last_operator: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "bill_id": self.bill_id,
            "resource_id": self.resource_id,
            "resource_type": self.resource_type,
            "cost": self.cost,
            "currency": self.currency,
            "billing_period": self.billing_period,
            "billing_date": self.billing_date,
            "provider": self.provider,
            "raw_tags": self.raw_tags.to_dict(),
            "fixed_tags": self.fixed_tags.to_dict() if self.fixed_tags else None,
            "status": self.status.value,
            "is_manual_fix": self.is_manual_fix,
            "import_batch_id": self.import_batch_id,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "last_operator": self.last_operator
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CloudBill":
        return cls(
            bill_id=data["bill_id"],
            resource_id=data["resource_id"],
            resource_type=data["resource_type"],
            cost=data["cost"],
            currency=data["currency"],
            billing_period=data["billing_period"],
            billing_date=data["billing_date"],
            provider=data["provider"],
            raw_tags=Tag.from_dict(data["raw_tags"]),
            fixed_tags=Tag.from_dict(data["fixed_tags"]) if data.get("fixed_tags") else None,
            status=BillStatus(data["status"]),
            is_manual_fix=data.get("is_manual_fix", False),
            import_batch_id=data.get("import_batch_id"),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            last_operator=data.get("last_operator")
        )

    def effective_tags(self) -> Tag:
        return self.fixed_tags if self.fixed_tags else self.raw_tags

    def get_project(self) -> Optional[str]:
        return self.effective_tags().project


@dataclass
class Resource:
    resource_id: str
    resource_type: str
    provider: str
    tags: Tag
    status: ResourceStatus = ResourceStatus.ACTIVE
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "resource_id": self.resource_id,
            "resource_type": self.resource_type,
            "provider": self.provider,
            "tags": self.tags.to_dict(),
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Resource":
        return cls(
            resource_id=data["resource_id"],
            resource_type=data["resource_type"],
            provider=data["provider"],
            tags=Tag.from_dict(data["tags"]),
            status=ResourceStatus(data.get("status", "active")),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"])
        )


@dataclass
class TagStrategy:
    strategy_id: str
    name: str
    description: str
    resource_type_pattern: str
    tag_rules: Dict[str, Any]
    priority: int = 0
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "strategy_id": self.strategy_id,
            "name": self.name,
            "description": self.description,
            "resource_type_pattern": self.resource_type_pattern,
            "tag_rules": self.tag_rules,
            "priority": self.priority,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TagStrategy":
        return cls(
            strategy_id=data["strategy_id"],
            name=data["name"],
            description=data["description"],
            resource_type_pattern=data["resource_type_pattern"],
            tag_rules=data["tag_rules"],
            priority=data.get("priority", 0),
            is_active=data.get("is_active", True),
            created_at=datetime.fromisoformat(data["created_at"])
        )


@dataclass
class OwnerMapping:
    owner_id: str
    name: str
    email: str
    projects: List[str]
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "owner_id": self.owner_id,
            "name": self.name,
            "email": self.email,
            "projects": self.projects,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "OwnerMapping":
        return cls(
            owner_id=data["owner_id"],
            name=data["name"],
            email=data["email"],
            projects=data["projects"],
            is_active=data.get("is_active", True),
            created_at=datetime.fromisoformat(data["created_at"])
        )


@dataclass
class Project:
    project_id: str
    name: str
    code: str
    status: ProjectStatus = ProjectStatus.ACTIVE
    description: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "project_id": self.project_id,
            "name": self.name,
            "code": self.code,
            "status": self.status.value,
            "description": self.description,
            "created_at": self.created_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Project":
        return cls(
            project_id=data["project_id"],
            name=data["name"],
            code=data["code"],
            status=ProjectStatus(data.get("status", "active")),
            description=data.get("description"),
            created_at=datetime.fromisoformat(data["created_at"])
        )


@dataclass
class ImportBatch:
    batch_id: str
    import_type: str
    file_name: str
    record_count: int
    success_count: int
    fail_count: int
    status: str
    errors: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    completed_at: Optional[datetime] = None
    operator: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "import_type": self.import_type,
            "file_name": self.file_name,
            "record_count": self.record_count,
            "success_count": self.success_count,
            "fail_count": self.fail_count,
            "status": self.status,
            "errors": self.errors,
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "operator": self.operator
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ImportBatch":
        return cls(
            batch_id=data["batch_id"],
            import_type=data["import_type"],
            file_name=data["file_name"],
            record_count=data["record_count"],
            success_count=data["success_count"],
            fail_count=data["fail_count"],
            status=data["status"],
            errors=data.get("errors", []),
            created_at=datetime.fromisoformat(data["created_at"]),
            completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None,
            operator=data.get("operator")
        )


@dataclass
class HistoryRecord:
    record_id: str
    bill_id: str
    action: str
    before: Optional[Dict[str, Any]] = None
    after: Optional[Dict[str, Any]] = None
    changes: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    operator: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "bill_id": self.bill_id,
            "action": self.action,
            "before": self.before,
            "after": self.after,
            "changes": self.changes,
            "reason": self.reason,
            "operator": self.operator,
            "created_at": self.created_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "HistoryRecord":
        return cls(
            record_id=data["record_id"],
            bill_id=data["bill_id"],
            action=data["action"],
            before=data.get("before"),
            after=data.get("after"),
            changes=data.get("changes"),
            reason=data.get("reason"),
            operator=data.get("operator"),
            created_at=datetime.fromisoformat(data["created_at"])
        )


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}" if prefix else uuid.uuid4().hex[:12]
