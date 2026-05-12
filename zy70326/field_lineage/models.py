from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Any
from enum import Enum
from datetime import datetime


class DependencyType(Enum):
    DIRECT = "direct"
    INDIRECT = "indirect"


class NodeType(Enum):
    TABLE_FIELD = "table_field"
    SQL_TASK = "sql_task"
    REPORT = "report"
    API = "api"


@dataclass
class TableField:
    id: str
    table_name: str
    field_name: str
    description: str = ""
    database: str = "default"
    
    @property
    def full_name(self) -> str:
        return f"{self.database}.{self.table_name}.{self.field_name}"


@dataclass
class SQLTask:
    id: str
    name: str
    sql: str
    owner: str = ""
    target_table: str = ""
    target_fields: List[str] = field(default_factory=list)
    created_at: Optional[datetime] = None
    parse_error: Optional[str] = None


@dataclass
class Report:
    id: str
    name: str
    fields: List[str] = field(default_factory=list)
    derived_fields: Dict[str, str] = field(default_factory=dict)
    owner: str = ""
    dashboard: str = ""


@dataclass
class APIEndpoint:
    id: str
    name: str
    field_mappings: Dict[str, str] = field(default_factory=dict)
    owner: str = ""
    path: str = ""


@dataclass
class Owner:
    id: str
    name: str
    email: str = ""
    team: str = ""


@dataclass
class Confirmation:
    node_id: str
    node_type: NodeType
    confirmed: bool
    confirmed_at: Optional[datetime] = None
    confirmed_by: str = ""
    notes: str = ""


@dataclass
class DependencyNode:
    id: str
    node_type: NodeType
    name: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DependencyEdge:
    source: str
    target: str
    dependency_type: DependencyType
    description: str = ""


@dataclass
class ImpactResult:
    target_field: str
    direct_dependencies: List[DependencyNode] = field(default_factory=list)
    indirect_dependencies: List[DependencyNode] = field(default_factory=dict)
    owners_affected: List[str] = field(default_factory=list)
    unconfirmed_tasks: List[str] = field(default_factory=list)
    parse_errors: List[str] = field(default_factory=list)
    missing_owners: List[str] = field(default_factory=list)
    lineage_chain: Dict[str, List[str]] = field(default_factory=dict)


@dataclass
class LineageConfig:
    tables_path: str
    sql_tasks_path: str
    reports_path: str
    api_path: str
    owners_path: str
    confirmations_path: str
