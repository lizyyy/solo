import zoneinfo
from datetime import datetime
from typing import List, Dict, Any, Optional, Set, Tuple
from collections import defaultdict

from zhr_validator.models import (
    ObservationRecord,
    ValidationResult,
    ValidationIssue,
    ValidationSeverity,
    BatchValidationResult,
    ObservationPeriod,
    ProjectConfig,
)
from zhr_validator.astronomy import get_utc_period


def validate_coordinates(
    latitude: float,
    longitude: float,
    elevation: Optional[float] = None,
) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []

    if latitude < -90.0 or latitude > 90.0:
        issues.append(
            ValidationIssue(
                code="INV_LAT",
                severity=ValidationSeverity.ERROR,
                message=f"纬度必须在 -90 到 90 之间: {latitude}",
                field="latitude",
                value=latitude,
                suggestion="请检查纬度数值，北纬为正，南纬为负",
            )
        )

    if longitude < -180.0 or longitude > 180.0:
        issues.append(
            ValidationIssue(
                code="INV_LON",
                severity=ValidationSeverity.ERROR,
                message=f"经度必须在 -180 到 180 之间: {longitude}",
                field="longitude",
                value=longitude,
                suggestion="请检查经度数值，东经为正，西经为负",
            )
        )

    if elevation is not None:
        if elevation < -500 or elevation > 10000:
            issues.append(
                ValidationIssue(
                    code="INV_ELEV",
                    severity=ValidationSeverity.WARNING,
                    message=f"海拔高度异常: {elevation}m",
                    field="elevation",
                    value=elevation,
                    suggestion="正常观测点海拔应在 -500m 到 10000m 之间",
                )
            )

    if not issues:
        if abs(latitude) < 1.0 and abs(longitude) < 1.0:
            issues.append(
                ValidationIssue(
                    code="NULL_ISLAND",
                    severity=ValidationSeverity.WARNING,
                    message="坐标接近 (0,0)，可能是默认值或未填写",
                    field="coordinates",
                    value=(latitude, longitude),
                    suggestion="请确认经纬度是否正确填写",
                )
            )

    return issues


def validate_timezone(timezone_str: str) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []

    try:
        zoneinfo.ZoneInfo(timezone_str)
    except Exception:
        issues.append(
            ValidationIssue(
                code="INV_TZ",
                severity=ValidationSeverity.ERROR,
                message=f"无效的时区: {timezone_str}",
                field="timezone",
                value=timezone_str,
                suggestion="请使用 IANA 时区格式，如 Asia/Shanghai、America/New_York",
            )
        )

    return issues


def validate_time_format(
    date_str: str,
    start_time: str,
    end_time: str,
    timezone_str: str,
) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []

    tz_issues = validate_timezone(timezone_str)
    issues.extend(tz_issues)

    if tz_issues:
        return issues

    try:
        try:
            local_start = datetime.strptime(f"{date_str} {start_time}", "%Y-%m-%d %H:%M")
        except ValueError:
            try:
                local_start = datetime.strptime(f"{date_str} {start_time}", "%Y/%m/%d %H:%M")
            except ValueError:
                issues.append(
                    ValidationIssue(
                        code="INV_DATE_FORMAT",
                        severity=ValidationSeverity.ERROR,
                        message=f"日期/时间格式错误: {date_str} {start_time}",
                        field="observation_date",
                        value=f"{date_str} {start_time}",
                        suggestion="请使用 YYYY-MM-DD HH:MM 或 YYYY/MM/DD HH:MM 格式",
                    )
                )
                return issues

        try:
            local_end = datetime.strptime(f"{date_str} {end_time}", "%Y-%m-%d %H:%M")
        except ValueError:
            try:
                local_end = datetime.strptime(f"{date_str} {end_time}", "%Y/%m/%d %H:%M")
            except ValueError:
                issues.append(
                    ValidationIssue(
                        code="INV_TIME_FORMAT",
                        severity=ValidationSeverity.ERROR,
                        message=f"结束时间格式错误: {end_time}",
                        field="end_time",
                        value=end_time,
                        suggestion="请使用 HH:MM 格式",
                    )
                )
                return issues

        if local_end <= local_start:
            issues.append(
                ValidationIssue(
                    code="TIME_REVERSE",
                    severity=ValidationSeverity.INFO,
                    message="结束时间早于或等于开始时间，将自动识别为跨午夜观测",
                    field="time",
                    value=f"{start_time} - {end_time}",
                )
            )

    except Exception as e:
        issues.append(
            ValidationIssue(
                code="TIME_PARSE_ERR",
                severity=ValidationSeverity.ERROR,
                message=f"时间解析失败: {str(e)}",
                field="time",
            )
        )

    return issues


