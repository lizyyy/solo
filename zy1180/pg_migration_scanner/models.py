"""数据模型定义。"""

from datetime import datetime
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    """风险级别。"""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class DDLType(str, Enum):
    """DDL 操作类型。"""

    ALTER_TABLE = "ALTER TABLE"
    CREATE_INDEX = "CREATE INDEX"
    DROP_INDEX = "DROP INDEX"
    CREATE_TABLE = "CREATE TABLE"
    DROP_TABLE = "DROP TABLE"
    TRUNCATE = "TRUNCATE"
    ALTER_COLUMN = "ALTER COLUMN"
    ADD_COLUMN = "ADD COLUMN"
    DROP_COLUMN = "DROP COLUMN"
    ADD_CONSTRAINT = "ADD CONSTRAINT"
    DROP_CONSTRAINT = "DROP CONSTRAINT"
    RENAME = "RENAME"
    COMMENT = "COMMENT"
    GRANT = "GRANT"
    REVOKE = "REVOKE"
    CREATE_VIEW = "CREATE VIEW"
    DROP_VIEW = "DROP VIEW"


class LockMode(str, Enum):
    """PostgreSQL 锁模式。"""

    ACCESS_SHARE = "ACCESS SHARE"
    ROW_SHARE = "ROW SHARE"
    ROW_EXCLUSIVE = "ROW EXCLUSIVE"
    SHARE_UPDATE_EXCLUSIVE = "SHARE UPDATE EXCLUSIVE"
    SHARE = "SHARE"
    SHARE_ROW_EXCLUSIVE = "SHARE ROW EXCLUSIVE"
    EXCLUSIVE = "EXCLUSIVE"
    ACCESS_EXCLUSIVE = "ACCESS EXCLUSIVE"


LOCK_CONFLICT_MATRIX: dict[LockMode, list[LockMode]] = {
    LockMode.ACCESS_SHARE: [LockMode.ACCESS_EXCLUSIVE],
    LockMode.ROW_SHARE: [LockMode.EXCLUSIVE, LockMode.ACCESS_EXCLUSIVE],
    LockMode.ROW_EXCLUSIVE: [
        LockMode.SHARE,
        LockMode.SHARE_ROW_EXCLUSIVE,
        LockMode.EXCLUSIVE,
        LockMode.ACCESS_EXCLUSIVE,
    ],
    LockMode.SHARE_UPDATE_EXCLUSIVE: [
        LockMode.SHARE_UPDATE_EXCLUSIVE,
        LockMode.SHARE,
        LockMode.SHARE_ROW_EXCLUSIVE,
        LockMode.EXCLUSIVE,
        LockMode.ACCESS_EXCLUSIVE,
    ],
    LockMode.SHARE: [
        LockMode.ROW_EXCLUSIVE,
        LockMode.SHARE_UPDATE_EXCLUSIVE,
        LockMode.SHARE_ROW_EXCLUSIVE,
        LockMode.EXCLUSIVE,
        LockMode.ACCESS_EXCLUSIVE,
    ],
    LockMode.SHARE_ROW_EXCLUSIVE: [
        LockMode.ROW_EXCLUSIVE,
        LockMode.SHARE_UPDATE_EXCLUSIVE,
        LockMode.SHARE,
        LockMode.SHARE_ROW_EXCLUSIVE,
        LockMode.EXCLUSIVE,
        LockMode.ACCESS_EXCLUSIVE,
    ],
    LockMode.EXCLUSIVE: [
        LockMode.ROW_SHARE,
        LockMode.ROW_EXCLUSIVE,
        LockMode.SHARE_UPDATE_EXCLUSIVE,
        LockMode.SHARE,
        LockMode.SHARE_ROW_EXCLUSIVE,
        LockMode.EXCLUSIVE,
        LockMode.ACCESS_EXCLUSIVE,
    ],
    LockMode.ACCESS_EXCLUSIVE: [
        LockMode.ACCESS_SHARE,
        LockMode.ROW_SHARE,
        LockMode.ROW_EXCLUSIVE,
        LockMode.SHARE_UPDATE_EXCLUSIVE,
        LockMode.SHARE,
        LockMode.SHARE_ROW_EXCLUSIVE,
        LockMode.EXCLUSIVE,
        LockMode.ACCESS_EXCLUSIVE,
    ],
}


class DDLOperation(BaseModel):
    """解析后的 DDL 操作。"""

    raw_sql: str
    ddl_type: DDLType
    table_name: str
    schema_name: Optional[str] = None
    index_name: Optional[str] = None
    is_concurrently: bool = False
    is_transactional: bool = True
    lock_mode: LockMode
    estimated_duration_seconds: Optional[float] = None
    description: str = ""


class MigrationFile(BaseModel):
    """迁移文件信息。"""

    filename: str
    filepath: str
    version: str
    operations: list[DDLOperation]
    raw_content: str


class RiskFinding(BaseModel):
    """风险发现。"""

    risk_level: RiskLevel
    category: str
    title: str
    description: str
    affected_object: str
    suggested_fix: str
    location: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class LockWaitChain(BaseModel):
    """锁等待链。"""

    chain_id: str
    blocked_pid: int
    blocking_pid: int
    wait_event: str
    locked_object: str
    lock_mode: LockMode
    blocked_query: str
    blocking_query: str
    duration_seconds: float


class LongTransaction(BaseModel):
    """长事务信息。"""

    pid: int
    duration_seconds: float
    query: str
    state: str
    usename: str
    application_name: str
    lock_held: Optional[LockMode] = None


class TableStats(BaseModel):
    """表统计信息。"""

    schema_name: str
    table_name: str
    row_count: int
    size_bytes: int
    last_vacuum: Optional[datetime] = None
    last_analyze: Optional[datetime] = None
    n_dead_tup: int = 0
    n_live_tup: int = 0


class ReleaseWindow(BaseModel):
    """发布窗口配置。"""

    environment: str
    allowed_days: list[str]
    allowed_hours: list[int]
    max_duration_minutes: int
    high_risk_requires_approval: bool
    maintenance_window_start: Optional[str] = None
    maintenance_window_end: Optional[str] = None


class ExecutionPlanStep(BaseModel):
    """执行计划步骤。"""

    step_id: str
    order: int
    title: str
    operations: list[str]
    estimated_duration_minutes: float
    risk_level: RiskLevel
    prerequisites: list[str] = Field(default_factory=list)
    rollback_instructions: str = ""
    notes: str = ""


class ExecutionPlan(BaseModel):
    """完整执行计划。"""

    plan_id: str
    generated_at: datetime
    total_estimated_duration_minutes: float
    overall_risk_level: RiskLevel
    steps: list[ExecutionPlanStep]
    critical_risks: list[RiskFinding]
    warnings: list[str]
    prerequisites: list[str]
    rollback_strategy: str


class AnalysisResult(BaseModel):
    """分析结果。"""

    analysis_id: str
    generated_at: datetime
    migration_files: list[MigrationFile]
    all_operations: list[DDLOperation]
    risk_findings: list[RiskFinding]
    lock_wait_chains: list[LockWaitChain]
    long_transactions: list[LongTransaction]
    table_stats: dict[str, TableStats]
    release_window: Optional[ReleaseWindow] = None
    execution_plan: Optional[ExecutionPlan] = None
    summary: dict[str, Any] = Field(default_factory=dict)
