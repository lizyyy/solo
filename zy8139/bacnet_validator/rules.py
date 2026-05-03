import re
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum

from .parser import ParsedData, PointMapping, BACnetReading, ValidationRule


class IssueSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    WARNING = "warning"


class IssueType(str, Enum):
    POINT_RENAMING_MISSING = "point_renaming_missing"
    POINT_RENAMING_DUPLICATE = "point_renaming_duplicate"
    POINT_RENAMING_CONFLICT = "point_renaming_conflict"
    UNIT_MISMATCH = "unit_mismatch"
    UNIT_MULTIPLIER_ERROR = "unit_multiplier_error"
    STALE_READING = "stale_reading"
    NO_READINGS_FOUND = "no_readings_found"
    HIGH_ALARM_TRIGGERED = "high_alarm_triggered"
    LOW_ALARM_TRIGGERED = "low_alarm_triggered"
    VALUE_OUT_OF_EXPECTED_RANGE = "value_out_of_expected_range"
    TIMEZONE_MIXED = "timezone_mixed"
    SAME_NAME_DIFFERENT_FLOOR = "same_name_different_floor"


@dataclass
class ValidationIssue:
    issue_type: IssueType
    severity: IssueSeverity
    point_identifier: str
    floor: Optional[str]
    device_id: Optional[str]
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    reading_timestamp: Optional[datetime] = None
    expected_value: Optional[Any] = None
    actual_value: Optional[Any] = None


@dataclass
class ValidationResult:
    all_mappings: List[PointMapping]
    all_readings: List[BACnetReading]
    readings_by_point: Dict[str, List[BACnetReading]]
    mapping_issues: List[ValidationIssue]
    unit_issues: List[ValidationIssue]
    staleness_issues: List[ValidationIssue]
    alarm_issues: List[ValidationIssue]
    warnings: List[ValidationIssue]
    start_time: datetime
    end_time: datetime
    total_points: int
    total_readings: int
    points_with_readings: int
    points_without_readings: int

    @property
    def all_issues(self) -> List[ValidationIssue]:
        return (
            self.mapping_issues
            + self.unit_issues
            + self.staleness_issues
            + self.alarm_issues
            + self.warnings
        )

    @property
    def critical_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == IssueSeverity.CRITICAL)

    @property
    def high_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == IssueSeverity.HIGH)

    @property
    def medium_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == IssueSeverity.MEDIUM)

    @property
    def low_count(self) -> int:
        return sum(1 for i in self.all_issues if i.severity == IssueSeverity.LOW)


