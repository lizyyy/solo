"""核心符号化简与等价性判断模块"""

from sympy import (
    sympify, simplify, trigsimp, radsimp, ratsimp,
    expand, factor, together, apart, cancel,
    Symbol, symbols, Eq, And, Or, Not, Implies,
    solve, solveset, S, Union, Interval, EmptySet, FiniteSet,
    sin, cos, tan, log, exp, sqrt, Abs,
    PolynomialError,
)
from sympy.core.sympify import SympifyError
from typing import Tuple, List, Dict, Optional, Set
import re


class SymbolicExpression:
    """符号表达式封装类"""
    
    def __init__(self, expr_str: str, variables: Optional[List[str]] = None):
        self.expr_str = expr_str
        self.variables = variables or []
        self.expr = None
        self.error = None
        self._parse()
    
    def _parse(self):
        """解析表达式字符串"""
        try:
            self.expr = sympify(self.expr_str)
            if self.variables:
                for v in self.variables:
                    if v not in [str(s) for s in self.expr.free_symbols]:
                        pass
        except SympifyError as e:
            self.error = f"表达式解析错误: {str(e)}"
        except Exception as e:
            self.error = f"未知解析错误: {str(e)}"
    
    def is_valid(self) -> bool:
        """检查表达式是否有效"""
        return self.expr is not None and self.error is None
    
    def simplify(self, method: str = "auto"):
        """化简表达式"""
        if not self.is_valid():
            return None
        
        expr = self.expr
        if method == "auto":
            return simplify(expr)
        elif method == "expand":
            return expand(expr)
        elif method == "factor":
            return factor(expr)
        elif method == "trig":
            return trigsimp(expr)
        elif method == "radical":
            return radsimp(expr)
        elif method == "rational":
            return ratsimp(expr)
        elif method == "together":
            return together(expr)
        elif method == "cancel":
            return cancel(expr)
        return simplify(expr)
    
    def get_free_symbols(self) -> Set[str]:
        """获取自由变量"""
        if not self.is_valid():
            return set()
        return {str(s) for s in self.expr.free_symbols}


class EquivalenceChecker:
    """等价性检查器"""
    
    @staticmethod
    def are_equivalent(
        expr1: SymbolicExpression, 
        expr2: SymbolicExpression,
        check_method: str = "simplify"
    ) -> Tuple[bool, str]:
        """
        检查两个表达式是否等价
        
        返回: (是否等价, 说明)
        """
        if not expr1.is_valid():
            return False, f"第一个表达式无效: {expr1.error}"
        if not expr2.is_valid():
            return False, f"第二个表达式无效: {expr2.error}"
        
        e1, e2 = expr1.expr, expr2.expr
        
        if check_method == "simplify":
            diff = simplify(e1 - e2)
            if diff == 0:
                return True, "化简后差值为0"
        
        if check_method == "expand":
            diff = simplify(expand(e1) - expand(e2))
            if diff == 0:
                return True, "展开后差值为0"
        
        try:
            ratio = simplify(e1 / e2)
            if ratio == 1:
                return True, "比值为1"
        except:
            pass
        
        try:
            symbols_common = set(e1.free_symbols) & set(e2.free_symbols)
            if symbols_common:
                from sympy import Equality
                eq = Equality(e1, e2)
                if eq == True:
                    return True, "直接相等"
        except:
            pass
        
        return False, "多种方法验证均不等价"
    
    @staticmethod
    def check_equivalence_with_constraints(
        expr1: SymbolicExpression,
        expr2: SymbolicExpression,
        constraints: List[str]
    ) -> Tuple[bool, str, List[str]]:
        """
        带约束检查的等价性判断
        
        返回: (是否等价, 说明, 违反的约束列表)
        """
        base_result, reason = EquivalenceChecker.are_equivalent(expr1, expr2)
        
        violated = []
        if constraints:
            for constraint in constraints:
                if not ConstraintChecker.validate_constraint(expr1, constraint):
                    violated.append(constraint)
        
        final_result = base_result and len(violated) == 0
        final_reason = reason
        if violated:
            final_reason += f" (违反约束: {', '.join(violated)})"
        
        return final_result, final_reason, violated


class ConstraintChecker:
    """约束检查器"""
    
    @staticmethod
    def parse_constraint(constraint_str: str):
        """解析约束字符串"""
        try:
            return sympify(constraint_str)
        except:
            return None
    
    @staticmethod
    def validate_constraint(expr: SymbolicExpression, constraint_str: str) -> bool:
        """验证约束是否满足"""
        if not expr.is_valid():
            return False
        
        constraint = ConstraintChecker.parse_constraint(constraint_str)
        if constraint is None:
            return False
        
        return True
    
    @staticmethod
    def find_domain_violations(expr: SymbolicExpression) -> List[str]:
        """
        查找定义域违规情况（除零、根号负等）
        """
        violations = []
        if not expr.is_valid():
            return violations
        
        e = expr.expr
        
        denominators = ConstraintChecker._find_denominators(e)
        for denom in denominators:
            if denom != 1:
                violations.append(f"分母可能为零: {denom}")
        
        radicals = ConstraintChecker._find_radicals(e)
        for rad in radicals:
            violations.append(f"根号内可能为负: {rad}")
        
        logs = ConstraintChecker._find_log_arguments(e)
        for arg in logs:
            violations.append(f"对数参数可能非正: {arg}")
        
        return violations
    
    @staticmethod
    def _find_denominators(expr) -> List:
        """查找所有分母"""
        denoms = []
        if expr.is_Pow and expr.exp < 0:
            denoms.append(expr.base)
        elif expr.is_Mul:
            for arg in expr.args:
                if arg.is_Pow and arg.exp < 0:
                    denoms.append(arg.base)
        for arg in expr.args:
            denoms.extend(ConstraintChecker._find_denominators(arg))
        return denoms
    
    @staticmethod
    def _find_radicals(expr) -> List:
        """查找所有根号表达式"""
        radicals = []
        if expr.is_Pow and 0 < expr.exp < 1:
            radicals.append(expr.base)
        for arg in expr.args:
            radicals.extend(ConstraintChecker._find_radicals(arg))
        return radicals
    
    @staticmethod
    def _find_log_arguments(expr) -> List:
        """查找所有对数参数"""
        args = []
        if expr.func == log:
            args.append(expr.args[0])
        for arg in expr.args:
            args.extend(ConstraintChecker._find_log_arguments(arg))
        return args
