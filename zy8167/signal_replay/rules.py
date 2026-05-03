from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from typing import Dict, List, Optional, Set

from .parser import Intersection, Rules, DetectorEvent, PhasePlan
from .timeline import TimelineEvent, time_to_seconds


@dataclass
class Issue:
    intersection_id: str
    issue_type: str
    timestamp: datetime
    severity: str
    description: str
    details: str = ""
    phase_id: Optional[int] = None
    plan_id: Optional[str] = None


ISSUE_TYPE_PEDESTRIAN_CLEARANCE = "pedestrian_clearance_insufficient"
ISSUE_TYPE_BUS_PRIORITY_IMPACT = "bus_priority_green_wave_offset"
ISSUE_TYPE_DETECTOR_GAP = "detector_gap_exceeded"
ISSUE_TYPE_MIDNIGHT_TRANSITION = "midnight_plan_transition_issue"


def check_pedestrian_clearance(
    intersection: Intersection,
    timeline: List[TimelineEvent],
    rules: Rules,
) -> List[Issue]:
    issues: List[Issue] = []
    
    for i, event in enumerate(timeline):
        if event.event_type == "PHASE_START" and event.is_pedestrian:
            end_event = None
            for j in range(i + 1, len(timeline)):
                if (
                    timeline[j].event_type == "PHASE_END"
                    and timeline[j].phase_id == event.phase_id
                ):
                    end_event = timeline[j]
                    break
            
            if end_event and end_event.duration:
                if end_event.duration < rules.pedestrian_clearance_min:
                    issues.append(Issue(
                        intersection_id=intersection.id,
                        issue_type=ISSUE_TYPE_PEDESTRIAN_CLEARANCE,
                        timestamp=event.timestamp,
                        severity="high",
                        description=f"行人清空时间不足",
                        details=f"相位 {event.phase_id} 行人清空时间为 {end_event.duration}秒，低于最小值 {rules.pedestrian_clearance_min}秒",
                        phase_id=event.phase_id,
                        plan_id=event.plan_id,
                    ))
    
    return issues


def check_bus_priority_impact(
    intersection: Intersection,
    timeline: List[TimelineEvent],
    rules: Rules,
    detector_events: List[DetectorEvent],
) -> List[Issue]:
    issues: List[Issue] = []
    
    bus_events = [e for e in detector_events if e.vehicle_type == "bus"]
    
    for bus_event in bus_events:
        phase_start: Optional[TimelineEvent] = None
        for event in timeline:
            if (
                event.event_type == "PHASE_START"
                and event.timestamp <= bus_event.timestamp
                and event.is_bus_priority
            ):
                phase_start = event
            elif (
                event.event_type == "PHASE_END"
                and phase_start
                and event.phase_id == phase_start.phase_id
            ):
                if bus_event.timestamp < event.timestamp:
                    nominal_duration = phase_start.duration or 0
                    if event.duration and event.duration - nominal_duration > rules.bus_priority_max_impact:
                        offset = event.duration - nominal_duration
                        issues.append(Issue(
                            intersection_id=intersection.id,
                            issue_type=ISSUE_TYPE_BUS_PRIORITY_IMPACT,
                            timestamp=bus_event.timestamp,
                            severity="medium",
                            description=f"公交优先插入导致绿波偏移",
                            details=f"检测到公交后，相位 {phase_start.phase_id} 延长 {offset}秒，超过最大允许偏移 {rules.bus_priority_max_impact}秒",
                            phase_id=phase_start.phase_id,
                            plan_id=phase_start.plan_id,
                        ))
                phase_start = None
    
    return issues


def check_detector_gaps(
    intersection: Intersection,
    detector_events: List[DetectorEvent],
    rules: Rules,
) -> List[Issue]:
    issues: List[Issue] = []
    
    if not detector_events:
        issues.append(Issue(
            intersection_id=intersection.id,
            issue_type=ISSUE_TYPE_DETECTOR_GAP,
            timestamp=datetime.now(),
            severity="high",
            description="检测器无数据",
            details=f"路口 {intersection.id} 全天无检测器事件",
        ))
        return issues
    
    detectors: Dict[str, List[DetectorEvent]] = {}
    for event in detector_events:
        if event.detector_id not in detectors:
            detectors[event.detector_id] = []
        detectors[event.detector_id].append(event)
    
    for detector_id, events in detectors.items():
        events.sort(key=lambda e: e.timestamp)
        
        for i in range(1, len(events)):
            gap = (events[i].timestamp - events[i-1].timestamp).total_seconds()
            if gap > rules.detector_gap_threshold:
                issues.append(Issue(
                    intersection_id=intersection.id,
                    issue_type=ISSUE_TYPE_DETECTOR_GAP,
                    timestamp=events[i-1].timestamp,
                    severity="medium" if gap < 2 * rules.detector_gap_threshold else "high",
                    description=f"检测器 {detector_id} 数据断采",
                    details=f"检测器 {detector_id} 从 {events[i-1].timestamp} 到 {events[i].timestamp} 断采 {int(gap)}秒，超过阈值 {rules.detector_gap_threshold}秒",
                ))
    
    return issues


