import pytest
from safety_valve.rules import (
    find_set_pressure, find_opening_pressure, find_closing_pressure,
    calculate_curve, evaluate_result,
    TestCurvePoint, TestCurve, ValveRecord, RuleConfig
)


def test_find_set_pressure():
    points = [
        TestCurvePoint(0.0, 0.0, 0.0),
        TestCurvePoint(1.0, 0.5, 0.0),
        TestCurvePoint(2.0, 1.0, 0.0),
        TestCurvePoint(3.0, 1.2, 0.05),
        TestCurvePoint(4.0, 1.3, 0.2)
    ]
    result = find_set_pressure(points)
    assert result == 1.2


def test_find_opening_pressure():
    points = [
        TestCurvePoint(0.0, 0.0, 0.0),
        TestCurvePoint(1.0, 0.5, 0.0),
        TestCurvePoint(2.0, 1.0, 0.02),
        TestCurvePoint(3.0, 1.2, 0.05),
        TestCurvePoint(4.0, 1.3, 0.3)
    ]
    result = find_opening_pressure(points)
    assert result == 1.2


def test_find_closing_pressure():
    points = [
        TestCurvePoint(0.0, 1.5, 1.0),
        TestCurvePoint(1.0, 1.2, 0.5),
        TestCurvePoint(2.0, 1.0, 0.1),
        TestCurvePoint(3.0, 0.9, 0.02),
        TestCurvePoint(4.0, 0.85, 0.005),
        TestCurvePoint(5.0, 0.8, 0.0)
    ]
    result = find_closing_pressure(points)
    assert result == 0.85


def test_calculate_curve_normal():
    points = [
        TestCurvePoint(0.0, 0.0, 0.0),
        TestCurvePoint(1.0, 0.3, 0.0),
        TestCurvePoint(2.0, 0.6, 0.0),
        TestCurvePoint(3.0, 0.9, 0.0),
        TestCurvePoint(4.0, 1.15, 0.0),
        TestCurvePoint(5.0, 1.22, 0.05),
        TestCurvePoint(6.0, 1.25, 0.12),
        TestCurvePoint(7.0, 1.28, 0.25)
    ]
    curve = TestCurve('SV-001', '2024-01-15', '升压', points, '张三', 'TEST-001')
    valve = ValveRecord('SV-001', 'A48Y-16C', 100, 1.6, 1.2, '上海阀门厂', '一号锅炉')
    rules = RuleConfig(5.0, 0.3, 8, False)
    
    result = calculate_curve(curve, valve, rules)
    
    assert result.actual_set_pressure == 1.22
    assert abs(result.set_pressure_deviation - 1.67) < 0.01
    assert result.has_enough_points is True


def test_calculate_curve_insufficient_points():
    points = [
        TestCurvePoint(0.0, 0.0, 0.0),
        TestCurvePoint(1.0, 0.5, 0.0),
        TestCurvePoint(2.0, 1.0, 0.0)
    ]
    curve = TestCurve('SV-001', '2024-01-15', '升压', points, '张三', 'TEST-001')
    valve = ValveRecord('SV-001', 'A48Y-16C', 100, 1.6, 1.2, '上海阀门厂', '一号锅炉')
    rules = RuleConfig(5.0, 0.3, 8, False)
    
    result = calculate_curve(curve, valve, rules)
    
    assert result.has_enough_points is False
    assert any('采样点不足' in e for e in result.errors)


def test_evaluate_result_passed():
    from safety_valve.rules import CalculatedResult
    result = CalculatedResult(
        valve_id='SV-001',
        test_time='2024-01-15',
        test_type='升压',
        actual_set_pressure=1.22,
        opening_pressure=1.25,
        closing_pressure=1.0,
        set_pressure_deviation=1.67,
        opening_closing_diff=0.25,
        lead_seal_ok=True,
        has_enough_points=True,
        errors=[]
    )
    rules = RuleConfig(5.0, 0.3, 8, False)
    valve = ValveRecord('SV-001', 'A48Y-16C', 100, 1.6, 1.2, '上海阀门厂', '一号锅炉')
    
    passed, violations = evaluate_result(result, rules, valve)
    
    assert passed is True
    assert len(violations) == 0


def test_evaluate_result_failed_deviation():
    from safety_valve.rules import CalculatedResult
    result = CalculatedResult(
        valve_id='SV-001',
        test_time='2024-01-15',
        test_type='升压',
        actual_set_pressure=1.35,
        opening_pressure=1.35,
        closing_pressure=1.1,
        set_pressure_deviation=12.5,
        opening_closing_diff=0.25,
        lead_seal_ok=True,
        has_enough_points=True,
        errors=[]
    )
    rules = RuleConfig(5.0, 0.3, 8, False)
    valve = ValveRecord('SV-001', 'A48Y-16C', 100, 1.6, 1.2, '上海阀门厂', '一号锅炉')
    
    passed, violations = evaluate_result(result, rules, valve)
    
    assert passed is False
    assert '整定压力偏差超限' in violations[0]