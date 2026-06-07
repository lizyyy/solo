from datetime import datetime
from typing import List, Dict, Any, Optional
from models import (
    EvaluationSlice, ConflictEvidence, ConflictStatus,
    ParameterYAML, ScoreBucketDiff
)
import uuid


class SliceManager:
    def __init__(self, history_tracker=None):
        self.slices: Dict[str, EvaluationSlice] = {}
        self.conflicts: Dict[str, List[ConflictEvidence]] = {}
        self.history_tracker = history_tracker

    def add_slice(
        self,
        experiment_id: str,
        metrics: Dict[str, float],
        score_distribution: Dict[str, int],
        uploader: str,
        notes: str = "",
        source: str = "补录"
    ) -> EvaluationSlice:
        slice_id = str(uuid.uuid4())
        eval_slice = EvaluationSlice(
            slice_id=slice_id,
            experiment_id=experiment_id,
            upload_time=datetime.now(),
            uploader=uploader,
            metrics=metrics,
            score_distribution=score_distribution,
            notes=notes,
            source=source
        )
        self.slices[slice_id] = eval_slice
        
        if self.history_tracker:
            self.history_tracker.add_record(
                experiment_id=experiment_id,
                action="评测切片补录",
                operator=uploader,
                details=f"补录评测切片，来源: {source}, 备注: {notes}"
            )
        
        return eval_slice

    def get_slices_for_experiment(self, experiment_id: str) -> List[EvaluationSlice]:
        return [s for s in self.slices.values() if s.experiment_id == experiment_id]

    def detect_conflicts(
        self,
        param_yaml: ParameterYAML,
        eval_slice: EvaluationSlice
    ) -> List[ConflictEvidence]:
        conflicts = []
        
        for metric_name, yaml_value in param_yaml.metrics.items():
            if metric_name in eval_slice.metrics:
                slice_value = eval_slice.metrics[metric_name]
                diff = abs(yaml_value - slice_value)
                relative_diff = diff / max(abs(yaml_value), 1e-9)
                
                if relative_diff > 0.05:
                    conflict = ConflictEvidence(
                        conflict_id=str(uuid.uuid4()),
                        experiment_id=param_yaml.experiment_id,
                        field_name=f"metrics.{metric_name}",
                        yaml_value=yaml_value,
                        slice_value=slice_value,
                        description=f"指标 {metric_name} 差异较大，YAML值: {yaml_value}, 评测切片值: {slice_value}, 相对差异: {relative_diff:.2%}",
                        detected_time=datetime.now()
                    )
                    conflicts.append(conflict)
        
        if param_yaml.conclusion and eval_slice.notes:
            conclusion_keywords = self._extract_keywords(param_yaml.conclusion)
            slice_keywords = self._extract_keywords(eval_slice.notes)
            
            if conclusion_keywords and slice_keywords:
                overlap = conclusion_keywords & slice_keywords
                if not overlap:
                    conflict = ConflictEvidence(
                        conflict_id=str(uuid.uuid4()),
                        experiment_id=param_yaml.experiment_id,
                        field_name="conclusion",
                        yaml_value=param_yaml.conclusion,
                        slice_value=eval_slice.notes,
                        description="结论描述与评测切片备注无重叠关键词，可能存在口径不一致",
                        detected_time=datetime.now()
                    )
                    conflicts.append(conflict)
        
        if param_yaml.experiment_id not in self.conflicts:
            self.conflicts[param_yaml.experiment_id] = []
        self.conflicts[param_yaml.experiment_id].extend(conflicts)
        
        return conflicts

    def _extract_keywords(self, text: str) -> set:
        if not text:
            return set()
        keywords = set()
        for keyword in ["提升", "下降", "持平", "显著", "不显著", "正向", "负向", "达标", "未达标"]:
            if keyword in text:
                keywords.add(keyword)
        return keywords

    def check_score_bucket_diff(
        self,
        param_yaml: ParameterYAML,
        eval_slice: EvaluationSlice
    ) -> ScoreBucketDiff:
        yaml_bucket = param_yaml.metrics.get("score_bucket")
        slice_bucket = eval_slice.metrics.get("score_bucket")
        
        if yaml_bucket is None or slice_bucket is None:
            return ScoreBucketDiff.NONE
        
        diff = abs(yaml_bucket - slice_bucket)
        if diff == 0:
            return ScoreBucketDiff.NONE
        elif diff == 1:
            return ScoreBucketDiff.ONE_BUCKET
        else:
            return ScoreBucketDiff.MORE_THAN_ONE

    def get_conflicts(self, experiment_id: str) -> List[ConflictEvidence]:
        return self.conflicts.get(experiment_id, [])

    def review_conflict(
        self,
        conflict_id: str,
        status: ConflictStatus,
        reviewer: str
    ) -> Optional[ConflictEvidence]:
        for exp_id, conf_list in self.conflicts.items():
            for i, conf in enumerate(conf_list):
                if conf.conflict_id == conflict_id:
                    conf.status = status
                    conf.reviewer = reviewer
                    conf.review_time = datetime.now()
                    
                    if self.history_tracker:
                        status_text = "确认" if status == ConflictStatus.CONFIRMED else "驳回"
                        self.history_tracker.add_record(
                            experiment_id=exp_id,
                            action=f"冲突{status_text}",
                            operator=reviewer,
                            details=f"冲突 {conflict_id}: {conf.description} 已{status_text}"
                        )
                    
                    return conf
        return None

    def get_pending_conflicts(self, experiment_id: str) -> List[ConflictEvidence]:
        return [
            c for c in self.conflicts.get(experiment_id, [])
            if c.status == ConflictStatus.PENDING
        ]