def check_midnight_transition(
    intersection: Intersection,
    plans: List[PhasePlan],
    rules: Rules,
) -> List[Issue]:
    issues: List[Issue] = []
    
    plans_sorted = sorted(plans, key=lambda p: time_to_seconds(p.start_time))
    
    spans_midnight = False
    midnight_plan: Optional[PhasePlan] = None
    
    for plan in plans_sorted:
        start_sec = time_to_seconds(plan.start_time)
        end_sec = time_to_seconds(plan.end_time)
        
        if start_sec > end_sec:
            spans_midnight = True
            midnight_plan = plan
            break
    
    if not spans_midnight:
        last_plan = plans_sorted[-1] if plans_sorted else None
        first_plan = plans_sorted[0] if plans_sorted else None
        
        if last_plan and first_plan:
            last_end = time_to_seconds(last_plan.end_time)
            first_start = time_to_seconds(first_plan.start_time)
            
            if last_end < 86400 - 60 and first_start > 60:
                gap_start = datetime.combine(datetime.now().date(), time(hour=23, minute=59, second=0))
                issues.append(Issue(
                    intersection_id=intersection.id,
                    issue_type=ISSUE_TYPE_MIDNIGHT_TRANSITION,
                    timestamp=gap_start,
                    severity="high",
                    description="跨午夜计划切换存在缺口",
                    details=f"最后一个计划 {last_plan.name} 在 {last_plan.end_time} 结束，第一个计划 {first_plan.name} 在 {first_plan.start_time} 开始，午夜时段无配时计划",
                    plan_id=f"{last_plan.plan_id}->{first_plan.plan_id}",
                ))
    
    if midnight_plan:
        start_sec = time_to_seconds(midnight_plan.start_time)
        end_sec = time_to_seconds(midnight_plan.end_time)
        
        midnight_time = time(hour=0, minute=0, second=0)
        transition_dt = datetime.combine(datetime.now().date(), midnight_time)
        
        issues.append(Issue(
            intersection_id=intersection.id,
            issue_type=ISSUE_TYPE_MIDNIGHT_TRANSITION,
            timestamp=transition_dt,
            severity="info",
            description="计划跨午夜执行",
            details=f"计划 {midnight_plan.name} 从 {midnight_plan.start_time} 运行到 {midnight_plan.end_time}，跨午夜时段",
            plan_id=midnight_plan.plan_id,
        ))
    
    return issues


def run_all_checks(
    intersections: Dict[str, Intersection],
    timelines: Dict[str, List[TimelineEvent]],
    phase_plans: Dict[str, List[PhasePlan]],
    detector_events: Dict[str, List[DetectorEvent]],
    rules: Rules,
) -> List[Issue]:
    all_issues: List[Issue] = []
    
    for intersection_id, intersection in intersections.items():
        if intersection_id in timelines:
            timeline = timelines[intersection_id]
            
            pedestrian_issues = check_pedestrian_clearance(intersection, timeline, rules)
            all_issues.extend(pedestrian_issues)
        
        if intersection_id in phase_plans:
            plans = phase_plans[intersection_id]
            
            midnight_issues = check_midnight_transition(intersection, plans, rules)
            all_issues.extend(midnight_issues)
        
        if intersection_id in detector_events:
            events = detector_events[intersection_id]
            
            gap_issues = check_detector_gaps(intersection, events, rules)
            all_issues.extend(gap_issues)
            
            if intersection_id in timelines:
                bus_issues = check_bus_priority_impact(
                    intersection,
                    timelines[intersection_id],
                    rules,
                    events,
                )
                all_issues.extend(bus_issues)
    
    all_issues.sort(key=lambda i: i.timestamp)
    
    return all_issues
