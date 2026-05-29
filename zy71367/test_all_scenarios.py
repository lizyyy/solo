#!/usr/bin/env python3
"""
服装秀面料样卡管理系统 - 全场景验证脚本

验证场景:
1. 色号混淆检测
2. 样卡缺失处理
3. 到货逾期与状态流转验证
4. 补录操作验证
5. 撤回操作完整性验证
6. 样卡匹配引擎验证
7. 报告导出验证
"""

import sys
import os
import json
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fabric_sample_cli.models import DataStore
from fabric_sample_cli.storage import StorageManager
from fabric_sample_cli.color_validator import ColorValidator
from fabric_sample_cli.matching_engine import MatchingEngine
from fabric_sample_cli.arrival_manager import ArrivalManager, InspectionStatus
from fabric_sample_cli.history_manager import HistoryManager
from fabric_sample_cli.report_exporter import ReportExporter
from fabric_sample_cli.sample_data import create_sample_data


def print_section(title):
    print("\n" + "=" * 80)
    print(f"【验证场景】{title}")
    print("=" * 80)


def print_subsection(title):
    print(f"\n--- {title} ---")


def test_color_confusion():
    """场景1: 色号混淆检测"""
    print_section("色号混淆检测")

    storage = StorageManager()
    color_validator = ColorValidator(storage)
    store = DataStore()

    test_cases = [
        ("#DC143C", "大红", "HEX格式，红色系易混"),
        ("255,0,0", "正红", "RGB格式，红色系易混"),
        ("PANTONE 186 C", "中国红", "潘通格式，红色系易混"),
        ("#F5F5DC", "米白", "HEX格式，白色系易混"),
        ("象牙白", "米白", "中文名称，白色系易混，颜色名不一致"),
        ("香芋紫", "藕粉", "中文名称，紫色/粉色混淆"),
        ("藏蓝", "藏蓝", "中文名称，蓝色系"),
        ("RGB(25,25,112)", "宝蓝", "RGB格式，蓝色系"),
        ("C193, M154, Y107, K0", "驼色", "CMYK格式，置信度低"),
        ("#000000", "碳黑", "HEX格式，黑色系易混"),
    ]

    print_subsection("色号校验与混淆检测")
    print(f"{'色号':<25} {'颜色名':<10} {'格式':<10} {'置信度':<10} {'HEX':<10} {'混淆风险':<10}")
    print("-" * 80)

    confusion_count = 0
    for color_code, color_name, description in test_cases:
        color_spec = color_validator.validate_color_spec(
            color_code, color_name, entity_id=f"TEST-{color_code[:8]}", entity_type="sample"
        )
        status = "⚠ 有混淆" if color_spec.is_confusing else "✓ 正常"
        if color_spec.is_confusing:
            confusion_count += 1
        print(f"{color_code:<25} {color_name:<10} {color_spec.format_detected.value:<10} "
              f"{color_spec.color_confidence:<10.2%} {color_spec.normalized_hex or 'N/A':<10} {status:<10}")
        if color_spec.confusing_with:
            print(f"  → 易混: {', '.join(color_spec.confusing_with[:3])}")
        if color_spec.color_confidence < 0.6:
            print(f"  → 置信度低，需要人工确认")

    print_subsection("错误清单统计")
    color_errors = [e for e in storage.load_errors() if e.error_type == "色号校验"]
    print(f"色号校验错误数: {len(color_errors)}")
    print(f"有混淆风险色号数: {confusion_count}")

    for err in color_errors[:3]:
        print(f"  [{err.severity}] {err.error_code}: {err.message[:60]}...")

    return confusion_count > 0


def test_sample_missing():
    """场景2: 样卡缺失处理"""
    print_section("样卡缺失处理")

    storage = StorageManager()
    color_validator = ColorValidator(storage)
    store = DataStore()
    store = create_sample_data(store, color_validator)

    print_subsection("缺失样卡检测")
    missing_samples = [s for s in store.samples.values() if s.is_missing]
    print(f"标记为缺失的样卡数: {len(missing_samples)}")

    for s in missing_samples:
        print(f"  样卡ID: {s.sample_id}")
        print(f"    面料: {s.fabric_name}")
        print(f"    供应商: {s.supplier_id}")
        print(f"    备注: {s.remark}")
        print(f"    检验状态: {s.inspection_status.value}")

    print_subsection("缺失样卡跳过匹配验证")
    matching_engine = MatchingEngine(storage, color_validator)
    matches, traces, store = matching_engine.find_matches(store)

    matched_sample_ids = {m.sample_id for m in matches}
    missing_not_matched = all(s.sample_id not in matched_sample_ids for s in missing_samples)

    print(f"匹配成功数: {len(matches)}")
    print(f"缺失样卡是否全部跳过: {'✓ 是' if missing_not_matched else '✗ 否'}")

    return missing_not_matched


