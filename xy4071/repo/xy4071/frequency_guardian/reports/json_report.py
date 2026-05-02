"""JSON 审计包生成器"""

from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from .base import ReportGenerator, ReportResult
from ..models.config import ProjectConfig
from ..models.quarantine import QuarantineStore
from ..models.violation import Violation


class JSONAuditGenerator(ReportGenerator):
    """JSON 审计包生成器"""

    def __init__(
        self,
        project_config: ProjectConfig,
        quarantine_store: Optional[QuarantineStore] = None,
        schedule_analysis: Optional[Dict[str, Any]] = None,
        import_results: Optional[Dict[str, Any]] = None,
    ):
        """
        初始化 JSON 审计包生成器

        Args:
            project_config: 项目配置
            quarantine_store: 隔离存储（可选）
            schedule_analysis: 排班分析结果（可选）
            import_results: 导入结果（可选）
        """
        super().__init__(project_config, quarantine_store)
        self.schedule_analysis = schedule_analysis
        self.import_results = import_results

    def generate(self, output_path: Optional[Path] = None) -> ReportResult:
        """
        生成 JSON 审计包

        Args:
            output_path: 输出路径

        Returns:
            报告生成结果
        """
        result = ReportResult()

        try:
            if output_path is None:
                output_path = self.config.output_dir / "audit_package.json"

            self._ensure_output_dir(output_path)

            audit_package = self._build_audit_package()

            import json

            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(audit_package, f, ensure_ascii=False, indent=2, default=str)

            result.success = True
            result.output_path = output_path
            result.message = f"JSON 审计包已生成: {output_path}"
            result.summary = {
                "total_entries": len(audit_package.get("quarantine", {}).get("entries", [])),
                "total_reviews": len(audit_package.get("quarantine", {}).get("reviews", [])),
                "generated_at": self.generated_at.isoformat(),
            }

        except Exception as e:
            result.add_error(f"生成 JSON 审计包失败: {str(e)}")

        return result

    def _build_audit_package(self) -> Dict[str, Any]:
        """
        构建完整的审计包

        Returns:
            审计包字典
        """
        package = {
            "audit_package": {
                "version": "1.0",
                "generated_at": self.generated_at.isoformat(),
                "generated_by": "频率排班守门员 (Frequency Guardian)",
            },
            "project_config": self._build_config_section(),
        }

        if self.quarantine_store:
            package["quarantine"] = self._build_quarantine_section()

        if self.schedule_analysis:
            package["schedule_analysis"] = self._build_schedule_section()

        if self.import_results:
            package["import_results"] = self._build_import_section()

        package["statistics"] = self._build_statistics_section(package)

        return package

    def _build_config_section(self) -> Dict[str, Any]:
        """
        构建配置部分

        Returns:
            配置字典
        """
        return {
            "project_name": self.config.project_name,
            "exercise_name": self.config.exercise_name,
            "frequency_range": {
                "min_mhz": self.config.min_frequency_mhz,
                "max_mhz": self.config.max_frequency_mhz,
            },
            "power_limit_watts": self.config.max_power_watts,
            "call_sign_pattern": self.config.call_sign_pattern,
            "paths": {
                "data_dir": str(self.config.data_dir),
                "output_dir": str(self.config.output_dir),
                "quarantine_file": str(self.config.quarantine_file),
            },
        }

    def _build_quarantine_section(self) -> Dict[str, Any]:
        """
        构建隔离存储部分

        Returns:
            隔离存储字典
        """
        if not self.quarantine_store:
            return {}

        entries = []
        for entry in self.quarantine_store.entries:
            entry_dict = {
                "entry_id": entry.entry_id,
                "source_type": entry.source_type,
                "source_file": entry.source_file,
                "line_number": entry.line_number,
                "raw_data": entry.raw_data,
                "quarantine_reason": entry.quarantine_reason,
                "quarantined_at": entry.quarantined_at.isoformat() if entry.quarantined_at else None,
                "quarantine_note": entry.quarantine_note,
                "status": entry.status,
                "reviewed_by": entry.reviewed_by,
                "reviewed_at": entry.reviewed_at.isoformat() if entry.reviewed_at else None,
                "review_notes": entry.review_notes,
                "review_decision": entry.review_decision,
                "violations": [
                    self._violation_to_dict(v)
                    for v in entry.violations
                ],
            }
            entries.append(entry_dict)

        reviews = []
        for review in self.quarantine_store.reviews:
            review_dict = {
                "review_id": review.review_id,
                "entry_id": review.entry_id,
                "violation_id": review.violation_id,
                "reviewer": review.reviewer,
                "reviewed_at": review.reviewed_at.isoformat() if review.reviewed_at else None,
                "decision": review.decision,
                "notes": review.notes,
                "correction_applied": review.correction_applied,
                "correction_details": review.correction_details,
            }
            reviews.append(review_dict)

        return {
            "store_name": self.quarantine_store.store_name,
            "version": self.quarantine_store.version,
            "created_at": self.quarantine_store.created_at.isoformat() if self.quarantine_store.created_at else None,
            "last_updated": self.quarantine_store.last_updated.isoformat() if self.quarantine_store.last_updated else None,
            "entries": entries,
            "reviews": reviews,
            "statistics": self.quarantine_store.get_statistics(),
        }

    def _violation_to_dict(self, violation: Violation) -> Dict[str, Any]:
        """
        将违规记录转换为字典

        Args:
            violation: 违规对象

        Returns:
            字典表示
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
            type_str = "unknown"

        evidence = None
        if violation.evidence:
            evidence = {
                "field_name": violation.evidence.field_name,
                "expected_value": violation.evidence.expected_value,
                "actual_value": violation.evidence.actual_value,
                "context": violation.evidence.context,
                "related_entries": violation.evidence.related_entries,
            }

        return {
            "violation_id": violation.violation_id,
            "violation_type": type_str,
            "severity": severity_str,
            "category": violation.category,
            "message": violation.message,
            "evidence": evidence,
            "source_file": violation.source_file,
            "line_number": violation.line_number,
            "entry_id": violation.entry_id,
            "call_sign": violation.call_sign,
            "channel_id": violation.channel_id,
            "date": violation.date,
            "time_start": violation.time_start,
            "time_end": violation.time_end,
            "detected_at": violation.detected_at.isoformat() if violation.detected_at else None,
            "status": violation.status,
            "reviewed_by": violation.reviewed_by,
            "reviewed_at": violation.reviewed_at.isoformat() if violation.reviewed_at else None,
            "review_notes": violation.review_notes,
            "review_decision": violation.review_decision,
        }

    def _build_schedule_section(self) -> Dict[str, Any]:
        """
        构建排班分析部分

        Returns:
            排班分析字典
        """
        if not self.schedule_analysis:
            return {}

        channel_usage = self.schedule_analysis.get("channel_usage", {})
        conflicts = self.schedule_analysis.get("conflicts", {})
        time_slots = self.schedule_analysis.get("time_slots", [])
        gaps = self.schedule_analysis.get("gaps", [])

        return {
            "time_slots": time_slots,
            "channel_usage": channel_usage,
            "conflicts": conflicts,
            "gaps": gaps,
        }

    def _build_import_section(self) -> Dict[str, Any]:
        """
        构建导入结果部分

        Returns:
            导入结果字典
        """
        if not self.import_results:
            return {}

        return self.import_results

    def _build_statistics_section(self, package: Dict[str, Any]) -> Dict[str, Any]:
        """
        构建统计部分

        Args:
            package: 完整的审计包

        Returns:
            统计字典
        """
        quarantine = package.get("quarantine", {})
        entries = quarantine.get("entries", [])
        reviews = quarantine.get("reviews", [])

        all_violations = []
        for entry in entries:
            all_violations.extend(entry.get("violations", []))

        severity_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
            "info": 0,
        }

        category_counts: Dict[str, int] = {}
        status_counts: Dict[str, int] = {}

        for v in all_violations:
            severity = v.get("severity", "medium").lower()
            if severity in severity_counts:
                severity_counts[severity] += 1

            category = v.get("category") or "other"
            if category not in category_counts:
                category_counts[category] = 0
            category_counts[category] += 1

            status = v.get("status") or "open"
            if status not in status_counts:
                status_counts[status] = 0
            status_counts[status] += 1

        critical = severity_counts.get("critical", 0)
        high = severity_counts.get("high", 0)

        risk_level = "low"
        if critical > 0:
            risk_level = "high"
        elif high > 0:
            risk_level = "medium"

        schedule = package.get("schedule_analysis", {})
        conflicts = schedule.get("conflicts", {})
        channel_conflicts = len(conflicts.get("channel_conflicts", []))
        operator_conflicts = len(conflicts.get("operator_conflicts", []))

        return {
            "summary": {
                "total_entries": len(entries),
                "total_violations": len(all_violations),
                "total_reviews": len(reviews),
                "risk_level": risk_level,
                "schedule_conflicts": channel_conflicts + operator_conflicts,
                "channel_conflicts": channel_conflicts,
                "operator_conflicts": operator_conflicts,
            },
            "severity_distribution": severity_counts,
            "category_distribution": category_counts,
            "status_distribution": status_counts,
        }
