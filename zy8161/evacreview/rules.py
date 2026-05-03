from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

from .parsers import Badge, Dataset, Event


class IssueSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class IssueType(str, Enum):
    MISSING_MEETING_POINT = "missing_meeting_point"
    RETROGRADE = "retrograde"
    DUPLICATE_SWIPE = "duplicate_swipe"
    CAMERA_GAP = "camera_gap"
    DATA_ISSUE = "data_issue"
    MIDNIGHT_CROSSING = "midnight_crossing"


@dataclass
class Issue:
    issue_type: IssueType
    severity: IssueSeverity
    badge_id: Optional[str] = None
    name: Optional[str] = None
    floor: Optional[int] = None
    location: Optional[str] = None
    timestamp: Optional[datetime] = None
    description: str = ""
    evidence: List[Event] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "badge_id": self.badge_id or "",
            "name": self.name or "",
            "floor": self.floor or "",
            "location": self.location or "",
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S") if self.timestamp else "",
            "description": self.description,
        }


class Rule(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @property
    @abstractmethod
    def issue_type(self) -> IssueType:
        pass

    @abstractmethod
    def check(self, dataset: Dataset) -> List[Issue]:
        pass


class MissingMeetingPointRule(Rule):
    @property
    def name(self) -> str:
        return "未到集合点检测"

    @property
    def issue_type(self) -> IssueType:
        return IssueType.MISSING_MEETING_POINT

    def check(self, dataset: Dataset) -> List[Issue]:
        issues = []
        meeting_points = dataset.meeting_points
        meeting_point_names = {mp.name for mp in meeting_points}

        for badge_id in dataset.unique_badge_ids:
            events = dataset.get_person_events(badge_id)
            if not events:
                badge = dataset.get_badge(badge_id)
                issues.append(
                    Issue(
                        issue_type=IssueType.MISSING_MEETING_POINT,
                        severity=IssueSeverity.CRITICAL,
                        badge_id=badge_id,
                        name=badge.name if badge else "",
                        floor=badge.floor if badge else None,
                        description=f"人员在演练期间无任何刷卡或摄像头记录",
                    )
                )
                continue

            arrived_at_meeting = any(
                e.location in meeting_point_names
                or (e.details and e.details.get("is_meeting_point", False))
                for e in events
            )

            if not arrived_at_meeting:
                badge = dataset.get_badge(badge_id)
                last_event = events[-1] if events else None
                issues.append(
                    Issue(
                        issue_type=IssueType.MISSING_MEETING_POINT,
                        severity=IssueSeverity.CRITICAL,
                        badge_id=badge_id,
                        name=badge.name if badge else "",
                        floor=last_event.floor if last_event else (badge.floor if badge else None),
                        location=last_event.location if last_event else None,
                        timestamp=last_event.timestamp if last_event else None,
                        description=f"人员未到达集合点，最后已知位置: {last_event.location if last_event else '未知'}",
                        evidence=events[-3:] if len(events) > 3 else events,
                    )
                )
        return issues


class RetrogradeRule(Rule):
    @property
    def name(self) -> str:
        return "逆行检测"

    @property
    def issue_type(self) -> IssueType:
        return IssueType.RETROGRADE

    def check(self, dataset: Dataset) -> List[Issue]:
        issues = []

        for badge_id in dataset.unique_badge_ids:
            events = dataset.get_person_events(badge_id)
            if len(events) < 2:
                continue

            badge = dataset.get_badge(badge_id)
            assigned_floor = badge.floor if badge else None

            for i in range(1, len(events)):
                prev_event = events[i - 1]
                curr_event = events[i]

                prev_floor = prev_event.floor
                curr_floor = curr_event.floor

                if prev_floor is not None and curr_floor is not None:
                    if curr_floor > prev_floor and curr_floor > 1:
                        issues.append(
                            Issue(
                                issue_type=IssueType.RETROGRADE,
                                severity=IssueSeverity.WARNING,
                                badge_id=badge_id,
                                name=badge.name if badge else "",
                                floor=curr_floor,
                                location=curr_event.location,
                                timestamp=curr_event.timestamp,
                                description=f"检测到逆行: 从 {prev_floor}F 上行到 {curr_floor}F（正确方向应为下行）",
                                evidence=[prev_event, curr_event],
                                details={
                                    "from_floor": prev_floor,
                                    "to_floor": curr_floor,
                                    "direction": "up",
                                },
                            )
                        )

                    if assigned_floor is not None and prev_floor == 1 and curr_floor > 1:
                        issues.append(
                            Issue(
                                issue_type=IssueType.RETROGRADE,
                                severity=IssueSeverity.CRITICAL,
                                badge_id=badge_id,
                                name=badge.name if badge else "",
                                floor=curr_floor,
                                location=curr_event.location,
                                timestamp=curr_event.timestamp,
                                description=f"严重逆行: 从1F返回楼上 {curr_floor}F，疑似返回危险区域",
                                evidence=[prev_event, curr_event],
                                details={
                                    "from_floor": prev_floor,
                                    "to_floor": curr_floor,
                                    "assigned_floor": assigned_floor,
                                },
                            )
                        )
        return issues


class DuplicateSwipeRule(Rule):
    @property
    def name(self) -> str:
        return "重复刷卡检测"

    @property
    def issue_type(self) -> IssueType:
        return IssueType.DUPLICATE_SWIPE

    def check(self, dataset: Dataset) -> List[Issue]:
        issues = []
        threshold_seconds = 5

        for badge_id in dataset.unique_badge_ids:
            events = dataset.get_person_events(badge_id)
            if len(events) < 2:
                continue

            badge = dataset.get_badge(badge_id)

            for i in range(1, len(events)):
                prev_event = events[i - 1]
                curr_event = events[i]

                time_diff = curr_event.timestamp - prev_event.timestamp
                if time_diff < timedelta(seconds=threshold_seconds):
                    same_location = prev_event.location == curr_event.location

                    issues.append(
                        Issue(
                            issue_type=IssueType.DUPLICATE_SWIPE,
                            severity=IssueSeverity.WARNING,
                            badge_id=badge_id,
                            name=badge.name if badge else "",
                            floor=curr_event.floor,
                            location=curr_event.location,
                            timestamp=curr_event.timestamp,
                            description=f"疑似重复刷卡: 相隔 {time_diff.total_seconds():.1f} 秒"
                            f"{'（同一位置）' if same_location else '（相邻位置）'}",
                            evidence=[prev_event, curr_event],
                            details={
                                "time_diff_seconds": time_diff.total_seconds(),
                                "same_location": same_location,
                            },
                        )
                    )
        return issues


class CameraGapRule(Rule):
    @property
    def name(self) -> str:
        return "摄像头点位缺失检测"

    @property
    def issue_type(self) -> IssueType:
        return IssueType.CAMERA_GAP

    def check(self, dataset: Dataset) -> List[Issue]:
        issues = []
        threshold_seconds = 60

        all_cameras: Set[str] = set()
        for floor in dataset.floors.values():
            all_cameras.update(floor.cameras)

        camera_events: Dict[str, List[Event]] = defaultdict(list)
        for event in dataset.events:
            if "camera" in event.event_type or "摄像头" in event.event_type:
                camera_events[event.location].append(event)

        floors_without_exits = []
        for floor_num, floor in dataset.floors.items():
            if not floor.exits:
                floors_without_exits.append(floor_num)

        if floors_without_exits:
            issues.append(
                Issue(
                    issue_type=IssueType.CAMERA_GAP,
                    severity=IssueSeverity.WARNING,
                    floor=floors_without_exits[0] if len(floors_without_exits) == 1 else None,
                    description=f"以下楼层未配置出口信息: {', '.join(map(str, floors_without_exits))}",
                    details={"floors": floors_without_exits, "issue": "missing_exits"},
                )
            )

        floors_without_cameras = []
        for floor_num, floor in dataset.floors.items():
            if not floor.cameras:
                floors_without_cameras.append(floor_num)

        if floors_without_cameras:
            issues.append(
                Issue(
                    issue_type=IssueType.CAMERA_GAP,
                    severity=IssueSeverity.CRITICAL,
                    floor=floors_without_cameras[0] if len(floors_without_cameras) == 1 else None,
                    description=f"以下楼层未配置摄像头: {', '.join(map(str, floors_without_cameras))}",
                    details={"floors": floors_without_cameras, "issue": "missing_cameras"},
                )
            )

        for badge_id in dataset.unique_badge_ids:
            events = dataset.get_person_events(badge_id)
            if len(events) < 2:
                continue

            badge = dataset.get_badge(badge_id)

            for i in range(1, len(events)):
                prev_event = events[i - 1]
                curr_event = events[i]

                time_diff = curr_event.timestamp - prev_event.timestamp
                if time_diff > timedelta(seconds=threshold_seconds):
                    prev_floor = prev_event.floor
                    curr_floor = curr_event.floor

                    floors_passed: List[int] = []
                    if prev_floor is not None and curr_floor is not None:
                        if prev_floor < curr_floor:
                            floors_passed = list(range(prev_floor + 1, curr_floor))
                        elif prev_floor > curr_floor:
                            floors_passed = list(range(curr_floor + 1, prev_floor))

                    if floors_passed:
                        missing_floor_cameras = []
                        for f in floors_passed:
                            if f not in dataset.floors or not dataset.floors[f].cameras:
                                missing_floor_cameras.append(f)

                        if missing_floor_cameras:
                            issues.append(
                                Issue(
                                    issue_type=IssueType.CAMERA_GAP,
                                    severity=IssueSeverity.WARNING,
                                    badge_id=badge_id,
                                    name=badge.name if badge else "",
                                    floor=curr_floor,
                                    location=curr_event.location,
                                    timestamp=curr_event.timestamp,
                                    description=f"从 {prev_floor}F 到 {curr_floor}F 经过 {floors_passed}F"
                                    f"，间隔 {time_diff.total_seconds():.0f} 秒，中间楼层可能无摄像头覆盖",
                                    evidence=[prev_event, curr_event],
                                    details={
                                        "time_diff_seconds": time_diff.total_seconds(),
                                        "floors_passed": floors_passed,
                                        "missing_cameras_on_floors": missing_floor_cameras,
                                    },
                                )
                            )
        return issues


class RuleEngine:
    def __init__(self, rules: Optional[List[Rule]] = None):
        self.rules = rules or [
            MissingMeetingPointRule(),
            RetrogradeRule(),
            DuplicateSwipeRule(),
            CameraGapRule(),
        ]

    def run_all(self, dataset: Dataset) -> List[Issue]:
        all_issues: List[Issue] = []
        for rule in self.rules:
            issues = rule.check(dataset)
            all_issues.extend(issues)
        return sorted(all_issues, key=lambda i: (
            0 if i.severity == IssueSeverity.CRITICAL else 1 if i.severity == IssueSeverity.WARNING else 2,
            i.timestamp or datetime.min,
        ))


def build_timeline(
    dataset: Dataset,
    group_by: str = "person",
) -> Dict[str, List[Event]]:
    timeline: Dict[str, List[Event]] = defaultdict(list)

    if group_by == "person":
        for badge_id in dataset.unique_badge_ids:
            timeline[badge_id] = dataset.get_person_events(badge_id)
    elif group_by == "floor":
        for floor_num in dataset.floors.keys():
            timeline[str(floor_num)] = dataset.get_floor_events(floor_num)
    else:
        raise ValueError(f"不支持的分组方式: {group_by}")

    return dict(timeline)


def analyze_evacuation_flow(
    dataset: Dataset,
) -> Dict[str, Any]:
    events = dataset.events
    if not events:
        return {
            "start_time": None,
            "end_time": None,
            "duration_minutes": 0,
            "total_people": len(dataset.unique_badge_ids),
            "arrived_at_meeting": 0,
            "by_floor": {},
        }

    start_time = min(e.timestamp for e in events)
    end_time = max(e.timestamp for e in events)
    duration = (end_time - start_time).total_seconds() / 60

    meeting_points = {mp.name for mp in dataset.meeting_points}
    arrived_badges: Set[str] = set()
    for event in events:
        if event.location in meeting_points:
            arrived_badges.add(event.badge_id)

    floor_stats: Dict[int, Dict[str, Any]] = {}
    for floor_num, floor in dataset.floors.items():
        floor_events = dataset.get_floor_events(floor_num)
        floor_badges = {e.badge_id for e in floor_events}
        floor_stats[floor_num] = {
            "floor_name": floor.name,
            "event_count": len(floor_events),
            "people_count": len(floor_badges),
        }

    return {
        "start_time": start_time,
        "end_time": end_time,
        "duration_minutes": round(duration, 2),
        "total_people": len(dataset.unique_badge_ids),
        "arrived_at_meeting": len(arrived_badges),
        "missing_at_meeting": len(dataset.unique_badge_ids) - len(arrived_badges),
        "by_floor": floor_stats,
    }
