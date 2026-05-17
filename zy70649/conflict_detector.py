from typing import List, Dict, Set
from datetime import date
from collections import defaultdict
from models import BookingInterval, Conflict
from interval_merger import IntervalMerger


class ConflictDetector:
    def __init__(self):
        self.merger = IntervalMerger()

    def detect_all_conflicts(
        self, intervals: List[BookingInterval]
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []

        conflicts.extend(self.detect_overlapping_bookings(intervals))
        conflicts.extend(self.detect_same_day_checkin_checkout(intervals))
        conflicts.extend(self.detect_gap_discontinuity(intervals))

        return sorted(
            conflicts, key=lambda c: (c.room_id, c.date or date.min)
        )

    def detect_overlapping_bookings(
        self, intervals: List[BookingInterval]
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []

        room_groups = self.merger.group_intervals_by_room(intervals)

        for room_id, room_intervals in room_groups.items():
            sorted_intervals = sorted(room_intervals, key=lambda x: x.checkin_date)

            for i in range(len(sorted_intervals)):
                for j in range(i + 1, len(sorted_intervals)):
                    a = sorted_intervals[i]
                    b = sorted_intervals[j]

                    if a.checkout_date <= b.checkin_date:
                        break

                    if a.overlaps_with(b):
                        overlap_dates = self._get_overlap_dates(a, b)
                        for overlap_date in overlap_dates[:1]:
                            conflicts.append(
                                Conflict(
                                    conflict_type="overlapping_booking",
                                    room_id=room_id,
                                    room_name=a.room_name,
                                    date=overlap_date,
                                    intervals=[a, b],
                                    description=f"日期 {overlap_date} 存在重叠预订: {a.guest_name}({a.platform}) 和 {b.guest_name}({b.platform})",
                                )
                            )

        return conflicts

    def detect_same_day_checkin_checkout(
        self, intervals: List[BookingInterval]
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []

        room_groups = self.merger.group_intervals_by_room(intervals)

        for room_id, room_intervals in room_groups.items():
            checkin_map: Dict[date, List[BookingInterval]] = defaultdict(list)
            checkout_map: Dict[date, List[BookingInterval]] = defaultdict(list)

            for interval in room_intervals:
                checkin_map[interval.checkin_date].append(interval)
                checkout_map[interval.checkout_date].append(interval)

            all_dates = set(checkin_map.keys()) | set(checkout_map.keys())
            for d in sorted(all_dates):
                checkouts = checkout_map.get(d, [])
                checkins = checkin_map.get(d, [])

                if checkouts and checkins:
                    conflicts.append(
                        Conflict(
                            conflict_type="same_day_transition",
                            room_id=room_id,
                            room_name=room_intervals[0].room_name,
                            date=d,
                            intervals=checkouts + checkins,
                            description=f"日期 {d} 存在同日退房和入住: {len(checkouts)}个退房, {len(checkins)}个入住，需确认打扫时间",
                        )
                    )

        return conflicts

    def detect_gap_discontinuity(
        self, intervals: List[BookingInterval]
    ) -> List[Conflict]:
        conflicts: List[Conflict] = []

        room_groups = self.merger.group_intervals_by_room(intervals)

        for room_id, room_intervals in room_groups.items():
            sorted_intervals = sorted(room_intervals, key=lambda x: x.checkin_date)

            for i in range(len(sorted_intervals) - 1):
                current = sorted_intervals[i]
                next_interval = sorted_intervals[i + 1]

                if current.checkout_date < next_interval.checkin_date:
                    gap_days = (next_interval.checkin_date - current.checkout_date).days

                    conflicts.append(
                        Conflict(
                            conflict_type="booking_gap",
                            room_id=room_id,
                            room_name=current.room_name,
                            date=current.checkout_date,
                            intervals=[current, next_interval],
                            description=f"日期 {current.checkout_date} 至 {next_interval.checkin_date} 存在 {gap_days} 天空房缺口",
                        )
                    )

        return conflicts

    def _get_overlap_dates(
        self, a: BookingInterval, b: BookingInterval
    ) -> List[date]:
        overlap_start = max(a.checkin_date, b.checkin_date)
        overlap_end = min(a.checkout_date, b.checkout_date)

        dates: List[date] = []
        d = overlap_start
        while d < overlap_end:
            dates.append(d)
            d = d.replace(day=d.day + 1)

        return dates

    def get_conflict_summary(self, conflicts: List[Conflict]) -> Dict[str, int]:
        summary: Dict[str, int] = defaultdict(int)
        for conflict in conflicts:
            summary[conflict.conflict_type] += 1
            summary["total"] += 1
        return dict(summary)
