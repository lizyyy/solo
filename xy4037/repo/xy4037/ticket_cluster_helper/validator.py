"""
数据校验模块
负责校验工单数据的必填字段、时间格式、重复工单号、空文本等
"""

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

from .config import Config
from .csv_parser import ParsedTicket


@dataclass
class ValidationError:
    ticket_id: str
    field_name: str
    error_type: str
    error_message: str
    row_index: int
    source_file: str
    raw_value: Any = None


@dataclass
class ValidationResult:
    valid_tickets: List[ParsedTicket] = field(default_factory=list)
    invalid_tickets: List[ValidationError] = field(default_factory=list)
    duplicate_ticket_ids: List[str] = field(default_factory=list)
    
    @property
    def is_valid(self) -> bool:
        return len(self.invalid_tickets) == 0 and len(self.duplicate_ticket_ids) == 0
    
    @property
    def valid_count(self) -> int:
        return len(self.valid_tickets)
    
    @property
    def invalid_count(self) -> int:
        return len(self.invalid_tickets) + len(self.duplicate_ticket_ids)
    
    def get_error_summary(self) -> Dict[str, int]:
        summary = {}
        for error in self.invalid_tickets:
            key = f"{error.error_type}({error.field_name})"
            summary[key] = summary.get(key, 0) + 1
        if self.duplicate_ticket_ids:
            summary["重复工单号"] = len(self.duplicate_ticket_ids)
        return summary


class TicketValidator:
    def __init__(self, config: Config):
        self.config = config
        self.time_formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y/%m/%d",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%dT%H:%M:%SZ"
        ]

    def validate(self, tickets: List[ParsedTicket]) -> ValidationResult:
        result = ValidationResult()
        
        seen_ticket_ids = set()
        duplicate_ids = set()
        
        for ticket in tickets:
            errors = self._validate_single_ticket(ticket)
            
            if errors:
                result.invalid_tickets.extend(errors)
            else:
                if ticket.ticket_id in seen_ticket_ids:
                    duplicate_ids.add(ticket.ticket_id)
                else:
                    seen_ticket_ids.add(ticket.ticket_id)
                    result.valid_tickets.append(ticket)
        
        result.duplicate_ticket_ids = list(duplicate_ids)
        
        for ticket_id in duplicate_ids:
            for ticket in tickets:
                if ticket.ticket_id == ticket_id:
                    result.invalid_tickets.append(ValidationError(
                        ticket_id=ticket_id,
                        field_name="工单号",
                        error_type="重复工单号",
                        error_message=f"工单号 '{ticket_id}' 重复出现",
                        row_index=ticket.row_index,
                        source_file=ticket.source_file,
                        raw_value=ticket_id
                    ))
        
        return result

    def _validate_single_ticket(self, ticket: ParsedTicket) -> List[ValidationError]:
        errors = []
        
        data = ticket.sanitized_data
        
        for field in self.config.required_fields:
            if field not in data or data[field] is None or str(data[field]).strip() == "":
                errors.append(ValidationError(
                    ticket_id=ticket.ticket_id,
                    field_name=field,
                    error_type="必填字段缺失",
                    error_message=f"必填字段 '{field}' 为空或缺失",
                    row_index=ticket.row_index,
                    source_file=ticket.source_file,
                    raw_value=data.get(field)
                ))
        
        if "时间" in data and data["time"]:
            time_value = str(data["time"]).strip()
            if not self._is_valid_time(time_value):
                errors.append(ValidationError(
                    ticket_id=ticket.ticket_id,
                    field_name="时间",
                    error_type="时间格式错误",
                    error_message=f"时间格式无效: '{time_value}'，支持的格式包括 YYYY-MM-DD, YYYY-MM-DD HH:MM:SS",
                    row_index=ticket.row_index,
                    source_file=ticket.source_file,
                    raw_value=time_value
                ))
        
        if "用户描述" in data and data["用户描述"]:
            description = str(data["用户描述"]).strip()
            if not description or len(description) < 2:
                errors.append(ValidationError(
                    ticket_id=ticket.ticket_id,
                    field_name="用户描述",
                    error_type="空文本",
                    error_message="用户描述文本太短或为空",
                    row_index=ticket.row_index,
                    source_file=ticket.source_file,
                    raw_value=description
                ))
        
        if "渠道" in data and data["渠道"] and self.config.channels:
            channel = str(data["渠道"]).strip()
            if channel not in self.config.channels:
                errors.append(ValidationError(
                    ticket_id=ticket.ticket_id,
                    field_name="渠道",
                    error_type="渠道不在配置中",
                    error_message=f"渠道 '{channel}' 不在配置的渠道列表中",
                    row_index=ticket.row_index,
                    source_file=ticket.source_file,
                    raw_value=channel
                ))
        
        if "产品线" in data and data["产品线"] and self.config.product_lines:
            product = str(data["产品线"]).strip()
            if product not in self.config.product_lines:
                errors.append(ValidationError(
                    ticket_id=ticket.ticket_id,
                    field_name="产品线",
                    error_type="产品线不在配置中",
                    error_message=f"产品线 '{product}' 不在配置的产品线列表中",
                    row_index=ticket.row_index,
                    source_file=ticket.source_file,
                    raw_value=product
                ))
        
        return errors

    def _is_valid_time(self, time_str: str) -> bool:
        if not time_str:
            return False
        
        time_str = time_str.strip()
        
        for fmt in self.time_formats:
            try:
                datetime.strptime(time_str, fmt)
                return True
            except (ValueError, TypeError):
                continue
        
        return False

    def save_quarantine(self, result: ValidationResult, import_id: str) -> Path:
        quarantine_data = {
            "import_id": import_id,
            "validation_time": datetime.now().isoformat(),
            "summary": {
                "total_tickets": result.valid_count + result.invalid_count,
                "valid_count": result.valid_count,
                "invalid_count": result.invalid_count,
                "error_summary": result.get_error_summary()
            },
            "invalid_records": []
        }
        
        for error in result.invalid_tickets:
            quarantine_data["invalid_records"].append({
                "ticket_id": error.ticket_id,
                "field_name": error.field_name,
                "error_type": error.error_type,
                "error_message": error.error_message,
                "row_index": error.row_index,
                "source_file": error.source_file,
                "raw_value": error.raw_value
            })
        
        quarantine_path = self.config.get_quarantine_path()
        quarantine_dir = quarantine_path.parent
        quarantine_dir.mkdir(exist_ok=True)
        
        if quarantine_path.exists():
            with open(quarantine_path, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
            if isinstance(existing_data, list):
                existing_data.append(quarantine_data)
            else:
                existing_data = [existing_data, quarantine_data]
            quarantine_data = existing_data
        else:
            quarantine_data = [quarantine_data]
        
        with open(quarantine_path, 'w', encoding='utf-8') as f:
            json.dump(quarantine_data, f, ensure_ascii=False, indent=2)
        
        return quarantine_path

    def load_quarantine(self) -> List[Dict[str, Any]]:
        quarantine_path = self.config.get_quarantine_path()
        
        if not quarantine_path.exists():
            return []
        
        with open(quarantine_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if isinstance(data, list):
            return data
        return [data]


def validate_tickets(config: Config, tickets: List[ParsedTicket], import_id: str) -> Tuple[ValidationResult, Path]:
    validator = TicketValidator(config)
    result = validator.validate(tickets)
    
    quarantine_path = validator.save_quarantine(result, import_id)
    
    return result, quarantine_path
