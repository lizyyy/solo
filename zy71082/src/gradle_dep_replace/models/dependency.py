from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class DependencyType(str, Enum):
    LIBRARY = "library"
    PLUGIN = "plugin"
    PLATFORM = "platform"
    BOM = "bom"
    BUNDLE = "bundle"


class DependencyCoordinate(BaseModel):
    group: Optional[str] = None
    name: str
    version: Optional[str] = None
    type: DependencyType = DependencyType.LIBRARY
    configuration: Optional[str] = None
    source_file: Optional[str] = None
    source_line: Optional[int] = None
    is_dynamic_version: bool = False
    is_managed: bool = False

    @field_validator("version")
    @classmethod
    def check_dynamic_version(cls, v: Optional[str]) -> Optional[str]:
        if v:
            dynamic_patterns = ["+", "(", ")", "[", "]"]
            if any(pattern in v for pattern in dynamic_patterns):
                return v
        return v

    @property
    def is_dynamic(self) -> bool:
        if not self.version:
            return False
        dynamic_patterns = ["+", "(", ")", "[", "]"]
        return any(pattern in self.version for pattern in dynamic_patterns)

    @property
    def canonical_name(self) -> str:
        if self.group:
            return f"{self.group}:{self.name}"
        return self.name

    @property
    def full_coordinate(self) -> str:
        parts = []
        if self.group:
            parts.append(self.group)
        parts.append(self.name)
        if self.version:
            parts.append(self.version)
        return ":".join(parts)

    @classmethod
    def parse(cls, coordinate: str, source_file: Optional[str] = None) -> "DependencyCoordinate":
        parts = coordinate.split(":")
        group = None
        name = parts[0]
        version = None

        if len(parts) >= 2:
            group = parts[0]
            name = parts[1]
        if len(parts) >= 3:
            version = ":".join(parts[2:])

        is_dynamic = False
        if version:
            dynamic_patterns = ["+", "(", ")", "[", "]"]
            is_dynamic = any(pattern in version for pattern in dynamic_patterns)

        return cls(
            group=group,
            name=name,
            version=version,
            source_file=source_file,
            is_dynamic_version=is_dynamic,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "group": self.group,
            "name": self.name,
            "version": self.version,
            "type": self.type.value,
            "configuration": self.configuration,
            "source_file": self.source_file,
            "source_line": self.source_line,
            "is_dynamic_version": self.is_dynamic_version,
            "is_managed": self.is_managed,
            "canonical_name": self.canonical_name,
            "full_coordinate": self.full_coordinate,
        }

    def __hash__(self) -> int:
        return hash((self.group, self.name, self.version, self.type))

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, DependencyCoordinate):
            return False
        return (
            self.group == other.group
            and self.name == other.name
            and self.version == other.version
            and self.type == other.type
        )

    def __str__(self) -> str:
        return self.full_coordinate
