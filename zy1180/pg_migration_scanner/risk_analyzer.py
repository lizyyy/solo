"""风险分析引擎 - 识别 DDL 操作中的各种风险。"""

import re
from datetime import datetime
from typing import Optional

from .models import (
    DDLType,
    DDLOperation,
    LockMode,
    LockWaitChain,
    LongTransaction,
    MigrationFile,
    RiskFinding,
    RiskLevel,
    TableStats,
)


class RiskAnalyzer:
    """风险分析引擎。"""

    CRITICAL_DDL_TYPES = {
        DDLType.DROP_TABLE,
        DDLType.TRUNCATE,
        DDLType.RENAME,
        DDLType.DROP_COLUMN,
        DDLType.ALTER_COLUMN,
    }

    HIGH_RISK_DDL_TYPES = {
        DDLType.ADD_CONSTRAINT,
        DDLType.DROP_CONSTRAINT,
    }

    NON_CONCURRENT_INDEX_TYPES = {
        DDLType.CREATE_INDEX,
        DDLType.DROP_INDEX,
    }

    IRREVERSIBLE_DDL_TYPES = {
        DDLType.DROP_TABLE,
        DDLType.DROP_INDEX,
        DDLType.DROP_COLUMN,
        DDLType.TRUNCATE,
    }

    ALTER_COLUMN_TYPES_WITH_TABLE_REWRITE = {
        "TEXT",
        "VARCHAR",
        "CHAR",
        "TIMESTAMP",
        "TIMESTAMPTZ",
        "DATE",
        "TIME",
        "TIMETZ",
        "INTERVAL",
        "NUMERIC",
        "DECIMAL",
    }

    def analyze_operations(
        self,
        operations: list[DDLOperation],
        table_stats: dict[str, TableStats],
        migration_files: list[MigrationFile],
    ) -> list[RiskFinding]:
        """分析 DDL 操作，识别风险。

        Args:
            operations: DDL 操作列表
            table_stats: 表统计信息
            migration_files: 迁移文件列表

        Returns:
            风险发现列表
        """
        findings: list[RiskFinding] = []

        for op in operations:
            findings.extend(self._analyze_single_operation(op, table_stats))

        findings.extend(self._analyze_transactional_issues(operations, migration_files))
        findings.extend(self._analyze_lock_conflicts(operations))

        return findings

    def analyze_lock_wait_chains(
        self, pg_stat_activity_data: list[dict]
    ) -> list[LockWaitChain]:
        """从 pg_stat_activity 数据中分析锁等待链。

        Args:
            pg_stat_activity_data: pg_stat_activity 查询结果

        Returns:
            锁等待链列表
        """
        chains: list[LockWaitChain] = []

        waiting_sessions = [
            row for row in pg_stat_activity_data
            if row.get("wait_event_type") == "Lock" or row.get("wait_event") in ["Lock", "relation"]
        ]

        for i, blocked in enumerate(waiting_sessions):
            blocking_pid = self._find_blocking_pid(blocked, pg_stat_activity_data)
            if blocking_pid is None:
                continue

            blocking = next(
                (row for row in pg_stat_activity_data if row.get("pid") == blocking_pid),
                None,
            )
            if blocking is None:
                continue

            chain = LockWaitChain(
                chain_id=f"chain_{i+1}",
                blocked_pid=int(blocked.get("pid", 0)),
                blocking_pid=int(blocking_pid),
                wait_event=str(blocked.get("wait_event", "unknown")),
                locked_object=self._extract_locked_object(blocked),
                lock_mode=self._infer_lock_mode(blocked),
                blocked_query=str(blocked.get("query", "")[:200]),
                blocking_query=str(blocking.get("query", "")[:200]),
                duration_seconds=float(
                    blocked.get("wait_duration_seconds", 0)
                    or self._calculate_duration(blocked)
                ),
            )
            chains.append(chain)

        return chains

    def analyze_long_transactions(
        self,
        pg_stat_activity_data: list[dict],
        threshold_seconds: float = 300.0,
    ) -> list[LongTransaction]:
        """分析长事务。

        Args:
            pg_stat_activity_data: pg_stat_activity 查询结果
            threshold_seconds: 长事务阈值（秒）

        Returns:
            长事务列表
        """
        long_txns: list[LongTransaction] = []

        for row in pg_stat_activity_data:
            duration = self._calculate_transaction_duration(row)
            if duration >= threshold_seconds:
                txn = LongTransaction(
                    pid=int(row.get("pid", 0)),
                    duration_seconds=duration,
                    query=str(row.get("query", "")[:200]),
                    state=str(row.get("state", "unknown")),
                    usename=str(row.get("usename", "unknown")),
                    application_name=str(row.get("application_name", "unknown")),
                    lock_held=self._infer_lock_mode(row),
                )
                long_txns.append(txn)

        return long_txns

    def _analyze_single_operation(
        self, op: DDLOperation, table_stats: dict[str, TableStats]
    ) -> list[RiskFinding]:
        """分析单个 DDL 操作的风险。"""
        findings: list[RiskFinding] = []

        if op.ddl_type in self.CRITICAL_DDL_TYPES:
            findings.append(self._create_critical_ddl_finding(op))

        if op.ddl_type in self.HIGH_RISK_DDL_TYPES:
            findings.append(self._create_high_risk_ddl_finding(op))

        if op.ddl_type in self.NON_CONCURRENT_INDEX_TYPES and not op.is_concurrently:
            findings.append(self._create_missing_concurrently_finding(op))

        if op.ddl_type in self.IRREVERSIBLE_DDL_TYPES:
            findings.append(self._create_irreversible_finding(op))

        if op.lock_mode == LockMode.ACCESS_EXCLUSIVE:
            findings.append(self._create_access_exclusive_lock_finding(op, table_stats))

        if op.ddl_type == DDLType.ALTER_COLUMN:
            findings.extend(self._analyze_alter_column_type(op, table_stats))

        if op.ddl_type == DDLType.ADD_CONSTRAINT:
            findings.extend(self._analyze_add_constraint(op, table_stats))

        return findings

    def _create_critical_ddl_finding(self, op: DDLOperation) -> RiskFinding:
        """创建高危 DDL 风险发现。"""
        return RiskFinding(
            risk_level=RiskLevel.CRITICAL,
            category="critical_ddl",
            title=f"高危 DDL 操作: {op.ddl_type}",
            description=f"检测到高危 DDL 操作 {op.ddl_type}，此操作需要 ACCESS EXCLUSIVE 锁，可能长时间阻塞所有读写操作。",
            affected_object=op.table_name,
            suggested_fix=f"考虑是否必须执行此操作。如果是，建议在维护窗口执行，并准备好回滚方案。",
            metadata={
                "ddl_type": op.ddl_type.value,
                "lock_mode": op.lock_mode.value,
                "sql": op.raw_sql[:200],
            },
        )

    def _create_high_risk_ddl_finding(self, op: DDLOperation) -> RiskFinding:
        """创建高风险 DDL 风险发现。"""
        return RiskFinding(
            risk_level=RiskLevel.HIGH,
            category="high_risk_ddl",
            title=f"高风险 DDL 操作: {op.ddl_type}",
            description=f"检测到高风险 DDL 操作 {op.ddl_type}，此操作需要 ACCESS EXCLUSIVE 锁，可能阻塞读写操作。",
            affected_object=op.table_name,
            suggested_fix=f"评估表大小，考虑在低峰期或维护窗口执行。",
            metadata={
                "ddl_type": op.ddl_type.value,
                "lock_mode": op.lock_mode.value,
                "sql": op.raw_sql[:200],
            },
        )

    def _create_missing_concurrently_finding(self, op: DDLOperation) -> RiskFinding:
        """创建缺少 CONCURRENTLY 风险发现。"""
        if op.ddl_type == DDLType.CREATE_INDEX:
            suggested_fix = "使用 CREATE INDEX CONCURRENTLY 代替 CREATE INDEX，避免长时间阻塞写入。"
        else:
            suggested_fix = "使用 DROP INDEX CONCURRENTLY 代替 DROP INDEX，避免长时间阻塞写入。"

        return RiskFinding(
            risk_level=RiskLevel.HIGH,
            category="missing_concurrently",
            title=f"缺少 CONCURRENTLY 选项: {op.ddl_type}",
            description=f"索引操作 {op.index_name or 'unknown'} 未使用 CONCURRENTLY 选项，这会获取 SHARE 锁（CREATE INDEX）或 ACCESS EXCLUSIVE 锁，长时间阻塞写入操作。",
            affected_object=op.table_name or op.index_name or "unknown",
            suggested_fix=suggested_fix,
            metadata={
                "ddl_type": op.ddl_type.value,
                "index_name": op.index_name,
                "table_name": op.table_name,
                "lock_mode": op.lock_mode.value,
                "sql": op.raw_sql[:200],
            },
        )

    def _create_irreversible_finding(self, op: DDLOperation) -> RiskFinding:
        """创建不可逆操作风险发现。"""
        rollback_info = {
            DDLType.DROP_TABLE: "表已删除，数据无法恢复，除非有备份。",
            DDLType.DROP_INDEX: "索引已删除，需要重新创建。",
            DDLType.DROP_COLUMN: "列数据已丢失，无法回滚，除非有备份。",
            DDLType.TRUNCATE: "表数据已清空，无法恢复，除非有备份。",
        }

        return RiskFinding(
            risk_level=RiskLevel.CRITICAL,
            category="irreversible_operation",
            title=f"不可逆操作: {op.ddl_type}",
            description=f"检测到不可逆操作 {op.ddl_type}。{rollback_info.get(op.ddl_type, '此操作无法简单回滚。')}",
            affected_object=op.table_name,
            suggested_fix="在执行前确保有完整备份。考虑是否可以使用软删除或其他方式替代。",
            metadata={
                "ddl_type": op.ddl_type.value,
                "lock_mode": op.lock_mode.value,
                "is_irreversible": True,
                "sql": op.raw_sql[:200],
            },
        )

    def _create_access_exclusive_lock_finding(
        self, op: DDLOperation, table_stats: dict[str, TableStats]
    ) -> RiskFinding:
        """创建 ACCESS EXCLUSIVE 锁风险发现。"""
        table_size_info = ""
        estimated_duration = ""

        table_key = op.table_name.lower()
        if "." in table_key:
            schema, table = table_key.split(".", 1)
            for key, stats in table_stats.items():
                if stats.table_name.lower() == table and stats.schema_name.lower() == schema:
                    table_key = key
                    break

        if table_key in table_stats:
            stats = table_stats[table_key]
            size_mb = stats.size_bytes / (1024 * 1024)
            table_size_info = f"表大小: {size_mb:.2f} MB，行数: {stats.row_count}"
            if size_mb > 1000:
                estimated_duration = f"预计执行时间可能超过 30 分钟"
            elif size_mb > 100:
                estimated_duration = f"预计执行时间可能超过 5 分钟"

        return RiskFinding(
            risk_level=RiskLevel.HIGH,
            category="access_exclusive_lock",
            title=f"ACCESS EXCLUSIVE 锁: {op.ddl_type}",
            description=f"此操作将获取 ACCESS EXCLUSIVE 锁，这会阻塞所有读写操作（包括 SELECT）直到操作完成。{table_size_info} {estimated_duration}",
            affected_object=op.table_name,
            suggested_fix="考虑在维护窗口或低峰期执行。如果是添加列，PostgreSQL 11+ 添加带默认值的列可以瞬间完成。",
            metadata={
                "ddl_type": op.ddl_type.value,
                "lock_mode": op.lock_mode.value,
                "table_size_info": table_size_info,
                "estimated_duration": estimated_duration,
                "sql": op.raw_sql[:200],
            },
        )

    def _analyze_alter_column_type(
        self, op: DDLOperation, table_stats: dict[str, TableStats]
    ) -> list[RiskFinding]:
        """分析 ALTER COLUMN 类型变更的风险。"""
        findings: list[RiskFinding] = []

        sql_lower = op.raw_sql.upper()
        has_type_change = any(
            keyword in sql_lower for keyword in ["TYPE", "USING", "SET DATA TYPE"]
        )

        if has_type_change:
            table_size_info = ""
            table_key = op.table_name.lower()

            if table_key in table_stats:
                stats = table_stats[table_key]
                size_mb = stats.size_bytes / (1024 * 1024)
                table_size_info = f"表大小: {size_mb:.2f} MB"

                if size_mb > 100:
                    findings.append(
                        RiskFinding(
                            risk_level=RiskLevel.CRITICAL,
                            category="alter_column_rewrite",
                            title="ALTER COLUMN 类型变更需要全表重写",
                            description=f"修改列类型通常需要全表重写，这会获取 ACCESS EXCLUSIVE 锁并阻塞所有操作。{table_size_info}",
                            affected_object=op.table_name,
                            suggested_fix="考虑使用 pg_repack 或其他在线模式变更工具，或在维护窗口执行。",
                            metadata={
                                "ddl_type": op.ddl_type.value,
                                "table_size_mb": size_mb,
                                "sql": op.raw_sql[:200],
                            },
                        )
                    )

        return findings

    def _analyze_add_constraint(
        self, op: DDLOperation, table_stats: dict[str, TableStats]
    ) -> list[RiskFinding]:
        """分析添加约束的风险。"""
        findings: list[RiskFinding] = []

        sql_lower = op.raw_sql.upper()
        is_foreign_key = "FOREIGN KEY" in sql_lower
        is_unique = "UNIQUE" in sql_lower or "UNIQUE CONSTRAINT" in sql_lower

        table_key = op.table_name.lower()
        if table_key in table_stats:
            stats = table_stats[table_key]
            size_mb = stats.size_bytes / (1024 * 1024)

            if size_mb > 100:
                if is_foreign_key:
                    findings.append(
                        RiskFinding(
                            risk_level=RiskLevel.HIGH,
                            category="add_foreign_key",
                            title="添加外键约束需要全表扫描",
                            description=f"添加外键约束需要扫描整个表以验证现有数据，这会获取 SHARE ROW EXCLUSIVE 锁，阻塞写入但允许读取。表大小: {size_mb:.2f} MB",
                            affected_object=op.table_name,
                            suggested_fix="考虑先创建 NOT VALID 约束，然后在低峰期 VALIDATE CONSTRAINT。",
                            metadata={
                                "ddl_type": op.ddl_type.value,
                                "table_size_mb": size_mb,
                                "sql": op.raw_sql[:200],
                            },
                        )
                    )

                if is_unique:
                    findings.append(
                        RiskFinding(
                            risk_level=RiskLevel.HIGH,
                            category="add_unique_constraint",
                            title="添加唯一约束需要构建索引",
                            description=f"添加唯一约束会创建唯一索引。如果不使用 CONCURRENTLY，会阻塞写入。表大小: {size_mb:.2f} MB",
                            affected_object=op.table_name,
                            suggested_fix="考虑先使用 CREATE UNIQUE INDEX CONCURRENTLY 创建索引，然后用该索引添加约束。",
                            metadata={
                                "ddl_type": op.ddl_type.value,
                                "table_size_mb": size_mb,
                                "sql": op.raw_sql[:200],
                            },
                        )
                    )

        return findings

    def _analyze_transactional_issues(
        self, operations: list[DDLOperation], migration_files: list[MigrationFile]
    ) -> list[RiskFinding]:
        """分析事务相关的问题。"""
        findings: list[RiskFinding] = []

        non_transactional_ops = [op for op in operations if not op.is_transactional]

        if non_transactional_ops:
            for file in migration_files:
                has_non_transactional = any(
                    op for op in file.operations if not op.is_transactional
                )
                has_other_ops = len(file.operations) > sum(
                    1 for op in file.operations if not op.is_transactional
                )

                if has_non_transactional and has_other_ops:
                    findings.append(
                        RiskFinding(
                            risk_level=RiskLevel.HIGH,
                            category="mixed_transactional_ops",
                            title="混合事务性和非事务性操作",
                            description=f"迁移文件 {file.filename} 中混合了 CONCURRENTLY 索引操作（非事务性）和其他操作。这会导致整个事务失败，因为 CONCURRENTLY 不能在事务块中执行。",
                            affected_object=file.filename,
                            suggested_fix="将 CONCURRENTLY 操作分离到独立的迁移文件中，每个文件只包含一个 CONCURRENTLY 操作。",
                            metadata={
                                "filename": file.filename,
                                "operations": [op.ddl_type.value for op in file.operations],
                            },
                        )
                    )

        return findings

    def _analyze_lock_conflicts(self, operations: list[DDLOperation]) -> list[RiskFinding]:
        """分析锁冲突。"""
        findings: list[RiskFinding] = []

        access_exclusive_ops = [
            op for op in operations
            if op.lock_mode == LockMode.ACCESS_EXCLUSIVE
        ]

        if len(access_exclusive_ops) > 1:
            tables = [op.table_name for op in access_exclusive_ops if op.table_name]
            if tables:
                findings.append(
                    RiskFinding(
                        risk_level=RiskLevel.MEDIUM,
                        category="multiple_access_exclusive",
                        title="多个 ACCESS EXCLUSIVE 锁操作",
                        description=f"检测到 {len(access_exclusive_ops)} 个需要 ACCESS EXCLUSIVE 锁的操作，涉及表: {', '.join(tables)}。如果在同一事务中执行，锁持有时间会累积。",
                        affected_object=", ".join(tables)[:100],
                        suggested_fix="考虑拆分为多个迁移，在低峰期分批执行。",
                        metadata={
                            "operation_count": len(access_exclusive_ops),
                            "tables": tables,
                        },
                    )
                )

        return findings

    def _find_blocking_pid(
        self, blocked: dict, all_sessions: list[dict]
    ) -> Optional[int]:
        """查找阻塞会话的 PID。"""
        blocked_pid = blocked.get("pid")
        if blocked_pid is None:
            return None

        if "blocking_pid" in blocked:
            return int(blocked["blocking_pid"])
        if "blocked_by" in blocked:
            return int(blocked["blocked_by"])

        return None

    def _extract_locked_object(self, session: dict) -> str:
        """从会话信息中提取锁定的对象。"""
        query = str(session.get("query", ""))
        wait_event = str(session.get("wait_event", ""))

        table_match = re.search(r"(?:FROM|INTO|UPDATE|TABLE)\s+(\w+(?:\.\w+)?)", query, re.IGNORECASE)
        if table_match:
            return table_match.group(1)

        return wait_event or "unknown"

    def _infer_lock_mode(self, session: dict) -> LockMode:
        """从会话信息推断锁模式。"""
        query = str(session.get("query", "")).upper()
        state = str(session.get("state", "")).lower()

        if any(keyword in query for keyword in ["ALTER TABLE", "DROP TABLE", "TRUNCATE"]):
            return LockMode.ACCESS_EXCLUSIVE
        elif "CREATE INDEX" in query and "CONCURRENTLY" not in query:
            return LockMode.SHARE
        elif "CREATE INDEX CONCURRENTLY" in query:
            return LockMode.SHARE_UPDATE_EXCLUSIVE
        elif any(keyword in query for keyword in ["INSERT", "UPDATE", "DELETE"]):
            return LockMode.ROW_EXCLUSIVE
        elif "SELECT" in query:
            return LockMode.ACCESS_SHARE

        return LockMode.ACCESS_SHARE

    def _calculate_duration(self, session: dict) -> float:
        """计算会话等待持续时间。"""
        backend_start = session.get("backend_start")
        query_start = session.get("query_start")
        state_change = session.get("state_change")

        now = datetime.now()

        if state_change:
            try:
                if isinstance(state_change, str):
                    dt = datetime.fromisoformat(state_change.replace("Z", "+00:00"))
                    return (now - dt).total_seconds()
                elif isinstance(state_change, datetime):
                    return (now - state_change).total_seconds()
            except (ValueError, TypeError):
                pass

        if query_start:
            try:
                if isinstance(query_start, str):
                    dt = datetime.fromisoformat(query_start.replace("Z", "+00:00"))
                    return (now - dt).total_seconds()
                elif isinstance(query_start, datetime):
                    return (now - query_start).total_seconds()
            except (ValueError, TypeError):
                pass

        return 0.0

    def _calculate_transaction_duration(self, session: dict) -> float:
        """计算事务持续时间。"""
        xact_start = session.get("xact_start")
        if xact_start:
            try:
                now = datetime.now()
                if isinstance(xact_start, str):
                    dt = datetime.fromisoformat(xact_start.replace("Z", "+00:00"))
                    return (now - dt).total_seconds()
                elif isinstance(xact_start, datetime):
                    return (now - xact_start).total_seconds()
            except (ValueError, TypeError):
                pass

        return self._calculate_duration(session)
