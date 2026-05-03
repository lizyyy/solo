from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime, timedelta

from freq_coordinator.models import (
    VolunteerShift,
    ValidationError,
    ValidationResult,
)


def parse_volunteer_shifts(file_path: str) -> ValidationResult:
    path = Path(file_path)
    shifts: List[VolunteerShift] = []
    errors: List[ValidationError] = []
    warnings: List[ValidationError] = []

    if not path.exists():
        return ValidationResult(
            is_valid=False,
            file_type="volunteer_shifts",
            file_path=file_path,
            parsed_count=0,
            errors=[
                ValidationError(
                    field="file",
                    value=file_path,
                    message="文件不存在",
                )
            ],
        )

    try:
        from ics import Calendar

        with open(path, "r", encoding="utf-8") as f:
            cal = Calendar(f.read())

        for idx, event in enumerate(cal.events, start=1):
            row_errors, shift = _parse_ics_event(event, idx)
            errors.extend(row_errors)
            if shift:
                shifts.append(shift)

    except ImportError:
        errors.append(
            ValidationError(
                field="dependency",
                value="ics",
                message="需要安装 'ics' 库: pip install ics",
            )
        )
    except Exception as e:
        errors.append(
            ValidationError(
                field="file",
                value=str(e),
                message=f"ICS 文件解析错误: {e}",
            )
        )

    return ValidationResult(
        is_valid=len(errors) == 0 and len(shifts) > 0,
        file_type="volunteer_shifts",
        file_path=file_path,
        parsed_count=len(shifts),
        errors=errors,
        warnings=warnings,
    )


def _parse_ics_event(event, idx: int) -> tuple:
    errors: List[ValidationError] = []
    shift = None

    summary = getattr(event, 'summary', '') or ''
    description = getattr(event, 'description', '') or ''

    volunteer_name = _extract_field_from_text(summary, 'name') or _extract_field_from_text(description, 'name')
    volunteer_id = _extract_field_from_text(summary, 'id') or _extract_field_from_text(description, 'id') or f"vol-{idx:03d}"
    station_id = _extract_field_from_text(summary, 'station') or _extract_field_from_text(description, 'station')

    if not volunteer_name:
        volunteer_name = summary.strip() if summary else f"志愿者-{idx}"

    if not station_id:
        errors.append(
            ValidationError(
                field="station_id",
                value=station_id,
                message=f"班次 '{summary}' 缺少站点ID，请在描述中添加 'station:XXX'",
                row_number=idx,
            )
        )

    start_time = getattr(event, 'begin', None)
    end_time = getattr(event, 'end', None)

    if start_time:
        if hasattr(start_time, 'datetime'):
            start_time = start_time.datetime
        if hasattr(start_time, 'replace'):
            start_time = _ensure_datetime_has_tzinfo(start_time)

    if end_time:
        if hasattr(end_time, 'datetime'):
            end_time = end_time.datetime
        if hasattr(end_time, 'replace'):
            end_time = _ensure_datetime_has_tzinfo(end_time)

    if not start_time or not end_time:
        errors.append(
            ValidationError(
                field="time",
                value=None,
                message=f"班次 '{summary}' 缺少开始或结束时间",
                row_number=idx,
            )
        )
    elif end_time <= start_time:
        errors.append(
            ValidationError(
                field="time",
                value=f"{start_time} - {end_time}",
                message=f"班次 '{summary}' 结束时间必须晚于开始时间",
                row_number=idx,
            )
        )

    role = _extract_field_from_text(summary, 'role') or _extract_field_from_text(description, 'role') or 'operator'
    phone = _extract_field_from_text(description, 'phone')
    assigned_device = _extract_field_from_text(description, 'device')

    skills_str = _extract_field_from_text(description, 'skills')
    skills = []
    if skills_str:
        skills = [s.strip() for s in skills_str.split(',') if s.strip()]

    if not errors:
        shift = VolunteerShift(
            id=f"shift-{idx:04d}",
            volunteer_name=volunteer_name,
            volunteer_id=volunteer_id,
            station_id=station_id,
            start_time=start_time,
            end_time=end_time,
            role=role,
            skills=skills,
            phone=phone,
            assigned_device=assigned_device,
        )

    return errors, shift


def _ensure_datetime_has_tzinfo(dt):
    if hasattr(dt, 'tzinfo') and dt.tzinfo is None:
        try:
            import pytz
            return dt.replace(tzinfo=pytz.UTC)
        except ImportError:
            from datetime import timezone
            return dt.replace(tzinfo=timezone.utc)
    return dt


def _extract_field_from_text(text: str, field_name: str) -> str:
    if not text:
        return None
    patterns = [
        f"{field_name}:",
        f"{field_name}：",
        f"{field_name}=",
    ]
    for pattern in patterns:
        if pattern in text.lower():
            lines = text.split('\n')
            for line in lines:
                lower_line = line.lower()
                if pattern.lower() in lower_line:
                    pos = lower_line.find(pattern.lower())
                    if pos >= 0:
                        value = line[pos + len(pattern):].strip()
                        value = value.split(',')[0].split(';')[0].strip()
                        return value if value else None
    return None
