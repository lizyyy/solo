from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, List, Dict, Any, Pattern
import re


class RuleStatus(str, Enum):
    ACTIVE = "active"
    DRAFT = "draft"
    DEPRECATED = "deprecated"


class RuleType(str, Enum):
    PHONE = "phone"
    ID_CARD = "id_card"
    BANK_CARD = "bank_card"
    EMAIL = "email"
    CUSTOM = "custom"


@dataclass
class MaskRule:
    rule_id: str
    rule_type: RuleType
    rule_name: str
    pattern: str
    mask_template: str
    status: RuleStatus = RuleStatus.ACTIVE
    description: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    created_by: str = "system"
    priority: int = 0
    field_restriction: Optional[List[str]] = None
    compiled_pattern: Optional[Pattern] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        if self.compiled_pattern is None:
            self.compiled_pattern = re.compile(self.pattern)

    def apply_mask(self, text: str) -> str:
        if not self.compiled_pattern:
            self.compiled_pattern = re.compile(self.pattern)
        return self.compiled_pattern.sub(self.mask_template, text)

    def matches(self, text: str) -> bool:
        if not self.compiled_pattern:
            self.compiled_pattern = re.compile(self.pattern)
        return bool(self.compiled_pattern.search(text))

    def find_all_matches(self, text: str) -> List[str]:
        if not self.compiled_pattern:
            self.compiled_pattern = re.compile(self.pattern)
        return self.compiled_pattern.findall(text)
