from datetime import datetime
from typing import Dict, Optional, List
from models import (
    WorkflowState, ConflictStatus, ParameterYAML,
    EvaluationSlice, ScoreBucketDiff
)
from history_tracker import HistoryTracker
from yaml_importer import YAMLImporter
from slice_manager import SliceManager
from comparison_manager import ComparisonManager
from self_checker import SelfChecker
from export_manager import ExportManager


class WorkflowManager:
    def __init__(self):
        self.history_tracker = HistoryTracker()
        self.yaml_importer = YAMLImporter(self.history_tracker)
        self.slice_manager = SliceManager(self.history_tracker)
        self.comparison_manager = ComparisonManager(
            self.slice_manager, self.history_tracker
        )
        self.self_checker = SelfChecker(
            self.yaml_importer, self.slice_manager, self.comparison_manager
        )
        self.export_manager = ExportManager(
            self.yaml_importer, self.slice_manager, self.comparison_manager,
            self.history_tracker, self.self_checker
        )
        self.workflow_states: Dict[str, WorkflowState] = {}

    def _update_status_description(self, experiment_id: str):
        state = self.workflow_states.get(experiment_id)
        if not state:
            return
        
        if state.archived:
            state.status_description = "已归档"
        elif state.exported:
            state.status_description = "已导出，可以归档"
        elif state.step == 3:
            state.status_description = "实验对比已更新，可以导出或归档"
        elif state.step == 2 and state.pending_review_items:
            state.status_description = f"评测切片已补录，存在 {len(state.pending_review_items)} 个冲突待复核"
        elif state.step == 2 and not state.pending_review_items:
            state.status_description = "评测切片已补录，冲突已全部处理，可以更新实验对比"
        elif state.step == 1:
            state.status_description = "参数YAML已导入，等待评测运营补看评测切片"
    
    def step1_import_yaml(self, yaml_content: str, operator: str = "系统") -> Dict:
        param_yaml, import_type = self.yaml_importer.import_yaml(
            yaml_content, operator
        )
        experiment_id = param_yaml.experiment_id
        
        is_first_import = import_type == "首次导入"
        if is_first_import:
            self.comparison_manager.create_comparison(param_yaml)
            state = WorkflowState(
                experiment_id=experiment_id,
                step=1,
                step_name="参数YAML第一次导入",
                parameters_imported=True,
                slice_reviewed=False,
                comparison_updated=False
            )
            self.workflow_states[experiment_id] = state
        else:
            comparison = self.comparison_manager.get_comparison(experiment_id)
            if comparison:
                comparison.yaml_metrics = param_yaml.metrics.copy()
                comparison.experiment_name = param_yaml.experiment_name
                slices = self.slice_manager.get_slices_for_experiment(experiment_id)
                if slices:
                    latest_slice = slices[-1]
                    metric_diffs = {}
                    for metric_name, yaml_val in param_yaml.metrics.items():
                        if metric_name in latest_slice.metrics:
                            metric_diffs[metric_name] = latest_slice.metrics[metric_name] - yaml_val
                    comparison.metric_diffs = metric_diffs
                    comparison.score_bucket_diff = self.slice_manager.check_score_bucket_diff(
                        param_yaml, latest_slice
                    )
                    comparison.conflicts = self.slice_manager.detect_conflicts(
                        param_yaml, latest_slice
                    )
                comparison.last_update_time = datetime.now()
        
        self._update_status_description(experiment_id)
        check_results = self.self_checker.run_all_checks(experiment_id)
        state = self.workflow_states[experiment_id]
        
        output = {
            "experiment_id": experiment_id,
            "experiment_name": param_yaml.experiment_name,
            "step": state.step,
            "step_name": state.step_name,
            "import_type": import_type,
            "import_count": self.yaml_importer.get_import_count(experiment_id),
            "current_status": state.status_description,
            "next_step": "等待评测运营小孟补看评测切片",
            "self_check": self.self_checker.format_results(check_results),
            "history_log": self._get_recent_history(experiment_id, 5)
        }
        return output

    def step2_review_slice(
        self,
        experiment_id: str,
        slice_metrics: Dict[str, float],
        score_distribution: Dict[str, int],
        uploader: str,
        notes: str = "",
        source: str = "补录"
    ) -> Dict:
        state = self.workflow_states.get(experiment_id)
        if not state:
            return {"error": f"实验 {experiment_id} 不存在，请先执行步骤1"}
        
        param_yaml = self.yaml_importer.get_yaml(experiment_id)
        if not param_yaml:
            return {"error": f"实验 {experiment_id} 的参数YAML不存在"}
        
        eval_slice = self.slice_manager.add_slice(
            experiment_id=experiment_id,
            metrics=slice_metrics,
            score_distribution=score_distribution,
            uploader=uploader,
            notes=notes,
            source=source
        )
        
        comparison = self.comparison_manager.update_comparison_with_slice(
            experiment_id, eval_slice, param_yaml
        )
        
        pending_conflicts = self.slice_manager.get_pending_conflicts(experiment_id)
        
        state.step = 2
        state.step_name = "评测运营小孟补看评测切片"
        state.slice_reviewed = True
        state.pending_review_items = [c.conflict_id for c in pending_conflicts]
        
        has_one_bucket_diff = comparison.score_bucket_diff == ScoreBucketDiff.ONE_BUCKET
        
        self._update_status_description(experiment_id)
        check_results = self.self_checker.run_all_checks(experiment_id)
        
        output = {
            "experiment_id": experiment_id,
            "experiment_name": param_yaml.experiment_name,
            "step": state.step,
            "step_name": state.step_name,
            "current_status": state.status_description,
            "conflict_total": len(comparison.conflicts),
            "conflict_pending": len(pending_conflicts),
            "pending_conflicts": [
                {
                    "conflict_id": c.conflict_id,
                    "field": c.field_name,
                    "description": c.description
                }
                for c in pending_conflicts
            ],
            "score_bucket_diff": comparison.score_bucket_diff.value,
            "has_one_bucket_diff": has_one_bucket_diff,
            "warning": (
                "⚠️ 检测到离线和线上分数差了一个桶，请评测运营复核，不要直接归为正常"
                if has_one_bucket_diff else ""
            ),
            "next_step": "请评测运营复核冲突项（确认或驳回），然后执行步骤3更新实验对比",
            "self_check": self.self_checker.format_results(check_results),
            "history_log": self._get_recent_history(experiment_id, 5)
        }
        return output

    def review_conflict(
        self,
        experiment_id: str,
        conflict_id: str,
        confirm: bool,
        reviewer: str
    ) -> Dict:
        status = ConflictStatus.CONFIRMED if confirm else ConflictStatus.REJECTED
        conflict = self.slice_manager.review_conflict(conflict_id, status, reviewer)
        
        if not conflict:
            return {"error": f"冲突 {conflict_id} 不存在"}
        
        state = self.workflow_states.get(experiment_id)
        if state and conflict_id in state.pending_review_items:
            state.pending_review_items.remove(conflict_id)
        
        self._update_status_description(experiment_id)
        pending_conflicts = self.slice_manager.get_pending_conflicts(experiment_id)
        
        output = {
            "experiment_id": experiment_id,
            "conflict_id": conflict_id,
            "action": "确认" if confirm else "驳回",
            "reviewer": reviewer,
            "remaining_pending": len(pending_conflicts),
            "current_status": state.status_description if state else ""
        }
        return output

    def step3_update_comparison(self, experiment_id: str, operator: str = "系统") -> Dict:
        state = self.workflow_states.get(experiment_id)
        if not state:
            return {"error": f"实验 {experiment_id} 不存在"}
        
        if not state.slice_reviewed:
            return {"error": "请先执行步骤2补看评测切片"}
        
        param_yaml = self.yaml_importer.get_yaml(experiment_id)
        if not param_yaml:
            return {"error": f"实验 {experiment_id} 的参数YAML不存在"}
        
        pending_conflicts = self.slice_manager.get_pending_conflicts(experiment_id)
        if pending_conflicts:
            return {
                "warning": f"还有 {len(pending_conflicts)} 个冲突待复核，请先处理后再更新",
                "pending_conflict_ids": [c.conflict_id for c in pending_conflicts],
                "current_status": state.status_description
            }
        
        comparison = self.comparison_manager.recalculate_after_review(experiment_id)
        
        state.step = 3
        state.step_name = "实验对比更新"
        state.comparison_updated = True
        
        self._update_status_description(experiment_id)
        check_results = self.self_checker.run_all_checks(experiment_id)
        
        output = {
            "experiment_id": experiment_id,
            "experiment_name": param_yaml.experiment_name,
            "step": 3,
            "step_name": "实验对比更新",
            "current_status": state.status_description,
            "status": "完成，可以导出或归档",
            "comparison": self.comparison_manager.format_comparison(comparison) if comparison else "",
            "next_step": "可以导出或归档",
            "self_check": self.self_checker.format_results(check_results),
            "history_log": self._get_recent_history(experiment_id, 10)
        }
        return output

    def step4_export(self, experiment_id: str, operator: str = "系统") -> Dict:
        state = self.workflow_states.get(experiment_id)
        if not state:
            return {"error": f"实验 {experiment_id} 不存在"}
        
        if not state.comparison_updated:
            return {"error": "请先执行步骤3更新实验对比"}
        
        export_result = self.export_manager.export_experiment(experiment_id, operator)
        
        state.exported = True
        state.last_export_time = datetime.now()
        self._update_status_description(experiment_id)
        
        output = {
            "experiment_id": experiment_id,
            "export_success": export_result["success"],
            "export_summary": self.export_manager.format_export_summary(export_result),
            "current_status": state.status_description,
            "next_step": "可以归档",
            "history_log": self._get_recent_history(experiment_id, 5)
        }
        return output

    def step5_archive(self, experiment_id: str, operator: str = "系统") -> Dict:
        state = self.workflow_states.get(experiment_id)
        if not state:
            return {"error": f"实验 {experiment_id} 不存在"}
        
        if not state.exported:
            return {"warning": "建议先导出再归档", "current_status": state.status_description}
        
        state.archived = True
        self._update_status_description(experiment_id)
        
        self.history_tracker.add_record(
            experiment_id=experiment_id,
            action="归档",
            operator=operator,
            details="实验已归档，数据保留可追溯"
        )
        
        output = {
            "experiment_id": experiment_id,
            "archived": True,
            "current_status": "已归档",
            "history_log": self._get_recent_history(experiment_id, 5)
        }
        return output

    def get_full_status(self, experiment_id: str) -> Dict:
        state = self.workflow_states.get(experiment_id)
        if not state:
            return {"error": f"实验 {experiment_id} 不存在"}
        
        param_yaml = self.yaml_importer.get_yaml(experiment_id)
        comparison = self.comparison_manager.get_comparison(experiment_id)
        check_results = self.self_checker.run_all_checks(experiment_id)
        history = self.history_tracker.get_experiment_history(experiment_id)
        
        return {
            "experiment_id": experiment_id,
            "experiment_name": param_yaml.experiment_name if param_yaml else "",
            "current_step": state.step,
            "step_name": state.step_name,
            "status_description": state.status_description,
            "exported": state.exported,
            "archived": state.archived,
            "pending_review_count": len(state.pending_review_items),
            "yaml_import_count": self.yaml_importer.get_import_count(experiment_id),
            "slice_count": len(self.slice_manager.get_slices_for_experiment(experiment_id)),
            "self_check": self.self_checker.format_results(check_results),
            "history_log": "\n".join(
                self.history_tracker.format_record(r) for r in history
            ),
            "comparison": (
                self.comparison_manager.format_comparison(comparison)
                if comparison else "暂无对比数据"
            )
        }

    def _get_recent_history(self, experiment_id: str, limit: int = 5) -> str:
        history = self.history_tracker.get_experiment_history(experiment_id)
        recent = history[-limit:] if len(history) > limit else history
        return "\n".join(self.history_tracker.format_record(r) for r in recent)

    def get_workflow_state(self, experiment_id: str) -> Optional[WorkflowState]:
        return self.workflow_states.get(experiment_id)

    def list_workflows(self) -> List[Dict]:
        return [
            {
                "experiment_id": exp_id,
                "step": state.step,
                "step_name": state.step_name,
                "status_description": state.status_description,
                "pending_review_count": len(state.pending_review_items),
                "exported": state.exported,
                "archived": state.archived
            }
            for exp_id, state in self.workflow_states.items()
        ]
