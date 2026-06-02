import re
import unicodedata
from typing import List


def is_pinyin_only(name: str) -> bool:
    if not name or not name.strip():
        return True
    name = name.strip()
    has_chinese = any(
        "CJK" in unicodedata.name(ch, "")
        for ch in name
        if ch.strip()
    )
    if has_chinese:
        return False
    ascii_letters_pattern = re.compile(r'^[a-zA-Z\s·.]+$')
    if ascii_letters_pattern.match(name):
        return True
    return False


def detect_pinyin_approvers(records: List[dict]) -> List[dict]:
    flagged = []
    for rec in records:
        approver = rec.get("approver_name", "")
        if is_pinyin_only(approver):
            flagged.append({
                **rec,
                "approver_is_pinyin": True,
                "flag_reason": f"审批人'{approver}'仅留拼音，无法确认身份",
            })
        else:
            flagged.append({
                **rec,
                "approver_is_pinyin": False,
                "flag_reason": None,
            })
    return flagged
