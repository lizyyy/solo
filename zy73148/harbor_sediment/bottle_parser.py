from __future__ import annotations

import re
from datetime import datetime
from typing import Optional, Tuple, List, Dict, Any

from dateutil import parser as date_parser

from .models import BottleSample, CalculationError, ErrorCategory


BOTTLE_ID_PATTERNS = [
    re.compile(
        r"^(?P<prefix>[A-Z]{2})[-_](?P<date>\d{8})[-_](?P<station>[A-Z]\d{2})[-_](?P<seq>\d{2,4})$"
    ),
    re.compile(
        r"^(?P<prefix>[A-Z]{2})(?P<date>\d{8})(?P<station>[A-Z]\d{2})(?P<seq>\d{2,4})$"
    ),
]


class BottleIDParseResult:
    bottle_id: str
    prefix: str
    sampling_date: Optional[datetime]
    station_code: Optional[str]
    sequence: Optional[str]
    parse_success: bool
    errors: List[str]

    def __init__(
        self,
        bottle_id: str,
        prefix: str = "",
        sampling_date: Optional[datetime] = None,
        station_code: Optional[str] = None,
        sequence: Optional[str] = None,
        parse_success: bool = False,
        errors: Optional[List[str]] = None,
    ):
        self.bottle_id = bottle_id
        self.prefix = prefix
        self.sampling_date = sampling_date
        self.station_code = station_code
        self.sequence = sequence
        self.parse_success = parse_success
        self.errors = errors or []


def parse_bottle_id(bottle_id: str) -> BottleIDParseResult:
    result = BottleIDParseResult(bottle_id=bottle_id)

    for pattern in BOTTLE_ID_PATTERNS:
        match = pattern.match(bottle_id.strip())
        if match:
            groups = match.groupdict()
            result.prefix = groups.get("prefix", "")
            result.station_code = groups.get("station", "")
            result.sequence = groups.get("seq", "")
            date_str = groups.get("date", "")
            try:
                result.sampling_date = datetime.strptime(date_str, "%Y%m%d")
                result.parse_success = True
            except ValueError:
                result.errors.append(f"日期解析失败: {date_str}")
            break

    if not result.parse_success and not result.errors:
        result.errors.append(f"采样瓶编号格式不匹配，预期格式如 HW-20250315-A03-072")

    return result


def validate_time_consistency(
    bottle: BottleSample,
) -> Tuple[bool, List[CalculationError]]:
    errors: List[CalculationError] = []

    parsed = parse_bottle_id(bottle.bottle_id)

    if not parsed.parse_success:
        errors.append(
            CalculationError(
                category=ErrorCategory.DATA_MISMATCH,
                detail=f"采样瓶编号解析失败: " + "; ".join(parsed.errors),
                affected_field="bottle_id",
                suggestion="请检查采样瓶编号格式是否正确",
            )
        )
        return False, errors

    if parsed.sampling_date and bottle.sampling_time:
        parsed_date = parsed.sampling_date.date()
        actual_date = bottle.sampling_time.date()
        if parsed_date != actual_date:
            errors.append(
                CalculationError(
                    category=ErrorCategory.DATA_MISMATCH,
                    detail=(
                        f"采样瓶编号日期({parsed_date.isoformat()}) "
                        f"与实际采样时间({actual_date.isoformat()})不一致"
                    ),
                    affected_field="sampling_time",
                    suggestion="请核对采样瓶编号编码日期与现场采样记录",
                )
            )

    if parsed.station_code and bottle.station_code:
        if parsed.station_code.upper() != bottle.station_code.upper():
            errors.append(
                CalculationError(
                    category=ErrorCategory.DATA_MISMATCH,
                    detail=(
                        f"采样瓶编号站位({parsed.station_code}) "
                        f"与记录站位({bottle.station_code})不一致"
                    ),
                    affected_field="station_code",
                    suggestion="请核对采样瓶编号站位与现场站位记录",
                )
            )

    if bottle.experiment_time and bottle.sampling_time:
        if bottle.experiment_time < bottle.sampling_time:
            errors.append(
                CalculationError(
                    category=ErrorCategory.DATA_MISMATCH,
                    detail=(
                        f"实验时间({bottle.experiment_time.isoformat()}) "
                        f"早于采样时间({bottle.sampling_time.isoformat()})，逻辑异常"
                    ),
                    affected_field="experiment_time",
                    suggestion="请检查实验时间记录是否正确",
                )
            )

    if bottle.experiment_result is not None:
        if bottle.experiment_result < 0:
            errors.append(
                CalculationError(
                    category=ErrorCategory.THRESHOLD_ERROR,
                    detail=f"实验结果({bottle.experiment_result})为负值，超出合理范围",
                    affected_field="experiment_result",
                    suggestion="请核对实验结果数值",
                )
            )

    is_valid = len(errors) == 0
    return is_valid, errors


def enrich_bottle_from_id(bottle_id: str, **kwargs: Any) -> BottleSample:
    parsed = parse_bottle_id(bottle_id)
    sample = BottleSample(
        bottle_id=bottle_id, **kwargs
    )
    if parsed.parse_success:
        if parsed.sampling_date and not sample.sampling_time:
            sample.sampling_time = parsed.sampling_date
        if parsed.station_code and not sample.station_code:
            sample.station_code = parsed.station_code
    return sample


def extract_bottle_ids_from_text(text: str) -> List[str]:
    pattern = re.compile(r"[A-Z]{2}[-_]?\d{8}[-_]?[A-Z]\d{2}[-_]?\d{2,4}")
    matches = pattern.findall(text.upper())
    return list(set(matches))
