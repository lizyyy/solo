"""执行计划生成器 - 生成分批上线方案。"""

from datetime import datetime, timedelta
import uuid
from typing import Optional

from .models import (
    DDLOperation,
    ExecutionPlan,
    ExecutionPlanStep,
    MigrationFile,
    ReleaseWindow,
    RiskFinding,
    RiskLevel,
    TableStats,
)


class PlanGenerator:
    """执行计划生成器。"""

    def __init__(self) -> None:
        self._step_counter = 0

    def generate_plan(
        self,
        migration_files: list[MigrationFile],
        operations: list[DDLOperation],
        risk_findings: list[RiskFinding],
        table_stats: dict[str, TableStats],
        release_window: Optional[ReleaseWindow] = None,
    ) -> ExecutionPlan:
        """生成执行计划。

        Args:
            migration_files: 迁移文件列表
            operations: 所有 DDL 操作
            risk_findings: 风险发现列表
            table_stats: 表统计信息
            release_window: 发布窗口配置

        Returns:
            执行计划
        """
        critical_risks = [
            r for r in risk_findings
            if r.risk_level == RiskLevel.CRITICAL
        ]

        groups = self._group_operations(operations, table_stats)

        steps: list[ExecutionPlanStep] = []
        prerequisites: list[str] = []
        warnings: list[str] = []

        prerequisites.extend(self._build_prerequisites(risk_findings, release_window))

        if critical_risks:
            warnings.append(
                f"检测到 {len(critical_risks)} 个严重风险，建议在执行前全部解决。"
            )

        high_risk_operations = [
            op for op in operations
            if op.lock_mode.value in ["ACCESS EXCLUSIVE"]
            or not op.is_concurrently
            and op.ddl_type.value in ["CREATE INDEX", "DROP INDEX"]
        ]
        if high_risk_operations and release_window:
            warnings.append(
                f"有 {len(high_risk_operations)} 个高风险操作，建议在维护窗口执行。"
            )

        step_groups = self._organize_steps(groups, operations, table_stats)

        total_duration = 0.0
        for i, group in enumerate(step_groups):
            step = self._create_step(
                group["operations"],
                i + 1,
                group["group_type"],
                table_stats,
            )
            steps.append(step)
            total_duration += step.estimated_duration_minutes

        overall_risk = self._calculate_overall_risk(risk_findings, operations)

        return ExecutionPlan(
            plan_id=str(uuid.uuid4()),
            generated_at=datetime.now(),
            total_estimated_duration_minutes=total_duration,
            overall_risk_level=overall_risk,
            steps=steps,
            critical_risks=critical_risks,
            warnings=warnings,
            prerequisites=prerequisites,
            rollback_strategy=self._build_rollback_strategy(operations),
        )

    def _group_operations(
        self,
        operations: list[DDLOperation],
        table_stats: dict[str, TableStats],
    ) -> dict[str, list[DDLOperation]]:
        """将操作分组。"""
        groups: dict[str, list[DDLOperation]] = {
            "safe_ddl": [],
            "concurrent_index": [],
            "non_concurrent_index": [],
            "alter_table_safe": [],
            "alter_table_risky": [],
            "irreversible": [],
        }

        for op in operations:
            if op.ddl_type.value in ["CREATE TABLE", "COMMENT", "GRANT", "REVOKE", "CREATE VIEW"]:
                groups["safe_ddl"].append(op)
            elif op.ddl_type.value in ["CREATE INDEX", "DROP INDEX"]:
                if op.is_concurrently:
                    groups["concurrent_index"].append(op)
                else:
                    groups["non_concurrent_index"].append(op)
            elif op.ddl_type.value == "ALTER TABLE":
                groups["alter_table_safe"].append(op)
            elif op.ddl_type.value in ["ADD COLUMN", "ALTER COLUMN", "DROP COLUMN"]:
                table_key = op.table_name.lower()
                if table_key in table_stats:
                    size_mb = table_stats[table_key].size_bytes / (1024 * 1024)
                    if size_mb > 100:
                        groups["alter_table_risky"].append(op)
                    else:
                        groups["alter_table_safe"].append(op)
                else:
                    groups["alter_table_risky"].append(op)
            elif op.ddl_type.value in ["ADD CONSTRAINT", "DROP CONSTRAINT"]:
                table_key = op.table_name.lower()
                if table_key in table_stats:
                    size_mb = table_stats[table_key].size_bytes / (1024 * 1024)
                    if size_mb > 100:
                        groups["alter_table_risky"].append(op)
                    else:
                        groups["alter_table_safe"].append(op)
                else:
                    groups["alter_table_risky"].append(op)
            elif op.ddl_type.value in ["DROP TABLE", "TRUNCATE", "RENAME"]:
                groups["irreversible"].append(op)

        return groups

    def _organize_steps(
        self,
        groups: dict[str, list[DDLOperation]],
        all_operations: list[DDLOperation],
        table_stats: dict[str, TableStats],
    ) -> list[dict]:
        """组织步骤顺序。"""
        steps: list[dict] = []

        if groups["safe_ddl"]:
            steps.append({
                "operations": groups["safe_ddl"],
                "group_type": "safe_ddl",
            })

        if groups["concurrent_index"]:
            for op in groups["concurrent_index"]:
                steps.append({
                    "operations": [op],
                    "group_type": "concurrent_index",
                })

        if groups["non_concurrent_index"]:
            steps.append({
                "operations": groups["non_concurrent_index"],
                "group_type": "non_concurrent_index",
            })

        if groups["alter_table_safe"]:
            steps.append({
                "operations": groups["alter_table_safe"],
                "group_type": "alter_table_safe",
            })

        if groups["alter_table_risky"]:
            for op in groups["alter_table_risky"]:
                steps.append({
                    "operations": [op],
                    "group_type": "alter_table_risky",
                })

        if groups["irreversible"]:
            for op in groups["irreversible"]:
                steps.append({
                    "operations": [op],
                    "group_type": "irreversible",
                })

        return steps

    def _create_step(
        self,
        operations: list[DDLOperation],
        order: int,
        group_type: str,
        table_stats: dict[str, TableStats],
    ) -> ExecutionPlanStep:
        """创建执行计划步骤。"""
        step_id = f"step_{order:03d}"

        titles = {
            "safe_ddl": "执行安全 DDL 操作",
            "concurrent_index": "并发创建/删除索引",
            "non_concurrent_index": "创建/删除索引（非并发）",
            "alter_table_safe": "修改表结构（低风险）",
            "alter_table_risky": "修改表结构（高风险）",
            "irreversible": "执行不可逆操作",
        }

        title = titles.get(group_type, "执行 DDL 操作")

        estimated_duration = self._estimate_duration(operations, table_stats)

        risk_level = self._calculate_step_risk(operations, group_type)

        op_descriptions = [op.description or op.ddl_type.value for op in operations]

        prerequisites: list[str] = []
        rollback_instructions = self._build_step_rollback(operations, group_type)
        notes = self._build_step_notes(operations, group_type, table_stats)

        if group_type == "non_concurrent_index":
            prerequisites.append("确认业务低峰期或维护窗口")
        elif group_type == "alter_table_risky":
            prerequisites.append("确认表已备份")
            prerequisites.append("确认在维护窗口执行")
        elif group_type == "irreversible":
            prerequisites.append("确认完整备份已完成并验证可用")
            prerequisites.append("确认所有相关方已同意执行此操作")

        return ExecutionPlanStep(
            step_id=step_id,
            order=order,
            title=title,
            operations=op_descriptions,
            estimated_duration_minutes=estimated_duration,
            risk_level=risk_level,
            prerequisites=prerequisites,
            rollback_instructions=rollback_instructions,
            notes=notes,
        )

    def _estimate_duration(
        self,
        operations: list[DDLOperation],
        table_stats: dict[str, TableStats],
    ) -> float:
        """估算执行时间（分钟）。"""
        total_minutes = 0.0

        for op in operations:
            table_key = op.table_name.lower()
            size_mb = 0.0

            if table_key in table_stats:
                size_mb = table_stats[table_key].size_bytes / (1024 * 1024)

            if op.ddl_type.value == "CREATE INDEX":
                if op.is_concurrently:
                    total_minutes += max(5.0, size_mb / 100)
                else:
                    total_minutes += max(2.0, size_mb / 200)
            elif op.ddl_type.value == "ALTER TABLE":
                total_minutes += max(1.0, size_mb / 50)
            elif op.ddl_type.value == "ALTER COLUMN":
                total_minutes += max(2.0, size_mb / 30)
            elif op.ddl_type.value == "ADD COLUMN":
                if "DEFAULT" in op.raw_sql.upper():
                    total_minutes += max(1.0, size_mb / 100)
                else:
                    total_minutes += 0.5
            elif op.ddl_type.value in ["DROP TABLE", "TRUNCATE", "DROP INDEX"]:
                total_minutes += 1.0
            else:
                total_minutes += 0.5

        return round(total_minutes, 1)

    def _calculate_step_risk(
        self, operations: list[DDLOperation], group_type: str
    ) -> RiskLevel:
        """计算步骤风险级别。"""
        if group_type in ["irreversible", "alter_table_risky"]:
            return RiskLevel.CRITICAL
        elif group_type in ["non_concurrent_index"]:
            return RiskLevel.HIGH
        elif group_type in ["concurrent_index", "alter_table_safe"]:
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW

    def _calculate_overall_risk(
        self,
        risk_findings: list[RiskFinding],
        operations: list[DDLOperation],
    ) -> RiskLevel:
        """计算整体风险级别。"""
        critical_count = sum(
            1 for r in risk_findings if r.risk_level == RiskLevel.CRITICAL
        )
        high_count = sum(
            1 for r in risk_findings if r.risk_level == RiskLevel.HIGH
        )

        if critical_count > 0:
            return RiskLevel.CRITICAL
        elif high_count > 2:
            return RiskLevel.CRITICAL
        elif high_count > 0:
            return RiskLevel.HIGH
        elif any(r.risk_level == RiskLevel.MEDIUM for r in risk_findings):
            return RiskLevel.MEDIUM
        else:
            return RiskLevel.LOW

    def _build_prerequisites(
        self,
        risk_findings: list[RiskFinding],
        release_window: Optional[ReleaseWindow],
    ) -> list[str]:
        """构建前置条件列表。"""
        prerequisites = [
            "确认数据库备份已完成并验证可用",
            "确认所有相关人员已收到上线通知",
            "确认监控系统正常运行",
            "准备好回滚脚本",
        ]

        critical_risks = [
            r for r in risk_findings
            if r.risk_level == RiskLevel.CRITICAL
        ]
        if critical_risks:
            prerequisites.append("评估并解决所有严重风险后再执行")

        missing_concurrently = [
            r for r in risk_findings
            if r.category == "missing_concurrently"
        ]
        if missing_concurrently:
            prerequisites.append("考虑为索引操作添加 CONCURRENTLY 选项以减少锁影响")

        if release_window:
            prerequisites.append(
                f"确认在允许的发布窗口内执行（{', '.join(release_window.allowed_days)} "
                f"{release_window.allowed_hours} 时）"
            )
            if release_window.high_risk_requires_approval:
                prerequisites.append("高风险操作需要获得审批后再执行")

        return prerequisites

    def _build_step_rollback(
        self, operations: list[DDLOperation], group_type: str
    ) -> str:
        """构建步骤回滚说明。"""
        rollback_parts: list[str] = []

        for op in operations:
            if op.ddl_type.value == "CREATE TABLE":
                rollback_parts.append(f"DROP TABLE IF EXISTS {op.table_name};")
            elif op.ddl_type.value == "CREATE INDEX":
                rollback_parts.append(
                    f"DROP INDEX {'CONCURRENTLY ' if op.is_concurrently else ''}"
                    f"IF EXISTS {op.index_name or 'unknown'};"
                )
            elif op.ddl_type.value == "ADD COLUMN":
                rollback_parts.append(f"ALTER TABLE {op.table_name} DROP COLUMN IF EXISTS ...;")
            elif op.ddl_type.value == "ADD CONSTRAINT":
                rollback_parts.append(f"ALTER TABLE {op.table_name} DROP CONSTRAINT IF EXISTS ...;")
            elif op.ddl_type.value in ["DROP TABLE", "TRUNCATE", "DROP COLUMN"]:
                rollback_parts.append("此操作不可逆，需要从备份恢复。")

        if group_type == "irreversible":
            rollback_parts.insert(0, "警告: 此步骤包含不可逆操作！")

        return " ".join(rollback_parts) if rollback_parts else "无需特殊回滚操作。"

    def _build_step_notes(
        self,
        operations: list[DDLOperation],
        group_type: str,
        table_stats: dict[str, TableStats],
    ) -> str:
        """构建步骤注意事项。"""
        notes: list[str] = []

        if group_type == "concurrent_index":
            notes.append("CONCURRENTLY 操作不能在事务块中执行。")
            notes.append("如果失败，需要先删除无效的索引（INVALID 状态）。")

        if group_type == "alter_table_risky":
            notes.append("此操作可能需要全表重写，会长时间阻塞读写。")
            notes.append("建议在维护窗口执行。")

        if group_type == "non_concurrent_index":
            notes.append("非并发索引操作会阻塞写入。")
            notes.append("建议在低峰期执行。")

        if group_type == "irreversible":
            notes.append("警告: 此步骤包含不可逆操作，执行前请确保有完整备份！")

        for op in operations:
            table_key = op.table_name.lower()
            if table_key in table_stats:
                stats = table_stats[table_key]
                size_mb = stats.size_bytes / (1024 * 1024)
                if size_mb > 1000:
                    notes.append(f"表 {op.table_name} 较大 ({size_mb:.0f} MB)，预计执行时间较长。")

        return " ".join(notes) if notes else ""

    def _build_rollback_strategy(self, operations: list[DDLOperation]) -> str:
        """构建整体回滚策略。"""
        strategy_parts = [
            "整体回滚策略:",
            "",
            "1. 停止所有应用程序写入数据库的操作",
            "2. 检查当前数据库状态，确认哪些迁移已执行",
            "3. 按照迁移顺序的逆序执行回滚",
            "",
        ]

        irreversible = [
            op for op in operations
            if op.ddl_type.value in ["DROP TABLE", "TRUNCATE", "DROP COLUMN"]
        ]

        if irreversible:
            strategy_parts.append("警告: 检测到以下不可逆操作:")
            for op in irreversible:
                strategy_parts.append(f"  - {op.ddl_type.value}: {op.table_name}")
            strategy_parts.append("")
            strategy_parts.append("这些操作无法通过简单的 DDL 回滚，需要:")
            strategy_parts.append("1. 确认最新的完整备份可用")
            strategy_parts.append("2. 在隔离环境测试备份恢复流程")
            strategy_parts.append("3. 如有必要，从备份恢复数据")
            strategy_parts.append("")

        strategy_parts.append("回滚顺序:")
        strategy_parts.append("- 先回滚最后执行的迁移")
        strategy_parts.append("- 索引操作: DROP INDEX (如果是 CREATE) 或 CREATE INDEX (如果是 DROP)")
        strategy_parts.append("- 表结构变更: 执行相反的 ALTER TABLE 语句")
        strategy_parts.append("- 始终在测试环境验证回滚脚本")

        return "\n".join(strategy_parts)
