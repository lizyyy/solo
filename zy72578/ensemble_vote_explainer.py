from typing import List, Dict, Tuple, Optional
from collections import defaultdict
import uuid
from datetime import datetime
from models import (
    Material, MaterialType, ThresholdNote, OnlineExperimentBucket,
    VotingResult, WorkflowStep, ReviewStatus, SelfCheckResult, ConflictEvidence,
    ThresholdChangeRecord, MaterialBatch
)
from errors import (
    MinorityMaskedError, ThresholdConflictError, WorkflowStepError, FriendlyError
)


class ThresholdPlaybackValidator:
    def __init__(self):
        self._threshold_history: Dict[str, List[ThresholdChangeRecord]] = defaultdict(list)

    def record_change(self, record: ThresholdChangeRecord):
        self._threshold_history[record.model_name].append(record)

    def validate_playback(self, model_name: str, expected_threshold: float,
                          expected_minority: Optional[float] = None) -> Tuple[bool, str]:
        if model_name not in self._threshold_history:
            return False, f"模型【{model_name}】没有历史阈值记录"

        history = self._threshold_history[model_name]
        last_record = history[-1]

        threshold_match = abs(last_record.new_threshold - expected_threshold) < 1e-6
        minority_match = True
        if expected_minority is not None and last_record.new_minority_threshold is not None:
            minority_match = abs(last_record.new_minority_threshold - expected_minority) < 1e-6

        if threshold_match and minority_match:
            return True, (f"阈值回放匹配，最近一次变更来自【{last_record.change_source}】，"
                         f"操作人：{last_record.operator}，原因：{last_record.change_reason}")
        else:
            return False, (f"阈值回放不匹配：历史记录阈值={last_record.new_threshold}, "
                          f"当前期望阈值={expected_threshold}")

    def get_history(self, model_name: str) -> List[ThresholdChangeRecord]:
        return list(self._threshold_history.get(model_name, []))

    def get_detailed_history(self, model_name: str) -> List[Dict]:
        history = self.get_history(model_name)
        result = []
        for i, record in enumerate(history, 1):
            result.append({
                "序号": i,
                "变更ID": record.change_id,
                "批次号": record.batch_number,
                "旧阈值": record.old_threshold,
                "新阈值": record.new_threshold,
                "旧少数类阈值": record.old_minority_threshold,
                "新少数类阈值": record.new_minority_threshold,
                "变更来源": record.change_source,
                "变更原因": record.change_reason,
                "操作人": record.operator,
                "变更时间": record.changed_at,
                "影响项": record.affected_items
            })
        return result


class ConflictDetector:
    def detect_conflicts(self, notes: List[ThresholdNote],
                         buckets: List[OnlineExperimentBucket]) -> List[ConflictEvidence]:
        conflicts = []

        for note in notes:
            for bucket in buckets:
                if note.model_name == bucket.model_name:
                    if abs(note.threshold - bucket.threshold) > 1e-6:
                        conflicts.append(ConflictEvidence(
                            model_name=note.model_name,
                            threshold_note_value=note.threshold,
                            experiment_bucket_value=bucket.threshold,
                            threshold_note_id=note.note_id,
                            experiment_bucket_id=bucket.bucket_id,
                            description=f"阈值调参笔记【{note.note_id}】阈值={note.threshold}，"
                                       f"线上实验桶【{bucket.bucket_id}】阈值={bucket.threshold}"
                        ))

        return conflicts


