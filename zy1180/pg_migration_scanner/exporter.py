"""报告导出器 - 导出 Markdown 和 JSON 格式的分析报告。"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from .models import (
    AnalysisResult,
    ExecutionPlan,
    LockWaitChain,
    LongTransaction,
    RiskFinding,
    RiskLevel,
    TableStats,
)


RISK_LEVEL_EMOJI = {
    RiskLevel.CRITICAL: "🔴",
    RiskLevel.HIGH: "🟠",
    RiskLevel.MEDIUM: "🟡",
    RiskLevel.LOW: "🟢",
}


RISK_LEVEL_LABEL = {
    RiskLevel.CRITICAL: "严重",
    RiskLevel.HIGH: "高",
    RiskLevel.MEDIUM: "中",
    RiskLevel.LOW: "低",
}


class ReportExporter:
    """报告导出器。"""

    def export_markdown(
        self,
        result: AnalysisResult,
        output_path: Optional[str | Path] = None,
    ) -> str:
        """导出 Markdown 格式报告。

        Args:
            result: 分析结果
            output_path: 输出文件路径（可选）

        Returns:
            Markdown 内容
        """
        lines: list[str] = []

        lines.append("# PostgreSQL 迁移脚本风险分析报告")
        lines.append("")
        lines.append(f"**生成时间**: {result.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**分析 ID**: {result.analysis_id}")
        lines.append("")

        lines.append("## 摘要")
        lines.append("")
        lines.append("### 风险统计")
        lines.append("")

        risk_counts = self._count_risks(result.risk_findings)
        lines.append(f"| 风险级别 | 数量 |")
        lines.append(f"|----------|------|")
        for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
            count = risk_counts.get(level, 0)
            emoji = RISK_LEVEL_EMOJI[level]
            label = RISK_LEVEL_LABEL[level]
            lines.append(f"| {emoji} {label} | {count} |")
        lines.append("")

        lines.append("### 操作统计")
        lines.append("")
        lines.append(f"- **迁移文件**: {len(result.migration_files)} 个")
        lines.append(f"- **DDL 操作**: {len(result.all_operations)} 个")
        if result.lock_wait_chains:
            lines.append(f"- **锁等待链**: {len(result.lock_wait_chains)} 个")
        if result.long_transactions:
            lines.append(f"- **长事务**: {len(result.long_transactions)} 个")
        lines.append("")

        if result.risk_findings:
            lines.append("## 风险详情")
            lines.append("")

            for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
                level_risks = [r for r in result.risk_findings if r.risk_level == level]
                if not level_risks:
                    continue

                emoji = RISK_LEVEL_EMOJI[level]
                label = RISK_LEVEL_LABEL[level]
                lines.append(f"### {emoji} {label} 风险 ({len(level_risks)} 个)")
                lines.append("")

                for i, risk in enumerate(level_risks, 1):
                    lines.append(f"#### {i}. {risk.title}")
                    lines.append("")
                    lines.append(f"**分类**: {risk.category}")
                    lines.append(f"**影响对象**: {risk.affected_object}")
                    if risk.location:
                        lines.append(f"**位置**: {risk.location}")
                    lines.append("")
                    lines.append(f"**描述**:")
                    lines.append("")
                    lines.append(f"> {risk.description}")
                    lines.append("")
                    lines.append(f"**建议修复**:")
                    lines.append("")
                    lines.append(f"> {risk.suggested_fix}")
                    lines.append("")

                    if risk.metadata:
                        lines.append("**元数据**:")
                        lines.append("")
                        lines.append("```json")
                        lines.append(json.dumps(risk.metadata, ensure_ascii=False, indent=2))
                        lines.append("```")
                        lines.append("")

        if result.lock_wait_chains:
            lines.append("## 锁等待链")
            lines.append("")

            for chain in result.lock_wait_chains:
                lines.append(f"### {chain.chain_id}")
                lines.append("")
                lines.append(f"| 项目 | 信息 |")
                lines.append(f"|------|------|")
                lines.append(f"| 被阻塞 PID | {chain.blocked_pid} |")
                lines.append(f"| 阻塞 PID | {chain.blocking_pid} |")
                lines.append(f"| 等待事件 | {chain.wait_event} |")
                lines.append(f"| 锁定对象 | {chain.locked_object} |")
                lines.append(f"| 锁模式 | {chain.lock_mode.value} |")
                lines.append(f"| 等待时长 | {chain.duration_seconds:.2f} 秒 |")
                lines.append("")

                lines.append("**被阻塞查询**:")
                lines.append("")
                lines.append("```sql")
                lines.append(chain.blocked_query)
                lines.append("```")
                lines.append("")

                lines.append("**阻塞查询**:")
                lines.append("")
                lines.append("```sql")
                lines.append(chain.blocking_query)
                lines.append("```")
                lines.append("")

        if result.long_transactions:
            lines.append("## 长事务")
            lines.append("")

            for txn in result.long_transactions:
                lines.append(f"### PID {txn.pid}")
                lines.append("")
                lines.append(f"| 项目 | 信息 |")
                lines.append(f"|------|------|")
                lines.append(f"| 持续时间 | {self._format_duration(txn.duration_seconds)} |")
                lines.append(f"| 状态 | {txn.state} |")
                lines.append(f"| 用户 | {txn.usename} |")
                lines.append(f"| 应用 | {txn.application_name} |")
                if txn.lock_held:
                    lines.append(f"| 持有锁 | {txn.lock_held.value} |")
                lines.append("")

                lines.append("**当前查询**:")
                lines.append("")
                lines.append("```sql")
                lines.append(txn.query)
                lines.append("```")
                lines.append("")

        if result.table_stats:
            lines.append("## 表统计信息")
            lines.append("")

            lines.append("| Schema | 表名 | 行数 | 大小 |")
            lines.append("|--------|------|------|------|")

            for key, stats in result.table_stats.items():
                size_mb = stats.size_bytes / (1024 * 1024)
                size_str = f"{size_mb:.2f} MB" if size_mb >= 1 else f"{stats.size_bytes} bytes"
                lines.append(
                    f"| {stats.schema_name} | {stats.table_name} | "
                    f"{stats.row_count:,} | {size_str} |"
                )
            lines.append("")

        if result.execution_plan:
            lines.append("## 执行计划")
            lines.append("")

            plan = result.execution_plan

            lines.append(f"**计划 ID**: {plan.plan_id}")
            lines.append(f"**生成时间**: {plan.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"**预计总时长**: {plan.total_estimated_duration_minutes:.1f} 分钟")
            lines.append(f"**整体风险等级**: {RISK_LEVEL_EMOJI[plan.overall_risk_level]} {RISK_LEVEL_LABEL[plan.overall_risk_level]}")
            lines.append("")

            if plan.warnings:
                lines.append("### ⚠️ 警告")
                lines.append("")
                for warning in plan.warnings:
                    lines.append(f"- {warning}")
                lines.append("")

            if plan.prerequisites:
                lines.append("### ✅ 前置条件")
                lines.append("")
                for prereq in plan.prerequisites:
                    lines.append(f"- [ ] {prereq}")
                lines.append("")

            lines.append("### 执行步骤")
            lines.append("")

            for step in plan.steps:
                step_emoji = RISK_LEVEL_EMOJI[step.risk_level]
                step_label = RISK_LEVEL_LABEL[step.risk_level]

                lines.append(f"#### 步骤 {step.order}: {step.title}")
                lines.append("")
                lines.append(f"- **风险等级**: {step_emoji} {step_label}")
                lines.append(f"- **预计时长**: {step.estimated_duration_minutes:.1f} 分钟")
                lines.append("")

                lines.append("**操作**:")
                lines.append("")
                for op in step.operations:
                    lines.append(f"- {op}")
                lines.append("")

                if step.prerequisites:
                    lines.append("**前置条件**:")
                    lines.append("")
                    for prereq in step.prerequisites:
                        lines.append(f"- {prereq}")
                    lines.append("")

                if step.rollback_instructions:
                    lines.append("**回滚指令**:")
                    lines.append("")
                    lines.append(f"{step.rollback_instructions}")
                    lines.append("")

                if step.notes:
                    lines.append("**注意事项**:")
                    lines.append("")
                    lines.append(f"{step.notes}")
                    lines.append("")

            lines.append("### 回滚策略")
            lines.append("")
            lines.append("```")
            lines.append(plan.rollback_strategy)
            lines.append("```")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append(f"*报告由 pg-migration-scanner 生成于 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")

        markdown_content = "\n".join(lines)

        if output_path:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(markdown_content, encoding="utf-8")

        return markdown_content

    def export_json(
        self,
        result: AnalysisResult,
        output_path: Optional[str | Path] = None,
        indent: int = 2,
    ) -> str:
        """导出 JSON 格式报告。

        Args:
            result: 分析结果
            output_path: 输出文件路径（可选）
            indent: 缩进空格数

        Returns:
            JSON 字符串
        """
        json_data = self._analysis_result_to_dict(result)
        json_str = json.dumps(json_data, ensure_ascii=False, indent=indent, default=str)

        if output_path:
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(json_str, encoding="utf-8")

        return json_str

    def _count_risks(self, risks: list[RiskFinding]) -> dict[RiskLevel, int]:
        """统计各风险级别的数量。"""
        counts: dict[RiskLevel, int] = {}
        for risk in risks:
            counts[risk.risk_level] = counts.get(risk.risk_level, 0) + 1
        return counts

    def _format_duration(self, seconds: float) -> str:
        """格式化持续时间。"""
        if seconds < 60:
            return f"{seconds:.1f} 秒"
        elif seconds < 3600:
            return f"{seconds / 60:.1f} 分钟"
        else:
            return f"{seconds / 3600:.1f} 小时"

    def _analysis_result_to_dict(self, result: AnalysisResult) -> dict[str, Any]:
        """将分析结果转换为字典。"""
        return {
            "analysis_id": result.analysis_id,
            "generated_at": result.generated_at.isoformat(),
            "summary": result.summary,
            "migration_files": [
                {
                    "filename": mf.filename,
                    "filepath": mf.filepath,
                    "version": mf.version,
                    "operations": [
                        {
                            "ddl_type": op.ddl_type.value,
                            "table_name": op.table_name,
                            "schema_name": op.schema_name,
                            "index_name": op.index_name,
                            "is_concurrently": op.is_concurrently,
                            "lock_mode": op.lock_mode.value,
                            "description": op.description,
                        }
                        for op in mf.operations
                    ],
                }
                for mf in result.migration_files
            ],
            "risk_findings": [
                {
                    "risk_level": rf.risk_level.value,
                    "category": rf.category,
                    "title": rf.title,
                    "description": rf.description,
                    "affected_object": rf.affected_object,
                    "suggested_fix": rf.suggested_fix,
                    "location": rf.location,
                    "metadata": rf.metadata,
                }
                for rf in result.risk_findings
            ],
            "lock_wait_chains": [
                {
                    "chain_id": lwc.chain_id,
                    "blocked_pid": lwc.blocked_pid,
                    "blocking_pid": lwc.blocking_pid,
                    "wait_event": lwc.wait_event,
                    "locked_object": lwc.locked_object,
                    "lock_mode": lwc.lock_mode.value,
                    "blocked_query": lwc.blocked_query,
                    "blocking_query": lwc.blocking_query,
                    "duration_seconds": lwc.duration_seconds,
                }
                for lwc in result.lock_wait_chains
            ],
            "long_transactions": [
                {
                    "pid": lt.pid,
                    "duration_seconds": lt.duration_seconds,
                    "query": lt.query,
                    "state": lt.state,
                    "usename": lt.usename,
                    "application_name": lt.application_name,
                    "lock_held": lt.lock_held.value if lt.lock_held else None,
                }
                for lt in result.long_transactions
            ],
            "table_stats": {
                key: {
                    "schema_name": ts.schema_name,
                    "table_name": ts.table_name,
                    "row_count": ts.row_count,
                    "size_bytes": ts.size_bytes,
                    "size_mb": ts.size_bytes / (1024 * 1024),
                    "n_live_tup": ts.n_live_tup,
                    "n_dead_tup": ts.n_dead_tup,
                    "last_vacuum": ts.last_vacuum.isoformat() if ts.last_vacuum else None,
                    "last_analyze": ts.last_analyze.isoformat() if ts.last_analyze else None,
                }
                for key, ts in result.table_stats.items()
            },
            "release_window": (
                {
                    "environment": result.release_window.environment,
                    "allowed_days": result.release_window.allowed_days,
                    "allowed_hours": result.release_window.allowed_hours,
                    "max_duration_minutes": result.release_window.max_duration_minutes,
                    "high_risk_requires_approval": result.release_window.high_risk_requires_approval,
                    "maintenance_window_start": result.release_window.maintenance_window_start,
                    "maintenance_window_end": result.release_window.maintenance_window_end,
                }
                if result.release_window
                else None
            ),
            "execution_plan": (
                {
                    "plan_id": result.execution_plan.plan_id,
                    "generated_at": result.execution_plan.generated_at.isoformat(),
                    "total_estimated_duration_minutes": result.execution_plan.total_estimated_duration_minutes,
                    "overall_risk_level": result.execution_plan.overall_risk_level.value,
                    "warnings": result.execution_plan.warnings,
                    "prerequisites": result.execution_plan.prerequisites,
                    "rollback_strategy": result.execution_plan.rollback_strategy,
                    "steps": [
                        {
                            "step_id": step.step_id,
                            "order": step.order,
                            "title": step.title,
                            "operations": step.operations,
                            "estimated_duration_minutes": step.estimated_duration_minutes,
                            "risk_level": step.risk_level.value,
                            "prerequisites": step.prerequisites,
                            "rollback_instructions": step.rollback_instructions,
                            "notes": step.notes,
                        }
                        for step in result.execution_plan.steps
                    ],
                }
                if result.execution_plan
                else None
            ),
        }
