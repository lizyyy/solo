import os
import csv
import json
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any

from ..storage.store import DataStore
from ..storage.quarantine import QuarantineManager, QuarantineItem
from ..storage.journal import JournalManager, JournalEntry, AuditLog


@dataclass
class AuditReport:
    report_id: str
    generated_at: str
    audit_period_start: str
    audit_period_end: str
    summary: Dict[str, Any]
    quarantine_items: List[Dict[str, Any]]
    journal_entries: List[Dict[str, Any]]
    import_history: List[Dict[str, Any]]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "generated_at": self.generated_at,
            "audit_period_start": self.audit_period_start,
            "audit_period_end": self.audit_period_end,
            "summary": self.summary,
            "quarantine_items": self.quarantine_items,
            "journal_entries": self.journal_entries,
            "import_history": self.import_history,
        }


class ReportGenerator:
    RULE_ID_TO_NAME = {
        "orphan_account": "孤儿账号",
        "group_drift": "组权限漂移",
        "sudo_overreach": "sudo规则越权",
        "asset_env_mismatch": "资产环境不匹配",
        "duplicate_account": "重复账号",
        "bad_row": "坏数据行",
    }

    SEVERITY_TO_NAME = {
        "critical": "严重",
        "high": "高",
        "medium": "中",
        "low": "低",
    }

    CATEGORY_TO_NAME = {
        "account": "账号",
        "group": "用户组",
        "sudo": "sudo规则",
        "asset": "资产",
        "data_quality": "数据质量",
        "unknown": "未知",
    }

    def __init__(
        self,
        data_store: DataStore,
        quarantine_manager: QuarantineManager,
        journal_manager: JournalManager,
    ):
        self.data_store = data_store
        self.quarantine_manager = quarantine_manager
        self.journal_manager = journal_manager

    def generate_report(
        self,
        period_start: Optional[str] = None,
        period_end: Optional[str] = None,
    ) -> AuditReport:
        now = datetime.now()
        if not period_end:
            period_end = now.isoformat()
        if not period_start:
            from dateutil.relativedelta import relativedelta
            period_start = (now - relativedelta(months=1)).isoformat()

        stats = self.quarantine_manager.get_stats()
        quarantine_items = self.quarantine_manager.items
        journal_entries = self.journal_manager.entries
        import_history = self.data_store.import_history

        summary = self._build_summary(stats, quarantine_items, journal_entries, import_history)

        report = AuditReport(
            report_id=f"REPORT-{now.strftime('%Y%m%d_%H%M%S')}",
            generated_at=now.isoformat(),
            audit_period_start=period_start,
            audit_period_end=period_end,
            summary=summary,
            quarantine_items=[item.to_dict() for item in quarantine_items],
            journal_entries=[entry.to_dict() for entry in journal_entries],
            import_history=[ih.to_dict() for ih in import_history],
        )

        return report

    def _build_summary(
        self,
        stats: Dict[str, Any],
        quarantine_items: List[QuarantineItem],
        journal_entries: List[JournalEntry],
        import_history: List[Any],
    ) -> Dict[str, Any]:
        pending_items = [i for i in quarantine_items if not i.is_remediated]
        remediated_items = [i for i in quarantine_items if i.is_remediated]

        by_rule_pending: Dict[str, int] = {}
        for item in pending_items:
            by_rule_pending[item.rule_id] = by_rule_pending.get(item.rule_id, 0) + 1

        by_severity_pending: Dict[str, int] = {}
        for item in pending_items:
            by_severity_pending[item.severity] = by_severity_pending.get(item.severity, 0) + 1

        operations_by_type: Dict[str, int] = {}
        for entry in journal_entries:
            operations_by_type[entry.entry_type] = operations_by_type.get(entry.entry_type, 0) + 1

        return {
            "total_issues_found": len(quarantine_items),
            "pending_issues": len(pending_items),
            "remediated_issues": len(remediated_items),
            "by_severity": stats.get("by_severity", {}),
            "by_severity_pending": by_severity_pending,
            "by_rule": stats.get("by_rule", {}),
            "by_rule_pending": by_rule_pending,
            "by_category": stats.get("by_category", {}),
            "operations_logged": len(journal_entries),
            "operations_by_type": operations_by_type,
            "imports_count": len(import_history),
        }

    def export_json(self, report: AuditReport, output_path: str) -> None:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)

    def export_csv(self, report: AuditReport, output_dir: str) -> List[str]:
        os.makedirs(output_dir, exist_ok=True)
        generated_files: List[str] = []

        issues_path = os.path.join(output_dir, "issues.csv")
        self._write_issues_csv(issues_path, report.quarantine_items)
        generated_files.append(issues_path)

        journal_path = os.path.join(output_dir, "journal.csv")
        self._write_journal_csv(journal_path, report.journal_entries)
        generated_files.append(journal_path)

        summary_path = os.path.join(output_dir, "summary.csv")
        self._write_summary_csv(summary_path, report.summary)
        generated_files.append(summary_path)

        return generated_files

    def _write_issues_csv(self, path: str, items: List[Dict[str, Any]]) -> None:
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow([
                "序号", "规则ID", "规则名称", "严重程度", "类别",
                "受影响实体", "实体类型", "描述", "发现时间",
                "是否已修复", "修复操作",
            ])

            for idx, item in enumerate(items, 1):
                writer.writerow([
                    idx,
                    item.get("rule_id", ""),
                    self.RULE_ID_TO_NAME.get(item.get("rule_id", ""), item.get("rule_id", "")),
                    self.SEVERITY_TO_NAME.get(item.get("severity", ""), item.get("severity", "")),
                    self.CATEGORY_TO_NAME.get(item.get("category", ""), item.get("category", "")),
                    item.get("affected_entity", ""),
                    item.get("entity_type", ""),
                    item.get("description", ""),
                    item.get("discovered_at", ""),
                    "是" if item.get("is_remediated", False) else "否",
                    item.get("remediation_action", ""),
                ])

    def _write_journal_csv(self, path: str, entries: List[Dict[str, Any]]) -> None:
        TYPE_NAMES = {
            "import": "导入",
            "check": "检查",
            "plan": "计划",
            "apply": "执行",
            "undo": "撤销",
            "report": "报告",
        }

        OPERATION_NAMES = {
            "create": "创建",
            "update": "更新",
            "delete": "删除",
            "import": "导入",
            "scan": "扫描",
            "execute": "执行",
            "revert": "撤销",
        }

        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow([
                "操作ID", "类型", "操作", "时间", "操作者", "描述",
            ])

            for entry in entries:
                writer.writerow([
                    entry.get("entry_id", ""),
                    TYPE_NAMES.get(entry.get("entry_type", ""), entry.get("entry_type", "")),
                    OPERATION_NAMES.get(entry.get("operation", ""), entry.get("operation", "")),
                    entry.get("timestamp", ""),
                    entry.get("user", ""),
                    entry.get("description", ""),
                ])

    def _write_summary_csv(self, path: str, summary: Dict[str, Any]) -> None:
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.writer(f)
            writer.writerow(["统计项", "数值"])
            writer.writerow(["发现问题总数", summary.get("total_issues_found", 0)])
            writer.writerow(["待处理问题", summary.get("pending_issues", 0)])
            writer.writerow(["已修复问题", summary.get("remediated_issues", 0)])
            writer.writerow(["操作日志数量", summary.get("operations_logged", 0)])
            writer.writerow(["数据导入次数", summary.get("imports_count", 0)])
            writer.writerow([])
            writer.writerow(["按严重程度分布"])
            for severity, count in summary.get("by_severity", {}).items():
                writer.writerow([self.SEVERITY_TO_NAME.get(severity, severity), count])
            writer.writerow([])
            writer.writerow(["按规则分布"])
            for rule_id, count in summary.get("by_rule", {}).items():
                writer.writerow([self.RULE_ID_TO_NAME.get(rule_id, rule_id), count])

    def export_markdown(self, report: AuditReport, output_path: str) -> None:
        md_content = self._generate_markdown(report)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(md_content)

    def _generate_markdown(self, report: AuditReport) -> str:
        lines: List[str] = []

        lines.append(f"# 跳板机权限漂移巡检报告")
        lines.append("")
        lines.append(f"- **报告ID**: {report.report_id}")
        lines.append(f"- **生成时间**: {report.generated_at}")
        lines.append(f"- **审计周期**: {report.audit_period_start} 至 {report.audit_period_end}")
        lines.append("")

        summary = report.summary
        lines.append("## 执行摘要")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 发现问题总数 | {summary.get('total_issues_found', 0)} |")
        lines.append(f"| 待处理问题 | {summary.get('pending_issues', 0)} |")
        lines.append(f"| 已修复问题 | {summary.get('remediated_issues', 0)} |")
        lines.append(f"| 操作日志数量 | {summary.get('operations_logged', 0)} |")
        lines.append("")

        lines.append("### 问题严重程度分布")
        lines.append("")
        lines.append("| 严重程度 | 数量 |")
        lines.append("|----------|------|")
        for severity, count in summary.get("by_severity", {}).items():
            lines.append(f"| {self.SEVERITY_TO_NAME.get(severity, severity)} | {count} |")
        lines.append("")

        lines.append("### 问题类型分布")
        lines.append("")
        lines.append("| 规则 | 数量 |")
        lines.append("|------|------|")
        for rule_id, count in summary.get("by_rule", {}).items():
            lines.append(f"| {self.RULE_ID_TO_NAME.get(rule_id, rule_id)} | {count} |")
        lines.append("")

        pending_items = [i for i in report.quarantine_items if not i.get("is_remediated", False)]
        if pending_items:
            lines.append("## 待处理问题详情")
            lines.append("")

            by_severity: Dict[str, List[Dict]] = {}
            for item in pending_items:
                sev = item.get("severity", "medium")
                if sev not in by_severity:
                    by_severity[sev] = []
                by_severity[sev].append(item)

            for severity in ["critical", "high", "medium", "low"]:
                if severity in by_severity:
                    sev_name = self.SEVERITY_TO_NAME.get(severity, severity)
                    lines.append(f"### {sev_name}级别问题")
                    lines.append("")

                    for idx, item in enumerate(by_severity[severity], 1):
                        rule_name = self.RULE_ID_TO_NAME.get(item.get("rule_id", ""), item.get("rule_id", ""))
                        lines.append(f"#### {idx}. {rule_name}: {item.get('affected_entity', '')}")
                        lines.append("")
                        lines.append(f"- **描述**: {item.get('description', '')}")
                        lines.append(f"- **受影响实体**: {item.get('affected_entity', '')}")
                        lines.append(f"- **发现时间**: {item.get('discovered_at', '')}")

                        plan = item.get("remediation_plan", {})
                        if plan and plan.get("suggestion"):
                            lines.append(f"- **修复建议**: {plan.get('suggestion')}")

                        evidence = item.get("evidence", {})
                        if evidence:
                            lines.append(f"- **证据详情**:")
                            if "in_ldap_groups" in evidence:
                                lines.append(f"  - LDAP组: {evidence.get('in_ldap_groups', [])}")
                            if "in_sudo_rules_count" in evidence:
                                lines.append(f"  - Sudo规则数: {evidence.get('in_sudo_rules_count', 0)}")
                            if "production_host" in evidence:
                                lines.append(f"  - 生产主机: {evidence.get('production_host')}")
                            if "issues" in evidence:
                                lines.append(f"  - 问题: {evidence.get('issues', [])}")
                            if "count" in evidence:
                                lines.append(f"  - 重复次数: {evidence.get('count', 0)}")

                        lines.append("")

        if report.journal_entries:
            lines.append("## 操作日志")
            lines.append("")
            lines.append("| 时间 | 类型 | 操作者 | 描述 |")
            lines.append("|------|------|--------|------|")

            TYPE_NAMES = {
                "import": "导入",
                "check": "检查",
                "plan": "计划",
                "apply": "执行",
                "undo": "撤销",
                "report": "报告",
            }

            for entry in report.journal_entries[-15:]:
                entry_type = TYPE_NAMES.get(entry.get("entry_type", ""), entry.get("entry_type", ""))
                lines.append(f"| {entry.get('timestamp', '')} | {entry_type} | {entry.get('user', '')} | {entry.get('description', '')} |")

            lines.append("")

        if report.import_history:
            lines.append("## 数据导入历史")
            lines.append("")
            lines.append("| 时间 | 类型 | 文件名 | 记录数 |")
            lines.append("|------|------|--------|--------|")

            TYPE_NAMES = {
                "account": "账号清单",
                "ldap": "LDAP组",
                "asset": "资产清单",
                "sudoers": "Sudoers",
            }

            for ih in report.import_history:
                src_type = TYPE_NAMES.get(ih.get("source_type", ""), ih.get("source_type", ""))
                lines.append(f"| {ih.get('import_time', '')} | {src_type} | {ih.get('source_file', '')} | {ih.get('records_count', 0)} |")

            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*本报告由跳板机权限漂移巡检工具自动生成*")

        return "\n".join(lines)
