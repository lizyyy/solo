from typing import List, Optional, Dict
from collections import defaultdict
from datetime import timedelta
from .models import (
    FuelRecord,
    MileageRecord,
    ScheduleRecord,
    Vehicle,
    MatchedResult,
    ReviewNote,
    AbnormalType,
)


class Matcher:
    def __init__(
        self,
        fuel_records: List[FuelRecord],
        mileage_records: List[MileageRecord],
        schedule_records: List[ScheduleRecord],
        vehicles: List[Vehicle],
        review_notes: List[ReviewNote] = None,
        fuel_threshold_multiplier: float = 1.3,
    ):
        self.fuel_records = sorted(fuel_records, key=lambda x: (x.plate_number, x.fuel_time))
        self.mileage_records = sorted(mileage_records, key=lambda x: (x.plate_number, x.record_time))
        self.schedule_records = schedule_records
        self.vehicles = {v.plate_number: v for v in vehicles}
        self.review_notes = review_notes or []
        self.fuel_threshold_multiplier = fuel_threshold_multiplier

        self._mileage_by_plate: Dict[str, List[MileageRecord]] = defaultdict(list)
        for m in self.mileage_records:
            self._mileage_by_plate[m.plate_number].append(m)

        self._schedule_by_plate: Dict[str, List[ScheduleRecord]] = defaultdict(list)
        for s in self.schedule_records:
            self._schedule_by_plate[s.plate_number].append(s)

        self._review_by_fuel: Dict[str, ReviewNote] = {}
        for rn in self.review_notes:
            self._review_by_fuel[rn.fuel_record_id] = rn

    def match_all(self) -> List[MatchedResult]:
        results = []
        duplicates = self._find_duplicates()

        for fuel in self.fuel_records:
            result = self._match_single(fuel, duplicates)
            results.append(result)
        return results

    def _match_single(self, fuel: FuelRecord, duplicates: set) -> MatchedResult:
        abnormal_types: List[AbnormalType] = []

        if fuel.id in duplicates:
            abnormal_types.append(AbnormalType.DUPLICATE)

        schedule = self._find_matching_schedule(fuel)
        if schedule is None:
            abnormal_types.append(AbnormalType.OUT_OF_SCHEDULE)

        prev_mileage, next_mileage = self._find_neighboring_mileages(fuel)
        calculated_distance = None
        calculated_fuel_consumption = None

        if prev_mileage is None and next_mileage is None:
            abnormal_types.append(AbnormalType.MISSING_MILEAGE)
        else:
            if prev_mileage and next_mileage:
                calculated_distance = next_mileage.odometer - prev_mileage.odometer
                if calculated_distance < 0:
                    abnormal_types.append(AbnormalType.MILEAGE_BACKWARD)
                    calculated_distance = None

                if calculated_distance and calculated_distance > 0:
                    vehicle = self.vehicles.get(fuel.plate_number)
                    if vehicle:
                        calculated_fuel_consumption = (fuel.fuel_liters / calculated_distance) * 100
                        threshold = vehicle.standard_fuel_consumption * self.fuel_threshold_multiplier
                        if calculated_fuel_consumption > threshold:
                            abnormal_types.append(AbnormalType.FUEL_EXCEED)

            if prev_mileage and fuel.odometer is not None:
                if fuel.odometer < prev_mileage.odometer:
                    abnormal_types.append(AbnormalType.MILEAGE_BACKWARD)
            if next_mileage and fuel.odometer is not None:
                if fuel.odometer > next_mileage.odometer:
                    abnormal_types.append(AbnormalType.MILEAGE_BACKWARD)

        if schedule is None and len(abnormal_types) > 0 and fuel.fuel_amount > 200:
            abnormal_types.append(AbnormalType.SUSPICIOUS_PRIVATE)

        if not abnormal_types:
            abnormal_types.append(AbnormalType.NORMAL)

        is_normal = AbnormalType.NORMAL in abnormal_types and len(abnormal_types) == 1

        driver_name = schedule.driver_name if schedule else None
        review_note = self._review_by_fuel.get(fuel.id)

        return MatchedResult(
            fuel_record=fuel,
            schedule=schedule,
            previous_mileage=prev_mileage,
            next_mileage=next_mileage,
            calculated_distance=calculated_distance,
            calculated_fuel_consumption=calculated_fuel_consumption,
            abnormal_types=abnormal_types,
            is_normal=is_normal,
            driver_name=driver_name,
            review_note=review_note,
        )

    def _find_matching_schedule(self, fuel: FuelRecord) -> Optional[ScheduleRecord]:
        plate_schedules = self._schedule_by_plate.get(fuel.plate_number, [])
        for sched in plate_schedules:
            if sched.start_time <= fuel.fuel_time <= sched.end_time:
                return sched
            if sched.start_time - timedelta(hours=1) <= fuel.fuel_time <= sched.end_time + timedelta(hours=1):
                return sched
        return None

    def _find_neighboring_mileages(self, fuel: FuelRecord) -> (Optional[MileageRecord], Optional[MileageRecord]):
        plate_mileages = self._mileage_by_plate.get(fuel.plate_number, [])
        if not plate_mileages:
            return None, None

        prev_mileage = None
        next_mileage = None

        for m in plate_mileages:
            if m.record_time <= fuel.fuel_time:
                if prev_mileage is None or m.record_time > prev_mileage.record_time:
                    prev_mileage = m
            elif m.record_time > fuel.fuel_time:
                if next_mileage is None or m.record_time < next_mileage.record_time:
                    next_mileage = m

        return prev_mileage, next_mileage

    def _find_duplicates(self) -> set:
        key_groups: Dict[str, List[FuelRecord]] = defaultdict(list)
        for fuel in self.fuel_records:
            key = (
                fuel.plate_number,
                fuel.fuel_time.strftime("%Y-%m-%d %H:%M"),
                round(fuel.fuel_amount, 2),
                round(fuel.fuel_liters, 2),
            )
            key_str = str(key)
            key_groups[key_str].append(fuel)

        duplicate_ids = set()
        for group in key_groups.values():
            if len(group) > 1:
                for g in group[1:]:
                    duplicate_ids.add(g.id)
        return duplicate_ids
