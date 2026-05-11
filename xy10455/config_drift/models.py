from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class DiffType(Enum):
    ADDED = "added"
    REMOVED = "removed"
    TYPE_CHANGED = "type_changed"
    VALUE_CHANGED = "value_changed"
    SENSITIVE_SWITCH = "sensitive_switch"
    EXPIRED_OVERRIDE = "expired_override"


class RiskLevel(Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class ConfigDiff:
    key: str
    diff_type: DiffType
    default_value: Any
    tenant_value: Any
    default_type: Optional[str] = None
    tenant_type: Optional[str] = None
    is_sensitive: bool = False
    description: str = ""
    risk_level: RiskLevel = RiskLevel.MEDIUM
    source_file: Optional[str] = None

    @property
    def needs_attention(self) -> bool:
        return self.risk_level in (RiskLevel.HIGH, RiskLevel.MEDIUM)


@dataclass
class DriftAllowance:
    tenant_id: str
    key: str
    approved_by: str
    approval_date: datetime
    expiry_date: datetime
    reason: str
    is_expired: bool = False

    def check_expired(self, reference_date: Optional[datetime] = None) -> bool:
        ref = reference_date or datetime.now()
        self.is_expired = ref > self.expiry_date
        return self.is_expired


@dataclass
class TenantConfig:
    tenant_id: str
    tier: str
    config: Dict[str, Any]
    source_files: Dict[str, str] = field(default_factory=dict)
    duplicate_keys: List[str] = field(default_factory=list)
    parse_errors: List[str] = field(default_factory=list)

    @property
    def has_errors(self) -> bool:
        return len(self.duplicate_keys) > 0 or len(self.parse_errors) > 0


@dataclass
class TenantReport:
    tenant: TenantConfig
    diffs: List[ConfigDiff]
    allowances: List[DriftAllowance] = field(default_factory=list)
    unresolved_diffs: List[ConfigDiff] = field(default_factory=list)

    @property
    def has_critical_issues(self) -> bool:
        for d in self.unresolved_diffs:
            if d.risk_level == RiskLevel.HIGH:
                return True
        return len(self.tenant.duplicate_keys) > 0 or len(self.tenant.parse_errors) > 0


@dataclass
class PublishRiskReport:
    generated_at: datetime
    total_tenants: int
    tenants_with_critical_issues: int
    tenants_with_warnings: int
    tenants_ok: int
    tenant_reports: List[TenantReport]
    all_critical_issues: List[str]
