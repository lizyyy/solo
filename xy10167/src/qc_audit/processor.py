from datetime import datetime
from typing import Dict, List, Optional, Tuple
import uuid

from .models import Batch, Sample, RecheckRecord, SamplingRule
from .sampling import SamplingEngine


class BatchProcessor:
    def __init__(self, sampling_engine: SamplingEngine):
        self.sampling_engine = sampling_engine
        self.warnings: List[Dict] = []

    def _warn(self, level: str, code: str, message: str, context: Dict = None):
        self.warnings.append({
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "code": code,
            "message": message,
            "context": context or {},
        })

    def merge_batches(self, batches: List[Batch], new_batch_id: str,
                      product: Optional[str] = None) -> Batch:
        if not batches:
            raise ValueError("至少需要一个批次才能合并")

        merged = Batch(
            batch_id=new_batch_id,
            product=product or batches[0].product,
            total_quantity=sum(b.total_quantity for b in batches),
            sample_quantity=sum(b.sample_quantity for b in batches),
            merged_from=[b.batch_id for b in batches],
        )

        sample_id_map: Dict[str, str] = {}
        for batch in batches:
            for sample in batch.samples:
                if sample.sample_id in sample_id_map:
                    new_id = f"{sample.sample_id}_{uuid.uuid4().hex[:6]}"
                    self._warn(
                        "warning", "duplicate_sample_id",
                        f"样本 {sample.sample_id} 在合并时发现重复，已重命名为 {new_id}",
                        {"original_id": sample.sample_id, "new_id": new_id, "batch": batch.batch_id}
                    )
                    sample_id_map[sample.sample_id] = new_id
                else:
                    sample_id_map[sample.sample_id] = sample.sample_id

        for batch in batches:
            for sample in batch.samples:
                new_id = sample_id_map[sample.sample_id]
                merged.samples.append(
                    Sample(
                        sample_id=new_id,
                        batch_id=new_batch_id,
                        is_defective=sample.is_defective,
                        inspection_time=sample.inspection_time,
                        inspector=sample.inspector,
                        remark=sample.remark,
                        rework_count=sample.rework_count,
                        extra={**sample.extra, "original_batch": batch.batch_id},
                    )
                )

        for batch in batches:
            for recheck in batch.rechecks:
                new_sample_id = sample_id_map.get(recheck.sample_id, recheck.sample_id)
                merged.rechecks.append(
                    RecheckRecord(
                        sample_id=new_sample_id,
                        original_result=recheck.original_result,
                        recheck_result=recheck.recheck_result,
                        recheck_time=recheck.recheck_time,
                        rechecker=recheck.rechecker,
                        reason=recheck.reason,
                    )
                )

        return merged

    def apply_recheck(self, batch: Batch, recheck: RecheckRecord) -> None:
        existing = [s for s in batch.samples if s.sample_id == recheck.sample_id]
        if not existing:
            self._warn(
                "error", "sample_not_found",
                f"复检记录引用的样本 {recheck.sample_id} 在批次 {batch.batch_id} 中不存在",
                {"sample_id": recheck.sample_id, "batch_id": batch.batch_id}
            )
            return

        sample = existing[0]
        if recheck.original_result != sample.is_defective:
            self._warn(
                "warning", "original_mismatch",
                f"复检记录中的原始结果 ({recheck.original_result}) 与样本实际结果 ({sample.is_defective}) 不一致",
                {"sample_id": sample.sample_id, "recorded": recheck.original_result, "actual": sample.is_defective}
            )

        batch.rechecks.append(recheck)

    def apply_rechecks(self, batch: Batch, rechecks: List[RecheckRecord]) -> None:
        for recheck in rechecks:
            self.apply_recheck(batch, recheck)

    def detect_discrepancies(self, batch: Batch, declared_pass_rate: Optional[float] = None,
                             declared_conclusion: Optional[str] = None) -> List[Dict]:
        discrepancies = []
        validation = self.sampling_engine.validate_sampling(batch)

        actual_pass_rate = batch.pass_rate
        actual_defective = batch.defective_count
        actual_sample_count = len(batch.samples)

        if declared_pass_rate is not None:
            if abs(actual_pass_rate - declared_pass_rate) > 1e-6:
                discrepancies.append({
                    "type": "pass_rate_mismatch",
                    "batch_id": batch.batch_id,
                    "declared": declared_pass_rate,
                    "calculated": actual_pass_rate,
                    "diff": actual_pass_rate - declared_pass_rate,
                })

        if declared_conclusion:
            actual_conclusion = "PASS" if validation["valid"] else "FAIL"
            if declared_conclusion != actual_conclusion:
                discrepancies.append({
                    "type": "conclusion_mismatch",
                    "batch_id": batch.batch_id,
                    "declared": declared_conclusion,
                    "calculated": actual_conclusion,
                })

        if not validation["valid"]:
            discrepancies.append({
                "type": f"validation_failed_{validation['reason']}",
                "batch_id": batch.batch_id,
                "reason": validation["reason"],
                "details": validation,
            })

        return discrepancies

    def get_failed_samples_with_trace(self, batch: Batch) -> List[Dict]:
        failed = []
        for sample in batch.samples:
            rechecks = [r for r in batch.rechecks if r.sample_id == sample.sample_id]
            effective_result = batch._is_effectively_defective(sample)
            
            if effective_result:
                failed.append({
                    "sample_id": sample.sample_id,
                    "batch_id": batch.batch_id,
                    "original_defective": sample.is_defective,
                    "effective_defective": effective_result,
                    "has_recheck": len(rechecks) > 0,
                    "recheck_count": len(rechecks),
                    "latest_recheck": max(rechecks, key=lambda r: r.recheck_time).recheck_result if rechecks else None,
                    "rework_count": sample.rework_count,
                    "inspection_time": sample.inspection_time,
                    "inspector": sample.inspector,
                    "remark": sample.remark,
                })
        return failed

    def recalculate_from_scratch(self, batch: Batch,
                                  declared_pass_rate: Optional[float] = None,
                                  declared_conclusion: Optional[str] = None) -> Dict:
        self.warnings = []
        
        original_pass_rate = sum(1 for s in batch.samples if not s.is_defective) / len(batch.samples) if batch.samples else 1.0
        rechecked_pass_rate = batch.pass_rate
        
        discrepancies = self.detect_discrepancies(batch, declared_pass_rate, declared_conclusion)
        failed_samples = self.get_failed_samples_with_trace(batch)
        validation = self.sampling_engine.validate_sampling(batch)

        return {
            "batch_id": batch.batch_id,
            "recalculated_at": datetime.now().isoformat(),
            "statistics": {
                "total_samples": len(batch.samples),
                "original_pass_rate": original_pass_rate,
                "rechecked_pass_rate": rechecked_pass_rate,
                "defective_after_recheck": batch.defective_count,
                "recheck_count": len(batch.rechecks),
                "has_merged": len(batch.merged_from) > 0,
                "merged_from": batch.merged_from,
            },
            "validation": validation,
            "discrepancies": discrepancies,
            "failed_samples": failed_samples,
            "warnings": list(self.warnings),
        }
