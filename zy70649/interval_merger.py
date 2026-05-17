from typing import List, Dict, Tuple
from datetime import date
from collections import defaultdict
from models import BookingInterval


class IntervalMerger:
    def __init__(self):
        pass

    def merge_consecutive_intervals(
        self, intervals: List[BookingInterval]
    ) -> List[BookingInterval]:
        if not intervals:
            return []

        sorted_intervals = sorted(
            intervals, key=lambda x: (x.room_id, x.checkin_date, x.checkout_date)
        )

        room_groups: Dict[str, List[BookingInterval]] = defaultdict(list)
        for interval in sorted_intervals:
            room_groups[interval.room_id].append(interval)

        merged_result: List[BookingInterval] = []

        for room_id, room_intervals in room_groups.items():
            merged_room = self._merge_single_room_intervals(room_intervals)
            merged_result.extend(merged_room)

        return sorted(
            merged_result, key=lambda x: (x.room_id, x.checkin_date, x.checkout_date)
        )

    def _merge_single_room_intervals(
        self, intervals: List[BookingInterval]
    ) -> List[BookingInterval]:
        if len(intervals) <= 1:
            return intervals

        merged: List[BookingInterval] = []
        current: BookingInterval = intervals[0]

        for i in range(1, len(intervals)):
            next_interval = intervals[i]

            if current.can_merge_with(next_interval):
                current = current.merge_with(next_interval)
            else:
                merged.append(current)
                current = next_interval

        merged.append(current)
        return merged

    def find_overlapping_intervals(
        self, intervals: List[BookingInterval]
    ) -> List[Tuple[BookingInterval, BookingInterval]]:
        overlaps: List[Tuple[BookingInterval, BookingInterval]] = []
        sorted_intervals = sorted(
            intervals, key=lambda x: (x.room_id, x.checkin_date)
        )

        for i in range(len(sorted_intervals)):
            for j in range(i + 1, len(sorted_intervals)):
                a = sorted_intervals[i]
                b = sorted_intervals[j]

                if a.room_id != b.room_id:
                    break

                if a.overlaps_with(b):
                    overlaps.append((a, b))
                elif a.checkout_date < b.checkin_date:
                    break

        return overlaps

    def get_room_occupancy_by_date(
        self, intervals: List[BookingInterval], start_date: date, end_date: date
    ) -> Dict[date, Dict[str, List[BookingInterval]]]:
        occupancy: Dict[date, Dict[str, List[BookingInterval]]] = defaultdict(
            lambda: defaultdict(list)
        )

        current_date = start_date
        while current_date <= end_date:
            for interval in intervals:
                if interval.contains_date(current_date):
                    occupancy[current_date][interval.room_id].append(interval)
            current_date = current_date.replace(day=current_date.day + 1)

        return dict(occupancy)

    def group_intervals_by_room(
        self, intervals: List[BookingInterval]
    ) -> Dict[str, List[BookingInterval]]:
        groups: Dict[str, List[BookingInterval]] = defaultdict(list)
        for interval in sorted(
            intervals, key=lambda x: (x.room_id, x.checkin_date, x.checkout_date)
        ):
            groups[interval.room_id].append(interval)
        return dict(groups)

    def get_all_dates(self, intervals: List[BookingInterval]) -> List[date]:
        if not intervals:
            return []

        all_dates = set()
        for interval in intervals:
            d = interval.checkin_date
            while d < interval.checkout_date:
                all_dates.add(d)
                d = d.replace(day=d.day + 1)

        return sorted(all_dates)
