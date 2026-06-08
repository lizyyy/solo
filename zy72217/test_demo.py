#!/usr/bin/env python3

from store import store
from engine import PositionGapService, SelfCheckEngine
from models import ProcessingStatus, AbnormalType, EntrySource


def run_demo():
    print("=" * 60)
    print("资金头寸缺口预警 - 完整操作路验证")
    print("=" * 60)

    print("\n【第一步】创建预警记录")
    warning = store.create_warning(
        report_date="2024-06-03",
        fund_code="FUND001",
        fund_name="测试混合基金"
    )
    print(f"  创建预警记录 ID: {warning.id}")

    print("\n【第二步】首次导入尾差调整条（含币种同列）")
    test_rows = [
        {"证券代码": "000001", "证券名称": "平安银行", "金额": "150000"},
        {"证券代码": "600036", "证券名称": "招商银行", "金额": "HKD250000"},
        {"证券代码": "000858", "证券名称": "五粮液", "金额": "HKD80000/RMB68000"},
        {"证券代码": "600519", "证券名称": "贵州茅台", "金额": "¥320000"},
    ]

    result = PositionGapService.import_adjustment_entries(
        warning_id=warning.id,
        rows=test_rows,
        file_name="尾差调整表_20240603.xlsx"
    )
    assert result['success'], f"首次导入应该成功，但返回: {result['message']}"
    assert result['imported_count'] == 4
    assert result['abnormal_count'] == 1
    print(f"  {result['message']}")
    print(f"  导入总数: {result['imported_count']}，异常: {result['abnormal_count']}")

    print("\n【第三步】验证首导不误报重复导入")
    warning = store.get_warning(warning.id)
    for check in warning.self_check_results:
        if check['check_name'] == '重复导入检测':
            assert False, f"首导后自检不应包含重复导入检测! 但发现了: {check}"
    print("  首导后自检无重复导入误报 — 正确")

    print("\n【第四步】托管对接人复核币种同列记录")
    mixed_entry = next(e for e in warning.entries if AbnormalType.MIXED_CURRENCY in e.abnormal_types)
    print(f"  复核: {mixed_entry.security_name}, 原值: {mixed_entry.mixed_currency_note}")
    assert mixed_entry.current_status == ProcessingStatus.NEEDS_REVIEW

    confirm_result = PositionGapService.custodian_confirm(
        entry_id=mixed_entry.id,
        warning_id=warning.id,
        custodian_operator="托管对接人小张",
        confirmed_amount=68000,
        confirmed_currency="CNY",
        remark="核对后确认为人民币68000元",
        is_correction=True
    )
    assert confirm_result['success']
    print(f"  {confirm_result['message']}")

    print("\n【第五步】林姐人工调整尾差")
    normal_entry = next(e for e in warning.entries if not e.abnormal_types and e.source == EntrySource.IMPORT)
    adjust_result = PositionGapService.apply_manual_adjustment(
        entry_id=normal_entry.id,
        warning_id=warning.id,
        operator="林姐",
        adjustment_amount=-500,
        remark="尾差调整"
    )
    assert adjust_result['success']
    print(f"  {adjust_result['message']}")

    print("\n【第六步】补录遗漏条目")
    supplement_rows = [
        {"证券代码": "002415", "证券名称": "海康威视", "金额": "200000"},
        {"证券代码": "601318", "证券名称": "中国平安", "金额": "HKD150000/RMB120000"},
    ]

    supp_result = PositionGapService.supplement_entries(
        warning_id=warning.id,
        rows=supplement_rows,
        operator="林姐",
        remark="漏补海康威视和中国平安"
    )
    assert supp_result['success']
    assert supp_result['supplemented_count'] == 2
    assert supp_result['abnormal_count'] == 1
    print(f"  {supp_result['message']}")

    warning = store.get_warning(warning.id)
    assert len(warning.entries) == 6
    supp_entries = [e for e in warning.entries if e.source == EntrySource.SUPPLEMENT]
    assert len(supp_entries) == 2
    print(f"  总条目数: {len(warning.entries)}，补录条目: {len(supp_entries)}")
    for e in supp_entries:
        print(f"    行号 {e.original_row_number} | {e.security_name} | 来源: {e.source}")

    print("\n【第七步】重算 — 补录后对齐数据")
    recalc_result = PositionGapService.recalculate(
        warning_id=warning.id,
        operator="林姐"
    )
    assert recalc_result['success']
    assert recalc_result['consistency_ok']
    print(f"  {recalc_result['message']}")
    print(f"  缺口总额: {recalc_result['before_gap']} → {recalc_result['after_gap']}")
    print(f"  异常数: {recalc_result['before_abnormal']} → {recalc_result['after_abnormal']}")
    print(f"  重算条目: {recalc_result['recalculated_count']}")
    print(f"  一致性校验: {'通过' if recalc_result['consistency_ok'] else '不一致'}")

    print("\n【第八步】补录的币种同列记录也需托管复核")
    supp_mixed = next((e for e in supp_entries if AbnormalType.MIXED_CURRENCY in e.abnormal_types), None)
    assert supp_mixed is not None, "补录的币种同列记录应存在"
    assert supp_mixed.current_status == ProcessingStatus.NEEDS_REVIEW
    print(f"  {supp_mixed.security_name} 状态: {supp_mixed.current_status} — 正确，留给托管复核")

    print("\n【第九步】托管确认补录的币种同列记录")
    confirm2 = PositionGapService.custodian_confirm(
        entry_id=supp_mixed.id,
        warning_id=warning.id,
        custodian_operator="托管对接人小张",
        confirmed_amount=120000,
        confirmed_currency="CNY",
        remark="补录条目核对，确认为人民币",
        is_correction=True
    )
    assert confirm2['success']
    print(f"  {confirm2['message']}")

    print("\n【第十步】再次重算 — 确认对齐")
    recalc2 = PositionGapService.recalculate(
        warning_id=warning.id,
        operator="林姐"
    )
    assert recalc2['success']
    assert recalc2['consistency_ok']
    print(f"  {recalc2['message']}")
    print(f"  一致性校验: {'通过' if recalc2['consistency_ok'] else '不一致'}")

    print("\n【第十一步】更新审计明细")
    audit_result = PositionGapService.update_audit_details(
        warning_id=warning.id,
        operator="林姐"
    )
    assert audit_result['success']
    print(f"  {audit_result['message']}")

    print("\n【第十二步】验证导出/页面/接口完全一致")
    export_data = PositionGapService.get_export_data(warning.id)
    page_data = PositionGapService.get_page_display_data(warning.id)
    api_data = PositionGapService.get_api_response_data(warning.id)

    assert len(export_data['entries']) == len(page_data['entries']) == len(api_data['entries']) == 6
    assert export_data['abnormal_count'] == page_data['abnormal_count'] == api_data['abnormal_count']
    assert export_data['total_entries'] == page_data['total_entries'] == api_data['total_entries']
    assert export_data['total_gap_amount'] == page_data['total_gap_amount'] == api_data['total_gap_amount']
    for i in range(len(export_data['entries'])):
        assert export_data['entries'][i]['id'] == page_data['entries'][i]['id'] == api_data['entries'][i]['id']
        assert export_data['entries'][i]['original_amount'] == page_data['entries'][i]['original_amount'] == api_data['entries'][i]['original_amount']
        assert export_data['entries'][i]['source'] == page_data['entries'][i]['source'] == api_data['entries'][i]['source']
    print("  导出/页面/接口数据完全一致")

    print("\n【第十三步】手动触发自检（含重复导入检测）")
    warning = store.get_warning(warning.id)
    checks = SelfCheckEngine.run_all_checks(warning, include_duplicate_check=True)
    for check in checks:
        status = "✓" if check['passed'] else "✗"
        print(f"  {status} {check['check_name']}: {check['message']}")
    dup_check = next((c for c in checks if c['check_name'] == '重复导入检测'), None)
    assert dup_check is not None, "手动自检应包含重复导入检测"
    assert dup_check['passed'], "首次导入不应被标记为重复"

    print("\n【第十四步】验证审计追踪完整")
    warning = store.get_warning(warning.id)
    for entry in warning.entries:
        actions = [t.action for t in entry.audit_trails]
        has_import_or_supp = '导入尾差调整条' in actions or '补录尾差调整条' in actions
        assert has_import_or_supp, f"{entry.security_name} 缺少导入/补录审计记录"
        if entry.source == EntrySource.SUPPLEMENT:
            assert '补录尾差调整条' in actions
        else:
            assert '导入尾差调整条' in actions

    supp_with_trail = [e for e in warning.entries if e.source == EntrySource.SUPPLEMENT]
    for e in supp_with_trail:
        print(f"  {e.security_name} (行号{e.original_row_number}): {[t.action for t in e.audit_trails]}")

    print("\n" + "=" * 60)
    print("完整操作路验证通过！")
    print("=" * 60)
    print("\n覆盖场景:")
    print("  1. 首次导入不误报重复 — 通过")
    print("  2. 币种同列留待托管复核 — 通过")
    print("  3. 补录入口+独立来源标记 — 通过")
    print("  4. 补录后重算对齐数据 — 通过")
    print("  5. 导出/页面/接口一致性 — 通过")
    print("  6. 审计追踪完整可追溯 — 通过")
    print("  7. 手动自检含重复检测 — 通过")


if __name__ == "__main__":
    run_demo()
