import pytest
import tempfile
import os
import csv
import json
import yaml
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List

from bacnet_validator.parser import (
    PointMapping,
    BACnetReading,
    ValidationRule,
    ParsedData,
)
from bacnet_validator.rules import (
    Validator,
    ValidationIssue,
    ValidationResult,
    IssueType,
    IssueSeverity,
)


def create_test_parsed_data(
    mappings: List[PointMapping] = None,
    readings: List[BACnetReading] = None,
    rules: List[ValidationRule] = None,
) -> ParsedData:
    if mappings is None:
        mappings = []
    if readings is None:
        readings = []
    if rules is None:
        rules = []
    
    mappings_dict = {m.full_identifier: m for m in mappings}
    
    return ParsedData(
        point_mappings=mappings_dict,
        bacnet_readings=readings,
        rules=rules,
    )


class TestValidatorPointMapping:
    def test_duplicate_new_name(self):
        mappings = [
            PointMapping(
                old_name="OldName1",
                new_name="SameNewName",
                unit="Celsius",
                unit_multiplier=1.0,
                floor="1",
                device_id="DEV-001",
                point_type="analog",
            ),
            PointMapping(
                old_name="OldName2",
                new_name="SameNewName",
                unit="Celsius",
                unit_multiplier=1.0,
                floor="2",
                device_id="DEV-002",
                point_type="analog",
            ),
        ]
        
        rules = [
            ValidationRule(
                rule_type="default",
                point_pattern=".*",
                staleness_threshold_seconds=300,
            )
        ]
        
        parsed_data = create_test_parsed_data(mappings=mappings, rules=rules)
        validator = Validator(parsed_data)
        result = validator.validate()
        
        duplicate_issues = [
            i for i in result.mapping_issues
            if i.issue_type == IssueType.POINT_RENAMING_DUPLICATE
        ]
        
        assert len(duplicate_issues) >= 2

    def test_point_in_readings_not_in_mapping(self):
        base_time = datetime.now(timezone.utc)
        
        mappings = [
            PointMapping(
                old_name="MappedPoint",
                new_name="NewMappedPoint",
                unit="Celsius",
                unit_multiplier=1.0,
                floor="1",
                device_id="DEV-001",
                point_type="analog",
            ),
        ]
        
        readings = [
            BACnetReading(
                point_name="UnmappedPoint",
                floor="1",
                device_id="DEV-002",
                value=22.5,
                unit="Celsius",
                timestamp=base_time,
                raw_timestamp=base_time.isoformat(),
            ),
        ]
        
        rules = [
            ValidationRule(
                rule_type="default",
                point_pattern=".*",
                staleness_threshold_seconds=300,
            )
        ]
        
        parsed_data = create_test_parsed_data(
            mappings=mappings,
            readings=readings,
            rules=rules,
        )
        validator = Validator(parsed_data)
        result = validator.validate()
        
        missing_issues = [
            i for i in result.mapping_issues
            if i.issue_type == IssueType.POINT_RENAMING_MISSING
        ]
        
        assert len(missing_issues) == 1


