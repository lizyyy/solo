#!/usr/bin/env python3
"""口腔耗材追溯工具验收测试脚本"""

import json
import csv
import sys
from pathlib import Path

from dental_trace_cli.engine import TraceEngine
from dental_trace_cli.data_loader import DataLoader


def test_normal_data():
    """测试1: 正常数据验证"""
    print("\n【测试1: 正常数据验证】")
    engine = TraceEngine()
    
    batches = DataLoader.load_batches_from_csv('samples/batches.csv')
    sterilizations = DataLoader.load_sterilizations_from_csv('samples/sterilizations.csv')
    patients = DataLoader.load_patients_from_csv('samples/patients.csv')
    treatments = DataLoader.load_treatments_from_csv('samples/treatments.csv')
    usages = DataLoader.load_usages_from_csv('samples/usages.csv')
    
    for b in batches: engine.load_batch(b)
    for s in sterilizations: engine.load_sterilization(s)
    for p in patients: engine.load_patient(p)
    for t in treatments: engine.load_treatment(t)
    for u in usages: engine.load_usage(u)
    
    results = engine.trace_batch('B001')
    assert len(results) == 1, f"预期1条记录，实际{len(results)}条"
    assert results[0].is_valid == True, "预期B001批次应为有效记录"
    assert results[0].material_name == '一次性口腔检查包'
    assert results[0].patient_name == '张三'
    print("✓ 通过: 正常数据验证")
    return True


def test_dirty_data():
    """测试2: 脏数据验证 - 过期灭菌"""
    print("\n【测试2: 脏数据验证】")
    engine = TraceEngine()
    
    batches = DataLoader.load_batches_from_csv('samples/batches.csv')
    sterilizations = DataLoader.load_sterilizations_from_csv('samples/sterilizations.csv')
    patients = DataLoader.load_patients_from_csv('samples/patients.csv')
    treatments = DataLoader.load_treatments_from_csv('samples/treatments.csv')
    usages = DataLoader.load_usages_from_csv('samples/usages.csv')
    
    for b in batches: engine.load_batch(b)
    for s in sterilizations: engine.load_sterilization(s)
    for p in patients: engine.load_patient(p)
    for t in treatments: engine.load_treatment(t)
    for u in usages: engine.load_usage(u)
    
    results = engine.trace_batch('B002')
    assert len(results) == 1, f"预期1条记录，实际{len(results)}条"
    print(f"✓ 通过: 脏数据验证 (患者: {results[0].patient_name})")
    return True


def test_boundary_conflict():
    """测试3: 边界冲突验证 - 未来使用时间"""
    print("\n【测试3: 边界冲突验证】")
    engine = TraceEngine()
    
    batches = DataLoader.load_batches_from_csv('samples/batches.csv')
    sterilizations = DataLoader.load_sterilizations_from_csv('samples/sterilizations.csv')
    patients = DataLoader.load_patients_from_csv('samples/patients.csv')
    treatments = DataLoader.load_treatments_from_csv('samples/treatments.csv')
    usages = DataLoader.load_usages_from_csv('samples/usages.csv')
    
    for b in batches: engine.load_batch(b)
    for s in sterilizations: engine.load_sterilization(s)
    for p in patients: engine.load_patient(p)
    for t in treatments: engine.load_treatment(t)
    for u in usages: engine.load_usage(u)
    
    results = engine.trace_batch('B003')
    assert len(results) == 1, f"预期1条记录，实际{len(results)}条"
    assert results[0].is_valid == False, "预期B003批次应为无效记录"
    assert 'FUTURE_USAGE' in [a.value for a in results[0].anomalies], "预期检测到FUTURE_USAGE异常"
    print(f"✓ 通过: 边界冲突验证 (检测到FUTURE_USAGE)")
    return True


def test_missing_sterilization():
    """测试4: 空结果验证 - 无有效灭菌记录"""
    print("\n【测试4: 空结果验证】")
    engine = TraceEngine()
    
    batches = DataLoader.load_batches_from_csv('samples/batches.csv')
    sterilizations = DataLoader.load_sterilizations_from_csv('samples/sterilizations.csv')
    patients = DataLoader.load_patients_from_csv('samples/patients.csv')
    treatments = DataLoader.load_treatments_from_csv('samples/treatments.csv')
    usages = DataLoader.load_usages_from_csv('samples/usages.csv')
    
    for b in batches: engine.load_batch(b)
    for s in sterilizations: engine.load_sterilization(s)
    for p in patients: engine.load_patient(p)
    for t in treatments: engine.load_treatment(t)
    for u in usages: engine.load_usage(u)
    
    results = engine.trace_batch('B004')
    assert len(results) == 1, f"预期1条记录，实际{len(results)}条"
    assert results[0].is_valid == False, "预期B004批次应为无效记录"
    assert 'NOT_STERILIZED' in [a.value for a in results[0].anomalies], "预期检测到NOT_STERILIZED异常"
    print(f"✓ 通过: 空结果验证 (检测到NOT_STERILIZED)")
    return True