def test_arrival_and_status_flow():
    """场景3: 到货逾期与状态流转可靠性验证"""
    print_section("到货逾期与状态流转可靠性验证")

    storage = StorageManager()
    color_validator = ColorValidator(storage)
    store = DataStore()
    today = date.today()
    store = create_sample_data(store, color_validator, today)

    print_subsection("到货逾期检测")
    arrival_manager = ArrivalManager(storage)
    reminders, traces, store = arrival_manager.check_arrivals(store, today)

    delayed_samples = [r for r in reminders if r.arrival_status.value == "到货逾期"]
    print(f"逾期样卡数: {len(delayed_samples)}")

    for r in delayed_samples[:3]:
        sample = store.samples.get(r.sample_id)
        print(f"\n  样卡: {r.sample_id} ({sample.fabric_name if sample else '未知'})")
        print(f"    预计到货: {r.expected_arrival}")
        print(f"    实际到货: {r.actual_arrival or '未到货'}")
        print(f"    逾期天数: {r.days_overdue} 天")
        print(f"    检验截止: {r.inspection_deadline}")
        print(f"    距截止天数: {r.days_before_deadline} 天" if r.days_before_deadline is not None else "")
        print(f"    状态流转链: {' → '.join(r.status_transition_chain)}")
        if r.calculation_process:
            cp = r.calculation_process
            if 'arrival_days_diff' in cp:
                print(f"    计算过程: 逾期天数 = {r.actual_arrival} - {r.expected_arrival} = {cp['arrival_days_diff']} 天")

    print_subsection("状态流转异常检测 (到货晚于检验截止)")
    flow_errors = [e for e in store.errors.values() if e.error_code == "FLOW-001"]
    print(f"状态流转异常数: {len(flow_errors)}")

    for err in flow_errors:
        print(f"\n  错误: {err.error_id}")
        print(f"    描述: {err.message}")
        if err.calculation_detail:
            cd = err.calculation_detail
            print(f"    计算详情:")
            print(f"      到货日期: {cd.get('actual_arrival')}")
            print(f"      检验截止: {cd.get('inspection_deadline')}")
            print(f"      当前状态: {cd.get('current_status')}")
            print(f"      逾期天数: {cd.get('arrival_after_deadline_days', 'N/A')} 天")
            print(f"      异常: {cd.get('anomaly')}")

    print_subsection("状态流转规则验证")
    test_cases = [
        ("SAMP-003-C", InspectionStatus.IN_PROGRESS, True, "待检验 → 检验中 (正常)"),
        ("SAMP-003-C", InspectionStatus.PASSED, True, "检验中 → 检验通过 (正常)"),
        ("SAMP-003-C", InspectionStatus.PENDING, False, "检验通过 → 待检验 (不允许)"),
        ("SAMP-002-B", InspectionStatus.FAILED, True, "检验中 → 检验不合格 (正常)"),
        ("SAMP-002-B", InspectionStatus.REINSPECT, True, "检验不合格 → 待复检 (正常)"),
        ("SAMP-004-D", InspectionStatus.REVOKED, True, "检验通过 → 已撤回 (正常)"),
    ]

    print(f"{'样卡ID':<15} {'目标状态':<15} {'期望结果':<10} {'描述'}")
    print("-" * 80)

    all_flow_valid = True
    for sample_id, target_status, should_succeed, description in test_cases:
        sample, traces, store = arrival_manager.transition_status(
            sample_id, target_status, store, "测试用户", description
        )
        actual_result = sample is not None
        status = "✓ 通过" if actual_result == should_succeed else "✗ 失败"
        if actual_result != should_succeed:
            all_flow_valid = False
        print(f"{sample_id:<15} {target_status.value:<15} {'成功' if should_succeed else '失败':<10} {status} {description}")

    return len(flow_errors) > 0 and all_flow_valid


