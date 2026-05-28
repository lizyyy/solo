from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from collections import defaultdict
import numpy as np

from .models import (
    AuctionRecord,
    RecordState,
    IndexPoint,
    ProcessingResult,
)


class PriceIndexCalculator:
    def __init__(
        self,
        period: str = "monthly",
        base_period: Optional[str] = None,
        method: str = "robust_hedonic",
        min_records_per_period: int = 5,
    ):
        self.period = period
        self.base_period = base_period
        self.method = method
        self.min_records_per_period = min_records_per_period
        self.index_series: List[IndexPoint] = []

    def _get_period_key(self, date: datetime) -> str:
        if self.period == "yearly":
            return f"{date.year}"
        elif self.period == "quarterly":
            quarter = (date.month - 1) // 3 + 1
            return f"{date.year}Q{quarter}"
        elif self.period == "monthly":
            return f"{date.year}-{date.month:02d}"
        elif self.period == "weekly":
            week = date.isocalendar()[1]
            return f"{date.year}-W{week:02d}"
        else:
            return f"{date.year}-{date.month:02d}"

    def _get_period_bounds(self, period_key: str) -> Tuple[datetime, datetime]:
        if self.period == "yearly":
            year = int(period_key)
            return (datetime(year, 1, 1), datetime(year, 12, 31))
        elif self.period == "quarterly":
            year = int(period_key[:4])
            quarter = int(period_key[-1])
            start_month = (quarter - 1) * 3 + 1
            end_month = start_month + 2
            start = datetime(year, start_month, 1)
            if end_month == 12:
                end = datetime(year, 12, 31)
            else:
                end = datetime(year, end_month + 1, 1) - timedelta(days=1)
            return (start, end)
        elif self.period == "monthly":
            year, month = map(int, period_key.split("-"))
            if month == 12:
                next_month = datetime(year + 1, 1, 1)
            else:
                next_month = datetime(year, month + 1, 1)
            return (datetime(year, month, 1), next_month - timedelta(days=1))
        else:
            year, week = map(int, period_key.split("-W"))
            start = datetime.fromisocalendar(year, week, 1)
            end = datetime.fromisocalendar(year, week, 7)
            return (start, end)

    def _group_records_by_period(
        self, records: List[AuctionRecord]
    ) -> Dict[str, List[AuctionRecord]]:
        groups: Dict[str, List[AuctionRecord]] = defaultdict(list)
        for record in records:
            if (
                record.state == RecordState.OUTLIER_CHECKED
                and record.usd_price is not None
                and record.auction_date is not None
                and not record.is_outlier
                and record.duplicate_of is None
            ):
                period_key = self._get_period_key(record.auction_date)
                groups[period_key].append(record)
        return groups

    def _calculate_robust_location(
        self, prices: np.ndarray
    ) -> Tuple[float, float, float, float]:
        log_prices = np.log(prices)
        median_log = np.median(log_prices)
        mad_log = np.median(np.abs(log_prices - median_log))
        if mad_log == 0:
            mad_log = np.std(log_prices) or 1

        weights = np.ones_like(log_prices)
        threshold = 2 * 0.6745 * mad_log
        for i in range(3):
            residuals = np.abs(log_prices - median_log)
            weights = np.where(
                residuals <= threshold,
                1 - (residuals / threshold) ** 2,
                0,
            )
            weights = weights**2
            if weights.sum() > 0:
                median_log = np.average(log_prices, weights=weights)

        robust_mean = np.exp(median_log)
        median_price = np.median(prices)
        mean_price = np.mean(prices)
        std_price = np.std(prices)

        return robust_mean, median_price, mean_price, std_price

    def _calculate_artist_medium_features(
        self, records: List[AuctionRecord]
    ) -> Dict[str, float]:
        artist_prices: Dict[str, List[float]] = defaultdict(list)
        medium_prices: Dict[str, List[float]] = defaultdict(list)

        for record in records:
            if record.usd_price and record.artist_name:
                artist_prices[record.artist_name].append(record.usd_price)
            if record.usd_price and record.medium_name:
                medium_prices[record.medium_name].append(record.usd_price)

        artist_medians = {
            artist: np.median(prices) for artist, prices in artist_prices.items()
        }
        medium_medians = {
            medium: np.median(prices) for medium, prices in medium_prices.items()
        }

        return {
            "artist_medians": artist_medians,
            "medium_medians": medium_medians,
        }

    def _normalize_by_characteristics(
        self,
        records: List[AuctionRecord],
        features: Dict[str, float],
    ) -> List[float]:
        normalized_prices = []
        overall_median = np.median([r.usd_price for r in records if r.usd_price])

        artist_medians = features.get("artist_medians", {})
        medium_medians = features.get("medium_medians", {})

        for record in records:
            if not record.usd_price:
                continue

            factor = 1.0
            if record.artist_name and record.artist_name in artist_medians:
                artist_factor = artist_medians[record.artist_name] / overall_median
                factor *= artist_factor
            if record.medium_name and record.medium_name in medium_medians:
                medium_factor = medium_medians[record.medium_name] / overall_median
                factor *= medium_factor

            normalized = record.usd_price / max(factor, 0.1)
            normalized_prices.append(normalized)

        return normalized_prices

    def calculate_index(
        self, result: ProcessingResult
    ) -> ProcessingResult:
        self.index_series = []

        valid_records = [
            r
            for r in result.records
            if r.state == RecordState.OUTLIER_CHECKED
            and r.usd_price is not None
            and r.auction_date is not None
            and not r.is_outlier
            and r.duplicate_of is None
        ]

        if len(valid_records) < self.min_records_per_period:
            return result

        features = self._calculate_artist_medium_features(valid_records)

        period_groups = self._group_records_by_period(valid_records)
        sorted_periods = sorted(period_groups.keys())

        if not sorted_periods:
            return result

        base_period = self.base_period or sorted_periods[0]
        if base_period not in period_groups:
            base_period = sorted_periods[0]

        base_records = period_groups[base_period]
        base_prices = self._normalize_by_characteristics(base_records, features)
        if not base_prices:
            return result

        base_value, _, _, _ = self._calculate_robust_location(np.array(base_prices))

        for period_key in sorted_periods:
            period_records = period_groups[period_key]

            if len(period_records) < self.min_records_per_period:
                continue

            normalized_prices = self._normalize_by_characteristics(
                period_records, features
            )
            if not normalized_prices:
                continue

            prices_array = np.array(normalized_prices)
            robust_mean, median_price, mean_price, std_price = (
                self._calculate_robust_location(prices_array)
            )

            index_value = (robust_mean / base_value) * 100 if base_value > 0 else 100

            period_start, period_end = self._get_period_bounds(period_key)

            artists_in_period = {r.artist_name for r in period_records if r.artist_name}
            media_in_period = {r.medium_name for r in period_records if r.medium_name}

            index_point = IndexPoint(
                period=period_key,
                period_start=period_start,
                period_end=period_end,
                index_value=round(index_value, 2),
                record_count=len(period_records),
                median_price=round(median_price, 2),
                mean_price=round(mean_price, 2),
                std_price=round(std_price, 2),
                artist_count=len(artists_in_period),
                medium_count=len(media_in_period),
            )

            self.index_series.append(index_point)

            for record in period_records:
                record.index_value = index_value
                record.state = RecordState.INDEX_CALCULATED

        result.index_series = self.index_series

        result.records_by_state = {}
        for record in result.records:
            state = record.state.value
            result.records_by_state[state] = result.records_by_state.get(state, 0) + 1

        result.completed_at = datetime.now()
        return result

    def get_index_summary(self) -> Dict:
        if not self.index_series:
            return {}

        values = [p.index_value for p in self.index_series]
        returns = []
        for i in range(1, len(values)):
            if values[i - 1] > 0:
                returns.append((values[i] - values[i - 1]) / values[i - 1] * 100)

        return {
            "periodicity": self.period,
            "method": self.method,
            "periods_count": len(self.index_series),
            "base_period": self.index_series[0].period if self.index_series else None,
            "current_value": values[-1] if values else None,
            "min_value": min(values) if values else None,
            "max_value": max(values) if values else None,
            "avg_return": np.mean(returns) if returns else None,
            "volatility": np.std(returns) if returns else None,
        }
