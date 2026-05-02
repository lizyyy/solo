from dataclasses import dataclass, field
from typing import Optional
from enum import Enum


class EventType(Enum):
    ENTER = "enter"
    EXIT = "exit"
    PASS = "pass"


@dataclass
class DoorUsage:
    door_id: str
    timestamps: list[float] = field(default_factory=list)
    event_types: list[str] = field(default_factory=list)


@dataclass
class OccupantTimeline:
    occupant_id: str
    name: str
    start_floor: int
    start_zone: str
    exit_time: Optional[float] = None
    total_evacuation_time: float = 0.0
    door_passes: list[DoorUsage] = field(default_factory=list)
    reverse_movements: list[tuple[float, str, int]] = field(default_factory=list)
    current_floor: int = 0
    current_zone: str = ""
    waiting_at_door: Optional[str] = None
    wait_start_time: Optional[float] = None


@dataclass
class FloorState:
    floor: int
    current_occupants: int = 0
    door_congestion: dict[str, int] = field(default_factory=dict)
    occupants_evacuated: int = 0


class PathAnalyzer:
    def __init__(self, floor_plan):
        self.floor_plan = floor_plan
        self.occupant_timelines: dict[str, OccupantTimeline] = {}

    def build_timelines(self, occupants, events):
        for occ in occupants:
            self.occupant_timelines[occ.occupant_id] = OccupantTimeline(
                occupant_id=occ.occupant_id,
                name=occ.name,
                start_floor=occ.floor,
                start_zone=occ.zone,
                current_floor=occ.floor,
                current_zone=occ.zone
            )

        for event in events:
            if event.occupant_id not in self.occupant_timelines:
                continue
            tl = self.occupant_timelines[event.occupant_id]
            self._process_event(tl, event)

    def _process_event(self, tl: OccupantTimeline, event):
        prev_floor = tl.current_floor

        if event.event_type in ("exit", "evacuate"):
            tl.exit_time = event.timestamp
            tl.total_evacuation_time = event.timestamp
            return

        if event.event_type == "enter":
            tl.current_floor = event.floor
            if self.floor_plan.doors.get(event.door_id, {}).get("connects_floors"):
                connects = self.floor_plan.doors[event.door_id]["connects_floors"]
                if prev_floor in connects:
                    new_floor = connects[0] if connects[1] == prev_floor else connects[1]
                    tl.current_floor = new_floor

        door_usage = next((d for d in tl.door_passes if d.door_id == event.door_id), None)
        if door_usage is None:
            door_usage = DoorUsage(door_id=event.door_id)
            tl.door_passes.append(door_usage)
        door_usage.timestamps.append(event.timestamp)
        door_usage.event_types.append(event.event_type)

        if len(door_usage.timestamps) >= 2:
            last_ts = door_usage.timestamps[-2]
            if event.timestamp - last_ts < 5 and event.door_id == door_usage.door_id:
                tl.reverse_movements.append((event.timestamp, event.door_id, event.floor))

        if prev_floor != event.floor and event.floor not in self._get_allowed_floors(tl):
            tl.reverse_movements.append((event.timestamp, event.door_id, event.floor))

    def _get_allowed_floors(self, tl: OccupantTimeline):
        allowed = [tl.start_floor]
        for door in self.floor_plan.doors.values():
            if door.get("connects_floors"):
                allowed.extend(door["connects_floors"])
        return set(allowed)

    def check_cross_floor_detour(self, tl: OccupantTimeline) -> bool:
        if not tl.door_passes:
            return False
        floors_visited = set()
        for door in tl.door_passes:
            if self.floor_plan.doors.get(door.door_id, {}).get("connects_floors"):
                floors_visited.update(self.floor_plan.doors[door.door_id]["connects_floors"])
        expected_exit_floor = tl.start_floor
        if expected_exit_floor not in floors_visited and len(floors_visited) > 1:
            return True
        return False

    def check_duplicate_door_scan(self, tl: OccupantTimeline) -> list[tuple[float, str]]:
        violations = []
        door_times: dict[str, list[float]] = {}
        for door in tl.door_passes:
            if door.door_id not in door_times:
                door_times[door.door_id] = []
            for ts in door.timestamps:
                door_times[door.door_id].append(ts)

        for door_id, timestamps in door_times.items():
            timestamps.sort()
            for i in range(1, len(timestamps)):
                if timestamps[i] - timestamps[i-1] < 10:
                    violations.append((timestamps[i], door_id))
        return violations
