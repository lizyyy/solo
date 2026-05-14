from datetime import datetime
from enum import Enum
from typing import Callable, Dict, Any, Optional, List
from pydantic import BaseModel, Field


class RuleType(str, Enum):
    URL_CHECK = "url_check"
    PATTERN_MATCH = "pattern_match"
    CUSTOM = "custom"


class RuleSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class Rule(BaseModel):
    rule_id: str
    name: str
    version: str = Field(default="1.0.0")
    type: RuleType
    severity: RuleSeverity = RuleSeverity.ERROR
    description: str = ""
    created_at: datetime = Field(default_factory=datetime.now)
    config: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True
    
    def get_version_key(self) -> str:
        return f"{self.rule_id}:{self.version}"


class RuleSet(BaseModel):
    set_id: str
    name: str
    version: str = Field(default="1.0.0")
    description: str = ""
    rules: List[Rule] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    
    def get_version_key(self) -> str:
        return f"{self.set_id}:v{self.version}"
    
    def get_rule_versions(self) -> Dict[str, str]:
        return {rule.rule_id: rule.version for rule in self.rules if rule.enabled}
    
    def add_rule(self, rule: Rule) -> None:
        self.rules.append(rule)
    
    def get_enabled_rules(self) -> List[Rule]:
        return [r for r in self.rules if r.enabled]
