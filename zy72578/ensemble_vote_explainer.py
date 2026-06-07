from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from models import (
    Material, MaterialType, ThresholdNote, OnlineExperimentBucket,
    VotingResult, WorkflowStep, ReviewStatus, SelfCheckResult, ConflictEvidence
)
from errors import (
    MinorityMaskedError, ThresholdConflictError, WorkflowStepError, FriendlyError
)


class ThresholdPlaybackValidator:
    def __init__(self):
        self._threshold_history: Dict[str, List[Tuple[float, Optional[float], str]]] = defaultdict(list)

    def record_threshold(self, model_name: str, threshold: float, 
                         minority_threshold: Optional[float], source: str):
        self._threshold_history[model_name].append((threshold, minority_threshold, source))

    def validate_playback(self, model_name: str, expected_threshold: float,
                          expected_minority: Optional[float] = None) -> Tuple[bool, str]:
        if model_name not in self._threshold_history:
            return False, f"模型【{model_name}】没有历史阈值记录"
        
        history = self._threshold_history[model_name]
        last_threshold, last_minority, last_source = history[-1]
        
        threshold_match = abs(last_threshold - expected_threshold) < 1e-6
        minority_match = True
        if expected_minority is not None and last_minority is not None:
            minority_match = abs(last_minority - expected_minority) < 1e-6
        
        if threshold_match and minority_match:
            return True, f"阈值回放匹配，历史记录来自【{last_source}】"
        else:
            return False, (f"阈值回放不匹配：历史记录阈值={last_threshold}, "
                          f"当前期望阈值={expected_threshold}")

    def get_history(self, model_name: str) -> List[Tuple[float, Optional[float], str]]:
        return list(self._threshold_history.get(model_name, []))


class ConflictDetector:
    def detect_conflicts(self, material: Material) -> List[ConflictEvidence]:
        conflicts = []
        
        note_thresholds = {tn.model_name: tn.threshold for tn in material.threshold_notes}
        bucket_thresholds = {eb.model_name: eb.threshold for eb in material.experiment_buckets}
        
        all_models = set(note_thresholds.keys()) | set(bucket_thresholds.keys())
        
        for model_name in all_models:
            if model_name in note_thresholds and model_name in bucket_thresholds:
                note_val = note_thresholds[model_name]
                bucket_val = bucket_thresholds[model_name]
                
                if abs(note_val - bucket_val) > 1e-6:
                    note = next(tn for tn in material.threshold_notes if tn.model_name == model_name)
                    bucket = next(eb for eb in material.experiment_buckets if eb.model_name == model_name)
                    
                    conflicts.append(ConflictEvidence(
                        model_name=model_name,
                        threshold_note_value=note_val,
                        experiment_bucket_value=bucket_val,
                        threshold_note_id=note.note_id,
                        experiment_bucket_id=bucket.bucket_id,
                        description=f"阈值调参笔记【{note.note_id}】阈值={note_val}，"
                                   f"线上实验桶【{bucket.bucket_id}】阈值={bucket_val}"
                    ))
        
        return conflicts


