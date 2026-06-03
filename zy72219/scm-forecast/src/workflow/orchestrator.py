import uuid
from datetime import datetime, date
from pathlib import Path
import sys
from typing import List, Optional, Dict, Any, Tuple

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from config.settings import WORKFLOW_STEPS
from src.models import (
    ForecastDataset,
    WorkflowState,
    WorkflowStepStatus,
    ConflictEvidence,
    ForecastRecord,
    ModificationStatus,
)
from src.core.modification_detector import T1toT2ModificationDetector
from src.core.holiday_validator import HolidayDeferralValidator
from src.core.reconciliation_manager import ReconciliationManager
from src.checks.self_check import SelfCheckEngine
from src.io.handlers import ForecastExporter


class WorkflowOrchestrator:
    def __init__(self):
        self.modification_detector = T1toT2ModificationDetector()
        self.holiday_validator = HolidayDeferralValidator()
        self.reconciliation_manager = ReconciliationManager()
        self.self_check_engine = SelfCheckEngine()
        self.exporter = ForecastExporter()

    def initialize_workflow(self, dataset: ForecastDataset) -> WorkflowState:
        workflow_state = WorkflowState(
            batch_id=dataset.batch.batch_id,
            current_step=0,
        )
        dataset.workflow_state = workflow_state
        return workflow_state

    def _update_step_status(self, dataset: ForecastDataset, step_name: str,
                            status: WorkflowStepStatus, operator: str):
        if dataset.workflow_state:
            dataset.workflow_state.step_statuses[step_name] = status
            dataset.workflow_state.step_timestamps[step_name] = datetime.now()
            dataset.workflow_state.step_operators[step_name] = operator
            if status == WorkflowStepStatus.COMPLETED:
                current_idx = WORKFLOW_STEPS.index(step_name)
                dataset.workflow_state.current_step = current_idx + 1

    def step_1_import_settlement_batch(self, dataset: ForecastDataset,
                                       operator: str = "风控值班老秦") -> Dict[str, Any]:
        """
        第一步: 清算批次号第一次导入
        - 检测重复导入
        - 检测T+1到账被手工改成T+2
        - 生成冲突证据（不自动解决）
        """
        step_name = "import_settlement_batch"
        self._update_step_status(dataset, step_name, WorkflowStepStatus.IN_PROGRESS, operator)

        if dataset.workflow_state is None:
            self.initialize_workflow(dataset)

        mod_result = self.modification_detector.process_modifications(dataset, operator)

        t1_to_t2_conflicts = [
            c for c in dataset.conflicts
            if c.conflict_type in ["manual_modification_t1_to_t2", "batch_vs_holiday_explanation"]
        ]

        dataset.workflow_state.conflicts_found = [c.conflict_id for c in t1_to_t2_conflicts]
        dataset.workflow_state.modifications_found = [c.record_id for c in t1_to_t2_conflicts]
        dataset.workflow_state.t1_to_t2_records = [
            r.record_id for r in dataset.records
            if r.original_settlement_cycle.value == "T+1"
            and r.current_settlement_cycle.value == "T+2"
            and r.is_manually_modified
        ]

        if t1_to_t2_conflicts:
            dataset.workflow_state.requires_manager_review = True
            self._update_step_status(dataset, step_name, WorkflowStepStatus.NEEDS_REVIEW, operator)
        else:
            self._update_step_status(dataset, step_name, WorkflowStepStatus.COMPLETED, operator)

        return {
            "step": step_name,
            "status": dataset.workflow_state.step_statuses[step_name].value,
            "modified_records": mod_result["total_modified"],
            "conflicts_created": mod_result["conflicts_created"],
            "needs_manager_review": dataset.workflow_state.requires_manager_review,
            "t1_to_t2_record_ids": dataset.workflow_state.t1_to_t2_records,
            "conflicts": [
                self.modification_detector.present_resolution_choice(c)
                for c in t1_to_t2_conflicts
            ],
        }

    def step_2_review_holiday_deferral(self, dataset: ForecastDataset,
                                       operator: str = "风控值班老秦") -> Dict[str, Any]:
        """
        第二步: 风控值班老秦补看节假日顺延说明
        - 验证节假日顺延说明是否有效
        - 检测批次号与节假日顺延说明的矛盾
        - 列出冲突证据供确认或驳回
        """
        step_name = "review_holiday_deferral"

        if dataset.workflow_state:
            prev_step = WORKFLOW_STEPS[0]
            if dataset.workflow_state.step_statuses[prev_step] == WorkflowStepStatus.NEEDS_REVIEW:
                return {
                    "step": step_name,
                    "status": "blocked",
                    "reason": "第一步存在待确认的冲突，请先处理T+1→T+2修改的确认或驳回",
                }

        self._update_step_status(dataset, step_name, WorkflowStepStatus.IN_PROGRESS, operator)

        holiday_result = self.holiday_validator.review_holiday_deferral(dataset, operator)

        all_holiday_conflicts = [
            c for c in dataset.conflicts
            if c.conflict_type == "batch_vs_holiday_explanation"
        ]

        pending_holiday_conflicts = [
            c for c in all_holiday_conflicts
            if c.resolution_status == "pending"
        ]

        if pending_holiday_conflicts:
            dataset.workflow_state.conflicts_found.extend(
                [c.conflict_id for c in pending_holiday_conflicts
                 if c.conflict_id not in dataset.workflow_state.conflicts_found]
            )
            dataset.workflow_state.requires_manager_review = True
            self._update_step_status(dataset, step_name, WorkflowStepStatus.NEEDS_REVIEW, operator)
        else:
            self._update_step_status(dataset, step_name, WorkflowStepStatus.COMPLETED, operator)

        return {
            "step": step_name,
            "status": dataset.workflow_state.step_statuses[step_name].value,
            "records_with_deferral": holiday_result["total_records_with_deferral"],
            "holiday_conflicts": holiday_result["conflicts_found"],
            "total_conflicts": holiday_result["total_conflicts_in_dataset"],
            "needs_manager_review": dataset.workflow_state.requires_manager_review,
            "conflict_choices": [
                self.modification_detector.present_resolution_choice(c)
                for c in pending_holiday_conflicts
            ],
        }

    def step_3_update_reconciliation(self, dataset: ForecastDataset,
                                     operator: str = "风控值班老秦") -> Dict[str, Any]:
        """
        第三步: 对账说明更新
        - 检查对账说明与历史记录是否匹配
        - 自动补全缺失的对账说明
        - 标记对账状态
        """
        step_name = "update_reconciliation"

        if dataset.workflow_state:
            for prev_step in WORKFLOW_STEPS[:2]:
                if dataset.workflow_state.step_statuses[prev_step] == WorkflowStepStatus.NEEDS_REVIEW:
                    return {
                        "step": step_name,
                        "status": "blocked",
                        "reason": f"前序步骤[{prev_step}]存在待确认的冲突，请先处理",
                    }

        self._update_step_status(dataset, step_name, WorkflowStepStatus.IN_PROGRESS, operator)

        recon_result = self.reconciliation_manager.update_reconciliation_for_batch(dataset, operator)

        consistency_issues = []
        for record in dataset.records:
            is_consistent, issues = self.reconciliation_manager.verify_historical_consistency(
                dataset, record
            )
            if not is_consistent:
                consistency_issues.append({
                    "record_id": record.record_id,
                    "supplier_name": record.supplier_name,
                    "issues": issues,
                })

        pending_conflicts = [c for c in dataset.conflicts if c.resolution_status == "pending"]
        if pending_conflicts or consistency_issues:
            dataset.workflow_state.requires_manager_review = True
            self._update_step_status(dataset, step_name, WorkflowStepStatus.NEEDS_REVIEW, operator)
        else:
            self._update_step_status(dataset, step_name, WorkflowStepStatus.COMPLETED, operator)
            dataset.workflow_state.is_complete = True
            if not dataset.workflow_state.requires_manager_review:
                dataset.workflow_state.final_report_ready = True

        return {
            "step": step_name,
            "status": dataset.workflow_state.step_statuses[step_name].value,
            "total_records": recon_result["total_records"],
            "records_with_notes": recon_result["records_with_notes"],
            "records_reconciled": recon_result["records_reconciled"],
            "records_mismatch": recon_result["records_mismatch"],
            "notes_added": recon_result["notes_added"],
            "consistency_issues": consistency_issues,
            "pending_conflicts": len(pending_conflicts),
            "workflow_complete": dataset.workflow_state.is_complete,
            "final_report_ready": dataset.workflow_state.final_report_ready,
        }

    def resolve_conflict_interactive(self, dataset: ForecastDataset,
                                     conflict_id: str, action: str,
                                     operator: str,
                                     review_note: Optional[str] = None) -> Dict[str, Any]:
        success = self.modification_detector.resolve_conflict(
            dataset, conflict_id, action, operator, review_note
        )

        if success and dataset.workflow_state:
            pending_conflicts = [c for c in dataset.conflicts if c.resolution_status == "pending"]
            if not pending_conflicts:
                dataset.workflow_state.requires_manager_review = False
                for step_name in WORKFLOW_STEPS:
                    if dataset.workflow_state.step_statuses[step_name] == WorkflowStepStatus.NEEDS_REVIEW:
                        dataset.workflow_state.step_statuses[step_name] = WorkflowStepStatus.COMPLETED

        conflict = next((c for c in dataset.conflicts if c.conflict_id == conflict_id), None)

        return {
            "success": success,
            "conflict_id": conflict_id,
            "action": action,
            "resolution_status": conflict.resolution_status if conflict else None,
            "record_id": conflict.record_id if conflict else None,
            "requires_manager_review": dataset.workflow_state.requires_manager_review if dataset.workflow_state else None,
        }

    def run_full_workflow(self, dataset: ForecastDataset,
                          supplementary_dataset: Optional[ForecastDataset] = None,
                          operator: str = "风控值班老秦",
                          auto_resolve: bool = False) -> Dict[str, Any]:
        results = {}

        results["step_1"] = self.step_1_import_settlement_batch(dataset, operator)

        if results["step_1"]["status"] == "needs_review" and not auto_resolve:
            results["workflow_blocked"] = True
            results["blocked_reason"] = "步骤1有待确认冲突，请调用resolve_conflict_interactive处理"
            return results

        results["step_2"] = self.step_2_review_holiday_deferral(dataset, operator)

        if results["step_2"].get("status") == "needs_review" and not auto_resolve:
            results["workflow_blocked"] = True
            results["blocked_reason"] = "步骤2有待确认冲突，请调用resolve_conflict_interactive处理"
            return results

        results["step_3"] = self.step_3_update_reconciliation(dataset, operator)

        check_report = self.self_check_engine.run_all_checks(
            dataset, supplementary_dataset
        )
        results["self_check_report"] = self.self_check_engine.get_check_summary(check_report)

        if check_report.overall_pass and dataset.workflow_state and dataset.workflow_state.is_complete:
            dataset.workflow_state.final_report_ready = True

        export_path = self.exporter.export_to_json(dataset)
        report_path = self.exporter.export_report_to_txt(dataset, check_report)

        results["exported_json"] = export_path
        results["exported_report"] = report_path
        results["final_report_ready"] = dataset.workflow_state.final_report_ready if dataset.workflow_state else False

        return results

    def get_workflow_summary(self, dataset: ForecastDataset) -> Dict[str, Any]:
        if not dataset.workflow_state:
            return {"error": "工作流未初始化"}

        summary = {
            "batch_id": dataset.batch.batch_id,
            "current_step_index": dataset.workflow_state.current_step,
            "is_complete": dataset.workflow_state.is_complete,
            "final_report_ready": dataset.workflow_state.final_report_ready,
            "requires_manager_review": dataset.workflow_state.requires_manager_review,
            "t1_to_t2_records": dataset.workflow_state.t1_to_t2_records,
            "pending_conflicts": [
                {
                    "conflict_id": c.conflict_id,
                    "record_id": c.record_id,
                    "conflict_type": c.conflict_type,
                    "resolution_status": c.resolution_status,
                }
                for c in dataset.conflicts
                if c.resolution_status == "pending"
            ],
            "steps": [],
        }

        for step_name in WORKFLOW_STEPS:
            status = dataset.workflow_state.step_statuses.get(step_name, WorkflowStepStatus.NOT_STARTED)
            timestamp = dataset.workflow_state.step_timestamps.get(step_name)
            operator = dataset.workflow_state.step_operators.get(step_name)
            summary["steps"].append({
                "step_name": step_name,
                "status": status.value,
                "timestamp": timestamp.isoformat() if timestamp else None,
                "operator": operator,
            })

        return summary
