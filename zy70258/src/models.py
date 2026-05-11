from dataclasses import dataclass, field
from typing import List, Set, Optional
from enum import Enum


class VerificationStatus(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    NEED_MANUAL_CHECK = "NEED_MANUAL_CHECK"


class FailureReason(Enum):
    ALLERGEN_MISMATCH = "过敏源不匹配"
    DIETARY_RESTRICTION_VIOLATED = "违反忌口规则"
    NO_VALID_SUBSTITUTE = "无有效替换餐"
    MISSING_DATA = "数据缺失"
    INVALID_FORMAT = "格式错误"


@dataclass
class ElderlyProfile:
    id: str
    name: str
    room_number: str
    known_allergens: Set[str] = field(default_factory=set)
    dietary_restrictions: Set[str] = field(default_factory=set)
    special_conditions: List[str] = field(default_factory=list)


@dataclass
class Dish:
    id: str
    name: str
    category: str
    allergens: Set[str] = field(default_factory=set)
    dietary_tags: Set[str] = field(default_factory=set)


@dataclass
class MealOrder:
    id: str
    elderly_id: str
    delivery_date: str
    meal_type: str
    dish_ids: List[str] = field(default_factory=list)


@dataclass
class SubstitutionRule:
    id: str
    source_dish_id: str
    substitute_dish_id: str
    applicable_conditions: Set[str] = field(default_factory=set)


@dataclass
class VerificationIssue:
    order_id: str
    elderly_name: str
    dish_name: str
    reason: FailureReason
    details: str
    source_line: Optional[int] = None
    source_file: Optional[str] = None


@dataclass
class VerificationResult:
    status: VerificationStatus
    issues: List[VerificationIssue] = field(default_factory=list)
    substituted_dishes: List[tuple] = field(default_factory=list)


@dataclass
class ProcessSummary:
    total_records: int
    processed_records: int
    skipped_records: int
    passed_records: int
    failed_records: int
    manual_check_needed: int
    issues: List[VerificationIssue] = field(default_factory=list)
