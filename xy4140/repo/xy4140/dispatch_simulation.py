from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass
import math
import heapq
from itertools import permutations

from models import (
    ElderlyPerson,
    CoolingStation,
    HeatForecast,
    TravelTime,
    StationCongestion,
    CoverageGap,
    VisitSchedule,
    RiskLevel,
)
from config import RISK_CONFIG, TIME_SLOTS


@dataclass
class CoverageResult:
    covered_count: int
    uncovered_count: int
    coverage_ratio: float
    by_community: Dict[str, Dict[str, int]]


@dataclass
class StationAssignment:
    elderly_id: str
    station_id: str
    walking_time: int
    bus_time: int
    distance_km: float
    assignment_reason: str


class CoverageAnalyzer:
    def __init__(
        self,
        walking_threshold: int = 15,
        bus_threshold: int = 30,
    ):
        self.walking_threshold = walking_threshold
        self.bus_threshold = bus_threshold

    def calculate_distance_km(
        self,
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float,
    ) -> float:
        lat_diff = (lat2 - lat1) * 111.0
        lon_diff = (lon2 - lon1) * 111.0 * math.cos(math.radians(lat1))
        return math.sqrt(lat_diff**2 + lon_diff**2)

    def estimate_travel_time(
        self,
        distance_km: float,
        mobility: str = "正常",
    ) -> Tuple[int, int]:
        walking_speed = 4.0
        if mobility == "行动不便":
            walking_speed = 2.5
        elif mobility == "轮椅":
            walking_speed = 3.0
        elif mobility == "卧床":
            walking_speed = 1.0

        walking_minutes = int((distance_km / walking_speed) * 60)
        bus_speed = 15.0
        bus_minutes = int((distance_km / bus_speed) * 60) + 10

        return walking_minutes, bus_minutes

    def find_nearest_station(
        self,
        person: ElderlyPerson,
        stations: List[CoolingStation],
    ) -> Tuple[Optional[CoolingStation], float, int, int]:
        nearest_station = None
        min_distance = float("inf")
        best_walking_time = 0
        best_bus_time = 0

        for station in stations:
            if station.status != "开放" and not station.is_locked:
                continue
            if station.available_spots <= 0:
                continue

            distance = self.calculate_distance_km(
                person.latitude, person.longitude,
                station.latitude, station.longitude,
            )

            walking_time, bus_time = self.estimate_travel_time(
                distance, person.mobility
            )

            if distance < min_distance:
                min_distance = distance
                nearest_station = station
                best_walking_time = walking_time
                best_bus_time = bus_time

        return nearest_station, min_distance, best_walking_time, best_bus_time

    def check_coverage(
        self,
        person: ElderlyPerson,
        stations: List[CoolingStation],
    ) -> Tuple[bool, str, Optional[Dict]]:
        nearest_station, distance, walking_time, bus_time = self.find_nearest_station(
            person, stations
        )

        if not nearest_station:
            return False, "无可用站点", None

        coverage_details = {
            "station_id": nearest_station.id,
            "station_name": nearest_station.name,
            "distance_km": round(distance, 2),
            "walking_minutes": walking_time,
            "bus_minutes": bus_time,
        }

        if walking_time <= self.walking_threshold:
            return True, "步行可达", coverage_details
        elif bus_time <= self.bus_threshold:
            return True, "公交可达", coverage_details
        else:
            return False, "距离过远", coverage_details

    def analyze_coverage(
        self,
        persons: List[ElderlyPerson],
        stations: List[CoolingStation],
    ) -> CoverageResult:
        covered_count = 0
        uncovered_count = 0
        by_community: Dict[str, Dict[str, int]] = {}

        for person in persons:
            is_covered, _, _ = self.check_coverage(person, stations)

            community = person.community
            if community not in by_community:
                by_community[community] = {"covered": 0, "uncovered": 0}

            if is_covered:
                covered_count += 1
                by_community[community]["covered"] += 1
            else:
                uncovered_count += 1
                by_community[community]["uncovered"] += 1

        total = covered_count + uncovered_count
        coverage_ratio = covered_count / total if total > 0 else 0.0

        return CoverageResult(
            covered_count=covered_count,
            uncovered_count=uncovered_count,
            coverage_ratio=coverage_ratio,
            by_community=by_community,
        )

    def identify_coverage_gaps(
        self,
        persons: List[ElderlyPerson],
        stations: List[CoolingStation],
    ) -> List[CoverageGap]:
        from collections import defaultdict

        community_uncovered = defaultdict(lambda: {
            "persons": [],
            "high_risk_count": 0,
            "nearest_station_dist": float("inf"),
        })

        for person in persons:
            is_covered, _, details = self.check_coverage(person, stations)

            if not is_covered:
                community = person.community
                community_uncovered[community]["persons"].append(person)

                if person.risk_level in [RiskLevel.HIGH.value, RiskLevel.CRITICAL.value]:
                    community_uncovered[community]["high_risk_count"] += 1

                if details and details["distance_km"] < community_uncovered[community]["nearest_station_dist"]:
                    community_uncovered[community]["nearest_station_dist"] = details["distance_km"]

        gaps = []
        for community, data in community_uncovered.items():
            if data["persons"]:
                sample_person = data["persons"][0]

                high_risk_ratio = data["high_risk_count"] / len(data["persons"])
                if high_risk_ratio >= 0.5 or data["high_risk_count"] >= 3:
                    severity = "严重"
                elif high_risk_ratio >= 0.3:
                    severity = "中等"
                else:
                    severity = "一般"

                gaps.append(CoverageGap(
                    area_name=community,
                    district=sample_person.district,
                    uncovered_elderly_count=len(data["persons"]),
                    high_risk_count=data["high_risk_count"],
                    nearest_station_distance=round(data["nearest_station_dist"], 2),
                    gap_severity=severity,
                ))

        return sorted(gaps, key=lambda x: x.high_risk_count, reverse=True)


