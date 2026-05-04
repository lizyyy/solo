"""
Tests for Index Analyzer engine.
"""

import pytest

from index_analyzer.analyzer import IndexAnalyzer
from index_analyzer.models import (
    CandidateIndex,
    DatabaseType,
    Index,
    IndexIssueType,
    IndexType,
    InputDataSet,
    Schema,
    SlowQuery,
    Table,
    Column,
)


class TestRedundantIndexDetection:
    def test_detect_prefix_index_redundant(self):
        table = Table(
            name="users",
            schema="dbo",
            columns=[
                Column(name="email", data_type="VARCHAR(255)"),
                Column(name="status", data_type="VARCHAR(20)"),
            ],
            indexes=[
                Index(
                    name="idx_users_email",
                    columns=["email"],
                    index_type=IndexType.BTREE,
                    table_name="users",
                ),
                Index(
                    name="idx_users_email_status",
                    columns=["email", "status"],
                    index_type=IndexType.BTREE,
                    table_name="users",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"users": table},
        )
        
        dataset = InputDataSet(schema=schema)
        analyzer = IndexAnalyzer(dataset=dataset)
        issues, _ = analyzer.analyze()
        
        redundant_issues = [i for i in issues if i.issue_type == IndexIssueType.REDUNDANT]
        assert len(redundant_issues) == 1
        assert redundant_issues[0].index_name == "idx_users_email"
    
    def test_different_index_types_not_redundant(self):
        table = Table(
            name="users",
            schema="dbo",
            columns=[
                Column(name="data", data_type="JSON"),
            ],
            indexes=[
                Index(
                    name="idx_data_btree",
                    columns=["data"],
                    index_type=IndexType.BTREE,
                    table_name="users",
                ),
                Index(
                    name="idx_data_gin",
                    columns=["data"],
                    index_type=IndexType.GIN,
                    table_name="users",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.POSTGRESQL,
            tables={"users": table},
        )
        
        dataset = InputDataSet(schema=schema)
        analyzer = IndexAnalyzer(dataset=dataset)
        issues, _ = analyzer.analyze()
        
        redundant_issues = [i for i in issues if i.issue_type == IndexIssueType.REDUNDANT]
        assert len(redundant_issues) == 0
    
    def test_primary_key_not_marked_redundant(self):
        table = Table(
            name="users",
            schema="dbo",
            columns=[
                Column(name="id", data_type="INT", is_primary=True),
                Column(name="email", data_type="VARCHAR(255)"),
            ],
            indexes=[
                Index(
                    name="PRIMARY",
                    columns=["id"],
                    index_type=IndexType.BTREE,
                    is_primary=True,
                    table_name="users",
                ),
                Index(
                    name="idx_users_id_email",
                    columns=["id", "email"],
                    index_type=IndexType.BTREE,
                    table_name="users",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"users": table},
        )
        
        dataset = InputDataSet(schema=schema)
        analyzer = IndexAnalyzer(dataset=dataset)
        issues, _ = analyzer.analyze()
        
        redundant_issues = [i for i in issues if i.issue_type == IndexIssueType.REDUNDANT]
        primary_in_redundant = any(i.index_name == "PRIMARY" for i in redundant_issues)
        assert not primary_in_redundant


class TestDuplicateIndexDetection:
    def test_detect_duplicate_indexes(self):
        table = Table(
            name="users",
            schema="dbo",
            columns=[
                Column(name="username", data_type="VARCHAR(100)"),
            ],
            indexes=[
                Index(
                    name="uk_username",
                    columns=["username"],
                    index_type=IndexType.BTREE,
                    is_unique=True,
                    table_name="users",
                ),
                Index(
                    name="idx_users_username",
                    columns=["username"],
                    index_type=IndexType.BTREE,
                    is_unique=True,
                    table_name="users",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"users": table},
        )
        
        dataset = InputDataSet(schema=schema)
        analyzer = IndexAnalyzer(dataset=dataset)
        issues, _ = analyzer.analyze()
        
        duplicate_issues = [i for i in issues if i.issue_type == IndexIssueType.DUPLICATE]
        assert len(duplicate_issues) == 1


class TestMissingIndexDetection:
    def test_detect_missing_index_from_where_clause(self):
        table = Table(
            name="orders",
            schema="dbo",
            columns=[
                Column(name="id", data_type="INT", is_primary=True),
                Column(name="user_id", data_type="INT"),
                Column(name="status", data_type="VARCHAR(20)"),
                Column(name="created_at", data_type="DATETIME"),
            ],
            indexes=[
                Index(
                    name="PRIMARY",
                    columns=["id"],
                    index_type=IndexType.BTREE,
                    is_primary=True,
                    table_name="orders",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"orders": table},
        )
        
        slow_queries = [
            SlowQuery(
                query_id="q1",
                query="SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at DESC",
                normalized_query="SELECT * FROM orders WHERE status = '?' ORDER BY created_at DESC",
                db_type=DatabaseType.MYSQL,
                execution_time_ms=5000,
                frequency=100,
                tables_involved=["orders"],
            ),
            SlowQuery(
                query_id="q2",
                query="SELECT * FROM orders WHERE user_id = 123 AND created_at >= '2024-01-01'",
                normalized_query="SELECT * FROM orders WHERE user_id = ? AND created_at >= '?'",
                db_type=DatabaseType.MYSQL,
                execution_time_ms=3000,
                frequency=200,
                tables_involved=["orders"],
            ),
        ]
        
        dataset = InputDataSet(schema=schema, slow_queries=slow_queries)
        analyzer = IndexAnalyzer(dataset=dataset)
        issues, candidates = analyzer.analyze()
        
        missing_issues = [i for i in issues if i.issue_type == IndexIssueType.MISSING]
        assert len(missing_issues) > 0
        
        columns_mentioned = []
        for issue in missing_issues:
            if issue.columns:
                columns_mentioned.extend(issue.columns)
        
        assert "status" in columns_mentioned or "user_id" in columns_mentioned


class TestCandidateIndexSuggestion:
    def test_suggest_candidate_from_slow_query(self):
        table = Table(
            name="users",
            schema="dbo",
            columns=[
                Column(name="id", data_type="INT", is_primary=True),
                Column(name="email", data_type="VARCHAR(255)"),
                Column(name="status", data_type="VARCHAR(20)"),
            ],
            indexes=[
                Index(
                    name="PRIMARY",
                    columns=["id"],
                    index_type=IndexType.BTREE,
                    is_primary=True,
                    table_name="users",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"users": table},
        )
        
        slow_queries = [
            SlowQuery(
                query_id="q1",
                query="SELECT * FROM users WHERE email = 'test@example.com' AND status = 'active'",
                normalized_query="SELECT * FROM users WHERE email = '?' AND status = '?'",
                db_type=DatabaseType.MYSQL,
                execution_time_ms=2500,
                frequency=150,
                tables_involved=["users"],
            ),
        ]
        
        dataset = InputDataSet(schema=schema, slow_queries=slow_queries)
        analyzer = IndexAnalyzer(dataset=dataset)
        _, candidates = analyzer.analyze()
        
        assert len(candidates) > 0
        
        email_candidates = [
            c for c in candidates 
            if c.table_name == "users" and "email" in c.columns
        ]
        assert len(email_candidates) > 0


class TestIndexScoring:
    def test_candidate_index_scoring(self):
        table = Table(
            name="orders",
            schema="dbo",
            columns=[
                Column(name="id", data_type="INT", is_primary=True),
                Column(name="user_id", data_type="INT"),
                Column(name="created_at", data_type="DATETIME"),
            ],
            indexes=[
                Index(
                    name="PRIMARY",
                    columns=["id"],
                    index_type=IndexType.BTREE,
                    is_primary=True,
                    table_name="orders",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"orders": table},
        )
        
        slow_queries = [
            SlowQuery(
                query_id="q1",
                query="SELECT * FROM orders WHERE user_id = 123",
                normalized_query="SELECT * FROM orders WHERE user_id = ?",
                db_type=DatabaseType.MYSQL,
                execution_time_ms=10000,
                frequency=500,
                tables_involved=["orders"],
            ),
        ]
        
        dataset = InputDataSet(schema=schema, slow_queries=slow_queries)
        analyzer = IndexAnalyzer(dataset=dataset)
        _, candidates = analyzer.analyze()
        
        for candidate in candidates:
            assert hasattr(candidate, 'net_score')
            assert candidate.estimated_coverage_queries > 0
            assert candidate.estimated_performance_improvement_pct > 0


class TestIssuePrioritization:
    def test_issues_sorted_by_severity(self):
        table = Table(
            name="users",
            schema="dbo",
            columns=[
                Column(name="id", data_type="INT", is_primary=True),
                Column(name="email", data_type="VARCHAR(255)"),
            ],
            indexes=[
                Index(
                    name="PRIMARY",
                    columns=["id"],
                    index_type=IndexType.BTREE,
                    is_primary=True,
                    table_name="users",
                ),
                Index(
                    name="dup1",
                    columns=["email"],
                    index_type=IndexType.BTREE,
                    is_unique=True,
                    table_name="users",
                ),
                Index(
                    name="dup2",
                    columns=["email"],
                    index_type=IndexType.BTREE,
                    is_unique=True,
                    table_name="users",
                ),
            ],
        )
        
        schema = Schema(
            database_type=DatabaseType.MYSQL,
            tables={"users": table},
        )
        
        dataset = InputDataSet(schema=schema)
        analyzer = IndexAnalyzer(dataset=dataset)
        issues, _ = analyzer.analyze()
        
        if len(issues) > 1:
            severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
            for i in range(len(issues) - 1):
                current_sev = severity_order.get(issues[i].severity, 99)
                next_sev = severity_order.get(issues[i+1].severity, 99)
                assert current_sev <= next_sev, "Issues should be sorted by severity"
