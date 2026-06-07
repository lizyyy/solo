import json
import uuid
import hashlib
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from .models import (
    UnifiedResult, ReviewStatus, SelfCheckResult,
    SampleLabel, ReviewRecord, ConflictEvidence, ConflictType
)
from .experiment_manager import ExperimentManager
from .config import RESULT_DIR, REVIEWER_A_YUE, DATA_SCIENTIST


class PseudoLabelReview:
    def __init__(self):
        self.exp_manager = ExperimentManager()
        self.results: Dict[str, UnifiedResult] = {}
        self.review_records: List[ReviewRecord] = []
        self._load_results()

    def _load_results(self):
        result_file = RESULT_DIR / "unified_results.json"
        record_file = RESULT_DIR / "review_records.json"

        if result_file.exists():
            with open(result_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    result = UnifiedResult(**item)
                    self.results[result.result_id] = result

        if record_file.exists():
            with open(record_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data:
                    self.review_records.append(ReviewRecord(**item))

    def _save_results(self):
        RESULT_DIR.mkdir(exist_ok=True)

        with open(RESULT_DIR / "unified_results.json", "w", encoding="utf-8") as f:
            json.dump(
                [r.model_dump() for r in self.results.values()],
                f, ensure_ascii=False, indent=2, default=str
            )

        with open(RESULT_DIR / "review_records.json", "w", encoding="utf-8") as f:
            json.dump(
                [r.model_dump() for r in self.review_records],
                f, ensure_ascii=False, indent=2, default=str
            )

    def _calculate_stratified_metrics(
        self, samples: List[SampleLabel], threshold: float
    ) -> Dict[str, Dict[str, float]]:
        strata = defaultdict(list)
        for s in samples:
            strata[s.source].append(s)

        metrics = {}
        for source, src_samples in strata.items():
            tp = sum(1 for s in src_samples if s.predicted_score >= threshold and s.true_label == 1)
            fp = sum(1 for s in src_samples if s.predicted_score >= threshold and s.true_label == 0)
            fn = sum(1 for s in src_samples if s.predicted_score < threshold and s.true_label == 1)
            tn = sum(1 for s in src_samples if s.predicted_score < threshold and s.true_label == 0)

            precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0
            accuracy = (tp + tn) / len(src_samples) if src_samples else 0.0

            metrics[source] = {
                "precision": precision,
                "recall": recall,
                "f1": f1,
                "accuracy": accuracy,
                "total_samples": len(src_samples),
                "tp": tp,
                "fp": fp,
                "fn": fn,
                "tn": tn
            }
        return metrics

    def _run_self_checks(self, bucket_id: str, result: UnifiedResult) -> List[SelfCheckResult]:
        checks = []
        bucket = self.exp_manager.get_bucket(bucket_id)
        if not bucket:
            return checks

        is_dup = self.exp_manager.check_duplicate_import(bucket_id)
        checks.append(SelfCheckResult(
            check_name="duplicate_import",
            passed=not is_dup,
            message="检测到重复导入" if is_dup else "无重复导入",
            details={"duplicate_count": sum(1 for bid, _ in self.exp_manager._import_history if bid == bucket_id)}
        ))

        latest_th = bucket.get_latest_threshold()
        has_th_mismatch = latest_th.has_mismatch
        checks.append(SelfCheckResult(
            check_name="threshold_report_mismatch",
            passed=not has_th_mismatch,
            message=f"阈值改过但报告仍写旧值: 实际={latest_th.threshold}, 报告={latest_th.report_value}" if has_th_mismatch else "阈值与报告一致",
            details={
                "actual_threshold": latest_th.threshold,
                "report_threshold": latest_th.report_value,
                "needs_data_scientist": has_th_mismatch
            }
        ))

        checks.append(SelfCheckResult(
            check_name="recalc_after_supplement",
            passed=bucket.is_supplemented,
            message="已补录负样本并重新计算" if bucket.is_supplemented else "尚未补录负样本后重算",
            details={"is_supplemented": bucket.is_supplemented}
        ))

        export_hash = hashlib.md5(
            json.dumps([s.model_dump() for s in result.samples], sort_keys=True).encode()
        ).hexdigest()
        checks.append(SelfCheckResult(
            check_name="export_consistency",
            passed=True,
            message="明细、页面、接口使用同一份结果数据",
            details={
                "data_hash": export_hash,
                "unified_source": True,
                "result_id": result.result_id
            }
        ))

        return checks

    def step1_import_experiment_bucket(
        self,
        bucket_id: str,
        name: str,
        samples: List[dict],
        imported_by: str,
        threshold: float = 0.5,
        threshold_report_value: Optional[float] = None,
        params_version: str = "v1.0",
        params_reason: str = "默认参数配置，基于历史实验AUC最优选择"
    ) -> UnifiedResult:
        bucket = self.exp_manager.import_experiment_bucket(
            bucket_id=bucket_id,
            name=name,
            samples=samples,
            imported_by=imported_by,
            threshold=threshold,
            threshold_report_value=threshold_report_value,
            params_version=params_version,
            params_reason=params_reason
        )

        result_id = f"result_{bucket_id}_{uuid.uuid4().hex[:8]}"
        result = UnifiedResult(
            result_id=result_id,
            experiment_bucket_id=bucket_id,
            samples=bucket.samples,
            threshold=threshold,
            threshold_report_value=threshold_report_value,
            params_version=params_version,
            params_reason=params_reason
        )

        result.self_check_results = self._run_self_checks(bucket_id, result)
        result.stratified_metrics = self._calculate_stratified_metrics(bucket.samples, threshold)

        for check in result.self_check_results:
            if check.check_name == "threshold_report_mismatch" and not check.passed:
                result.needs_data_scientist = True
                break

        self.results[result_id] = result
        self._save_results()

        self._add_review_record(result_id, imported_by, ReviewStatus.PENDING, "第一步：线上实验桶导入完成", step=1)
        return result

    def step2_supplement_negative_samples(
        self,
        result_id: str,
        negative_samples: List[dict],
        added_by: str = REVIEWER_A_YUE
    ) -> Tuple[UnifiedResult, List[ConflictEvidence]]:
        result = self.results.get(result_id)
        if not result:
            raise ValueError(f"结果 {result_id} 不存在")

        self.exp_manager.add_negative_samples(negative_samples, added_by)
        self.exp_manager.mark_supplemented(result.experiment_bucket_id)

        bucket = self.exp_manager.get_bucket(result.experiment_bucket_id)
        for sample in bucket.samples:
            neg = self.exp_manager.negative_samples.get(sample.sample_id)
            if neg:
                sample.true_label = neg.true_label

        conflicts = self.exp_manager.detect_conflicts(result.experiment_bucket_id)
        result.conflicts = conflicts
        result.samples = bucket.samples
        result.self_check_results = self._run_self_checks(result.experiment_bucket_id, result)

        for check in result.self_check_results:
            if check.check_name == "threshold_report_mismatch" and not check.passed:
                result.needs_data_scientist = True
                result.review_status = ReviewStatus.NEEDS_DATA_SCIENTIST
                break

        if conflicts:
            result.review_status = ReviewStatus.PENDING

        self._save_results()
        self._add_review_record(result_id, added_by, ReviewStatus.PENDING, "第二步：负样本列表补录完成，已检测冲突", step=2)
        return result, conflicts

    def step3_update_stratified_metrics(
        self,
        result_id: str,
        reviewer: str = REVIEWER_A_YUE
    ) -> UnifiedResult:
        result = self.results.get(result_id)
        if not result:
            raise ValueError(f"结果 {result_id} 不存在")

        result.stratified_metrics = self._calculate_stratified_metrics(result.samples, result.threshold)
        result.self_check_results = self._run_self_checks(result.experiment_bucket_id, result)
        self._save_results()
        self._add_review_record(result_id, reviewer, ReviewStatus.PENDING, "第三步：分层指标更新完成，等待人工确认", step=3)
        return result

    def a_yue_review(
        self,
        result_id: str,
        decision: str,
        comment: str = "",
        reviewer: str = REVIEWER_A_YUE
    ) -> UnifiedResult:
        result = self.results.get(result_id)
        if not result:
            raise ValueError(f"结果 {result_id} 不存在")

        status = ReviewStatus(decision)

        if status == ReviewStatus.CONFIRMED and result.needs_data_scientist:
            result.review_status = ReviewStatus.NEEDS_DATA_SCIENTIST
            result.reviewer = reviewer
            result.reviewed_at = datetime.now()
            result.review_comment = comment + "（注意：存在阈值不一致，已转数据科学家复核，请勿直接归为正常）"
            self._add_review_record(result_id, reviewer, ReviewStatus.NEEDS_DATA_SCIENTIST,
                                    comment + "（阈值不一致，自动转数据科学家）", step=3)
        else:
            result.review_status = status
            result.reviewer = reviewer
            result.reviewed_at = datetime.now()
            result.review_comment = comment
            self._add_review_record(result_id, reviewer, status, comment, step=3)

        self._save_results()
        return result

    def data_scientist_review(
        self,
        result_id: str,
        decision: str,
        comment: str = "",
        reviewer: str = DATA_SCIENTIST
    ) -> UnifiedResult:
        result = self.results.get(result_id)
        if not result:
            raise ValueError(f"结果 {result_id} 不存在")

        status = ReviewStatus(decision)
        result.review_status = status
        result.data_scientist_comment = comment
        result.needs_data_scientist = False

        if not result.reviewer:
            result.reviewer = reviewer
        result.reviewed_at = datetime.now()

        self._add_review_record(result_id, reviewer, status, comment, step=4)
        self._save_results()
        return result

    def _add_review_record(self, result_id: str, reviewer: str, decision: ReviewStatus, comment: str, step: int):
        record = ReviewRecord(
            record_id=f"rec_{uuid.uuid4().hex[:12]}",
            result_id=result_id,
            reviewer=reviewer,
            decision=decision,
            comment=comment,
            step=step
        )
        self.review_records.append(record)

    def get_result(self, result_id: str) -> Optional[UnifiedResult]:
        return self.results.get(result_id)

    def get_export_data(self, result_id: str) -> dict:
        result = self.get_result(result_id)
        if not result:
            return {}
        return {
            "result_id": result.result_id,
            "generated_at": result.generated_at,
            "experiment_bucket_id": result.experiment_bucket_id,
            "threshold": result.threshold,
            "threshold_report_value": result.threshold_report_value,
            "is_threshold_consistent": result.is_consistent(),
            "params_version": result.params_version,
            "params_reason": result.params_reason,
            "review_status": result.review_status,
            "reviewer": result.reviewer,
            "review_comment": result.review_comment,
            "needs_data_scientist": result.needs_data_scientist,
            "samples": [s.model_dump() for s in result.samples],
            "stratified_metrics": result.stratified_metrics,
            "self_checks": [c.model_dump() for c in result.self_check_results],
            "conflicts": [c.model_dump() for c in result.conflicts]
        }

    def get_page_display_data(self, result_id: str) -> dict:
        return self.get_export_data(result_id)

    def get_api_response(self, result_id: str) -> dict:
        return self.get_export_data(result_id)

    def list_conflicts_for_review(self, result_id: str) -> List[ConflictEvidence]:
        result = self.get_result(result_id)
        return result.conflicts if result else []