class SelfChecker:
    def __init__(self):
        self._export_snapshots: List[Dict] = []

    def run_all_checks(self, material: Material, 
                       all_materials: List[Material]) -> List[SelfCheckResult]:
        results = []
        results.append(self._check_duplicate_import(material, all_materials))
        results.append(self._check_minority_masked(material))
        results.append(self._check_supplement_recalc(material, all_materials))
        results.append(self._check_export_consistency())
        return results

    def _check_duplicate_import(self, material: Material, 
                                all_materials: List[Material]) -> SelfCheckResult:
        count = sum(1 for m in all_materials if m.material_id == material.material_id)
        if count > 1 and material.material_type != MaterialType.SUPPLEMENT:
            return SelfCheckResult(
                check_name="重复导入检查",
                passed=False,
                message=f"材料【{material.material_id}】被导入了{count}次，且不是补录类型",
                details={"import_count": count, "material_id": material.material_id}
            )
        return SelfCheckResult(
            check_name="重复导入检查",
            passed=True,
            message="无重复导入问题",
            details={"import_count": count}
        )

    def _check_minority_masked(self, material: Material) -> SelfCheckResult:
        masked_models = []
        for bucket in material.experiment_buckets:
            if bucket.minority_sample_count > 0:
                minority_ratio = bucket.minority_sample_count / bucket.sample_count
                if minority_ratio < 0.1 and bucket.overall_metric - bucket.minority_metric > 0.2:
                    masked_models.append({
                        "model_name": bucket.model_name,
                        "overall_metric": bucket.overall_metric,
                        "minority_metric": bucket.minority_metric,
                        "minority_ratio": minority_ratio
                    })
        
        if masked_models:
            return SelfCheckResult(
                check_name="少数类样本被总指标盖住检查",
                passed=False,
                message=f"发现{len(masked_models)}个模型存在少数类样本被总指标盖住的问题",
                details={"masked_models": masked_models}
            )
        return SelfCheckResult(
            check_name="少数类样本被总指标盖住检查",
            passed=True,
            message="无少数类样本被掩盖问题",
            details={}
        )

    def _check_supplement_recalc(self, material: Material, 
                                 all_materials: List[Material]) -> SelfCheckResult:
        if material.material_type == MaterialType.SUPPLEMENT:
            prev_materials = [m for m in all_materials 
                            if m.model_name == material.model_name 
                            and m.material_id == material.material_id
                            and m is not material]
            
            if not prev_materials:
                return SelfCheckResult(
                    check_name="补录后重算检查",
                    passed=False,
                    message=f"补录材料【{material.material_id}】找不到之前的导入记录",
                    details={"material_id": material.material_id}
                )
            
            if not material.threshold_notes and not material.experiment_buckets:
                return SelfCheckResult(
                    check_name="补录后重算检查",
                    passed=False,
                    message=f"补录材料【{material.material_id}】没有数据，无法重算",
                    details={}
                )
            
            return SelfCheckResult(
                check_name="补录后重算检查",
                passed=True,
                message=f"补录材料【{material.material_id}】已准备好重算",
                details={"prev_count": len(prev_materials)}
            )
        
        return SelfCheckResult(
            check_name="补录后重算检查",
            passed=True,
            message="非补录材料，跳过此项检查",
            details={}
        )

    def _check_export_consistency(self) -> SelfCheckResult:
        if len(self._export_snapshots) < 2:
            return SelfCheckResult(
                check_name="导出一致性检查",
                passed=True,
                message="导出记录不足，暂无法检查一致性",
                details={"export_count": len(self._export_snapshots)}
            )
        
        first = self._export_snapshots[0]
        last = self._export_snapshots[-1]
        
        if first.get("model_name") == last.get("model_name"):
            threshold_match = abs(first.get("threshold", 0) - last.get("threshold", 0)) < 1e-6
            if threshold_match:
                return SelfCheckResult(
                    check_name="导出一致性检查",
                    passed=True,
                    message="多次导出结果一致",
                    details={"export_count": len(self._export_snapshots)}
                )
        
        return SelfCheckResult(
            check_name="导出一致性检查",
            passed=False,
            message="多次导出结果不一致，请检查数据是否被修改",
            details={
                "first_export": first,
                "last_export": last
            }
        )

    def record_export(self, snapshot: Dict):
        self._export_snapshots.append(snapshot)


