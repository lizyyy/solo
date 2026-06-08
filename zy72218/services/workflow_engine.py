from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, date
from dataclasses import dataclass
from enum import Enum

from models import (
    HolidayExtension,
    TailAdjustment,
    FundMatchRecord,
    DiscrepancyItem,
    ConflictEvidence,
    MatchStatus,
    DiscrepancyStatus,
    entity_to_dict,
)
from repository import MatchRepository
from services.matching_engine import MatchingEngine
from services.conflict_detector import ConflictDetector
from services.self_checker import SelfChecker
from services.audit_service import AuditService


class WorkflowStep(str, Enum):
    STEP_1_IMPORT_HOLIDAY = "第一步：导入节假日顺延说明"
    STEP_2_REVIEW_TAIL = "第二步：投研助理补看尾差调整条"
    STEP_3_UPDATE_DISCREPANCY = "第三步：更新差异清单"
    COMPLETED = "流程完成"


@dataclass
class WorkflowState:
    business_no: str
    current_step: WorkflowStep
    step_results: Dict[WorkflowStep, Any]
    has_split_records: bool = False
    requires_supervisor_review: bool = False
    has_conflict: bool = False
    conflict_resolved: bool = False
    started_at: datetime = None
    last_updated_at: datetime = None

    def __post_init__(self):
        if self.started_at is None:
            self.started_at = datetime.now()
        if self.last_updated_at is None:
            self.last_updated_at = datetime.now()


