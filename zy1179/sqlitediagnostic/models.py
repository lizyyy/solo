"""数据模型定义"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from datetime import datetime


@dataclass
class DatabaseInfo:
    path: str
    size: int
    page_size: int = 4096
    page_count: int = 0
    wal_size: int = 0
    journal_mode: str = "delete"
    synchronous: str = "full"
    busy_timeout: int = 5000
    foreign_keys: bool = False
    wal_autocheckpoint: int = 1000
    cache_size: int = -2000
    temp_store: str = "default"
    locking_mode: str = "normal"


@dataclass
class TraceEvent:
    timestamp: datetime
    event_type: str
    connection_id: str
    statement: str
    duration_ms: float = 0.0
    lock_type: Optional[str] = None
    lock_wait_ms: float = 0.0
    success: bool = True
    error_message: Optional[str] = None


@dataclass
class Migration:
    version: str
    name: str
    file_path: str
    sql_content: str
    has_alter_table: bool = False
    has_drop_table: bool = False
    has_create_table_as: bool = False
    has_rebuild_operations: bool = False
    tables_affected: List[str] = field(default_factory=list)


@dataclass
class WorkloadOperation:
    timestamp: datetime
    operation_type: str
    table_name: Optional[str] = None
    sql: Optional[str] = None
    duration_ms: float = 0.0
    rows_affected: int = 0
    connection_id: Optional[str] = None
    transaction_id: Optional[str] = None


@dataclass
class WorkloadTransaction:
    transaction_id: str
    connection_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_ms: float = 0.0
    is_read_only: bool = True
    operations: List[WorkloadOperation] = field(default_factory=list)
    commit_success: Optional[bool] = None


@dataclass
class AnalysisResult:
    category: str
    severity: str
    title: str
    description: str
    recommendation: str
    evidence: List[Dict[str, Any]] = field(default_factory=list)
    stats: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SimulationResult:
    parameter_name: str
    parameter_value: Any
    total_operations: int = 0
    successful_operations: int = 0
    failed_operations: int = 0
    total_duration_ms: float = 0.0
    avg_duration_ms: float = 0.0
    lock_conflicts: int = 0
    wal_growth_pages: int = 0
    checkpoint_count: int = 0
    busy_timeouts: int = 0
    transactions: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class ImportedData:
    database_info: Optional[DatabaseInfo] = None
    trace_events: List[TraceEvent] = field(default_factory=list)
    migrations: List[Migration] = field(default_factory=list)
    pragma_config: Dict[str, Any] = field(default_factory=dict)
    workload_transactions: List[WorkloadTransaction] = field(default_factory=list)
    workload_operations: List[WorkloadOperation] = field(default_factory=list)
