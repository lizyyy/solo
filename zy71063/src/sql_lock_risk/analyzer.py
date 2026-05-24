import os
from typing import List, Dict, Optional
import yaml

from .models import (
    AlterStatement, AlterType, LockLevel, RiskLevel,
    RiskFinding, MigrationFile, TableStats, IndexInfo,
    OrderIssue, AnalysisResult
)
from .parser import SQLParser


class LockRiskAnalyzer:
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.parser = SQLParser()
        self.table_stats: Dict[str, TableStats] = {}
        self.index_info: Dict[str, List[IndexInfo]] = {}
        self.exceptions: List[str] = []

    def load_table_stats(self, file_path: str):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"表规模文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            if file_path.endswith(('.yaml', '.yml')):
                data = yaml.safe_load(f)
                for table_name, stats in data.get('tables', {}).items():
                    self.table_stats[table_name] = TableStats(
                        table_name=table_name,
                        row_count=stats.get('row_count', 0),
                        size_mb=stats.get('size_mb', 0.0),
                        has_primary_key=stats.get('has_primary_key', True),
                        engine=stats.get('engine', 'InnoDB')
                    )
            elif file_path.endswith('.csv'):
                import csv
                reader = csv.DictReader(f)
                for row in reader:
                    table_name = row.get('table_name', row.get('table', ''))
                    self.table_stats[table_name] = TableStats(
                        table_name=table_name,
                        row_count=int(row.get('row_count', 0) or 0),
                        size_mb=float(row.get('size_mb', 0) or 0.0),
                        has_primary_key=row.get('has_primary_key', 'true').lower() == 'true',
                        engine=row.get('engine', 'InnoDB')
                    )

    def load_index_info(self, file_path: str):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"索引信息文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            if file_path.endswith(('.yaml', '.yml')):
                data = yaml.safe_load(f)
                for table_name, indexes in data.get('indexes', {}).items():
                    self.index_info[table_name] = [
                        IndexInfo(
                            table_name=table_name,
                            index_name=idx.get('name', ''),
                            columns=idx.get('columns', []),
                            is_unique=idx.get('is_unique', False),
                            is_primary=idx.get('is_primary', False)
                        )
                        for idx in indexes
                    ]

    def load_exceptions(self, file_path: str):
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"例外说明文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            self.exceptions = [line.strip() for line in content.split('\n') if line.strip()]

    def analyze_files(self, file_paths: List[str], migration_order: Optional[List[str]] = None) -> AnalysisResult:
        migration_files: List[MigrationFile] = []
        all_findings: List[RiskFinding] = []
        all_order_issues: List[OrderIssue] = []

        if migration_order:
            ordered_paths = self._order_files(file_paths, migration_order)
        else:
            ordered_paths = sorted(file_paths)

        for file_path in ordered_paths:
            if not os.path.exists(file_path):
                continue
            
            migration = self.parser.parse_file(file_path)
            migration_files.append(migration)
            
            findings = self._analyze_migration(migration)
            all_findings.extend(findings)

        order_issues = self._check_migration_order(migration_files)
        all_order_issues.extend(order_issues)

        rollback_issues = self._check_rollback_scripts(migration_files)
        all_order_issues.extend(rollback_issues)

        exit_code = self._calculate_exit_code(all_findings, all_order_issues)

        summary = self._generate_summary(migration_files, all_findings, all_order_issues)

        return AnalysisResult(
            migration_files=migration_files,
            findings=all_findings,
            order_issues=all_order_issues,
            table_stats=self.table_stats,
            summary=summary,
            exit_code=exit_code
        )

    def _order_files(self, file_paths: List[str], migration_order: List[str]) -> List[str]:
        path_map = {os.path.basename(p): p for p in file_paths}
        ordered = []
        for name in migration_order:
            if name in path_map:
                ordered.append(path_map[name])
            else:
                for p in file_paths:
                    if name in p and p not in ordered:
                        ordered.append(p)
        remaining = [p for p in file_paths if p not in ordered]
        return ordered + remaining

    def _analyze_migration(self, migration: MigrationFile) -> List[RiskFinding]:
        findings: List[RiskFinding] = []
        
        for stmt in migration.statements:
            finding = self._analyze_statement(stmt, migration)
            if finding:
                findings.append(finding)
        
        return findings

    def _analyze_statement(self, stmt: AlterStatement, migration: MigrationFile) -> Optional[RiskFinding]:
        for exception in self.exceptions:
            if exception.lower() in stmt.raw_sql.lower():
                return None

        table_stat = self.table_stats.get(stmt.table_name, TableStats(table_name=stmt.table_name))
        
        lock_level = self._estimate_lock_level(stmt)
        risk_level = self._estimate_risk_level(stmt, lock_level, table_stat)
        reason = self._generate_reason(stmt, lock_level, risk_level, table_stat)
        mitigation = self._generate_mitigation(stmt, lock_level, risk_level)
        estimated_duration = self._estimate_duration(stmt, table_stat)

        return RiskFinding(
            statement=stmt,
            risk_level=risk_level,
            lock_level=lock_level,
            reason=reason,
            mitigation=mitigation,
            estimated_duration_seconds=estimated_duration
        )

    def _estimate_lock_level(self, stmt: AlterStatement) -> LockLevel:
        if stmt.uses_lock_none:
            return LockLevel.METADATA
        
        if stmt.is_concurrent or stmt.is_online:
            return LockLevel.SHARED

        if stmt.uses_algorithm_inplace:
            if stmt.alter_type in (AlterType.ADD_INDEX, AlterType.DROP_INDEX):
                return LockLevel.SHARED

        if stmt.alter_type in (AlterType.RENAME_TABLE, AlterType.RENAME_COLUMN):
            return LockLevel.METADATA

        if stmt.alter_type == AlterType.ALTER_DEFAULT:
            return LockLevel.METADATA

        if stmt.alter_type == AlterType.ADD_COLUMN:
            if stmt.is_nullable:
                return LockLevel.METADATA
            if stmt.has_default:
                return LockLevel.METADATA
            return LockLevel.EXCLUSIVE

        if stmt.alter_type == AlterType.MODIFY_COLUMN:
            return LockLevel.EXCLUSIVE

        if stmt.alter_type == AlterType.DROP_COLUMN:
            return LockLevel.EXCLUSIVE

        if stmt.alter_type in (AlterType.ADD_INDEX, AlterType.DROP_INDEX):
            return LockLevel.EXCLUSIVE

        if stmt.alter_type in (AlterType.ADD_CONSTRAINT, AlterType.DROP_CONSTRAINT):
            return LockLevel.EXCLUSIVE

        return LockLevel.TABLE

    def _estimate_risk_level(self, stmt: AlterStatement, lock_level: LockLevel, 
                             table_stat: TableStats) -> RiskLevel:
        is_large_table = table_stat.row_count > 1000000 or table_stat.size_mb > 1000

        if lock_level in (LockLevel.EXCLUSIVE, LockLevel.TABLE):
            if is_large_table:
                return RiskLevel.CRITICAL
            return RiskLevel.HIGH

        if lock_level == LockLevel.SHARED:
            if is_large_table:
                return RiskLevel.HIGH
            return RiskLevel.MEDIUM

        if lock_level == LockLevel.METADATA:
            if stmt.alter_type in (AlterType.RENAME_TABLE, AlterType.RENAME_COLUMN):
                return RiskLevel.MEDIUM
            return RiskLevel.LOW

        return RiskLevel.SAFE

    def _generate_reason(self, stmt: AlterStatement, lock_level: LockLevel,
                         risk_level: RiskLevel, table_stat: TableStats) -> str:
        reasons = []
        
        reasons.append(f"操作类型: {stmt.alter_type.value}")
        
        lock_desc = {
            LockLevel.METADATA: "元数据锁 (仅阻塞DDL)",
            LockLevel.SHARED: "共享锁 (读不阻塞,写阻塞)",
            LockLevel.EXCLUSIVE: "排他锁 (读写都阻塞)",
            LockLevel.TABLE: "全表锁",
            LockLevel.NONE: "无锁"
        }
        reasons.append(f"锁级别: {lock_desc.get(lock_level, lock_level.value)}")

        if table_stat.row_count > 0:
            reasons.append(f"表行数: {table_stat.row_count:,}")
        if table_stat.size_mb > 0:
            reasons.append(f"表大小: {table_stat.size_mb:.1f} MB")

        if stmt.is_concurrent:
            reasons.append("使用了 CONCURRENT 选项")
        if stmt.is_online:
            reasons.append("使用了 ONLINE 选项")
        if stmt.uses_algorithm_inplace:
            reasons.append("使用了 ALGORITHM=INPLACE")
        if stmt.uses_lock_none:
            reasons.append("使用了 LOCK=NONE")

        return " | ".join(reasons)

    def _generate_mitigation(self, stmt: AlterStatement, lock_level: LockLevel,
                             risk_level: RiskLevel) -> str:
        mitigations = []

        if stmt.alter_type == AlterType.ADD_INDEX and not stmt.is_concurrent:
            mitigations.append("建议使用 CREATE INDEX CONCURRENTLY 或 ALTER TABLE ... ADD INDEX ALGORITHM=INPLACE LOCK=NONE")

        if stmt.alter_type in (AlterType.MODIFY_COLUMN, AlterType.DROP_COLUMN):
            mitigations.append("考虑使用 pt-online-schema-change 或 gh-ost 在线变更工具")
            mitigations.append("在业务低峰期执行")

        if stmt.alter_type == AlterType.ADD_COLUMN:
            if not stmt.is_nullable:
                mitigations.append("建议先允许 NULL,批量回填数据后再设置 NOT NULL")
            if not stmt.is_concurrent and not stmt.uses_algorithm_inplace:
                mitigations.append("添加 ALGORITHM=INPLACE LOCK=NONE 减少锁影响")

        if stmt.alter_type in (AlterType.RENAME_TABLE, AlterType.RENAME_COLUMN):
            mitigations.append("重命名操作很快,但会导致依赖该表/列的查询短暂失败")

        if risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL):
            mitigations.append("必须在业务低峰期执行")
            mitigations.append("执行前备份数据")
            mitigations.append("建议先在测试环境验证")

        return " | ".join(mitigations) if mitigations else "无特殊建议"

    def _estimate_duration(self, stmt: AlterStatement, table_stat: TableStats) -> Optional[int]:
        if table_stat.row_count == 0:
            return None

        if stmt.alter_type in (AlterType.ADD_INDEX, AlterType.DROP_INDEX):
            rows_per_second = 10000
            estimated = int(table_stat.row_count / rows_per_second)
            return max(estimated, 10)

        if stmt.alter_type in (AlterType.MODIFY_COLUMN, AlterType.DROP_COLUMN):
            rows_per_second = 5000
            estimated = int(table_stat.row_count / rows_per_second)
            return max(estimated, 30)

        if stmt.alter_type == AlterType.ADD_COLUMN:
            if stmt.is_nullable and not stmt.has_default:
                return 5
            rows_per_second = 8000
            estimated = int(table_stat.row_count / rows_per_second)
            return max(estimated, 10)

        if stmt.alter_type in (AlterType.RENAME_TABLE, AlterType.RENAME_COLUMN, AlterType.ALTER_DEFAULT):
            return 1

        return None

    def _check_migration_order(self, migrations: List[MigrationFile]) -> List[OrderIssue]:
        issues: List[OrderIssue] = []
        seen_tables: Dict[str, List[str]] = {}

        for mig_idx, migration in enumerate(migrations):
            for stmt_idx, stmt in enumerate(migration.statements):
                table = stmt.table_name
                
                if stmt.alter_type == AlterType.DROP_COLUMN:
                    if table in seen_tables:
                        pass

                if stmt.alter_type == AlterType.RENAME_TABLE:
                    if table in seen_tables:
                        issues.append(OrderIssue(
                            type="rename_order",
                            description=f"表 {table} 在重命名前已有其他操作,可能导致后续迁移失败",
                            migration_file=migration.file_path,
                            statement_index=stmt_idx
                        ))

                if table not in seen_tables:
                    seen_tables[table] = []
                seen_tables[table].append(stmt.alter_type.value)

        return issues

    def _check_rollback_scripts(self, migrations: List[MigrationFile]) -> List[OrderIssue]:
        issues: List[OrderIssue] = []
        
        rollback_keywords = ['rollback', 'revert', 'down_', '_down']
        
        for migration in migrations:
            file_name = os.path.basename(migration.file_path).lower()
            
            is_rollback_file = any(kw in file_name for kw in rollback_keywords)
            
            if is_rollback_file:
                continue
            
            if migration.statements and not migration.has_rollback_script:
                issues.append(OrderIssue(
                    type="missing_rollback",
                    description=f"迁移文件包含 DDL 变更但未找到对应的回滚脚本",
                    migration_file=migration.file_path,
                    statement_index=0
                ))

        return issues

    def _calculate_exit_code(self, findings: List[RiskFinding], 
                             order_issues: List[OrderIssue]) -> int:
        critical_count = sum(1 for f in findings if f.risk_level == RiskLevel.CRITICAL)
        high_count = sum(1 for f in findings if f.risk_level == RiskLevel.HIGH)
        medium_count = sum(1 for f in findings if f.risk_level == RiskLevel.MEDIUM)
        rollback_issues = sum(1 for o in order_issues if o.type == "missing_rollback")

        if critical_count > 0:
            return 3
        if high_count > 0:
            return 2
        if medium_count > 0 or rollback_issues > 0:
            return 1
        return 0

    def _generate_summary(self, migrations: List[MigrationFile], 
                          findings: List[RiskFinding],
                          order_issues: List[OrderIssue]) -> Dict:
        risk_counts = {level.value: 0 for level in RiskLevel}
        lock_counts = {level.value: 0 for level in LockLevel}
        type_counts = {t.value: 0 for t in AlterType}

        for finding in findings:
            risk_counts[finding.risk_level.value] += 1
            lock_counts[finding.lock_level.value] += 1
            type_counts[finding.statement.alter_type.value] += 1

        total_statements = sum(len(m.statements) for m in migrations)
        transaction_wrapped = sum(1 for m in migrations if m.is_wrapped_in_transaction)
        with_rollback = sum(1 for m in migrations if m.has_rollback_script)

        return {
            "total_migrations": len(migrations),
            "total_statements": total_statements,
            "transaction_wrapped": transaction_wrapped,
            "with_rollback_script": with_rollback,
            "risk_levels": risk_counts,
            "lock_levels": lock_counts,
            "alter_types": type_counts,
            "order_issues": len(order_issues),
            "exit_code": self._calculate_exit_code(findings, order_issues)
        }
