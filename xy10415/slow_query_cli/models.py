from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Set


@dataclass
class SlowQuery:
    query_time: datetime
    execution_time: float
    database: str
    tables: List[str]
    raw_sql: str
    sql_digest: str
    owner: Optional[str] = None
    is_confirmed: bool = False
    is_duplicate: bool = False
    error: Optional[str] = None


@dataclass
class QueryPattern:
    sql_digest: str
    tables: List[str]
    database: str
    first_seen: datetime
    last_seen: datetime
    total_count: int = 0
    total_execution_time: float = 0.0
    avg_execution_time: float = 0.0
    max_execution_time: float = 0.0
    queries: List[SlowQuery] = field(default_factory=list)
    owner: Optional[str] = None
    is_confirmed: bool = False


@dataclass
class OwnerAssignment:
    name: str
    service: str
    tables: Set[str]
    databases: Set[str]
