import csv
from dataclasses import dataclass
from typing import List, Dict
from jinja2 import Environment, PackageLoader
from .parser import ValveRecord, TestCurve, RuleConfig
from .rules import CalculatedResult


@dataclass
class ReportSummary:
    total_valves: int
    total_tests: int
    passed_tests: int
    failed_tests: int
    abnormal_valves: List[str]


def generate_abnormal_csv(results: Dict[str, List[CalculatedResult]], 
                          valve_index: Dict[str, ValveRecord],
                          output_path: str):
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            '阀门编号', '型号', '公称直径', '公称压力', '整定压力', 
            '测试时间', '测试类型', '实际整定压力', '整定压力偏差(%)', 
            '开启压力', '回座压力', '启闭压差', '异常原因'
        ])
        
        for valve_id, result_list in results.items():
            valve = valve_index.get(valve_id)
            
            for result in result_list:
                if not result.violations:
                    continue
                
                writer.writerow([
                    result.valve_id,
                    valve.model if valve else '',
                    valve.nominal_diameter if valve else '',
                    valve.nominal_pressure if valve else '',
                    valve.set_pressure if valve else '',
                    result.test_time,
                    result.test_type,
                    f"{result.actual_set_pressure:.3f}" if result.actual_set_pressure else '',
                    f"{result.set_pressure_deviation:.2f}" if result.set_pressure_deviation else '',
                    f"{result.opening_pressure:.3f}" if result.opening_pressure else '',
                    f"{result.closing_pressure:.3f}" if result.closing_pressure else '',
                    f"{result.opening_closing_diff:.3f}" if result.opening_closing_diff else '',
                    '; '.join(result.violations)
                ])


def generate_markdown_report(results: Dict[str, List[CalculatedResult]],
                             valve_index: Dict[str, ValveRecord],
                             rules: RuleConfig,
                             output_path: str):
    env = Environment(loader=PackageLoader('safety_valve', 'templates'))
    template = env.get_template('report.md.j2')
    
    abnormal_valve_ids = set()
    failed_tests = 0
    for valve_id, result_list in results.items():
        for result in result_list:
            if result.violations:
                abnormal_valve_ids.add(valve_id)
                failed_tests += 1
    
    summary = ReportSummary(
        total_valves=len(results),
        total_tests=sum(len(r) for r in results.values()),
        passed_tests=sum(len(r) for r in results.values()) - failed_tests,
        failed_tests=failed_tests,
        abnormal_valves=list(abnormal_valve_ids)
    )
    
    report_data = []
    for valve_id, result_list in results.items():
        valve = valve_index.get(valve_id)
        has_violations = any(r.violations for r in result_list)
        
        report_data.append({
            'valve': valve,
            'results': result_list,
            'has_violations': has_violations
        })
    
    rendered = template.render(
        summary=summary,
        rules=rules,
        report_data=report_data,
        valve_index=valve_index
    )
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(rendered)


def generate_html_report(curves: Dict[str, List[TestCurve]],
                         valve_index: Dict[str, ValveRecord],
                         output_path: str):
    env = Environment(loader=PackageLoader('safety_valve', 'templates'))
    template = env.get_template('curves.html.j2')
    
    valve_data = []
    for valve_id, curve_list in curves.items():
        valve = valve_index.get(valve_id)
        curve_datas = []
        
        for curve in curve_list:
            pressures = [p.pressure for p in curve.points]
            lifts = [p.lift for p in curve.points]
            timestamps = [p.timestamp for p in curve.points]
            
            curve_datas.append({
                'test_time': curve.test_time,
                'test_type': curve.test_type,
                'operator': curve.operator,
                'equipment_id': curve.equipment_id,
                'pressures': pressures,
                'lifts': lifts,
                'timestamps': timestamps,
                'point_count': len(curve.points)
            })
        
        valve_data.append({
            'valve': valve,
            'curves': curve_datas
        })
    
    rendered = template.render(valve_data=valve_data)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(rendered)