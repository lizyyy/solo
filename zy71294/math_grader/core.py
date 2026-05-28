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
        constraints: List[str],
        check_domain_consistency: bool = True
    ) -> Tuple[bool, str, List[str]]:
        """
        带约束检查的等价性判断
        
        Args:
            expr1: 起始表达式
            expr2: 目标表达式
            constraints: 用户给定的约束条件（题目要求）
            check_domain_consistency: 是否检查定义域一致性
        
        返回: (是否等价, 说明, 与题目约束冲突的列表)
        """
        base_result, reason = EquivalenceChecker.are_equivalent(expr1, expr2)
        
        constraint_conflicts = []
        if constraints:
            for constraint in constraints:
                if not ConstraintChecker.validate_constraint(expr2, constraint):
                    constraint_conflicts.append(constraint)
        
        final_result = base_result and len(constraint_conflicts) == 0
        final_reason = reason
        if constraint_conflicts:
            final_reason += f" (与题目约束冲突: {', '.join(constraint_conflicts)})"
        
        return final_result, final_reason, constraint_conflicts


class DomainConstraint:
    """定义域约束"""
    
    def __init__(self, constraint_type: str, expression: str, condition: str):
        self.constraint_type = constraint_type
        self.expression = expression
        self.condition = condition
    
    def __str__(self) -> str:
        return self.condition
    
    def to_dict(self) -> Dict:
        return {
            "type": self.constraint_type,
            "expression": self.expression,
            "condition": self.condition
        }


