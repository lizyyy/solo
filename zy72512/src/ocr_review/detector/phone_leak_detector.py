import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple

from ..models.ticket import Ticket, TicketField, TicketStatus
from ..models.rule import MaskRule, RuleStatus
from ..utils.mask import is_phone_number, find_phone_numbers, has_sensitive_data
from ..storage.store import DataStore


@dataclass
class FieldLeakInfo:
    field_name: str
    field_value: str
    leak_type: str
    detected_values: List[str]
    confidence: float
    suggestion: str
    ocr_confidence: Optional[float] = None


@dataclass
class LeakDetectionResult:
    ticket_id: str
    has_leaks: bool
    leaks: List[FieldLeakInfo] = field(default_factory=list)
    total_fields: int = 0
    leaked_fields: int = 0
    detection_time: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ticket_id": self.ticket_id,
            "has_leaks": self.has_leaks,
            "total_fields": self.total_fields,
            "leaked_fields": self.leaked_fields,
            "detection_time": self.detection_time,
            "leaks": [
                {
                    "field_name": l.field_name,
                    "leak_type": l.leak_type,
                    "detected_values": ["[已脱敏]" for _ in l.detected_values],
                    "confidence": l.confidence,
                    "suggestion": l.suggestion,
                    "ocr_confidence": l.ocr_confidence,
                }
                for l in self.leaks
            ],
        }


class LeakDetector:
    def __init__(self, store: DataStore):
        self.store = store
        self.phone_pattern = re.compile(r'(?<!\d)(1[3-9]\d{9})(?!\d)')

    def detect_ticket(self, ticket: Ticket, auto_mark: bool = True) -> LeakDetectionResult:
        from datetime import datetime
        result = LeakDetectionResult(
            ticket_id=ticket.ticket_id,
            has_leaks=False,
            total_fields=len(ticket.fields),
            detection_time=datetime.now().isoformat(),
        )

        active_rules = self.store.list_rules(status=RuleStatus.ACTIVE)
        phone_rules = [r for r in active_rules if r.rule_type.value == "phone"]

        for field in ticket.fields:
            leak_info = self._check_field_leak(field, phone_rules)
            if leak_info:
                result.leaks.append(leak_info)
                result.has_leaks = True
                result.leaked_fields += 1

                if auto_mark:
                    field.leak_detected = True
                    field.leak_note = f"检测到{leak_info.leak_type}泄露: {leak_info.suggestion}"
                    field.is_masked = False

        if auto_mark and result.has_leaks:
            ticket.set_status(TicketStatus.DETECTED_LEAK, assignee="operation")
            self.store.save_ticket(ticket)

        return result

    def _check_field_leak(self, field: TicketField, phone_rules: List[MaskRule]) -> Optional[FieldLeakInfo]:
        value = field.field_value
        if not value or field.is_masked:
            return None

        if is_phone_number(value):
            phones = find_phone_numbers(value)
            if phones:
                applicable_rules = [
                    r for r in phone_rules
                    if r.field_restriction is None or field.field_name in r.field_restriction
                ]

                if applicable_rules:
                    suggestion = f"应使用规则 {applicable_rules[0].rule_name} 进行脱敏"
                else:
                    suggestion = f"字段 '{field.field_name}' 不在现有手机号脱敏规则的适用范围内，需要补充规则"

                return FieldLeakInfo(
                    field_name=field.field_name,
                    field_value=value,
                    leak_type="phone",
                    detected_values=phones,
                    confidence=0.95,
                    suggestion=suggestion,
                    ocr_confidence=field.ocr_confidence,
                )

        has_sensitive, types = has_sensitive_data(value)
        if has_sensitive and "phone" in types:
            phones = find_phone_numbers(value)
            return FieldLeakInfo(
                field_name=field.field_name,
                field_value=value,
                leak_type="phone_in_text",
                detected_values=phones,
                confidence=0.85,
                suggestion=f"文本中包含手机号，需要脱敏处理",
                ocr_confidence=field.ocr_confidence,
            )

        return None

    def batch_detect(self, tickets: List[Ticket]) -> List[LeakDetectionResult]:
        results = []
        for ticket in tickets:
            result = self.detect_ticket(ticket)
            results.append(result)
        return results

    def get_leak_summary(self, results: List[LeakDetectionResult]) -> Dict[str, Any]:
        total = len(results)
        with_leaks = sum(1 for r in results if r.has_leaks)
        total_leaked_fields = sum(r.leaked_fields for r in results)

        leak_type_count = {}
        field_count = {}
        for result in results:
            for leak in result.leaks:
                leak_type_count[leak.leak_type] = leak_type_count.get(leak.leak_type, 0) + 1
                field_count[leak.field_name] = field_count.get(leak.field_name, 0) + 1

        return {
            "total_tickets": total,
            "tickets_with_leaks": with_leaks,
            "leak_rate": round(with_leaks / total * 100, 2) if total > 0 else 0,
            "total_leaked_fields": total_leaked_fields,
            "leak_type_distribution": leak_type_count,
            "field_distribution": field_count,
        }
