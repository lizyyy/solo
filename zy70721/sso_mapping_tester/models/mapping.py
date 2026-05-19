from dataclasses import dataclass, field
from typing import Optional, Dict, Any, Callable
from enum import Enum


class MappingType(Enum):
    DIRECT = "direct"
    TRANSFORM = "transform"
    CONSTANT = "constant"
    CONDITIONAL = "conditional"


class ValidationRule(Enum):
    REQUIRED = "required"
    EMAIL = "email"
    NOT_EMPTY = "not_empty"
    UNIQUE = "unique"
    PATTERN = "pattern"


@dataclass
class MappingRule:
    source_field: str
    target_field: str
    mapping_type: MappingType
    transform_expression: Optional[str] = None
    constant_value: Any = None
    validation_rules: list[ValidationRule] = field(default_factory=list)
    pattern: Optional[str] = None
    condition: Optional[str] = None
    source_file: str = ""
    line_number: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_field": self.source_field,
            "target_field": self.target_field,
            "mapping_type": self.mapping_type.value,
            "transform_expression": self.transform_expression,
            "constant_value": self.constant_value,
            "validation_rules": [r.value for r in self.validation_rules],
            "pattern": self.pattern,
            "condition": self.condition,
            "source_file": self.source_file,
            "line_number": self.line_number,
        }


@dataclass
class AttributeMapping:
    name: str
    rules: list[MappingRule]
    source_file: str
    description: Optional[str] = None
    created_at: Optional[str] = None

    def get_rule_for_target(self, target_field: str) -> Optional[MappingRule]:
        for rule in self.rules:
            if rule.target_field == target_field:
                return rule
        return None

    def get_rule_for_source(self, source_field: str) -> Optional[MappingRule]:
        for rule in self.rules:
            if rule.source_field == source_field:
                return rule
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "rules": [r.to_dict() for r in self.rules],
            "source_file": self.source_file,
            "description": self.description,
            "created_at": self.created_at,
        }
