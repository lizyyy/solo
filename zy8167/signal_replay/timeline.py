from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from typing import Dict, List, Optional

from .parser import Intersection, PhasePlan, PhaseStep


@dataclass
class TimelineEvent:
    intersection_id: str
    timestamp: datetime
    event_type: str
    phase_id: Optional[int] = None
    plan_id: Optional[str] = None
    duration: Optional[int] = None
    is_pedestrian: bool = False
    is_bus_priority: bool = False
    details: str = ""


@dataclass
class CycleInfo:
    intersection_id: str
    start_time: datetime
    end_time: datetime
    plan_id: str
    cycle_number: int
    phases: List[PhaseStep]
    actual_durations: Dict[int, int] = field(default_factory=dict)


def time_to_seconds(t: time) -> int:
    return t.hour * 3600 + t.minute * 60 + t.second


def seconds_to_time(s: int) -> time:
    s = s % 86400
    hours = s // 3600
    minutes = (s % 3600) // 60
    seconds = s % 60
    return time(hour=hours, minute=minutes, second=seconds)


def get_plan_for_time(plans: List[PhasePlan], seconds_since_midnight: int) -> Optional[PhasePlan]:
    for plan in plans:
        start_sec = time_to_seconds(plan.start_time)
        end_sec = time_to_seconds(plan.end_time)
        
        if start_sec <= end_sec:
            if start_sec <= seconds_since_midnight < end_sec:
                return plan
        else:
            if seconds_since_midnight >= start_sec or seconds_since_midnight < end_sec:
                return plan
    return None


def generate_intersection_timeline(
    intersection: Intersection,
    plans: List[PhasePlan],
    analysis_date: datetime,
) -> List[TimelineEvent]:
    events: List[TimelineEvent] = []
    
    start_of_day = datetime.combine(analysis_date.date(), time.min)
    
    current_seconds = 0
    current_plan: Optional[PhasePlan] = None
    current_cycle = 0
    current_phase_index = 0
    
    while current_seconds < 86400:
        current_time_dt = start_of_day + timedelta(seconds=current_seconds)
        
        active_plan = get_plan_for_time(plans, current_seconds)
        
        if active_plan != current_plan:
            if current_plan is not None:
                events.append(TimelineEvent(
                    intersection_id=intersection.id,
                    timestamp=current_time_dt,
                    event_type="PLAN_END",
                    plan_id=current_plan.plan_id,
                    details=f"Plan {current_plan.name} ending",
                ))
            
            if active_plan is not None:
                events.append(TimelineEvent(
                    intersection_id=intersection.id,
                    timestamp=current_time_dt,
                    event_type="PLAN_START",
                    plan_id=active_plan.plan_id,
                    details=f"Plan {active_plan.name} starting",
                ))
                current_cycle = 0
                current_phase_index = 0
            
            current_plan = active_plan
        
        if current_plan is None:
            current_seconds += 1
            continue
        
        if current_phase_index == 0:
            events.append(TimelineEvent(
                intersection_id=intersection.id,
                timestamp=current_time_dt,
                event_type="CYCLE_START",
                plan_id=current_plan.plan_id,
                details=f"Cycle {current_cycle} start",
            ))
        
        phase = current_plan.phases[current_phase_index]
        
        events.append(TimelineEvent(
            intersection_id=intersection.id,
            timestamp=current_time_dt,
            event_type="PHASE_START",
            phase_id=phase.phase_id,
            plan_id=current_plan.plan_id,
            duration=phase.duration,
            is_pedestrian=phase.is_pedestrian,
            is_bus_priority=phase.is_bus_priority,
            details=f"Phase {phase.phase_id} start, duration: {phase.duration}s",
        ))
        
        phase_end_seconds = current_seconds + phase.duration
        if phase_end_seconds > 86400:
            phase_end_seconds = 86400
            actual_duration = phase_end_seconds - current_seconds
        else:
            actual_duration = phase.duration
        
        events.append(TimelineEvent(
            intersection_id=intersection.id,
            timestamp=start_of_day + timedelta(seconds=phase_end_seconds),
            event_type="PHASE_END",
            phase_id=phase.phase_id,
            plan_id=current_plan.plan_id,
            duration=actual_duration,
            is_pedestrian=phase.is_pedestrian,
            is_bus_priority=phase.is_bus_priority,
            details=f"Phase {phase.phase_id} end, duration: {actual_duration}s",
        ))
        
        current_seconds = phase_end_seconds
        current_phase_index += 1
        
        if current_phase_index >= len(current_plan.phases):
            events.append(TimelineEvent(
                intersection_id=intersection.id,
                timestamp=start_of_day + timedelta(seconds=current_seconds),
                event_type="CYCLE_END",
                plan_id=current_plan.plan_id,
                details=f"Cycle {current_cycle} end",
            ))
            current_phase_index = 0
            current_cycle += 1
    
    return events


def generate_all_timelines(
    intersections: Dict[str, Intersection],
    phase_plans: Dict[str, List[PhasePlan]],
    analysis_date: datetime,
) -> Dict[str, List[TimelineEvent]]:
    all_timelines: Dict[str, List[TimelineEvent]] = {}
    
    for intersection_id, intersection in intersections.items():
        if intersection_id in phase_plans:
            timeline = generate_intersection_timeline(
                intersection,
                phase_plans[intersection_id],
                analysis_date,
            )
            all_timelines[intersection_id] = timeline
    
    return all_timelines


def get_phase_at_time(
    timeline: List[TimelineEvent],
    timestamp: datetime,
) -> Optional[TimelineEvent]:
    phase_start = None
    for event in timeline:
        if event.event_type == "PHASE_START":
            if event.timestamp <= timestamp:
                phase_start = event
            else:
                break
        elif event.event_type == "PHASE_END" and phase_start:
            if phase_start.phase_id == event.phase_id and timestamp < event.timestamp:
                return phase_start
            elif timestamp >= event.timestamp:
                phase_start = None
    return phase_start
