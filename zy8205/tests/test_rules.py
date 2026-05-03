import pytest
from datetime import datetime, timedelta

from cleanroom_verifier.parser import Room, PressureReading, AirflowSetpoint, DoorEvent
from cleanroom_verifier.calculator import Calculator, PressureGradient, ACHResult, DoorImpact
from cleanroom_verifier.rules import RuleEngine, Issue, IssueSeverity, IssueCategory


class TestRuleEngine:
    def setup_method(self):
        self.rule_engine = RuleEngine(
            pressure_tolerance=2.0,
            ach_tolerance=0.1,
            sensor_gap_threshold=300,
            transient_threshold=5.0
        )
    
    def test_check_pressure_gradients_valid(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=["R2"], required_pressure_diff=10.0
            )
        }
        
        gradients = [
            PressureGradient(
                room_id="R1",
                adjacent_room_id="R2",
                measured_diff=12.0,
                required_diff=10.0,
                unit="Pa",
                is_valid=True
            )
        ]
        
        issues = self.rule_engine.check_pressure_gradients(gradients, rooms)
        
        assert len(issues) == 0
    
    def test_check_pressure_gradients_insufficient(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=["R2"], required_pressure_diff=10.0
            )
        }
        
        gradients = [
            PressureGradient(
                room_id="R1",
                adjacent_room_id="R2",
                measured_diff=5.0,
                required_diff=10.0,
                unit="Pa",
                is_valid=True
            )
        ]
        
        issues = self.rule_engine.check_pressure_gradients(gradients, rooms)
        
        assert len(issues) == 1
        assert issues[0].category == IssueCategory.PRESSURE_GRADIENT
        assert issues[0].severity == IssueSeverity.CRITICAL
        assert "不足" in issues[0].message
    
    def test_check_pressure_gradients_reversed(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=["R2"], required_pressure_diff=10.0
            )
        }
        
        gradients = [
            PressureGradient(
                room_id="R1",
                adjacent_room_id="R2",
                measured_diff=-5.0,
                required_diff=10.0,
                unit="Pa",
                is_valid=True
            )
        ]
        
        issues = self.rule_engine.check_pressure_gradients(gradients, rooms)
        
        assert len(issues) == 2
        
        reversed_issues = [i for i in issues if "反转" in i.message]
        assert len(reversed_issues) == 1
        assert reversed_issues[0].severity == IssueSeverity.CRITICAL
    
    def test_check_pressure_gradients_invalid(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=["R2"], required_pressure_diff=10.0
            )
        }
        
        gradients = [
            PressureGradient(
                room_id="R1",
                adjacent_room_id="R2",
                measured_diff=0.0,
                required_diff=10.0,
                unit="Pa",
                is_valid=False
            )
        ]
        
        issues = self.rule_engine.check_pressure_gradients(gradients, rooms)
        
        assert len(issues) == 1
        assert issues[0].severity == IssueSeverity.HIGH
        assert "缺少数据" in issues[0].message
    
    def test_check_ach_valid(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=[], required_pressure_diff=10.0, required_ach=40.0
            )
        }
        
        ach_results = [
            ACHResult(
                room_id="R1",
                ach=42.0,
                required_ach=40.0,
                supply_air=2400.0,
                volume=56.0,
                is_valid=True
            )
        ]
        
        issues = self.rule_engine.check_ach(ach_results, rooms)
        
        assert len(issues) == 0
    
    def test_check_ach_insufficient(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=[], required_pressure_diff=10.0, required_ach=40.0
            )
        }
        
        ach_results = [
            ACHResult(
                room_id="R1",
                ach=30.0,
                required_ach=40.0,
                supply_air=1680.0,
                volume=56.0,
                is_valid=True
            )
        ]
        
        issues = self.rule_engine.check_ach(ach_results, rooms)
        
        assert len(issues) == 1
        assert issues[0].category == IssueCategory.ACH
        assert issues[0].severity == IssueSeverity.HIGH
        assert "不足" in issues[0].message
    
    def test_check_ach_invalid(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=[], required_pressure_diff=10.0, required_ach=40.0
            )
        }
        
        ach_results = [
            ACHResult(
                room_id="R1",
                ach=0.0,
                required_ach=40.0,
                supply_air=0.0,
                volume=0.0,
                is_valid=False
            )
        ]
        
        issues = self.rule_engine.check_ach(ach_results, rooms)
        
        assert len(issues) == 1
        assert issues[0].severity == IssueSeverity.HIGH
    
    def test_check_sensor_gaps_no_gaps(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=[]
            )
        }
        
        base_time = datetime(2026, 5, 3, 8, 0)
        readings = []
        
        for i in range(5):
            readings.append(PressureReading(
                timestamp=base_time + timedelta(seconds=i * 60),
                room_id="R1",
                pressure=15.0,
                unit="Pa",
                is_valid=True
            ))
        
        issues = self.rule_engine.check_sensor_gaps(readings, rooms)
        
        assert len(issues) == 0
    
    def test_check_sensor_gaps_with_gaps(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=[]
            )
        }
        
        base_time = datetime(2026, 5, 3, 8, 0)
        readings = [
            PressureReading(
                timestamp=base_time,
                room_id="R1",
                pressure=15.0,
                unit="Pa",
                is_valid=True
            ),
            PressureReading(
                timestamp=base_time + timedelta(seconds=600),
                room_id="R1",
                pressure=15.0,
                unit="Pa",
                is_valid=True
            )
        ]
        
        issues = self.rule_engine.check_sensor_gaps(readings, rooms)
        
        assert len(issues) == 1
        assert issues[0].category == IssueCategory.SENSOR_MISSING
        assert issues[0].severity == IssueSeverity.MEDIUM
        assert "间隙" in issues[0].message
    
    def test_check_sensor_gaps_no_readings(self):
        rooms = {
            "R1": Room(
                id="R1", name="Room 1", area=20.0, height=2.8, volume=56.0,
                adjacent_rooms=[]
            )
        }
        
        readings = []
        
        issues = self.rule_engine.check_sensor_gaps(readings, rooms)
        
        assert len(issues) == 1
        assert issues[0].category == IssueCategory.SENSOR_MISSING
        assert issues[0].severity == IssueSeverity.CRITICAL
        assert "没有有效的压力读数" in issues[0].message
    
    def test_check_unit_consistency_same_unit(self):
        readings = [
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 0),
                room_id="R1",
                pressure=15.0,
                unit="Pa",
                is_valid=True
            ),
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 0),
                room_id="R2",
                pressure=5.0,
                unit="Pa",
                is_valid=True
            )
        ]
        
        issues = self.rule_engine.check_unit_consistency(readings)
        
        assert len(issues) == 0
    
    def test_check_unit_consistency_mixed_units(self):
        readings = [
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 0),
                room_id="R1",
                pressure=15.0,
                unit="Pa",
                is_valid=True
            ),
            PressureReading(
                timestamp=datetime(2026, 5, 3, 8, 0),
                room_id="R2",
                pressure=0.05,
                unit="inH2O",
                is_valid=True
            )
        ]
        
        issues = self.rule_engine.check_unit_consistency(readings)
        
        assert len(issues) == 1
        assert issues[0].category == IssueCategory.UNIT_MIXED
        assert issues[0].severity == IssueSeverity.MEDIUM
        assert "单位混用" in issues[0].message
    
    def test_check_door_impacts_no_significant(self):
        door_impacts = [
            DoorImpact(
                room_id="R1",
                adjacent_room_id="R2",
                event_timestamp=datetime(2026, 5, 3, 8, 0),
                duration=10.0,
                pressure_before=15.0,
                pressure_after=14.0,
                pressure_impact=1.0,
                is_transient=True
            )
        ]
        
        issues = self.rule_engine.check_door_impacts(door_impacts)
        
        assert len(issues) == 0
    
    def test_check_door_impacts_significant(self):
        door_impacts = [
            DoorImpact(
                room_id="R1",
                adjacent_room_id="R2",
                event_timestamp=datetime(2026, 5, 3, 8, 0),
                duration=10.0,
                pressure_before=15.0,
                pressure_after=8.0,
                pressure_impact=7.0,
                is_transient=False
            )
        ]
        
        issues = self.rule_engine.check_door_impacts(door_impacts)
        
        assert len(issues) == 1
        assert issues[0].category == IssueCategory.DOOR_IMPACT
        assert issues[0].severity == IssueSeverity.HIGH
        assert "显著影响" in issues[0].message
    
    def test_check_door_transients(self):
        door_impacts = []
        
        for i in range(3):
            door_impacts.append(DoorImpact(
                room_id="R1",
                adjacent_room_id="R2",
                event_timestamp=datetime(2026, 5, 3, 8, i * 10),
                duration=5.0,
                pressure_before=15.0,
                pressure_after=14.0,
                pressure_impact=1.0,
                is_transient=True
            ))
        
        issues = self.rule_engine.check_door_transients(door_impacts)
        
        assert len(issues) == 1
        assert issues[0].category == IssueCategory.DOOR_TRANSIENT
        assert issues[0].severity == IssueSeverity.LOW
        assert "瞬态变化" in issues[0].message
    
    def test_get_issues_by_severity(self):
        self.rule_engine.issues = [
            Issue(
                id="ISS-0001",
                category=IssueCategory.PRESSURE_GRADIENT,
                severity=IssueSeverity.CRITICAL,
                room_id="R1"
            ),
            Issue(
                id="ISS-0002",
                category=IssueCategory.ACH,
                severity=IssueSeverity.HIGH,
                room_id="R2"
            ),
            Issue(
                id="ISS-0003",
                category=IssueCategory.SENSOR_MISSING,
                severity=IssueSeverity.MEDIUM,
                room_id="R3"
            )
        ]
        
        by_severity = self.rule_engine.get_issues_by_severity()
        
        assert len(by_severity[IssueSeverity.CRITICAL]) == 1
        assert len(by_severity[IssueSeverity.HIGH]) == 1
        assert len(by_severity[IssueSeverity.MEDIUM]) == 1
    
    def test_get_issues_by_category(self):
        self.rule_engine.issues = [
            Issue(
                id="ISS-0001",
                category=IssueCategory.PRESSURE_GRADIENT,
                severity=IssueSeverity.CRITICAL,
                room_id="R1"
            ),
            Issue(
                id="ISS-0002",
                category=IssueCategory.ACH,
                severity=IssueSeverity.HIGH,
                room_id="R2"
            ),
            Issue(
                id="ISS-0003",
                category=IssueCategory.PRESSURE_GRADIENT,
                severity=IssueSeverity.MEDIUM,
                room_id="R3"
            )
        ]
        
        by_category = self.rule_engine.get_issues_by_category()
        
        assert len(by_category[IssueCategory.PRESSURE_GRADIENT]) == 2
        assert len(by_category[IssueCategory.ACH]) == 1
