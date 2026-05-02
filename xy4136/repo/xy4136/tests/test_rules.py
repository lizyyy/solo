import pytest
from datetime import datetime, timedelta
from typing import List

from access_arbiter.models import CardSwipeEvent, PermissionRecord, ZoneDefinition, Direction
from access_arbiter.timeline import TimelineMerger, DeviceTimeOffset, MergedEvent
from access_arbiter.rules import (
    RuleEngine,
    RuleCheckResult,
    RuleViolation,
    ViolationType,
    ViolationSeverity
)


class TestRuleEngine:
    def create_permission(self, card_id: str, name: str, zones: List[str], 
                          is_active: bool = True, 
                          valid_until: str = "2026-12-31") -> PermissionRecord:
        return PermissionRecord(
            card_id=card_id,
            person_name=name,
            person_id=card_id.replace("C", "E"),
            department="测试部门",
            group="普通员工",
            allowed_zones=zones,
            valid_from=datetime(2026, 1, 1),
            valid_until=datetime(2026, 12, 31) if valid_until == "2026-12-31" else datetime.strptime(valid_until, "%Y-%m-%d"),
            is_active=is_active
        )
    
    def create_zone(self, zone_id: str, name: str, apb_enabled: bool = True) -> ZoneDefinition:
        return ZoneDefinition(
            zone_id=zone_id,
            name=name,
            description="",
            anti_passback_enabled=apb_enabled,
            re_entry_grace_minutes=5
        )
    
    def create_event(self, device_id: str, card_id: str, timestamp: str, 
                     zone_id: str, direction: Direction = Direction.IN) -> CardSwipeEvent:
        return CardSwipeEvent(
            device_id=device_id,
            card_id=card_id,
            timestamp=timestamp,
            zone_id=zone_id,
            direction=direction
        )
    
    def create_merged_event(self, event: CardSwipeEvent, order: int = 0) -> MergedEvent:
        return MergedEvent(
            original_event=event,
            corrected_timestamp=event.timestamp,
            device_offset_seconds=0,
            timeline_order=order,
            source_device=event.device_id
        )
    
    def test_unauthorized_person(self):
        permissions = [
            self.create_permission("C001", "张三", ["main_gate"])
        ]
        zones = [self.create_zone("main_gate", "正门")]
        
        engine = RuleEngine(permissions, zones)
        
        events = [
            self.create_merged_event(self.create_event("D1", "C999", "2026-05-01 08:00:00", "main_gate"))
        ]
        
        result = engine.check_all(events)
        
        assert len(result.violations) == 1
        assert result.violations[0].violation_type == ViolationType.UNAUTHORIZED_PERSON
        assert result.violations[0].severity == ViolationSeverity.CRITICAL
    
    def test_revoked_card(self):
        permissions = [
            self.create_permission("C004", "赵六", ["main_gate"], is_active=False)
        ]
        zones = [self.create_zone("main_gate", "正门")]
        
        engine = RuleEngine(permissions, zones)
        
        events = [
            self.create_merged_event(self.create_event("D1", "C004", "2026-05-01 08:00:00", "main_gate"))
        ]
        
        result = engine.check_all(events)
        
        assert len(result.violations) >= 1
        revoked_violations = [v for v in result.violations if v.violation_type == ViolationType.REVOKED_CARD]
        assert len(revoked_violations) == 1
        assert revoked_violations[0].severity == ViolationSeverity.CRITICAL
    
    def test_zone_mismatch(self):
        permissions = [
            self.create_permission("C002", "李四", ["main_gate", "meeting_room"])
        ]
        zones = [
            self.create_zone("main_gate", "正门"),
            self.create_zone("server_room", "机房")
        ]
        
        engine = RuleEngine(permissions, zones)
        
        events = [
            self.create_merged_event(self.create_event("D1", "C002", "2026-05-01 08:00:00", "server_room"))
        ]
        
        result = engine.check_all(events)
        
        zone_violations = [v for v in result.violations if v.violation_type == ViolationType.ZONE_MISMATCH]
        assert len(zone_violations) == 1
        assert zone_violations[0].severity == ViolationSeverity.HIGH
    
    def test_expired_permission(self):
        permissions = [
            self.create_permission("C004", "赵六", ["main_gate"], is_active=True, valid_until="2026-04-30")
        ]
        zones = [self.create_zone("main_gate", "正门")]
        
        engine = RuleEngine(permissions, zones)
        
        events = [
            self.create_merged_event(self.create_event("D1", "C004", "2026-05-01 08:00:00", "main_gate"))
        ]
        
        result = engine.check_all(events)
        
        expired_violations = [v for v in result.violations if v.violation_type == ViolationType.EXPIRED_PERMISSION]
        assert len(expired_violations) == 1
    
    def test_duplicate_swipe(self):
        permissions = [
            self.create_permission("C001", "张三", ["main_gate"])
        ]
        zones = [self.create_zone("main_gate", "正门")]
        
        engine = RuleEngine(permissions, zones, duplicate_swipe_window_seconds=60)
        
        events = [
            self.create_merged_event(self.create_event("D1", "C001", "2026-05-01 08:00:00", "main_gate"), 0),
            self.create_merged_event(self.create_event("D1", "C001", "2026-05-01 08:00:30", "main_gate"), 1),
        ]
        
        result = engine.check_all(events)
        
        duplicate_violations = [v for v in result.violations if v.violation_type == ViolationType.DUPLICATE_SWIPE]
        assert len(duplicate_violations) >= 1
    
    def test_anti_passback_violation(self):
        permissions = [
            self.create_permission("C001", "张三", ["main_gate"])
        ]
        zones = [self.create_zone("main_gate", "正门", apb_enabled=True)]
        
        engine = RuleEngine(permissions, zones, anti_passback_enabled=True)
        
        events = [
            self.create_merged_event(self.create_event("D1", "C001", "2026-05-01 08:00:00", "main_gate", Direction.IN), 0),
            self.create_merged_event(self.create_event("D1", "C001", "2026-05-01 09:00:00", "main_gate", Direction.IN), 1),
        ]
        
        result = engine.check_all(events)
        
        apb_violations = [v for v in result.violations if v.violation_type == ViolationType.ANTI_PASSBACK_VIOLATION]
        assert len(apb_violations) == 1
        assert apb_violations[0].severity == ViolationSeverity.HIGH
    
    def test_valid_anti_passback_sequence(self):
        permissions = [
            self.create_permission("C001", "张三", ["main_gate"])
        ]
        zones = [self.create_zone("main_gate", "正门", apb_enabled=True)]
        
        engine = RuleEngine(permissions, zones, anti_passback_enabled=True)
        
        events = [
            self.create_merged_event(self.create_event("D1", "C001", "2026-05-01 08:00:00", "main_gate", Direction.IN), 0),
            self.create_merged_event(self.create_event("D1", "C001", "2026-05-01 09:00:00", "main_gate", Direction.OUT), 1),
            self.create_merged_event(self.create_event("D1", "C001", "2026-05-01 10:00:00", "main_gate", Direction.IN), 2),
        ]
        
        result = engine.check_all(events)
        
        apb_violations = [v for v in result.violations if v.violation_type == ViolationType.ANTI_PASSBACK_VIOLATION]
        assert len(apb_violations) == 0
    
    def test_count_by_severity(self):
        permissions = [
            self.create_permission("C001", "张三", ["main_gate"])
        ]
        zones = [self.create_zone("main_gate", "正门")]
        
        engine = RuleEngine(permissions, zones)
        
        events = [
            self.create_merged_event(self.create_event("D1", "C999", "2026-05-01 08:00:00", "main_gate"), 0),
            self.create_merged_event(self.create_event("D1", "C001", "2026-05-01 08:00:10", "main_gate"), 1),
            self.create_merged_event(self.create_event("D1", "C001", "2026-05-01 08:00:20", "main_gate"), 2),
        ]
        
        result = engine.check_all(events)
        
        counts = result.count_by_severity()
        assert counts.get(ViolationSeverity.CRITICAL, 0) >= 1
        assert counts.get(ViolationSeverity.MEDIUM, 0) >= 1
    
    def test_wildcard_zone_permission(self):
        permissions = [
            self.create_permission("C006", "周八", ["*"])
        ]
        zones = [
            self.create_zone("main_gate", "正门"),
            self.create_zone("server_room", "机房"),
            self.create_zone("finance_room", "财务室")
        ]
        
        engine = RuleEngine(permissions, zones)
        
        events = [
            self.create_merged_event(self.create_event("D1", "C006", "2026-05-01 08:00:00", "server_room"), 0),
            self.create_merged_event(self.create_event("D1", "C006", "2026-05-01 09:00:00", "finance_room"), 1),
        ]
        
        result = engine.check_all(events)
        
        zone_violations = [v for v in result.violations if v.violation_type == ViolationType.ZONE_MISMATCH]
        assert len(zone_violations) == 0
