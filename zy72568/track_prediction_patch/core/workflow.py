from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from enum import Enum

from ..models.candidate_table import CandidateTable, CandidateRecord
from ..models.param_yaml import ParamYAML
from ..models.patch_record import PatchRecord, PatchStatus, PatchIssue
from ..models.unified_result import UnifiedResult
from ..models.audit_log import OperationType
from .conflict_detector import ConflictDetector, ConflictEvidence
from .self_check import SelfChecker, CheckResult
from .reviewer import Reviewer
from ..utils.helpers import get_current_time


class WorkflowStep(str, Enum):
    STEP_1_IMPORT = "step_1_import"
    STEP_2_REVIEW_PARAMS = "step_2_review_params"
    STEP_3_UPDATE_METRICS = "step_3_update_metrics"
    COMPLETED = "completed"


@dataclass
class WorkflowState:
    """工作流状态"""
    current_step: WorkflowStep = WorkflowStep.STEP_1_IMPORT
    step_history: List[Dict] = field(default_factory=list)
    can_proceed: bool = False
    blocking_issues: List[str] = field(default_factory=list)


class PatchWorkflow:
    """
    轨迹预测缺失修补工作流
    核心三步流程：
    1. 召回候选表第一次导入
    2. 算法工程师小乔补看参数YAML
    3. 分层指标更新

    关键规则：
    - 碰到阈值改过但报告仍写旧值时，别急着归正常，留给数据科学家复核
    - 召回候选表和参数YAML互相矛盾时，先列出冲突证据，让用户选确认或驳回
    - 导出明细、页面展示、接口返回读同一份结果
    """

    def __init__(self, created_by: str = ""):
        self.candidate_table: Optional[CandidateTable] = None
        self.param_yaml: Optional[ParamYAML] = None
        self.patch_record: PatchRecord = PatchRecord(created_by=created_by)
        self.unified_result: UnifiedResult = UnifiedResult(
            patch_id=self.patch_record.patch_id
        )
        self.conflict_detector: ConflictDetector = ConflictDetector()
        self.self_checker: SelfChecker = SelfChecker()
        self.reviewer: Reviewer = Reviewer()
        self.state: WorkflowState = WorkflowState()
        self.created_by = created_by

    def step_1_import_candidates(
        self,
        candidate_records: List[CandidateRecord],
        table_name: str = "",
        import_batch: str = "",
    ) -> Tuple[WorkflowState, List[CheckResult], List[ConflictEvidence]]:
        """
        第一步：召回候选表第一次导入

        Args:
            candidate_records: 候选记录列表
            table_name: 候选表名称
            import_batch: 导入批次号

        Returns:
            工作流状态、自检结果、冲突证据（如果有YAML的话）
        """
        self.candidate_table = CandidateTable(
            name=table_name,
            created_by=self.created_by,
            import_batch=import_batch,
        )
        added_ids = self.candidate_table.add_records(candidate_records)

        self.patch_record.candidate_table_id = self.candidate_table.table_id
        self.patch_record.update_status(PatchStatus.IMPORTED, self.created_by)

        self.reviewer.log_operation(
            operation_type=OperationType.IMPORT_CANDIDATES,
            operator=self.created_by,
            patch_id=self.patch_record.patch_id,
            details={
                "table_name": table_name,
                "import_batch": import_batch,
                "added_count": len(added_ids),
                "total_records": len(self.candidate_table.records),
            },
            after_state={"record_count": len(self.candidate_table.records)},
            reason="召回候选表第一次导入",
        )

        check_results = self.self_checker.check_duplicate_import(
            self.candidate_table, candidate_records
        )

        for result in [check_results]:
            for issue in result.issues:
                self.patch_record.add_issue(issue)

        conflicts = []
        if self.param_yaml:
            conflicts = self.conflict_detector.detect_conflicts(
                self.candidate_table, self.param_yaml
            )
            for conflict in conflicts:
                issue = self.conflict_detector.generate_issue_from_conflict(conflict)
                self.patch_record.add_issue(issue)

        self._record_step(WorkflowStep.STEP_1_IMPORT, "候选表导入完成")
        self._update_can_proceed()

        return self.state, [check_results], conflicts

    def step_2_review_params(
        self,
        yaml_content: str,
        yaml_name: str = "",
    ) -> Tuple[WorkflowState, List[CheckResult], List[ConflictEvidence]]:
        """
        第二步：算法工程师小乔补看参数YAML

        Args:
            yaml_content: YAML文件内容
            yaml_name: YAML配置名称

        Returns:
            工作流状态、自检结果、冲突证据
        """
        old_yaml_id = self.param_yaml.yaml_id if self.param_yaml else ""
        old_version = self.param_yaml.version if self.param_yaml else 0

        self.param_yaml = ParamYAML.from_yaml_content(
            yaml_content, name=yaml_name, loaded_by=self.created_by
        )

        self.patch_record.param_yaml_id = self.param_yaml.yaml_id
        self.patch_record.update_status(PatchStatus.PARAMS_REVIEWED, self.created_by)

        self.reviewer.log_operation(
            operation_type=OperationType.LOAD_PARAMS,
            operator=self.created_by,
            patch_id=self.patch_record.patch_id,
            details={
                "yaml_name": yaml_name,
                "threshold_count": len(self.param_yaml.thresholds),
            },
            before_state={"yaml_id": old_yaml_id, "version": old_version},
            after_state={"yaml_id": self.param_yaml.yaml_id, "version": self.param_yaml.version},
            reason="算法工程师补看参数YAML",
        )

        check_results = []
        if self.candidate_table:
            threshold_check = self.self_checker.check_old_threshold_report(
                self.candidate_table, self.param_yaml
            )
            check_results.append(threshold_check)

            for issue in threshold_check.issues:
                self.patch_record.add_issue(issue)

        conflicts = []
        if self.candidate_table:
            conflicts = self.conflict_detector.detect_conflicts(
                self.candidate_table, self.param_yaml
            )
            for conflict in conflicts:
                if not conflict.resolved:
                    self.patch_record.update_status(
                        PatchStatus.CONFLICT_DETECTED,
                        self.created_by,
                        "检测到阈值冲突，需确认或驳回",
                    )
                    break

        self._record_step(WorkflowStep.STEP_2_REVIEW_PARAMS, "参数YAML补看完成")
        self._update_can_proceed()

        return self.state, check_results, conflicts

    def step_3_update_metrics(
        self,
        tier_metrics: Dict[str, Dict],
        recalculate: bool = False,
    ) -> Tuple[WorkflowState, List[CheckResult], UnifiedResult]:
        """
        第三步：分层指标更新

        注意：如果有阈值改过但报告仍写旧值的问题，
        这里不会自动归正常，会保留标记留给数据科学家复核

        Args:
            tier_metrics: 分层指标数据
            recalculate: 是否强制重算

        Returns:
            工作流状态、自检结果、统一结果层
        """
        old_metrics = dict(self.patch_record.tier_metrics)

        if recalculate:
            self.reviewer.log_operation(
                operation_type=OperationType.RECALCULATE,
                operator=self.created_by,
                patch_id=self.patch_record.patch_id,
                details={"recalculate": True},
                before_state={"tier_metrics": old_metrics},
                after_state={"tier_metrics": tier_metrics},
                reason="补录后重算分层指标",
            )
        else:
            self.reviewer.log_operation(
                operation_type=OperationType.UPDATE_METRICS,
                operator=self.created_by,
                patch_id=self.patch_record.patch_id,
                details={},
                before_state={"tier_metrics": old_metrics},
                after_state={"tier_metrics": tier_metrics},
                reason="更新分层指标",
            )

        self.patch_record.tier_metrics = tier_metrics
        self.patch_record.update_status(PatchStatus.METRICS_UPDATED, self.created_by)

        track_details = self._build_track_details()
        issues_summary = self._build_issues_summary()

        self.unified_result.update_data(tier_metrics, track_details, issues_summary)
        self.unified_result.generated_by = self.created_by

        recalc_check = self.self_checker.check_needs_recalculation(
            self.patch_record, self.param_yaml
        )
        if not recalc_check.passed and not recalculate:
            for issue in recalc_check.issues:
                self.patch_record.add_issue(issue)

        self._record_step(WorkflowStep.STEP_3_UPDATE_METRICS, "分层指标更新完成")

        if self.reviewer.needs_data_scientist_review(self.patch_record):
            self.patch_record.update_status(
                PatchStatus.NEEDS_REVIEW,
                self.created_by,
                "存在阈值旧值问题，需要数据科学家复核",
            )

        self._update_can_proceed()

        return self.state, [recalc_check], self.unified_result

    def resolve_conflict(
        self,
        evidence_id: str,
        resolution: str,
        resolved_by: str,
    ) -> Optional[ConflictEvidence]:
        """
        解决冲突：确认或驳回
        不替业务同事自动拍板

        Args:
            evidence_id: 冲突证据ID
            resolution: "confirmed" 或 "rejected"
            resolved_by: 解决人

        Returns:
            更新后的冲突证据
        """
        evidence = self.conflict_detector.resolve_conflict(
            evidence_id, resolution, resolved_by
        )

        if evidence:
            op_type = (
                OperationType.CONFIRM_CONFLICT
                if resolution == "confirmed"
                else OperationType.REJECT_CONFLICT
            )
            self.reviewer.log_operation(
                operation_type=op_type,
                operator=resolved_by,
                patch_id=self.patch_record.patch_id,
                details={
                    "evidence_id": evidence_id,
                    "resolution": resolution,
                    "track_id": evidence.track_id,
                },
                reason=f"人工{resolution}冲突: {evidence.description}",
            )

            for issue in self.patch_record.issues:
                if issue.track_id == evidence.track_id and not issue.resolved:
                    self.patch_record.resolve_issue(issue.issue_id, resolved_by)

            self._update_can_proceed()

        return evidence

    def mark_for_data_scientist_review(self, operator: str = "") -> None:
        """标记为需要数据科学家复核"""
        self.patch_record.update_status(
            PatchStatus.NEEDS_REVIEW,
            operator or self.created_by,
            "手动标记需要数据科学家复核",
        )

    def complete(self, operator: str = "") -> bool:
        """
        完成工作流
        只有当没有未解决的冲突且不需要数据科学家复核时才能完成
        """
        unresolved = self.conflict_detector.get_unresolved_conflicts()
        needs_review = self.reviewer.needs_data_scientist_review(self.patch_record)

        if unresolved:
            return False
        if needs_review:
            return False

        self.patch_record.update_status(PatchStatus.COMPLETED, operator or self.created_by)
        self.state.current_step = WorkflowStep.COMPLETED
        self._record_step(WorkflowStep.COMPLETED, "工作流完成")
        return True

    def get_consistent_result(self) -> Dict:
        """
        获取一致的结果
        导出、页面、接口都从这里读取同一份数据
        """
        return {
            "export": self.unified_result.get_for_export(),
            "page": self.unified_result.get_for_page(),
            "api": self.unified_result.get_for_api(),
            "data_hash": self.unified_result.data_hash,
            "version": self.unified_result.version,
        }

    def get_workflow_summary(self) -> Dict:
        """获取工作流摘要"""
        return {
            "patch_id": self.patch_record.patch_id,
            "current_step": self.state.current_step,
            "status": self.patch_record.status,
            "created_by": self.created_by,
            "candidate_table_id": self.patch_record.candidate_table_id,
            "param_yaml_id": self.patch_record.param_yaml_id,
            "candidate_count": len(self.candidate_table.records) if self.candidate_table else 0,
            "conflict_summary": self.conflict_detector.get_conflict_summary(),
            "check_summary": self.self_checker.get_check_summary(),
            "review_summary": self.reviewer.get_review_summary(self.patch_record),
            "step_history": self.state.step_history,
            "can_proceed": self.state.can_proceed,
        }

    def _build_track_details(self) -> List[Dict]:
        """构建轨迹详情"""
        details = []
        if not self.candidate_table:
            return details

        for record in self.candidate_table.records:
            detail = {
                "track_id": record.track_id,
                "predicted_value": record.predicted_value,
                "reported_threshold": record.reported_threshold,
                "is_missing": record.is_missing,
                "source": record.source,
                "status": record.status,
                "has_threshold_issue": False,
                "issue_description": "",
            }

            for issue in self.patch_record.issues:
                if issue.track_id == record.track_id:
                    detail["has_threshold_issue"] = True
                    detail["issue_description"] = issue.description
                    detail["issue_resolved"] = issue.resolved
                    break

            details.append(detail)
        return details

    def _build_issues_summary(self) -> Dict:
        """构建问题摘要"""
        issues = self.patch_record.issues
        by_type = {}
        for issue in issues:
            t = issue.issue_type
            if t not in by_type:
                by_type[t] = {"total": 0, "resolved": 0, "unresolved": 0}
            by_type[t]["total"] += 1
            if issue.resolved:
                by_type[t]["resolved"] += 1
            else:
                by_type[t]["unresolved"] += 1

        return {
            "total": len(issues),
            "resolved": sum(1 for i in issues if i.resolved),
            "unresolved": sum(1 for i in issues if not i.resolved),
            "by_type": by_type,
            "needs_data_scientist_review": self.reviewer.needs_data_scientist_review(
                self.patch_record
            ),
        }

    def _record_step(self, step: WorkflowStep, description: str):
        """记录步骤历史"""
        self.state.current_step = step
        self.state.step_history.append({
            "step": step,
            "timestamp": get_current_time().isoformat(),
            "description": description,
            "operator": self.created_by,
        })

    def _update_can_proceed(self):
        """更新是否可以进入下一步"""
        unresolved = self.conflict_detector.get_unresolved_conflicts()
        has_critical_issues = any(
            i.severity == "error" and not i.resolved
            for i in self.patch_record.issues
        )

        self.state.can_proceed = len(unresolved) == 0 and not has_critical_issues
        self.state.blocking_issues = [
            f"未解决冲突: {c.track_id}" for c in unresolved
        ] + [
            f"严重问题: {i.track_id}" for i in self.patch_record.issues
            if i.severity == "error" and not i.resolved
        ]
