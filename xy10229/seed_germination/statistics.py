from datetime import date, timedelta
from typing import Dict, List, Tuple, Optional
from .models import (
    ExperimentGroup, DailyRecord, RecordStatus, RecordType,
    GerminationStats
)


class StatisticsCalculator:
    def __init__(
        self, groups: Dict[str, ExperimentGroup], records: List[DailyRecord]
    ):
        self.groups = groups
        self.records = records
        self.group_records: Dict[str, List[DailyRecord]] = {}
        self._organize_records()

    def _organize_records(self):
        for record in self.records:
            if record.status == RecordStatus.INVALID:
                continue
            if record.group_id not in self.group_records:
                self.group_records[record.group_id] = []
            self.group_records[record.group_id].append(record)

    def calculate_all(self) -> Dict[str, GerminationStats]:
        results = {}
        for group_id, group in self.groups.items():
            stats = self._calculate_group(group)
            if stats:
                results[group_id] = stats
        return results

    def _calculate_group(
        self, group: ExperimentGroup
    ) -> Optional[GerminationStats]:
        records = self.group_records.get(group.group_id, [])
        if not records:
            return None

        effective_records = self._select_effective_records(records)
        sorted_dates = sorted(effective_records.keys())
        
        if not sorted_dates:
            return None

        daily_rates: Dict[date, float] = {}
        cumulative_rates: Dict[date, float] = {}
        cumulative_counts: Dict[date, int] = {}
        
        total_seeds = group.total_seeds
        if total_seeds <= 0:
            if effective_records:
                total_seeds = max(
                    r.total_seeds for r in [recs[0] for recs in effective_records.values()]
                )
            if total_seeds <= 0:
                return None

        prev_count = 0
        for exp_date in sorted_dates:
            daily_records = effective_records[exp_date]
            daily_total = max(r.germinated_count for r in daily_records)
            daily_new = max(0, daily_total - prev_count)
            
            daily_rate = (daily_new / total_seeds) * 100 if total_seeds > 0 else 0
            cumulative_rate = (daily_total / total_seeds) * 100 if total_seeds > 0 else 0
            
            daily_rates[exp_date] = daily_rate
            cumulative_rates[exp_date] = cumulative_rate
            cumulative_counts[exp_date] = daily_total
            
            prev_count = daily_total

        final_date = sorted_dates[-1]
        total_germinated = cumulative_counts[final_date]
        germination_rate = (total_germinated / total_seeds) * 100 if total_seeds > 0 else 0

        mean_germination_days = self._calculate_mean_germination_days(
            sorted_dates, cumulative_counts, total_germinated
        )
        germination_speed_index = self._calculate_germination_speed_index(
            sorted_dates, daily_rates
        )

        valid_days, missing_days, backfilled_days = self._count_record_statuses(
            group, sorted_dates, records
        )

        return GerminationStats(
            group_id=group.group_id,
            total_seeds=total_seeds,
            total_germinated=total_germinated,
            germination_rate=germination_rate,
            final_date=final_date,
            mean_germination_days=mean_germination_days,
            germination_speed_index=germination_speed_index,
            daily_rates=daily_rates,
            cumulative_rates=cumulative_rates,
            valid_days=valid_days,
            missing_days=missing_days,
            backfilled_days=backfilled_days
        )

    def _select_effective_records(
        self, records: List[DailyRecord]
    ) -> Dict[date, List[DailyRecord]]:
        by_date: Dict[date, List[DailyRecord]] = {}
        
        for record in records:
            if record.status in (RecordStatus.INVALID, RecordStatus.DUPLICATE):
                continue
            
            exp_date = record.experiment_date
            if exp_date not in by_date:
                by_date[exp_date] = []
            by_date[exp_date].append(record)
        
        result: Dict[date, List[DailyRecord]] = {}
        for exp_date, daily_records in by_date.items():
            daily_records = sorted(
                daily_records,
                key=lambda r: (
                    0 if r.record_type == RecordType.BACKFILL else 1,
                    r.germinated_count
                ),
                reverse=True
            )
            result[exp_date] = daily_records
        
        return result

    def _calculate_mean_germination_days(
        self, sorted_dates: List[date], cumulative_counts: Dict[date, int],
        total_germinated: int
    ) -> float:
        if total_germinated <= 0 or len(sorted_dates) < 2:
            return 0.0

        start_date = sorted_dates[0]
        weighted_sum = 0.0
        seeds_processed = 0
        
        prev_count = 0
        for exp_date in sorted_dates:
            current_count = cumulative_counts[exp_date]
            new_seeds = current_count - prev_count
            
            if new_seeds > 0:
                days_elapsed = (exp_date - start_date).days
                weighted_sum += new_seeds * days_elapsed
                seeds_processed += new_seeds
            
            prev_count = current_count
        
        if seeds_processed > 0:
            return weighted_sum / seeds_processed
        return 0.0

    def _calculate_germination_speed_index(
        self, sorted_dates: List[date], daily_rates: Dict[date, float]
    ) -> float:
        if not sorted_dates:
            return 0.0

        start_date = sorted_dates[0]
        gsi = 0.0
        
        for exp_date in sorted_dates:
            days_elapsed = (exp_date - start_date).days + 1
            gsi += daily_rates[exp_date] / days_elapsed
        
        return gsi

    def _count_record_statuses(
        self, group: ExperimentGroup, sorted_dates: List[date],
        all_records: List[DailyRecord]
    ) -> Tuple[int, int, int]:
        if not sorted_dates:
            return 0, 0, 0

        start_date = group.start_date or sorted_dates[0]
        end_date = group.end_date or sorted_dates[-1]
        
        recorded_dates = set(sorted_dates)
        
        total_days = 0
        current = start_date
        while current <= end_date:
            total_days += 1
            current += timedelta(days=1)
        
        backfilled_days = len(set(
            r.experiment_date for r in all_records
            if r.record_type == RecordType.BACKFILL
            and r.status != RecordStatus.INVALID
            and r.status != RecordStatus.DUPLICATE
        ))
        
        valid_days = len(recorded_dates)
        missing_days = total_days - valid_days
        
        return valid_days, missing_days, backfilled_days