class WorkflowEngine:
    def __init__(
        self,
        repository: Optional[MatchRepository] = None,
        matching_engine: Optional[MatchingEngine] = None,
        conflict_detector: Optional[ConflictDetector] = None,
        self_checker: Optional[SelfChecker] = None,
        audit_service: Optional[AuditService] = None,
    ):
        self.repo = repository or MatchRepository()
        self.matching_engine = matching_engine or MatchingEngine(self.repo)
        self.conflict_detector = conflict_detector or ConflictDetector(self.repo)
        self.self_checker = self_checker or SelfChecker(self.repo)
        self.audit = audit_service or AuditService(self.repo)
        self._workflows: Dict[str, WorkflowState] = {}

    def start_workflow(self, business_no: str) -> WorkflowState:
        records = self.repo.get_records_by_business_no(business_no)
        has_split = any(r.is_split_record() for r in records)
        requires_review = any(r.status == MatchStatus.PENDING_REVIEW for r in records)

        state = WorkflowState(
            business_no=business_no,
            current_step=WorkflowStep.STEP_1_IMPORT_HOLIDAY,
            step_results={},
            has_split_records=has_split,
            requires_supervisor_review=requires_review,
        )
        self._workflows[business_no] = state

        self.audit.log_change(
            business_no=business_no,
            operator="投研助理小周",
            action="启动业务流程",
            field_changed="workflow_step",
            old_value=None,
            new_value=WorkflowStep.STEP_1_IMPORT_HOLIDAY.value,
            reason="开始处理发票池融资匹配三步流程",
            affected_record_ids=[r.record_id for r in records],
            affected_calculation_fields=["status"],
        )

        return state

    def step_1_import_holiday_extension(
        self,
        business_no: str,
        extension: HolidayExtension,
        operator: str,
    ) -> Dict[str, Any]:
        state = self._get_or_create_state(business_no)
        state.current_step = WorkflowStep.STEP_1_IMPORT_HOLIDAY

        records = self.matching_engine.apply_holiday_extension(extension, operator)

        check_results = self.self_checker.run_all_checks()

        state.step_results[WorkflowStep.STEP_1_IMPORT_HOLIDAY] = {
            "holiday_extension": extension,
            "affected_records": len(records),
            "self_check_results": [
                {"type": r.check_type.value, "passed": r.passed, "message": r.message}
                for r in check_results
            ],
            "timestamp": datetime.now(),
        }
        state.last_updated_at = datetime.now()

        export_data = self.repo.get_match_records_for_export()
        display_data = self.repo.get_match_records_for_display()
        api_data = self.repo.get_match_records_for_api()

        return {
            "workflow_step": WorkflowStep.STEP_1_IMPORT_HOLIDAY.value,
            "business_no": business_no,
            "message": "节假日顺延说明已导入，完成初步匹配。请检查自检结果。",
            "holiday_extension": {
                "extension_days": extension.extension_days,
                "original_due_date": extension.original_due_date.isoformat() if extension.original_due_date else None,
                "extended_due_date": extension.extended_due_date.isoformat() if extension.extended_due_date else None,
                "conclusion": extension.conclusion,
                "reason": extension.reason,
            },
            "affected_records_count": len(records),
            "self_check_summary": self._summarize_checks(check_results),
            "next_step": WorkflowStep.STEP_2_REVIEW_TAIL.value,
            "warning": self._generate_step_warning(state, records),
            "data_consistency_verified": self._verify_data_consistency(export_data, display_data, api_data),
            "export_sample": export_data[:3],
        }

    def step_2_review_tail_adjustment(
        self,
        business_no: str,
        adjustment: TailAdjustment,
        operator: str,
    ) -> Dict[str, Any]:
        state = self._get_or_create_state(business_no)
        state.current_step = WorkflowStep.STEP_2_REVIEW_TAIL

        records = self.matching_engine.apply_tail_adjustment(adjustment, operator)

        conflicts = self.conflict_detector.detect_conflicts([business_no])
        state.has_conflict = len(conflicts) > 0

        conflict_decision = None
        if state.has_conflict:
            conflict_decision = self.conflict_detector.present_conflict_for_decision(business_no)

        check_results = self.self_checker.run_all_checks()

        state.step_results[WorkflowStep.STEP_2_REVIEW_TAIL] = {
            "tail_adjustment": adjustment,
            "affected_records": len(records),
            "conflicts_found": len(conflicts),
            "conflict_evidence": [entity_to_dict(c) for c in conflicts] if conflicts else [],
            "self_check_results": [
                {"type": r.check_type.value, "passed": r.passed, "message": r.message}
                for r in check_results
            ],
            "timestamp": datetime.now(),
        }
        state.last_updated_at = datetime.now()

        if state.has_conflict:
            state.current_step = WorkflowStep.STEP_2_REVIEW_TAIL
            return {
                "workflow_step": WorkflowStep.STEP_2_REVIEW_TAIL.value,
                "business_no": business_no,
                "message": "尾差调整条已补录，但检测到与节假日顺延说明存在冲突！请投研助理小周手动选择确认或驳回。",
                "has_conflict": True,
                "conflict_decision": conflict_decision,
                "required_action": "请在下方选择采用哪种规则，或驳回两者要求业务重新提供。",
                "available_actions": [
                    {"action": "confirm_holiday", "description": "确认采用节假日顺延说明结论"},
                    {"action": "confirm_tail", "description": "确认采用尾差调整条结论"},
                    {"action": "reject_both", "description": "驳回两者，需要业务重新提供"},
                ],
                "warning": "请投研助理小周手动选择确认或驳回，系统不会自动采用节假日顺延说明结论，请仔细核对尾差调整条后手动决策。",
            }

        export_data = self.repo.get_match_records_for_export()
        display_data = self.repo.get_match_records_for_display()
        api_data = self.repo.get_match_records_for_api()

        return {
            "workflow_step": WorkflowStep.STEP_2_REVIEW_TAIL.value,
            "business_no": business_no,
            "message": "尾差调整条已补录，未检测到冲突。可继续下一步。",
            "has_conflict": False,
            "tail_adjustment": {
                "adjustment_amount": adjustment.adjustment_amount,
                "calculation_rule": adjustment.calculation_rule,
                "reason": adjustment.reason,
            },
            "affected_records_count": len(records),
            "self_check_summary": self._summarize_checks(check_results),
            "next_step": WorkflowStep.STEP_3_UPDATE_DISCREPANCY.value,
            "split_records_need_review": state.has_split_records,
            "warning": self._generate_step_warning(state, records),
            "data_consistency_verified": self._verify_data_consistency(export_data, display_data, api_data),
        }

    def resolve_conflict(
        self,
        business_no: str,
        action: str,
        operator: str,
        reason: str,
    ) -> Dict[str, Any]:
        state = self._get_or_create_state(business_no)

        resolution = self.conflict_detector.resolve_conflict(
            business_no=business_no,
            action=action,
            operator=operator,
            reason=reason,
        )

        if resolution:
            state.conflict_resolved = True

            self.matching_engine.recalculate_matched_amounts(
                business_no=business_no,
                operator=operator,
                reason=f"冲突解决：{reason}",
            )

            check_results = self.self_checker.run_all_checks()

            return {
                "workflow_step": WorkflowStep.STEP_2_REVIEW_TAIL.value,
                "business_no": business_no,
                "message": "冲突已解决，已按您的选择更新匹配金额。",
                "resolution": {
                    "chosen_rule": resolution.chosen_rule,
                    "final_amount": resolution.final_amount,
                    "status": resolution.resolution.value,
                    "reason": reason,
                },
                "next_step": WorkflowStep.STEP_3_UPDATE_DISCREPANCY.value,
                "self_check_summary": self._summarize_checks(check_results),
                "warning": self._generate_step_warning(
                    state, self.repo.get_records_by_business_no(business_no)
                ),
            }

        return {"error": "未找到冲突记录"}

    def step_3_update_discrepancy_list(
        self,
        business_no: str,
        operator: str,
        supervisor_notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        state = self._get_or_create_state(business_no)
        state.current_step = WorkflowStep.STEP_3_UPDATE_DISCREPANCY

        self.matching_engine.recalculate_matched_amounts(
            business_no=business_no,
            operator=operator,
            reason="更新差异清单，重新计算匹配金额",
        )

        records = self.repo.get_records_by_business_no(business_no)
        discrepancies = self.repo.get_discrepancies_by_business_no(business_no)
        split_discrepancies = [d for d in discrepancies if d.is_split_record]
        other_discrepancies = [d for d in discrepancies if not d.is_split_record]

        check_results = self.self_checker.run_all_checks()

        state.step_results[WorkflowStep.STEP_3_UPDATE_DISCREPANCY] = {
            "discrepancies_updated": len(discrepancies),
            "split_record_discrepancies": len(split_discrepancies),
            "self_check_results": [
                {"type": r.check_type.value, "passed": r.passed, "message": r.message}
                for r in check_results
            ],
            "timestamp": datetime.now(),
        }

        if split_discrepancies:
            state.requires_supervisor_review = True
            state.last_updated_at = datetime.now()
            return {
                "workflow_step": WorkflowStep.STEP_3_UPDATE_DISCREPANCY.value,
                "business_no": business_no,
                "message": "差异清单已更新，但同一业务号拆分为本金和手续费的记录需要结算主管复核。",
                "requires_supervisor_review": True,
                "split_record_discrepancies": [
                    {
                        "discrepancy_id": d.discrepancy_id,
                        "description": d.description,
                        "related_record_ids": d.related_record_ids,
                    }
                    for d in split_discrepancies
                ],
                "required_action": "请结算主管复核拆分行记录，确认金额拆分是否正确。",
                "available_actions": [
                    {"action": "confirm_split", "description": "确认拆分正确，标记为已匹配"},
                    {"action": "reject_split", "description": "驳回拆分，要求业务重新处理"},
                ],
                "warning": "拆分行记录系统不会自动归为正常，必须由结算主管手动复核确认。",
            }

        state.current_step = WorkflowStep.COMPLETED
        state.last_updated_at = datetime.now()

        export_data = self.repo.get_match_records_for_export()
        display_data = self.repo.get_match_records_for_display()
        api_data = self.repo.get_match_records_for_api()

        records_final = self.repo.get_records_by_business_no(business_no)
        for record in records_final:
            if record.status == MatchStatus.DISCREPANCY:
                record.status = MatchStatus.MATCHED
                record.updated_at = datetime.now()
                record.updated_by = operator

        self.audit.log_change(
            business_no=business_no,
            operator=operator,
            action="完成三步流程",
            field_changed="workflow_step",
            old_value=WorkflowStep.STEP_3_UPDATE_DISCREPANCY.value,
            new_value=WorkflowStep.COMPLETED.value,
            reason="三步流程全部完成，差异已处理",
            affected_record_ids=[r.record_id for r in records_final],
            affected_calculation_fields=["status", "matched_amount"],
        )

        return {
            "workflow_step": WorkflowStep.COMPLETED.value,
            "business_no": business_no,
            "message": "三步业务流程已全部完成！",
            "discrepancies_resolved": len(other_discrepancies),
            "final_records": [
                {
                    "record_id": r.record_id,
                    "record_type": r.record_type.value,
                    "expected_amount": r.expected_amount,
                    "matched_amount": r.matched_amount,
                    "status": r.status.value,
                    "is_split_record": r.is_split_record(),
                }
                for r in records_final
            ],
            "self_check_summary": self._summarize_checks(check_results),
            "data_consistency_verified": self._verify_data_consistency(export_data, display_data, api_data),
            "export_data": export_data,
            "display_data": display_data,
            "api_data": api_data,
            "review_summary": self.audit.get_review_summary(business_no),
        }

    def supervisor_review_split_records(
        self,
        business_no: str,
        operator: str,
        confirm: bool,
        notes: str,
    ) -> Dict[str, Any]:
        state = self._get_or_create_state(business_no)

        records = self.matching_engine.confirm_split_records(
            business_no=business_no,
            operator=operator,
            confirm=confirm,
            notes=notes,
        )

        state.requires_supervisor_review = False

        if confirm:
            state.current_step = WorkflowStep.COMPLETED
            state.last_updated_at = datetime.now()

            check_results = self.self_checker.run_all_checks()

            self.audit.log_change(
                business_no=business_no,
                operator=operator,
                action="结算主管复核完成",
                field_changed="workflow_step",
                old_value=WorkflowStep.STEP_3_UPDATE_DISCREPANCY.value,
                new_value=WorkflowStep.COMPLETED.value,
                reason=f"主管复核拆分行：{notes}",
                affected_record_ids=[r.record_id for r in records],
                affected_calculation_fields=["status"],
            )

            export_data = self.repo.get_match_records_for_export()
            display_data = self.repo.get_match_records_for_display()
            api_data = self.repo.get_match_records_for_api()

            return {
                "workflow_step": WorkflowStep.COMPLETED.value,
                "business_no": business_no,
                "message": "结算主管复核通过，三步业务流程已全部完成！",
                "supervisor_decision": "confirmed",
                "supervisor_notes": notes,
                "final_records": [
                    {
                        "record_id": r.record_id,
                        "record_type": r.record_type.value,
                        "expected_amount": r.expected_amount,
                        "matched_amount": r.matched_amount,
                        "status": r.status.value,
                    }
                    for r in records
                ],
                "self_check_summary": self._summarize_checks(check_results),
                "data_consistency_verified": self._verify_data_consistency(
                    export_data, display_data, api_data
                ),
                "review_summary": self.audit.get_review_summary(business_no),
            }

        return {
            "workflow_step": WorkflowStep.STEP_3_UPDATE_DISCREPANCY.value,
            "business_no": business_no,
            "message": "拆分行已被驳回，请业务重新处理后再提交复核。",
            "supervisor_decision": "rejected",
            "supervisor_notes": notes,
        }

    def get_workflow_state(self, business_no: str) -> Optional[WorkflowState]:
        return self._workflows.get(business_no)

    def get_current_step(self, business_no: str) -> Optional[WorkflowStep]:
        state = self._workflows.get(business_no)
        return state.current_step if state else None

    def _get_or_create_state(self, business_no: str) -> WorkflowState:
        if business_no not in self._workflows:
            return self.start_workflow(business_no)
        return self._workflows[business_no]

    def _summarize_checks(self, check_results) -> Dict[str, Any]:
        passed = sum(1 for r in check_results if r.passed)
        failed = len(check_results) - passed
        return {
            "total_checks": len(check_results),
            "passed": passed,
            "failed": failed,
            "all_passed": failed == 0,
            "failed_checks": [
                {"type": r.check_type.value, "message": r.message, "details": r.details}
                for r in check_results
                if not r.passed
            ],
        }

    def _verify_data_consistency(self, export_data, display_data, api_data) -> bool:
        if len(export_data) != len(display_data) or len(export_data) != len(api_data):
            return False

        key_fields = ["record_id", "business_no", "record_type", "expected_amount", "matched_amount", "status"]

        for i in range(len(export_data)):
            for field in key_fields:
                if not (
                    export_data[i].get(field) == display_data[i].get(field) == api_data[i].get(field)
                ):
                    return False

        return True

    def _generate_step_warning(self, state: WorkflowState, records: List[FundMatchRecord]) -> List[str]:
        warnings = []

        if state.has_split_records:
            warnings.append("包含同一业务号拆分为本金和手续费的记录，系统不会自动归正常，后续需要结算主管复核。")

        if state.has_conflict and not state.conflict_resolved:
            warnings.append("节假日顺延说明与尾差调整条存在冲突，请先解决冲突再继续。")

        statuses = {r.status for r in records}
        if MatchStatus.DISCREPANCY in statuses:
            warnings.append("存在金额差异记录，请在更新差异清单时处理。")

        return warnings