def test_amend_operation():
    """场景4: 补录操作验证"""
    print_section("补录操作验证")

    storage = StorageManager()
    color_validator = ColorValidator(storage)
    store = DataStore()
    today = date.today()
    store = create_sample_data(store, color_validator, today)

    arrival_manager = ArrivalManager(storage)
    history_manager = HistoryManager(storage)

    print_subsection("执行补录操作")
    test_sample_id = "SAMP-003-C"
    original_sample = store.samples.get(test_sample_id)

    print(f"补录前 - 样卡 {test_sample_id}:")
    print(f"  实际到货: {original_sample.arrival_date}")
    print(f"  检验截止: {original_sample.inspection_deadline}")
    print(f"  备注: {original_sample.remark}")

    new_arrival = today - timedelta(days=1)
    new_deadline = today + timedelta(days=5)
    updates = {
        'arrival_date': new_arrival,
        'inspection_deadline': new_deadline,
        'remark': '补录: 供应商已重新发货，实际到货日期更正'
    }

    amended_sample, traces, store = arrival_manager.amend_sample(
        test_sample_id, updates, store, "设计助理-小王",
        "供应商通知实际到货日期变更，需要补录更正"
    )

    print(f"\n补录后 - 样卡 {test_sample_id}:")
    print(f"  实际到货: {amended_sample.arrival_date}")
    print(f"  检验截止: {amended_sample.inspection_deadline}")
    print(f"  备注: {amended_sample.remark}")

    print_subsection("补录历史记录验证")
    timeline = history_manager.build_entity_timeline("sample", test_sample_id, store)
    amend_records = [t for t in timeline if t['operation'] == "补录"]

    print(f"补录历史记录数: {len(amend_records)}")
    for record in amend_records:
        print(f"\n  操作时间: {record['time']}")
        print(f"  操作人: {record['operator']}")
        print(f"  原因: {record['reason']}")
        print(f"  变更字段:")
        for change in record['changes']:
            print(f"    {change['field']}: {change['before']} → {change['after']}")
        if record['calculation_trace']:
            print(f"  计算追踪:")
            for t in record['calculation_trace'][:3]:
                print(f"    {t}")

    amend_success = len(amend_records) > 0 and amended_sample.arrival_date == new_arrival

    print_subsection("补录后状态流转验证")
    sample2, traces2, store = arrival_manager.transition_status(
        test_sample_id, InspectionStatus.IN_PROGRESS, store, "质检员-小李",
        "补录完成后开始检验"
    )

    print(f"补录后状态变更: {'成功' if sample2 else '失败'}")
    if sample2:
        print(f"当前状态: {sample2.inspection_status.value}")

    return amend_success and sample2 is not None


def test_revoke_integrity():
    """场景5: 撤回操作完整性验证"""
    print_section("撤回操作完整性验证")

    storage = StorageManager()
    color_validator = ColorValidator(storage)
    store = DataStore()
    today = date.today()
    store = create_sample_data(store, color_validator, today)

    matching_engine = MatchingEngine(storage, color_validator)
    arrival_manager = ArrivalManager(storage)
    history_manager = HistoryManager(storage)

    print_subsection("先执行匹配建立关联")
    matches, traces, store = matching_engine.find_matches(store)
    print(f"匹配成功数: {len(matches)}")

    test_sample_id = "SAMP-002-B"
    related_matches_before = [m for m in store.matches.values() if m.sample_id == test_sample_id]
    related_garments_before = [g for g in store.garments.values() if g.sample_id == test_sample_id]

    print(f"\n撤回前 - 样卡 {test_sample_id}:")
    print(f"  关联匹配数: {len(related_matches_before)}")
    print(f"  关联成衣数: {len(related_garments_before)}")
    print(f"  当前状态: {store.samples[test_sample_id].inspection_status.value}")

    print_subsection("执行撤回操作")
    revoked_sample, traces, store = arrival_manager.revoke_sample(
        test_sample_id, store, "设计主管-老张",
        "样卡颜色不符合设计要求，退回供应商重新打样"
    )

    print(f"\n撤回后 - 样卡 {test_sample_id}:")
    print(f"  当前状态: {revoked_sample.inspection_status.value if revoked_sample else '未知'}")

    print_subsection("验证关联清理")
    related_matches_after = [m for m in store.matches.values() if m.sample_id == test_sample_id]
    related_garments_after = [g for g in store.garments.values() if g.sample_id == test_sample_id]

    print(f"  关联匹配数: {len(related_matches_after)} (期望: 0)")
    print(f"  关联成衣数: {len(related_garments_after)} (期望: 0)")

    matches_cleared = len(related_matches_after) == 0
    garments_cleared = len(related_garments_after) == 0

    print_subsection("撤回完整性校验")
    integrity_result = history_manager.verify_revocation_integrity(test_sample_id, store)

    print(f"  样卡已撤回: {'✓ 是' if integrity_result['is_revoked'] else '✗ 否'}")
    print(f"  匹配记录已清理: {'✓ 是' if integrity_result['related_records_removed'] else '✗ 否'}")
    print(f"  成衣关联已解除: {'✓ 是' if integrity_result['garment_associations_cleared'] else '✗ 否'}")
    print(f"  状态流转有效: {'✓ 是' if integrity_result['status_chain_valid'] else '✗ 否'}")

    if integrity_result['anomalies']:
        print(f"\n  发现异常:")
        for anomaly in integrity_result['anomalies']:
            print(f"    ⚠ {anomaly}")

    print_subsection("撤回历史记录")
    revoke_history = [
        h for h in store.history.values()
        if h.entity_id == test_sample_id and h.operation_type.value == "撤回"
    ]
    print(f"撤回历史记录数: {len(revoke_history)}")
    for h in revoke_history:
        print(f"\n  记录ID: {h.record_id}")
        print(f"  操作时间: {h.operation_time}")
        print(f"  操作人: {h.operator}")
        print(f"  原因: {h.change_reason}")

    all_ok = (integrity_result['is_revoked'] and
              integrity_result['related_records_removed'] and
              integrity_result['garment_associations_cleared'] and
              integrity_result['status_chain_valid'])

    return all_ok


