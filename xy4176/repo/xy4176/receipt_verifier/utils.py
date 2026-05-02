"""工具函数模块"""

import hashlib
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Optional, Union


def calculate_file_hash(file_path: Union[str, Path], algorithm: str = "sha256") -> str:
    """计算文件哈希值

    Args:
        file_path: 文件路径
        algorithm: 哈希算法，支持 md5、sha1、sha256、sha512

    Returns:
        十六进制哈希字符串
    """
    hash_algorithms = {
        "md5": hashlib.md5,
        "sha1": hashlib.sha1,
        "sha256": hashlib.sha256,
        "sha512": hashlib.sha512,
    }

    if algorithm not in hash_algorithms:
        raise ValueError(f"不支持的哈希算法: {algorithm}")

    hasher = hash_algorithms[algorithm]()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def parse_decimal(value: Any, default: Decimal = Decimal("0")) -> Decimal:
    """安全解析金额为 Decimal

    Args:
        value: 待解析的值
        default: 解析失败时的默认值

    Returns:
        Decimal 类型的金额
    """
    if value is None:
        return default

    if isinstance(value, Decimal):
        return value

    if isinstance(value, (int, float)):
        return Decimal(str(value))

    if isinstance(value, str):
        cleaned = re.sub(r"[^\d.\-]", "", value.strip())
        if cleaned:
            try:
                return Decimal(cleaned)
            except InvalidOperation:
                return default
    return default


def parse_date(value: Any, default: Optional[date] = None) -> Optional[date]:
    """安全解析日期

    Args:
        value: 待解析的值
        default: 解析失败时的默认值

    Returns:
        date 对象或 None
    """
    if value is None:
        return default

    if isinstance(value, date):
        return value

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, str):
        value = value.strip()
        if not value:
            return default

        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y年%m月%d日",
            "%m/%d/%Y",
            "%d/%m/%Y",
            "%Y%m%d",
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(value, fmt)
                return dt.date()
            except ValueError:
                continue

        try:
            from dateutil import parser

            dt = parser.parse(value, fuzzy=True)
            return dt.date()
        except (ImportError, ValueError):
            return default

    return default


def parse_datetime(value: Any, default: Optional[datetime] = None) -> Optional[datetime]:
    """安全解析日期时间

    Args:
        value: 待解析的值
        default: 解析失败时的默认值

    Returns:
        datetime 对象或 None
    """
    if value is None:
        return default

    if isinstance(value, datetime):
        return value

    if isinstance(value, date):
        return datetime.combine(value, datetime.min.time())

    if isinstance(value, str):
        value = value.strip()
        if not value:
            return default

        try:
            from dateutil import parser

            return parser.parse(value, fuzzy=True)
        except (ImportError, ValueError):
            return default

    return default


def normalize_text(text: str) -> str:
    """规范化文本（去除多余空白、统一全角半角等）

    Args:
        text: 原始文本

    Returns:
        规范化后的文本
    """
    if not text:
        return ""

    text = text.strip()
    text = re.sub(r"\s+", " ", text)

    fullwidth_to_halfwidth = str.maketrans(
        {
            chr(0xFF01 + i): chr(0x21 + i)
            for i in range(94)
        }
    )
    text = text.translate(fullwidth_to_halfwidth)

    return text


def extract_account_tail(account: str, length: int = 4) -> str:
    """提取账号尾号

    Args:
        account: 完整账号
        length: 尾号长度

    Returns:
        账号尾号
    """
    if not account:
        return ""

    cleaned = re.sub(r"[^\d]", "", account)
    if len(cleaned) >= length:
        return cleaned[-length:]
    return cleaned


def compare_fuzzy(str1: str, str2: str, threshold: float = 0.8) -> float:
    """模糊字符串比较（基于序列匹配）

    Args:
        str1: 第一个字符串
        str2: 第二个字符串
        threshold: 相似度阈值

    Returns:
        相似度得分 (0-1)
    """
    if not str1 or not str2:
        return 0.0

    str1 = normalize_text(str1).lower()
    str2 = normalize_text(str2).lower()

    if str1 == str2:
        return 1.0

    try:
        from difflib import SequenceMatcher

        matcher = SequenceMatcher(None, str1, str2)
        return matcher.ratio()
    except Exception:
        return 0.0


def ensure_directory(path: Union[str, Path]) -> Path:
    """确保目录存在，如果不存在则创建

    Args:
        path: 目录路径

    Returns:
        Path 对象
    """
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def generate_id(prefix: str = "", timestamp: bool = True) -> str:
    """生成唯一标识符

    Args:
        prefix: ID 前缀
        timestamp: 是否包含时间戳

    Returns:
        唯一 ID 字符串
    """
    import uuid

    uid = uuid.uuid4().hex[:12]
    if timestamp:
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        return f"{prefix}{ts}_{uid}" if prefix else f"{ts}_{uid}"
    return f"{prefix}{uid}" if prefix else uid


def amount_to_cn(amount: Decimal) -> str:
    """金额转中文大写

    Args:
        amount: 金额（Decimal）

    Returns:
        中文大写金额字符串
    """
    cn_nums = "零壹贰叁肆伍陆柒捌玖"
    cn_section_units = ["", "拾", "佰", "仟"]
    cn_big_units = ["", "万", "亿", "万亿"]

    if amount == Decimal("0"):
        return "零元整"

    amount_str = f"{amount:0.2f}"
    integer_part, decimal_part = amount_str.split(".")
    integer_part = integer_part.lstrip("0") or "0"

    def convert_section(section: str) -> str:
        """转换四位一节的数字"""
        result = ""
        section_len = len(section)
        zero_flag = False

        for i, digit in enumerate(section):
            d = int(digit)
            pos = section_len - i - 1

            if d != 0:
                if zero_flag:
                    result += "零"
                    zero_flag = False
                result += cn_nums[d] + cn_section_units[pos]
            else:
                zero_flag = True

        return result

    int_result = ""
    sections = []
    n = len(integer_part)
    for i in range(n, 0, -4):
        start = max(0, i - 4)
        sections.append(integer_part[start:i])
    sections.reverse()

    for i, section in enumerate(sections):
        section_result = convert_section(section)
        if section_result:
            big_unit_idx = len(sections) - 1 - i
            int_result += section_result + cn_big_units[big_unit_idx]

    if not int_result:
        int_result = "零"

    result = int_result + "元"

    jiao = int(decimal_part[0])
    fen = int(decimal_part[1])

    if jiao == 0 and fen == 0:
        result += "整"
    else:
        if jiao != 0:
            result += cn_nums[jiao] + "角"
        elif fen != 0 and int_result != "零":
            result += "零"

        if fen != 0:
            result += cn_nums[fen] + "分"
        elif jiao != 0:
            result += "整"

    return result
