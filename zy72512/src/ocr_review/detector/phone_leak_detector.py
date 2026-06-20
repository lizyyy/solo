import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from ..models.ticket import Ticket, TicketField, TicketStatus
from ..models.rule import MaskRule, RuleStatus
from ..utils.mask import (
    is_phone_number, find_phone_numbers, has_sensitive_data,
    PHONE_PATTERN, ID_CARD_PATTERN, BANK_CARD_PATTERN, EMAIL_PATTERN,
)
from ..storage.store import DataStore

OCR_LOW_CONFIDENCE_THRESHOLD = 0.7

SENSITIVE_TYPE_NAMES = {
    "phone": "手机号",
    "id_card": "身份证号",
    "bank_card": "银行卡号",
    "email": "邮箱",
}


@dataclass
class FieldLeakInfo:
    field_name: str
    field_value: str
    leak_type: str
    detected_values: List[str]
    confidence: float
    suggestion: str
    ocr_confidence: Optional[float] = None
    source: str = "new_detection"
    needs_algorithm_review: bool = False


@dataclass
class LeakDetectionResult:
    ticket_id: str
    has_leaks: bool
    leaks: List[FieldLeakInfo] = field(default_factory=list)
    total_fields: int = 0
    leaked_fields: int = 0
    detection_time: str = ""
    needs_algorithm_fields: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ticket_id": self.ticket_id,
            "has_leaks": self.has_leaks,
            "total_fields": self.total_fields,
            "leaked_fields": self.leaked_fields,
            "needs_algorithm_fields": self.needs_algorithm_fields,
            "detection_time": self.detection_time,
            "leaks": [
                {
                    "field_name": l.field_name,
                    "leak_type": l.leak_type,
                    "detected_values": ["[已脱敏]" for _ in l.detected_values],
                    "confidence": l.confidence,
                    "suggestion": l.suggestion,
                    "ocr_confidence": l.ocr_confidence,
                    "source": l.source,
                    "needs_algorithm_review": l.needs_algorithm_review,
                }
                for l in self.leaks
            ],
        }