def test_matching_engine():
    """场景6: 样卡匹配引擎验证"""
    print_section("样卡匹配引擎验证")

    storage = StorageManager()
    color_validator = ColorValidator(storage)
    store = DataStore()
    today = date.today()
    store = create_sample_data(store, color_validator, today)

    matching_engine = MatchingEngine(storage, color_validator)

    print_subsection("匹配引擎配置")
    print(f"颜色权重: {matching_engine.color_weight}")
    print(f"供应商权重: {matching_engine.supplier_weight}")
    print(f"编号关联权重: {matching_engine.id_correlation_weight}")
    print(f"匹配阈值: {matching_engine.match_threshold}")

    print_subsection("执行自动匹配")
    matches, traces, store = matching_engine.find_matches(store)

    print(f"\n匹配结果统计:")
    print(f"  总成衣数: {len(store.garments)}")
    print(f"  总样卡数: {len(store.samples)}")
    print(f"  缺失样卡数: {sum(1 for s in store.samples.values() if s.is_missing)}")
    print(f"  匹配成功数: {len(matches)}")
    print(f"  自动匹配: {sum(1 for m in matches if not m.is_manual)}")
    print(f"  人工匹配: {sum(1 for m in matches if m.is_manual)}")

    print_subsection("匹配详情与计算过程")
    print(f"{'匹配ID':<12} {'样卡':<15} {'成衣':<12} {'颜色分':<10} {'供应商分':<10} {'编号分':<10} {'总分':<10} {'类型'}")
    print("-" * 95)

    for m in matches[:8]:
        sample = store.samples.get(m.sample_id)
        garment = store.garments.get(m.garment_id)

        id_score = (m.match_score - m.color_match_score * matching_engine.color_weight
                    - m.supplier_match_score * matching_engine.supplier_weight) / matching_engine.id_correlation_weight

        print(f"{m.match_id[-8:]:<12} {m.sample_id:<15} {m.garment_id:<12} "
              f"{m.color_match_score:<10.2%} {m.supplier_match_score:<10.2%} {id_score:<10.2%} "
              f"{m.match_score:<10.2%} {'人工' if m.is_manual else '自动'}")

        if m.match_score < 0.7:
            print(f"  → 低置信度匹配: 样卡 {sample.fabric_name if sample else '?'} -> 成衣 {garment.style_name if garment else '?'}")
            print(f"    计算公式: {m.color_match_score:.2%}*0.6 + {m.supplier_match_score:.2%}*0.3 + {id_score:.2%}*0.1 = {m.match_score:.2%}")

    print_subsection("未匹配成功分析")
    unmatched_garments = [g for g in store.garments.values() if g.sample_id is None]
    unmatched_samples = [s for s in store.samples.values()
                         if not any(m.sample_id == s.sample_id for m in matches) and not s.is_missing]

    print(f"未匹配成衣数: {len(unmatched_garments)}")
    print(f"未匹配样卡数: {len(unmatched_samples)}")

    match_errors = [e for e in store.errors.values() if e.error_type == "样卡匹配"]
    print(f"匹配相关错误数: {len(match_errors)}")
    for err in match_errors:
        print(f"  [{err.severity}] {err.message[:60]}...")

    return len(matches) > 0


