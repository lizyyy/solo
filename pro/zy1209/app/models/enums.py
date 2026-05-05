from enum import Enum


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AnalysisType(str, Enum):
    CONNECTION_POOL = "connection_pool"
    BATCH_WRITE = "batch_write"
    INDEX_ANALYSIS = "index_analysis"
    SLOW_SQL = "slow_sql"
    READ_WRITE_SPLIT = "read_write_split"
    SHARDING_HOTSPOT = "sharding_hotspot"


class SeverityLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class ExportFormat(str, Enum):
    JSON = "json"
    MARKDOWN = "markdown"
    HTML = "html"
