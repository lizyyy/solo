"""数据模型模块"""

from .base import BaseModel, AuditMixin, ConflictResolution
from .loan import LoanContract, RepaymentMethod
from .repayment import RepaymentRecord, RepaymentStatus
from .budget import Budget, IncomeExpense
from .penalty import PenaltyRule, PenaltyType
from .goal import ClientGoal, PrepayStrategy

__all__ = [
    "BaseModel",
    "AuditMixin",
    "ConflictResolution",
    "LoanContract",
    "RepaymentMethod",
    "RepaymentRecord",
    "RepaymentStatus",
    "Budget",
    "IncomeExpense",
    "PenaltyRule",
    "PenaltyType",
    "ClientGoal",
    "PrepayStrategy",
]
