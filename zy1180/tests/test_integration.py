"""Integration tests for the migration scanner."""

import pytest
from pathlib import Path
import tempfile
import json

from pg_migration_scanner.analyzer import MigrationAnalyzer
from pg_migration_scanner.exporter import ReportExporter
from pg_migration_scanner.data_loader import DataLoader
from pg_migration_scanner.models import RiskLevel


class TestIntegration:
    """Integration tests."""

    def test_analyze_example_migrations(self, examples_dir: Path) -> None:
        """Test analyzing the example migrations."""
        migrations_dir = examples_dir / "migrations"
        table_stats_path = examples_dir / "table-stats.csv"

        analyzer = MigrationAnalyzer()
        result = analyzer.scan(
            migrations_dir=migrations_dir,
            table_stats_path=table_stats_path,
        )

        assert len(result.migration_files) == 5
        assert len(result.all_operations) > 0
        assert len(result.risk_findings) > 0

        critical_count = sum(
            1 for f in result.risk_findings
            if f.risk_level == RiskLevel.CRITICAL
        )
        high_count = sum(
            1 for f in result.risk_findings
            if f.risk_level == RiskLevel.HIGH
        )

        assert critical_count > 0
        assert high_count > 0

    def test_analyze_bad_migrations(self, bad_migrations_dir: Path, test_data_dir: Path) -> None:
        """Test analyzing the bad migrations."""
        table_stats_path = test_data_dir / "table_stats_large.csv"

        analyzer = MigrationAnalyzer()
        result = analyzer.scan(
            migrations_dir=bad_migrations_dir,
            table_stats_path=table_stats_path,
        )

        assert len(result.migration_files) == 5

        missing_concurrently = [
            f for f in result.risk_findings
            if f.category == "missing_concurrently"
        ]
        assert len(missing_concurrently) > 0

        irreversible = [
            f for f in result.risk_findings
            if f.category == "irreversible_operation"
        ]
        assert len(irreversible) > 0

    def test_generate_execution_plan(self, examples_dir: Path) -> None:
        """Test generating an execution plan."""
        migrations_dir = examples_dir / "migrations"
        table_stats_path = examples_dir / "table-stats.csv"
        release_window_path = examples_dir / "release-window.yaml"

        analyzer = MigrationAnalyzer()
        result = analyzer.plan(
            migrations_dir=migrations_dir,
            table_stats_path=table_stats_path,
            release_window_path=release_window_path,
        )

        assert result.execution_plan is not None
        assert len(result.execution_plan.steps) > 0
        assert result.execution_plan.total_estimated_duration_minutes > 0

    def test_export_markdown(self, examples_dir: Path) -> None:
        """Test exporting markdown report."""
        migrations_dir = examples_dir / "migrations"
        table_stats_path = examples_dir / "table-stats.csv"

        analyzer = MigrationAnalyzer()
        result = analyzer.scan(
            migrations_dir=migrations_dir,
            table_stats_path=table_stats_path,
        )

        exporter = ReportExporter()

        with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
            output_path = Path(f.name)

        try:
            markdown = exporter.export_markdown(result, output_path)

            assert len(markdown) > 0
            assert "# PostgreSQL 迁移脚本风险分析报告" in markdown
            assert "风险统计" in markdown

            assert output_path.exists()
            content = output_path.read_text(encoding="utf-8")
            assert len(content) > 0
        finally:
            if output_path.exists():
                output_path.unlink()

    def test_export_json(self, examples_dir: Path) -> None:
        """Test exporting JSON report."""
        migrations_dir = examples_dir / "migrations"
        table_stats_path = examples_dir / "table-stats.csv"

        analyzer = MigrationAnalyzer()
        result = analyzer.scan(
            migrations_dir=migrations_dir,
            table_stats_path=table_stats_path,
        )

        exporter = ReportExporter()

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            output_path = Path(f.name)

        try:
            json_str = exporter.export_json(result, output_path)

            assert len(json_str) > 0

            data = json.loads(json_str)
            assert "analysis_id" in data
            assert "migration_files" in data
            assert "risk_findings" in data

            assert output_path.exists()
            with open(output_path, "r", encoding="utf-8") as f:
                file_data = json.load(f)
                assert file_data["analysis_id"] == data["analysis_id"]
        finally:
            if output_path.exists():
                output_path.unlink()

    def test_replay_analysis(self, examples_dir: Path) -> None:
        """Test replay analysis with pg_stat_activity data."""
        migrations_dir = examples_dir / "migrations"
        pg_stat_activity_path = examples_dir / "pg_stat_activity.json"
        table_stats_path = examples_dir / "table-stats.csv"

        analyzer = MigrationAnalyzer()
        result = analyzer.replay(
            migrations_dir=migrations_dir,
            pg_stat_activity_path=pg_stat_activity_path,
            table_stats_path=table_stats_path,
        )

        assert len(result.lock_wait_chains) > 0 or len(result.long_transactions) > 0

    def test_data_loader(self, examples_dir: Path) -> None:
        """Test data loader."""
        loader = DataLoader()

        migrations = loader.load_migrations(examples_dir / "migrations")
        assert len(migrations) == 5

        table_stats = loader.load_table_stats(examples_dir / "table-stats.csv")
        assert len(table_stats) > 0

        release_window = loader.load_release_window(examples_dir / "release-window.yaml")
        assert release_window.environment == "production"

        pg_stat_activity = loader.load_pg_stat_activity(examples_dir / "pg_stat_activity.json")
        assert len(pg_stat_activity) == 5
