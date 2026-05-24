from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Any
from enum import Enum
from datetime import datetime


class RiskLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class DriftType(str, Enum):
    HOSTNAME_MISMATCH = "hostname_mismatch"
    ROLE_MISMATCH = "role_mismatch"
    ENVIRONMENT_MISMATCH = "environment_mismatch"
    MISSING_IN_CMDB = "missing_in_cmdb"
    MISSING_IN_INVENTORY = "missing_in_inventory"
    LABEL_MISMATCH = "label_mismatch"
    ALIAS_CONFLICT = "alias_conflict"
    DECOMMISSIONED_STILL_PRESENT = "decommissioned_still_present"
    GROUP_INHERITANCE_ISSUE = "group_inheritance_issue"


@dataclass
class Host:
    hostname: str
    roles: List[str] = field(default_factory=list)
    environment: Optional[str] = None
    labels: Dict[str, str] = field(default_factory=dict)
    groups: List[str] = field(default_factory=list)
    aliases: List[str] = field(default_factory=list)
    ip_address: Optional[str] = None
    is_decommissioned: bool = False
    source: str = ""
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def get_all_names(self) -> Set[str]:
        names = {self.hostname.lower()}
        names.update(a.lower() for a in self.aliases)
        if self.ip_address:
            names.add(self.ip_address)
        return names

    def normalized_roles(self) -> Set[str]:
        return {r.strip().lower() for r in self.roles if r.strip()}

    def normalized_labels(self) -> Dict[str, str]:
        return {k.strip().lower(): v.strip().lower() for k, v in self.labels.items() if k.strip()}


@dataclass
class InventoryGroup:
    name: str
    hosts: List[str] = field(default_factory=list)
    children: List[str] = field(default_factory=list)
    vars: Dict[str, Any] = field(default_factory=dict)
    parent_groups: List[str] = field(default_factory=list)


@dataclass
class ParsedInventory:
    hosts: Dict[str, Host] = field(default_factory=dict)
    groups: Dict[str, InventoryGroup] = field(default_factory=dict)
    all_hosts: Set[str] = field(default_factory=set)
    source_file: str = ""

    def get_host_by_any_name(self, name: str) -> Optional[Host]:
        name_lower = name.lower()
        for host in self.hosts.values():
            if name_lower in host.get_all_names():
                return host
        return None


@dataclass
class DriftItem:
    drift_type: DriftType
    host: str
    risk_level: RiskLevel
    inventory_value: Optional[Any] = None
    cmdb_value: Optional[Any] = None
    description: str = ""
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DriftReport:
    inventory_file: str
    cmdb_file: Optional[str]
    generated_at: datetime
    total_hosts_inventory: int
    total_hosts_cmdb: int
    drift_items: List[DriftItem] = field(default_factory=list)
    summary: Dict[str, int] = field(default_factory=dict)
    risk_summary: Dict[RiskLevel, int] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)

    def calculate_summaries(self):
        self.summary = {}
        self.risk_summary = {}
        for item in self.drift_items:
            self.summary[item.drift_type.value] = self.summary.get(item.drift_type.value, 0) + 1
            self.risk_summary[item.risk_level] = self.risk_summary.get(item.risk_level, 0) + 1

    def get_highest_risk(self) -> Optional[RiskLevel]:
        if not self.risk_summary:
            return None
        order = [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW, RiskLevel.INFO]
        for level in order:
            if self.risk_summary.get(level, 0) > 0:
                return level
        return None
