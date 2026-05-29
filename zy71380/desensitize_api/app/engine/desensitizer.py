from __future__ import annotations

import re
import json
from typing import Any


PHONE_PATTERNS = [
    re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)"),
    re.compile(r"(?<!\d)\+86\s*1[3-9]\d{9}(?!\d)"),
    re.compile(r"(?<!\d)86\s*1[3-9]\d{9}(?!\d)"),
    re.compile(r"(?<!\d)1[3-9]\d{4}[\-\s]\d{4}(?!\d)"),
]


def find_phones(text: str, custom_pattern: str | None = None) -> list[dict]:
    results = []
    seen_spans = set()
    patterns = [re.compile(custom_pattern)] if custom_pattern else PHONE_PATTERNS
    for pat in patterns:
        for m in pat.finditer(text):
            span = m.span()
            if span not in seen_spans:
                seen_spans.add(span)
                raw = m.group()
                cleaned = re.sub(r"[^\d]", "", raw)
                if len(cleaned) >= 11:
                    phone = cleaned[-11:]
                    results.append({
                        "raw": raw,
                        "phone": phone,
                        "start": m.start(),
                        "end": m.end(),
                    })
    results.sort(key=lambda x: x["start"])
    return results


def desensitize_phone(phone: str, mask_start: int = 3, mask_end: int = 4, mask_char: str = "*") -> str:
    if len(phone) < mask_start + mask_end + 1:
        return mask_char * len(phone)
    prefix = phone[:mask_start]
    suffix = phone[-mask_end:]
    middle_len = len(phone) - mask_start - mask_end
    return f"{prefix}{mask_char * middle_len}{suffix}"


def desensitize_text(text: str, rule: dict, exceptions: list[dict] | None = None) -> list[dict]:
    exceptions = exceptions or []
    phones = find_phones(text, rule.get("pattern"))
    results = []
    for phone_info in phones:
        phone = phone_info["phone"]
        exception_match = _check_exception(phone, exceptions)
        if exception_match and exception_match.get("is_expired") is False:
            results.append({
                "field_path": f"text[{phone_info['start']}:{phone_info['end']}]",
                "original_value": phone,
                "desensitized_value": phone,
                "expected_value": desensitize_phone(phone, rule["mask_start"], rule["mask_end"], rule["mask_char"]),
                "is_consistent": False,
                "block_reason": f"EXCEPTION_MATCHED:id={exception_match['id']}",
                "exception_id": exception_match["id"],
                "source_location": f"char {phone_info['start']}-{phone_info['end']}",
            })
        else:
            des = desensitize_phone(phone, rule["mask_start"], rule["mask_end"], rule["mask_char"])
            expected = des
            results.append({
                "field_path": f"text[{phone_info['start']}:{phone_info['end']}]",
                "original_value": phone,
                "desensitized_value": des,
                "expected_value": expected,
                "is_consistent": True,
                "block_reason": None,
                "exception_id": None,
                "source_location": f"char {phone_info['start']}-{phone_info['end']}",
            })
    return results


def desensitize_json(data: Any, rule: dict, exceptions: list[dict] | None = None, path: str = "") -> list[dict]:
    exceptions = exceptions or []
    results = []
    field_paths = rule.get("field_paths", [])
    field_names = set()
    for fp in field_paths:
        field_names.add(fp.split(".")[-1])

    if isinstance(data, dict):
        for key, value in data.items():
            current_path = f"{path}.{key}" if path else key
            is_target_field = key in field_names or current_path in field_paths
            if isinstance(value, str) and is_target_field:
                results.extend(_process_field(value, current_path, rule, exceptions, "json"))
            elif isinstance(value, str) and not is_target_field:
                phones = find_phones(value, rule.get("pattern"))
                if phones:
                    for pi in phones:
                        results.append({
                            "field_path": f"{current_path}[{pi['start']}:{pi['end']}]",
                            "original_value": pi["phone"],
                            "desensitized_value": pi["phone"],
                            "expected_value": desensitize_phone(pi["phone"], rule["mask_start"], rule["mask_end"], rule["mask_char"]),
                            "is_consistent": False,
                            "block_reason": "NESTED_FIELD_MISSED",
                            "exception_id": None,
                            "source_location": f"json:{current_path}",
                        })
            elif isinstance(value, (dict, list)):
                results.extend(desensitize_json(value, rule, exceptions, current_path))
    elif isinstance(data, list):
        for i, item in enumerate(data):
            current_path = f"{path}[{i}]"
            results.extend(desensitize_json(item, rule, exceptions, current_path))
    return results


def _process_field(value: str, path: str, rule: dict, exceptions: list[dict], source: str) -> list[dict]:
    results = []
    phones = find_phones(value, rule.get("pattern"))
    for phone_info in phones:
        phone = phone_info["phone"]
        exception_match = _check_exception(phone, exceptions)
        if exception_match and exception_match.get("is_expired") is False:
            results.append({
                "field_path": path,
                "original_value": phone,
                "desensitized_value": phone,
                "expected_value": desensitize_phone(phone, rule["mask_start"], rule["mask_end"], rule["mask_char"]),
                "is_consistent": False,
                "block_reason": f"EXCEPTION_MATCHED:id={exception_match['id']}",
                "exception_id": exception_match["id"],
                "source_location": f"{source}:{path}",
            })
        elif exception_match and exception_match.get("is_expired") is True:
            results.append({
                "field_path": path,
                "original_value": phone,
                "desensitized_value": phone,
                "expected_value": desensitize_phone(phone, rule["mask_start"], rule["mask_end"], rule["mask_char"]),
                "is_consistent": False,
                "block_reason": "EXCEPTION_EXPIRED",
                "exception_id": exception_match["id"],
                "source_location": f"{source}:{path}",
            })
        else:
            des = desensitize_phone(phone, rule["mask_start"], rule["mask_end"], rule["mask_char"])
            results.append({
                "field_path": path,
                "original_value": phone,
                "desensitized_value": des,
                "expected_value": des,
                "is_consistent": True,
                "block_reason": None,
                "exception_id": None,
                "source_location": f"{source}:{path}",
            })
    return results


def _check_exception(phone: str, exceptions: list[dict]) -> dict | None:
    for exc in exceptions:
        if exc.get("status") not in ("active",):
            continue
        pattern = exc.get("phone_pattern", "")
        if pattern == phone:
            return exc
        try:
            if re.fullmatch(pattern, phone):
                return exc
        except re.error:
            continue
    return None
