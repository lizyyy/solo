from datetime import datetime
from typing import Dict, List, Optional
from models import (
    ParameterYAML, EvaluationSlice, ExperimentComparison,
    ScoreBucketDiff, ConflictEvidence
)


class ComparisonManager:
    def __init__(self, slice_manager, history_tracker=None):
        self.comparisons: Dict[str, ExperimentComparison] = {}
        self.slice_manager = slice_manager
        self.history_tracker = history_tracker

    def create_comparison(
        self,
        param_yaml: ParameterYAML,
        eval_slice: Optional[EvaluationSlice] = None
    ) -> ExperimentComparison:
        experiment_id = param_yaml.experiment_id
        
        yaml_metrics = param_yaml.metrics.copy()
        
        if eval_slice:
            slice_metrics = eval_slice.metrics.copy()
            score_bucket_diff = self.slice_manager.check_score_bucket_diff(
                param_yaml, eval_slice
            )
            conflicts = self.slice_manager.detect_conflicts(param_yaml, eval_slice)
        else:
            slice_metrics = {}
            score_bucket_diff = ScoreBucketDiff.NONE
            conflicts = []
        
        metric_diffs = {}
        for metric_name, yaml_val in yaml_metrics.items():
            if metric_name in slice_metrics:
                metric_diffs[metric_name] = slice_metrics[metric_name] - yaml_val
        
        comparison = ExperimentComparison(
            experiment_id=experiment_id,
            experiment_name=param_yaml.experiment_name,
            yaml_metrics=yaml_metrics,
            slice_metrics=slice_metrics,
            metric_diffs=metric_diffs,
            score_bucket_diff=score_bucket_diff,
            conflicts=conflicts,
            last_update_time=datetime.now()
        )
        
        self.comparisons[experiment_id] = comparison
        
        if self.history_tracker:
            details = f"创建实验对比：{param_yaml.experiment_name}"
            if eval_slice:
                details += "（含评测切片数据）"
            else:
                details += "（暂无评测切片）"
            self.history_tracker.add_record(
                experiment_id=experiment_id,
                action="创建实验对比",
                operator="系统",
                details=details
            )
        
        return comparison

    def update_comparison_with_slice(
        self,
        experiment_id: str,
        eval_slice: EvaluationSlice,
        param_yaml: ParameterYAML
    ) -> ExperimentComparison:
        comparison = self.comparisons.get(experiment_id)
        if not comparison:
            comparison = self.create_comparison(param_yaml, eval_slice)
            return comparison
        
        comparison.slice_metrics = eval_slice.metrics.copy()
        
        metric_diffs = {}
        for metric_name, yaml_val in comparison.yaml_metrics.items():
            if metric_name in comparison.slice_metrics:
                metric_diffs[metric_name] = comparison.slice_metrics[metric_name] - yaml_val
        comparison.metric_diffs = metric_diffs
        
        comparison.score_bucket_diff = self.slice_manager.check_score_bucket_diff(
            param_yaml, eval_slice
        )
        comparison.conflicts = self.slice_manager.detect_conflicts(param_yaml, eval_slice)
        comparison.last_update_time = datetime.now()
        
        self.comparisons[experiment_id] = comparison
        
        if self.history_tracker:
            self.history_tracker.add_record(
                experiment_id=experiment_id,
                action="更新实验对比",
                operator="系统",
                details=f"实验对比已更新，包含最新评测切片数据"
            )
        
        return comparison

    def get_comparison(self, experiment_id: str) -> Optional[ExperimentComparison]:
        return self.comparisons.get(experiment_id)

    def format_comparison(self, comparison: ExperimentComparison) -> str:
        lines = []
        lines.append(f"=== 实验对比: {comparison.experiment_name}")
        lines.append(f"实验ID: {comparison.experiment_id}")
        lines.append(f"更新时间: {comparison.last_update_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("--- 指标对比 ---")
        
        all_metrics = set(comparison.yaml_metrics.keys()) | set(comparison.slice_metrics.keys())
        for metric in sorted(all_metrics):
            yaml_val = comparison.yaml_metrics.get(metric, "-")
            slice_val = comparison.slice_metrics.get(metric, "-")
            diff = comparison.metric_diffs.get(metric, "-")
            lines.append(f"  {metric}:")
            lines.append(f"    参数YAML: {yaml_val}")
            lines.append(f"    评测切片: {slice_val}")
            lines.append(f"    差异:     {diff}")
        
        lines.append("")
        lines.append(f"分数桶差异: {comparison.score_bucket_diff.value}")
        
        if comparison.conflicts:
            lines.append("")
            lines.append("--- 冲突项 ---")
            for i, conflict in enumerate(comparison.conflicts, 1):
                lines.append(f"  {i}. [{conflict.status.value}] {conflict.description}")
                if conflict.reviewer:
                    lines.append(f"     复核人: {conflict.reviewer}, 时间: {conflict.review_time}")
        
        return "\n".join(lines)

    def recalculate_after_review(self, experiment_id: str) -> Optional[ExperimentComparison]:
        comparison = self.comparisons.get(experiment_id)
        if not comparison:
            return None
        
        comparison.last_update_time = datetime.now()
        
        if self.history_tracker:
            self.history_tracker.add_record(
                experiment_id=experiment_id,
                action="补录后重算",
                operator="系统",
                details="复核完成后重新计算实验对比数据"
            )
        
        return comparison
