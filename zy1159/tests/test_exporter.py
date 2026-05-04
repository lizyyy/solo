"""
Tests for Report Exporter.
"""

import json
from datetime import datetime

import pytest

from index_analyzer.exporter import ReportExporter
from index_analyzer.models import (
    AnalysisResult,
    CandidateIndex,
    DatabaseType,
    IndexIssue,
    IndexIssueType,
    IndexType,
    ReportFormat,
    SimulationResult,
)


class TestReportExporter:
    def test_export_json_format(self):
        issue = IndexIssue(
            issue_type=IndexIssueType.MISSING,
            table_name="users",
            index_name=None,
            description="Missing index on email column",
            severity="high",
            columns=["email"],
            estimated_impact={"potential_improvement_pct": 75.0},
            suggestions=["Add index on email column"],
        )
        
        candidate = CandidateIndex(
            index_name="idx_users_email",
            table_name="users",
            columns=["email"],
            index_type=IndexType.BTREE,
            estimated_coverage_queries=150,
            estimated_performance_improvement_pct=60.0,
            estimated_write_cost_increase_pct=5.0,
            net_score=55.0,
        )
        
        result = AnalysisResult(
            schema_name="test_schema",
            database_type=DatabaseType.MYSQL,
            timestamp=datetime.now(),
            tables_analyzed=5,
            queries_analyzed=100,
            issues=[issue],
            candidate_indexes=[candidate],
            summary={},
            recommendations=["Add index on users.email"],
        )
        
        exporter = ReportExporter()
        content = exporter.export(result, ReportFormat.JSON)
        
        data = json.loads(content)
        
        assert "tables_analyzed" in data
        assert data["tables_analyzed"] == 5
        assert "issues" in data
        assert len(data["issues"]) == 1
        assert "candidate_indexes" in data
        assert len(data["candidate_indexes"]) == 1
        assert "exported_at" in data
    
    def test_export_csv_format(self):
        issues = [
            IndexIssue(
                issue_type=IndexIssueType.REDUNDANT,
                table_name="users",
                index_name="idx_email",
                description="Redundant index",
                severity="medium",
                columns=["email"],
                estimated_impact={},
                suggestions=["Drop idx_email"],
            ),
            IndexIssue(
                issue_type=IndexIssueType.MISSING,
                table_name="orders",
                index_name=None,
                description="Missing index on status",
                severity="high",
                columns=["status"],
                estimated_impact={},
                suggestions=["Add index on status"],
            ),
        ]
        
        candidates = [
            CandidateIndex(
                index_name="idx_orders_status",
                table_name="orders",
                columns=["status"],
                index_type=IndexType.BTREE,
                estimated_coverage_queries=100,
                estimated_performance_improvement_pct=50.0,
                estimated_write_cost_increase_pct=3.0,
                net_score=47.0,
            ),
        ]
        
        result = AnalysisResult(
            schema_name="test",
            database_type=DatabaseType.MYSQL,
            timestamp=datetime.now(),
            tables_analyzed=2,
            queries_analyzed=50,
            issues=issues,
            candidate_indexes=candidates,
            summary={},
            recommendations=[],
        )
        
        exporter = ReportExporter()
        content = exporter.export(result, ReportFormat.CSV)
        
        assert "idx_email" in content
        assert "Redundant" in content or "redundant" in content
        assert "idx_orders_status" in content
    
    def test_export_markdown_format(self):
        issues = [
            IndexIssue(
                issue_type=IndexIssueType.DUPLICATE,
                table_name="users",
                index_name="dup_idx",
                description="Duplicate index of uk_email",
                severity="high",
                columns=["email"],
                estimated_impact={"storage_waste_pct": 15.0},
                suggestions=["Drop dup_idx"],
            ),
            IndexIssue(
                issue_type=IndexIssueType.UNUSED,
                table_name="products",
                index_name="unused_idx",
                description="Index appears unused",
                severity="low",
                columns=["phone"],
                estimated_impact={},
                suggestions=["Review if needed"],
            ),
        ]
        
        candidates = [
            CandidateIndex(
                index_name="idx_users_status",
                table_name="users",
                columns=["status", "created_at"],
                index_type=IndexType.BTREE,
                estimated_coverage_queries=200,
                estimated_performance_improvement_pct=70.0,
                estimated_write_cost_increase_pct=8.0,
                net_score=62.0,
            ),
        ]
        
        result = AnalysisResult(
            schema_name="test",
            database_type=DatabaseType.POSTGRESQL,
            timestamp=datetime.now(),
            tables_analyzed=3,
            queries_analyzed=75,
            issues=issues,
            candidate_indexes=candidates,
            summary={},
            recommendations=["Drop duplicate indexes first"],
        )
        
        exporter = ReportExporter()
        content = exporter.export(result, ReportFormat.MARKDOWN)
        
        assert "# " in content
        assert "## " in content
        assert "| " in content
        assert "duplicate" in content.lower()
        assert "idx_users_status" in content
    
    def test_export_with_simulation_results(self):
        issue = IndexIssue(
            issue_type=IndexIssueType.MISSING,
            table_name="orders",
            index_name=None,
            description="Missing index",
            severity="high",
            columns=["user_id"],
            estimated_impact={},
            suggestions=["Add index"],
        )
        
        candidate = CandidateIndex(
            index_name="idx_orders_user",
            table_name="orders",
            columns=["user_id"],
            index_type=IndexType.BTREE,
        )
        
        simulation = SimulationResult(
            candidate_index=candidate,
            before_stats={"indexes_count": 3},
            after_stats={"indexes_count": 4},
            query_improvements=[
                {
                    "query_id": "q1",
                    "original_execution_time_ms": 5000,
                    "estimated_execution_time_ms": 500,
                    "improvement_pct": 90.0,
                    "reason": "Index covers columns",
                },
            ],
            write_cost_analysis={
                "estimated_increase_pct": 10.0,
                "risk_level": "medium",
            },
            overall_score_change=80.0,
        )
        
        result = AnalysisResult(
            schema_name="test",
            database_type=DatabaseType.MYSQL,
            timestamp=datetime.now(),
            tables_analyzed=1,
            queries_analyzed=1,
            issues=[issue],
            candidate_indexes=[candidate],
            summary={},
            recommendations=[],
        )
        
        exporter = ReportExporter()
        
        json_content = exporter.export(result, ReportFormat.JSON, [simulation])
        json_data = json.loads(json_content)
        assert "simulations" in json_data
        
        md_content = exporter.export(result, ReportFormat.MARKDOWN, [simulation])
        assert "模拟" in md_content or "simulation" in md_content.lower()


