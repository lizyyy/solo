import pandas as pd
import yaml
import os
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from .data_models import WorkflowStep, CheckResult, ConflictEvidence, NegSampleDataset, RunHistory
from .checks import (
    check_duplicates,
    check_minority_class_masking,
    check_export_consistency,
    check_conflict_between_neg_and_recall
)


class WorkflowEngine:
    def __init__(self, config_path: str):
        self.config = self._load_config(config_path)
        self.steps: Dict[str, WorkflowStep] = {}
        self.neg_dataset: Optional[NegSampleDataset] = None
        self.recall_dataset: Optional[NegSampleDataset] = None
        self.history: List[RunHistory] = []
        self.current_threshold: float = self.config.get('threshold', {}).get('default', 0.5)
        self._init_steps()

    def _load_config(self, config_path: str) -> Dict:
        with open(config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    def _init_steps(self) -> None:
        workflow_config = self.config.get('workflow', {})
        for step_cfg in workflow_config.get('steps', []):
            step = WorkflowStep(
                step_id=step_cfg['id'],
                step_name=step_cfg['name']
            )
            self.steps[step.step_id] = step

    def run_step1_import(self, neg_sample_path: str) -> WorkflowStep:
        step = self.steps['step1_import']
        step.status = 'running'
        step.started_at = datetime.now()

        try:
            self.neg_dataset = NegSampleDataset('负样本列表')
            self.neg_dataset.load_from_csv(neg_sample_path)
            step.data_version = self.neg_dataset.version

            key_fields = self.config.get('checks', {}).get('duplicate_detection', {}).get('key_fields', ['user_id', 'item_id', 'timestamp'])
            dup_result = check_duplicates(self.neg_dataset.df, key_fields)
            step.results.append(dup_result)

            minority_cfg = self.config.get('checks', {}).get('minority_class_detection', {})
            minority_result = check_minority_class_masking(
                self.neg_dataset.df,
                minority_threshold=minority_cfg.get('minority_threshold', 0.05),
                metric_fields=minority_cfg.get('metric_fields', ['click_rate', 'conversion_rate'])
            )
            step.results.append(minority_result)

            step.status = 'completed'
            step.completed_at = datetime.now()
            self._save_history('step1', neg_sample_path)

        except Exception as e:
            step.status = 'failed'
            step.completed_at = datetime.now()
            step.results.append(CheckResult(
                check_name="导入异常",
                passed=False,
                details={"error": str(e)},
                severity="error",
                suggestion="请检查文件路径和格式"
            ))

        return step

    def run_step2_compare(self, recall_candidate_path: str) -> WorkflowStep:
        step = self.steps['step2_compare']
        step.status = 'running'
        step.started_at = datetime.now()

        try:
            if not self.neg_dataset or self.neg_dataset.df.empty:
                raise ValueError("请先执行步骤1：负样本列表导入")

            self.recall_dataset = NegSampleDataset('召回候选表')
            self.recall_dataset.load_from_csv(recall_candidate_path)
            step.data_version = self.recall_dataset.version

            conflicts = check_conflict_between_neg_and_recall(
                self.neg_dataset.df,
                self.recall_dataset.df
            )
            step.conflicts = conflicts

            if conflicts:
                step.results.append(CheckResult(
                    check_name="负样本与召回候选表一致性检查",
                    passed=False,
                    details={
                        "conflict_count": len(conflicts),
                        "sample_conflicts": [
                            {"id": c.conflict_id, "description": c.description}
                            for c in conflicts[:5]
                        ]
                    },
                    severity="warning",
                    suggestion="检测到标签冲突，请数据科学家林姐确认或驳回，不要自动拍板"
                ))
            else:
                step.results.append(CheckResult(
                    check_name="负样本与召回候选表一致性检查",
                    passed=True,
                    details={"message": "未检测到标签冲突"},
                    severity="info"
                ))

            step.status = 'completed'
            step.completed_at = datetime.now()
            self._save_history('step2', recall_candidate_path)

        except Exception as e:
            step.status = 'failed'
            step.completed_at = datetime.now()
            step.results.append(CheckResult(
                check_name="对比异常",
                passed=False,
                details={"error": str(e)},
                severity="error",
                suggestion="请检查召回候选表文件"
            ))

        return step

    def run_step3_playback(self, new_threshold: Optional[float] = None) -> WorkflowStep:
        step = self.steps['step3_playback']
        step.status = 'running'
        step.started_at = datetime.now()

        try:
            if not self.neg_dataset or self.neg_dataset.df.empty:
                raise ValueError("请先执行步骤1：负样本列表导入")

            old_threshold = self.current_threshold
            if new_threshold is not None:
                self.current_threshold = new_threshold

            metrics = self._calculate_metrics(self.current_threshold)
            history_metrics = []
            for hist in self.history:
                history_metrics.append({
                    "timestamp": hist.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "threshold": hist.threshold,
                    "metrics": hist.metrics
                })

            minority_samples = self.neg_dataset.get_minority_samples(
                minority_threshold=self.config.get('checks', {}).get('minority_class_detection', {}).get('minority_threshold', 0.05)
            )

            threshold_match = self._check_threshold_history_match(metrics, history_metrics)

            step.results.append(CheckResult(
                check_name="阈值回放检查",
                passed=threshold_match,
                details={
                    "old_threshold": old_threshold,
                    "new_threshold": self.current_threshold,
                    "current_metrics": metrics,
                    "history_count": len(history_metrics),
                    "history_metrics": history_metrics[-5:],
                    "minority_sample_count": len(minority_samples),
                    "minority_samples": minority_samples.head(10).to_dict('records') if not minority_samples.empty else []
                },
                severity="info" if threshold_match else "warning",
                suggestion="" if threshold_match else "历史记录与当前计算结果存在差异，请复核"
            ))

            if not minority_samples.empty:
                step.results.append(CheckResult(
                    check_name="少数类样本复核提醒",
                    passed=False,
                    details={
                        "count": len(minority_samples),
                        "samples": minority_samples.head(5).to_dict('records')
                    },
                    severity="warning",
                    suggestion="少数类样本请勿直接归为正常，留给算法工程师复核"
                ))

            step.status = 'completed'
            step.completed_at = datetime.now()
            self._save_history('step3', f"threshold_{self.current_threshold}")

        except Exception as e:
            step.status = 'failed'
            step.completed_at = datetime.now()
            step.results.append(CheckResult(
                check_name="阈值回放异常",
                passed=False,
                details={"error": str(e)},
                severity="error",
                suggestion="请检查阈值参数"
            ))

        return step

    def apply_supplement(self, supplement_path: str) -> Tuple[bool, int]:
        if not self.neg_dataset:
            return False, 0

        try:
            supplement_df = pd.read_csv(supplement_path)
            added_count = self.neg_dataset.append_supplement(supplement_df)

            if self.steps['step1_import'].status == 'completed':
                key_fields = self.config.get('checks', {}).get('duplicate_detection', {}).get('key_fields', ['user_id', 'item_id', 'timestamp'])
                dup_result = check_duplicates(self.neg_dataset.df, key_fields)

                minority_cfg = self.config.get('checks', {}).get('minority_class_detection', {})
                minority_result = check_minority_class_masking(
                    self.neg_dataset.df,
                    minority_threshold=minority_cfg.get('minority_threshold', 0.05),
                    metric_fields=minority_cfg.get('metric_fields', ['click_rate', 'conversion_rate'])
                )

                self.steps['step1_import'].results.extend([dup_result, minority_result])
                self.steps['step1_import'].data_version = self.neg_dataset.version

            self._save_history('supplement', supplement_path)
            return True, added_count

        except Exception as e:
            return False, 0

    def resolve_conflict(self, conflict_id: str, resolution: str) -> bool:
        for step in self.steps.values():
            for conflict in step.conflicts:
                if conflict.conflict_id == conflict_id:
                    conflict.resolution = resolution
                    return True
        return False

    def _calculate_metrics(self, threshold: float) -> Dict:
        if not self.neg_dataset or self.neg_dataset.df.empty:
            return {}
        df = self.neg_dataset.df
        if 'score' in df.columns:
            predicted = (df['score'] >= threshold).astype(int)
            if 'label' in df.columns:
                tp = ((predicted == 1) & (df['label'] == 1)).sum()
                fp = ((predicted == 1) & (df['label'] == 0)).sum()
                fn = ((predicted == 0) & (df['label'] == 1)).sum()
                precision = tp / (tp + fp) if (tp + fp) > 0 else 0
                recall = tp / (tp + fn) if (tp + fn) > 0 else 0
                return {
                    "threshold": threshold,
                    "precision": float(precision),
                    "recall": float(recall),
                    "positive_count": int(predicted.sum()),
                    "negative_count": int((predicted == 0).sum())
                }
        return {"threshold": threshold, "row_count": len(df)}

    def _check_threshold_history_match(self, current_metrics: Dict, history_metrics: List[Dict]) -> bool:
        for hm in history_metrics:
            if abs(hm.get('threshold', 0) - self.current_threshold) < 1e-6:
                hist_precision = hm.get('metrics', {}).get('precision', -1)
                curr_precision = current_metrics.get('precision', -2)
                return abs(hist_precision - curr_precision) < 0.01
        return True

    def _save_history(self, source: str, data_path: str) -> None:
        metrics = self._calculate_metrics(self.current_threshold)
        step_results = {sid: s.status == 'completed' for sid, s in self.steps.items()}
        minority_samples = []
        if self.neg_dataset:
            ms = self.neg_dataset.get_minority_samples()
            minority_samples = ms.head(10).to_dict('records') if not ms.empty else []

        self.history.append(RunHistory(
            run_id=f"run_{len(self.history) + 1}",
            timestamp=datetime.now(),
            data_source=data_path,
            threshold=self.current_threshold,
            metrics=metrics,
            step_results=step_results,
            minority_samples=minority_samples
        ))

    def run_all_checks(self, neg_sample_path: str, recall_candidate_path: str, threshold: float = None) -> Dict:
        self.run_step1_import(neg_sample_path)
        self.run_step2_compare(recall_candidate_path)
        self.run_step3_playback(threshold)

        return self.get_summary()

    def get_summary(self) -> Dict:
        return {
            "project": self.config.get('project', {}).get('name', ''),
            "version": self.config.get('project', {}).get('version', ''),
            "current_threshold": self.current_threshold,
            "steps": {
                sid: {
                    "name": s.step_name,
                    "status": s.status,
                    "passed_count": sum(1 for r in s.results if r.passed),
                    "warning_count": sum(1 for r in s.results if r.severity == 'warning'),
                    "error_count": sum(1 for r in s.results if r.severity == 'error'),
                    "conflict_count": len(s.conflicts),
                    "pending_conflicts": sum(1 for c in s.conflicts if c.resolution == 'pending')
                }
                for sid, s in self.steps.items()
            },
            "history_count": len(self.history)
        }
