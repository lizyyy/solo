import csv
import json
import yaml
from dataclasses import dataclass, field
from datetime import datetime, time
from typing import Dict, List, Any, Optional


@dataclass
class Intersection:
    id: str
    name: str
    location: str
    total_phases: int
    pedestrian_phases: List[int] = field(default_factory=list)
    bus_phases: List[int] = field(default_factory=list)


@dataclass
class PhaseStep:
    phase_id: int
    duration: int
    is_pedestrian: bool = False
    is_bus_priority: bool = False


@dataclass
class PhasePlan:
    intersection_id: str
    plan_id: str
    name: str
    start_time: time
    end_time: time
    cycle_length: int
    phases: List[PhaseStep]


@dataclass
class DetectorEvent:
    intersection_id: str
    detector_id: str
    timestamp: datetime
    event_type: str
    vehicle_type: str


@dataclass
class Rules:
    pedestrian_clearance_min: int
    bus_priority_max_impact: int
    detector_gap_threshold: int
    midnight_transition_grace: int


def parse_intersections(file_path: str) -> Dict[str, Intersection]:
    intersections = {}
    with open(file_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pedestrian_phases = [int(p) for p in row.get("pedestrian_phases", "").split(",") if p.strip()]
            bus_phases = [int(p) for p in row.get("bus_phases", "").split(",") if p.strip()]
            intersection = Intersection(
                id=row["id"],
                name=row["name"],
                location=row.get("location", ""),
                total_phases=int(row.get("total_phases", 0)),
                pedestrian_phases=pedestrian_phases,
                bus_phases=bus_phases,
            )
            intersections[intersection.id] = intersection
    return intersections


def parse_time(time_str: str) -> time:
    parts = time_str.split(":")
    if len(parts) == 3:
        return time(hour=int(parts[0]), minute=int(parts[1]), second=int(parts[2]))
    elif len(parts) == 2:
        return time(hour=int(parts[0]), minute=int(parts[1]))
    return time(hour=0, minute=0)


def parse_phase_plans(file_path: str) -> Dict[str, List[PhasePlan]]:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    plans_by_intersection: Dict[str, List[PhasePlan]] = {}
    
    for plan_data in data:
        intersection_id = plan_data["intersection_id"]
        
        phases = []
        for phase_step in plan_data["phases"]:
            step = PhaseStep(
                phase_id=phase_step["phase_id"],
                duration=phase_step["duration"],
                is_pedestrian=phase_step.get("is_pedestrian", False),
                is_bus_priority=phase_step.get("is_bus_priority", False),
            )
            phases.append(step)
        
        plan = PhasePlan(
            intersection_id=intersection_id,
            plan_id=plan_data["plan_id"],
            name=plan_data.get("name", plan_data["plan_id"]),
            start_time=parse_time(plan_data["start_time"]),
            end_time=parse_time(plan_data["end_time"]),
            cycle_length=plan_data["cycle_length"],
            phases=phases,
        )
        
        if intersection_id not in plans_by_intersection:
            plans_by_intersection[intersection_id] = []
        plans_by_intersection[intersection_id].append(plan)
    
    for intersection_id in plans_by_intersection:
        plans_by_intersection[intersection_id].sort(key=lambda p: p.start_time)
    
    return plans_by_intersection


def parse_detector_events(file_path: str) -> Dict[str, List[DetectorEvent]]:
    events_by_intersection: Dict[str, List[DetectorEvent]] = {}
    
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            event_data = json.loads(line)
            
            event = DetectorEvent(
                intersection_id=event_data["intersection_id"],
                detector_id=event_data["detector_id"],
                timestamp=datetime.fromisoformat(event_data["timestamp"]),
                event_type=event_data.get("event_type", "detection"),
                vehicle_type=event_data.get("vehicle_type", "unknown"),
            )
            
            intersection_id = event.intersection_id
            if intersection_id not in events_by_intersection:
                events_by_intersection[intersection_id] = []
            events_by_intersection[intersection_id].append(event)
    
    for intersection_id in events_by_intersection:
        events_by_intersection[intersection_id].sort(key=lambda e: e.timestamp)
    
    return events_by_intersection


def parse_rules(file_path: str) -> Rules:
    with open(file_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    
    return Rules(
        pedestrian_clearance_min=data.get("pedestrian_clearance_min", 5),
        bus_priority_max_impact=data.get("bus_priority_max_impact", 10),
        detector_gap_threshold=data.get("detector_gap_threshold", 300),
        midnight_transition_grace=data.get("midnight_transition_grace", 60),
    )


def parse_all(
    intersections_path: str,
    phase_plans_path: str,
    detector_events_path: str,
    rules_path: str,
) -> tuple[Dict[str, Intersection], Dict[str, List[PhasePlan]], Dict[str, List[DetectorEvent]], Rules]:
    intersections = parse_intersections(intersections_path)
    phase_plans = parse_phase_plans(phase_plans_path)
    detector_events = parse_detector_events(detector_events_path)
    rules = parse_rules(rules_path)
    
    return intersections, phase_plans, detector_events, rules
