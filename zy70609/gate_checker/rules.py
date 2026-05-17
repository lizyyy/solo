from datetime import datetime, date
from typing import List, Dict, Optional
from collections import defaultdict

from .models import (
    GateEvent, PersonProfile, VisitorApplication, TrainingRecord, BlacklistRecord,
    CheckResult, RuleResult, RuleResultType, PersonType, TrainingStatus
)


class RuleEngine:
    def __init__(self):
        self.rules = [
            self.rule_blacklist_check,
            self.rule_visitor_time_check,
            self.rule_training_status_check,
            self.rule_person_profile_check
        ]

    def rule_blacklist_check(self, event: GateEvent, blacklist_records: List[BlacklistRecord], **kwargs) -> Optional[RuleResult]:
        active_blacklist = [r for r in blacklist_records if r.is_active]
        if active_blacklist:
            reasons = "; ".join([r.reason for r in active_blacklist if r.reason])
            return RuleResult(
                rule_name="黑名单拦截",
                result_type=RuleResultType.BLOCK,
                message=f"人员[{event.name}]在黑名单中，原因: {reasons or '未填写'}",
                details={"blacklist_count": len(active_blacklist)}
            )
        return None

    def rule_visitor_time_check(self, event: GateEvent, person: Optional[PersonProfile], 
                                visitor_apps: List[VisitorApplication], **kwargs) -> Optional[RuleResult]:
        if person and person.person_type != PersonType.VISITOR:
            return None
        
        valid_apps = [app for app in visitor_apps if app.approved and app.start_time <= event.event_time <= app.end_time]
        
        if not visitor_apps:
            return RuleResult(
                rule_name="访客申请检查",
                result_type=RuleResultType.BLOCK,
                message=f"访客[{event.name}]无有效访客申请记录",
                details={"has_application": False}
            )
        
        if not valid_apps:
            invalid_app = visitor_apps[0]
            return RuleResult(
                rule_name="访客时段校验",
                result_type=RuleResultType.BLOCK,
                message=f"访客[{event.name}]通行时间[{event.event_time}]不在申请时段[{invalid_app.start_time}~{invalid_app.end_time}]内",
                details={
                    "event_time": event.event_time.isoformat(),
                    "application_start": invalid_app.start_time.isoformat(),
                    "application_end": invalid_app.end_time.isoformat()
                }
            )
        
        return RuleResult(
            rule_name="访客时段校验",
            result_type=RuleResultType.PASS,
            message=f"访客[{event.name}]通行时间在有效申请时段内",
            details={"valid_applications": len(valid_apps)}
        )

    def rule_training_status_check(self, event: GateEvent, training_records: List[TrainingRecord], **kwargs) -> Optional[RuleResult]:
        if not training_records:
            return RuleResult(
                rule_name="安全培训状态",
                result_type=RuleResultType.WARN,
                message=f"人员[{event.name}]无安全培训记录",
                details={"has_training": False}
            )
        
        today = date.today()
        passed_trainings = []
        expired_trainings = []
        other_trainings = []
        
        for record in training_records:
            if record.status == TrainingStatus.PASSED:
                if record.valid_until and record.valid_until < today:
                    expired_trainings.append(record)
                else:
                    passed_trainings.append(record)
            else:
                other_trainings.append(record)
        
        if passed_trainings:
            return RuleResult(
                rule_name="安全培训状态",
                result_type=RuleResultType.PASS,
                message=f"人员[{event.name}]安全培训状态有效",
                details={"passed_count": len(passed_trainings)}
            )
        
        if expired_trainings:
            return RuleResult(
                rule_name="安全培训状态",
                result_type=RuleResultType.BLOCK,
                message=f"人员[{event.name}]安全培训已过期，过期日期: {expired_trainings[0].valid_until}",
                details={"expired_count": len(expired_trainings)}
            )
        
        record = training_records[0]
        return RuleResult(
            rule_name="安全培训状态",
            result_type=RuleResultType.BLOCK,
            message=f"人员[{event.name}]安全培训未通过，当前状态: {record.status.value}",
            details={"current_status": record.status.value}
        )

    def rule_person_profile_check(self, event: GateEvent, person: Optional[PersonProfile], **kwargs) -> Optional[RuleResult]:
        if not person:
            return RuleResult(
                rule_name="人员档案校验",
                result_type=RuleResultType.WARN,
                message=f"未找到人员[{event.name}]的档案信息",
                details={"has_profile": False}
            )
        return RuleResult(
            rule_name="人员档案校验",
            result_type=RuleResultType.PASS,
            message=f"人员[{event.name}]档案信息完整",
            details={"person_type": person.person_type.value}
        )

    def deduplicate_events(self, events: List[GateEvent]) -> List[GateEvent]:
        event_groups: Dict[str, List[GateEvent]] = defaultdict(list)
        
        sorted_events = sorted(events, key=lambda e: (e.person_id, e.event_time, e.event_id))
        
        for event in sorted_events:
            key = f"{event.person_id}_{event.event_time.strftime('%Y%m%d%H%M%S')}_{event.gate_name}"
            event_groups[key].append(event)
        
        result = []
        for group in event_groups.values():
            if len(group) > 1:
                group[0].is_duplicate = False
                result.append(group[0])
                for dup_event in group[1:]:
                    dup_event.is_duplicate = True
                    dup_event.duplicate_of = group[0].event_id
                    result.append(dup_event)
            else:
                result.append(group[0])
        
        return sorted(result, key=lambda e: e.event_time)

    def process_event(self, event: GateEvent, persons_map: Dict[str, PersonProfile],
                     visitor_apps_map: Dict[str, List[VisitorApplication]],
                     training_map: Dict[str, List[TrainingRecord]],
                     blacklist_map: Dict[str, List[BlacklistRecord]]) -> CheckResult:
        person = persons_map.get(event.person_id)
        visitor_apps = visitor_apps_map.get(event.person_id, [])
        training_records = training_map.get(event.person_id, [])
        blacklist_records = blacklist_map.get(event.person_id, [])
        
        rule_results: List[RuleResult] = []
        
        for rule in self.rules:
            result = rule(
                event=event,
                person=person,
                visitor_apps=visitor_apps,
                training_records=training_records,
                blacklist_records=blacklist_records
            )
            if result:
                rule_results.append(result)
        
        block_results = [r for r in rule_results if r.result_type == RuleResultType.BLOCK]
        warn_results = [r for r in rule_results if r.result_type == RuleResultType.WARN]
        
        if block_results:
            final_status = RuleResultType.BLOCK
            final_message = "; ".join([r.message for r in block_results])
        elif warn_results:
            final_status = RuleResultType.WARN
            final_message = "; ".join([r.message for r in warn_results])
        else:
            final_status = RuleResultType.PASS
            final_message = "所有规则校验通过"
        
        return CheckResult(
            event=event,
            person=person,
            visitor_app=visitor_apps[0] if visitor_apps else None,
            training_records=training_records,
            blacklist_records=blacklist_records,
            rule_results=rule_results,
            final_status=final_status,
            final_message=final_message
        )

    def process_all(self, events: List[GateEvent], persons: List[PersonProfile],
                   visitor_apps: List[VisitorApplication], training_records: List[TrainingRecord],
                   blacklist_records: List[BlacklistRecord]) -> List[CheckResult]:
        persons_map = {p.person_id: p for p in persons}
        
        visitor_apps_map: Dict[str, List[VisitorApplication]] = defaultdict(list)
        for app in visitor_apps:
            visitor_apps_map[app.person_id].append(app)
        
        training_map: Dict[str, List[TrainingRecord]] = defaultdict(list)
        for record in training_records:
            training_map[record.person_id].append(record)
        
        blacklist_map: Dict[str, List[BlacklistRecord]] = defaultdict(list)
        for record in blacklist_records:
            blacklist_map[record.person_id].append(record)
        
        dedup_events = self.deduplicate_events(events)
        
        results = []
        for event in dedup_events:
            if event.is_duplicate:
                continue
            result = self.process_event(
                event, persons_map, visitor_apps_map, training_map, blacklist_map
            )
            results.append(result)
        
        return results
