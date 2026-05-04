"""
规则模块 - 定义各类验证规则
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from typing import Dict, List, Any, Optional, Set, Tuple
from enum import Enum


class Severity(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


@dataclass
class Issue:
    issue_id: str
    rule_id: str
    rule_name: str
    severity: Severity
    bag_id: Optional[str]
    scan_id: Optional[str]
    teacher_id: Optional[str]
    description: str
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_id": self.issue_id,
            "rule_id": self.rule_id,
            "rule_name": self.rule_name,
            "severity": self.severity.value,
            "bag_id": self.bag_id or "",
            "scan_id": self.scan_id or "",
            "teacher_id": self.teacher_id or "",
            "description": self.description,
            "timestamp": self.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            **{f"detail_{k}": v for k, v in self.details.items()}
        }


class BaseRule(ABC):
    def __init__(self, rule_id: str, name: str, description: str, severity: Severity):
        self.rule_id = rule_id
        self.name = name
        self.description = description
        self.severity = severity

    @abstractmethod
    def validate(self, context: Dict[str, Any]) -> List[Issue]:
        pass

    def _create_issue(self, bag_id: Optional[str] = None, scan_id: Optional[str] = None,
                      teacher_id: Optional[str] = None, description: str = "",
                      details: Optional[Dict[str, Any]] = None) -> Issue:
        import uuid
        return Issue(
            issue_id=f"ISS-{uuid.uuid4().hex[:8].upper()}",
            rule_id=self.rule_id,
            rule_name=self.name,
            severity=self.severity,
            bag_id=bag_id,
            scan_id=scan_id,
            teacher_id=teacher_id,
            description=description,
            details=details or {}
        )


class DuplicateSignatureRule(BaseRule):
    def __init__(self):
        super().__init__(
            rule_id="duplicate_signature",
            name="重复签收检测",
            description="同一袋不允许在相同状态下被多次签收",
            severity=Severity.HIGH
        )

    def validate(self, context: Dict[str, Any]) -> List[Issue]:
        issues: List[Issue] = []
        bag_scans = context.get("bag_scans", [])
        bag_manifests = context.get("bag_manifests", {})

        scan_groups: Dict[str, Dict[str, List[Any]]] = {}
        for scan in bag_scans:
            bag_id = scan.bag_id
            action = scan.action
            if bag_id not in scan_groups:
                scan_groups[bag_id] = {}
            if action not in scan_groups[bag_id]:
                scan_groups[bag_id][action] = []
            scan_groups[bag_id][action].append(scan)

        for bag_id, action_scans in scan_groups.items():
            for action, scans in action_scans.items():
                if len(scans) > 1:
                    manifest = bag_manifests.get(bag_id)
                    subject = manifest.subject if manifest else "未知科目"
                    
                    for i in range(1, len(scans)):
                        scan = scans[i]
                        first_scan = scans[0]
                        issues.append(self._create_issue(
                            bag_id=bag_id,
                            scan_id=scan.scan_id,
                            teacher_id=scan.teacher_id,
                            description=f"试卷袋 [{bag_id}] 存在重复{action}操作，首次操作于 {first_scan.timestamp}",
                            details={
                                "action": action,
                                "first_scan_id": first_scan.scan_id,
                                "first_timestamp": first_scan.timestamp,
                                "duplicate_scan_id": scan.scan_id,
                                "duplicate_timestamp": scan.timestamp,
                                "subject": subject
                            }
                        ))

        return issues


class UnauthorizedAccessRule(BaseRule):
    def __init__(self):
        super().__init__(
            rule_id="unauthorized_access",
            name="越权领取检测",
            description="监考老师只能领取其授权考场的试卷袋",
            severity=Severity.CRITICAL
        )

    def validate(self, context: Dict[str, Any]) -> List[Issue]:
        issues: List[Issue] = []
        bag_scans = context.get("bag_scans", [])
        invigilators = context.get("invigilators", {})
        bag_manifests = context.get("bag_manifests", {})

        for scan in bag_scans:
            if scan.action not in ["领取", "发放", "启封", "收齐", "回收"]:
                continue

            teacher = invigilators.get(scan.teacher_id)
            manifest = bag_manifests.get(scan.bag_id)

            if not teacher:
                issues.append(self._create_issue(
                    bag_id=scan.bag_id,
                    scan_id=scan.scan_id,
                    teacher_id=scan.teacher_id,
                    description=f"未知监考老师 [{scan.teacher_id}] 执行{scan.action}操作",
                    details={
                        "action": scan.action,
                        "timestamp": scan.timestamp
                    }
                ))
                continue

            if not manifest:
                continue

            if teacher.role == "考务":
                continue

            if not teacher.is_authorized_for_room(manifest.room_id):
                issues.append(self._create_issue(
                    bag_id=scan.bag_id,
                    scan_id=scan.scan_id,
                    teacher_id=scan.teacher_id,
                    description=f"监考老师 [{teacher.name}({teacher.teacher_id})] 越权{scan.action}非授权考场 [{manifest.room_id}] 的试卷袋",
                    details={
                        "action": scan.action,
                        "teacher_name": teacher.name,
                        "teacher_role": teacher.role,
                        "authorized_rooms": ", ".join(teacher.authorized_rooms) if teacher.authorized_rooms else "无",
                        "target_room": manifest.room_id,
                        "subject": manifest.subject,
                        "timestamp": scan.timestamp
                    }
                ))

        return issues


class CrossCampusRule(BaseRule):
    def __init__(self):
        super().__init__(
            rule_id="cross_campus",
            name="跨校区归属检测",
            description="试卷袋流转操作人必须与袋所属校区一致",
            severity=Severity.HIGH
        )

    def validate(self, context: Dict[str, Any]) -> List[Issue]:
        issues: List[Issue] = []
        bag_scans = context.get("bag_scans", [])
        invigilators = context.get("invigilators", {})
        bag_manifests = context.get("bag_manifests", {})

        for scan in bag_scans:
            teacher = invigilators.get(scan.teacher_id)
            manifest = bag_manifests.get(scan.bag_id)

            if not teacher or not manifest:
                continue

            if teacher.campus != manifest.campus:
                issues.append(self._create_issue(
                    bag_id=scan.bag_id,
                    scan_id=scan.scan_id,
                    teacher_id=scan.teacher_id,
                    description=f"跨校区操作：老师 [{teacher.name}] 属于[{teacher.campus}]，但操作了属于[{manifest.campus}]的试卷袋 [{scan.bag_id}]",
                    details={
                        "action": scan.action,
                        "teacher_name": teacher.name,
                        "teacher_campus": teacher.campus,
                        "bag_campus": manifest.campus,
                        "room_id": manifest.room_id,
                        "subject": manifest.subject,
                        "timestamp": scan.timestamp
                    }
                ))

        return issues


class MidnightExamArchiveRule(BaseRule):
    def __init__(self):
        super().__init__(
            rule_id="midnight_exam_archive",
            name="跨午夜补考归档错位检测",
            description="跨午夜考试的归档日期应使用考试结束日期",
            severity=Severity.MEDIUM
        )

    def validate(self, context: Dict[str, Any]) -> List[Issue]:
        issues: List[Issue] = []
        bag_scans = context.get("bag_scans", [])
        bag_manifests = context.get("bag_manifests", {})
        exam_rooms = context.get("exam_rooms", {})

        archive_actions = ["归档"]
        
        for scan in bag_scans:
            if scan.action not in archive_actions:
                continue

            manifest = bag_manifests.get(scan.bag_id)
            if not manifest:
                continue

            if not manifest.is_midnight_exam:
                continue

            exam_date_value = manifest.exam_date
            if isinstance(exam_date_value, str):
                exam_date = datetime.strptime(exam_date_value, "%Y-%m-%d")
                exam_date_date = exam_date.date()
            elif isinstance(exam_date_value, date):
                exam_date_date = exam_date_value
                exam_date = datetime.combine(exam_date_value, datetime.min.time())
            else:
                continue

            scan_date = scan.dt.date()
            
            end_hour = int(manifest.exam_end_time.split(":")[0])
            expected_archive_date = exam_date_date
            if end_hour < 12:
                expected_archive_date = (exam_date + timedelta(days=1)).date()

            if scan_date != expected_archive_date:
                room = exam_rooms.get(manifest.room_id)
                issues.append(self._create_issue(
                    bag_id=scan.bag_id,
                    scan_id=scan.scan_id,
                    teacher_id=scan.teacher_id,
                    description=f"跨午夜考试归档日期错位：试卷袋 [{scan.bag_id}] 考试结束日期应为 [{expected_archive_date}]，但归档日期为 [{scan_date}]",
                    details={
                        "exam_date": manifest.exam_date,
                        "exam_time": manifest.exam_time,
                        "is_midnight_exam": True,
                        "expected_archive_date": expected_archive_date.strftime("%Y-%m-%d"),
                        "actual_archive_date": scan_date.strftime("%Y-%m-%d"),
                        "room_id": manifest.room_id,
                        "subject": manifest.subject,
                        "archive_timestamp": scan.timestamp
                    }
                ))

        return issues


class MissingTransitionRule(BaseRule):
    def __init__(self):
        super().__init__(
            rule_id="missing_transition",
            name="缺失流转节点检测",
            description="检测流转过程中缺失的必要状态转换",
            severity=Severity.HIGH
        )

    def validate(self, context: Dict[str, Any]) -> List[Issue]:
        issues: List[Issue] = []
        bag_scans = context.get("bag_scans", [])
        bag_manifests = context.get("bag_manifests", {})
        flow_rules = context.get("flow_rules", {}).get("flow_rules", {})

        bag_scans_grouped: Dict[str, List[Any]] = {}
        for scan in bag_scans:
            if scan.bag_id not in bag_scans_grouped:
                bag_scans_grouped[scan.bag_id] = []
            bag_scans_grouped[scan.bag_id].append(scan)

        for bag_id, scans in bag_scans_grouped.items():
            manifest = bag_manifests.get(bag_id)
            if not manifest:
                continue

            flow_rule = None
            if manifest.is_paper_bag:
                flow_rule = flow_rules.get("paper_bag_flow")
            elif manifest.is_answer_bag:
                flow_rule = flow_rules.get("answer_bag_flow")

            if not flow_rule:
                continue

            scans.sort(key=lambda x: x.dt)
            
            current_state = "SEALED"
            expected_states = [flow_rule.states[0]]
            executed_actions = [s.action for s in scans]

            for i, scan in enumerate(scans):
                action = scan.action
                next_state = flow_rule.get_next_state(current_state, action)

                if next_state is None:
                    issues.append(self._create_issue(
                        bag_id=bag_id,
                        scan_id=scan.scan_id,
                        teacher_id=scan.teacher_id,
                        description=f"试卷袋 [{bag_id}] 存在无效流转：当前状态 [{current_state}] 无法执行 [{action}] 操作",
                        details={
                            "current_state": current_state,
                            "action": action,
                            "timestamp": scan.timestamp,
                            "valid_actions_from_current": list(flow_rule.transition_map.get(current_state, {}).keys())
                        }
                    ))
                    continue

                current_state = next_state
                if next_state not in expected_states:
                    expected_states.append(next_state)

            final_state = current_state
            all_states = flow_rule.states
            final_expected_state = all_states[-1]

            if final_state != final_expected_state and len(scans) > 0:
                last_scan = scans[-1]
                remaining_states = []
                found_current = False
                for state in all_states:
                    if state == final_state:
                        found_current = True
                        continue
                    if found_current:
                        remaining_states.append(state)

                if remaining_states:
                    issues.append(self._create_issue(
                        bag_id=bag_id,
                        scan_id=last_scan.scan_id,
                        teacher_id=last_scan.teacher_id,
                        description=f"试卷袋 [{bag_id}] 流转未完成：当前状态 [{final_state}]，缺失后续状态 [{', '.join(remaining_states)}]",
                        details={
                            "current_state": final_state,
                            "missing_states": ", ".join(remaining_states),
                            "last_action": last_scan.action,
                            "last_timestamp": last_scan.timestamp,
                            "subject": manifest.subject
                        }
                    ))

        return issues


class TimeViolationRule(BaseRule):
    def __init__(self):
        super().__init__(
            rule_id="time_violation",
            name="时间窗口违规检测",
            description="检测操作是否在规定的时间窗口内进行",
            severity=Severity.MEDIUM
        )

    def validate(self, context: Dict[str, Any]) -> List[Issue]:
        issues: List[Issue] = []
        bag_scans = context.get("bag_scans", [])
        bag_manifests = context.get("bag_manifests", {})
        exam_rooms = context.get("exam_rooms", {})

        for scan in bag_scans:
            manifest = bag_manifests.get(scan.bag_id)
            if not manifest:
                continue

            room = exam_rooms.get(manifest.room_id)
            if not room:
                continue

            exam_start_dt = self._parse_exam_time(manifest.exam_date, room.exam_start_time)
            exam_end_dt = self._parse_exam_time(manifest.exam_date, room.exam_end_time)

            is_violation = False
            violation_type = ""
            time_window = ""

            action = scan.action
            scan_dt = scan.dt

            if action == "领取" or action == "发放":
                earliest = exam_start_dt - timedelta(minutes=30)
                latest = exam_start_dt - timedelta(minutes=10)
                time_window = "考前30分钟 - 考前10分钟"
                if scan_dt < earliest or scan_dt > latest:
                    is_violation = True
                    violation_type = "领取/发放时间违规"

            elif action == "启封":
                earliest = exam_start_dt - timedelta(minutes=10)
                latest = exam_start_dt + timedelta(minutes=5)
                time_window = "考前10分钟 - 考试开始后5分钟"
                if scan_dt < earliest or scan_dt > latest:
                    is_violation = True
                    violation_type = "启封时间违规"

            elif action == "收齐" or action == "回收":
                latest = exam_end_dt + timedelta(minutes=10)
                time_window = "考试结束后10分钟内"
                if scan_dt > latest:
                    is_violation = True
                    violation_type = "收齐/回收时间违规"

            elif action == "归档":
                latest = exam_end_dt.replace(hour=20, minute=0, second=0)
                if manifest.is_midnight_exam:
                    end_hour = int(manifest.exam_end_time.split(":")[0])
                    if end_hour < 12:
                        latest = (exam_end_dt + timedelta(days=1)).replace(hour=20, minute=0, second=0)
                time_window = "考试当天20:00前"
                if scan_dt > latest:
                    is_violation = True
                    violation_type = "归档时间违规"

            if is_violation:
                issues.append(self._create_issue(
                    bag_id=scan.bag_id,
                    scan_id=scan.scan_id,
                    teacher_id=scan.teacher_id,
                    description=f"试卷袋 [{scan.bag_id}] {violation_type}：操作时间 [{scan.timestamp}] 不在规定时间窗口 [{time_window}] 内",
                    details={
                        "action": action,
                        "violation_type": violation_type,
                        "actual_time": scan.timestamp,
                        "required_window": time_window,
                        "exam_start": exam_start_dt.strftime("%Y-%m-%d %H:%M:%S"),
                        "exam_end": exam_end_dt.strftime("%Y-%m-%d %H:%M:%S"),
                        "subject": manifest.subject
                    }
                ))

        return issues

    def _parse_exam_time(self, date_value, time_str: str) -> datetime:
        if isinstance(date_value, str):
            dt = datetime.strptime(date_value, "%Y-%m-%d")
        elif isinstance(date_value, date):
            dt = datetime.combine(date_value, datetime.min.time())
        else:
            dt = datetime.now()
        hour, minute = map(int, time_str.split(":"))
        return dt.replace(hour=hour, minute=minute)


class RuleEngine:
    def __init__(self):
        self.rules: List[BaseRule] = [
            DuplicateSignatureRule(),
            UnauthorizedAccessRule(),
            CrossCampusRule(),
            MidnightExamArchiveRule(),
            MissingTransitionRule(),
            TimeViolationRule()
        ]

    def add_rule(self, rule: BaseRule):
        self.rules.append(rule)

    def run_all(self, context: Dict[str, Any]) -> Dict[str, Any]:
        all_issues: List[Issue] = []
        rule_results: Dict[str, Dict[str, Any]] = {}

        for rule in self.rules:
            issues = rule.validate(context)
            all_issues.extend(issues)
            rule_results[rule.rule_id] = {
                "name": rule.name,
                "description": rule.description,
                "severity": rule.severity.value,
                "issue_count": len(issues),
                "issues": issues
            }

        all_issues.sort(key=lambda x: (
            0 if x.severity == Severity.CRITICAL else
            1 if x.severity == Severity.HIGH else
            2 if x.severity == Severity.MEDIUM else 3
        ))

        critical = [i for i in all_issues if i.severity == Severity.CRITICAL]
        high = [i for i in all_issues if i.severity == Severity.HIGH]
        medium = [i for i in all_issues if i.severity == Severity.MEDIUM]
        low = [i for i in all_issues if i.severity == Severity.LOW]

        return {
            "all_issues": all_issues,
            "rule_results": rule_results,
            "summary": {
                "total": len(all_issues),
                "critical": len(critical),
                "high": len(high),
                "medium": len(medium),
                "low": len(low)
            },
            "by_severity": {
                "critical": critical,
                "high": high,
                "medium": medium,
                "low": low
            }
        }
