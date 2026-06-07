from datetime import datetime
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from .models import (
    ModelOutput,
    ManualJudgment,
    UnifiedResult,
    ReflowStatus,
    ChangeLogEntry,
    EvaluationReport,
    EvaluationReportItem,
)


class ReflowEngine:
    def __init__(self):
        self._results: Dict[str, UnifiedResult] = {}
        self._model_outputs_by_batch: Dict[str, List[ModelOutput]] = defaultdict(list)
        self._manual_judgments_by_sample: Dict[str, List[ManualJudgment]] = defaultdict(list)

    def import_model_output(self, output: ModelOutput, operator: str) -> UnifiedResult:
        self._model_outputs_by_batch[output.batch_id].append(output)

        if output.sample_id not in self._results:
            result = UnifiedResult(
                sample_id=output.sample_id,
                status=ReflowStatus.MODEL_IMPORTED,
                model_output=output,
                current_label=output.predicted_label,
                final_evidence=list(output.evidence_snippets),
                change_history=[
                    ChangeLogEntry(
                        operator=operator,
                        action="model_import",
                        field_name="model_output",
                        new_value=f"batch={output.batch_id}, line={output.original_line_number}",
                        reason="首次导入模型输出片段",
                    )
                ],
            )
            self._results[output.sample_id] = result
        else:
            result = self._results[output.sample_id]
            existing = result.model_output

            if existing and existing.batch_id != output.batch_id:
                self._handle_batch_override(result, existing, output, operator)
            else:
                result.model_output = output
                result.current_label = output.predicted_label
                result.final_evidence = list(output.evidence_snippets)
                result.change_history.append(
                    ChangeLogEntry(
                        operator=operator,
                        action="model_reimport",
                        field_name="model_output",
                        old_value=existing.batch_id if existing else None,
                        new_value=output.batch_id,
                        reason="重新导入同批次模型输出",
                    )
                )

        result.last_updated = datetime.now()
        return result

    def _handle_batch_override(
        self,
        result: UnifiedResult,
        old_output: ModelOutput,
        new_output: ModelOutput,
        operator: str,
    ) -> None:
        has_manual = result.active_manual_judgment is not None

        result.change_history.append(
            ChangeLogEntry(
                operator=operator,
                action="batch_override_detected",
                field_name="model_output.batch_id",
                old_value=old_output.batch_id,
                new_value=new_output.batch_id,
                reason=f"新批跑覆盖旧批跑，旧批={old_output.batch_id}, 新批={new_output.batch_id}",
            )
        )

        if has_manual:
            result.is_covered = True
            result.covered_by_batch_id = new_output.batch_id
            result.status = ReflowStatus.COVERED_PENDING_REVIEW

            for mj in result.manual_judgments:
                if not mj.is_overridden:
                    mj.is_overridden = True
                    mj.override_batch_id = new_output.batch_id
                    mj.override_time = datetime.now()

            result.change_history.append(
                ChangeLogEntry(
                    operator=operator,
                    action="manual_judgment_overridden",
                    field_name="active_manual_judgment",
                    old_value=result.active_manual_judgment.judgment_id,
                    new_value=None,
                    reason="人工改判被新批跑覆盖，等待安全审核同事复核",
                )
            )
            result.active_manual_judgment = None
        else:
            result.model_output = new_output
            result.current_label = new_output.predicted_label
            result.final_evidence = list(new_output.evidence_snippets)

    def add_manual_judgment(
        self, judgment: ManualJudgment, operator: str
    ) -> UnifiedResult:
        sample_id = judgment.sample_id
        self._manual_judgments_by_sample[sample_id].append(judgment)

        if sample_id not in self._results:
            result = UnifiedResult(
                sample_id=sample_id,
                status=ReflowStatus.MANUAL_SUPPLEMENTED,
                active_manual_judgment=judgment,
                manual_judgments=[judgment],
                current_label=judgment.final_label,
                final_evidence=[judgment.on_site_statement],
                change_history=[
                    ChangeLogEntry(
                        operator=operator,
                        action="manual_judgment_add",
                        field_name="active_manual_judgment",
                        new_value=judgment.judgment_id,
                        reason="首次添加人工改判，无对应模型输出",
                    )
                ],
            )
            self._results[sample_id] = result
            return result

        result = self._results[sample_id]
        result.manual_judgments.append(judgment)

        if result.status == ReflowStatus.COVERED_PENDING_REVIEW:
            result.change_history.append(
                ChangeLogEntry(
                    operator=operator,
                    action="manual_judgment_add_while_covered",
                    field_name="manual_judgments",
                    new_value=judgment.judgment_id,
                    reason="覆盖状态下添加人工改判，仍需安全审核复核",
                )
            )
        else:
            old_judgment = result.active_manual_judgment
            result.active_manual_judgment = judgment
            result.current_label = judgment.final_label

            merged_evidence = []
            if result.model_output:
                merged_evidence.extend(result.model_output.evidence_snippets)
            merged_evidence.append(judgment.on_site_statement)
            result.final_evidence = merged_evidence

            if result.status == ReflowStatus.MODEL_IMPORTED:
                result.status = ReflowStatus.MANUAL_SUPPLEMENTED

            result.change_history.append(
                ChangeLogEntry(
                    operator=operator,
                    action="manual_judgment_update",
                    field_name="active_manual_judgment",
                    old_value=old_judgment.judgment_id if old_judgment else None,
                    new_value=judgment.judgment_id,
                    reason="标注负责人补看人工改判表",
                )
            )

        result.last_updated = datetime.now()
        return result

    def review_covered_sample(
        self,
        sample_id: str,
        reviewer: str,
        approve: bool,
        reason: str,
    ) -> UnifiedResult:
        if sample_id not in self._results:
            raise ValueError(f"样本 {sample_id} 不存在")

        result = self._results[sample_id]
        if result.status != ReflowStatus.COVERED_PENDING_REVIEW:
            raise ValueError(f"样本 {sample_id} 不处于待复核状态")

        if approve:
            if result.active_manual_judgment:
                result.current_label = result.active_manual_judgment.final_label
                merged_evidence = []
                if result.model_output:
                    merged_evidence.extend(result.model_output.evidence_snippets)
                merged_evidence.append(result.active_manual_judgment.on_site_statement)
                result.final_evidence = merged_evidence
            elif result.model_output:
                result.current_label = result.model_output.predicted_label
                result.final_evidence = list(result.model_output.evidence_snippets)

            result.is_covered = False
            result.covered_by_batch_id = None
            result.status = ReflowStatus.REVIEW_APPROVED
            result.review_person = reviewer
            result.review_time = datetime.now()

            result.change_history.append(
                ChangeLogEntry(
                    operator=reviewer,
                    action="covered_review_approve",
                    reason=reason or "安全审核同事复核通过，恢复人工改判效力",
                )
            )
        else:
            if result.model_output:
                result.current_label = result.model_output.predicted_label
                result.final_evidence = list(result.model_output.evidence_snippets)

            result.is_covered = False
            result.covered_by_batch_id = None
            result.status = ReflowStatus.REVIEW_APPROVED
            result.review_person = reviewer
            result.review_time = datetime.now()

            result.change_history.append(
                ChangeLogEntry(
                    operator=reviewer,
                    action="covered_review_reject",
                    reason=reason or "安全审核同事复核不通过，以新批跑模型输出为准",
                )
            )

        result.last_updated = datetime.now()
        return result

    def get_result(self, sample_id: str) -> Optional[UnifiedResult]:
        return self._results.get(sample_id)

    def get_all_results(self) -> List[UnifiedResult]:
        return list(self._results.values())

    def get_results_by_status(self, status: ReflowStatus) -> List[UnifiedResult]:
        return [r for r in self._results.values() if r.status == status]

    def generate_evaluation_report(
        self,
        report_id: str,
        operator: str,
        parent_report_id: Optional[str] = None,
        version: int = 1,
    ) -> EvaluationReport:
        items = []
        label_dist: Dict[str, int] = defaultdict(int)

        for result in self._results.values():
            label = result.current_label or "unknown"
            label_dist[label] += 1

            source = "model"
            if result.active_manual_judgment:
                source = "manual"
            elif result.is_covered:
                source = "covered_pending"

            items.append(
                EvaluationReportItem(
                    sample_id=result.sample_id,
                    label=label,
                    source=source,
                    evidence_count=len(result.final_evidence),
                    status=result.status.value,
                    has_manual_judgment=len(result.manual_judgments) > 0,
                    is_covered=result.is_covered,
                )
            )

        report = EvaluationReport(
            report_id=report_id,
            version=version,
            generated_time=datetime.now(),
            generated_by=operator,
            total_samples=len(self._results),
            label_distribution=dict(label_dist),
            items=items,
            parent_report_id=parent_report_id,
        )

        for result in self._results.values():
            if result.status in (
                ReflowStatus.MANUAL_SUPPLEMENTED,
                ReflowStatus.REVIEW_APPROVED,
            ):
                result.status = ReflowStatus.REPORT_UPDATED
                result.change_history.append(
                    ChangeLogEntry(
                        operator=operator,
                        action="report_generated",
                        reason=f"评测报告 {report_id} v{version} 生成",
                    )
                )
                result.last_updated = datetime.now()

        return report

    def export_details(self) -> List[Dict]:
        details = []
        for result in self._results.values():
            detail = {
                "sample_id": result.sample_id,
                "status": result.status.value,
                "current_label": result.current_label,
                "is_covered": result.is_covered,
                "covered_by_batch_id": result.covered_by_batch_id,
                "evidence_count": len(result.final_evidence),
                "final_evidence": result.final_evidence,
                "model_output": None,
                "manual_judgments_count": len(result.manual_judgments),
                "active_judgment_id": (
                    result.active_manual_judgment.judgment_id
                    if result.active_manual_judgment
                    else None
                ),
                "change_history_count": len(result.change_history),
                "last_updated": result.last_updated.isoformat(),
                "review_person": result.review_person,
                "review_time": result.review_time.isoformat() if result.review_time else None,
            }

            if result.model_output:
                detail["model_output"] = {
                    "batch_id": result.model_output.batch_id,
                    "original_line_number": result.model_output.original_line_number,
                    "model_version": result.model_output.model_version,
                    "predicted_label": result.model_output.predicted_label,
                    "confidence": result.model_output.confidence,
                    "import_time": result.model_output.import_time.isoformat(),
                }

            details.append(detail)
        return details
