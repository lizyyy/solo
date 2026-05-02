import pytest
from datetime import datetime
from typing import Dict, List

from access_gate_cli.parser.csv_parser import Personnel, AccessRequest
from access_gate_cli.parser.yaml_parser import Zone, Device, ZoneRules
from access_gate_cli.parser.jsonl_parser import DeviceClock
from access_gate_cli.rules.engine import (
    RulesEngine,
    ValidationResult,
    Violation,
    ViolationType,
    ViolationSeverity
)


def create_test_personnel() -> Dict[str, Personnel]:
    return {
        "P001": Personnel(
            personnel_id="P001",
            name="张三",
            department="工程部",
            card_id="CARD001",
            role="engineer"
        ),
        "P002": Personnel(
            personnel_id="P002",
            name="李四",
            department="安保部",
            card_id="CARD002",
            role="security"
        ),
        "P003": Personnel(
            personnel_id="P003",
            name="王五",
            department="访客",
            card_id="CARD003",
            role="visitor"
        ),
    }


def create_test_zone_rules() -> ZoneRules:
    zones = {
        "Z001": Zone(
            zone_id="Z001",
            zone_name="主大门",
            device_ids=["DEV001"],
            allowed_roles=["engineer", "security", "admin", "visitor"],
            time_windows=[
                {"start_time": "08:00", "end_time": "20:00", "days": [0, 1, 2, 3, 4, 5, 6]}
            ],
            mutex_zones=[]
        ),
        "Z002": Zone(
            zone_id="Z002",
            zone_name="设备机房",
            device_ids=["DEV002"],
            allowed_roles=["engineer", "admin"],
            time_windows=[
                {"start_time": "09:00", "end_time": "18:00", "days": [0, 1, 2, 3, 4]}
            ],
            mutex_zones=["Z003"]
        ),
        "Z003": Zone(
            zone_id="Z003",
            zone_name="数据中心",
            device_ids=["DEV003"],
            allowed_roles=["engineer", "admin"],
            time_windows=[
                {"start_time": "10:00", "end_time": "17:00", "days": [0, 1, 2, 3, 4]}
            ],
            mutex_zones=["Z002"]
        ),
    }
    
    devices = {
        "DEV001": Device(
            device_id="DEV001",
            device_name="主大门控制器",
            location="园区正门",
            hmac_key="test_key_001",
            clock_drift_threshold_seconds=300
        ),
        "DEV002": Device(
            device_id="DEV002",
            device_name="设备机房控制器",
            location="负一楼",
            hmac_key="test_key_002",
            clock_drift_threshold_seconds=300
        ),
        "DEV003": Device(
            device_id="DEV003",
            device_name="数据中心控制器",
            location="二楼",
            hmac_key="test_key_003",
            clock_drift_threshold_seconds=120
        ),
    }
    
    zone_to_devices = {
        "Z001": ["DEV001"],
        "Z002": ["DEV002"],
        "Z003": ["DEV003"],
    }
    
    return ZoneRules(
        zones=zones,
        devices=devices,
        zone_to_devices=zone_to_devices
    )


def create_test_device_clocks() -> Dict[str, DeviceClock]:
    return {
        "DEV001": DeviceClock(
            device_id="DEV001",
            device_time=datetime(2024, 5, 15, 10, 0, 0),
            server_time=datetime(2024, 5, 15, 10, 0, 0),
            drift_seconds=0.0
        ),
        "DEV002": DeviceClock(
            device_id="DEV002",
            device_time=datetime(2024, 5, 15, 10, 2, 30),
            server_time=datetime(2024, 5, 15, 10, 0, 0),
            drift_seconds=150.0
        ),
        "DEV003": DeviceClock(
            device_id="DEV003",
            device_time=datetime(2024, 5, 15, 10, 3, 0),
            server_time=datetime(2024, 5, 15, 10, 0, 0),
            drift_seconds=180.0
        ),
    }


