import sys

content = '''from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from enum import Enum

from ..models.candidate_table import CandidateTable, CandidateRecord, ImportBatchInfo
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
    current_step: WorkflowStep = WorkflowStep.STEP_1_IMPORT
    step_history: List[Dict] = field(default_factory=list)
    can_proceed: bool = False
    blocking_issues: List[str] = field(default_factory=list)
    latest_import_batch: Optional[ImportBatchInfo] = None
    status_message: str = ""
    result_summary: Dict = field(default_factory=dict)


class PatchWorkflow:
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
        is_first_import = self.candidate_table is None

        if is_first_import:
            self.candidate_table = CandidateTable(
                name=table_name,
                created_by=self.created_by,
                import_batch=import_batch,
            )
            self.patch_record.candidate_table_id = self.candidate_table.table_id

        before_count = len(self.candidate_table.records)
        batch_info = self.candidate_table.add_records(
            candidate_records, imported_by=self.created_by
        )
        self.state.latest_import_batch = batch_info

        if is_first_import:
            self.patch_record.update_status(PatchStatus.IMPORTED, self.created_by)
            reason = "召回候选表第一次导入"
        else:
            reason = f"追加导入候选记录（批次: {import_batch}）"

        self.state.status_message = (
            f"导入完成：共{batch_info.total_count}条，"
            f"新增{batch_info.new_count}条，"
            f"重复{batch_info.duplicate_count}条"
        )

        self.state.result_summary = {
            "total_count": batch_info.total_count,
            "new_count": batch_info.new_count,
            "duplicate_count": batch_info.duplicate_count,
            "duplicate_track_ids": batch_info.duplicate_track_ids,
            "new_track_ids": batch_info.new_track_ids,
            "before_count": before_count,
            "after_count": len(self.candidate_table.records),
            "is_first_import": is_first_import,
        }

        self.reviewer.log_operation(
            operation_type=OperationType.IMPORT_CANDIDATES,
            operator=self.created_by,
            patch_id=self.patch_record.patch_id,
            details={
                "table_name": table_name or self.candidate_table.name,
                "import_batch": import_batch,
                "batch_id": batch_info.batch_id,
                "total_count": batch_info.total_count,
                "new_count": batch_info.new_count,
                "duplicate_count": batch_info.duplicate_count,
                "duplicate_track_ids": batch_info.duplicate_track_ids,
                "total_records": len(self.candidate_table.records),
            },
            before_state={"record_count": before_count},
            after_state={"record_count": len(self.candidate_table.records)},
            reason=reason,
        )

        check_results = []
        dup_check = self.self_checker.check_duplicate_import_from_batch(
            batch_info, candidate_records
        )
        check_results.append(dup_check)

        for result in check_results:
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

        self._record_step(
            WorkflowStep.STEP_1_IMPORT,
            self.state.status_message,
            extra={
                "batch_id": batch_info.batch_id,
                "new_count": batch_info.new_count,
                "duplicate_count": batch_info.duplicate_count,
            }
        )
        self._update_can_proceed()
        self._refresh_unified_result()

        return self.state, check_results, conflicts

    def append_candidates(
        self,
        candidate_records: List[CandidateRecord],
        import_batch: str = "",
    ) -> Tuple[WorkflowState, List[CheckResult], List[ConflictEvidence]]:
        if self.candidate_table is None:
            raise ValueError("请先调用 step_1_import_candidates 完成首次导入")
        return self.step_1_import_candidates(
            candidate_records,
            table_name=self.candidate_table.name,
            import_batch=import_batch,
        )

    def step_2_review_params(
        self,
        yaml_content: str,
        yaml_name: str = "",
    ) -> Tuple[WorkflowState, List[CheckResult], List[ConflictEvidence]]:
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
            unresolved_count = sum(1 for c in conflicts if not c.resolved)

            for conflict in conflicts:
                if not conflict.resolved:
                    self.patch_record.update_status(
                        PatchStatus.CONFLICT_DETECTED,
                        self.created_by,
                        "检测到阈值冲突，需确认或驳回",
                    )
                    break

            self.state.status_message = (
                f"参数YAML补看完成，检测到{len(conflicts)}处阈值冲突，"
                f"其中{unresolved_count}处待确认"
            )
        else:
            self.state.status_message = "参数YAML补看完成（暂无可比对的候选表）"

        self._record_step(
            WorkflowStep.STEP_2_REVIEW_PARAMS,
            self.state.status_message,
        )
        self._update_can_proceed()
        self._refresh_unified_result()

        return self.state, check_results, conflicts

    def step_3_update_metrics(
        self,
        tier_metrics: Dict[str, Dict],
        recalculate: bool = False,
    ) -> Tuple[WorkflowState, List[CheckResult], UnifiedResult]:
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

        unresolved_issues = self.patch_record.get_unresolved_issues()
        tier_count = len(tier_metrics)

        if self.reviewer.needs_data_scientist_review(self.patch_record):
            self.patch_record.update_status(
                PatchStatus.NEEDS_REVIEW,
                self.created_by,
                "存在阈值旧值问题，需要数据科学家复核",
            )
            self.state.status_message = (
                f"分层指标更新完成（{tier_count}个分层），"
                f"存在{len(unresolved_issues)}个未解决问题，需数据科学家复核"
            )
        else:
            self.state.status_message = (
                f"分层指标更新完成（{tier_count}个分层），"
                f"共{len(self.patch_record.issues)}个问题，已全部解决"
            )

        self._record_step(
            WorkflowStep.STEP_3_UPDATE_METRICS,
            self.state.status_message,
        )
        self._update_can_proceed()
        self._refresh_unified_result()

        return self.state, [recalc_check], self.unified_result

    def resolve_conflict(
        self,
        evidence_id: str,
        resolution: str,
        resolved_by: str,
    ) -> Optional[ConflictEvidence]:
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
                    "conflict_type": "threshold_mismatch",
                },
                reason=f"人工{resolution}阈值冲突: {evidence.description}",
            )

            for issue in self.patch_record.issues:
                if (
                    issue.track_id == evidence.track_id
                    and issue.issue_type == "threshold_mismatch"
                    and not issue.resolved
                ):
                    self.patch_record.resolve_issue(issue.issue_id, resolved_by)

            total_conflicts = len(self.conflict_detector.conflicts)
            unresolved_conflicts = len(self.conflict_detector.get_unresolved_conflicts())
            resolution_text = "确认" if resolution == "confirmed" else "驳回"

            dup_still_unresolved = sum(
                1 for i in self.patch_record.issues
                if i.track_id == evidence.track_id
                and i.issue_type == "duplicate_import"
                and not i.resolved
            )

            if dup_still_unresolved > 0:
                self.state.status_message = (
                    f"已{resolution_text}阈值冲突: 轨迹[{evidence.track_id}]，"
                    f"剩余{unresolved_conflicts}/{total_conflicts}处阈值冲突待处理。"
                    f"（注意：该轨迹仍有{dup_still_unresolved}个重复导入问题未处理）"
                )
            else:
                self.state.status_message = (
                    f"已{resolution_text}阈值冲突: 轨迹[{evidence.track_id}]，"
                    f"剩余{unresolved_conflicts}/{total_conflicts}处阈值冲突待处理。"
                )

            self._refresh_unified_result(resolved_by)

            if unresolved_conflicts == 0:
                if self.reviewer.needs_data_scientist_review(self.patch_record):
                    self.patch_record.update_status(
                        PatchStatus.NEEDS_REVIEW,
                        resolved_by,
                        "阈值冲突已处理，但需数据科学家复核",
                    )
                else:
                    self.patch_record.update_status(
                        PatchStatus.PARAMS_REVIEWED,
                        resolved_by,
                        "所有阈值冲突已处理完成",
                    )

            self._update_can_proceed()

        return evidence

    def mark_for_data_scientist_review(self, operator: str = "") -> None:
        self.patch_record.update_status(
            PatchStatus.NEEDS_REVIEW,
            operator or self.created_by,
            "手动标记需要数据科学家复核",
        )
        self._refresh_unified_result(operator or self.created_by)

    def complete(self, operator: str = "") -> bool:
        unresolved = self.conflict_detector.get_unresolved_conflicts()
        needs_review = self.reviewer.needs_data_scientist_review(self.patch_record)

        if unresolved:
            return False
        if needs_review:
            return False

        self.patch_record.update_status(PatchStatus.COMPLETED, operator or self.created_by)
        self.state.current_step = WorkflowStep.COMPLETED
        self._record_step(WorkflowStep.COMPLETED, "工作流完成")
        self._refresh_unified_result(operator or self.created_by)
        return True

    def get_consistent_result(self) -> Dict:
        return {
            "export": self.unified_result.get_for_export(),
            "page": self.unified_result.get_for_page(),
            "api": self.unified_result.get_for_api(),
            "data_hash": self.unified_result.data_hash,
            "version": self.unified_result.version,
        }

    def get_workflow_summary(self) -> Dict:
        issues_by_type = self._get_issues_by_type()
        summary = {
            "patch_id": self.patch_record.patch_id,
            "current_step": self.state.current_step,
            "status": self.patch_record.status,
            "status_message": self.state.status_message,
            "created_by": self.created_by,
            "candidate_table_id": self.patch_record.candidate_table_id,
            "param_yaml_id": self.patch_record.param_yaml_id,
            "candidate_count": len(self.candidate_table.records) if self.candidate_table else 0,
            "import_history_count": len(self.candidate_table.import_history) if self.candidate_table else 0,
            "conflict_summary": self.conflict_detector.get_conflict_summary(),
            "check_summary": self.self_checker.get_check_summary(),
            "review_summary": self.reviewer.get_review_summary(self.patch_record),
            "step_history": self.state.step_history,
            "can_proceed": self.state.can_proceed,
            "blocking_issues": self.state.blocking_issues,
            "result_summary": self.state.result_summary,
            "issues_summary": {
                "total": len(self.patch_record.issues),
                "resolved": sum(1 for i in self.patch_record.issues if i.resolved),
                "unresolved": sum(1 for i in self.patch_record.issues if not i.resolved),
                "by_type": issues_by_type,
            },
        }
        return summary

    def _get_issues_by_type(self) -> Dict:
        result = {}
        for issue in self.patch_record.issues:
            t = issue.issue_type
            if t not in result:
                result[t] = {"total": 0, "resolved": 0, "unresolved": 0, "track_ids": []}
            result[t]["total"] += 1
            if issue.resolved:
                result[t]["resolved"] += 1
            else:
                result[t]["unresolved"] += 1
                if issue.track_id and issue.track_id not in result[t]["track_ids"]:
                    result[t]["track_ids"].append(issue.track_id)
        return result

    def _build_track_details(self) -> List[Dict]:
        details = []
        if not self.candidate_table:
            return details

        for record in self.candidate_table.records:
            track_issues = [
                issue for issue in self.patch_record.issues
                if issue.track_id == record.track_id
            ]

            issue_types = [i.issue_type for i in track_issues]
            unresolved_count = sum(1 for i in track_issues if not i.resolved)
            resolved_count = sum(1 for i in track_issues if i.resolved)

            detail = {
                "track_id": record.track_id,
                "predicted_value": record.predicted_value,
                "reported_threshold": record.reported_threshold,
                "is_missing": record.is_missing,
                "source": record.source,
                "status": record.status,
                "has_issues": len(track_issues) > 0,
                "issues_count": len(track_issues),
                "unresolved_issues_count": unresolved_count,
                "resolved_issues_count": resolved_count,
                "issue_types": sorted(list(set(issue_types))),
                "has_duplicate_import": "duplicate_import" in issue_types,
                "has_threshold_mismatch": "threshold_mismatch" in issue_types,
                "duplicate_import_resolved": self._is_issue_type_resolved(track_issues, "duplicate_import"),
                "threshold_mismatch_resolved": self._is_issue_type_resolved(track_issues, "threshold_mismatch"),
                "issues": [],
            }

            for issue in track_issues:
                detail["issues"].append({
                    "issue_id": issue.issue_id,
                    "issue_type": issue.issue_type,
                    "description": issue.description,
                    "severity": issue.severity,
                    "resolved": issue.resolved,
                    "resolved_by": issue.resolved_by,
                    "resolved_at": issue.resolved_at.isoformat() if issue.resolved_at else None,
                    "evidence": issue.evidence,
                })

            if track_issues:
                descs = []
                for i in track_issues:
                    status_tag = "[已解决]" if i.resolved else "[未解决]"
                    descs.append(f"[{i.issue_type}]{status_tag} {i.description}")
                detail["issue_description"] = " | ".join(descs)
                detail["issue_resolved"] = unresolved_count == 0
            else:
                detail["issue_description"] = ""
                detail["issue_resolved"] = True

            details.append(detail)
        return details

    def _is_issue_type_resolved(self, track_issues: List[PatchIssue], issue_type: str) -> Optional[bool]:
        type_issues = [i for i in track_issues if i.issue_type == issue_type]
        if not type_issues:
            return None
        return all(i.resolved for i in type_issues)

    def _build_issues_summary(self) -> Dict:
        issues = self.patch_record.issues
        by_type = {}
        for issue in issues:
            t = issue.issue_type
            if t not in by_type:
                by_type[t] = {
                    "total": 0,
                    "resolved": 0,
                    "unresolved": 0,
                    "track_ids": [],
                    "unresolved_track_ids": [],
                }
            by_type[t]["total"] += 1
            if issue.resolved:
                by_type[t]["resolved"] += 1
            else:
                by_type[t]["unresolved"] += 1
                if issue.track_id and issue.track_id not in by_type[t]["unresolved_track_ids"]:
                    by_type[t]["unresolved_track_ids"].append(issue.track_id)
            if issue.track_id and issue.track_id not in by_type[t]["track_ids"]:
                by_type[t]["track_ids"].append(issue.track_id)

        return {
            "total": len(issues),
            "resolved": sum(1 for i in issues if i.resolved),
            "unresolved": sum(1 for i in issues if not i.resolved),
            "by_type": by_type,
            "needs_data_scientist_review": self.reviewer.needs_data_scientist_review(
                self.patch_record
            ),
        }

    def _refresh_unified_result(self, generated_by: str = ""):
        if not self.candidate_table:
            return
        track_details = self._build_track_details()
        issues_summary = self._build_issues_summary()
        self.unified_result.update_data(
            self.patch_record.tier_metrics,
            track_details,
            issues_summary,
        )
        if generated_by:
            self.unified_result.generated_by = generated_by
        else:
            self.unified_result.generated_by = self.created_by

    def _record_step(self, step: WorkflowStep, description: str, extra: Dict = None):
        self.state.current_step = step
        entry = {
            "step": step,
            "timestamp": get_current_time().isoformat(),
            "description": description,
            "operator": self.created_by,
        }
        if extra:
            entry.update(extra)
        self.state.step_history.append(entry)

    def _update_can_proceed(self):
        unresolved = self.conflict_detector.get_unresolved_conflicts()
        has_critical_issues = any(
            i.severity == "error" and not i.resolved
            for i in self.patch_record.issues
        )

        self.state.can_proceed = len(unresolved) == 0 and not has_critical_issues

        blocking = []
        for c in unresolved:
            blocking.append(f"未解决阈值冲突: {c.track_id} (候选表{c.candidate_value} vs YAML{c.yaml_value})")
        for i in self.patch_record.issues:
            if i.severity == "error" and not i.resolved:
                blocking.append(f"严重问题[{i.issue_type}]: {i.track_id}")
        self.state.blocking_issues = blocking
'''

filepath = "/Users/lzy/pro/solo/workspaces/zy72568/track_prediction_patch/core/workflow.py"
with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print(f"SUCCESS: wrote {len(content)} chars, {content.count(chr(10))} lines to {filepath}")
sys.exit(0)
