from enum import Enum, auto


class ExitCode(Enum):
    SUCCESS = 0
    PARTIAL_SUCCESS = 1
    NO_DATA = 2
    CONFIG_ERROR = 3
    FILE_NOT_FOUND = 4
    PARSE_ERROR = 5
    VALIDATION_ERROR = 6


class AdPlatform(Enum):
    BYTEDANCE = "bytedance"
    TENCENT = "tencent"
    ALIBABA = "alibaba"
    BAIDU = "baidu"
    KUAISHOU = "kuaishou"


class ValidationType(Enum):
    OVERSPEND = "overspend"
    SUSPECTED_DELAY = "suspected_delay"
    BUDGET_CHANGE = "budget_change"
    TIMEZONE_ISSUE = "timezone_issue"
    BACKFILL = "backfill"


REQUIRED_FIELDS = [
    "plan_id",
    "plan_name",
    "platform",
    "date",
    "cost",
    "budget",
    "impressions",
    "clicks",
    "report_time",
]

TIMEZONE_MAP = {
    "UTC": 0,
    "Asia/Shanghai": 8,
    "America/Los_Angeles": -8,
}

OVERSPEND_THRESHOLD = 1.2
DELAY_HOURS_THRESHOLD = 24