def test_report_export():
    """场景7: 报告导出验证"""
    print_section("报告导出验证")

    storage = StorageManager()
    color_validator = ColorValidator(storage)
    store = DataStore()
    today = date.today()
    store = create_sample_data(store, color_validator, today)

    matching_engine = MatchingEngine(storage, color_validator)
    arrival_manager = ArrivalManager(storage)
    report_exporter = ReportExporter(storage)

    matches, traces, store = matching_engine.find_matches(store)
    reminders, traces2, store = arrival_manager.check_arrivals(store, today)

    print_subsection("控制台报告生成")
    console_report = report_exporter.print_console_report(store, "summary")
    lines = console_report.split('\n')
    print(f"控制台报告行数: {len(lines)}")
    for line in lines[:15]:
        if line.strip():
            print(f"  {line[:80]}")

    print_subsection("匹配报告 (含计算过程)")
    matching_report = report_exporter.export_matching_report(store, include_calculations=True)
    print(f"报告类型: {matching_report['report_type']}")
    print(f"生成时间: {matching_report['generated_at']}")
    print(f"匹配记录数: {len(matching_report['matches'])}")

    if matching_report['calculation_details']:
        print(f"\n计算过程详情:")
        for calc in matching_report['calculation_details']:
            print(f"\n  标题: {calc['title']}")
            print(f"  公式: {calc.get('formula', 'N/A')}")
            if 'weights' in calc:
                print(f"  权重: {calc['weights']}")
            if 'thresholds' in calc:
                print(f"  阈值: {calc['thresholds']}")

    print_subsection("Excel报告导出")
    export_path = report_exporter.export_to_excel(store, "测试报告.xlsx")
    print(f"Excel报告路径: {export_path}")
    print(f"文件存在: {'✓ 是' if os.path.exists(export_path) else '✗ 否'}")
    if os.path.exists(export_path):
        file_size = os.path.getsize(export_path)
        print(f"文件大小: {file_size / 1024:.2f} KB")

    return os.path.exists(export_path)


def main():
    print("\n" + "#" * 80)
    print("#" + " " * 78 + "#")
    print("#" + " " * 20 + "服装秀面料样卡管理系统 - 全场景验证" + " " * 19 + "#")
    print("#" + " " * 78 + "#")
    print("#" * 80)

    results = {}

    try:
        results['色号混淆检测'] = test_color_confusion()
    except Exception as e:
        print(f"\n❌ 色号混淆检测异常: {e}")
        import traceback
        traceback.print_exc()
        results['色号混淆检测'] = False

    try:
        results['样卡缺失处理'] = test_sample_missing()
    except Exception as e:
        print(f"\n❌ 样卡缺失处理异常: {e}")
        import traceback
        traceback.print_exc()
        results['样卡缺失处理'] = False

    try:
        results['到货与状态流转'] = test_arrival_and_status_flow()
    except Exception as e:
        print(f"\n❌ 到货与状态流转异常: {e}")
        import traceback
        traceback.print_exc()
        results['到货与状态流转'] = False

    try:
        results['补录操作验证'] = test_amend_operation()
    except Exception as e:
        print(f"\n❌ 补录操作异常: {e}")
        import traceback
        traceback.print_exc()
        results['补录操作验证'] = False

    try:
        results['撤回完整性验证'] = test_revoke_integrity()
    except Exception as e:
        print(f"\n❌ 撤回操作异常: {e}")
        import traceback
        traceback.print_exc()
        results['撤回完整性验证'] = False

    try:
        results['匹配引擎验证'] = test_matching_engine()
    except Exception as e:
        print(f"\n❌ 匹配引擎异常: {e}")
        import traceback
        traceback.print_exc()
        results['匹配引擎验证'] = False

    try:
        results['报告导出验证'] = test_report_export()
    except Exception as e:
        print(f"\n❌ 报告导出异常: {e}")
        import traceback
        traceback.print_exc()
        results['报告导出验证'] = False

    print("\n" + "=" * 80)
    print("【验证总结】")
    print("=" * 80)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for scenario, result in results.items():
        status = "✅ 通过" if result else "❌ 失败"
        print(f"  {scenario}: {status}")

    print(f"\n总计: {passed}/{total} 场景验证通过")

    if passed == total:
        print("\n🎉 所有核心场景验证通过！")
        return 0
    else:
        print(f"\n⚠️  有 {total - passed} 个场景需要关注")
        return 1


if __name__ == "__main__":
    sys.exit(main())
