#!/usr/bin/env python3
import sys
from pathlib import Path
from datetime import datetime, timedelta

project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from core import (
    CSVParser, JSONLParser, YAMLParser, RulesEngine, Storage, Exporter,
    CaseData, WeightUnit
)


def test_weight_unit_conversion():
    print("测试1: 体重单位转换...")
    
    weight_kg = 25.0
    unit_kg = WeightUnit.KG
    assert WeightUnit.convert_to_kg(weight_kg, unit_kg) == 25.0
    
    weight_lb = 66.0
    unit_lb = WeightUnit.LB
    kg_value = WeightUnit.convert_to_kg(weight_lb, unit_lb)
    assert abs(kg_value - 29.937) < 0.01, f"Expected ~29.94, got {kg_value}"
    
    print(f"  ✓ 66 lb = {kg_value:.2f} kg (正确)")
    return True


def test_cross_midnight_time_parsing():
    print("\n测试2: 跨午夜时间解析...")
    
    base_date = datetime(2026, 5, 2, 23, 30, 0).date()
    
    time1 = JSONLParser.parse_datetime("23:30:00", base_date)
    assert time1.hour == 23 and time1.minute == 30
    print(f"  ✓ 23:30:00 解析为: {time1}")
    
    time2 = JSONLParser.parse_datetime("00:00:00", base_date)
    assert time2.hour == 0 and time2.minute == 0
    print(f"  ✓ 00:00:00 解析为: {time2}")
    
    time3 = JSONLParser.parse_datetime("02:45:00", base_date)
    assert time3.hour == 2 and time3.minute == 45
    print(f"  ✓ 02:45:00 解析为: {time3}")
    
    print(f"  ✓ 基础时间解析正确")
    
    jsonl_path = project_root / "samples" / "CASE003_vitals.jsonl"
    vitals = JSONLParser.parse_vitals(str(jsonl_path))
    
    vitals_before = [v for v in vitals if v.timestamp.hour >= 22]
    vitals_after = [v for v in vitals if v.timestamp.hour < 6]
    
    if vitals_before and vitals_after:
        last_before = max(vitals_before, key=lambda x: x.timestamp)
        first_after = min(vitals_after, key=lambda x: x.timestamp)
        assert last_before.timestamp < first_after.timestamp
        print(f"  ✓ JSONL解析器正确处理跨午夜: {last_before.timestamp.time()} < {first_after.timestamp.time()}")
    
    return True


def test_csv_parser():
    print("\n测试3: CSV病例解析...")
    
    csv_path = project_root / "samples" / "cases.csv"
    cases = CSVParser.parse_cases(str(csv_path))
    
    assert len(cases) == 4, f"Expected 4 cases, got {len(cases)}"
    print(f"  ✓ 解析到 {len(cases)} 个病例")
    
    case3 = None
    for c in cases:
        if c.case_id == "CASE003":
            case3 = c
            break
    
    assert case3 is not None
    assert case3.weight_unit == WeightUnit.LB
    assert abs(case3.weight_kg - 29.937) < 0.01
    print(f"  ✓ CASE003 (大黄) 体重: {case3.weight} lb = {case3.weight_kg:.2f} kg")
    
    assert case3.start_time.hour == 23 and case3.start_time.minute == 30
    assert case3.end_time is not None
    assert case3.end_time > case3.start_time
    print(f"  ✓ CASE003 时间: {case3.start_time} - {case3.end_time} (跨午夜)")
    
    case4 = [c for c in cases if c.case_id == "CASE004"][0]
    assert case4.weight_unit == WeightUnit.KG
    assert case4.weight_kg == 3.8
    print(f"  ✓ CASE004 (花花) 体重: {case4.weight} kg")
    
    return True


def test_jsonl_parser():
    print("\n测试4: JSONL生命体征解析...")
    
    jsonl_path = project_root / "samples" / "CASE003_vitals.jsonl"
    vitals = JSONLParser.parse_vitals(str(jsonl_path))
    
    assert len(vitals) > 0
    print(f"  ✓ 解析到 {len(vitals)} 条生命体征记录")
    
    has_before_midnight = any(v.timestamp.hour >= 22 for v in vitals)
    has_after_midnight = any(v.timestamp.hour < 6 for v in vitals)
    
    assert has_before_midnight, "应该有22点后的数据"
    assert has_after_midnight, "应该有6点前的数据"
    print(f"  ✓ 包含跨午夜数据 (23:xx 和 00:xx-02:xx)")
    
    for i in range(1, len(vitals)):
        assert vitals[i].timestamp >= vitals[i-1].timestamp, f"时间顺序错误: {vitals[i].timestamp} < {vitals[i-1].timestamp}"
    print(f"  ✓ 时间顺序正确")
    
    return True


def test_yaml_parser():
    print("\n测试5: YAML药物规则解析...")
    
    yaml_path = project_root / "samples" / "drug_rules.yaml"
    rules = YAMLParser.parse_drug_rules(str(yaml_path))
    
    assert len(rules) > 0
    print(f"  ✓ 解析到 {len(rules)} 条药物规则")
    
    propofol_rules = [r for r in rules if r.drug_name.lower() == 'propofol']
    assert len(propofol_rules) > 0
    rule = propofol_rules[0]
    print(f"  ✓ 丙泊酚规则: {rule.min_dose_per_kg}-{rule.max_dose_per_kg} {rule.dose_unit}/kg")
    
    return True


