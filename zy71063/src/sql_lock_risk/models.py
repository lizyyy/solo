from dataclasses import dataclass, field
from enum import Enum
from typing import List, Optional, Dict, Any


class LockLevel(Enum):
    NONE = "none"
    METADATA = "metadata"
    SHARED = "shared"
    EXCLUSIVE = "exclusive"
    TABLE = "table"


class RiskLevel(Enum):
    SAFE = "safe"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlterType(Enum):
    ADD_COLUMN = "add_column"
    DROP_COLUMN = "drop_column"
    MODIFY_COLUMN = "modify_column"
    ADD_INDEX = "add_index"
    DROP_INDEX = "drop_index"
    ADD_CONSTRAINT = "add_constraint"
    DROP_CONSTRAINT = "drop_constraint"
    RENAME_TABLE = "rename_table"
    RENAME_COLUMN = "rename_column"
    ALTER_DEFAULT = "alter_default"
    UNKNOWN = "unknown"


@dataclass
class TableStats:
    table_name: str
    row_count: int = 0
    size_mb: float = 0.0
    has_primary_key: bool = True
    engine: str = "InnoDB"


@dataclass
class IndexInfo:
    table_name: str
    index_name: str
    columns: List[str]
    is_unique: bool = False
    is_primary: bool = False


@dataclass
class AlterStatement:
    raw_sql: str
    table_name: str
    alter_type: AlterType
    is_concurrent: bool = False
    is_online: bool = False
    uses_algorithm_inplace: bool = False
    uses_lock_none: bool = False
    column_name: Optional[str] = None
    index_name: Optional[str] = None
    is_nullable: Optional[bool] = None
    has_default: Optional[bool] = None
    column_type: Optional[str] = None


@dataclass
class MigrationFile:
    file_path: str
    statements: List[AlterStatement]
    is_wrapped_in_transaction: bool = False
    has_rollback_script: bool = False
    rollback_path: Optional[str] = None


@dataclass
class RiskFinding:
    statement: AlterStatement
    risk_level: RiskLevel
    lock_level: LockLevel
    reason: str
    mitigation: str
    estimated_duration_seconds: Optional[int] = None


@dataclass
class OrderIssue:
    type: str
    description: str
    migration_file: str
    statement_index: int


@dataclass
class AnalysisResult:
    migration_files: List[MigrationFile]
    findings: List[RiskFinding]
    order_issues: List[OrderIssue]
    table_stats: Dict[str, TableStats]
    summary: Dict[str, Any] = field(default_factory=dict)
    exit_code: int = 0
