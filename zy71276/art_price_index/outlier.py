from datetime import datetime
from typing import List, Dict, Optional, Tuple
import numpy as np
from collections import defaultdict

from .models import (
    AuctionRecord,
    RecordState,
    Issue,
    IssueType,
    IssueSeverity,
    ProcessingResult,
)


class OutlierDetector:
    def __init__(
        self,
        method: str = "robust",
        iqr_factor: float = 3.0,
        z_score_threshold: float = 3.0,
        percentile_threshold: float = 99.0,
        group_by_artist: bool = True,
        group_by_medium: bool = True,
    ):
        self.method = method
        self.iqr_factor = iqr_factor
        self.z_score_threshold = z_score_threshold
        self.percentile_threshold = percentile_threshold
        self.group_by_artist = group_by_artist
        self.group_by_medium = group_by_medium
        self.outlier_stats: Dict[str, int] = defaultdict(int)
        self.extreme_values_removed = 0

    def _get_valid_prices(
        self, records: List[AuctionRecord]
    ) -> List[Tuple[AuctionRecord, float]]:
        valid = []
        for record in records:
            if record.state in (
                RecordState.CURRENCY_NORMALIZED,
                RecordState.DEDUPLICATED,
            ) and record.usd_price is not None:
                valid.append((record, record.usd_price))
        return valid

    def _detect_by_iqr(
        self, prices: np.ndarray, factor: float = None
    ) -> np.ndarray:
        factor = factor or self.iqr_factor
        q1 = np.percentile(prices, 25)
        q3 = np.percentile(prices, 75)
        iqr = q3 - q1
        lower_bound = q1 - factor * iqr
        upper_bound = q3 + factor * iqr
        return (prices < lower_bound) | (prices > upper_bound)

    def _detect_by_zscore(
        self, prices: np.ndarray, threshold: float = None
    ) -> np.ndarray:
        threshold = threshold or self.z_score_threshold
        median = np.median(prices)
        mad = np.median(np.abs(prices - median))
        if mad == 0:
            mad = np.std(prices)
        modified_z_scores = 0.6745 * (prices - median) / (mad if mad > 0 else 1)
        return np.abs(modified_z_scores) > threshold

    def _detect_by_percentile(
        self, prices: np.ndarray, threshold: float = None
    ) -> np.ndarray:
        threshold = threshold or self.percentile_threshold
        upper_cutoff = np.percentile(prices, threshold)
        lower_cutoff = np.percentile(prices, 100 - threshold)
        return (prices > upper_cutoff) | (prices < lower_cutoff)

    def _detect_robust(
        self, prices: np.ndarray
    ) -> Tuple[np.ndarray, List[str]]:
        reasons = []
        flags_iqr = self._detect_by_iqr(prices)
        flags_zscore = self._detect_by_zscore(prices)
        flags_percentile = self._detect_by_percentile(prices)

        combined_flags = flags_iqr | flags_zscore | flags_percentile

        for i in range(len(prices)):
            reason_parts = []
            if flags_iqr[i]:
                reason_parts.append("IQR范围外")
            if flags_zscore[i]:
                reason_parts.append("Z-score超标")
            if flags_percentile[i]:
                reason_parts.append("百分位极端值")
            reasons.append("; ".join(reason_parts))

        return combined_flags, reasons

    def _group_records(
        self, records: List[AuctionRecord]
    ) -> Dict[str, List[AuctionRecord]]:
        groups: Dict[str, List[AuctionRecord]] = defaultdict(list)

        for record in records:
            key_parts = ["global"]

            if self.group_by_artist and record.artist_name:
                key_parts.append(f"artist:{record.artist_name}")

            if self.group_by_medium and record.medium_name:
                key_parts.append(f"medium:{record.medium_name}")

            for key in key_parts:
                groups[key].append(record)

        return groups

    def _mark_outlier(
        self,
        record: AuctionRecord,
        score: float,
        reason: str,
        group_name: str,
        result: ProcessingResult,
    ) -> None:
        if record.is_outlier:
            return

        record.is_outlier = True
        record.outlier_score = score
        record.state = RecordState.OUTLIER_CHECKED

        issue = Issue(
            issue_type=IssueType.EXTREME_VALUE,
            severity=IssueSeverity.WARNING,
            message=f"检测到极端价格 (分组: {group_name}): {reason}",
            field="usd_price",
            impact=f"该记录价格(${record.usd_price:,.0f})偏离正常范围，已排除以避免指数失真",
            suggestion="可单独分析该拍品或调整异常检测阈值",
            affected_records=1,
        )
        record.add_issue(issue)
        result.issues.append(issue)
        self.outlier_stats[group_name] += 1
        self.extreme_values_removed += 1

    def detect_outliers(self, result: ProcessingResult) -> ProcessingResult:
        self.outlier_stats.clear()
        self.extreme_values_removed = 0

        valid_records = [
            r
            for r in result.records
            if r.state
            in (
                RecordState.CURRENCY_NORMALIZED,
                RecordState.DEDUPLICATED,
            )
            and r.usd_price is not None
            and r.duplicate_of is None
        ]

        if len(valid_records) < 10:
            issue = Issue(
                issue_type=IssueType.OUTLIER,
                severity=IssueSeverity.INFO,
                message=f"有效记录不足({len(valid_records)})，跳过异常值检测",
                field="record_count",
                impact="极端值可能影响指数准确性",
                suggestion="增加更多数据以提高统计可靠性",
                affected_records=len(valid_records),
            )
            result.issues.append(issue)
            return result

        groups = self._group_records(valid_records)

        for group_name, group_records in groups.items():
            if len(group_records) < 5:
                continue

            price_data = np.array([r.usd_price for r in group_records])
            log_prices = np.log1p(price_data)

            if self.method == "iqr":
                flags = self._detect_by_iqr(log_prices)
                reasons = ["IQR范围外" if f else "" for f in flags]
            elif self.method == "zscore":
                flags = self._detect_by_zscore(log_prices)
                reasons = ["Z-score超标" if f else "" for f in flags]
            elif self.method == "percentile":
                flags = self._detect_by_percentile(log_prices)
                reasons = ["百分位极端值" if f else "" for f in flags]
            else:
                flags, reasons = self._detect_robust(log_prices)

            for i, (record, is_outlier) in enumerate(zip(group_records, flags)):
                if is_outlier:
                    median_price = np.median(price_data)
                    deviation_ratio = (
                        record.usd_price / median_price if median_price > 0 else 0
                    )
                    self._mark_outlier(
                        record, deviation_ratio, reasons[i], group_name, result
                    )

        for record in result.records:
            if (
                record.state
                in (
                    RecordState.CURRENCY_NORMALIZED,
                    RecordState.DEDUPLICATED,
                )
                and not record.is_outlier
                and record.duplicate_of is None
            ):
                record.state = RecordState.OUTLIER_CHECKED

        result.records_by_state = {}
        for record in result.records:
            state = record.state.value
            result.records_by_state[state] = result.records_by_state.get(state, 0) + 1

        result.completed_at = datetime.now()
        return result

    def get_outlier_summary(self) -> Dict:
        return {
            "total_extreme_values_removed": self.extreme_values_removed,
            "detection_method": self.method,
            "outliers_by_group": dict(self.outlier_stats),
            "group_by_artist": self.group_by_artist,
            "group_by_medium": self.group_by_medium,
            "iqr_factor": self.iqr_factor,
            "z_score_threshold": self.z_score_threshold,
            "percentile_threshold": self.percentile_threshold,
        }
