from dataclasses import dataclass, field
from typing import Dict, List, Optional, Callable
from enum import Enum

from ..models.candidate_table import CandidateTable, CandidateRecord
from ..models.param_yaml import ParamYAML
from ..models.patch_record import PatchRecord, PatchIssue, PatchIssueType
from ..models.unified_result import UnifiedResult
from ..utils.helpers import hash_data


class CheckItem(str, Enum):
    DUPLICATE_IMPORT = "duplicate_import"
    OLD_THRESHOLD_REPORT = "old_threshold_report"
    NEEDS_RECALCULATION = "needs_recalculation"
    EXPORT_CONSISTENCY = "export_consistency"


@dataclass
class CheckResult:
    """检查结果"""
    check_item: CheckItem
    passed: bool
    description: str
    issues: List[PatchIssue] = field(default_factory=list)
    details: Dict = field(default_factory=dict)

    def to_dict(self) -> Dict:
        return {
            "check_item": self.check_item,
            "passed": self.passed,
            "description": self.description,
            "issues_count": len(self.issues),
            "details": self.details,
        }


class SelfChecker:
    """
    自检模块
    覆盖最容易出错的点：
    1. 重复导入检测
    2. 阈值改过但报告仍写旧值
    3. 补录后重算检测
    4. 导出一致性检查
    """

    def __init__(self):
        self.check_history: List[CheckResult] = []

    def run_all_checks(
        self,
        candidate_table: CandidateTable,
        new_records: List[CandidateRecord],
        param_yaml: ParamYAML,
        patch_record: PatchRecord,
        unified_result: Optional[UnifiedResult] = None,
        export_data: Optional[Dict] = None,
    ) -> List[CheckResult]:
        """运行所有自检项"""
        results = []

        results.append(self.check_duplicate_import(candidate_table, new_records))
        results.append(self.check_old_threshold_report(candidate_table, param_yaml))
        results.append(self.check_needs_recalculation(patch_record, param_yaml))

        if unified_result and export_data:
            results.append(self.check_export_consistency(unified_result, export_data))

        self.check_history.extend(results)
        return results

    def check_duplicate_import(
        self,
        candidate_table: CandidateTable,
        new_records: List[CandidateRecord],
    ) -> CheckResult:
        """检查重复导入"""
        duplicates = candidate_table.get_duplicates(new_records)
        issues = []

        for dup in duplicates:
            issue = PatchIssue(
                issue_type=PatchIssueType.DUPLICATE_IMPORT,
                description=f"轨迹[{dup.track_id}]已存在，属于重复导入",
                severity="warning",
                track_id=dup.track_id,
                evidence={"import_hash": dup.import_hash},
            )
            issues.append(issue)

        passed = len(duplicates) == 0
        return CheckResult(
            check_item=CheckItem.DUPLICATE_IMPORT,
            passed=passed,
            description=f"检测到{len(duplicates)}条重复导入记录" if not passed else "无重复导入",
            issues=issues,
            details={"duplicate_count": len(duplicates)},
        )

    def check_old_threshold_report(
        self,
        candidate_table: CandidateTable,
        param_yaml: ParamYAML,
        threshold_name: str = "default",
    ) -> CheckResult:
        """
        检查阈值改过但报告仍写旧值
        这是最容易出错的点，检测到后别急着归正常，留给数据科学家复核
        """
        issues = []
        yaml_threshold = param_yaml.get_threshold(threshold_name)

        if yaml_threshold is None:
            return CheckResult(
                check_item=CheckItem.OLD_THRESHOLD_REPORT,
                passed=False,
                description=f"参数YAML中缺少阈值配置: {threshold_name}",
                issues=[],
                details={"error": "missing_threshold"},
            )

        yaml_value = yaml_threshold.value
        yaml_updated_at = yaml_threshold.updated_at

        for record in candidate_table.records:
            reported_value = record.reported_threshold
            record_created_at = record.created_at

            if abs(reported_value - yaml_value) > 1e-9:
                description = (
                    f"轨迹[{record.track_id}]报告阈值为{reported_value}, "
                    f"但当前YAML阈值为{yaml_value}。阈值更新时间: {yaml_updated_at}, "
                    f"记录导入时间: {record_created_at}。请数据科学家复核。"
                )
                issue = PatchIssue(
                    issue_type=PatchIssueType.THRESHOLD_MISMATCH,
                    description=description,
                    severity="warning",
                    track_id=record.track_id,
                    evidence={
                        "reported_threshold": reported_value,
                        "current_yaml_threshold": yaml_value,
                        "threshold_name": threshold_name,
                        "yaml_updated_at": yaml_updated_at.isoformat(),
                        "record_created_at": record_created_at.isoformat(),
                        "needs_data_scientist_review": True,
                    },
                )
                issues.append(issue)

        passed = len(issues) == 0
        return CheckResult(
            check_item=CheckItem.OLD_THRESHOLD_REPORT,
            passed=passed,
            description=f"检测到{len(issues)}条记录使用了旧阈值" if not passed else "所有记录阈值一致",
            issues=issues,
            details={
                "mismatch_count": len(issues),
                "current_yaml_threshold": yaml_value,
                "needs_review": not passed,
            },
        )

    def check_needs_recalculation(
        self,
        patch_record: PatchRecord,
        new_param_yaml: ParamYAML,
    ) -> CheckResult:
        """检查补录后是否需要重算"""
        issues = []
        needs_recalc = False

        if patch_record.param_yaml_id:
            if patch_record.tier_metrics and new_param_yaml.version > 1:
                needs_recalc = True
                description = "参数YAML已更新，但分层指标未重新计算"
                issue = PatchIssue(
                    issue_type=PatchIssueType.NEEDS_RECALCULATION,
                    description=description,
                    severity="error",
                    evidence={
                        "patch_id": patch_record.patch_id,
                        "yaml_version": new_param_yaml.version,
                    },
                )
                issues.append(issue)

        passed = not needs_recalc
        return CheckResult(
            check_item=CheckItem.NEEDS_RECALCULATION,
            passed=passed,
            description="需要重算分层指标" if needs_recalc else "指标已是最新",
            issues=issues,
            details={"needs_recalculation": needs_recalc},
        )

    def check_export_consistency(
        self,
        unified_result: UnifiedResult,
        export_data: Dict,
    ) -> CheckResult:
        """检查导出一致性"""
        is_consistent = unified_result.verify_consistency(export_data)

        issues = []
        if not is_consistent:
            issue = PatchIssue(
                issue_type=PatchIssueType.EXPORT_INCONSISTENT,
                description="导出数据与统一结果层不一致",
                severity="error",
                evidence={
                    "unified_hash": unified_result.data_hash,
                    "export_hash": hash_data({
                        "tier_metrics": export_data.get("tier_metrics", {}),
                        "track_details": export_data.get("track_details", []),
                        "issues_summary": export_data.get("issues_summary", {}),
                    }),
                },
            )
            issues.append(issue)

        return CheckResult(
            check_item=CheckItem.EXPORT_CONSISTENCY,
            passed=is_consistent,
            description="导出数据一致" if is_consistent else "导出数据不一致",
            issues=issues,
            details={"consistent": is_consistent},
        )

    def get_check_summary(self) -> Dict:
        """获取检查摘要"""
        if not self.check_history:
            return {"message": "暂无检查记录"}

        latest = self.check_history[-1]
        by_item = {}
        for r in self.check_history:
            by_item[r.check_item] = r.passed

        return {
            "total_checks": len(self.check_history),
            "passed_count": sum(1 for r in self.check_history if r.passed),
            "failed_count": sum(1 for r in self.check_history if not r.passed),
            "by_check_item": by_item,
        }
