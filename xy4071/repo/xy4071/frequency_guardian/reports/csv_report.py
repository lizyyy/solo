"""CSV 报告生成器"""

import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .base import ReportGenerator, ReportResult
from ..models.config import ProjectConfig
from ..models.quarantine import QuarantineEntry, QuarantineStore
from ..models.violation import Violation, ViolationSeverity


class CSVReportGenerator(ReportGenerator):
    """CSV 问题清单报告生成器"""

    def __init__(
        self,
        project_config: ProjectConfig,
        quarantine_store: Optional[QuarantineStore] = None,
    ):
        """
        初始化 CSV 报告生成器

        Args:
            project_config: 项目配置
            quarantine_store: 隔离存储（可选）
        """
        super().__init__(project_config, quarantine_store)

    def generate(self, output_path: Optional[Path] = None) -> ReportResult:
        """
        生成 CSV 问题清单报告

        Args:
            output_path: 输出路径

        Returns:
            报告生成结果
        """
        result = ReportResult()

        try:
            if output_path is None:
                output_path = self.config.output_dir / "violations.csv"

            self._ensure_output_dir(output_path)

            rows = self._generate_rows()

            fieldnames = [
                "序号",
                "违规ID",
                "严重程度",
                "违规类型",
                "消息",
                "来源文件",
                "行号",
                "呼号",
                "频道ID",
                "日期",
                "开始时间",
                "结束时间",
                "状态",
                "复核人",
                "复核时间",
                "复核决策",
                "复核意见",
                "证据字段",
                "期望值",
                "实际值",
            ]

            with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for row in rows:
                    writer.writerow(row)

            result.success = True
            result.output_path = output_path
            result.message = f"CSV 问题清单已生成: {output_path}"

            if self.quarantine_store:
                stats = self.quarantine_store.get_statistics()
                result.summary = {
                    "total_rows": len(rows),
                    "total_entries": stats.get("total_entries", 0),
                    "generated_at": self.generated_at.isoformat(),
                }

        except Exception as e:
            result.add_error(f"生成 CSV 报告失败: {str(e)}")

        return result

    def _generate_rows(self) -> List[Dict[str, Any]]:
        """
        生成 CSV 行数据

        Returns:
            行数据列表
        """
        rows = []

        if not self.quarantine_store:
            return rows

        all_violations = []
        for entry in self.quarantine_store.entries:
            for violation in entry.violations:
                all_violations.append((entry, violation))

        all_violations.sort(key=lambda x: self._get_severity_order(x[1]))

        for idx, (entry, violation) in enumerate(all_violations, 1):
            row = self._violation_to_row(idx, entry, violation)
            rows.append(row)

        return rows

    def _get_severity_order(self, violation: Violation) -> int:
        """
        获取严重程度排序值

        Args:
            violation: 违规对象

        Returns:
            排序值（越小越严重）
        """
        severity_order = {
            ViolationSeverity.CRITICAL: 0,
            ViolationSeverity.HIGH: 1,
            ViolationSeverity.MEDIUM: 2,
            ViolationSeverity.LOW: 3,
            ViolationSeverity.INFO: 4,
        }

        severity = violation.severity
        if isinstance(severity, str):
            try:
                severity = ViolationSeverity(severity)
            except ValueError:
                return 2

        return severity_order.get(severity, 2)

    def _violation_to_row(
        self,
        index: int,
        entry: QuarantineEntry,
        violation: Violation,
    ) -> Dict[str, Any]:
        """
        将违规记录转换为 CSV 行

        Args:
            index: 序号
            entry: 隔离条目
            violation: 违规对象

        Returns:
            CSV 行字典
        """
        severity = violation.severity
        if isinstance(severity, str):
            severity_str = severity
        else:
            severity_str = severity.value

        violation_type = violation.violation_type
        if isinstance(violation_type, str):
            type_str = violation_type
        elif violation_type:
            type_str = violation_type.value
        else:
            type_str = ""

        evidence_field = ""
        expected_value = ""
        actual_value = ""

        if violation.evidence:
            evidence_field = violation.evidence.field_name or ""
            expected_value = str(violation.evidence.expected_value) if violation.evidence.expected_value else ""
            actual_value = str(violation.evidence.actual_value) if violation.evidence.actual_value else ""

        reviewed_at_str = ""
        if violation.reviewed_at:
            if isinstance(violation.reviewed_at, datetime):
                reviewed_at_str = violation.reviewed_at.strftime("%Y-%m-%d %H:%M:%S")
            else:
                reviewed_at_str = str(violation.reviewed_at)

        return {
            "序号": index,
            "违规ID": violation.violation_id or "",
            "严重程度": self._format_severity_name(severity_str),
            "违规类型": type_str,
            "消息": violation.message,
            "来源文件": violation.source_file or entry.source_file or "",
            "行号": violation.line_number or entry.line_number or "",
            "呼号": violation.call_sign or "",
            "频道ID": violation.channel_id or "",
            "日期": violation.date or "",
            "开始时间": violation.time_start or "",
            "结束时间": violation.time_end or "",
            "状态": self._format_status(violation.status),
            "复核人": violation.reviewed_by or entry.reviewed_by or "",
            "复核时间": reviewed_at_str,
            "复核决策": self._format_decision(violation.review_decision or entry.review_decision),
            "复核意见": violation.review_notes or entry.review_notes or "",
            "证据字段": evidence_field,
            "期望值": expected_value,
            "实际值": actual_value,
        }

    def _format_status(self, status: Optional[str]) -> str:
        """
        格式化状态

        Args:
            status: 状态值

        Returns:
            格式化后的状态
        """
        status_names = {
            "open": "待处理",
            "quarantined": "隔离中",
            "reviewed": "已复核",
            "resolved": "已解决",
            "dismissed": "已驳回",
        }
        return status_names.get(status or "", status or "")

    def _format_decision(self, decision: Optional[str]) -> str:
        """
        格式化复核决策

        Args:
            decision: 决策值

        Returns:
            格式化后的决策
        """
        decision_names = {
            "confirm": "确认违规",
            "dismiss": "驳回误判",
            "defer": "暂缓处理",
        }
        return decision_names.get(decision or "", decision or "")
