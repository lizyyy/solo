import json
from dataclasses import dataclass
from datetime import datetime, time
from typing import Any, Dict, List, Optional

from app.parsers.base import BaseParser, ParseResult, ParseError


@dataclass
class BillingRuleImport:
    rule_code: str
    name: str
    instrument_id: Optional[int] = None
    instrument_code: Optional[str] = None
    research_group_id: Optional[int] = None
    research_group_code: Optional[str] = None
    base_hourly_rate: float = 0.0
    overtime_rate_multiplier: float = 1.5
    overtime_start_hours: int = 0
    night_rate_multiplier: float = 1.0
    night_start_time: time = time(22, 0)
    night_end_time: time = time(6, 0)
    weekend_rate_multiplier: float = 1.5
    discount_rate: float = 1.0
    discount_reason: Optional[str] = None
    priority: int = 0
    is_active: bool = True
    valid_from: Optional[datetime] = None
    valid_to: Optional[datetime] = None


class JSONParser(BaseParser):
    
    def __init__(self, encoding: str = "utf-8"):
        super().__init__()
        self.encoding = encoding
    
    def parse(self, content: str) -> ParseResult[Dict[str, Any]]:
        result = ParseResult[Dict[str, Any]]()
        
        try:
            data = json.loads(content)
            if isinstance(data, list):
                result.data = data
                result.total_count = len(data)
                result.success_count = len(data)
            elif isinstance(data, dict):
                if "rules" in data or "data" in data:
                    items = data.get("rules") or data.get("data", [])
                    if isinstance(items, list):
                        result.data = items
                        result.total_count = len(items)
                        result.success_count = len(items)
                    else:
                        result.data = [items]
                        result.total_count = 1
                        result.success_count = 1
                else:
                    result.data = [data]
                    result.total_count = 1
                    result.success_count = 1
        except json.JSONDecodeError as e:
            result.success = False
            result.add_error(ParseError(
                row_number=0,
                field="json",
                message=f"JSON解析错误: {str(e)}",
                code="INVALID_JSON"
            ))
            result.error_count = 1
        
        return result
    
    def parse_file(self, file_path: str) -> ParseResult[Dict[str, Any]]:
        with open(file_path, 'r', encoding=self.encoding) as f:
            return self.parse(f.read())


def _parse_time(value: Any, row_number: int, field_name: str = "time",
                 default: time = time(0, 0)) -> time:
    if value is None:
        return default
    
    value_str = str(value).strip()
    formats = ["%H:%M", "%H:%M:%S", "%H.%M", "%H"]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(value_str, fmt)
            return time(dt.hour, dt.minute, dt.second)
        except ValueError:
            continue
    
    return default


def parse_billing_rules_json(content: str) -> ParseResult[BillingRuleImport]:
    parser = JSONParser()
    raw_result = parser.parse(content)
    
    result = ParseResult[BillingRuleImport]()
    result.total_count = raw_result.total_count
    
    required_fields = ["rule_code", "name"]
    
    for idx, item in enumerate(raw_result.data):
        row_num = idx + 1
        
        if not parser._validate_required(item, required_fields, row_num):
            result.error_count += 1
            continue
        
        rule_code = item.get("rule_code")
        if not rule_code:
            parser.errors.append(ParseError(
                row_number=row_num,
                field="rule_code",
                message="规则编码不能为空",
                code="MISSING_RULE_CODE"
            ))
            result.error_count += 1
            continue
        
        valid_from = parser._parse_datetime(
            item.get("valid_from"), row_num, "valid_from"
        )
        valid_to = parser._parse_datetime(
            item.get("valid_to"), row_num, "valid_to"
        )
        
        base_hourly_rate = float(item.get("base_hourly_rate", 0.0))
        
        if base_hourly_rate < 0:
            parser.errors.append(ParseError(
                row_number=row_num,
                field="base_hourly_rate",
                message="基础费率不能为负数",
                code="INVALID_HOURLY_RATE"
            ))
        
        result.data.append(BillingRuleImport(
            rule_code=rule_code,
            name=item.get("name") or "",
            instrument_id=parser._parse_int(item.get("instrument_id"), row_num, "instrument_id"),
            instrument_code=item.get("instrument_code"),
            research_group_id=parser._parse_int(item.get("research_group_id"), row_num, "research_group_id"),
            research_group_code=item.get("research_group_code"),
            base_hourly_rate=base_hourly_rate,
            overtime_rate_multiplier=float(item.get("overtime_rate_multiplier", 1.5)),
            overtime_start_hours=int(item.get("overtime_start_hours", 0)),
            night_rate_multiplier=float(item.get("night_rate_multiplier", 1.0)),
            night_start_time=_parse_time(item.get("night_start_time"), row_num, "night_start_time", time(22, 0)),
            night_end_time=_parse_time(item.get("night_end_time"), row_num, "night_end_time", time(6, 0)),
            weekend_rate_multiplier=float(item.get("weekend_rate_multiplier", 1.5)),
            discount_rate=float(item.get("discount_rate", 1.0)),
            discount_reason=item.get("discount_reason"),
            priority=int(item.get("priority", 0)),
            is_active=bool(item.get("is_active", True)),
            valid_from=valid_from,
            valid_to=valid_to
        ))
        result.success_count += 1
    
    result.errors = parser.errors
    result.warnings = parser.warnings
    result.success = result.error_count == 0
    
    return result


def parse_reservation_json(content: str) -> ParseResult[Dict[str, Any]]:
    parser = JSONParser()
    return parser.parse(content)


def parse_swipe_log_json(content: str) -> ParseResult[Dict[str, Any]]:
    parser = JSONParser()
    return parser.parse(content)


def parse_sample_registration_json(content: str) -> ParseResult[Dict[str, Any]]:
    parser = JSONParser()
    return parser.parse(content)
