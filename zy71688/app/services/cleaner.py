import re
from typing import Any, Optional

COMMON_TYPOS = {
    "高血压病": "高血压",
    "冠习病": "冠心病",
    "糖尿疴": "糖尿病",
    "脑梗塞": "脑梗死",
    "肺心痫": "肺心病",
    "风心痫": "风心病",
    "肾哀": "肾衰",
    "心哀": "心衰",
}


def clean_string(value: Any) -> str:
    if value is None:
        return ""
    s = str(value).strip()
    s = re.sub(r"\s+", " ", s)
    return s


def fix_typos(text: str) -> tuple[str, list[str]]:
    if not text:
        return text, []
    corrections = []
    result = text
    for wrong, right in COMMON_TYPOS.items():
        if wrong in result:
            result = result.replace(wrong, right)
            corrections.append(f"{wrong}→{right}")
    return result, corrections


def clean_row(row: dict) -> dict:
    cleaned = {}
    for k, v in row.items():
        if k is None or (isinstance(k, str) and k.strip() == ""):
            continue
        key = clean_string(k)
        if key == "":
            continue
        cleaned[key] = clean_string(v)
    return cleaned


def deduplicate_rows(rows: list[dict], key_fields: list[str]) -> tuple[list[dict], list[dict]]:
    seen = set()
    unique = []
    duplicates = []
    for row in rows:
        key = tuple(row.get(f, "") for f in key_fields)
        if key in seen:
            duplicates.append(row)
        else:
            seen.add(key)
            unique.append(row)
    return unique, duplicates


def clean_dataframe(raw_rows: list[dict], key_fields: Optional[list[str]] = None) -> dict:
    cleaned = [clean_row(r) for r in raw_rows]
    cleaned = [r for r in cleaned if any(v for v in r.values())]

    all_corrections = []
    for row in cleaned:
        for k, v in row.items():
            fixed, corrections = fix_typos(v)
            if corrections:
                row[k] = fixed
                all_corrections.extend(corrections)

    dups = []
    if key_fields:
        cleaned, dups = deduplicate_rows(cleaned, key_fields)

    return {
        "rows": cleaned,
        "duplicate_count": len(dups),
        "typo_corrections": all_corrections,
        "removed_empty_rows": len(raw_rows) - len(cleaned) - len(dups),
    }


def check_rule_version(deduction_rule_version: str, match_rule_version: str) -> bool:
    if not deduction_rule_version or not match_rule_version:
        return False
    return deduction_rule_version.strip() == match_rule_version.strip()


def check_material_completeness(materials: list[dict], required_categories: list[str]) -> list[str]:
    uploaded = {m.get("category", "") for m in materials if m.get("status") in ("uploaded", "verified")}
    missing = [c for c in required_categories if c not in uploaded]
    return missing


def check_duplicate_appeal(existing_appeals: list[dict], new_appeal: dict) -> bool:
    for existing in existing_appeals:
        if (existing.get("admission_no") and
                existing.get("admission_no") == new_appeal.get("admission_no") and
                existing.get("patient_name") == new_appeal.get("patient_name")):
            if existing.get("status") not in ("rejected", "returned"):
                return True
    return False
