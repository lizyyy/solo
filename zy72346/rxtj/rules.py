from enum import Enum
from dataclasses import dataclass
from typing import Optional


class DenominatorZeroPolicy(str, Enum):
    REJECT = "reject"
    FLAG_FOR_REVIEW = "flag_for_review"
    TREAT_AS_ZERO = "treat_as_zero"
    ROLLBACK = "rollback"


class ReviewStatus(str, Enum):
    PENDING = "pending"
    ANNOTATION_IMPORTED = "annotation_imported"
    SAMPLING_REVIEWED = "sampling_reviewed"
    DEMO_UPDATED = "demo_updated"
    FLAGGED = "flagged"
    ROLLED_BACK = "rolled_back"


class AnnotationSource(str, Enum):
    TEACHER_ANNOTATION = "teacher_annotation"
    SAMPLING_LIST = "sampling_list"
    MANUAL_OVERRIDE = "manual_override"


class ConflictResolution(str, Enum):
    ANNOTATION_WINS = "annotation_wins"
    SAMPLING_WINS = "sampling_wins"
    FLAG_FOR_HUMAN = "flag_for_human"


BOUNDARY_RULES = {
    "denominator_zero_empty_string": {
        "description": "分母为0却被填成空字符串",
        "policy": DenominatorZeroPolicy.FLAG_FOR_REVIEW,
        "auto_fix": False,
        "rollback_on_conflict": True,
        "evidence_required": True,
    },
    "denominator_zero_numeric": {
        "description": "分母为0且值为数值0",
        "policy": DenominatorZeroPolicy.TREAT_AS_ZERO,
        "auto_fix": True,
        "rollback_on_conflict": False,
        "evidence_required": False,
    },
    "duplicate_annotation": {
        "description": "重复导入同一批老师批注",
        "policy": "skip_with_diff",
        "auto_fix": True,
        "rollback_on_conflict": False,
        "evidence_required": True,
    },
    "conflict_annotation_vs_sampling": {
        "description": "老师批注与抽样名单冲突",
        "policy": ConflictResolution.FLAG_FOR_HUMAN,
        "auto_fix": False,
        "rollback_on_conflict": True,
        "evidence_required": True,
    },
}

DENOMINATOR_ZERO_ACTIONS = {
    DenominatorZeroPolicy.FLAG_FOR_REVIEW: (
        "不归正常，留待数据复核人复核；"
        "记录原始行号、老师批注内容、抽样名单对应值"
    ),
    DenominatorZeroPolicy.TREAT_AS_ZERO: (
        "视为0参与计算，但仍记录原始值在审计日志中"
    ),
    DenominatorZeroPolicy.REJECT: (
        "拒绝该条数据，不参与计算，记录拒绝原因"
    ),
    DenominatorZeroPolicy.ROLLBACK: (
        "回滚本次导入的所有变更，恢复到上一次一致状态"
    ),
}
