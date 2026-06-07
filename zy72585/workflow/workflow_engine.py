from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Callable

from models.candidate import CandidateTable, CandidateRecord
from models.params import ParamsYAML
from models.layer import LayerResult, LayerItem, LayerStatus, DecisionReason, ResponsibleRole
from core.dedup_engine import DedupEngine
from core.threshold_checker import ThresholdChecker


class WorkflowStep(str, Enum):
    STEP_1_IMPORT = "step_1_import_candidates"
    STEP_2_REVIEW_PARAMS = "step_2_review_params_yaml"
    STEP_3_UPDATE_LAYERS = "step_3_update_layers"
    REVIEW_BY_SCIENTIST = "review_by_data_scientist"
    COMPLETED = "completed"


@dataclass
class WorkflowContext:
    candidate_table: Optional[CandidateTable] = None
    params_yaml: Optional[ParamsYAML] = None
    layer_result: Optional[LayerResult] = None
    current_step: WorkflowStep = WorkflowStep.STEP_1_IMPORT
    threshold_mismatches_found: bool = False
    pending_review_items: List[str] = field(default_factory=list)
    step_logs: List[Dict[str, Any]] = field(default_factory=list)

    def log_step(self, step: WorkflowStep, operator: str, details: Dict[str, Any] = None) -> None:
        self.step_logs.append({
            "step": step.value,
            "timestamp": datetime.now().isoformat(),
            "operator": operator,
            "details": details or {},
        })

    def to_dict(self) -> Dict[str, Any]:
        return {
            "current_step": self.current_step.value,
            "threshold_mismatches_found": self.threshold_mismatches_found,
            "pending_review_count": len(self.pending_review_items),
            "step_logs": self.step_logs,
        }


