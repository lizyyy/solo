from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional


@dataclass
class ParameterVersion:
    version: str
    description: str
    params: Dict[str, float]
    created_at: datetime = field(default_factory=datetime.now)
    is_active: bool = False

    def to_dict(self) -> dict:
        return {
            "version": self.version,
            "description": self.description,
            "params": self.params,
            "created_at": self.created_at.isoformat(),
            "is_active": self.is_active,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ParameterVersion":
        return cls(
            version=data["version"],
            description=data["description"],
            params=data["params"],
            created_at=datetime.fromisoformat(data["created_at"]),
            is_active=data.get("is_active", False),
        )


@dataclass
class ParameterTable:
    versions: List[ParameterVersion] = field(default_factory=list)

    def add_version(self, version: ParameterVersion) -> None:
        self.versions.append(version)
        self.versions.sort(key=lambda v: v.created_at, reverse=True)

    def get_active_version(self) -> Optional[ParameterVersion]:
        for v in self.versions:
            if v.is_active:
                return v
        return None

    def get_version(self, version: str) -> Optional[ParameterVersion]:
        for v in self.versions:
            if v.version == version:
                return v
        return None

    def activate_version(self, version: str) -> bool:
        for v in self.versions:
            v.is_active = False
            if v.version == version:
                v.is_active = True
                return True
        return False

    def to_dict(self) -> dict:
        return {"versions": [v.to_dict() for v in self.versions]}

    @classmethod
    def from_dict(cls, data: dict) -> "ParameterTable":
        table = cls()
        for v_data in data.get("versions", []):
            table.versions.append(ParameterVersion.from_dict(v_data))
        return table
