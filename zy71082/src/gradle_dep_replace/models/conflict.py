from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from .dependency import DependencyCoordinate


class ConflictType(str, Enum):
    VERSION_CONFLICT = "version_conflict"
    PLUGIN_VERSION_CONFLICT = "plugin_version_conflict"
    BOM_CONFLICT = "bom_conflict"
    DUPLICATE_DECLARATION = "duplicate_declaration"
    DYNAMIC_VERSION = "dynamic_version"
    REPLACEMENT_CYCLE = "replacement_cycle"
    CROSS_SOURCE_CONFLICT = "cross_source_conflict"


class ConflictSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class Conflict(BaseModel):
    id: str
    type: ConflictType
    severity: ConflictSeverity
    message: str
    dependencies: List[DependencyCoordinate] = Field(default_factory=list)
    source_files: List[str] = Field(default_factory=list)
    suggestion: Optional[str] = None
    resolution: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "severity": self.severity.value,
            "message": self.message,
            "dependencies": [d.to_dict() for d in self.dependencies],
            "source_files": self.source_files,
            "suggestion": self.suggestion,
            "resolution": self.resolution,
        }
