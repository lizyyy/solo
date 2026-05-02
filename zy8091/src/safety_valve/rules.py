from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict
from .parser import ValveRecord, TestCurve, RuleConfig, TestCurvePoint


@dataclass
class CalculatedResult:
    valve_id: str
    test_time: str
    test_type: str
    actual_set_pressure: Optional[float]
    opening_pressure: Optional[float]
    closing_pressure: Optional[float]
    set_pressure_deviation: Optional[float]
    opening_closing_diff: Optional[float]
    lead_seal_ok: bool
    has_enough_points: bool
    errors: List[str]
    violations: List[str] = None
    
    def __post_init__(self):
        if self.violations is None:
            self.violations = []


def find_set_pressure(points: List[TestCurvePoint]) -> Optional[float]:
    if len(points) < 3:
        return None
    
    for i in range(1, len(points) - 1):
        prev_lift = points[i-1].lift
        curr_lift = points[i].lift
        next_lift = points[i+1].lift
        
        if prev_lift < 0.01 and curr_lift >= 0.01 and next_lift > curr_lift:
            return points[i].pressure
    return None


def find_opening_pressure(points: List[TestCurvePoint]) -> Optional[float]:
    for i in range(len(points)):
        if points[i].lift >= 0.03:
            return points[i].pressure
    return None


def find_closing_pressure(points: List[TestCurvePoint]) -> Optional[float]:
    for i in range(len(points)-1, 0, -1):
        if points[i].lift < 0.01 and points[i-1].lift >= 0.01:
            return points[i].pressure
    for i in range(len(points)-1, -1, -1):
        if points[i].lift < 0.01:
            return points[i].pressure
    return None


def calculate_curve(curve: TestCurve, valve: ValveRecord, rules: RuleConfig) -> CalculatedResult:
    errors = []
    has_enough_points = len(curve.points) >= rules.min_sample_points
    
    if not has_enough_points:
        errors.append(f"采样点不足: {len(curve.points)} < {rules.min_sample_points}")
    
    actual_set_pressure = find_set_pressure(curve.points)
    opening_pressure = find_opening_pressure(curve.points)
    closing_pressure = find_closing_pressure(curve.points)
    
    if actual_set_pressure is None:
        errors.append("无法确定整定压力")
        set_pressure_deviation = None
    else:
        set_pressure_deviation = ((actual_set_pressure - valve.set_pressure) / valve.set_pressure) * 100
    
    if opening_pressure is None or closing_pressure is None:
        opening_closing_diff = None
        if opening_pressure is None:
            errors.append("无法确定开启压力")
        if closing_pressure is None:
            errors.append("无法确定回座压力")
    else:
        opening_closing_diff = opening_pressure - closing_pressure
    
    lead_seal_ok = not rules.lead_seal_required
    
    return CalculatedResult(
        valve_id=curve.valve_id,
        test_time=curve.test_time,
        test_type=curve.test_type,
        actual_set_pressure=actual_set_pressure,
        opening_pressure=opening_pressure,
        closing_pressure=closing_pressure,
        set_pressure_deviation=set_pressure_deviation,
        opening_closing_diff=opening_closing_diff,
        lead_seal_ok=lead_seal_ok,
        has_enough_points=has_enough_points,
        errors=errors
    )


def evaluate_result(result: CalculatedResult, rules: RuleConfig, valve: ValveRecord) -> Tuple[bool, List[str]]:
    violations = []
    
    if not result.has_enough_points:
        violations.append("采样点不足")
    
    if result.set_pressure_deviation is not None:
        abs_deviation = abs(result.set_pressure_deviation)
        if abs_deviation > rules.set_pressure_tolerance:
            violations.append(f"整定压力偏差超限: {result.set_pressure_deviation:.2f}% > {rules.set_pressure_tolerance}%")
    
    if result.opening_closing_diff is not None:
        if result.opening_closing_diff > rules.opening_closing_diff_max:
            violations.append(f"启闭压差超限: {result.opening_closing_diff:.3f} MPa > {rules.opening_closing_diff_max} MPa")
    
    if rules.lead_seal_required and not result.lead_seal_ok:
        violations.append("未铅封")
    
    return (len(violations) == 0, violations)


def process_valve_results(valve_id: str, 
                          curves: List[TestCurve], 
                          valve: ValveRecord, 
                          rules: RuleConfig) -> List[CalculatedResult]:
    results = []
    for curve in curves:
        result = calculate_curve(curve, valve, rules)
        results.append(result)
    return results