from typing import List, Tuple, Dict, Any
import uuid

from .models import (
    EvalSlice, CoverageGapRecord, RecordStatus
)


class CoverageAnalyzer:
    def __init__(
        self,
        minority_ratio_threshold: float = 0.15,
        recall_gap_threshold: float = 0.15,
        total_recall_threshold: float = 0.85
    ):
        self.minority_ratio_threshold = minority_ratio_threshold
        self.recall_gap_threshold = recall_gap_threshold
        self.total_recall_threshold = total_recall_threshold

    def _calculate_total_recall(self, slices: List[EvalSlice]) -> float:
        total_positive = sum(s.positive_samples for s in slices)
        total_recalled = sum(s.positive_samples * s.recall for s in slices)
        if total_positive == 0:
            return 0.0
        return total_recalled / total_positive

    def _is_minority_class(self, slice_obj: EvalSlice, all_slices: List[EvalSlice]) -> Tuple[bool, float]:
        total_samples = sum(s.total_samples for s in all_slices)
        if total_samples == 0:
            return False, 0.0
        ratio = slice_obj.total_samples / total_samples
        return ratio < self.minority_ratio_threshold, ratio

    def _is_masked_by_total(
        self,
        slice_obj: EvalSlice,
        total_recall: float,
        is_minority: bool
    ) -> bool:
        if not is_minority:
            return False
        recall_gap = total_recall - slice_obj.recall
        return (
            total_recall >= self.total_recall_threshold
            and recall_gap >= self.recall_gap_threshold
            and slice_obj.recall < self.total_recall_threshold - 0.1
        )

    def analyze(self, slices: List[EvalSlice]) -> List[CoverageGapRecord]:
        total_recall = self._calculate_total_recall(slices)
        records = []

        for slice_obj in slices:
            is_minority, minority_ratio = self._is_minority_class(slice_obj, slices)
            recall_gap = total_recall - slice_obj.recall
            is_masked = self._is_masked_by_total(slice_obj, total_recall, is_minority)

            if is_masked:
                status = RecordStatus.NEED_REVIEW
            elif recall_gap >= self.recall_gap_threshold:
                status = RecordStatus.MINORITY_MASKED if is_minority else RecordStatus.NORMAL
            else:
                status = RecordStatus.NORMAL

            record = CoverageGapRecord(
                record_id=f"gap_{uuid.uuid4().hex[:8]}",
                slice_id=slice_obj.slice_id,
                total_recall=total_recall,
                slice_recall=slice_obj.recall,
                recall_gap=recall_gap,
                minority_ratio=minority_ratio,
                status=status,
                is_minority_masked=is_masked,
                feature_snapshot_id=slice_obj.feature_snapshot_id
            )
            records.append(record)

        return records

    def generate_report(self, records: List[CoverageGapRecord], slices: List[EvalSlice]) -> Dict[str, Any]:
        total_recall = records[0].total_recall if records else 0.0
        slice_map = {s.slice_id: s for s in slices}

        masked_records = [r for r in records if r.is_minority_masked]
        normal_records = [r for r in records if r.status == RecordStatus.NORMAL]
        need_review_records = [r for r in records if r.status == RecordStatus.NEED_REVIEW]

        report_lines = []
        report_lines.append("=" * 70)
        report_lines.append("              召 回 覆 盖 率 缺 口 分 析 报 告")
        report_lines.append("=" * 70)
        report_lines.append(f"  总召回率: {total_recall:.2%}")
        report_lines.append(f"  切片总数: {len(records)}")
        report_lines.append(f"  少数类被掩盖: {len(masked_records)} 个切片")
        report_lines.append(f"  待算法工程师复核: {len(need_review_records)} 个切片")
        report_lines.append("-" * 70)

        for record in records:
            slice_obj = slice_map.get(record.slice_id)
            if not slice_obj:
                continue

            status_markers = {
                RecordStatus.NORMAL: "✅",
                RecordStatus.MINORITY_MASKED: "⚠️ ",
                RecordStatus.NEED_REVIEW: "🔴",
                RecordStatus.FIXED: "✅",
                RecordStatus.OLD_CALIBER: "📜"
            }

            marker = status_markers.get(record.status, "❓")

            report_lines.append(f"")
            report_lines.append(f"  {marker} [{record.status.value}] {slice_obj.slice_name}")
            report_lines.append(f"     类别: {slice_obj.category}")
            report_lines.append(f"     样本占比: {record.minority_ratio:.2%}")
            report_lines.append(f"     切片召回率: {record.slice_recall:.2%}")
            report_lines.append(f"     总召回率缺口: {record.recall_gap:.2%}")
            if slice_obj.feature_snapshot_id:
                report_lines.append(f"     特征快照: {slice_obj.feature_snapshot_id}")
            else:
                report_lines.append(f"     特征快照: [未关联 - 待补录]")
            if record.is_minority_masked:
                report_lines.append(f"     ⚠️  【少数类被总指标掩盖】总召回率看起来不错，但该少数类召回率严重偏低！")
                report_lines.append(f"        → 请算法工程师复核，不要急于归为正常！")
            if record.review_note:
                report_lines.append(f"     复核备注: {record.review_note}")
            if record.fixed_note:
                report_lines.append(f"     修复说明: {record.fixed_note}")

        report_lines.append("")
        report_lines.append("-" * 70)
        report_lines.append("  三种典型场景说明:")
        report_lines.append("  ✅ 顺利记录: 召回率达标，无缺口问题")
        report_lines.append("  🔴 少数类被掩盖: 总指标好看，但少数类实际召回率低，需复核")
        report_lines.append("  📜 旧口径补录: 从特征快照补录，需阈值回放验证")
        report_lines.append("=" * 70)

        return {
            "total_recall": total_recall,
            "masked_count": len(masked_records),
            "need_review_count": len(need_review_records),
            "normal_count": len(normal_records),
            "records": records,
            "report_text": "\n".join(report_lines)
        }