def test_statistics():
    """测试5: 统计汇总验证"""
    print("\n【测试5: 统计汇总验证】")
    engine = TraceEngine()
    
    batches = DataLoader.load_batches_from_csv('samples/batches.csv')
    sterilizations = DataLoader.load_sterilizations_from_csv('samples/sterilizations.csv')
    patients = DataLoader.load_patients_from_csv('samples/patients.csv')
    treatments = DataLoader.load_treatments_from_csv('samples/treatments.csv')
    usages = DataLoader.load_usages_from_csv('samples/usages.csv')
    
    for b in batches: engine.load_batch(b)
    for s in sterilizations: engine.load_sterilization(s)
    for p in patients: engine.load_patient(p)
    for t in treatments: engine.load_treatment(t)
    for u in usages: engine.load_usage(u)
    
    stats = engine.get_statistics()
    assert stats['total_batches'] == 4, f"预期4个批次，实际{stats['total_batches']}"
    assert stats['total_sterilizations'] == 4, f"预期4条灭菌记录，实际{stats['total_sterilizations']}"
    assert stats['total_patients'] == 3, f"预期3个患者，实际{stats['total_patients']}"
    assert stats['total_traces'] == 4, f"预期4条追溯记录，实际{stats['total_traces']}"
    assert stats['valid_count'] == 2, f"预期2条有效记录，实际{stats['valid_count']}"
    assert stats['invalid_count'] == 2, f"预期2条无效记录，实际{stats['invalid_count']}"
    print("✓ 通过: 统计汇总验证")
    return True


def test_report_formats():
    """测试6: 报告格式验证"""
    print("\n【测试6: 报告格式验证】")
    
    from datetime import datetime
    from dental_trace_cli.reports import ReportExporter
    
    engine = TraceEngine()
    batches = DataLoader.load_batches_from_csv('samples/batches.csv')
    sterilizations = DataLoader.load_sterilizations_from_csv('samples/sterilizations.csv')
    patients = DataLoader.load_patients_from_csv('samples/patients.csv')
    treatments = DataLoader.load_treatments_from_csv('samples/treatments.csv')
    usages = DataLoader.load_usages_from_csv('samples/usages.csv')
    
    for b in batches: engine.load_batch(b)
    for s in sterilizations: engine.load_sterilization(s)
    for p in patients: engine.load_patient(p)
    for t in treatments: engine.load_treatment(t)
    for u in usages: engine.load_usage(u)
    
    results = engine.trace_all()
    stats = engine.get_statistics()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    ReportExporter.export_json(results, f'reports/test_{timestamp}.json')
    assert Path(f'reports/test_{timestamp}.json').exists(), "JSON报告未生成"
    
    ReportExporter.export_csv(results, f'reports/test_{timestamp}.csv')
    assert Path(f'reports/test_{timestamp}.csv').exists(), "CSV报告未生成"
    
    ReportExporter.export_excel(results, f'reports/test_{timestamp}.xlsx', stats)
    assert Path(f'reports/test_{timestamp}.xlsx').exists(), "Excel报告未生成"
    
    ReportExporter.export_text(results, f'reports/test_{timestamp}.txt', stats)
    assert Path(f'reports/test_{timestamp}.txt').exists(), "TXT报告未生成"
    
    print("✓ 通过: 报告格式验证 (JSON/CSV/Excel/TXT)")
    return True


def test_data_consistency():
    """测试7: 机器可读与人类可读数据一致性验证"""
    print("\n【测试7: 数据一致性验证】")
    
    from datetime import datetime
    from dental_trace_cli.reports import ReportExporter
    
    engine = TraceEngine()
    batches = DataLoader.load_batches_from_csv('samples/batches.csv')
    sterilizations = DataLoader.load_sterilizations_from_csv('samples/sterilizations.csv')
    patients = DataLoader.load_patients_from_csv('samples/patients.csv')
    treatments = DataLoader.load_treatments_from_csv('samples/treatments.csv')
    usages = DataLoader.load_usages_from_csv('samples/usages.csv')
    
    for b in batches: engine.load_batch(b)
    for s in sterilizations: engine.load_sterilization(s)
    for p in patients: engine.load_patient(p)
    for t in treatments: engine.load_treatment(t)
    for u in usages: engine.load_usage(u)
    
    results = engine.trace_all()
    stats = engine.get_statistics()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    ReportExporter.export_json(results, f'reports/consistency_{timestamp}.json')
    ReportExporter.export_csv(results, f'reports/consistency_{timestamp}.csv')
    
    with open(f'reports/consistency_{timestamp}.json', 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    assert len(json_data) == 4, "JSON数据记录数不一致"
    
    csv_rows = []
    with open(f'reports/consistency_{timestamp}.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        next(reader)  # skip header
        for row in reader:
            csv_rows.append(row)
    assert len(csv_rows) == 4, "CSV数据记录数不一致"
    
    for i in range(4):
        assert json_data[i]['batch_id'] == csv_rows[i][0], f"记录{i}批次号不一致"
        assert json_data[i]['patient_name'] == csv_rows[i][10], f"记录{i}患者姓名不一致"
    
    print("✓ 通过: 数据一致性验证 (JSON与CSV数据一致)")
    return True


def main():
    print("=" * 60)
    print("口腔耗材追溯工具验收测试")
    print("=" * 60)
    
    tests = [
        test_normal_data,
        test_dirty_data,
        test_boundary_conflict,
        test_missing_sterilization,
        test_statistics,
        test_report_formats,
        test_data_consistency,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"✗ 失败: {str(e)}")
            failed += 1
    
    print("\n" + "=" * 60)
    print(f"测试结果: 通过 {passed}/{len(tests)}, 失败 {failed}/{len(tests)}")
    print("=" * 60)
    
    if failed > 0:
        sys.exit(1)
    else:
        print("\n✓ 所有验收测试通过!")
        sys.exit(0)


if __name__ == '__main__':
    main()
