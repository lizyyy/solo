from __future__ import annotations

import enum
from dataclasses import dataclass, field
from datetime import date
from typing import Optional


class ArrivalStatus(enum.Enum):
    MATCHED = "已到账"
    LATE = "到账晚于申报"
    NOT_ARRIVED = "未到账"
    NO_REMITTANCE = "无对应汇款"


class ProblemCategory(enum.Enum):
    LATE_ARRIVAL = "到账晚于申报"
    DUPLICATE_NAME = "人员重名"
    DUPLICATE_MONTH = "补缴月份重复"


class BadDataCategory(enum.Enum):
    PARSE_ERROR = "解析失败"
    MISSING_FIELD = "必填字段缺失"
    INVALID_DATE = "日期格式错误"
    INVALID_AMOUNT = "金额格式错误"
    INVALID_MONTH = "月份格式错误"


@dataclass
class BujiaoDan:
    dan_hao: str
    name: str
    id_number: str
    unit_code: str
    bujiao_month: str
    amount: float
    declare_date: date
    source_file: str = ""
    source_line: int = 0


@dataclass
class CanBaoRen:
    name: str
    id_number: str
    unit_code: str
    status: str
    source_file: str = ""
    source_line: int = 0


@dataclass
class DanWeiHuiKuan:
    unit_code: str
    amount: float
    remit_date: date
    arrival_date: Optional[date]
    remarks: str = ""
    source_file: str = ""
    source_line: int = 0


@dataclass
class BadRecord:
    category: BadDataCategory
    raw_line: str
    detail: str
    source_file: str
    source_line: int


@dataclass
class MatchResult:
    bujiao_dan: BujiaoDan
    matched_person: Optional[CanBaoRen] = None
    matched_remittance: Optional[DanWeiHuiKuan] = None
    arrival_status: ArrivalStatus = ArrivalStatus.NOT_ARRIVED
    person_match_reason: str = ""
    month_validation_reason: str = ""
    arrival_status_reason: str = ""
    problems: list[ProblemCategory] = field(default_factory=list)