class EnsembleVoteExplainer:
    def __init__(self):
        self.playback_validator = ThresholdPlaybackValidator()
        self.conflict_detector = ConflictDetector()
        self.self_checker = SelfChecker()
        self._voting_results: Dict[str, VotingResult] = {}
        self._all_materials: List[Material] = []

    def process_material(self, material: Material) -> VotingResult:
        self._all_materials.append(material)
        
        conflicts = self.conflict_detector.detect_conflicts(material)
        self_check_results = self.self_checker.run_all_checks(material, self._all_materials)
        
        is_minority_masked = any(
            not r.passed and r.check_name == "少数类样本被总指标盖住检查"
            for r in self_check_results
        )
        
        avg_threshold = self._calculate_avg_threshold(material)
        avg_minority = self._calculate_avg_minority_threshold(material)
        confidence = self._calculate_confidence(material, conflicts)
        
        review_status = ReviewStatus.PENDING
        if is_minority_masked:
            review_status = ReviewStatus.NEED_ALGORITHM_REVIEW
        elif conflicts:
            review_status = ReviewStatus.PENDING
        
        result = VotingResult(
            model_name=material.model_name,
            final_threshold=avg_threshold,
            final_minority_threshold=avg_minority,
            confidence=confidence,
            is_minority_masked=is_minority_masked,
            review_status=review_status,
            conflict_evidences=conflicts,
            self_check_results=self_check_results,
            workflow_step=WorkflowStep.STEP1_THRESHOLD_IMPORT
        )
        
        if material.threshold_notes:
            self.playback_validator.record_threshold(
                material.model_name, avg_threshold, avg_minority,
                f"材料导入-{material.material_type.value}"
            )
        
        self._voting_results[material.model_name] = result
        return result

    def _calculate_avg_threshold(self, material: Material) -> float:
        all_thresholds = []
        for note in material.threshold_notes:
            all_thresholds.append(note.threshold)
        for bucket in material.experiment_buckets:
            all_thresholds.append(bucket.threshold)
        
        if not all_thresholds:
            return 0.0
        return sum(all_thresholds) / len(all_thresholds)

    def _calculate_avg_minority_threshold(self, material: Material) -> Optional[float]:
        all_minority = []
        for note in material.threshold_notes:
            if note.minority_threshold is not None:
                all_minority.append(note.minority_threshold)
        for bucket in material.experiment_buckets:
            if bucket.minority_threshold is not None:
                all_minority.append(bucket.minority_threshold)
        
        if not all_minority:
            return None
        return sum(all_minority) / len(all_minority)

    def _calculate_confidence(self, material: Material, 
                              conflicts: List[ConflictEvidence]) -> float:
        base_confidence = 0.8
        conflict_penalty = len(conflicts) * 0.1
        sample_count = sum(b.sample_count for b in material.experiment_buckets)
        
        if sample_count < 100:
            sample_penalty = 0.2
        elif sample_count < 1000:
            sample_penalty = 0.1
        else:
            sample_penalty = 0.0
        
        return max(0.0, min(1.0, base_confidence - conflict_penalty - sample_penalty))

    def tang_review_buckets(self, model_name: str, 
                            confirm_conflicts: List[str] = None,
                            reject_conflicts: List[str] = None) -> VotingResult:
        result = self._voting_results.get(model_name)
        if not result:
            raise FriendlyError(
                message=f"找不到模型【{model_name}】的投票结果",
                suggestion="请先导入材料并完成第一步阈值调参笔记导入。"
            )
        
        if result.workflow_step != WorkflowStep.STEP1_THRESHOLD_IMPORT:
            raise WorkflowStepError(
                current_step=result.workflow_step.value,
                expected_step=WorkflowStep.STEP2_TANG_REVIEW.value
            )
        
        confirm_conflicts = confirm_conflicts or []
        reject_conflicts = reject_conflicts or []
        
        remaining_conflicts = []
        for conflict in result.conflict_evidences:
            if conflict.threshold_note_id in reject_conflicts:
                result.final_threshold = conflict.experiment_bucket_value
            elif conflict.threshold_note_id not in confirm_conflicts:
                remaining_conflicts.append(conflict)
        
        result.conflict_evidences = remaining_conflicts
        
        if not remaining_conflicts:
            result.workflow_step = WorkflowStep.STEP2_TANG_REVIEW
            result.review_status = ReviewStatus.CONFIRMED
        else:
            result.review_status = ReviewStatus.PENDING
        
        self.playback_validator.record_threshold(
            model_name, result.final_threshold, result.final_minority_threshold,
            "老唐审核线上实验桶"
        )
        
        return result

    def update_threshold_playback(self, model_name: str,
                                  new_threshold: float,
                                  new_minority_threshold: Optional[float] = None) -> VotingResult:
        result = self._voting_results.get(model_name)
        if not result:
            raise FriendlyError(
                message=f"找不到模型【{model_name}】的投票结果",
                suggestion="请先完成前两步：导入材料和老唐审核。"
            )
        
        if result.workflow_step != WorkflowStep.STEP2_TANG_REVIEW:
            raise WorkflowStepError(
                current_step=result.workflow_step.value,
                expected_step=WorkflowStep.STEP3_THRESHOLD_UPDATE.value
            )
        
        is_match, message = self.playback_validator.validate_playback(
            model_name, result.final_threshold, result.final_minority_threshold
        )
        
        result.final_threshold = new_threshold
        result.final_minority_threshold = new_minority_threshold
        result.workflow_step = WorkflowStep.COMPLETED
        
        self.playback_validator.record_threshold(
            model_name, new_threshold, new_minority_threshold,
            "阈值回放更新"
        )
        
        self.self_checker.record_export({
            "model_name": model_name,
            "threshold": new_threshold,
            "minority_threshold": new_minority_threshold
        })
        
        return result

    def get_voting_result(self, model_name: str) -> Optional[VotingResult]:
        return self._voting_results.get(model_name)

    def get_all_results(self) -> List[VotingResult]:
        return list(self._voting_results.values())
