from dataclasses import dataclass
from typing import List, Optional
from datetime import datetime


@dataclass
class Owner:
    owner_id: str
    name: str
    email: str
    department: str
    roles: List[str]
    is_active: bool
    last_active: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: dict) -> "Owner":
        return cls(
            owner_id=data["owner_id"],
            name=data["name"],
            email=data["email"],
            department=data["department"],
            roles=data.get("roles", []),
            is_active=data.get("is_active", True),
            last_active=datetime.fromisoformat(data["last_active"]) if data.get("last_active") else None,
        )

    def to_dict(self) -> dict:
        return {
            "owner_id": self.owner_id,
            "name": self.name,
            "email": self.email,
            "department": self.department,
            "roles": self.roles,
            "is_active": self.is_active,
            "last_active": self.last_active.isoformat() if self.last_active else None,
        }