def validate_cloud_cover(cloud_cover: float) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []

    if cloud_cover < 0 or cloud_cover > 1:
        issues.append(
            ValidationIssue(
                code="INV_CLOUD",
                severity=ValidationSeverity.ERROR,
                message=f"云量必须在 0-1 之间: {cloud_cover}",
                field="cloud_cover",
                value=cloud_cover,
                suggestion="云量应表示为 0-1 的小数，0=晴朗，1=完全多云",
            )
        )
    elif cloud_cover > 0.75:
        issues.append(
            ValidationIssue(
                code="BAD_CLOUD",
                severity=ValidationSeverity.WARNING,
                message=f"云量过高 (>75%)，数据可能不可靠: {cloud_cover*100:.0f}%",
                field="cloud_cover",
                value=cloud_cover,
                suggestion="高云量会显著降低流星可见率，建议核实",
            )
        )

    return issues


def validate_limiting_magnitude(limiting_mag: float) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []

    if limiting_mag < 0 or limiting_mag > 8:
        issues.append(
            ValidationIssue(
                code="INV_LM",
                severity=ValidationSeverity.ERROR,
                message=f"极限星等必须在 0-8 之间: {limiting_mag}",
                field="limiting_magnitude",
                value=limiting_mag,
                suggestion="极限星等通常在 4-7 之间，数值越大表示夜空越暗",
            )
        )
    elif limiting_mag < 4.5:
        issues.append(
            ValidationIssue(
                code="BAD_LM",
                severity=ValidationSeverity.WARNING,
                message=f"极限星等过低 (<4.5)，可能是光污染或天气差: {limiting_mag}",
                field="limiting_magnitude",
                value=limiting_mag,
                suggestion="低极限星等会导致大量暗流星不可见",
            )
        )

    return issues


def validate_meteor_count(
    meteor_count: int,
    duration_hours: float,
) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []

    if meteor_count < 0:
        issues.append(
            ValidationIssue(
                code="INV_METEOR",
                severity=ValidationSeverity.ERROR,
                message=f"流星数量不能为负数: {meteor_count}",
                field="meteor_count",
                value=meteor_count,
            )
        )

    if meteor_count == 0:
        issues.append(
            ValidationIssue(
                code="ZERO_METEOR",
                severity=ValidationSeverity.INFO,
                message="记录流星数为 0",
                field="meteor_count",
                value=0,
            )
        )
    elif meteor_count < 5:
        issues.append(
            ValidationIssue(
                code="FEW_METEOR",
                severity=ValidationSeverity.INFO,
                message=f"流星数量较少 ({meteor_count})，统计误差可能较大",
                field="meteor_count",
                value=meteor_count,
            )
        )

    if duration_hours > 0:
        hourly_rate = meteor_count / duration_hours
        if hourly_rate > 500:
            issues.append(
                ValidationIssue(
                    code="UNREAL_RATE",
                    severity=ValidationSeverity.WARNING,
                    message=f"每小时流星率异常高: {hourly_rate:.1f}",
                    field="meteor_count",
                    value=meteor_count,
                    suggestion="请核实流星数量是否正确，通常只有流星暴雨才会超过 500",
                )
            )

    return issues


