"""
Index Analysis Engine - Detects missing, redundant, and inefficient indexes.
"""

import re
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Set

from .models import (
    CandidateIndex,
    DatabaseType,
    Index,
    IndexIssue,
    IndexIssueType,
    IndexType,
    InputDataSet,
    Schema,
    SlowQuery,
    Table,
    TableStats,
    WriteLoadMetrics,
)
from .parsers import extract_where_columns


class IndexAnalyzer:
    def __init__(
        self,
        dataset: InputDataSet,
        min_selectivity: float = 0.1,
        max_indexes_per_table: int = 10,
    ):
        self.dataset = dataset
        self.min_selectivity = min_selectivity
        self.max_indexes_per_table = max_indexes_per_table
        self.table_stats_map: Dict[str, TableStats] = {}
        self.write_load_map: Dict[str, List[WriteLoadMetrics]] = defaultdict(list)
        
        self._build_maps()
    
    def _build_maps(self):
        for stats in self.dataset.table_stats:
            self.table_stats_map[stats.table_name] = stats
        
        for load in self.dataset.write_load:
            self.write_load_map[load.table_name].append(load)
    
    def analyze(self) -> Tuple[List[IndexIssue], List[CandidateIndex]]:
        issues: List[IndexIssue] = []
        candidates: List[CandidateIndex] = []
        
        if not self.dataset.schema:
            return issues, candidates
        
        for table_name, table in self.dataset.schema.tables.items():
            table_issues = self._analyze_table(table)
            issues.extend(table_issues)
            
            table_candidates = self._suggest_candidates_for_table(table)
            candidates.extend(table_candidates)
        
        duplicates = self._find_duplicate_indexes()
        issues.extend(duplicates)
        
        issues = self._prioritize_issues(issues)
        candidates = self._rank_candidates(candidates)
        
        return issues, candidates
    
    def _analyze_table(self, table: Table) -> List[IndexIssue]:
        issues: List[IndexIssue] = []
        
        redundant_indexes = self._find_redundant_indexes(table)
        issues.extend(redundant_indexes)
        
        inefficient_indexes = self._find_inefficient_indexes(table)
        issues.extend(inefficient_indexes)
        
        unused_indexes = self._find_unused_indexes(table)
        issues.extend(unused_indexes)
        
        missing_indexes = self._find_missing_indexes_from_queries(table)
        issues.extend(missing_indexes)
        
        return issues
    
    def _find_redundant_indexes(self, table: Table) -> List[IndexIssue]:
        issues: List[IndexIssue] = []
        
        for i, idx1 in enumerate(table.indexes):
            if idx1.is_primary:
                continue
            
            for j, idx2 in enumerate(table.indexes):
                if i >= j:
                    continue
                if idx2.is_primary:
                    continue
                
                if self._is_index_redundant(idx1, idx2):
                    issues.append(
                        IndexIssue(
                            issue_type=IndexIssueType.REDUNDANT,
                            table_name=table.name,
                            index_name=idx1.name,
                            description=f"Index '{idx1.name}' is redundant because '{idx2.name}' covers it. "
                                       f"Columns: {idx1.columns} is a prefix of {idx2.columns}",
                            severity="medium",
                            columns=idx1.columns,
                            estimated_impact={
                                "storage_waste_pct": self._estimate_index_storage_waste(idx1, table),
                                "write_overhead_pct": self._estimate_write_overhead(idx1, table),
                            },
                            suggestions=[f"Consider dropping redundant index '{idx1.name}'"],
                        )
                    )
                elif self._is_index_redundant(idx2, idx1):
                    issues.append(
                        IndexIssue(
                            issue_type=IndexIssueType.REDUNDANT,
                            table_name=table.name,
                            index_name=idx2.name,
                            description=f"Index '{idx2.name}' is redundant because '{idx1.name}' covers it. "
                                       f"Columns: {idx2.columns} is a prefix of {idx1.columns}",
                            severity="medium",
                            columns=idx2.columns,
                            estimated_impact={
                                "storage_waste_pct": self._estimate_index_storage_waste(idx2, table),
                                "write_overhead_pct": self._estimate_write_overhead(idx2, table),
                            },
                            suggestions=[f"Consider dropping redundant index '{idx2.name}'"],
                        )
                    )
        
        return issues
    
    def _is_index_redundant(self, idx1: Index, idx2: Index) -> bool:
        if idx1.index_type != idx2.index_type:
            return False
        
        if len(idx1.columns) >= len(idx2.columns):
            return False
        
        for i, col in enumerate(idx1.columns):
            if idx2.columns[i] != col:
                return False
        
        return True
    
    def _find_inefficient_indexes(self, table: Table) -> List[IndexIssue]:
        issues: List[IndexIssue] = []
        table_stats = self.table_stats_map.get(table.name)
        
        for idx in table.indexes:
            if idx.is_primary:
                continue
            
            if len(idx.columns) == 1:
                col = idx.columns[0]
                if table_stats and col in table_stats.column_stats:
                    col_stats = table_stats.column_stats[col]
                    cardinality = col_stats.get("cardinality", None)
                    if cardinality and table_stats.row_count > 0:
                        selectivity = int(cardinality) / table_stats.row_count
                        if selectivity < self.min_selectivity:
                            issues.append(
                                IndexIssue(
                                    issue_type=IndexIssueType.INEFFICIENT,
                                    table_name=table.name,
                                    index_name=idx.name,
                                    description=f"Index '{idx.name}' has low selectivity ({selectivity:.2%}) "
                                               f"on column '{col}'. High cardinality columns make poor index candidates.",
                                    severity="low",
                                    columns=idx.columns,
                                    estimated_impact={
                                        "selectivity": selectivity,
                                        "storage_waste_pct": 5.0,
                                    },
                                    suggestions=[
                                        f"Review if index '{idx.name}' is necessary for low-selectivity column",
                                        "Consider composite index with more selective columns first"
                                    ],
                                )
                            )
            
            if len(idx.columns) > 5:
                issues.append(
                    IndexIssue(
                        issue_type=IndexIssueType.INEFFICIENT,
                        table_name=table.name,
                        index_name=idx.name,
                        description=f"Index '{idx.name}' has {len(idx.columns)} columns, which may be too wide. "
                                   f"Wide indexes increase storage and write overhead.",
                        severity="low",
                        columns=idx.columns,
                        estimated_impact={
                            "write_overhead_pct": len(idx.columns) * 5.0,
                        },
                        suggestions=[
                            "Consider reducing the number of columns in the index",
                            "Evaluate if all columns are necessary for query patterns"
                        ],
                    )
                )
        
        return issues
    
    def _find_unused_indexes(self, table: Table) -> List[IndexIssue]:
        issues: List[IndexIssue] = []
        
        used_indexes: Set[str] = set()
        
        for explain_result in self.dataset.explain_results:
            for idx_use in explain_result.index_uses:
                if idx_use.get("table") == table.name and idx_use.get("index"):
                    used_indexes.add(idx_use["index"])
        
        for query in self.dataset.slow_queries:
            if table.name in query.tables_involved:
                for idx in table.indexes:
                    for col in idx.columns:
                        pattern = rf"\b{col}\b\s*(?:=|>|<|>=|<=|IN|LIKE)"
                        if re.search(pattern, query.query, re.IGNORECASE):
                            used_indexes.add(idx.name)
        
        for idx in table.indexes:
            if idx.is_primary or idx.is_unique:
                continue
            
            if idx.name not in used_indexes:
                issues.append(
                    IndexIssue(
                        issue_type=IndexIssueType.UNUSED,
                        table_name=table.name,
                        index_name=idx.name,
                        description=f"Index '{idx.name}' appears to be unused based on analyzed queries. "
                                   f"It consumes storage and adds write overhead without benefit.",
                        severity="medium",
                        columns=idx.columns,
                        estimated_impact={
                            "storage_waste_pct": self._estimate_index_storage_waste(idx, table),
                            "write_overhead_pct": self._estimate_write_overhead(idx, table),
                        },
                        suggestions=[
                            f"Verify if index '{idx.name}' is actually needed",
                            "Consider dropping after confirming no queries depend on it"
                        ],
                    )
                )
        
        return issues
    
    def _find_missing_indexes_from_queries(self, table: Table) -> List[IndexIssue]:
        issues: List[IndexIssue] = []
        missing_columns: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "queries": [],
            "frequency": 0,
            "avg_execution_time_ms": 0.0
        })
        
        for query in self.dataset.slow_queries:
            if table.name not in query.tables_involved:
                continue
            
            where_cols = extract_where_columns(query.query)
            
            for col in where_cols:
                has_index = any(
                    idx.columns[0] == col for idx in table.indexes
                )
                
                if not has_index:
                    col_info = missing_columns[col]
                    col_info["queries"].append(query.query_id)
                    col_info["frequency"] += query.frequency
                    col_info["avg_execution_time_ms"] = (
                        (col_info["avg_execution_time_ms"] * (len(col_info["queries"]) - 1) + 
                         query.execution_time_ms) / len(col_info["queries"])
                    )
        
        for explain_result in self.dataset.explain_results:
            for table_scan in explain_result.table_scans:
                if table_scan == table.name:
                    where_cols = extract_where_columns(explain_result.query)
                    for col in where_cols:
                        has_index = any(
                            idx.columns[0] == col for idx in table.indexes
                        )
                        if not has_index:
                            col_info = missing_columns[col]
                            col_info["queries"].append("explain_" + str(len(col_info["queries"])))
                            col_info["frequency"] += 1
        
        for col, info in missing_columns.items():
            issues.append(
                IndexIssue(
                    issue_type=IndexIssueType.MISSING,
                    table_name=table.name,
                    index_name=None,
                    description=f"Column '{col}' is frequently used in WHERE clauses but has no index. "
                               f"Used in {info['frequency']} queries with average execution time of "
                               f"{info['avg_execution_time_ms']:.2f}ms.",
                    severity="high" if info["frequency"] > 5 or info["avg_execution_time_ms"] > 1000 else "medium",
                    columns=[col],
                    estimated_impact={
                        "query_count": info["frequency"],
                        "avg_execution_time_ms": info["avg_execution_time_ms"],
                        "potential_improvement_pct": 70.0,
                    },
                    suggestions=[
                        f"Consider adding an index on column '{col}'",
                        f"Evaluate if composite index with other frequently used columns would be better"
                    ],
                )
            )
        
        return issues
    
    def _find_duplicate_indexes(self) -> List[IndexIssue]:
        issues: List[IndexIssue] = []
        
        if not self.dataset.schema:
            return issues
        
        for table_name, table in self.dataset.schema.tables.items():
            index_signatures: Dict[str, List[Index]] = defaultdict(list)
            
            for idx in table.indexes:
                if idx.is_primary:
                    continue
                
                signature = f"{idx.index_type.value}:{','.join(idx.columns)}:{idx.is_unique}"
                index_signatures[signature].append(idx)
            
            for signature, indexes in index_signatures.items():
                if len(indexes) > 1:
                    for idx in indexes[1:]:
                        issues.append(
                            IndexIssue(
                                issue_type=IndexIssueType.DUPLICATE,
                                table_name=table_name,
                                index_name=idx.name,
                                description=f"Index '{idx.name}' is a duplicate of '{indexes[0].name}'. "
                                           f"Both have the same columns ({idx.columns}) and type ({idx.index_type}).",
                                severity="high",
                                columns=idx.columns,
                                estimated_impact={
                                    "storage_waste_pct": self._estimate_index_storage_waste(idx, table) * 2,
                                    "write_overhead_pct": self._estimate_write_overhead(idx, table),
                                },
                                suggestions=[
                                    f"Drop duplicate index '{idx.name}'",
                                    f"Keep only one index: '{indexes[0].name}'"
                                ],
                            )
                        )
        
        return issues
    
    def _estimate_index_storage_waste(self, idx: Index, table: Table) -> float:
        base_pct = 5.0
        num_cols = len(idx.columns)
        row_factor = 1.0
        
        stats = self.table_stats_map.get(table.name)
        if stats:
            if stats.row_count > 1000000:
                row_factor = 2.0
            elif stats.row_count > 100000:
                row_factor = 1.5
        
        return base_pct * num_cols * row_factor
    
    def _estimate_write_overhead(self, idx: Index, table: Table) -> float:
        base_pct = 3.0
        num_cols = len(idx.columns)
        
        write_loads = self.write_load_map.get(table.name, [])
        if write_loads:
            avg_ops = sum(load.total_write_ops for load in write_loads) / len(write_loads)
            if avg_ops > 1000:
                return base_pct * num_cols * 2.0
            elif avg_ops > 100:
                return base_pct * num_cols * 1.5
        
        return base_pct * num_cols
    
    def _prioritize_issues(self, issues: List[IndexIssue]) -> List[IndexIssue]:
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        
        return sorted(
            issues,
            key=lambda x: (
                severity_order.get(x.severity, 99),
                -x.estimated_impact.get("potential_improvement_pct", 0),
                x.table_name,
            )
        )
    
    def _suggest_candidates_for_table(self, table: Table) -> List[CandidateIndex]:
        candidates: List[CandidateIndex] = []
        
        for query in self.dataset.slow_queries:
            if table.name not in query.tables_involved:
                continue
            
            where_cols = extract_where_columns(query.query)
            if not where_cols:
                continue
            
            existing_prefixes = set()
            for idx in table.indexes:
                for i in range(len(idx.columns)):
                    prefix = tuple(idx.columns[:i+1])
                    existing_prefixes.add(prefix)
            
            if len(where_cols) >= 1:
                candidate_cols = where_cols[:min(5, len(where_cols))]
                candidate_prefix = tuple(candidate_cols)
                
                if candidate_prefix not in existing_prefixes:
                    exists = any(
                        c.columns == candidate_cols and c.table_name == table.name
                        for c in candidates
                    )
                    
                    if not exists:
                        coverage_queries = self._estimate_coverage(candidate_cols, table.name)
                        performance_improv = self._estimate_performance_improvement(query, candidate_cols)
                        write_cost = self._estimate_write_cost_increase(table, len(candidate_cols))
                        net_score = performance_improv - write_cost
                        
                        candidates.append(
                            CandidateIndex(
                                index_name=f"idx_{table.name}_{'_'.join(candidate_cols)}",
                                table_name=table.name,
                                columns=candidate_cols,
                                index_type=IndexType.BTREE,
                                estimated_coverage_queries=coverage_queries,
                                estimated_performance_improvement_pct=performance_improv,
                                estimated_write_cost_increase_pct=write_cost,
                                net_score=net_score,
                                supported_queries=[query.query_id],
                                conficting_indexes=self._find_conflicting_indexes(table, candidate_cols),
                            )
                        )
        
        return candidates
    
    def _estimate_coverage(self, columns: List[str], table_name: str) -> int:
        count = 0
        for query in self.dataset.slow_queries:
            if table_name not in query.tables_involved:
                continue
            
            where_cols = extract_where_columns(query.query)
            if columns[0] in where_cols:
                count += query.frequency
        
        return count
    
    def _estimate_performance_improvement(self, query: SlowQuery, columns: List[str]) -> float:
        base_improv = 30.0
        
        if query.execution_time_ms > 1000:
            base_improv += 40.0
        elif query.execution_time_ms > 100:
            base_improv += 20.0
        
        if query.rows_examined and query.rows_examined > 10000:
            base_improv += 20.0
        
        return min(base_improv, 95.0)
    
    def _estimate_write_cost_increase(self, table: Table, num_cols: int) -> float:
        base_cost = 5.0 * num_cols
        
        write_loads = self.write_load_map.get(table.name, [])
        if write_loads:
            avg_ops = sum(load.total_write_ops for load in write_loads) / len(write_loads)
            if avg_ops > 1000:
                base_cost *= 2.0
            elif avg_ops > 100:
                base_cost *= 1.5
        
        return min(base_cost, 30.0)
    
    def _find_conflicting_indexes(self, table: Table, columns: List[str]) -> List[str]:
        conflicts = []
        
        for idx in table.indexes:
            if idx.columns == columns:
                conflicts.append(idx.name)
            elif len(idx.columns) >= len(columns):
                if idx.columns[:len(columns)] == columns:
                    conflicts.append(idx.name)
        
        return conflicts
    
    def _rank_candidates(self, candidates: List[CandidateIndex]) -> List[CandidateIndex]:
        return sorted(
            candidates,
            key=lambda x: (
                -x.net_score,
                -x.estimated_coverage_queries,
                x.estimated_write_cost_increase_pct,
            )
        )
