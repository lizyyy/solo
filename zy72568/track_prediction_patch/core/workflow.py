from dataclasses import dataclass, field
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
