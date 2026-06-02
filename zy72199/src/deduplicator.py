from datetime import timedelta
from typing import List, Dict, Set
from collections import defaultdict
import logging

from .config import AppConfig
from .data_models import (
    EvaluationRecord,
    ProcessedRecord,
    DataStatus,
    AnnotationRecord,
    ConflictCase,
)
from .similarity import RecordComparator

logger = logging.getLogger(__name__)


class DeduplicationEngine:
    def __init__(self, config: AppConfig, comparator: RecordComparator = None):
        self.config = config
        self.comparator = comparator or RecordComparator()
        self.processed_records: List[ProcessedRecord] = []

    def _select_primary(self, records: List[EvaluationRecord]) -> EvaluationRecord:
        def sort_key(r):
            return (
                r.score,
                r.timestamp,
                0 if r.model_version.startswith("v2.1") else 1,
            )

        sorted_records = sorted(records, key=sort_key, reverse=True)
        return sorted_records[0]

    def _find_duplicates(
        self,
        target: EvaluationRecord,
        candidates: List[EvaluationRecord],
        processed_ids: Set[str],
    ) -> List[EvaluationRecord]:
        cfg = self.config.deduplication
        duplicates = []
        time_window = timedelta(hours=cfg.time_window_hours)

        for cand in candidates:
            if cand.record_id == target.record_id:
                continue
            if cand.record_id in processed_ids:
                continue
            if cand.sample_id != target.sample_id:
                continue

            time_diff = abs(cand.timestamp - target.timestamp)
            same_version = cand.model_version == target.model_version

            if same_version and time_diff > time_window:
                continue

            sim_score, details = self.comparator.compare(
                target,
                cand,
                consider_version=cfg.consider_model_version,
                consider_problem=cfg.consider_problem_id,
            )

            if cand.model_version == target.model_version:
                sim_threshold = cfg.text_similarity_threshold
            else:
                sim_threshold = max(0.6, cfg.text_similarity_threshold - 0.3)

            if sim_score >= sim_threshold:
                score_diff = abs(target.score - cand.score)
                if score_diff <= cfg.score_diff_threshold or sim_score >= 0.95:
                    duplicates.append(cand)
                    logger.info(
                        f"发现重复: {cand.record_id} -> {target.record_id}, "
                        f"相似度={sim_score} (阈值={sim_threshold}), 分数差={score_diff}"
                    )

        return duplicates

    def process(
        self,
        records: List[EvaluationRecord],
        annotations: Dict[str, AnnotationRecord] = None,
        conflict_cases: Dict[str, ConflictCase] = None,
    ) -> List[ProcessedRecord]:
        annotations = annotations or {}
        conflict_cases = conflict_cases or {}

        records_by_sample: Dict[str, List[EvaluationRecord]] = defaultdict(list)
        for r in records:
            records_by_sample[r.sample_id].append(r)

        processed_ids: Set[str] = set()
        results: List[ProcessedRecord] = []

        for sample_id, sample_records in records_by_sample.items():
            empty_records = [r for r in sample_records if r.is_empty()]
            normal_records = [r for r in sample_records if not r.is_empty()]

            if empty_records and not normal_records:
                primary = sorted(empty_records, key=lambda r: r.timestamp, reverse=True)[0]
                processed = ProcessedRecord(
                    primary_record=primary,
                    status=DataStatus.EMPTY,
                    duplicates=[r for r in empty_records if r.record_id != primary.record_id],
                    annotation=annotations.get(sample_id),
                    conflict_case=conflict_cases.get(sample_id),
                    processing_reason="模型输出为空或分数为0，需要人工复核",
                    needs_review=True,
                    review_notes="空值样本，请检查是否为模型异常或输入问题",
                )
                results.append(processed)
                for r in empty_records:
                    processed_ids.add(r.record_id)
                continue

            all_records = normal_records + empty_records
            sorted_records = sorted(
                normal_records,
                key=lambda r: (r.score, r.timestamp),
                reverse=True,
            )

            sample_processed = set()

            for record in sorted_records:
                if record.record_id in processed_ids or record.record_id in sample_processed:
                    continue

                duplicates = self._find_duplicates(record, all_records, processed_ids | sample_processed)

                sim_scores = {}
                for dup in duplicates:
                    sim, _ = self.comparator.compare(record, dup)
                    sim_scores[dup.record_id] = sim

                if duplicates:
                    status = DataStatus.KEPT
                    reason = f"合并了 {len(duplicates)} 条重复记录，保留最高分/最新版本"
                else:
                    status = DataStatus.KEPT
                    reason = "无重复记录，直接保留"

                conflict = conflict_cases.get(sample_id)
                needs_review = False
                review_notes = ""

                if conflict:
                    needs_review = conflict.severity in ["high", "medium"]
                    review_notes = f"已知冲突案例 {conflict.case_id}: {conflict.description}。建议: {conflict.expected_action}"
                    if not duplicates:
                        status = DataStatus.CONFLICT
                        reason = f"存在已知冲突案例: {conflict.case_id}"

                if record.score < 0.75 and not duplicates:
                    status = DataStatus.BOUNDARY
                    needs_review = True
                    review_notes = review_notes or f"模型分数{record.score:.2f}较低，接近决策边界，建议人工复核"

                processed = ProcessedRecord(
                    primary_record=record,
                    status=status,
                    duplicates=duplicates,
                    annotation=annotations.get(sample_id),
                    conflict_case=conflict,
                    similarity_scores=sim_scores,
                    processing_reason=reason,
                    needs_review=needs_review,
                    review_notes=review_notes,
                )

                results.append(processed)
                processed_ids.add(record.record_id)
                sample_processed.add(record.record_id)
                for dup in duplicates:
                    processed_ids.add(dup.record_id)
                    sample_processed.add(dup.record_id)

            for er in empty_records:
                if er.record_id not in processed_ids:
                    primary_for_empty = sorted(normal_records, key=lambda r: r.timestamp, reverse=True)[0]
                    for proc in results:
                        if proc.primary_record.record_id == primary_for_empty.record_id:
                            proc.duplicates.append(er)
                            proc.processing_reason += f"；另有1条空值记录合并"
                            processed_ids.add(er.record_id)
                            break

        self.processed_records = results
        logger.info(f"去重处理完成: 原始{len(records)}条 -> 处理后{len(results)}条，合并了{len(processed_ids) - len(results)}条重复")
        return results

    def get_summary(self) -> Dict:
        status_counts = defaultdict(int)
        need_review = 0
        has_annotation = 0
        has_conflict = 0
        total_duplicates = 0

        for pr in self.processed_records:
            status_counts[pr.status.value] += 1
            if pr.needs_review:
                need_review += 1
            if pr.annotation:
                has_annotation += 1
            if pr.conflict_case:
                has_conflict += 1
            total_duplicates += len(pr.duplicates)

        return {
            "total_processed": len(self.processed_records),
            "total_duplicates_merged": total_duplicates,
            "status_distribution": dict(status_counts),
            "needs_human_review": need_review,
            "with_annotations": has_annotation,
            "with_conflict_cases": has_conflict,
        }