class CongestionAnalyzer:
    def __init__(
        self,
        peak_hours: List[int] = None,
        heat_threshold: float = 35.0,
    ):
        self.peak_hours = peak_hours or [10, 11, 12, 13, 14, 15, 16]
        self.heat_threshold = heat_threshold

    def estimate_hourly_demand(
        self,
        persons: List[ElderlyPerson],
        stations: List[CoolingStation],
        heat_forecast: Optional[HeatForecast] = None,
    ) -> Dict[str, List[StationCongestion]]:
        station_congestions: Dict[str, List[StationCongestion]] = {}

        for station in stations:
            station_congestions[station.id] = []

            for hour in range(6, 22):
                heat_factor = 1.0
                if heat_forecast:
                    hourly_data = next(
                        (hf for hf in heat_forecast.hourly_forecasts if hf.hour == hour),
                        None,
                    )
                    if hourly_data:
                        if hourly_data.feels_like >= 38:
                            heat_factor = 1.5
                        elif hourly_data.feels_like >= 35:
                            heat_factor = 1.2

                time_factor = 1.0
                if hour in self.peak_hours:
                    time_factor = 1.3

                is_operating = self._is_operating_hour(hour, station.opening_time, station.closing_time)

                if not is_operating:
                    estimated = 0
                    capacity_ratio = 0.0
                    congestion_level = "关闭"
                else:
                    base_estimate = int(station.capacity * 0.4)
                    estimated = int(base_estimate * heat_factor * time_factor)
                    estimated = min(estimated, station.capacity * 2)

                    capacity_ratio = estimated / station.capacity if station.capacity > 0 else 0

                    if capacity_ratio >= 1.2:
                        congestion_level = "爆满"
                    elif capacity_ratio >= 0.9:
                        congestion_level = "拥挤"
                    elif capacity_ratio >= 0.6:
                        congestion_level = "较拥挤"
                    else:
                        congestion_level = "宽松"

                station_congestions[station.id].append(StationCongestion(
                    station_id=station.id,
                    hour=hour,
                    estimated_people=estimated,
                    congestion_level=congestion_level,
                    capacity_ratio=capacity_ratio,
                ))

        return station_congestions

    def _is_operating_hour(self, hour: int, opening_time: str, closing_time: str) -> bool:
        opening_hour = int(opening_time.split(":")[0])
        closing_hour = int(closing_time.split(":")[0])
        return opening_hour <= hour < closing_hour

    def get_station_peak_congestion(
        self,
        congestions: Dict[str, List[StationCongestion]],
    ) -> Dict[str, Dict]:
        peak_stats = {}
        for station_id, hourly_list in congestions.items():
            max_ratio = 0.0
            peak_hour = 0
            peak_level = "宽松"

            for congestion in hourly_list:
                if congestion.capacity_ratio > max_ratio:
                    max_ratio = congestion.capacity_ratio
                    peak_hour = congestion.hour
                    peak_level = congestion.congestion_level

            peak_stats[station_id] = {
                "peak_hour": peak_hour,
                "max_capacity_ratio": max_ratio,
                "peak_congestion_level": peak_level,
            }

        return peak_stats


