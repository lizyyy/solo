"""步骤校验与约束检查模块"""

from typing import List, Dict, Tuple, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import uuid

from .core import SymbolicExpression, EquivalenceChecker, ConstraintChecker


class StepStatus(Enum):
    """步骤状态"""
    CORRECT = "correct"
    INCORRECT = "incorrect"
    WARNING = "warning"
    SKIPPED = "skipped"


@dataclass
class StepCheckResult:
    """单步检查结果"""
    step_index: int
    from_expr: str
    to_expr: str
    status: StepStatus
    is_equivalent: bool
    equivalence_reason: str
    domain_violations: List[str] = field(default_factory=list)
    constraint_violations: List[str] = field(default_factory=list)
    error_messages: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict:
        return {
            "step_index": self.step_index,
            "from_expr": self.from_expr,
            "to_expr": self.to_expr,
            "status": self.status.value,
            "is_equivalent": self.is_equivalent,
            "equivalence_reason": self.equivalence_reason,
            "domain_violations": self.domain_violations,
            "constraint_violations": self.constraint_violations,
            "error_messages": self.error_messages,
            "details": self.details
        }


class StepChecker:
    """变形步骤检查器"""
    
    def __init__(self, variables: Optional[List[str]] = None):
        self.variables = variables or []
    
    def check_single_step(
        self, 
        from_expr_str: str, 
        to_expr_str: str,
        constraints: Optional[List[str]] = None
    ) -> StepCheckResult:
        """
        检查单个变形步骤
        
        Args:
            from_expr_str: 起始表达式
            to_expr_str: 目标表达式
            constraints: 变量约束列表
            
        Returns:
            StepCheckResult: 检查结果
        """
        constraints = constraints or []
        
        from_expr = SymbolicExpression(from_expr_str, self.variables)
        to_expr = SymbolicExpression(to_expr_str, self.variables)
        
        result = StepCheckResult(
            step_index=0,
            from_expr=from_expr_str,
            to_expr=to_expr_str,
            status=StepStatus.SKIPPED,
            is_equivalent=False,
            equivalence_reason="未检查"
        )
        
        if not from_expr.is_valid():
            result.error_messages.append(f"起始表达式无效: {from_expr.error}")
            result.status = StepStatus.INCORRECT
            return result
        
        if not to_expr.is_valid():
            result.error_messages.append(f"目标表达式无效: {to_expr.error}")
            result.status = StepStatus.INCORRECT
            return result
        
        domain_violations = ConstraintChecker.find_domain_violations(to_expr)
        result.domain_violations = domain_violations
        
        is_equiv, reason, violated_constraints = EquivalenceChecker.check_equivalence_with_constraints(
            from_expr, to_expr, constraints
        )
        result.is_equivalent = is_equiv
        result.equivalence_reason = reason
        result.constraint_violations = violated_constraints
        
        if not is_equiv:
            result.status = StepStatus.INCORRECT
        elif domain_violations or violated_constraints:
            result.status = StepStatus.WARNING
        else:
            result.status = StepStatus.CORRECT
        
        result.details["from_simplified"] = str(from_expr.simplify())
        result.details["to_simplified"] = str(to_expr.simplify())
        result.details["free_symbols_from"] = list(from_expr.get_free_symbols())
        result.details["free_symbols_to"] = list(to_expr.get_free_symbols())
        
        return result
    
    def check_all_steps(
        self,
        steps: List[str],
        constraints: Optional[List[str]] = None,
        check_transitive: bool = True
    ) -> List[StepCheckResult]:
        """
        检查所有变形步骤
        
        Args:
            steps: 变形步骤列表（包含原始表达式和所有中间步骤）
            constraints: 变量约束列表
            check_transitive: 是否检查传递等价性（每一步都与原始表达式比较）
            
        Returns:
            List[StepCheckResult]: 所有步骤的检查结果
        """
        if len(steps) < 2:
            return []
        
        results = []
        constraints = constraints or []
        
        for i in range(len(steps) - 1):
            step_result = self.check_single_step(
                steps[i],
                steps[i + 1],
                constraints
            )
            step_result.step_index = i
            results.append(step_result)
        
        return results
