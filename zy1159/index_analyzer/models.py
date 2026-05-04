"""
Core data models for Index Analyzer.
"""

from enum import Enum
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from pydantic import BaseModel, Field


class IndexType(str, Enum):
    BTREE = "BTREE"
    HASH = "HASH"
    GIN = "GIN"
    GIST = "GIST"
    FULLTEXT = "FULLTEXT"
    SPATIAL = "SPATIAL"


class DatabaseType(str, Enum):
    MYSQL = "mysql"
    POSTGRESQL = "postgres"


class Column(BaseModel):
    name: str
    data_type: str
    nullable: bool = True
    default: Optional[str] = None
    is_primary: bool = False
    comment: Optional[str] = None


class Index(BaseModel):
    name: str
    columns: List[str]
    index_type: IndexType = IndexType.BTREE
    is_unique: bool = False
    is_primary: bool = False
    is_foreign: bool = False
    table_name: str
    cardinality: Optional[int] = None
    selectivity: Optional[float] = None
    comment: Optional[str] = None


class Table(BaseModel):
    name: str
    schema: str
    columns: List[Column] = []
    indexes: List[Index] = []
    row_count: Optional[int] = None
    size_bytes: Optional[int] = None
    comment: Optional[str] = None


class Schema(BaseModel):
    database_type: DatabaseType
    tables: Dict[str, Table] = {}
    raw_sql: str = ""


class SlowQuery(BaseModel):
    query_id: str
    query: str
    normalized_query: str
    db_type: DatabaseType
    execution_time_ms: float
    rows_sent: Optional[int] = None
    rows_examined: Optional[int] = None
    timestamp: Optional[datetime] = None
    frequency: int = 1
    schema_name: Optional[str] = None
    tables_involved: List[str] = []
    user: Optional[str] = None
    host: Optional[str] = None


class ExplainPlanNode(BaseModel):
    id: int
    select_type: str
    table_name: str
    access_type: str
    possible_keys: List[str] = []
    key_used: Optional[str] = None
    key_len: Optional[int] = None
    ref: List[str] = []
    rows: Optional[int] = None
    filtered: Optional[float] = None
    filter_condition: Optional[str] = None
    extra: Optional[str] = None
    children: List["ExplainPlanNode"] = []


ExplainPlanNode.model_rebuild()


class ExplainResult(BaseModel):
    query: str
    normalized_query: str
    plan: List[ExplainPlanNode] = []
    total_cost: Optional[float] = None
    database_type: DatabaseType
    table_scans: List[str] = []
    index_uses: List[Dict[str, Any]] = []


class TableStats(BaseModel):
    table_name: str
    row_count: int
    data_size_bytes: int
    index_size_bytes: int
    last_analyzed: Optional[datetime] = None
    column_stats: Dict[str, Dict[str, Any]] = {}
    index_stats: Dict[str, Dict[str, Any]] = {}


class WriteLoadMetrics(BaseModel):
    table_name: str
    timestamp: datetime
    insert_rate: float = 0.0
    update_rate: float = 0.0
    delete_rate: float = 0.0
    total_write_ops: float = 0.0
    avg_write_latency_ms: float = 0.0


class IndexPolicyRule(BaseModel):
    rule_id: str
    rule_type: str
    description: str
    severity: str = "info"
    conditions: Dict[str, Any] = {}
    actions: List[str] = []
    enabled: bool = True


class IndexPolicy(BaseModel):
    policy_name: str = "default"
    database_type: DatabaseType
    rules: List[IndexPolicyRule] = []
    max_indexes_per_table: int = 10
    max_columns_per_index: int = 5
    min_selectivity_for_index: float = 0.1
    write_cost_threshold: float = 0.3


class IndexIssueType(str, Enum):
    MISSING = "missing"
    REDUNDANT = "redundant"
    INEFFICIENT = "inefficient"
    UNUSED = "unused"
    DUPLICATE = "duplicate"


class IndexIssue(BaseModel):
    issue_type: IndexIssueType
    table_name: str
    index_name: Optional[str] = None
    description: str
    severity: str
    columns: Optional[List[str]] = None
    estimated_impact: Dict[str, float] = {}
    suggestions: List[str] = []


class CandidateIndex(BaseModel):
    index_name: str
    table_name: str
    columns: List[str]
    index_type: IndexType = IndexType.BTREE
    estimated_coverage_queries: int = 0
    estimated_performance_improvement_pct: float = 0.0
    estimated_write_cost_increase_pct: float = 0.0
    net_score: float = 0.0
    supported_queries: List[str] = []
    conficting_indexes: List[str] = []


class SimulationResult(BaseModel):
    candidate_index: CandidateIndex
    before_stats: Dict[str, Any] = {}
    after_stats: Dict[str, Any] = {}
    query_improvements: List[Dict[str, Any]] = []
    write_cost_analysis: Dict[str, Any] = {}
    overall_score_change: float = 0.0


class AnalysisResult(BaseModel):
    schema_name: str
    database_type: DatabaseType
    timestamp: datetime
    tables_analyzed: int
    queries_analyzed: int
    issues: List[IndexIssue] = []
    candidate_indexes: List[CandidateIndex] = []
    summary: Dict[str, Any] = {}
    recommendations: List[str] = []


class ReportFormat(str, Enum):
    JSON = "json"
    CSV = "csv"
    MARKDOWN = "markdown"


class InputDataSet(BaseModel):
    schema: Optional[Schema] = None
    slow_queries: List[SlowQuery] = []
    explain_results: List[ExplainResult] = []
    table_stats: List[TableStats] = []
    write_load: List[WriteLoadMetrics] = []
    index_policy: Optional[IndexPolicy] = None
