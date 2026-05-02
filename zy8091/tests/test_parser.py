import pytest
import tempfile
import os
from safety_valve.parser import (
    parse_valve_csv, parse_curve_jsonl, parse_rules_yaml,
    build_valve_index, group_curves_by_valve,
    ValveRecord, TestCurve, RuleConfig
)


def test_parse_valve_csv():
    csv_content = """阀门编号,型号,公称直径,公称压力,整定压力,制造单位,安装位置
SV-001,A48Y-16C,100,1.6,1.2,上海阀门厂,一号锅炉
SV-002,A48Y-16C,80,1.6,1.0,上海阀门厂,二号锅炉
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
        f.write(csv_content)
        f.flush()
        records = parse_valve_csv(f.name)
    
    assert len(records) == 2
    assert records[0].valve_id == 'SV-001'
    assert records[0].model == 'A48Y-16C'
    assert records[0].set_pressure == 1.2
    os.unlink(f.name)


def test_parse_curve_jsonl():
    jsonl_content = '{"valve_id": "SV-001", "test_time": "2024-01-15 09:30:00", "test_type": "升压", "operator": "张三", "equipment_id": "TEST-001", "points": [{"timestamp": 0.0, "pressure": 0.0, "lift": 0.0}, {"timestamp": 1.0, "pressure": 0.5, "lift": 0.05}]}\n'
    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False, encoding='utf-8') as f:
        f.write(jsonl_content)
        f.flush()
        curves = parse_curve_jsonl(f.name)
    
    assert len(curves) == 1
    assert curves[0].valve_id == 'SV-001'
    assert len(curves[0].points) == 2
    os.unlink(f.name)


def test_parse_rules_yaml():
    yaml_content = """set_pressure_tolerance: 5.0
opening_closing_diff_max: 0.3
min_sample_points: 8
lead_seal_required: true
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
        f.write(yaml_content)
        f.flush()
        rules = parse_rules_yaml(f.name)
    
    assert rules.set_pressure_tolerance == 5.0
    assert rules.min_sample_points == 8
    assert rules.lead_seal_required is True
    os.unlink(f.name)


def test_build_valve_index():
    records = [
        ValveRecord('SV-001', 'A48Y-16C', 100, 1.6, 1.2, '上海阀门厂', '一号锅炉'),
        ValveRecord('SV-002', 'A48Y-16C', 80, 1.6, 1.0, '上海阀门厂', '二号锅炉')
    ]
    index = build_valve_index(records)
    
    assert 'SV-001' in index
    assert 'SV-002' in index
    assert index['SV-001'].set_pressure == 1.2


def test_group_curves_by_valve():
    curves = [
        TestCurve('SV-001', '2024-01-15', '升压', [], '张三', 'TEST-001'),
        TestCurve('SV-001', '2024-01-15', '回座', [], '张三', 'TEST-001'),
        TestCurve('SV-002', '2024-01-15', '升压', [], '李四', 'TEST-002')
    ]
    grouped = group_curves_by_valve(curves)
    
    assert len(grouped) == 2
    assert len(grouped['SV-001']) == 2
    assert len(grouped['SV-002']) == 1