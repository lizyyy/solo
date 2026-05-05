"""核心分析器 - 整合所有组件进行完整分析。"""

import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import (
    AnalysisResult,
    MigrationFile,
    ReleaseWindow,
    TableStats,
)
from .ddl_parser import DDLParser
from .risk_analyzer import RiskAnalyzer
from .plan_generator import PlanGenerator
from .data_loader import DataLoader


class MigrationAnalyzer:
    """迁移分析器。"""

    def __init__(
        self,
        ddl_parser: Optional[DDLParser] = None,
        risk_analyzer: Optional[RiskAnalyzer] = None,
        plan_generator: Optional[PlanGenerator] = None,
        data_loader: Optional[DataLoader] = None,
    ) -> None:
        self._ddl_parser = ddl_parser or DDLParser()
        self._risk_analyzer = risk_analyzer or RiskAnalyzer()
        self._plan_generator = plan_generator or PlanGenerator()
        self._data_loader = data_loader or DataLoader(self._ddl_parser)

    def analyze(
        self,
        migrations_dir: Optional[str | Path] = None,
        schema_path: Optional[str | Path] = None,
        table_stats_path: Optional[str | Path] = None,
        release_window_path: Optional[str | Path] = None,
        pg_stat_activity_path: Optional[str | Path] = None,
        include_plan: bool = True,
    ) -> AnalysisResult:
        """执行完整分析。

        Args:
            migrations_dir: 迁移目录
            schema_path: schema.sql 路径
            table_stats_path: 表统计 CSV 路径
            release_window_path: 发布窗口 YAML 路径
            pg_stat_activity_path: pg_stat_activity 数据路径
            include_plan: 是否生成执行计划

        Returns:
            分析结果
        """
        analysis_id = str(uuid.uuid4())
        generated_at = datetime.now()

        migration_files: list[MigrationFile] = []
        table_stats: dict[str, TableStats] = {}
        release_window: Optional[ReleaseWindow] = None
        pg_stat_activity_data: list[dict] = []

        if migrations_dir:
            try:
                migration_files = self._data_loader.load_migrations(migrations_dir)
            except FileNotFoundError:
                pass

        if table_stats_path:
            try:
                table_stats = self._data_loader.load_table_stats(table_stats_path)
            except FileNotFoundError:
                pass

        if release_window_path:
            try:
                release_window = self._data_loader.load_release_window(release_window_path)
            except FileNotFoundError:
                pass

        if pg_stat_activity_path:
            try:
                pg_stat_activity_data = self._data_loader.load_pg_stat_activity(
                    pg_stat_activity_path
                )
            except FileNotFoundError:
                pass

        all_operations = []
        for mf in migration_files:
            all_operations.extend(mf.operations)

        risk_findings = self._risk_analyzer.analyze_operations(
            all_operations, table_stats, migration_files
        )

        lock_wait_chains = self._risk_analyzer.analyze_lock_wait_chains(
            pg_stat_activity_data
        )

        long_transactions = self._risk_analyzer.analyze_long_transactions(
            pg_stat_activity_data
        )

        execution_plan = None
        if include_plan and migration_files:
            execution_plan = self._plan_generator.generate_plan(
                migration_files=migration_files,
                operations=all_operations,
                risk_findings=risk_findings,
                table_stats=table_stats,
                release_window=release_window,
            )

        summary = self._build_summary(
            migration_files=migration_files,
            all_operations=all_operations,
            risk_findings=risk_findings,
            lock_wait_chains=lock_wait_chains,
            long_transactions=long_transactions,
            table_stats=table_stats,
        )

        return AnalysisResult(
            analysis_id=analysis_id,
            generated_at=generated_at,
            migration_files=migration_files,
            all_operations=all_operations,
            risk_findings=risk_findings,
            lock_wait_chains=lock_wait_chains,
            long_transactions=long_transactions,
            table_stats=table_stats,
            release_window=release_window,
            execution_plan=execution_plan,
            summary=summary,
        )

    def scan(
        self,
        migrations_dir: str | Path,
        table_stats_path: Optional[str | Path] = None,
    ) -> AnalysisResult:
        """执行扫描模式（仅扫描迁移文件，不生成完整计划）。

        Args:
            migrations_dir: 迁移目录
            table_stats_path: 表统计 CSV 路径

        Returns:
            分析结果
        """
        return self.analyze(
            migrations_dir=migrations_dir,
            table_stats_path=table_stats_path,
            include_plan=False,
        )

    def plan(
        self,
        migrations_dir: str | Path,
        table_stats_path: Optional[str | Path] = None,
        release_window_path: Optional[str | Path] = None,
    ) -> AnalysisResult:
        """执行计划模式（生成完整执行计划）。

        Args:
            migrations_dir: 迁移目录
            table_stats_path: 表统计 CSV 路径
            release_window_path: 发布窗口 YAML 路径

        Returns:
            分析结果
        """
        return self.analyze(
            migrations_dir=migrations_dir,
            table_stats_path=table_stats_path,
            release_window_path=release_window_path,
            include_plan=True,
        )

    def replay(
        self,
        migrations_dir: str | Path,
        pg_stat_activity_path: str | Path,
        table_stats_path: Optional[str | Path] = None,
    ) -> AnalysisResult:
        """执行重放模式（分析锁等待链和长事务冲突）。

        Args:
            migrations_dir: 迁移目录
            pg_stat_activity_path: pg_stat_activity 数据路径
            table_stats_path: 表统计 CSV 路径

        Returns:
            分析结果
        """
        return self.analyze(
            migrations_dir=migrations_dir,
            table_stats_path=table_stats_path,
            pg_stat_activity_path=pg_stat_activity_path,
            include_plan=True,
        )

    def _build_summary(
        self,
        migration_files: list[MigrationFile],
        all_operations: list,
        risk_findings: list,
        lock_wait_chains: list,
        long_transactions: list,
        table_stats: dict,
    ) -> dict:
        """构建摘要信息。"""
        from .models import RiskLevel

        risk_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
        }
        for rf in risk_findings:
            risk_counts[rf.risk_level.value] = risk_counts.get(rf.risk_level.value, 0) + 1

        ddl_type_counts: dict[str, int] = {}
        for op in all_operations:
            ddl_type = op.ddl_type.value
            ddl_type_counts[ddl_type] = ddl_type_counts.get(ddl_type, 0) + 1

        total_size_bytes = sum(ts.size_bytes for ts in table_stats.values())
        total_rows = sum(ts.row_count for ts in table_stats.values())

        return {
            "migration_files_count": len(migration_files),
            "operations_count": len(all_operations),
            "risk_counts": risk_counts,
            "ddl_type_counts": ddl_type_counts,
            "lock_wait_chains_count": len(lock_wait_chains),
            "long_transactions_count": len(long_transactions),
            "tables_count": len(table_stats),
            "total_size_bytes": total_size_bytes,
            "total_size_mb": total_size_bytes / (1024 * 1024),
            "total_rows": total_rows,
        }