class Validator:
    def __init__(self, parsed_data: ParsedData):
        self.data = parsed_data
        self._readings_by_point: Optional[Dict[str, List[BACnetReading]]] = None

    def validate(self) -> ValidationResult:
        readings_by_point = self._group_readings_by_point()
        time_range = self._get_time_range()

        mapping_issues = self._validate_point_mappings()
        unit_issues = self._validate_units(readings_by_point)
        staleness_issues = self._validate_staleness(readings_by_point)
        alarm_issues = self._validate_alarm_thresholds(readings_by_point)
        warnings = self._detect_warnings(readings_by_point)

        total_points = len(self.data.point_mappings)
        points_with_readings = len(readings_by_point)
        points_without_readings = total_points - points_with_readings

        return ValidationResult(
            all_mappings=list(self.data.point_mappings.values()),
            all_readings=self.data.bacnet_readings,
            readings_by_point=readings_by_point,
            mapping_issues=mapping_issues,
            unit_issues=unit_issues,
            staleness_issues=staleness_issues,
            alarm_issues=alarm_issues,
            warnings=warnings,
            start_time=time_range[0],
            end_time=time_range[1],
            total_points=total_points,
            total_readings=len(self.data.bacnet_readings),
            points_with_readings=points_with_readings,
            points_without_readings=points_without_readings,
        )

    def _group_readings_by_point(self) -> Dict[str, List[BACnetReading]]:
        if self._readings_by_point is not None:
            return self._readings_by_point

        readings_by_point: Dict[str, List[BACnetReading]] = {}

        for reading in self.data.bacnet_readings:
            key = reading.full_identifier
            if key not in readings_by_point:
                readings_by_point[key] = []
            readings_by_point[key].append(reading)

        for key in readings_by_point:
            readings_by_point[key].sort(key=lambda r: r.timestamp)

        self._readings_by_point = readings_by_point
        return readings_by_point

    def _get_time_range(self) -> Tuple[datetime, datetime]:
        if not self.data.bacnet_readings:
            now = datetime.now(timezone.utc)
            return now, now

        timestamps = [r.timestamp for r in self.data.bacnet_readings]
        return min(timestamps), max(timestamps)

    def _validate_point_mappings(self) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []

        new_names: Dict[str, List[PointMapping]] = {}
        for mapping in self.data.point_mappings.values():
            if mapping.new_name not in new_names:
                new_names[mapping.new_name] = []
            new_names[mapping.new_name].append(mapping)

        for new_name, mappings in new_names.items():
            if len(mappings) > 1:
                for mapping in mappings:
                    issues.append(
                        ValidationIssue(
                            issue_type=IssueType.POINT_RENAMING_DUPLICATE,
                            severity=IssueSeverity.CRITICAL,
                            point_identifier=mapping.full_identifier,
                            floor=mapping.floor,
                            device_id=mapping.device_id,
                            message=f"New name '{new_name}' is used by multiple points: {[m.old_name for m in mappings]}",
                            details={
                                "old_names": [m.old_name for m in mappings],
                                "new_name": new_name,
                                "full_identifiers": [m.full_identifier for m in mappings],
                            },
                        )
                    )

        readings_by_point = self._group_readings_by_point()
        for reading_id in readings_by_point:
            if reading_id not in self.data.point_mappings:
                sample_reading = readings_by_point[reading_id][0]
                issues.append(
                    ValidationIssue(
                        issue_type=IssueType.POINT_RENAMING_MISSING,
                        severity=IssueSeverity.HIGH,
                        point_identifier=reading_id,
                        floor=sample_reading.floor,
                        device_id=sample_reading.device_id,
                        message=f"Reading found for point '{reading_id}' but not in point_map.csv",
                        details={
                            "readings_count": len(readings_by_point[reading_id]),
                            "latest_reading": sample_reading.value,
                            "latest_time": sample_reading.timestamp.isoformat(),
                        },
                    )
                )

        for mapping in self.data.point_mappings.values():
            if mapping.old_name == mapping.new_name:
                issues.append(
                    ValidationIssue(
                        issue_type=IssueType.POINT_RENAMING_CONFLICT,
                        severity=IssueSeverity.MEDIUM,
                        point_identifier=mapping.full_identifier,
                        floor=mapping.floor,
                        device_id=mapping.device_id,
                        message=f"Point '{mapping.old_name}' has same old and new name",
                        details={
                            "old_name": mapping.old_name,
                            "new_name": mapping.new_name,
                        },
                    )
                )

        return issues

    def _validate_units(self, readings_by_point: Dict[str, List[BACnetReading]]) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []

        for mapping_id, mapping in self.data.point_mappings.items():
            if mapping_id not in readings_by_point:
                continue

            readings = readings_by_point[mapping_id]
            if not readings:
                continue

            for reading in readings:
                if reading.unit is None:
                    continue

                expected_unit = mapping.unit.lower().strip()
                actual_unit = reading.unit.lower().strip()

                if actual_unit != expected_unit:
                    tolerance = self._get_unit_tolerance(mapping)
                    if not tolerance:
                        issues.append(
                            ValidationIssue(
                                issue_type=IssueType.UNIT_MISMATCH,
                                severity=IssueSeverity.HIGH,
                                point_identifier=mapping.full_identifier,
                                floor=mapping.floor,
                                device_id=mapping.device_id,
                                message=f"Unit mismatch: expected '{mapping.unit}', got '{reading.unit}'",
                                details={
                                    "expected_unit": mapping.unit,
                                    "actual_unit": reading.unit,
                                    "reading_value": reading.value,
                                },
                                reading_timestamp=reading.timestamp,
                                expected_value=mapping.unit,
                                actual_value=reading.unit,
                            )
                        )

                if mapping.unit_multiplier != 1.0:
                    if isinstance(reading.value, (int, float)):
                        expected_multiplied = reading.value * mapping.unit_multiplier
                        rule = self._find_applicable_rule(mapping)
                        tolerance_pct = rule.tolerance_pct if rule else 2.0

                        if not self._is_within_tolerance(
                            reading.value, expected_multiplied / mapping.unit_multiplier, tolerance_pct
                        ):
                            issues.append(
                                ValidationIssue(
                                    issue_type=IssueType.UNIT_MULTIPLIER_ERROR,
                                    severity=IssueSeverity.HIGH,
                                    point_identifier=mapping.full_identifier,
                                    floor=mapping.floor,
                                    device_id=mapping.device_id,
                                    message=f"Unit multiplier applied but value doesn't match expectation. "
                                            f"Value={reading.value}, Multiplier={mapping.unit_multiplier}",
                                    details={
                                        "value": reading.value,
                                        "unit_multiplier": mapping.unit_multiplier,
                                        "expected_after_multiplication": reading.value * mapping.unit_multiplier,
                                    },
                                    reading_timestamp=reading.timestamp,
                                )
                            )

        return issues

    def _validate_staleness(self, readings_by_point: Dict[str, List[BACnetReading]]) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []
        time_range = self._get_time_range()

        for mapping_id, mapping in self.data.point_mappings.items():
            rule = self._find_applicable_rule(mapping)
            threshold = rule.staleness_threshold_seconds if rule else 300

            if mapping_id not in readings_by_point:
                issues.append(
                    ValidationIssue(
                        issue_type=IssueType.NO_READINGS_FOUND,
                        severity=IssueSeverity.HIGH,
                        point_identifier=mapping.full_identifier,
                        floor=mapping.floor,
                        device_id=mapping.device_id,
                        message=f"No readings found for point '{mapping.old_name}' in the entire time range",
                        details={
                            "time_range_start": time_range[0].isoformat(),
                            "time_range_end": time_range[1].isoformat(),
                        },
                    )
                )
                continue

            readings = readings_by_point[mapping_id]
            if not readings:
                continue

            for i in range(1, len(readings)):
                gap = readings[i].timestamp - readings[i - 1].timestamp
                if gap > timedelta(seconds=threshold):
                    issues.append(
                        ValidationIssue(
                            issue_type=IssueType.STALE_READING,
                            severity=IssueSeverity.MEDIUM,
                            point_identifier=mapping.full_identifier,
                            floor=mapping.floor,
                            device_id=mapping.device_id,
                            message=f"Reading gap of {gap.total_seconds():.1f}s exceeds threshold of {threshold}s",
                            details={
                                "gap_seconds": gap.total_seconds(),
                                "threshold_seconds": threshold,
                                "previous_reading_time": readings[i - 1].timestamp.isoformat(),
                                "current_reading_time": readings[i].timestamp.isoformat(),
                            },
                            reading_timestamp=readings[i].timestamp,
                        )
                    )

        return issues

    def _validate_alarm_thresholds(self, readings_by_point: Dict[str, List[BACnetReading]]) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []

        for mapping_id, mapping in self.data.point_mappings.items():
            rule = self._find_applicable_rule(mapping)

            if mapping_id not in readings_by_point:
                continue

            readings = readings_by_point[mapping_id]
            if not readings:
                continue

            for reading in readings:
                if not isinstance(reading.value, (int, float)):
                    continue

                if rule.high_alarm_threshold is not None:
                    if reading.value > rule.high_alarm_threshold:
                        issues.append(
                            ValidationIssue(
                                issue_type=IssueType.HIGH_ALARM_TRIGGERED,
                                severity=IssueSeverity.CRITICAL,
                                point_identifier=mapping.full_identifier,
                                floor=mapping.floor,
                                device_id=mapping.device_id,
                                message=f"High alarm: value {reading.value} exceeds threshold {rule.high_alarm_threshold}",
                                details={
                                    "value": reading.value,
                                    "high_threshold": rule.high_alarm_threshold,
                                },
                                reading_timestamp=reading.timestamp,
                                expected_value=f"<{rule.high_alarm_threshold}",
                                actual_value=reading.value,
                            )
                        )

                if rule.low_alarm_threshold is not None:
                    if reading.value < rule.low_alarm_threshold:
                        issues.append(
                            ValidationIssue(
                                issue_type=IssueType.LOW_ALARM_TRIGGERED,
                                severity=IssueSeverity.CRITICAL,
                                point_identifier=mapping.full_identifier,
                                floor=mapping.floor,
                                device_id=mapping.device_id,
                                message=f"Low alarm: value {reading.value} below threshold {rule.low_alarm_threshold}",
                                details={
                                    "value": reading.value,
                                    "low_threshold": rule.low_alarm_threshold,
                                },
                                reading_timestamp=reading.timestamp,
                                expected_value=f">{rule.low_alarm_threshold}",
                                actual_value=reading.value,
                            )
                        )

        return issues

    def _detect_warnings(self, readings_by_point: Dict[str, List[BACnetReading]]) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []

        issues.extend(self._detect_timezone_mixed())
        issues.extend(self._detect_same_name_different_floor())

        return issues

    def _detect_timezone_mixed(self) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []

        if not self.data.bacnet_readings:
            return issues

        utc_count = 0
        local_count = 0

        for reading in self.data.bacnet_readings:
            ts_str = reading.raw_timestamp.upper()
            if "Z" in ts_str or "+00:00" in ts_str:
                utc_count += 1
            else:
                local_count += 1

        if utc_count > 0 and local_count > 0:
            issues.append(
                ValidationIssue(
                    issue_type=IssueType.TIMEZONE_MIXED,
                    severity=IssueSeverity.WARNING,
                    point_identifier="TIMEZONE_WARNING",
                    floor=None,
                    device_id=None,
                    message=f"Detected mixed timezones: {utc_count} UTC timestamps and {local_count} local timestamps",
                    details={
                        "utc_count": utc_count,
                        "local_count": local_count,
                    },
                )
            )

        return issues

    def _detect_same_name_different_floor(self) -> List[ValidationIssue]:
        issues: List[ValidationIssue] = []

        name_to_floors: Dict[str, set] = {}

        for mapping in self.data.point_mappings.values():
            key = mapping.old_name
            if key not in name_to_floors:
                name_to_floors[key] = set()
            if mapping.floor:
                name_to_floors[key].add(mapping.floor)

        for name, floors in name_to_floors.items():
            if len(floors) > 1:
                issues.append(
                    ValidationIssue(
                        issue_type=IssueType.SAME_NAME_DIFFERENT_FLOOR,
                        severity=IssueSeverity.WARNING,
                        point_identifier=name,
                        floor=None,
                        device_id=None,
                        message=f"Point name '{name}' appears across multiple floors: {sorted(floors)}. "
                                f"Using floor identifier to distinguish.",
                        details={
                            "point_name": name,
                            "floors": sorted(floors),
                            "resolved_using": "floor_identifier",
                        },
                    )
                )

        return issues

    def _find_applicable_rule(self, mapping: PointMapping) -> ValidationRule:
        default_rule = ValidationRule(rule_type="default", point_pattern=".*")

        for rule in self.data.rules:
            if self._point_matches_pattern(mapping, rule.point_pattern):
                return rule

        return default_rule

    def _point_matches_pattern(self, mapping: PointMapping, pattern: str) -> bool:
        try:
            regex = re.compile(pattern, re.IGNORECASE)
            if regex.search(mapping.old_name):
                return True
            if regex.search(mapping.full_identifier):
                return True
            return False
        except re.error:
            return pattern.lower() in mapping.old_name.lower()

    def _is_within_tolerance(self, actual: float, expected: float, tolerance_pct: float) -> bool:
        if expected == 0:
            return abs(actual) < tolerance_pct
        diff_pct = abs((actual - expected) / expected) * 100
        return diff_pct <= tolerance_pct

    def _get_unit_tolerance(self, mapping: PointMapping) -> List[Tuple[str, float]]:
        unit_variations = {
            "celsius": ["°c", "c", "deg c"],
            "fahrenheit": ["°f", "f", "deg f"],
            "percent": ["%", "pct", "percent"],
            "kw": ["kw", "kilowatt"],
            "kwh": ["kwh", "kw-hr", "kw hr"],
            "rpm": ["rpm", "rev/min"],
        }

        normalized_unit = mapping.unit.lower().strip()
        for base_unit, variations in unit_variations.items():
            if normalized_unit in variations:
                return [(var, base_unit) for var in variations]

        return []
