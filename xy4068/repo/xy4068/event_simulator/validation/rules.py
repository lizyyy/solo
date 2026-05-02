from abc import ABC, abstractmethod
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from event_simulator.models.event import Event
from event_simulator.models.jitter_rule import JitterRule


class ValidationError:
    def __init__(
        self,
        rule_name: str,
        error_type: str,
        message: str,
        severity: str = "error",
        location: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        self.rule_name = rule_name
        self.error_type = error_type
        self.message = message
        self.severity = severity
        self.location = location or {}
        self.context = context or {}
        self.timestamp = datetime.now()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_name": self.rule_name,
            "error_type": self.error_type,
            "message": self.message,
            "severity": self.severity,
            "location": self.location,
            "context": self.context,
            "timestamp": self.timestamp.isoformat(),
        }


class ValidationRule(ABC):
    def __init__(self, name: str, enabled: bool = True):
        self.name = name
        self.enabled = enabled
    
    @abstractmethod
    def validate(self, events: List[Event], **kwargs) -> List[ValidationError]:
        pass
    
    def create_error(
        self,
        error_type: str,
        message: str,
        severity: str = "error",
        location: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> ValidationError:
        return ValidationError(
            rule_name=self.name,
            error_type=error_type,
            message=message,
            severity=severity,
            location=location,
            context=context,
        )


class OutOfOrderRule(ValidationRule):
    def __init__(self):
        super().__init__("out_of_order")
    
    def validate(self, events: List[Event], **kwargs) -> List[ValidationError]:
        errors = []
        
        if len(events) < 2:
            return errors
        
        sorted_events = sorted(events, key=lambda e: e.timestamp)
        sorted_indices = {e.id: i for i, e in enumerate(sorted_events)}
        
        prev_timestamp = None
        for index, event in enumerate(events):
            if prev_timestamp is not None:
                if event.timestamp < prev_timestamp:
                    sorted_pos = sorted_indices.get(event.id, index)
                    errors.append(self.create_error(
                        error_type="timestamp_out_of_order",
                        message=f"事件时间戳乱序: 当前 {event.timestamp} < 前一 {prev_timestamp}",
                        severity="error",
                        location={
                            "event_index": index,
                            "event_id": event.id,
                            "sorted_position": sorted_pos,
                        },
                        context={
                            "current_timestamp": event.timestamp.isoformat(),
                            "previous_timestamp": prev_timestamp.isoformat(),
                            "event_type": event.event_type,
                            "camera_id": event.camera_id,
                        },
                    ))
            prev_timestamp = event.timestamp
        
        return errors


class DuplicateRule(ValidationRule):
    def __init__(self):
        super().__init__("duplicate")
    
    def validate(self, events: List[Event], **kwargs) -> List[ValidationError]:
        errors = []
        
        id_counts: Dict[str, List[int]] = defaultdict(list)
        footprint_counts: Dict[str, List[int]] = defaultdict(list)
        
        for index, event in enumerate(events):
            id_counts[event.id].append(index)
            
            footprint = event.get_footprint()
            footprint_counts[footprint].append(index)
        
        for event_id, indices in id_counts.items():
            if len(indices) > 1:
                errors.append(self.create_error(
                    error_type="duplicate_event_id",
                    message=f"事件ID重复: {event_id} 出现在位置 {indices}",
                    severity="error",
                    location={
                        "event_id": event_id,
                        "indices": indices,
                    },
                ))
        
        for footprint, indices in footprint_counts.items():
            if len(indices) > 1:
                errors.append(self.create_error(
                    error_type="duplicate_footprint",
                    message=f"事件特征重复: '{footprint}' 出现在位置 {indices}",
                    severity="warning",
                    location={
                        "footprint": footprint,
                        "indices": indices,
                    },
                ))
        
        return errors


class MissingFieldRule(ValidationRule):
    REQUIRED_FIELDS = ["id", "event_type", "timestamp", "camera_id"]
    
    def __init__(self):
        super().__init__("missing_field")
    
    def validate(self, events: List[Event], **kwargs) -> List[ValidationError]:
        errors = []
        
        additional_required = kwargs.get("additional_required", [])
        all_required = self.REQUIRED_FIELDS + additional_required
        
        for index, event in enumerate(events):
            event_dict = event.to_dict()
            
            for field in all_required:
                value = event_dict.get(field)
                if value is None or value == "":
                    errors.append(self.create_error(
                        error_type="missing_required_field",
                        message=f"缺少必填字段: {field}",
                        severity="error",
                        location={
                            "event_index": index,
                            "event_id": event.id,
                            "field": field,
                        },
                        context={
                            "event_type": event.event_type,
                            "camera_id": event.camera_id,
                        },
                    ))
            
            if event.payload:
                pass
        
        return errors


class RuleConflictRule(ValidationRule):
    def __init__(self):
        super().__init__("rule_conflict")
    
    def validate(self, events: List[Event], **kwargs) -> List[ValidationError]:
        errors = []
        
        jitter_rules: Optional[List[JitterRule]] = kwargs.get("jitter_rules")
        if not jitter_rules:
            return errors
        
        rule_by_type: Dict[str, List[JitterRule]] = defaultdict(list)
        for rule in jitter_rules:
            if rule.enabled:
                rule_by_type[rule.jitter_type].append(rule)
        
        for jitter_type, rules in rule_by_type.items():
            if len(rules) <= 1:
                continue
            
            for i, rule1 in enumerate(rules):
                for rule2 in rules[i + 1:]:
                    overlap = self._check_overlap(rule1, rule2)
                    if overlap:
                        errors.append(self.create_error(
                            error_type="jitter_rule_conflict",
                            message=f"抖动规则冲突: '{rule1.name}' 与 '{rule2.name}' 在目标/时间上重叠",
                            severity="warning",
                            location={
                                "rule1_id": rule1.id,
                                "rule1_name": rule1.name,
                                "rule2_id": rule2.id,
                                "rule2_name": rule2.name,
                            },
                            context={
                                "jitter_type": jitter_type,
                                "overlap_type": overlap,
                            },
                        ))
        
        return errors
    
    def _check_overlap(self, rule1: JitterRule, rule2: JitterRule) -> Optional[str]:
        cameras1 = set(rule1.target_cameras)
        cameras2 = set(rule2.target_cameras)
        
        camera_overlap = False
        if not cameras1 or not cameras2:
            camera_overlap = True
        elif cameras1 & cameras2:
            camera_overlap = True
        
        if not camera_overlap:
            return None
        
        events1 = set(rule1.target_event_types)
        events2 = set(rule2.target_event_types)
        
        event_overlap = False
        if not events1 or not events2:
            event_overlap = True
        elif events1 & events2:
            event_overlap = True
        
        if not event_overlap:
            return None
        
        time_overlap = self._check_time_window_overlap(rule1, rule2)
        
        overlaps = []
        if camera_overlap:
            overlaps.append("camera")
        if event_overlap:
            overlaps.append("event_type")
        if time_overlap:
            overlaps.append("time_window")
        
        return ",".join(overlaps) if overlaps else None
    
    def _check_time_window_overlap(self, rule1: JitterRule, rule2: JitterRule) -> bool:
        windows1 = rule1.time_windows
        windows2 = rule2.time_windows
        
        if not windows1 and not windows2:
            return True
        if not windows1 or not windows2:
            return True
        
        for w1 in windows1:
            s1 = w1.get("start_offset", 0)
            e1 = w1.get("end_offset", 999999999)
            for w2 in windows2:
                s2 = w2.get("start_offset", 0)
                e2 = w2.get("end_offset", 999999999)
                
                if s1 <= e2 and s2 <= e1:
                    return True
        
        return False