class LeakDetector:
    def __init__(self, store: DataStore):
        self.store = store

    def detect_ticket(self, ticket: Ticket, auto_mark: bool = True) -> LeakDetectionResult:
        result = LeakDetectionResult(
            ticket_id=ticket.ticket_id,
            has_leaks=False,
            total_fields=len(ticket.fields),
            detection_time=datetime.now().isoformat(),
        )

        active_rules = self.store.list_rules(status=RuleStatus.ACTIVE)

        for fld in ticket.fields:
            leak_info = self._check_field_leak(fld, active_rules, ticket)
            if leak_info:
                result.leaks.append(leak_info)
                result.has_leaks = True
                result.leaked_fields += 1
                if leak_info.needs_algorithm_review:
                    result.needs_algorithm_fields += 1

                if auto_mark:
                    fld.leak_detected = True
                    if not fld.leak_note:
                        fld.leak_note = f"检测到{leak_info.leak_type}泄露: {leak_info.suggestion}"
                    elif leak_info.source == "previously_flagged":
                        pass
                    if leak_info.needs_algorithm_review and not fld.leak_note.endswith("[需算法复核]"):
                        fld.leak_note = (fld.leak_note or "") + " [需算法复核]"

        if auto_mark and result.has_leaks:
            has_low_conf = any(l.needs_algorithm_review for l in result.leaks)
            if has_low_conf:
                ticket.set_status(TicketStatus.DETECTED_LEAK, assignee="algorithm")
            else:
                ticket.set_status(TicketStatus.DETECTED_LEAK, assignee="operation")
            self.store.save_ticket(ticket)

        return result

    def _check_field_leak(
        self, fld: TicketField, active_rules: List[MaskRule], ticket: Ticket
    ) -> Optional[FieldLeakInfo]:
        if fld.leak_detected:
            return self._build_info_from_existing_flag(fld, active_rules)

        if fld.is_masked and fld.ocr_confidence and fld.ocr_confidence < OCR_LOW_CONFIDENCE_THRESHOLD:
            return self._build_low_confidence_info(fld, active_rules)

        if fld.is_masked:
            return None

        value = fld.field_value
        if not value:
            return None

        return self._scan_raw_field(fld, value, active_rules)

    def _build_info_from_existing_flag(
        self, fld: TicketField, active_rules: List[MaskRule]
    ) -> FieldLeakInfo:
        leak_type = "previously_detected"
        if fld.leak_note:
            for key, name in SENSITIVE_TYPE_NAMES.items():
                if name in fld.leak_note or key in fld.leak_note:
                    leak_type = key
                    break

        needs_algo = (
            fld.ocr_confidence is not None
            and fld.ocr_confidence < OCR_LOW_CONFIDENCE_THRESHOLD
        )

        suggestion = fld.leak_note or "先前已检测到的泄露字段"
        if needs_algo:
            suggestion += f" (OCR置信度{fld.ocr_confidence:.2f}<0.7，需算法同事复核)"

        return FieldLeakInfo(
            field_name=fld.field_name,
            field_value=fld.get_display_value() if hasattr(fld, "get_display_value") else fld.field_value,
            leak_type=leak_type,
            detected_values=["[已标记]"],
            confidence=0.95,
            suggestion=suggestion,
            ocr_confidence=fld.ocr_confidence,
            source="previously_flagged",
            needs_algorithm_review=needs_algo,
        )

    def _build_low_confidence_info(
        self, fld: TicketField, active_rules: List[MaskRule]
    ) -> FieldLeakInfo:
        sensitive_type = self._infer_sensitive_type(fld, active_rules)

        return FieldLeakInfo(
            field_name=fld.field_name,
            field_value=fld.get_display_value() if hasattr(fld, "get_display_value") else fld.field_value,
            leak_type=f"low_confidence_{sensitive_type}",
            detected_values=["[低置信度需复核]"],
            confidence=fld.ocr_confidence or 0.5,
            suggestion=f"OCR置信度{fld.ocr_confidence:.2f}<0.7，{SENSITIVE_TYPE_NAMES.get(sensitive_type, '敏感数据')}识别结果不可靠，需算法同事复核OCR识别准确性",
            ocr_confidence=fld.ocr_confidence,
            source="low_confidence_check",
            needs_algorithm_review=True,
        )

    def _infer_sensitive_type(self, fld: TicketField, active_rules: List[MaskRule]) -> str:
        for rule in active_rules:
            if rule.field_restriction and fld.field_name in rule.field_restriction:
                return rule.rule_type.value
        if "phone" in fld.field_name or "手机" in fld.field_name:
            return "phone"
        if "id_card" in fld.field_name or "身份证" in fld.field_name:
            return "id_card"
        if "bank" in fld.field_name or "银行卡" in fld.field_name:
            return "bank_card"
        if "email" in fld.field_name or "邮箱" in fld.field_name:
            return "email"
        return "unknown"

    def _scan_raw_field(
        self, fld: TicketField, value: str, active_rules: List[MaskRule]
    ) -> Optional[FieldLeakInfo]:
        has, types = has_sensitive_data(value)
        if not has:
            return None

        needs_algo = (
            fld.ocr_confidence is not None
            and fld.ocr_confidence < OCR_LOW_CONFIDENCE_THRESHOLD
        )

        for stype in ["phone", "id_card", "bank_card", "email"]:
            if stype in types:
                type_rules = [
                    r for r in active_rules
                    if r.rule_type.value == stype
                    and (r.field_restriction is None or fld.field_name in r.field_restriction)
                ]
                all_type_rules = [r for r in active_rules if r.rule_type.value == stype]

                detected = self._find_values(value, stype)

                if type_rules:
                    suggestion = f"应使用规则 {type_rules[0].rule_name} 进行脱敏"
                elif all_type_rules:
                    suggestion = f"字段 '{fld.field_name}' 不在现有{SENSITIVE_TYPE_NAMES[stype]}脱敏规则的适用范围内，需要补充规则"
                else:
                    suggestion = f"检测到{SENSITIVE_TYPE_NAMES[stype]}但无对应脱敏规则，需补充规则"

                if needs_algo:
                    suggestion += f" | OCR置信度{fld.ocr_confidence:.2f}<0.7，需算法同事复核"

                return FieldLeakInfo(
                    field_name=fld.field_name,
                    field_value=value,
                    leak_type=stype if len(types) == 1 else f"{stype}_in_text",
                    detected_values=detected,
                    confidence=0.95 if stype == "phone" else 0.90,
                    suggestion=suggestion,
                    ocr_confidence=fld.ocr_confidence,
                    source="new_detection",
                    needs_algorithm_review=needs_algo,
                )

        return None

    def _find_values(self, text: str, stype: str) -> List[str]:
        patterns = {
            "phone": PHONE_PATTERN,
            "id_card": ID_CARD_PATTERN,
            "bank_card": BANK_CARD_PATTERN,
            "email": EMAIL_PATTERN,
        }
        p = patterns.get(stype)
        if p:
            return p.findall(text)
        return []

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
        total_needs_algo = sum(r.needs_algorithm_fields for r in results)

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
            "needs_algorithm_fields": total_needs_algo,
            "leak_type_distribution": leak_type_count,
            "field_distribution": field_count,
        }