class TestValidatorAlarmThresholds:
    def test_high_alarm_threshold(self):
        base_time = datetime.now(timezone.utc)
        
        mappings = [
            PointMapping(
                old_name="TempSensor",
                new_name="Zone1_Temp",
                unit="Celsius",
                unit_multiplier=1.0,
                floor="1",
                device_id="DEV-001",
                point_type="analog",
            ),
        ]
        
        readings = [
            BACnetReading(
                point_name="TempSensor",
                floor="1",
                device_id="DEV-001",
                value=35.0,
                unit="Celsius",
                timestamp=base_time,
                raw_timestamp=base_time.isoformat(),
            ),
        ]
        
        rules = [
            ValidationRule(
                rule_type="temperature",
                point_pattern="Temp",
                staleness_threshold_seconds=300,
                high_alarm_threshold=30.0,
                low_alarm_threshold=10.0,
            )
        ]
        
        parsed_data = create_test_parsed_data(
            mappings=mappings,
            readings=readings,
            rules=rules,
        )
        validator = Validator(parsed_data)
        result = validator.validate()
        
        high_alarm_issues = [
            i for i in result.alarm_issues
            if i.issue_type == IssueType.HIGH_ALARM_TRIGGERED
        ]
        
        assert len(high_alarm_issues) == 1
        assert high_alarm_issues[0].severity == IssueSeverity.CRITICAL

    def test_low_alarm_threshold(self):
        base_time = datetime.now(timezone.utc)
        
        mappings = [
            PointMapping(
                old_name="TempSensor",
                new_name="Zone1_Temp",
                unit="Celsius",
                unit_multiplier=1.0,
                floor="1",
                device_id="DEV-001",
                point_type="analog",
            ),
        ]
        
        readings = [
            BACnetReading(
                point_name="TempSensor",
                floor="1",
                device_id="DEV-001",
                value=5.0,
                unit="Celsius",
                timestamp=base_time,
                raw_timestamp=base_time.isoformat(),
            ),
        ]
        
        rules = [
            ValidationRule(
                rule_type="temperature",
                point_pattern="Temp",
                staleness_threshold_seconds=300,
                high_alarm_threshold=30.0,
                low_alarm_threshold=10.0,
            )
        ]
        
        parsed_data = create_test_parsed_data(
            mappings=mappings,
            readings=readings,
            rules=rules,
        )
        validator = Validator(parsed_data)
        result = validator.validate()
        
        low_alarm_issues = [
            i for i in result.alarm_issues
            if i.issue_type == IssueType.LOW_ALARM_TRIGGERED
        ]
        
        assert len(low_alarm_issues) == 1


class TestValidatorStaleness:
    def test_stale_reading_gap(self):
        base_time = datetime.now(timezone.utc)
        
        mappings = [
            PointMapping(
                old_name="TempSensor",
                new_name="Zone1_Temp",
                unit="Celsius",
                unit_multiplier=1.0,
                floor="1",
                device_id="DEV-001",
                point_type="analog",
            ),
        ]
        
        readings = [
            BACnetReading(
                point_name="TempSensor",
                floor="1",
                device_id="DEV-001",
                value=22.0,
                unit="Celsius",
                timestamp=base_time,
                raw_timestamp=base_time.isoformat(),
            ),
            BACnetReading(
                point_name="TempSensor",
                floor="1",
                device_id="DEV-001",
                value=23.0,
                unit="Celsius",
                timestamp=base_time + timedelta(seconds=600),
                raw_timestamp=(base_time + timedelta(seconds=600)).isoformat(),
            ),
        ]
        
        rules = [
            ValidationRule(
                rule_type="default",
                point_pattern=".*",
                staleness_threshold_seconds=300,
            )
        ]
        
        parsed_data = create_test_parsed_data(
            mappings=mappings,
            readings=readings,
            rules=rules,
        )
        validator = Validator(parsed_data)
        result = validator.validate()
        
        stale_issues = [
            i for i in result.staleness_issues
            if i.issue_type == IssueType.STALE_READING
        ]
        
        assert len(stale_issues) == 1

    def test_point_without_readings(self):
        mappings = [
            PointMapping(
                old_name="MissingPoint",
                new_name="NewMissingPoint",
                unit="Celsius",
                unit_multiplier=1.0,
                floor="1",
                device_id="DEV-001",
                point_type="analog",
            ),
        ]
        
        rules = [
            ValidationRule(
                rule_type="default",
                point_pattern=".*",
                staleness_threshold_seconds=300,
            )
        ]
        
        parsed_data = create_test_parsed_data(
            mappings=mappings,
            readings=[],
            rules=rules,
        )
        validator = Validator(parsed_data)
        result = validator.validate()
        
        no_readings_issues = [
            i for i in result.staleness_issues
            if i.issue_type == IssueType.NO_READINGS_FOUND
        ]
        
        assert len(no_readings_issues) == 1


