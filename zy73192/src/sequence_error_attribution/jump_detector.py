import math
import numpy as np
from typing import List, Tuple, Optional
from collections import defaultdict

from .config import DEFAULT_CONFIG, STABLE_MESSAGES, AttributionConfig
from .models import QuestionRecord


class JumpDetector:
    """结果跳变检测器，区分阈值、单位和正常记录三种原因"""

    def __init__(self, config: AttributionConfig = DEFAULT_CONFIG):
        self.config = config
        self.threshold_ratio = config.jump_threshold_ratio
        self.magnitude_threshold = config.unit_magnitude_threshold

    def _get_magnitude(self, value: float) -> int:
        """获取数值的数量级"""
        if value == 0 or math.isnan(value) or math.isinf(value):
            return 0
        return int(math.floor(math.log10(abs(value))))

    def _calculate_statistics(self, values: List[float]) -> Tuple[float, float, float, float]:
        """计算统计量：均值、标准差、最小值、最大值"""
        valid_values = [v for v in values if not math.isnan(v) and not math.isinf(v)]
        if not valid_values:
            return 0.0, 0.0, 0.0, 0.0

        arr = np.array(valid_values)
        mean = float(np.mean(arr))
        std = float(np.std(arr)) if len(arr) > 1 else 0.0
        min_val = float(np.min(arr))
        max_val = float(np.max(arr))

        return mean, std, min_val, max_val

    def _detect_threshold_jump(
        self,
        record: QuestionRecord,
        all_means: List[float],
        all_stds: List[float],
        record_mean: float
    ) -> Tuple[bool, str, float]:
        """
        检测阈值触发的跳变
        判断依据：单条记录的均值偏离整体中位数超过 threshold_ratio 倍MAD
        使用中位数和MAD（中位数绝对偏差）更鲁棒，不受异常值影响
        """
        valid_means = [m for m in all_means if not math.isnan(m) and not math.isinf(m)]
        valid_stds = [s for s in all_stds if not math.isnan(s) and not math.isinf(s)]

        if len(valid_means) < 3:
            return False, "", 0.0

        overall_median = float(np.median(valid_means))
        mad = float(np.median([abs(m - overall_median) for m in valid_means]))

        if mad == 0:
            overall_std = float(np.mean(valid_stds)) if valid_stds else 0
            if overall_std == 0:
                return False, "", 0.0
            scale = overall_std
        else:
            scale = mad * 1.4826

        deviation = abs(record_mean - overall_median)
        deviation_ratio = deviation / scale if scale != 0 else 0

        if deviation_ratio > self.threshold_ratio:
            return True, STABLE_MESSAGES.JUMP_REASON_THRESHOLD, deviation_ratio

        return False, "", deviation_ratio

    def _detect_unit_jump(
        self,
        record: QuestionRecord,
        all_magnitudes: List[int],
        record_magnitudes: List[int]
    ) -> Tuple[bool, str, int]:
        """
        检测单位异常导致的跳变
        判断依据：数量级差异超过 magnitude_threshold
        """
        if not all_magnitudes or not record_magnitudes:
            return False, "", 0

        magnitude_counts = defaultdict(int)
        for m in all_magnitudes:
            magnitude_counts[m] += 1

        if not magnitude_counts:
            return False, "", 0

        most_common_mag = max(magnitude_counts.items(), key=lambda x: x[1])[0]

        for rec_mag in record_magnitudes:
            mag_diff = abs(rec_mag - most_common_mag)
            if mag_diff >= self.magnitude_threshold:
                return True, STABLE_MESSAGES.JUMP_REASON_UNIT, mag_diff

        return False, "", 0

    def _detect_normal_jump(
        self,
        record: QuestionRecord,
        all_error_categories: List[str]
    ) -> Tuple[bool, str]:
        """
        检测正常记录导致的跳变
        判断依据：该错误类型本身就容易产生较大数值，属于数据本身特征
        """
        large_value_categories = [
            "递推公式应用错误",
            "计算错误",
            "除零边界错误",
        ]

        if record.error_category in large_value_categories:
            return True, STABLE_MESSAGES.JUMP_REASON_NORMAL

        if len(record.calculated_terms) >= 3:
            valid_terms = [t for t in record.calculated_terms if not math.isnan(t) and not math.isinf(t)]
            if len(valid_terms) >= 3:
                diffs = [abs(valid_terms[i+1] - valid_terms[i]) for i in range(len(valid_terms)-1)]
                if diffs and max(diffs) > 0 and min(diffs) > 0:
                    if max(diffs) > min(diffs) * 10:
                        return True, STABLE_MESSAGES.JUMP_REASON_NORMAL

        if len(record.original_terms) >= 3:
            valid_terms = [t for t in record.original_terms if not math.isnan(t) and not math.isinf(t)]
            if len(valid_terms) >= 3:
                diffs = [abs(valid_terms[i+1] - valid_terms[i]) for i in range(len(valid_terms)-1)]
                if diffs and max(diffs) > 0 and min(diffs) > 0:
                    if max(diffs) > min(diffs) * 10:
                        return True, STABLE_MESSAGES.JUMP_REASON_NORMAL

        return False, ""

    def detect_jump(
        self,
        record: QuestionRecord,
        all_records: List[QuestionRecord]
    ) -> Tuple[bool, str, float]:
        """
        检测单条记录是否存在结果跳变
        返回: (是否跳变, 跳变原因, 跳变幅度)
        """
        if not record.original_terms and not record.calculated_terms:
            return False, "", 0.0

        record_terms = record.calculated_terms if record.calculated_terms else record.original_terms
        record_terms = [t for t in record_terms if not math.isnan(t) and not math.isinf(t)]

        if not record_terms:
            return False, "", 0.0

        record_mean, record_std, _, _ = self._calculate_statistics(record_terms)
        record_magnitudes = [self._get_magnitude(t) for t in record_terms]

        all_means = []
        all_stds = []
        all_magnitudes = []
        all_error_categories = []

        for r in all_records:
            if r is record:
                continue
            terms = r.calculated_terms if r.calculated_terms else r.original_terms
            terms = [t for t in terms if not math.isnan(t) and not math.isinf(t)]
            if terms:
                mean, std, _, _ = self._calculate_statistics(terms)
                all_means.append(mean)
                all_stds.append(std)
                all_magnitudes.extend([self._get_magnitude(t) for t in terms])
            if r.error_category:
                all_error_categories.append(r.error_category)

        is_normal, normal_reason = self._detect_normal_jump(record, all_error_categories)
        if is_normal:
            return True, normal_reason, 0.0

        is_unit, unit_reason, unit_diff = self._detect_unit_jump(
            record, all_magnitudes, record_magnitudes
        )
        if is_unit:
            return True, unit_reason, float(unit_diff)

        if len(all_means) >= 3:
            is_threshold, threshold_reason, threshold_ratio = self._detect_threshold_jump(
                record, all_means, all_stds, record_mean
            )
            if is_threshold:
                return True, threshold_reason, threshold_ratio

        return False, "", 0.0

    def detect_batch(self, records: List[QuestionRecord]) -> List[QuestionRecord]:
        """批量检测跳变"""
        for record in records:
            if record.processing_status == STABLE_MESSAGES.STATUS_FAILED:
                continue

            has_jump, reason, magnitude = self.detect_jump(record, records)

            if has_jump:
                record.jump_detected = True
                record.jump_reason = reason
                record.add_log(f"检测到结果跳变: {reason} (幅度: {magnitude:.2f})")

        return records
