import os

content = r'''from typing import List, Dict, Tuple, Optional
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
'''

with open('/Users/lzy/pro/solo/workspaces/zy72578/ensemble_vote_explainer.py', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Part 1 written: {len(content)} chars, {content.count(chr(10))} lines")
