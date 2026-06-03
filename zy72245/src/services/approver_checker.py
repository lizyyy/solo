import re
from typing import Optional

PINYIN_PATTERN = re.compile(
    r'^[a-zA-Z]{2,}(\s[a-zA-Z]{2,})*$'
)

COMMON_PINYIN_NAMES = {
    "zhangsan", "lisi", "wangwu", "zhaoliu", "linjie",
    "zhang san", "li si", "wang wu", "zhao liu", "lin jie",
    "zhangs", "lis", "wangw", "zhaol", "linj",
}

CHINESE_PATTERN = re.compile(r'[\u4e00-\u9fff]')


def is_pinyin_only(approver: str) -> bool:
    if not approver or not approver.strip():
        return True
    if CHINESE_PATTERN.search(approver):
        return False
    cleaned = approver.strip().lower()
    if PINYIN_PATTERN.match(cleaned):
        return True
    if cleaned in COMMON_PINYIN_NAMES:
        return True
    return False


def classify_approver(approver: str) -> str:
    from src.models.db import APPROVER_STATUS_PINYIN_ONLY, APPROVER_STATUS_NORMAL
    if is_pinyin_only(approver):
        return APPROVER_STATUS_PINYIN_ONLY
    return APPROVER_STATUS_NORMAL