class WorkflowEngine:
    def __init__(self):
        self.dedup_engine = DedupEngine()
        self.threshold_checker = ThresholdChecker()

    def start_workflow(self, name: str) -> WorkflowContext:
        ctx = WorkflowContext()
        ctx.log_step(WorkflowStep.STEP_1_IMPORT, "system", {"workflow_name": name})
        return ctx

    def execute_step_1_import(
        self,
        ctx: WorkflowContext,
        table_name: str,
        records: List[CandidateRecord],
        operator: str,
        source: str = ""
    ) -> Dict[str, Any]:
        assert ctx.current_step == WorkflowStep.STEP_1_IMPORT, f"当前步骤应为 STEP_1_IMPORT，实际为 {ctx.current_step}"

        table = CandidateTable(name=table_name, source=source)
        import_result = self.dedup_engine.safe_import_records(
            table, records, operator, reason="工作流第一步：导入召回候选表"
        )

        ctx.candidate_table = table
        ctx.current_step = WorkflowStep.STEP_2_REVIEW_PARAMS
        ctx.log_step(WorkflowStep.STEP_2_REVIEW_PARAMS, operator, {
            "table_id": table.id,
            "import_result": import_result,
        })

        return {
            "step_completed": WorkflowStep.STEP_1_IMPORT.value,
            "next_step": WorkflowStep.STEP_2_REVIEW_PARAMS.value,
            "candidate_table_id": table.id,
            "record_count": table.get_record_count(),
            "import_result": import_result,
        }

    def execute_step_2_review_params(
        self,
        ctx: WorkflowContext,
        params: ParamsYAML,
        operator: str,
        reviews: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        assert ctx.current_step == WorkflowStep.STEP_2_REVIEW_PARAMS, f"当前步骤应为 STEP_2_REVIEW_PARAMS，实际为 {ctx.current_step}"
        assert ctx.candidate_table is not None, "请先完成步骤1：导入召回候选表"

        ctx.params_yaml = params
        ctx.current_step = WorkflowStep.STEP_3_UPDATE_LAYERS
        ctx.log_step(WorkflowStep.STEP_3_UPDATE_LAYERS, operator, {
            "params_id": params.id,
            "threshold_count": len(params.thresholds),
            "reviews": reviews or {},
        })

        return {
            "step_completed": WorkflowStep.STEP_2_REVIEW_PARAMS.value,
            "next_step": WorkflowStep.STEP_3_UPDATE_LAYERS.value,
            "params_yaml_id": params.id,
            "thresholds": params.thresholds,
            "reviews": reviews or {},
        }

    def execute_step_3_update_layers(
        self,
        ctx: WorkflowContext,
        layer_name: str,
        scoring_fn: Callable[[CandidateRecord, ParamsYAML], float],
        threshold_name: str,
        operator: str
    ) -> Dict[str, Any]:
        assert ctx.current_step == WorkflowStep.STEP_3_UPDATE_LAYERS, f"当前步骤应为 STEP_3_UPDATE_LAYERS，实际为 {ctx.current_step}"
        assert ctx.candidate_table is not None and ctx.params_yaml is not None, "请先完成前两步"

        layer_result = LayerResult(name=layer_name)
        layer_result.candidate_table_id = ctx.candidate_table.id
        layer_result.params_yaml_id = ctx.params_yaml.id
        layer_result.generation_method = "workflow_step_3"
        layer_result.workflow_step = "step_3"

        threshold_value = ctx.params_yaml.get_threshold(threshold_name)

        for rec_id, record in ctx.candidate_table.records.items():
            score = scoring_fn(record, ctx.params_yaml)
            item = LayerItem(record_id=rec_id, layer_name=layer_name, score=score)
            item.lineage.candidate_table_id = ctx.candidate_table.id
            item.lineage.candidate_record_id = rec_id
            item.lineage.params_yaml_id = ctx.params_yaml.id
            item.lineage.params_version = ctx.params_yaml.version
            item.lineage.threshold_name = threshold_name
            item.lineage.threshold_value_at_time = threshold_value

            reason = self._generate_decision_reason(score, threshold_value, record)
            item.reason = reason

            if score > threshold_value if threshold_value else False:
                item.status = LayerStatus.CONFIRMED_ANOMALY
            else:
                item.status = LayerStatus.PENDING_REVIEW

            layer_result.add_item(item)

        ctx.layer_result = layer_result
        ctx.current_step = WorkflowStep.STEP_3_UPDATE_LAYERS

        scan_result = self.threshold_checker.scan_all_items_for_mismatch(
            layer_result, ctx.params_yaml, operator, auto_suspend=True
        )

        if scan_result["mismatch_count"] > 0:
            ctx.threshold_mismatches_found = True
            ctx.pending_review_items = [m["record_id"] for m in scan_result["mismatches"]]
            ctx.current_step = WorkflowStep.REVIEW_BY_SCIENTIST
            ctx.log_step(WorkflowStep.REVIEW_BY_SCIENTIST, operator, scan_result)
            next_step = WorkflowStep.REVIEW_BY_SCIENTIST.value
        else:
            ctx.current_step = WorkflowStep.COMPLETED
            next_step = WorkflowStep.COMPLETED.value

        ctx.log_step(WorkflowStep.COMPLETED if not ctx.threshold_mismatches_found else WorkflowStep.REVIEW_BY_SCIENTIST,
                     operator, {"layer_result_id": layer_result.id})

        return {
            "step_completed": WorkflowStep.STEP_3_UPDATE_LAYERS.value,
            "next_step": next_step,
            "layer_result_id": layer_result.id,
            "total_items": layer_result.get_item_count(),
            "threshold_scan": scan_result,
            "summary": layer_result.get_summary(),
        }

    def scientist_review(
        self,
        ctx: WorkflowContext,
        record_id: str,
        decision: str,
        operator: str,
        comment: str = ""
    ) -> Dict[str, Any]:
        assert ctx.layer_result is not None, "请先生成分层结果"

        item = ctx.layer_result.get_item(record_id)
        assert item is not None, f"记录 {record_id} 不存在"

        if decision == "confirm_normal":
            item.update({
                "status": LayerStatus.CONFIRMED_NORMAL,
                "threshold_mismatch": False,
            }, operator, reason=f"数据科学家复核确认正常：{comment}")
        elif decision == "confirm_anomaly":
            item.update({
                "status": LayerStatus.CONFIRMED_ANOMALY,
                "threshold_mismatch": False,
            }, operator, reason=f"数据科学家复核确认为异常：{comment}")
        elif decision == "send_back_to_engineer":
            item.update({
                "status": LayerStatus.NEEDS_ALGORITHM_ENGINEER,
            }, operator, reason=f"数据科学家退回给算法工程师：{comment}")

        if record_id in ctx.pending_review_items:
            ctx.pending_review_items.remove(record_id)

        if len(ctx.pending_review_items) == 0 and ctx.threshold_mismatches_found:
            ctx.threshold_mismatches_found = False
            ctx.current_step = WorkflowStep.COMPLETED

        return {
            "record_id": record_id,
            "new_status": item.status.value,
            "pending_count": len(ctx.pending_review_items),
        }

    def _generate_decision_reason(
        self,
        score: float,
        threshold: Optional[float],
        record: CandidateRecord
    ) -> DecisionReason:
        reason = DecisionReason()
        reason.confidence = min(1.0, score / (threshold * 1.5)) if threshold else 0.5

        if threshold and score > threshold:
            reason.why_kept = f"分数 {score:.3f} 超过阈值 {threshold}，判定为异常点"
            reason.missing_materials = []
            reason.next_step_owner = ResponsibleRole.ALGORITHM_ENGINEER
            reason.next_action = "确认特征计算正确性，检查数据来源"
        elif threshold:
            reason.why_kept = f"分数 {score:.3f} 未超过阈值 {threshold}，但保留观察"
            reason.missing_materials = ["更多历史数据对比", "关联特征分析"]
            reason.next_step_owner = ResponsibleRole.DATA_SCIENTIST
            reason.next_action = "分析是否为新型异常模式"
        else:
            reason.why_kept = "阈值未设置，暂保留"
            reason.missing_materials = ["需要设置阈值"]
            reason.next_step_owner = ResponsibleRole.BOTH
            reason.next_action = "配置参数YAML中的阈值"

        return reason