class StationAssigner:
    def __init__(
        self,
        coverage_analyzer: CoverageAnalyzer,
        prefer_risk: bool = True,
    ):
        self.coverage_analyzer = coverage_analyzer
        self.prefer_risk = prefer_risk

    def assign_stations(
        self,
        persons: List[ElderlyPerson],
        stations: List[CoolingStation],
        locked_stations: List[str] = None,
        priority_overrides: Dict[str, int] = None,
    ) -> List[StationAssignment]:
        locked_stations = locked_stations or []
        priority_overrides = priority_overrides or {}

        station_capacities = {
            s.id: s.available_spots
            for s in stations
            if s.id not in locked_stations
        }

        sorted_persons = sorted(
            persons,
            key=lambda p: (
                -priority_overrides.get(p.id, p.visit_priority),
                -p.risk_score,
            ),
        )

        assignments = []

        for person in sorted_persons:
            if person.assigned_station_id:
                assignments.append(StationAssignment(
                    elderly_id=person.id,
                    station_id=person.assigned_station_id,
                    walking_time=0,
                    bus_time=0,
                    distance_km=0.0,
                    assignment_reason="已预先分配",
                ))
                continue

            nearest_station, distance, walking_time, bus_time = self.coverage_analyzer.find_nearest_station(
                person, stations
            )

            if not nearest_station:
                continue

            if station_capacities.get(nearest_station.id, 0) <= 0:
                alternative_found = False
                for alt_station in sorted(
                    stations,
                    key=lambda s: self.coverage_analyzer.calculate_distance_km(
                        person.latitude, person.longitude,
                        s.latitude, s.longitude,
                    ),
                ):
                    if alt_station.id == nearest_station.id:
                        continue
                    if alt_station.id in locked_stations:
                        continue
                    if station_capacities.get(alt_station.id, 0) > 0:
                        alt_distance = self.coverage_analyzer.calculate_distance_km(
                            person.latitude, person.longitude,
                            alt_station.latitude, alt_station.longitude,
                        )
                        alt_walking, alt_bus = self.coverage_analyzer.estimate_travel_time(
                            alt_distance, person.mobility
                        )
                        assignments.append(StationAssignment(
                            elderly_id=person.id,
                            station_id=alt_station.id,
                            walking_time=alt_walking,
                            bus_time=alt_bus,
                            distance_km=round(alt_distance, 2),
                            assignment_reason="备选站点（主站点已满）",
                        ))
                        station_capacities[alt_station.id] -= 1
                        alternative_found = True
                        break

                if not alternative_found:
                    assignments.append(StationAssignment(
                        elderly_id=person.id,
                        station_id=nearest_station.id,
                        walking_time=walking_time,
                        bus_time=bus_time,
                        distance_km=round(distance, 2),
                        assignment_reason="超容分配（需关注）",
                    ))
            else:
                assignments.append(StationAssignment(
                    elderly_id=person.id,
                    station_id=nearest_station.id,
                    walking_time=walking_time,
                    bus_time=bus_time,
                    distance_km=round(distance, 2),
                    assignment_reason="优先分配",
                ))
                station_capacities[nearest_station.id] -= 1

        return assignments