class TestRulesEngine:
    def test_valid_request_passes(self):
        personnel = create_test_personnel()
        zone_rules = create_test_zone_rules()
        device_clocks = create_test_device_clocks()
        
        engine = RulesEngine(
            zone_rules=zone_rules,
            personnel=personnel,
            device_clocks=device_clocks
        )
        
        request = AccessRequest(
            request_id="REQ001",
            personnel_id="P001",
            zone_id="Z001",
            start_time=datetime(2024, 5, 15, 9, 0, 0),
            end_time=datetime(2024, 5, 15, 18, 0, 0),
            request_type="grant",
            priority=0
        )
        
        result = engine.validate_all_requests([request])
        
        for v in result.violations:
            if v.request_id == "REQ001":
                assert False, f"Expected no violations for valid request, but got: {v.message}"
        
        engine2 = RulesEngine(
            zone_rules=zone_rules,
            personnel=personnel,
            device_clocks=device_clocks
        )
        result2 = engine2.validate_all_requests([request])
        has_blocking = False
        for v in result2.violations:
            if v.request_id == "REQ001" and v.severity in [ViolationSeverity.CRITICAL, ViolationSeverity.HIGH]:
                has_blocking = True
                break
        assert not has_blocking, "Valid request should not have blocking violations"
    
    def test_role_not_allowed(self):
        personnel = create_test_personnel()
        zone_rules = create_test_zone_rules()
        device_clocks = create_test_device_clocks()
        
        engine = RulesEngine(
            zone_rules=zone_rules,
            personnel=personnel,
            device_clocks=device_clocks
        )
        
        request = AccessRequest(
            request_id="REQ001",
            personnel_id="P003",
            zone_id="Z002",
            start_time=datetime(2024, 5, 15, 10, 0, 0),
            end_time=datetime(2024, 5, 15, 16, 0, 0),
            request_type="grant",
            priority=0
        )
        
        result = engine.validate_all_requests([request])
        
        violation_found = False
        for v in result.violations:
            if v.violation_type == ViolationType.ROLE_NOT_ALLOWED:
                violation_found = True
                assert v.personnel_id == "P003"
                assert v.zone_id == "Z002"
                break
        
        assert violation_found, "Should have detected role not allowed violation"
    
    def test_time_window_violation(self):
        personnel = create_test_personnel()
        zone_rules = create_test_zone_rules()
        device_clocks = create_test_device_clocks()
        
        engine = RulesEngine(
            zone_rules=zone_rules,
            personnel=personnel,
            device_clocks=device_clocks
        )
        
        request = AccessRequest(
            request_id="REQ001",
            personnel_id="P001",
            zone_id="Z001",
            start_time=datetime(2024, 5, 15, 21, 0, 0),
            end_time=datetime(2024, 5, 15, 22, 0, 0),
            request_type="grant",
            priority=0
        )
        
        result = engine.validate_all_requests([request])
        
        violation_found = False
        for v in result.violations:
            if v.violation_type == ViolationType.TIME_WINDOW_VIOLATION:
                violation_found = True
                break
        
        assert violation_found, "Should have detected time window violation"
    
    def test_clock_drift_violation(self):
        personnel = create_test_personnel()
        zone_rules = create_test_zone_rules()
        device_clocks = create_test_device_clocks()
        
        engine = RulesEngine(
            zone_rules=zone_rules,
            personnel=personnel,
            device_clocks=device_clocks
        )
        
        request = AccessRequest(
            request_id="REQ001",
            personnel_id="P001",
            zone_id="Z001",
            start_time=datetime(2024, 5, 15, 9, 0, 0),
            end_time=datetime(2024, 5, 15, 18, 0, 0),
            request_type="grant",
            priority=0
        )
        
        result = engine.validate_all_requests([request])
        
        drift_violation_found = False
        for v in result.violations + result.warnings:
            if v.violation_type == ViolationType.CLOCK_DRIFT_VIOLATION:
                drift_violation_found = True
                assert v.device_id == "DEV003"
                break
        
        assert drift_violation_found, "Should have detected clock drift violation for DEV003"
    
    def test_invalid_time_range(self):
        personnel = create_test_personnel()
        zone_rules = create_test_zone_rules()
        device_clocks = create_test_device_clocks()
        
        engine = RulesEngine(
            zone_rules=zone_rules,
            personnel=personnel,
            device_clocks=device_clocks
        )
        
        request = AccessRequest(
            request_id="REQ001",
            personnel_id="P001",
            zone_id="Z001",
            start_time=datetime(2024, 5, 15, 18, 0, 0),
            end_time=datetime(2024, 5, 15, 9, 0, 0),
            request_type="grant",
            priority=0
        )
        
        result = engine.validate_all_requests([request])
        
        invalid_time_found = False
        for v in result.violations:
            if v.violation_type == ViolationType.INVALID_TIME_RANGE:
                invalid_time_found = True
                break
        
        assert invalid_time_found, "Should have detected invalid time range"
    
    def test_missing_personnel(self):
        personnel = create_test_personnel()
        zone_rules = create_test_zone_rules()
        device_clocks = create_test_device_clocks()
        
        engine = RulesEngine(
            zone_rules=zone_rules,
            personnel=personnel,
            device_clocks=device_clocks
        )
        
        request = AccessRequest(
            request_id="REQ001",
            personnel_id="INVALID_ID",
            zone_id="Z001",
            start_time=datetime(2024, 5, 15, 9, 0, 0),
            end_time=datetime(2024, 5, 15, 18, 0, 0),
            request_type="grant",
            priority=0
        )
        
        result = engine.validate_all_requests([request])
        
        missing_personnel_found = False
        for v in result.violations:
            if v.violation_type == ViolationType.MISSING_PERSONNEL:
                missing_personnel_found = True
                break
        
        assert missing_personnel_found, "Should have detected missing personnel"
    
    def test_revoke_reissue_warning(self):
        personnel = create_test_personnel()
        zone_rules = create_test_zone_rules()
        device_clocks = create_test_device_clocks()
        
        engine = RulesEngine(
            zone_rules=zone_rules,
            personnel=personnel,
            device_clocks=device_clocks
        )
        
        revoke_request = AccessRequest(
            request_id="REQ001",
            personnel_id="P001",
            zone_id="Z001",
            start_time=datetime(2024, 5, 15, 9, 0, 0),
            end_time=datetime(2024, 5, 15, 18, 0, 0),
            request_type="revoke",
            priority=0
        )
        
        grant_request = AccessRequest(
            request_id="REQ002",
            personnel_id="P001",
            zone_id="Z001",
            start_time=datetime(2024, 5, 16, 9, 0, 0),
            end_time=datetime(2024, 5, 16, 18, 0, 0),
            request_type="grant",
            priority=0
        )
        
        result = engine.validate_all_requests([revoke_request, grant_request])
        
        revoke_warning_found = False
        for v in result.warnings:
            if v.violation_type == ViolationType.REVOKE_REISSUE_WARNING:
                revoke_warning_found = True
                break
        
        assert revoke_warning_found, "Should have detected revoke reissue warning"