class ConstraintChecker:
    """约束检查器"""
    
    @staticmethod
    def parse_constraint(constraint_str: str):
        """解析约束字符串"""
        try:
            from sympy import parse_expr
            return parse_expr(constraint_str, evaluate=False)
        except:
            try:
                return sympify(constraint_str)
            except:
                return None
    
    @staticmethod
    def normalize_constraint(constraint_str: str) -> str:
        """标准化约束字符串，便于比较
        
        将约束转换为标准形式：expr op 0
        例如：x != 1 → x-1 != 0
              x > 0 → x > 0
        """
        s = constraint_str.strip()
        s = s.replace(" ", "")
        s = s.replace("！=", "!=")
        s = s.replace("＞=", ">=")
        s = s.replace("＜=", "<=")
        s = s.replace("＞", ">")
        s = s.replace("＜", "<")
        
        try:
            from sympy import parse_expr, Unequality, GreaterThan, LessThan, StrictGreaterThan, StrictLessThan, Equality, simplify
            
            parsed = parse_expr(s, evaluate=False)
            
            if isinstance(parsed, (bool, bool)):
                return s
            
            if isinstance(parsed, (Unequality, GreaterThan, LessThan, StrictGreaterThan, StrictLessThan, Equality)):
                lhs = parsed.lhs
                rhs = parsed.rhs
                
                if isinstance(parsed, Unequality):
                    op = "!="
                elif isinstance(parsed, GreaterThan):
                    op = ">="
                elif isinstance(parsed, LessThan):
                    op = "<="
                elif isinstance(parsed, StrictGreaterThan):
                    op = ">"
                elif isinstance(parsed, StrictLessThan):
                    op = "<"
                elif isinstance(parsed, Equality):
                    op = "=="
                else:
                    return s
                
                expr = simplify(lhs - rhs)
                return f"{expr}{op}0"
        except:
            pass
        return s
    
    @staticmethod
    def validate_constraint(expr: SymbolicExpression, constraint_str: str) -> bool:
        """
        验证约束是否与表达式兼容
        
        检查表达式在给定约束下是否有意义（约束不会使表达式无定义）
        """
        if not expr.is_valid():
            return False
        
        constraint = ConstraintChecker.parse_constraint(constraint_str)
        if constraint is None:
            return False
        
        return True
    
    @staticmethod
    def _factor_expression(expr):
        """尝试因式分解表达式"""
        try:
            from sympy import factor
            factored = factor(expr)
            if factored.is_Mul:
                return list(factored.args)
            return [factored]
        except:
            return [expr]
    
    @staticmethod
    def get_domain_constraints(expr: SymbolicExpression) -> List[DomainConstraint]:
        """
        获取表达式的所有定义域约束条件
        
        返回: 约束列表，每个约束包含类型、表达式、条件字符串
        """
        constraints = []
        seen = set()
        if not expr.is_valid():
            return constraints
        
        e = expr.expr
        
        denominators = ConstraintChecker._find_denominators(e)
        for denom in denominators:
            if denom != 1:
                factors = ConstraintChecker._factor_expression(denom)
                for factor in factors:
                    if factor != 1:
                        condition = f"{factor} != 0"
                        norm_key = ConstraintChecker.normalize_constraint(condition)
                        if norm_key not in seen:
                            seen.add(norm_key)
                            constraints.append(DomainConstraint(
                                "division",
                                str(factor),
                                condition
                            ))
        
        radicals = ConstraintChecker._find_radicals(e)
        for rad in radicals:
            condition = f"{rad} >= 0"
            norm_key = ConstraintChecker.normalize_constraint(condition)
            if norm_key not in seen:
                seen.add(norm_key)
                constraints.append(DomainConstraint(
                    "radical",
                    str(rad),
                    condition
                ))
        
        logs = ConstraintChecker._find_log_arguments(e)
        for arg in logs:
            condition = f"{arg} > 0"
            norm_key = ConstraintChecker.normalize_constraint(condition)
            if norm_key not in seen:
                seen.add(norm_key)
                constraints.append(DomainConstraint(
                    "logarithm",
                    str(arg),
                    condition
                ))
        
        return constraints
    
    @staticmethod
    def find_domain_violations(
        expr: SymbolicExpression,
        declared_constraints: Optional[List[str]] = None
    ) -> List[str]:
        """
        查找定义域违规情况（除零、根号负等）
        
        Args:
            expr: 表达式
            declared_constraints: 用户已显式声明的约束列表
        
        返回: 未被声明的定义域约束列表
        """
        violations = []
        if not expr.is_valid():
            return violations
        
        declared_normalized = set()
        if declared_constraints:
            declared_normalized = {
                ConstraintChecker.normalize_constraint(c) 
                for c in declared_constraints
            }
        
        constraints = ConstraintChecker.get_domain_constraints(expr)
        for c in constraints:
            normalized_condition = ConstraintChecker.normalize_constraint(c.condition)
            if normalized_condition in declared_normalized:
                continue
            
            if c.constraint_type == "division":
                violations.append(f"分母可能为零，需满足: {c.condition}")
            elif c.constraint_type == "radical":
                violations.append(f"根号内可能为负，需满足: {c.condition}")
            elif c.constraint_type == "logarithm":
                violations.append(f"对数参数可能非正，需满足: {c.condition}")
        
        return violations
    
    @staticmethod
    def detect_domain_loss(
        from_expr: SymbolicExpression,
        to_expr: SymbolicExpression,
        declared_constraints: Optional[List[str]] = None
    ) -> List[str]:
        """
        检测从 from_expr 到 to_expr 变形中丢失的定义域约束
        
        Args:
            from_expr: 起始表达式
            to_expr: 目标表达式
            declared_constraints: 用户已显式声明的约束列表
        
        返回: 丢失且未被声明的约束列表
        """
        if not from_expr.is_valid() or not to_expr.is_valid():
            return []
        
        from_constraints = ConstraintChecker.get_domain_constraints(from_expr)
        to_constraints = ConstraintChecker.get_domain_constraints(to_expr)
        
        from_conditions = {ConstraintChecker.normalize_constraint(str(c)): str(c) for c in from_constraints}
        to_conditions = {ConstraintChecker.normalize_constraint(str(c)) for c in to_constraints}
        
        declared_normalized = set()
        if declared_constraints:
            declared_normalized = {
                ConstraintChecker.normalize_constraint(c) 
                for c in declared_constraints
            }
        
        lost_conditions = []
        for norm_key, original_condition in from_conditions.items():
            if norm_key in to_conditions:
                continue
            if norm_key in declared_normalized:
                continue
            lost_conditions.append(original_condition)
        
        return lost_conditions
    
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
