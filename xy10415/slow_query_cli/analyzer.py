from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Set, Optional
from .models import SlowQuery, QueryPattern
from .config_manager import ConfigManager


class QueryAnalyzer:
    def __init__(self, config_manager: ConfigManager):
        self.config_manager = config_manager
        self.patterns: Dict[str, QueryPattern] = {}
        self.owner_patterns: Dict[str, List[QueryPattern]] = defaultdict(list)
        self.unassigned_patterns: List[QueryPattern] = []
        self.parse_errors: List[SlowQuery] = []
        self.duplicate_notes: List[str] = []

    def analyze(self, queries: List[SlowQuery]) -> Dict[str, QueryPattern]:
        self.patterns = {}
        self.owner_patterns = defaultdict(list)
        self.unassigned_patterns = []
        self.parse_errors = []
        self.duplicate_notes = []

        for query in queries:
            if query.error:
                self.parse_errors.append(query)
                continue

            digest = query.sql_digest
            if digest in self.patterns:
                pattern = self.patterns[digest]
                pattern.total_count += 1
                pattern.total_execution_time += query.execution_time
                pattern.max_execution_time = max(
                    pattern.max_execution_time, query.execution_time
                )
                pattern.last_seen = max(pattern.last_seen, query.query_time)
                pattern.queries.append(query)
                query.is_duplicate = True
                self.duplicate_notes.append(
                    f"重复查询: SQL摘要已存在于模式中，首次发生于 {pattern.first_seen}"
                )
            else:
                tables = query.tables
                owner = self.config_manager.get_owner_for_tables(
                    tables, query.database
                )
                
                pattern = QueryPattern(
                    sql_digest=digest,
                    tables=tables,
                    database=query.database,
                    first_seen=query.query_time,
                    last_seen=query.query_time,
                    total_count=1,
                    total_execution_time=query.execution_time,
                    avg_execution_time=query.execution_time,
                    max_execution_time=query.execution_time,
                    queries=[query],
                    owner=owner
                )
                self.patterns[digest] = pattern

        for pattern in self.patterns.values():
            pattern.avg_execution_time = (
                pattern.total_execution_time / pattern.total_count
                if pattern.total_count > 0
                else 0.0
            )

            if pattern.owner:
                self.owner_patterns[pattern.owner].append(pattern)
            else:
                self.unassigned_patterns.append(pattern)

        return self.patterns

    def get_patterns_by_owner(self, owner: str) -> List[QueryPattern]:
        return sorted(
            self.owner_patterns.get(owner, []),
            key=lambda p: p.total_execution_time,
            reverse=True
        )

    def get_unassigned_patterns(self) -> List[QueryPattern]:
        return self.unassigned_patterns

    def get_top_patterns(self, limit: int = 10) -> List[QueryPattern]:
        return sorted(
            self.patterns.values(),
            key=lambda p: p.total_execution_time,
            reverse=True
        )[:limit]

    def get_parse_errors(self) -> List[SlowQuery]:
        return self.parse_errors

    def get_duplicate_notes(self) -> List[str]:
        return self.duplicate_notes

    def get_unknown_tables_in_queries(self) -> Set[str]:
        unknown = set()
        for pattern in self.patterns.values():
            if not pattern.owner:
                for table in pattern.tables:
                    unknown.add(table)
        return unknown

    def mark_pattern_confirmed(self, digest: str) -> bool:
        if digest in self.patterns:
            self.patterns[digest].is_confirmed = True
            for query in self.patterns[digest].queries:
                query.is_confirmed = True
            return True
        return False

    def get_statistics(self) -> Dict:
        stats = {
            'total_queries': sum(p.total_count for p in self.patterns.values()),
            'unique_patterns': len(self.patterns),
            'parse_errors': len(self.parse_errors),
            'total_execution_time': sum(p.total_execution_time for p in self.patterns.values()),
            'assigned_to_owners': len(self.owner_patterns),
            'unassigned_patterns': len(self.unassigned_patterns),
            'duplicates_detected': len(self.duplicate_notes),
        }
        return stats