def test_rules_engine():
    print("\n测试6: 规则引擎风险检测...")
    
    csv_path = project_root / "samples" / "cases.csv"
    cases = CSVParser.parse_cases(str(csv_path))
    
    yaml_path = project_root / "samples" / "drug_rules.yaml"
    rules = YAMLParser.parse_drug_rules(str(yaml_path))
    
    engine = RulesEngine()
    
    case = [c for c in cases if c.case_id == "CASE001"][0]
    case_data = CaseData(case=case)
    
    jsonl_path = project_root / "samples" / "CASE001_vitals.jsonl"
    case_data.vital_signs = JSONLParser.parse_vitals(str(jsonl_path), case.start_time)
    
    drugs_path = project_root / "samples" / "CASE001_drugs.yaml"
    case_data.drug_administrations = YAMLParser.parse_drug_administrations(
        str(drugs_path), case.start_time.date()
    )
    
    risks = engine.analyze_case(case_data, rules)
    
    print(f"  ✓ 检测到 {len(risks)} 个风险事件")
    
    hypotension_risks = [r for r in risks if 'hypotension' in r.risk_type.value]
    hypothermia_risks = [r for r in risks if 'hypothermia' in r.risk_type.value]
    
    print(f"    - 低血压: {len(hypotension_risks)} 个")
    print(f"    - 低体温: {len(hypothermia_risks)} 个")
    
    return True


def test_monitoring_gap_detection():
    print("\n测试7: 监护断采检测...")
    
    csv_path = project_root / "samples" / "cases.csv"
    cases = CSVParser.parse_cases(str(csv_path))
    
    yaml_path = project_root / "samples" / "drug_rules.yaml"
    rules = YAMLParser.parse_drug_rules(str(yaml_path))
    
    engine = RulesEngine()
    
    case = [c for c in cases if c.case_id == "CASE004"][0]
    case_data = CaseData(case=case)
    
    jsonl_path = project_root / "samples" / "CASE004_vitals.jsonl"
    case_data.vital_signs = JSONLParser.parse_vitals(str(jsonl_path), case.start_time)
    
    drugs_path = project_root / "samples" / "CASE004_drugs.yaml"
    case_data.drug_administrations = YAMLParser.parse_drug_administrations(
        str(drugs_path), case.start_time.date()
    )
    
    risks = engine.analyze_case(case_data, rules)
    
    gap_risks = [r for r in risks if 'monitoring_gap' in r.risk_type.value]
    
    print(f"  ✓ 检测到 {len(gap_risks)} 个监护断采事件")
    
    for gap in gap_risks:
        if gap.end_time:
            duration = (gap.end_time - gap.start_time).total_seconds() / 60
            print(f"    - 断采时长: {duration:.1f} 分钟")
    
    return True


def test_storage():
    print("\n测试8: 持久化存储...")
    
    import tempfile
    import os
    
    temp_dir = tempfile.mkdtemp()
    temp_db = os.path.join(temp_dir, "test.db")
    
    try:
        storage = Storage(db_path=temp_db)
        
        csv_path = project_root / "samples" / "cases.csv"
        cases = CSVParser.parse_cases(str(csv_path))
        
        case = cases[0]
        case_data = CaseData(case=case)
        
        assert storage.save_case(case_data)
        print(f"  ✓ 保存病例成功")
        
        loaded = storage.load_case(case.case_id)
        assert loaded is not None
        assert loaded.case.case_id == case.case_id
        print(f"  ✓ 加载病例成功")
        
        cases_list = storage.list_cases()
        assert len(cases_list) >= 1
        print(f"  ✓ 列出病例成功")
        
        return True
    finally:
        try:
            os.remove(temp_db)
            os.rmdir(temp_dir)
        except Exception:
            pass


def test_exporter():
    print("\n测试9: 导出功能...")
    
    csv_path = project_root / "samples" / "cases.csv"
    cases = CSVParser.parse_cases(str(csv_path))
    
    yaml_path = project_root / "samples" / "drug_rules.yaml"
    rules = YAMLParser.parse_drug_rules(str(yaml_path))
    
    engine = RulesEngine()
    
    case = [c for c in cases if c.case_id == "CASE001"][0]
    case_data = CaseData(case=case)
    
    jsonl_path = project_root / "samples" / "CASE001_vitals.jsonl"
    case_data.vital_signs = JSONLParser.parse_vitals(str(jsonl_path), case.start_time)
    
    drugs_path = project_root / "samples" / "CASE001_drugs.yaml"
    case_data.drug_administrations = YAMLParser.parse_drug_administrations(
        str(drugs_path), case.start_time.date()
    )
    
    notes_path = project_root / "samples" / "CASE001_notes.txt"
    if notes_path.exists():
        case_data.post_op_notes = notes_path.read_text(encoding='utf-8')
    
    engine.analyze_case(case_data, rules)
    
    test_csv = project_root / "test_output" / "test_issues.csv"
    test_csv.parent.mkdir(exist_ok=True)
    
    assert Exporter.export_issues_csv(case_data, str(test_csv))
    print(f"  ✓ 导出 issues.csv 成功")
    
    test_md = project_root / "test_output" / "test_report.md"
    assert Exporter.export_anesthesia_report(case_data, str(test_md))
    print(f"  ✓ 导出 anesthesia_report.md 成功")
    
    import shutil
    shutil.rmtree(test_csv.parent, ignore_errors=True)
    
    return True


def main():
    print("=" * 50)
    print("麻醉病例复盘工具 - 核心功能测试")
    print("=" * 50)
    
    tests = [
        test_weight_unit_conversion,
        test_cross_midnight_time_parsing,
        test_csv_parser,
        test_jsonl_parser,
        test_yaml_parser,
        test_rules_engine,
        test_monitoring_gap_detection,
        test_storage,
        test_exporter,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"\n  ✗ 测试失败: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
    
    print("\n" + "=" * 50)
    print(f"测试完成: {passed} 通过, {failed} 失败")
    print("=" * 50)
    
    return failed == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
