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
        self.workflow_states: Dict[str, WorkflowState] = {}

    def step1_import_yaml(self, yaml_content: str, operator: str = "系统") -> Dict:
        param_yaml, is_duplicate = self.yaml_importer.import_yaml(
            yaml_content, operator
        )
        experiment_id = param_yaml.experiment_id
        
        self.comparison_manager.create_comparison(param_yaml)
        
        state = WorkflowState(
            experiment_id=experiment_id,
            step=1,
            step_name="参数YAML第一次导入",
            parameters_imported=True,
            slice_reviewed=False,
            comparison_updated=False,
            pending_review_items=[]
        )
        self.workflow_states[experiment_id] = state
        
        check_results = self.self_checker.run_all_checks(experiment_id)
        
        output = {
            "experiment_id": experiment_id,
            "experiment_name": param_yaml.experiment_name,
            "step": 1,
            "step_name": "参数YAML第一次导入",
            "is_duplicate": is_duplicate,
            "next_step": "等待评测运营小孟补看评测切片",
            "self_check": self.self_checker.format_results(check_results)
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
        
        check_results = self.self_checker.run_all_checks(experiment_id)
        
        output = {
            "experiment_id": experiment_id,
            "experiment_name": param_yaml.experiment_name,
            "step": 2,
            "step_name": "评测运营小孟补看评测切片",
            "conflict_count": len(pending_conflicts),
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
            "warning": "检测到离线和线上分数差了一个桶，请评测运营复核，不要直接归为正常" if has_one_bucket_diff else "",
            "next_step": "请评测运营复核冲突项（确认或驳回），然后执行步骤3更新实验对比",
            "self_check": self.self_checker.format_results(check_results)
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
        
        pending_conflicts = self.slice_manager.get_pending_conflicts(experiment_id)
        
        output = {
            "experiment_id": experiment_id,
            "conflict_id": conflict_id,
            "action": "确认" if confirm else "驳回",
            "reviewer": reviewer,
            "remaining_pending": len(pending_conflicts)
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
                "warning": f"还有 {len(pending_conflicts)} 个冲突待复核，请先处理",
                "pending_conflicts": [c.conflict_id for c in pending_conflicts]
            }
        
        comparison = self.comparison_manager.recalculate_after_review(experiment_id)
        
        state.step = 3
        state.step_name = "实验对比更新"
        state.comparison_updated = True
        
        check_results = self.self_checker.run_all_checks(experiment_id)
        
        history = self.history_tracker.get_experiment_history(experiment_id)
        history_log = "\n".join(
            self.history_tracker.format_record(r) for r in history
        )
        
        output = {
            "experiment_id": experiment_id,
            "experiment_name": param_yaml.experiment_name,
            "step": 3,
            "step_name": "实验对比更新",
            "status": "完成",
            "comparison": self.comparison_manager.format_comparison(comparison) if comparison else "",
            "history_log": history_log,
            "self_check": self.self_checker.format_results(check_results),
            "next_step": "可以导出或归档"
        }
        return output

    def get_workflow_state(self, experiment_id: str) -> Optional[WorkflowState]:
        return self.workflow_states.get(experiment_id)

    def list_workflows(self) -> List[Dict]:
        return [
            {
                "experiment_id": exp_id,
                "step": state.step,
                "step_name": state.step_name,
                "pending_review_count": len(state.pending_review_items)
            }
            for exp_id, state in self.workflow_states.items()
        ]