def validate_single_record(
    raw_data: Dict[str, Any],
    record_index: int,
    source_file: str,
    config: Optional[ProjectConfig] = None,
) -> Tuple[ValidationResult, Optional[ObservationRecord]]:
    issues: List[ValidationIssue] = []
    record: Optional[ObservationRecord] = None

    if config is None:
        config = ProjectConfig()

    required_fields = [
        "observer_name",
        "observation_date",
        "start_time",
        "end_time",
        "timezone",
        "latitude",
        "longitude",
        "cloud_cover",
        "limiting_magnitude",
        "meteor_count",
    ]

    for field in required_fields:
        if field not in raw_data or raw_data[field] is None or raw_data[field] == "":
            issues.append(
                ValidationIssue(
                    code="MISSING_FIELD",
                    severity=ValidationSeverity.ERROR,
                    message=f"缺少必填字段: {field}",
                    field=field,
                )
            )

    if issues:
        return (
            ValidationResult(
                record_index=record_index,
                source_file=source_file,
                issues=issues,
                is_valid=False,
            ),
            None,
        )

    try:
        record = ObservationRecord(
            observer_name=str(raw_data["observer_name"]).strip(),
            observation_date=str(raw_data["observation_date"]).strip(),
            start_time=str(raw_data["start_time"]).strip(),
            end_time=str(raw_data["end_time"]).strip(),
            timezone=str(raw_data["timezone"]).strip(),
            latitude=float(raw_data["latitude"]),
            longitude=float(raw_data["longitude"]),
            elevation=float(raw_data["elevation"]) if raw_data.get("elevation") else 0.0,
            cloud_cover=float(raw_data["cloud_cover"]),
            limiting_magnitude=float(raw_data["limiting_magnitude"]),
            meteor_count=int(float(raw_data["meteor_count"])),
            remarks=str(raw_data["remarks"]).strip() if raw_data.get("remarks") else None,
            source_file=source_file,
            record_index=record_index,
            raw_data=raw_data.copy(),
        )
    except Exception as e:
        issues.append(
            ValidationIssue(
                code="PARSE_ERROR",
                severity=ValidationSeverity.ERROR,
                message=f"数据解析失败: {str(e)}",
            )
        )
        return (
            ValidationResult(
                record_index=record_index,
                source_file=source_file,
                issues=issues,
                is_valid=False,
            ),
            None,
        )

    time_issues = validate_time_format(
        record.observation_date,
        record.start_time,
        record.end_time,
        record.timezone,
    )
    issues.extend(time_issues)

    coord_issues = validate_coordinates(record.latitude, record.longitude, record.elevation)
    issues.extend(coord_issues)

    cloud_issues = validate_cloud_cover(record.cloud_cover)
    issues.extend(cloud_issues)

    lm_issues = validate_limiting_magnitude(record.limiting_magnitude)
    issues.extend(lm_issues)

    try:
        period = get_utc_period(record)
        meteor_issues = validate_meteor_count(record.meteor_count, period.duration_hours)
        issues.extend(meteor_issues)

        if period.duration_hours < 0.1:
            issues.append(
                ValidationIssue(
                    code="SHORT_DURATION",
                    severity=ValidationSeverity.WARNING,
                    message=f"观测时段过短: {period.duration_hours*60:.1f} 分钟",
                    field="time",
                    value=f"{record.start_time} - {record.end_time}",
                    suggestion="建议观测时段至少 15 分钟以上",
                )
            )
        elif period.duration_hours > 8:
            issues.append(
                ValidationIssue(
                    code="LONG_DURATION",
                    severity=ValidationSeverity.INFO,
                    message=f"观测时段较长: {period.duration_hours:.1f} 小时",
                    field="time",
                    value=f"{record.start_time} - {record.end_time}",
                )
            )
    except Exception:
        issues.append(
            ValidationIssue(
                code="PERIOD_CALC_ERR",
                severity=ValidationSeverity.ERROR,
                message="无法计算观测时段",
            )
        )

    errors = [i for i in issues if i.severity == ValidationSeverity.ERROR]
    warnings = [i for i in issues if i.severity == ValidationSeverity.WARNING]

    result = ValidationResult(
        record_index=record_index,
        source_file=source_file,
        issues=issues,
        is_valid=len(errors) == 0,
        has_warnings=len(warnings) > 0,
    )

    return result, record


def validate_batch_records(
    records_with_meta: List[Tuple[Dict[str, Any], int, str]],
    config: Optional[ProjectConfig] = None,
    check_duplicates: bool = True,
    check_overlaps: bool = True,
) -> BatchValidationResult:
    if config is None:
        config = ProjectConfig()

    detailed_results: List[ValidationResult] = []
    valid_records: List[Tuple[ObservationRecord, ObservationPeriod]] = []

    for raw_data, record_index, source_file in records_with_meta:
        result, record = validate_single_record(raw_data, record_index, source_file, config)
        detailed_results.append(result)

        if result.is_valid and record is not None:
            try:
                period = get_utc_period(record)
                valid_records.append((record, period))
            except Exception:
                pass

    total_records = len(records_with_meta)
    valid_count = sum(1 for r in detailed_results if r.is_valid)
    invalid_count = total_records - valid_count
    warning_count = sum(1 for r in detailed_results if r.has_warnings)

    issues_by_severity: Dict[ValidationSeverity, int] = {
        ValidationSeverity.ERROR: 0,
        ValidationSeverity.WARNING: 0,
        ValidationSeverity.INFO: 0,
    }

    for result in detailed_results:
        for issue in result.issues:
            issues_by_severity[issue.severity] += 1

    duplicate_groups: List[List[str]] = []
    if check_duplicates and valid_records:
        observer_groups = defaultdict(list)
        for idx, (record, period) in enumerate(valid_records):
            key = (
                record.observer_name,
                record.latitude,
                record.longitude,
            )
            observer_groups[key].append((idx, record, period))

        for key, group in observer_groups.items():
            if len(group) > 1:
                group_ids = [
                    f"{r.source_file}:{r.record_index}"
                    for _, r, _ in group
                ]
                duplicate_groups.append(group_ids)

    overlapping_groups: List[List[str]] = []
    if check_overlaps and valid_records:
        for i in range(len(valid_records)):
            rec1, period1 = valid_records[i]
            current_group: List[str] = []

            for j in range(i + 1, len(valid_records)):
                rec2, period2 = valid_records[j]
                if period1.overlaps_with(period2):
                    overlap_hours = period1.get_overlap_hours(period2)
                    if overlap_hours > 0.08:
                        if not current_group:
                            current_group.append(f"{rec1.source_file}:{rec1.record_index}")
                        current_group.append(f"{rec2.source_file}:{rec2.record_index}")

            if current_group:
                overlapping_groups.append(current_group)

    return BatchValidationResult(
        total_records=total_records,
        valid_records=valid_count,
        invalid_records=invalid_count,
        records_with_warnings=warning_count,
        issues_by_severity=issues_by_severity,
        detailed_results=detailed_results,
        duplicate_observer_groups=duplicate_groups,
        overlapping_period_groups=overlapping_groups,
    )