class RouteOptimizer:
    def __init__(self, coverage_analyzer: CoverageAnalyzer):
        self.coverage_analyzer = coverage_analyzer

    def calculate_route_distance(
        self,
        persons: List[ElderlyPerson],
        order: List[int],
    ) -> float:
        if len(order) <= 1:
            return 0.0

        total_distance = 0.0
        for i in range(len(order) - 1):
            p1 = persons[order[i]]
            p2 = persons[order[i + 1]]
            total_distance += self.coverage_analyzer.calculate_distance_km(
                p1.latitude, p1.longitude,
                p2.latitude, p2.longitude,
            )

        return total_distance

    def optimize_route_greedy(
        self,
        persons: List[ElderlyPerson],
        start_index: int = 0,
    ) -> Tuple[List[int], float]:
        if not persons:
            return [], 0.0

        n = len(persons)
        if n == 1:
            return [0], 0.0

        unvisited = set(range(n))
        unvisited.remove(start_index)
        route = [start_index]
        current = start_index

        total_distance = 0.0

        while unvisited:
            nearest = None
            min_dist = float("inf")

            for idx in unvisited:
                dist = self.coverage_analyzer.calculate_distance_km(
                    persons[current].latitude, persons[current].longitude,
                    persons[idx].latitude, persons[idx].longitude,
                )
                if dist < min_dist:
                    min_dist = dist
                    nearest = idx

            route.append(nearest)
            total_distance += min_dist
            unvisited.remove(nearest)
            current = nearest

        return route, round(total_distance, 2)

    def create_visit_schedules(
        self,
        persons: List[ElderlyPerson],
        staff_list: List[str],
        start_time: str = "09:00",
        visit_duration_minutes: int = 20,
        travel_minutes_per_km: float = 5.0,
    ) -> List[VisitSchedule]:
        schedules = []

        high_risk_persons = [p for p in persons if p.risk_level in [RiskLevel.HIGH.value, RiskLevel.CRITICAL.value]]
        medium_risk_persons = [p for p in persons if p.risk_level == RiskLevel.MEDIUM.value]
        low_risk_persons = [p for p in persons if p.risk_level == RiskLevel.LOW.value]

        all_persons = high_risk_persons + medium_risk_persons + low_risk_persons

        if not staff_list:
            staff_list = ["网格员A"]

        persons_per_staff = len(all_persons) // len(staff_list)
        if len(all_persons) % len(staff_list) > 0:
            persons_per_staff += 1

        for staff_idx, staff in enumerate(staff_list):
            start = staff_idx * persons_per_staff
            end = min(start + persons_per_staff, len(all_persons))
            staff_persons = all_persons[start:end]

            if not staff_persons:
                continue

            route, _ = self.optimize_route_greedy(staff_persons)

            current_hour = int(start_time.split(":")[0])
            current_minute = int(start_time.split(":")[1])

            for i, person_idx in enumerate(route):
                person = staff_persons[person_idx]

                scheduled_time = f"{current_hour:02d}:{current_minute:02d}"

                visit_type = "常规探访"
                if person.risk_level == RiskLevel.CRITICAL.value:
                    visit_type = "紧急探访"
                elif person.risk_level == RiskLevel.HIGH.value:
                    visit_type = "重点探访"
                elif person.mobility in ["轮椅", "卧床"]:
                    visit_type = "特殊照顾"

                schedule = VisitSchedule(
                    id=f"VS_{person.id}_{staff_idx}_{i}",
                    elderly_id=person.id,
                    scheduled_time=scheduled_time,
                    assigned_staff=staff,
                    visit_type=visit_type,
                    status="待执行",
                )
                schedules.append(schedule)

                current_minute += visit_duration_minutes
                if current_minute >= 60:
                    current_hour += 1
                    current_minute -= 60

                if i < len(route) - 1:
                    next_person = staff_persons[route[i + 1]]
                    dist = self.coverage_analyzer.calculate_distance_km(
                        person.latitude, person.longitude,
                        next_person.latitude, next_person.longitude,
                    )
                    travel_minutes = int(dist * travel_minutes_per_km)
                    current_minute += travel_minutes
                    if current_minute >= 60:
                        current_hour += 1
                        current_minute -= 60

        return sorted(schedules, key=lambda x: x.scheduled_time)
