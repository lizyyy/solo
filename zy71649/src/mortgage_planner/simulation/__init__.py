"""模拟与情景对比模块"""

from .scenario import Scenario, ScenarioResult, compare_scenarios
from .constraints import (
    ConstraintCheck,
    ConstraintType,
    check_all_constraints,
    check_cashflow_constraint,
    check_prepay_period_constraint,
    check_prepay_amount_constraint,
    check_penalty_constraint,
    get_failed_constraints,
    get_critical_issues,
)

__all__ = [
    "Scenario",
    "ScenarioResult",
    "compare_scenarios",
    "ConstraintCheck",
    "ConstraintType",
    "check_all_constraints",
    "check_cashflow_constraint",
    "check_prepay_period_constraint",
    "check_prepay_amount_constraint",
    "check_penalty_constraint",
    "get_failed_constraints",
    "get_critical_issues",
]
