"""Tests for risk analyzer."""

import pytest

from pg_migration_scanner.risk_analyzer import RiskAnalyzer
from pg_migration_scanner.models import (
    DDLOperation,
    DDLType,
    LockMode,
    MigrationFile,
    RiskLevel,
    TableStats,
)


class TestRiskAnalyzer:
    """Test RiskAnalyzer class."""

    def setup_method(self) -> None:
        """Set up test fixture."""
        self.analyzer = RiskAnalyzer()

    def create_operation(
        self,
        ddl_type: DDLType,
        table_name: str = "test",
        is_concurrently: bool = False,
        lock_mode: LockMode = LockMode.ACCESS_EXCLUSIVE,
        raw_sql: str = "",
    ) -> DDLOperation:
        """Helper to create a DDLOperation."""
        return DDLOperation(
            raw_sql=raw_sql or f"{ddl_type.value} ...",
            ddl_type=ddl_type,
            table_name=table_name,
            is_concurrently=is_concurrently,
            lock_mode=lock_mode,
            description=f"Test {ddl_type.value}",
        )

    def test_analyze_drop_table(self) -> None:
        """Test analyzing DROP TABLE (critical risk)."""
        op = self.create_operation(DDLType.DROP_TABLE, "important_data")
        table_stats: dict[str, TableStats] = {}
        migration_files: list[MigrationFile] = []

        findings = self.analyzer.analyze_operations([op], table_stats, migration_files)

        critical_findings = [f for f in findings if f.risk_level == RiskLevel.CRITICAL]
        assert len(critical_findings) >= 1

        categories = [f.category for f in critical_findings]
        assert "critical_ddl" in categories
        assert "irreversible_operation" in categories
        assert "access_exclusive_lock" in categories

    def test_analyze_truncate(self) -> None:
        """Test analyzing TRUNCATE (critical risk)."""
        op = self.create_operation(DDLType.TRUNCATE, "audit_logs")
        table_stats: dict[str, TableStats] = {}
        migration_files: list[MigrationFile] = []

        findings = self.analyzer.analyze_operations([op], table_stats, migration_files)

        critical_findings = [f for f in findings if f.risk_level == RiskLevel.CRITICAL]
        assert len(critical_findings) >= 1

    def test_analyze_rename(self) -> None:
        """Test analyzing RENAME (critical risk)."""
        op = self.create_operation(DDLType.RENAME, "users")
        table_stats: dict[str, TableStats] = {}
        migration_files: list[MigrationFile] = []

        findings = self.analyzer.analyze_operations([op], table_stats, migration_files)

        critical_findings = [f for f in findings if f.risk_level == RiskLevel.CRITICAL]
        assert len(critical_findings) >= 1

    def test_analyze_missing_concurrently(self) -> None:
        """Test analyzing CREATE INDEX without CONCURRENTLY."""
        op = self.create_operation(
            DDLType.CREATE_INDEX,
            "large_table",
            is_concurrently=False,
            lock_mode=LockMode.SHARE,
        )
        table_stats: dict[str, TableStats] = {}
        migration_files: list[MigrationFile] = []

        findings = self.analyzer.analyze_operations([op], table_stats, migration_files)

        missing_concurrently = [
            f for f in findings if f.category == "missing_concurrently"
        ]
        assert len(missing_concurrently) >= 1
        assert missing_concurrently[0].risk_level == RiskLevel.HIGH

    def test_analyze_with_concurrently(self) -> None:
        """Test analyzing CREATE INDEX with CONCURRENTLY."""
        op = self.create_operation(
            DDLType.CREATE_INDEX,
            "large_table",
            is_concurrently=True,
            lock_mode=LockMode.SHARE_UPDATE_EXCLUSIVE,
        )
        table_stats: dict[str, TableStats] = {}
        migration_files: list[MigrationFile] = []

        findings = self.analyzer.analyze_operations([op], table_stats, migration_files)

        missing_concurrently = [
            f for f in findings if f.category == "missing_concurrently"
        ]
        assert len(missing_concurrently) == 0

    def test_analyze_drop_index_missing_concurrently(self) -> None:
        """Test analyzing DROP INDEX without CONCURRENTLY."""
        op = self.create_operation(
            DDLType.DROP_INDEX,
            "large_table",
            is_concurrently=False,
            lock_mode=LockMode.ACCESS_EXCLUSIVE,
        )
        table_stats: dict[str, TableStats] = {}
        migration_files: list[MigrationFile] = []

        findings = self.analyzer.analyze_operations([op], table_stats, migration_files)

        missing_concurrently = [
            f for f in findings if f.category == "missing_concurrently"
        ]
        assert len(missing_concurrently) >= 1

    def test_analyze_alter_column_large_table(self) -> None:
        """Test analyzing ALTER COLUMN on large table."""
        op = DDLOperation(
            raw_sql="ALTER TABLE orders ALTER COLUMN status TYPE TEXT;",
            ddl_type=DDLType.ALTER_COLUMN,
            table_name="orders",
            lock_mode=LockMode.ACCESS_EXCLUSIVE,
            description="Alter column type",
        )

        table_stats = {
            "orders": TableStats(
                schema_name="public",
                table_name="orders",
                row_count=10000000,
                size_bytes=2 * 1024 * 1024 * 1024,
            )
        }
        migration_files: list[MigrationFile] = []

        findings = self.analyzer.analyze_operations([op], table_stats, migration_files)

        alter_column_rewrite = [
            f for f in findings if f.category == "alter_column_rewrite"
        ]
        assert len(alter_column_rewrite) >= 1
        assert alter_column_rewrite[0].risk_level == RiskLevel.CRITICAL

    def test_analyze_add_constraint_large_table(self) -> None:
        """Test analyzing ADD CONSTRAINT on large table."""
        op = DDLOperation(
            raw_sql="ALTER TABLE orders ADD CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id);",
            ddl_type=DDLType.ADD_CONSTRAINT,
            table_name="orders",
            lock_mode=LockMode.ACCESS_EXCLUSIVE,
            description="Add foreign key constraint",
        )

        table_stats = {
            "orders": TableStats(
                schema_name="public",
                table_name="orders",
                row_count=10000000,
                size_bytes=2 * 1024 * 1024 * 1024,
            )
        }
        migration_files: list[MigrationFile] = []

        findings = self.analyzer.analyze_operations([op], table_stats, migration_files)

        add_foreign_key = [
            f for f in findings if f.category == "add_foreign_key"
        ]
        assert len(add_foreign_key) >= 1

    def test_analyze_access_exclusive_lock(self) -> None:
        """Test analyzing operations with ACCESS EXCLUSIVE lock."""
        op = self.create_operation(
            DDLType.ALTER_TABLE,
            "large_table",
            lock_mode=LockMode.ACCESS_EXCLUSIVE,
        )

        table_stats = {
            "large_table": TableStats(
                schema_name="public",
                table_name="large_table",
                row_count=50000000,
                size_bytes=20 * 1024 * 1024 * 1024,
            )
        }
        migration_files: list[MigrationFile] = []

        findings = self.analyzer.analyze_operations([op], table_stats, migration_files)

        access_exclusive = [
            f for f in findings if f.category == "access_exclusive_lock"
        ]
        assert len(access_exclusive) >= 1

    def test_analyze_lock_wait_chains(self) -> None:
        """Test analyzing lock wait chains from pg_stat_activity."""
        pg_stat_activity_data = [
            {
                "pid": 12345,
                "usename": "app_user",
                "query": "SELECT * FROM orders FOR UPDATE",
                "state": "active",
                "application_name": "webapp",
            },
            {
                "pid": 12346,
                "usename": "migration_user",
                "query": "ALTER TABLE orders ADD COLUMN new_col INT",
                "state": "active",
                "application_name": "flyway",
                "wait_event": "relation",
                "wait_event_type": "Lock",
                "blocking_pid": 12345,
                "wait_duration_seconds": 30.5,
            },
        ]

        chains = self.analyzer.analyze_lock_wait_chains(pg_stat_activity_data)

        assert len(chains) >= 1
        assert chains[0].blocked_pid == 12346
        assert chains[0].blocking_pid == 12345

    def test_analyze_long_transactions(self) -> None:
        """Test analyzing long transactions."""
        from datetime import datetime, timedelta

        now = datetime.now()
        long_ago = now - timedelta(minutes=10)

        pg_stat_activity_data = [
            {
                "pid": 12345,
                "usename": "batch_user",
                "query": "SELECT * FROM large_table FOR UPDATE",
                "state": "idle in transaction",
                "application_name": "batch-processor",
                "xact_start": long_ago.isoformat(),
            },
        ]

        txns = self.analyzer.analyze_long_transactions(
            pg_stat_activity_data,
            threshold_seconds=300.0,
        )

        assert len(txns) >= 1
        assert txns[0].pid == 12345
        assert txns[0].duration_seconds >= 300.0
