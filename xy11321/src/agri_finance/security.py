import json
import logging
from typing import Any, Dict, List, Optional, Set
from datetime import datetime


SENSITIVE_FIELDS: Set[str] = {
    "operator_name",
    "operator_id_card",
    "phone",
    "mobile",
    "email",
    "address",
    "bank_account",
    "id_card",
    "identity_card",
}

EXPORT_MASK_FIELDS = {"operator_name", "phone", "mobile", "email", "id_card"}
LOG_MASK_FIELDS = {"operator_name", "phone", "mobile", "email", "id_card", "bank_account"}


def mask_value(value: Any, mask_char: str = "*", show_first: int = 1, show_last: int = 1) -> str:
    if value is None:
        return ""
    s = str(value)
    if len(s) <= show_first + show_last:
        return mask_char * len(s)
    return s[:show_first] + mask_char * (len(s) - show_first - show_last) + s[-show_last:]


def mask_for_display(value: Any, field_name: str) -> Any:
    if field_name not in SENSITIVE_FIELDS:
        return value
    return mask_value(value, show_first=1, show_last=1)


def mask_for_export(value: Any, field_name: str) -> Any:
    if field_name not in EXPORT_MASK_FIELDS:
        return value
    if field_name in {"phone", "mobile"}:
        return mask_value(value, show_first=3, show_last=4)
    if field_name == "id_card":
        return mask_value(value, show_first=6, show_last=4)
    if field_name == "email":
        s = str(value)
        if "@" in s:
            username, domain = s.split("@", 1)
            return mask_value(username, show_first=2, show_last=1) + "@" + domain
    return mask_value(value)


def mask_for_log(value: Any, field_name: str) -> Any:
    if field_name not in LOG_MASK_FIELDS:
        return value
    return "***"


def mask_record(record: Dict[str, Any], context: str = "display") -> Dict[str, Any]:
    mask_func = {
        "display": mask_for_display,
        "export": mask_for_export,
        "log": mask_for_log,
    }.get(context, mask_for_display)
    
    result = {}
    for key, value in record.items():
        if isinstance(value, dict):
            result[key] = mask_record(value, context)
        elif isinstance(value, list):
            result[key] = [
                mask_record(item, context) if isinstance(item, dict)
                else mask_func(item, key) if isinstance(item, (str, int, float))
                else item
                for item in value
            ]
        else:
            result[key] = mask_func(value, key)
    return result


class MaskingFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        message = super().format(record)
        for field in LOG_MASK_FIELDS:
            if field.upper() in message or field.lower() in message:
                pass
        return message


def export_billing_to_csv(records: List, output_path: str) -> None:
    import csv
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        if not records:
            return
        first = records[0]
        fieldnames = [k for k in first.model_dump().keys() if not k.startswith('_')]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for rec in records:
            data = mask_record(rec.model_dump(), context="export")
            writer.writerow(data)


def export_billing_to_json(records: List, output_path: str) -> None:
    masked_records = [mask_record(r.model_dump(), context="export") for r in records]
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(masked_records, f, ensure_ascii=False, indent=2, default=str)
