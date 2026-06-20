from typing import List, Dict, Tuple, Set
import pandas as pd
from collections import defaultdict
from .models import NegativeSample, RecallCandidate, DataStatus


class DuplicateDetector:
    def __init__(self):
        self.duplicate_groups: Dict[str, List[Dict]] = defaultdict(list)

    def detect_in_negative_samples(
        self, samples: List[NegativeSample]
    ) -> Tuple[List[NegativeSample], List[Dict]]:
        batch_item_counts: Dict[Tuple[str, str], List[int]] = defaultdict(list)

        for idx, sample in enumerate(samples):
            key = (sample.batch_id, sample.item_id)
            batch_item_counts[key].append(idx)

        duplicates_info = []
        for (batch_id, item_id), indices in batch_item_counts.items():
            if len(indices) > 1:
                dup_samples = [samples[i] for i in indices]
                group_key = f"batch_{batch_id}_item_{item_id}"
                default_remark = (
                    f"检测到同一批数据重复训练：批次{batch_id}，商品{item_id}，"
                    f"共出现{len(indices)}次。待策略产品复核"
                )
                for i in indices:
                    if samples[i].status not in (
                        DataStatus.STRATEGY_REVIEW,
                        DataStatus.DUPLICATE,
                    ):
                        samples[i].status = DataStatus.DUPLICATE
                    if not samples[i].remarks or samples[i].remarks == "nan":
                        samples[i].remarks = default_remark

                duplicates_info.append(
                    {
                        "group_key": group_key,
                        "batch_id": batch_id,
                        "item_id": item_id,
                        "count": len(indices),
                        "sample_ids": [s.sample_id for s in dup_samples],
                        "indices": indices,
                    }
                )
                self.duplicate_groups[group_key] = duplicates_info[-1]

        return samples, duplicates_info

    def detect_in_recall_candidates(
        self, candidates: List[RecallCandidate]
    ) -> Tuple[List[RecallCandidate], List[Dict]]:
        batch_item_counts: Dict[Tuple[str, str], List[int]] = defaultdict(list)

        for idx, candidate in enumerate(candidates):
            key = (candidate.batch_id, candidate.item_id)
            batch_item_counts[key].append(idx)

        duplicates_info = []
        for (batch_id, item_id), indices in batch_item_counts.items():
            if len(indices) > 1:
                dup_candidates = [candidates[i] for i in indices]
                group_key = f"batch_{batch_id}_item_{item_id}"
                default_remark = (
                    f"检测到同一批数据重复训练：批次{batch_id}，商品{item_id}，"
                    f"共出现{len(indices)}次。待策略产品复核"
                )
                for i in indices:
                    if candidates[i].status not in (
                        DataStatus.STRATEGY_REVIEW,
                        DataStatus.DUPLICATE,
                    ):
                        candidates[i].status = DataStatus.DUPLICATE
                    if not candidates[i].remarks or candidates[i].remarks == "nan":
                        candidates[i].remarks = default_remark

                duplicates_info.append(
                    {
                        "group_key": group_key,
                        "batch_id": batch_id,
                        "item_id": item_id,
                        "count": len(indices),
                        "candidate_ids": [c.candidate_id for c in dup_candidates],
                        "indices": indices,
                    }
                )
                self.duplicate_groups[group_key] = duplicates_info[-1]

        return candidates, duplicates_info

    def detect_cross_duplicates(
        self,
        samples: List[NegativeSample],
        candidates: List[RecallCandidate],
    ) -> List[Dict]:
        sample_keys: Dict[Tuple[str, str], List[NegativeSample]] = defaultdict(list)
        for s in samples:
            key = (s.batch_id, s.item_id)
            sample_keys[key].append(s)

        candidate_keys: Dict[Tuple[str, str], List[RecallCandidate]] = defaultdict(list)
        for c in candidates:
            key = (c.batch_id, c.item_id)
            candidate_keys[key].append(c)

        cross_duplicates = []
        intersect_keys = set(sample_keys.keys()) & set(candidate_keys.keys())
        for key in intersect_keys:
            batch_id, item_id = key
            matched_samples = sample_keys.get(key, [])
            matched_candidates = candidate_keys.get(key, [])
            sample_count = len(matched_samples)
            candidate_count = len(matched_candidates)
            total = sample_count + candidate_count

            dup_source_parts = []
            if sample_count > 0:
                dup_source_parts.append(f"负样本{sample_count}次")
            if candidate_count > 0:
                dup_source_parts.append(f"召回候选{candidate_count}次")
            dup_source_desc = "、".join(dup_source_parts)
            default_remark = (
                f"检测到同一批数据重复训练（跨表交叉）：批次{batch_id}，商品{item_id}，"
                f"共出现{total}次（{dup_source_desc}）。待策略产品复核"
            )

            for s in matched_samples:
                if s.status not in (DataStatus.STRATEGY_REVIEW, DataStatus.DUPLICATE):
                    s.status = DataStatus.DUPLICATE
                if not s.remarks or s.remarks == "nan":
                    s.remarks = default_remark

            for c in matched_candidates:
                if c.status not in (DataStatus.STRATEGY_REVIEW, DataStatus.DUPLICATE):
                    c.status = DataStatus.DUPLICATE
                if not c.remarks or c.remarks == "nan":
                    c.remarks = default_remark

            group_key = f"batch_{batch_id}_item_{item_id}"
            group_info = {
                "group_key": group_key,
                "batch_id": batch_id,
                "item_id": item_id,
                "count": total,
                "negative_sample_count": sample_count,
                "recall_candidate_count": candidate_count,
                "sample_ids": [s.sample_id for s in matched_samples],
                "candidate_ids": [c.candidate_id for c in matched_candidates],
                "is_cross": True,
            }
            self.duplicate_groups[group_key] = group_info

            cross_duplicates.append(group_info)

        _, _ = self.mark_for_strategy_review(samples, candidates)

        return cross_duplicates

    def mark_for_strategy_review(
        self,
        samples: List[NegativeSample],
        candidates: List[RecallCandidate],
    ) -> Tuple[List[NegativeSample], List[RecallCandidate]]:
        for sample in samples:
            if sample.status == DataStatus.DUPLICATE:
                sample.status = DataStatus.STRATEGY_REVIEW

        for candidate in candidates:
            if candidate.status == DataStatus.DUPLICATE:
                candidate.status = DataStatus.STRATEGY_REVIEW

        return samples, candidates

    def get_duplicate_summary(self) -> Dict:
        total_groups = len(self.duplicate_groups)
        total_duplicate_items = sum(
            g["count"] for g in self.duplicate_groups.values()
        )

        return {
            "total_duplicate_groups": total_groups,
            "total_duplicate_items": total_duplicate_items,
            "duplicate_groups": list(self.duplicate_groups.values()),
        }

    def export_duplicate_report(self, output_path: str) -> pd.DataFrame:
        rows = []
        for group in self.duplicate_groups.values():
            rows.append(
                {
                    "批次ID": group["batch_id"],
                    "商品ID": group["item_id"],
                    "重复次数": group["count"],
                    "状态": "待策略产品复核",
                    "详情": f"样本/候选ID: {group.get('sample_ids', group.get('candidate_ids', []))}",
                }
            )

        df = pd.DataFrame(rows)
        if output_path:
            df.to_csv(output_path, index=False, encoding="utf-8-sig")
        return df
