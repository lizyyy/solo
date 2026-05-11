import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List
from expense_audit.models import (
    ExpenseRule,
    ExpenseType,
    Invoice,
    Itinerary,
    ManualOverride,
)


def json_default(obj: Any) -> Any:
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, ExpenseType):
        return obj.value
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def json_decoder(dct: Dict[str, Any]) -> Dict[str, Any]:
    for key, value in dct.items():
        if isinstance(value, str):
            try:
                dct[key] = date.fromisoformat(value)
                continue
            except ValueError:
                pass
            try:
                dct[key] = datetime.fromisoformat(value)
                continue
            except ValueError:
                pass
        if key in ["amount", "max_amount", "max_daily_amount", "final_amount", "override_amount"]:
            if value is not None:
                dct[key] = Decimal(str(value))
    return dct


def load_itinerary(file_path: str) -> Itinerary:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f, object_hook=json_decoder)
    return Itinerary(**data)


def load_invoices(file_path: str) -> List[Invoice]:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f, object_hook=json_decoder)
    return [Invoice(**item) for item in data]


def load_rules(file_path: str) -> List[ExpenseRule]:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f, object_hook=json_decoder)
    return [ExpenseRule(**item) for item in data]


def load_manual_overrides(file_path: str) -> List[ManualOverride]:
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f, object_hook=json_decoder)
    return [ManualOverride(**item) for item in data]


def save_json(obj: Any, file_path: str) -> None:
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(obj, f, default=json_default, ensure_ascii=False, indent=2)


def save_manual_override(
    override: ManualOverride,
    file_path: str,
    append: bool = True,
) -> None:
    if append and file_path.endswith(".json"):
        try:
            existing = load_manual_overrides(file_path)
        except (FileNotFoundError, json.JSONDecodeError):
            existing = []
        existing.append(override)
        save_json([o.model_dump() for o in existing], file_path)
    else:
        save_json([override.model_dump()], file_path)
