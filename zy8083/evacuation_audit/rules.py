from dataclasses import dataclass
from typing import Optional
from enum import Enum


class ViolationType(Enum):
    REVERSE_MOVEMENT = "reverse_movement"
    EXIT_CONGESTION = "exit_congestion"
    STRAY_TIMEOUT = "stray_timeout"
    MISSING_DOOR_SCAN = "missing_door_scan"
    CROSS_FLOOR_DETOUR = "cross_floor_detour"
    DUPLICATE_DOOR_SCAN = "duplicate_door_scan"


@dataclass
class Violation:
    violation_type: ViolationType
    occupant_id: str
    occupant_name: str
    timestamp: float
    location: str
    details: str
    severity: str


class RuleEngine:
    def __init__(self, rules, floor_plan):
        self.rules = rules
        self.floor_plan = floor_plan

    def check_reverse_movement(self, timelines: dict) -> list[Violation]:
        violations = []
        for occ_id, tl in timelines.items():
            for rev in tl.reverse_movements:
                violations.append(Violation(
                    violation_type=ViolationType.REVERSE_MOVEMENT,
                    occupant_id=occ_id,
                    occupant_name=tl.name,
                    timestamp=rev[0],
                    location=f"Door {rev[1]} on Floor {rev[2]}",
                    details=f"Reversed direction at {rev[0]:.1f}s",
                    severity="medium"
                ))
        return violations

    def check_congestion(self, timelines: dict, events: list) -> list[Violation]:
        violations = []
        time_windows: dict[float, dict[str, int]] = {}

        for event in events:
            window_ts = int(event.timestamp / 10) * 10
            if window_ts not in time_windows:
                time_windows[window_ts] = {}
            door_count = time_windows[window_ts].get(event.door_id, 0)
            time_windows[window_ts][event.door_id] = door_count + 1

        for ts, doors in time_windows.items():
            for door_id, count in doors.items():
                if count >= self.rules.congestion_threshold:
                    violations.append(Violation(
                        violation_type=ViolationType.EXIT_CONGESTION,
                        occupant_id="N/A",
                        occupant_name="Multiple",
                        timestamp=float(ts),
                        location=f"Door {door_id}",
                        details=f"Congestion: {count} people within 10s window",
                        severity="high"
                    ))
        return violations

    def check_stray_timeout(self, timelines: dict) -> list[Violation]:
        violations = []
        for occ_id, tl in timelines.items():
            if tl.exit_time is None and tl.total_evacuation_time > self.rules.max_evacuation_time:
                violations.append(Violation(
                    violation_type=ViolationType.STRAY_TIMEOUT,
                    occupant_id=occ_id,
                    occupant_name=tl.name,
                    timestamp=tl.total_evacuation_time,
                    location=f"Floor {tl.current_floor}, Zone {tl.current_zone}",
                    details=f"Evacuation time {tl.total_evacuation_time:.1f}s exceeds max {self.rules.max_evacuation_time}s",
                    severity="high"
                ))
        return violations

    def check_missing_door_scan(self, timelines: dict) -> list[Violation]:
        violations = []
        required_doors = set(self.floor_plan.exits.keys())

        for occ_id, tl in timelines.items():
            passed_doors = {d.door_id for d in tl.door_passes}
            missing = required_doors - passed_doors
            if missing and not tl.exit_time:
                violations.append(Violation(
                    violation_type=ViolationType.MISSING_DOOR_SCAN,
                    occupant_id=occ_id,
                    occupant_name=tl.name,
                    timestamp=tl.total_evacuation_time or 0,
                    location=f"Floor {tl.start_floor}",
                    details=f"Did not pass exit door(s): {', '.join(missing)}",
                    severity="medium"
                ))
        return violations

    def check_duplicate_door_scan(self, timelines: dict) -> list[Violation]:
        violations = []
        for occ_id, tl in timelines.items():
            door_times: dict[str, list[float]] = {}
            for door in tl.door_passes:
                if door.door_id not in door_times:
                    door_times[door.door_id] = []
                door_times[door.door_id].extend(door.timestamps)

            for door_id, timestamps in door_times.items():
                timestamps.sort()
                for i in range(1, len(timestamps)):
                    if timestamps[i] - timestamps[i-1] < 10:
                        violations.append(Violation(
                            violation_type=ViolationType.DUPLICATE_DOOR_SCAN,
                            occupant_id=occ_id,
                            occupant_name=tl.name,
                            timestamp=timestamps[i],
                            location=f"Door {door_id}",
                            details=f"Same door scanned twice within 10s ({timestamps[i-1]:.1f}s and {timestamps[i]:.1f}s)",
                            severity="low"
                        ))
        return violations

    def check_cross_floor_detour(self, timelines: dict) -> list[Violation]:
        violations = []
        for occ_id, tl in timelines.items():
            if not tl.door_passes:
                continue

            floors_visited = set()
            for door in tl.door_passes:
                door_info = self.floor_plan.doors.get(door.door_id, {})
                if door_info.get("connects_floors"):
                    floors_visited.update(door_info["connects_floors"])

            expected_exit = tl.start_floor
            if expected_exit not in floors_visited and len(floors_visited) > 1:
                violations.append(Violation(
                    violation_type=ViolationType.CROSS_FLOOR_DETOUR,
                    occupant_id=occ_id,
                    occupant_name=tl.name,
                    timestamp=tl.door_passes[0].timestamps[0] if tl.door_passes else 0,
                    location=f"Floors {floors_visited}",
                    details=f"Cross-floor detour detected: started at floor {expected_exit}, visited {floors_visited}",
                    severity="medium"
                ))
        return violations

    def run_all_checks(self, timelines: dict, events: list) -> list[Violation]:
        all_violations = []
        all_violations.extend(self.check_reverse_movement(timelines))
        all_violations.extend(self.check_congestion(timelines, events))
        all_violations.extend(self.check_stray_timeout(timelines))
        all_violations.extend(self.check_missing_door_scan(timelines))
        all_violations.extend(self.check_duplicate_door_scan(timelines))
        all_violations.extend(self.check_cross_floor_detour(timelines))
        return all_violations
