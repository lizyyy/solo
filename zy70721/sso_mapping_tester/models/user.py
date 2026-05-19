from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from datetime import datetime


@dataclass
class IdentitySourceUser:
    source_id: str
    raw_data: Dict[str, Any]
    source_file: str
    line_number: int
    parsed_at: datetime = field(default_factory=datetime.now)

    def get(self, key: str, default: Any = None) -> Any:
        return self.raw_data.get(key, default)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_id": self.source_id,
            "raw_data": self.raw_data,
            "source_file": self.source_file,
            "line_number": self.line_number,
        }


@dataclass
class TestUser:
    user_id: str
    expected_attributes: Dict[str, Any]
    expected_roles: list
    source_file: str
    line_number: int
    description: Optional[str] = None
    tags: list = field(default_factory=list)

    def get_expected(self, key: str, default: Any = None) -> Any:
        return self.expected_attributes.get(key, default)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "expected_attributes": self.expected_attributes,
            "expected_roles": self.expected_roles,
            "source_file": self.source_file,
            "line_number": self.line_number,
            "description": self.description,
            "tags": self.tags,
        }