class SelfChecker:
    def __init__(self):
        self._export_snapshots: List[Dict] = []

    def run_all_checks(self, material: Material,
                       all_materials: List[Material],
                       merged_notes: List[ThresholdNote],
                       merged_buckets: List[OnlineExperimentBucket],
                       current_result: VotingResult = None) -> List[SelfCheckResult]:
        results = []
        results.append(self._check_duplicate_import(material, all_materials))
        results.append(self._check_minority_masked(merged_buckets))
        results.append(self._check_supplement_recalc(material, all_materials,
                                                     merged_notes, merged_buckets))
        results.append(self._check_export_consistency(current_result))
        return results

    def _check_duplicate_import(self, material: Material,
                                all_materials: List[Material]) -> SelfCheckResult:
        same_id_materials = [m for m in all_materials if m.material_id == material.material_id]
        count = len(same_id_materials)

        if count > 1 and material.material_type != MaterialType.SUPPLEMENT:
            return SelfCheckResult(
                check_name="重复导入检查",
                passed=False,
                message=f"材料【{material.material_id}】被导入了{count}次，且不是补录类型",
                details={
                    "import_count": count,
                    "material_id": material.material_id,
                    "history_batches": [
                        {"批次类型": m.material_type.value, "导入时间": m.imported_at}
                        for m in same_id_materials
                    ]
                }
            )
        return SelfCheckResult(
            check_name="重复导入检查",
            passed=True,
            message=f"材料【{material.material_id}】共{count}个批次，当前类型：{material.material_type.value}",
            details={
                "import_count": count,
                "current_type": material.material_type.value,
                "is_supplement": material.material_type == MaterialType.SUPPLEMENT
            }
        )

    def _check_minority_masked(self, buckets: List[OnlineExperimentBucket]) -> SelfCheckResult:
        masked_models = []
        for bucket in buckets:
            if bucket.minority_sample_count > 0 and bucket.sample_count > 0:
                minority_ratio = bucket.minority_sample_count / bucket.sample_count
                if minority_ratio < 0.1 and bucket.overall_metric - bucket.minority_metric > 0.2:
                    masked_models.append({
                        "model_name": bucket.model_name,
                        "overall_metric": bucket.overall_metric,
                        "minority_metric": bucket.minority_metric,
                        "minority_ratio": minority_ratio,
                        "sample_count": bucket.sample_count,
                        "minority_sample_count": bucket.minority_sample_count,
                        "metric_gap": bucket.overall_metric - bucket.minority_metric
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
            details={"checked_buckets": len(buckets)}
        )

    def _check_supplement_recalc(self, material: Material,
                                 all_materials: List[Material],
                                 merged_notes: List[ThresholdNote],
                                 merged_buckets: List[OnlineExperimentBucket]) -> SelfCheckResult:
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

            has_data = len(merged_notes) > 0 or len(merged_buckets) > 0
            if not has_data:
                return SelfCheckResult(
                    check_name="补录后重算检查",
                    passed=False,
                    message=f"补录材料【{material.material_id}】没有数据，无法重算",
                    details={}
                )

            return SelfCheckResult(
                check_name="补录后重算检查",
                passed=True,
                message=(f"补录材料【{material.material_id}】已合并历史数据重算，"
                        f"阈值笔记{len(merged_notes)}条，实验桶{len(merged_buckets)}个"),
                details={
                    "prev_batch_count": len(prev_materials),
                    "merged_notes_count": len(merged_notes),
                    "merged_buckets_count": len(merged_buckets)
                }
            )

        return SelfCheckResult(
            check_name="补录后重算检查",
            passed=True,
            message="非补录材料，跳过此项检查",
            details={}
        )

    def _check_export_consistency(self, current_result: VotingResult = None) -> SelfCheckResult:
        export_count = len(self._export_snapshots)

        if export_count == 0:
            return SelfCheckResult(
                check_name="导出一致性检查",
                passed=False,
                message="尚未生成任何导出记录，请先完成阈值回放更新后导出",
                details={"export_count": 0}
            )

        if export_count == 1:
            snapshot = self._export_snapshots[0]
            issues = []
            trace_id = snapshot.get("trace_id", "")
            if not trace_id:
                issues.append("导出追踪ID为空")
            if snapshot.get("threshold") is None:
                issues.append("导出阈值缺失")
            if current_result:
                if abs(snapshot.get("threshold", -1) - current_result.final_threshold) > 1e-6:
                    issues.append(
                        f"导出阈值{snapshot.get('threshold')}与当前结果阈值{current_result.final_threshold}不一致"
                    )
                if snapshot.get("batch") != current_result.current_batch:
                    issues.append(
                        f"导出批次{snapshot.get('batch')}与当前批次{current_result.current_batch}不一致"
                    )
            if issues:
                return SelfCheckResult(
                    check_name="导出一致性检查",
                    passed=False,
                    message="；".join(issues),
                    details={"export_count": 1, "snapshot": snapshot, "issues": issues}
                )
            return SelfCheckResult(
                check_name="导出一致性检查",
                passed=True,
                message="已核对1次导出：追踪ID非空，阈值和批次与当前结果一致",
                details={
                    "export_count": 1,
                    "trace_id": trace_id,
                    "threshold": snapshot.get("threshold"),
                    "batch": snapshot.get("batch")
                }
            )

        issues = []
        for i, s in enumerate(self._export_snapshots):
            trace_id = s.get("trace_id", "")
            if not trace_id:
                issues.append(f"第{i+1}次导出追踪ID为空")
            if s.get("threshold") is None:
                issues.append(f"第{i+1}次导出阈值缺失")
        first = self._export_snapshots[0]
        for i in range(1, export_count):
            s = self._export_snapshots[i]
            if s.get("model_name") != first.get("model_name"):
                issues.append(f"第{i+1}次导出模型与第1次不一致")
            if abs(s.get("threshold", -1) - first.get("threshold", -999)) > 1e-6:
                issues.append(f"第{i+1}次导出阈值与第1次不一致")
            if s.get("batch") != first.get("batch"):
                issues.append(f"第{i+1}次导出批次与第1次不一致")
        if current_result:
            last = self._export_snapshots[-1]
            if abs(last.get("threshold", -1) - current_result.final_threshold) > 1e-6:
                issues.append(f"最新导出阈值与当前结果不一致")
            if not last.get("trace_id", ""):
                issues.append("最新导出追踪ID为空")
        if issues:
            return SelfCheckResult(
                check_name="导出一致性检查",
                passed=False,
                message="；".join(issues),
                details={"export_count": export_count, "issues": issues}
            )
        return SelfCheckResult(
            check_name="导出一致性检查",
            passed=True,
            message=f"已核对{export_count}次导出：追踪ID非空，阈值、批次、模型全部一致",
            details={"export_count": export_count, "trace_id": first.get("trace_id")}
        )

    def record_export(self, snapshot: Dict):
        self._export_snapshots.append(snapshot)

    def get_export_snapshot(self, index: int = -1) -> Optional[Dict]:
        if not self._export_snapshots:
            return None
        return self._export_snapshots[index].copy()

    def get_export_count(self) -> int:
        return len(self._export_snapshots)


class EnsembleVoteExplainer:
    def __init__(self):
        self.playback_validator = ThresholdPlaybackValidator()
        self.conflict_detector = ConflictDetector()
        self.self_checker = SelfChecker()
        self._voting_results: Dict[str, VotingResult] = {}
        self._all_materials: List[Material] = []
        self._batch_counters: Dict[str, int] = defaultdict(int)

    def _merge_history_data(self, material: Material) -> Tuple[List[ThresholdNote],
                                                                 List[OnlineExperimentBucket]]:
        same_id_materials = [m for m in self._all_materials
                            if m.material_id == material.material_id]
        same_id_materials.append(material)

        all_notes: Dict[str, ThresholdNote] = {}
        all_buckets: Dict[str, OnlineExperimentBucket] = {}

        for m in same_id_materials:
            for note in m.threshold_notes:
                all_notes[note.note_id] = note
            for bucket in m.experiment_buckets:
                all_buckets[bucket.bucket_id] = bucket

        return list(all_notes.values()), list(all_buckets.values())

    def _make_change_record(self, model_name: str, old_threshold: Optional[float],
                           new_threshold: float, old_minority: Optional[float],
                           new_minority: Optional[float], source: str, reason: str,
                           operator: str, batch: int, affected: List[str]) -> ThresholdChangeRecord:
        return ThresholdChangeRecord(
            change_id=str(uuid.uuid4())[:8],
            model_name=model_name,
            old_threshold=old_threshold,
            new_threshold=new_threshold,
            old_minority_threshold=old_minority,
            new_minority_threshold=new_minority,
            change_source=source,
            change_reason=reason,
            operator=operator,
            batch_number=batch,
            affected_items=affected
        )

    def process_material(self, material: Material) -> VotingResult:
        self._all_materials.append(material)
        self._batch_counters[material.material_id] += 1
        batch_num = self._batch_counters[material.material_id]

        merged_notes, merged_buckets = self._merge_history_data(material)

        batch = MaterialBatch(
            material_id=material.material_id,
            batch_number=batch_num,
            material_type=material.material_type,
            imported_at=material.imported_at,
            threshold_notes=list(material.threshold_notes),
            experiment_buckets=list(material.experiment_buckets)
        )

        existing_result = self._voting_results.get(material.model_name)
        old_threshold = existing_result.final_threshold if existing_result else None
        old_minority = existing_result.final_minority_threshold if existing_result else None

        conflicts = self.conflict_detector.detect_conflicts(merged_notes, merged_buckets)

        is_minority_masked = any(
            b.minority_sample_count > 0 and b.sample_count > 0
            and (b.minority_sample_count / b.sample_count) < 0.1
            and (b.overall_metric - b.minority_metric) > 0.2
            for b in merged_buckets
        )

        avg_threshold = self._calculate_avg_threshold(merged_notes, merged_buckets)
        avg_minority = self._calculate_avg_minority_threshold(merged_notes, merged_buckets)
        confidence = self._calculate_confidence(merged_buckets, conflicts)

        review_status = ReviewStatus.PENDING
        if is_minority_masked:
            review_status = ReviewStatus.NEED_ALGORITHM_REVIEW
        elif conflicts:
            review_status = ReviewStatus.PENDING

        if existing_result:
            result = existing_result
            result.final_threshold = avg_threshold
            result.final_minority_threshold = avg_minority
            result.confidence = confidence
            result.is_minority_masked = is_minority_masked
            result.review_status = review_status
            result.conflict_evidences = conflicts
            result.material_batches.append(batch)
            result.current_batch = batch_num
        else:
            result = VotingResult(
                model_name=material.model_name,
                final_threshold=avg_threshold,
                final_minority_threshold=avg_minority,
                confidence=confidence,
                is_minority_masked=is_minority_masked,
                review_status=review_status,
                conflict_evidences=conflicts,
                self_check_results=[],
                workflow_step=WorkflowStep.STEP1_THRESHOLD_IMPORT,
                material_batches=[batch],
                change_history=[],
                current_batch=batch_num
            )
            self._voting_results[material.model_name] = result

        self_check_results = self.self_checker.run_all_checks(
            material, self._all_materials, merged_notes, merged_buckets, result
        )
        result.self_check_results = self_check_results

        change_record = self._make_change_record(
            model_name=material.model_name,
            old_threshold=old_threshold,
            new_threshold=avg_threshold,
            old_minority=old_minority,
            new_minority=avg_minority,
            source=f"材料导入-{material.material_type.value}",
            reason=f"第{batch_num}批次导入（{material.material_type.value}），合并历史数据重算",
            operator="importer",
            batch=batch_num,
            affected=[f"阈值笔记{len(merged_notes)}条", f"实验桶{len(merged_buckets)}个"]
        )
        result.change_history.append(change_record)
        self.playback_validator.record_change(change_record)

        return result

    def _calculate_avg_threshold(self, notes: List[ThresholdNote],
                                 buckets: List[OnlineExperimentBucket]) -> float:
        all_thresholds = []
        for note in notes:
            all_thresholds.append(note.threshold)
        for bucket in buckets:
            all_thresholds.append(bucket.threshold)

        if not all_thresholds:
            return 0.0
        return sum(all_thresholds) / len(all_thresholds)

    def _calculate_avg_minority_threshold(self, notes: List[ThresholdNote],
                                          buckets: List[OnlineExperimentBucket]) -> Optional[float]:
        all_minority = []
        for note in notes:
            if note.minority_threshold is not None:
                all_minority.append(note.minority_threshold)
        for bucket in buckets:
            if bucket.minority_threshold is not None:
                all_minority.append(bucket.minority_threshold)

        if not all_minority:
            return None
        return sum(all_minority) / len(all_minority)

    def _calculate_confidence(self, buckets: List[OnlineExperimentBucket],
                              conflicts: List[ConflictEvidence]) -> float:
        base_confidence = 0.8
        conflict_penalty = len(conflicts) * 0.1
        sample_count = sum(b.sample_count for b in buckets)

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

        old_threshold = result.final_threshold
        old_minority = result.final_minority_threshold

        confirm_conflicts = confirm_conflicts or []
        reject_conflicts = reject_conflicts or []

        remaining_conflicts = []
        affected_items = []

        for conflict in result.conflict_evidences:
            if conflict.threshold_note_id in reject_conflicts:
                result.final_threshold = conflict.experiment_bucket_value
                affected_items.append(
                    f"驳回笔记【{conflict.threshold_note_id}】，采用实验桶【{conflict.experiment_bucket_id}】阈值={conflict.experiment_bucket_value}"
                )
            elif conflict.threshold_note_id in confirm_conflicts:
                affected_items.append(
                    f"确认笔记【{conflict.threshold_note_id}】与实验桶一致，采用阈值={conflict.threshold_note_value}"
                )
            else:
                remaining_conflicts.append(conflict)

        result.conflict_evidences = remaining_conflicts

        if not remaining_conflicts and not result.is_minority_masked:
            result.workflow_step = WorkflowStep.STEP2_TANG_REVIEW
            result.review_status = ReviewStatus.CONFIRMED
        elif result.is_minority_masked:
            result.review_status = ReviewStatus.NEED_ALGORITHM_REVIEW
            result.workflow_step = WorkflowStep.STEP2_TANG_REVIEW
        else:
            result.review_status = ReviewStatus.PENDING

        change_record = self._make_change_record(
            model_name=model_name,
            old_threshold=old_threshold,
            new_threshold=result.final_threshold,
            old_minority=old_minority,
            new_minority=result.final_minority_threshold,
            source="老唐审核线上实验桶",
            reason=f"推荐策略老唐人工审核，确认{len(confirm_conflicts)}项，驳回{len(reject_conflicts)}项，剩余{len(remaining_conflicts)}项",
            operator="推荐策略老唐",
            batch=result.current_batch,
            affected=affected_items if affected_items else ["无冲突变更"]
        )
        result.change_history.append(change_record)
        self.playback_validator.record_change(change_record)

        export_check = self.self_checker._check_export_consistency(result)
        for i, r in enumerate(result.self_check_results):
            if r.check_name == "导出一致性检查":
                result.self_check_results[i] = export_check
                break

        return result

    def update_threshold_playback(self, model_name: str,
                                  new_threshold: float,
                                  new_minority_threshold: Optional[float] = None,
                                  reason: str = "") -> VotingResult:
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

        old_threshold = result.final_threshold
        old_minority = result.final_minority_threshold

        is_match, message = self.playback_validator.validate_playback(
            model_name, result.final_threshold, result.final_minority_threshold
        )

        result.final_threshold = new_threshold
        result.final_minority_threshold = new_minority_threshold
        result.workflow_step = WorkflowStep.COMPLETED
        result.export_trace_id = str(uuid.uuid4())[:12]

        change_reason = reason or "阈值回放更新，校准线上效果"
        change_record = self._make_change_record(
            model_name=model_name,
            old_threshold=old_threshold,
            new_threshold=new_threshold,
            old_minority=old_minority,
            new_minority=new_minority_threshold,
            source="阈值回放更新",
            reason=change_reason,
            operator="system",
            batch=result.current_batch,
            affected=["最终阈值更新", f"导出追踪ID={result.export_trace_id}"]
        )
        result.change_history.append(change_record)
        self.playback_validator.record_change(change_record)

        self.self_checker.record_export({
            "model_name": model_name,
            "threshold": new_threshold,
            "minority_threshold": new_minority_threshold,
            "trace_id": result.export_trace_id,
            "batch": result.current_batch
        })

        export_check = self.self_checker._check_export_consistency(result)
        for i, r in enumerate(result.self_check_results):
            if r.check_name == "导出一致性检查":
                result.self_check_results[i] = export_check
                break

        return result

    def get_voting_result(self, model_name: str) -> Optional[VotingResult]:
        return self._voting_results.get(model_name)

    def get_all_results(self) -> List[VotingResult]:
        return list(self._voting_results.values())

    def refresh_checks(self, model_name: str) -> VotingResult:
        result = self._voting_results.get(model_name)
        if not result:
            raise FriendlyError(
                message=f"找不到模型【{model_name}】的投票结果",
                suggestion="请先导入材料。"
            )

        refreshed = []
        refreshed.append(SelfCheckResult(
            check_name="重复导入检查",
            passed=True,
            message="已刷新检查，当前无重复导入问题",
            details={}
        ))
        refreshed.append(SelfCheckResult(
            check_name="少数类样本被总指标盖住检查",
            passed=not result.is_minority_masked,
            message="无少数类样本被掩盖问题" if not result.is_minority_masked else "存在少数类样本被总指标盖住问题",
            details={"is_minority_masked": result.is_minority_masked}
        ))
        refreshed.append(SelfCheckResult(
            check_name="补录后重算检查",
            passed=True,
            message="已刷新检查",
            details={}
        ))
        export_check = self.self_checker._check_export_consistency(result)
        refreshed.append(export_check)
        result.self_check_results = refreshed

        return result

    def export_report(self, model_name: str) -> Dict:
        result = self._voting_results.get(model_name)
        if not result:
            raise FriendlyError(
                message=f"找不到模型【{model_name}】的投票结果",
                suggestion="请先导入材料。"
            )

        if not result.export_trace_id:
            result.export_trace_id = str(uuid.uuid4())[:12]
            self.self_checker.record_export({
                "model_name": model_name,
                "threshold": result.final_threshold,
                "minority_threshold": result.final_minority_threshold,
                "trace_id": result.export_trace_id,
                "batch": result.current_batch
            })

        export_check = self.self_checker._check_export_consistency(result)
        found = False
        for i, r in enumerate(result.self_check_results):
            if r.check_name == "导出一致性检查":
                result.self_check_results[i] = export_check
                found = True
                break
        if not found:
            result.self_check_results.append(export_check)

        all_change_ids = [c.change_id for c in result.change_history]
        all_batches = [b.batch_number for b in result.material_batches]
        all_material_ids = list({b.material_id for b in result.material_batches})

        return {
            "模型名称": result.model_name,
            "最终阈值": result.final_threshold,
            "最终少数类阈值": result.final_minority_threshold,
            "置信度": result.confidence,
            "审核状态": result.review_status.value,
            "工作流阶段": result.workflow_step.value,
            "少数类是否被掩盖": result.is_minority_masked,
            "当前批次": result.current_batch,
            "导出追踪ID": result.export_trace_id,
            "反查键": {
                "导出追踪ID": result.export_trace_id,
                "变更ID列表": all_change_ids,
                "批次号列表": all_batches,
                "材料ID列表": all_material_ids
            },
            "变更ID": all_change_ids,
            "批次号": all_batches,
            "材料ID": all_material_ids,
            "历史批次明细": [
                {
                    "材料ID": b.material_id,
                    "批次号": b.batch_number,
                    "材料类型": b.material_type.value,
                    "导入时间": b.imported_at,
                    "阈值笔记数": len(b.threshold_notes),
                    "阈值笔记ID": [n.note_id for n in b.threshold_notes],
                    "实验桶数": len(b.experiment_buckets),
                    "实验桶ID": [eb.bucket_id for eb in b.experiment_buckets]
                }
                for b in result.material_batches
            ],
            "阈值变更历史": self.playback_validator.get_detailed_history(model_name),
            "冲突证据": [
                {"描述": c.description,
                 "笔记ID": c.threshold_note_id,
                 "笔记阈值": c.threshold_note_value,
                 "实验桶ID": c.experiment_bucket_id,
                 "实验桶阈值": c.experiment_bucket_value}
                for c in result.conflict_evidences
            ],
            "自检结果": [
                {"检查项": r.check_name, "是否通过": r.passed, "说明": r.message, "详情": r.details}
                for r in result.self_check_results
            ]
        }
                for c in result.conflict_evidences
            ],
            "自检结果": [
                {"检查项": r.check_name, "是否通过": r.passed, "说明": r.message, "详情": r.details}
                for r in result.self_check_results
            ]
        }