class TestIssueOnlyExport:
    def test_export_issues_only_json(self):
        issues = [
            IndexIssue(
                issue_type=IndexIssueType.INEFFICIENT,
                table_name="products",
                index_name="wide_idx",
                description="Wide index with 6 columns",
                severity="low",
                columns=["a", "b", "c", "d", "e", "f"],
                estimated_impact={"write_overhead_pct": 18.0},
                suggestions=["Reduce columns"],
            ),
        ]
        
        exporter = ReportExporter()
        content = exporter.export_issues_only(issues, ReportFormat.JSON)
        
        data = json.loads(content)
        assert len(data) == 1
        assert data[0]["table_name"] == "products"
    
    def test_export_issues_only_csv(self):
        issues = [
            IndexIssue(
                issue_type=IndexIssueType.REDUNDANT,
                table_name="users",
                index_name="idx_redundant",
                description="Redundant",
                severity="medium",
                columns=["col1"],
                estimated_impact={},
                suggestions=["Drop"],
            ),
        ]
        
        exporter = ReportExporter()
        content = exporter.export_issues_only(issues, ReportFormat.CSV)
        
        assert "idx_redundant" in content
        assert "Redundant" in content or "redundant" in content


class TestCandidateOnlyExport:
    def test_export_candidates_only_json(self):
        candidates = [
            CandidateIndex(
                index_name="idx_test",
                table_name="test_table",
                columns=["col1", "col2"],
                index_type=IndexType.BTREE,
                estimated_coverage_queries=50,
                estimated_performance_improvement_pct=40.0,
                estimated_write_cost_increase_pct=5.0,
                net_score=35.0,
            ),
        ]
        
        exporter = ReportExporter()
        content = exporter.export_candidates_only(candidates, ReportFormat.JSON)
        
        data = json.loads(content)
        assert len(data) == 1
        assert data[0]["index_name"] == "idx_test"
    
    def test_export_candidates_only_markdown(self):
        candidates = [
            CandidateIndex(
                index_name="idx_users_email",
                table_name="users",
                columns=["email"],
                index_type=IndexType.BTREE,
                estimated_coverage_queries=100,
                estimated_performance_improvement_pct=60.0,
                estimated_write_cost_increase_pct=3.0,
                net_score=57.0,
            ),
            CandidateIndex(
                index_name="idx_orders_status",
                table_name="orders",
                columns=["status", "created_at"],
                index_type=IndexType.BTREE,
                estimated_coverage_queries=200,
                estimated_performance_improvement_pct=75.0,
                estimated_write_cost_increase_pct=8.0,
                net_score=67.0,
            ),
        ]
        
        exporter = ReportExporter()
        content = exporter.export_candidates_only(candidates, ReportFormat.MARKDOWN)
        
        assert "# " in content
        assert "idx_users_email" in content
        assert "idx_orders_status" in content
        assert "net_score" in content.lower() or "净得分" in content


class TestSeverityBadges:
    def test_severity_badge_in_markdown(self):
        issues = [
            IndexIssue(
                issue_type=IndexIssueType.MISSING,
                table_name="t",
                index_name=None,
                description="Critical issue",
                severity="critical",
                columns=["c"],
                estimated_impact={},
                suggestions=[],
            ),
            IndexIssue(
                issue_type=IndexIssueType.MISSING,
                table_name="t",
                index_name=None,
                description="High issue",
                severity="high",
                columns=["c"],
                estimated_impact={},
                suggestions=[],
            ),
            IndexIssue(
                issue_type=IndexIssueType.MISSING,
                table_name="t",
                index_name=None,
                description="Medium issue",
                severity="medium",
                columns=["c"],
                estimated_impact={},
                suggestions=[],
            ),
            IndexIssue(
                issue_type=IndexIssueType.MISSING,
                table_name="t",
                index_name=None,
                description="Low issue",
                severity="low",
                columns=["c"],
                estimated_impact={},
                suggestions=[],
            ),
        ]
        
        result = AnalysisResult(
            schema_name="test",
            database_type=DatabaseType.MYSQL,
            timestamp=datetime.now(),
            tables_analyzed=1,
            queries_analyzed=0,
            issues=issues,
            candidate_indexes=[],
            summary={},
            recommendations=[],
        )
        
        exporter = ReportExporter()
        content = exporter.export(result, ReportFormat.MARKDOWN)
        
        assert "Critical" in content or "critical" in content
        assert "High" in content or "high" in content
        assert "Medium" in content or "medium" in content
        assert "Low" in content or "low" in content