class TestValidatorWarnings:
    def test_timezone_mixed(self):
        base_time = datetime.now(timezone.utc)
        
        mappings = [
            PointMapping(
                old_name="TestPoint",
                new_name="NewTestPoint",
                unit="Celsius",
                unit_multiplier=1.0,
                floor="1",
                device_id="DEV-001",
                point_type="analog",
            ),
        ]
        
        readings = [
            BACnetReading(
                point_name="TestPoint",
                floor="1",
                device_id="DEV-001",
                value=22.0,
                unit="Celsius",
                timestamp=base_time,
                raw_timestamp="2026-05-03T08:00:00.000Z",
            ),
            BACnetReading(
                point_name="TestPoint",
                floor="1",
                device_id="DEV-001",
                value=23.0,
                unit="Celsius",
                timestamp=base_time + timedelta(minutes=1),
                raw_timestamp="2026-05-03 08:01:00",
            ),
        ]
        
        rules = [
            ValidationRule(
                rule_type="default",
                point_pattern=".*",
                staleness_threshold_seconds=300,
            )
        ]
        
        parsed_data = create_test_parsed_data(
            mappings=mappings,
            readings=readings,
            rules=rules,
        )
        validator = Validator(parsed_data)
        result = validator.validate()
        
        timezone_issues = [
            i for i in result.warnings
            if i.issue_type == IssueType.TIMEZONE_MIXED
        ]
        
        assert len(timezone_issues) == 1

    def test_same_name_different_floor(self):
        mappings = [
            PointMapping(
                old_name="RoomTemp",
                new_name="Floor1_RT",
                unit="Celsius",
                unit_multiplier=1.0,
                floor="1",
                device_id="DEV-001",
                point_type="analog",
            ),
            PointMapping(
                old_name="RoomTemp",
                new_name="Floor2_RT",
                unit="Celsius",
                unit_multiplier=1.0,
                floor="2",
                device_id="DEV-002",
                point_type="analog",
            ),
        ]
        
        rules = [
            ValidationRule(
                rule_type="default",
                point_pattern=".*",
                staleness_threshold_seconds=300,
            )
        ]
        
        parsed_data = create_test_parsed_data(
            mappings=mappings,
            readings=[],
            rules=rules,
        )
        validator = Validator(parsed_data)
        result = validator.validate()
        
        same_name_issues = [
            i for i in result.warnings
            if i.issue_type == IssueType.SAME_NAME_DIFFERENT_FLOOR
        ]
        
        assert len(same_name_issues) == 1


class TestValidationResult:
    def test_issue_counts(self):
        base_time = datetime.now(timezone.utc)
        
        mappings = [
            PointMapping(
                old_name="Temp1",
                new_name="SameNewName",
                unit="Celsius",
                unit_multiplier=1.0,
                floor="1",
                device_id="DEV-001",
                point_type="analog",
            ),
            PointMapping(
                old_name="Temp2",
                new_name="SameNewName",
                unit="Celsius",
                unit_multiplier=1.0,
                floor="2",
                device_id="DEV-002",
                point_type="analog",
            ),
        ]
        
        readings = [
            BACnetReading(
                point_name="Temp1",
                floor="1",
                device_id="DEV-001",
                value=35.0,
                unit="Celsius",
                timestamp=base_time,
                raw_timestamp=base_time.isoformat(),
            ),
        ]
        
        rules = [
            ValidationRule(
                rule_type="temperature",
                point_pattern="Temp",
                staleness_threshold_seconds=300,
                high_alarm_threshold=30.0,
            )
        ]
        
        parsed_data = create_test_parsed_data(
            mappings=mappings,
            readings=readings,
            rules=rules,
        )
        validator = Validator(parsed_data)
        result = validator.validate()
        
        assert result.total_points == 2
        assert result.total_readings == 1
        assert result.critical_count >= 1
        assert len(result.all_issues) > 0
