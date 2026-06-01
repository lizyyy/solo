from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import math

from .config import Config, BoundaryRule


@dataclass
class CalculationStep:
    formula_name: str
    formula_source: str
    formula_expression: str
    input_values: Dict[str, Tuple[float, str]]
    result: float
    result_unit: str
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class BoundaryViolation:
    variable: str
    value: float
    unit: str
    rule: BoundaryRule
    violation_type: str  
    message: str


@dataclass
class ConflictNote:
    item: str
    lecture_says: str
    data_says: str
    suggestion: str


@dataclass
class CalculationResult:
    success: bool = False
    base_price: Optional[float] = None
    dynamic_multiplier: Optional[float] = None
    final_price: Optional[float] = None
    tier: Optional[str] = None
    tier_color: Optional[str] = None
    steps: List[CalculationStep] = field(default_factory=list)
    warnings: List[BoundaryViolation] = field(default_factory=list)
    errors: List[BoundaryViolation] = field(default_factory=list)
    conflicts: List[ConflictNote] = field(default_factory=list)
    error_message: Optional[str] = None
    processed_at: datetime = field(default_factory=datetime.now)


class TicketPricingCalculator:
    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config()
    
    def _safe_eval(self, expression: str, variables: Dict[str, float]) -> float:
        allowed_names = {
            'abs': abs,
            'max': max,
            'min': min,
            'sqrt': math.sqrt,
            'pow': pow,
            'log': math.log,
            'exp': math.exp,
        }
        return eval(expression, {"__builtins__": {}}, {**allowed_names, **variables})
    
    def _check_boundaries(self, var_name: str, value: float, unit: str) -> List[BoundaryViolation]:
        violations = []
        for rule in self.config.boundaries:
            if rule.variable == var_name:
                if rule.min_value is not None and value < rule.min_value:
                    violations.append(BoundaryViolation(
                        variable=var_name,
                        value=value,
                        unit=unit,
                        rule=rule,
                        violation_type="below_min",
                        message=f"{var_name}={value}{unit} 低于最小值 {rule.min_value}{rule.unit}"
                    ))
                if rule.max_value is not None and value > rule.max_value:
                    violations.append(BoundaryViolation(
                        variable=var_name,
                        value=value,
                        unit=unit,
                        rule=rule,
                        violation_type="above_max",
                        message=f"{var_name}={value}{unit} 高于最大值 {rule.max_value}{rule.unit}"
                    ))
        return violations
    
    def _check_conflicts(self, inputs: Dict[str, Tuple[float, str]]) -> List[ConflictNote]:
        conflicts = []
        
        profit_margin = inputs.get("profit_margin")
        if profit_margin:
            pm_value = profit_margin[0]
            if pm_value < 0.15 or pm_value > 0.5:
                conflicts.append(ConflictNote(
                    item="profit_margin",
                    lecture_says=self.config.lecture_notes["profit_margin_range"],
                    data_says=f"输入数据利润率为 {pm_value*100:.1f}%",
                    suggestion="建议确认利润率是否合理，超出讲义建议范围"
                ))
        
        return conflicts
    
    def calculate(self, 
                  production_cost: float, 
                  expected_attendance: float,
                  profit_margin: float,
                  days_to_show: int,
                  ticket_sold_rate: float,
                  production_cost_unit: str = "CNY",
                  attendance_unit: str = "person",
                  weekend_factor: int = 0,
                  source: str = "manual_input") -> CalculationResult:
        
        result = CalculationResult()
        
        try:
            pc_base = self.config.convert_unit(production_cost, production_cost_unit, "CNY")
            ea_base = self.config.convert_unit(expected_attendance, attendance_unit, "person")
            
            all_inputs = {
                "production_cost": (pc_base, "CNY"),
                "expected_attendance": (ea_base, "person"),
                "profit_margin": (profit_margin, "ratio"),
                "days_to_show": (float(days_to_show), "day"),
                "ticket_sold_rate": (ticket_sold_rate, "ratio"),
                "weekend_factor": (float(weekend_factor), "binary"),
            }
            
            for var_name, (value, unit) in all_inputs.items():
                violations = self._check_boundaries(var_name, value, unit)
                for v in violations:
                    if v.rule.severity == "error":
                        result.errors.append(v)
                    else:
                        result.warnings.append(v)
            
            result.conflicts = self._check_conflicts(all_inputs)
            
            if result.errors:
                result.success = False
                error_msgs = [e.message for e in result.errors]
                result.error_message = "边界校验失败: " + "; ".join(error_msgs)
                return result
            
            formula = self.config.formulas["base_price"]
            base_price = self._safe_eval(
                formula.expression,
                {
                    "production_cost": pc_base,
                    "expected_attendance": ea_base,
                    "profit_margin": profit_margin
                }
            )
            result.steps.append(CalculationStep(
                formula_name=formula.name,
                formula_source=formula.source,
                formula_expression=formula.expression,
                input_values={
                    "production_cost": (pc_base, "CNY"),
                    "expected_attendance": (ea_base, "person"),
                    "profit_margin": (profit_margin, "ratio")
                },
                result=base_price,
                result_unit="CNY"
            ))
            
            bp_violations = self._check_boundaries("base_price", base_price, "CNY")
            for v in bp_violations:
                if v.rule.severity == "error":
                    result.errors.append(v)
                else:
                    result.warnings.append(v)
            
            formula = self.config.formulas["dynamic_multiplier"]
            dynamic_multiplier = self._safe_eval(
                formula.expression,
                {
                    "days_to_show": days_to_show,
                    "ticket_sold_rate": ticket_sold_rate,
                    "weekend_factor": weekend_factor
                }
            )
            result.steps.append(CalculationStep(
                formula_name=formula.name,
                formula_source=formula.source,
                formula_expression=formula.expression,
                input_values={
                    "days_to_show": (float(days_to_show), "day"),
                    "ticket_sold_rate": (ticket_sold_rate, "ratio"),
                    "weekend_factor": (float(weekend_factor), "binary")
                },
                result=dynamic_multiplier,
                result_unit="x"
            ))
            
            formula = self.config.formulas["final_price"]
            final_price = self._safe_eval(
                formula.expression,
                {
                    "base_price": base_price,
                    "dynamic_multiplier": dynamic_multiplier
                }
            )
            result.steps.append(CalculationStep(
                formula_name=formula.name,
                formula_source=formula.source,
                formula_expression=formula.expression,
                input_values={
                    "base_price": (base_price, "CNY"),
                    "dynamic_multiplier": (dynamic_multiplier, "x")
                },
                result=final_price,
                result_unit="CNY"
            ))
            
            fp_violations = self._check_boundaries("final_price", final_price, "CNY")
            for v in fp_violations:
                if v.rule.severity == "error":
                    result.errors.append(v)
                else:
                    result.warnings.append(v)
            
            if result.errors:
                result.success = False
                error_msgs = [e.message for e in result.errors]
                result.error_message = "计算结果超出边界: " + "; ".join(error_msgs)
                return result
            
            tier_info = self.config.get_tier(final_price)
            
            result.success = True
            result.base_price = round(base_price, 2)
            result.dynamic_multiplier = round(dynamic_multiplier, 4)
            result.final_price = round(final_price, 2)
            result.tier = tier_info.tier
            result.tier_color = tier_info.color
            
            return result
            
        except Exception as e:
            result.success = False
            result.error_message = f"计算异常: {str(e)}"
            return result
    
    def explain_result(self, calc_result: CalculationResult) -> Dict[str, Any]:
        explanation = {
            "summary": "",
            "formula_details": [],
            "boundary_checks": [],
            "conflicts": [],
            "tier_explanation": ""
        }
        
        if calc_result.success:
            explanation["summary"] = (
                f"计算成功！最终票价为 ¥{calc_result.final_price}，"
                f"属于【{calc_result.tier}】。"
                f"基础票价 ¥{calc_result.base_price}，动态倍率 {calc_result.dynamic_multiplier}x"
            )
            
            tier_info = self.config.get_tier(calc_result.final_price)
            if tier_info.max_price == float('inf'):
                explanation["tier_explanation"] = (
                    f"【{tier_info.tier}】: 票价 ¥{calc_result.final_price} >= ¥{tier_info.min_price}"
                )
            else:
                explanation["tier_explanation"] = (
                    f"【{tier_info.tier}】: ¥{tier_info.min_price} <= 票价 ¥{calc_result.final_price} < ¥{tier_info.max_price}"
                )
        else:
            explanation["summary"] = f"计算失败: {calc_result.error_message}"
        
        for step in calc_result.steps:
            inputs_str = ", ".join([f"{k}={v[0]:.2f}{v[1]}" for k, v in step.input_values.items()])
            explanation["formula_details"].append({
                "name": step.formula_name,
                "source": step.formula_source,
                "expression": step.formula_expression,
                "inputs": inputs_str,
                "result": f"{step.result:.4f} {step.result_unit}"
            })
        
        for w in calc_result.warnings:
            explanation["boundary_checks"].append({
                "level": "警告",
                "message": w.message
            })
        for e in calc_result.errors:
            explanation["boundary_checks"].append({
                "level": "错误",
                "message": e.message
            })
        
        for c in calc_result.conflicts:
            explanation["conflicts"].append({
                "item": c.item,
                "lecture_says": c.lecture_says,
                "data_says": c.data_says,
                "suggestion": c.suggestion
            })
        
        return explanation
