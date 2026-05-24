from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union


class SchemaChangeType(str, Enum):
    FIELD_ADDED = "field_added"
    FIELD_REMOVED = "field_removed"
    FIELD_RENAMED = "field_renamed"
    TYPE_CHANGED = "type_changed"
    NULLABLE_CHANGED = "nullable_changed"
    DECIMAL_PRECISION_CHANGED = "decimal_precision_changed"
    NESTED_STRUCTURE_CHANGED = "nested_structure_changed"


class CompatibilityLevel(str, Enum):
    FULLY_COMPATIBLE = "fully_compatible"
    FORWARD_COMPATIBLE = "forward_compatible"
    BACKWARD_COMPATIBLE = "backward_compatible"
    INCOMPATIBLE = "incompatible"


@dataclass
class DecimalInfo:
    precision: int
    scale: int


@dataclass
class FieldSchema:
    name: str
    path: str
    data_type: str
    nullable: bool
    is_struct: bool = False
    is_list: bool = False
    is_map: bool = False
    children: List[FieldSchema] = field(default_factory=list)
    decimal_info: Optional[DecimalInfo] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    original_type: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "name": self.name,
            "path": self.path,
            "data_type": self.data_type,
            "nullable": self.nullable,
            "is_struct": self.is_struct,
            "is_list": self.is_list,
            "is_map": self.is_map,
        }
        if self.decimal_info:
            result["decimal_info"] = {
                "precision": self.decimal_info.precision,
                "scale": self.decimal_info.scale,
            }
        if self.children:
            result["children"] = [child.to_dict() for child in self.children]
        if self.metadata:
            result["metadata"] = self.metadata
        if self.original_type:
            result["original_type"] = self.original_type
        return result


@dataclass
class SchemaSnapshot:
    source: str
    created_at: datetime
    fields: List[FieldSchema]
    partition_info: Optional[Dict[str, Any]] = None
    row_count: Optional[int] = None
    file_count: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source": self.source,
            "created_at": self.created_at.isoformat(),
            "fields": [f.to_dict() for f in self.fields],
            "partition_info": self.partition_info,
            "row_count": self.row_count,
            "file_count": self.file_count,
        }


@dataclass
class SchemaChange:
    change_type: SchemaChangeType
    field_path: str
    description: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    severity: str = "info"
    compatibility_impact: str = "none"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "change_type": self.change_type.value,
            "field_path": self.field_path,
            "description": self.description,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "severity": self.severity,
            "compatibility_impact": self.compatibility_impact,
        }


@dataclass
class EvolutionReport:
    task_name: str
    created_at: datetime
    old_schema: SchemaSnapshot
    new_schema: SchemaSnapshot
    changes: List[SchemaChange]
    compatibility_level: CompatibilityLevel
    summary: Dict[str, int] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_name": self.task_name,
            "created_at": self.created_at.isoformat(),
            "old_schema": self.old_schema.to_dict(),
            "new_schema": self.new_schema.to_dict(),
            "changes": [c.to_dict() for c in self.changes],
            "compatibility_level": self.compatibility_level.value,
            "summary": self.summary,
            "recommendations": self.recommendations,
        }
