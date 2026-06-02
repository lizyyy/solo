#!/usr/bin/env python3

from store import store
from engine import PositionGapService, SelfCheckEngine
from models import ProcessingStatus, AbnormalType


def run_demo():
    print("=" * 60)
    print("资金头寸缺口预警 - 功能演示")
    print("=" * 60)

    print("\n【第一步】创建预警记录")
    warning = store.create_warning(
        report_date="2024-06-03",
        fund_code="FUND001",
        fund_name="测试混合基金"
    )
    print(f"✓ 创建预警记录 ID: {warning.id}")

    print("\n【第二步】导入尾差调整条（包含币种同列测试数据）")
    test_rows = [
        {"证券代码": "000001", "证券名称": "平安银行", "金额": "150000"},
        {"证券代码": "600036", "证券名称": "招商银行", "金额": "HKD250000"},
        {"证券代码": "000858", "证券名称": "五粮液", "金额": "HKD80000/RMB68000"},
        {"证券代码": "600519", "证券名称": "贵州茅台", "金额": "¥320000"},
        {"证券代码": "000333", "证券名称": "美的集团", "金额": "HK$180000"},
    ]

    result = PositionGapService.import_adjustment_entries(
        warning_id=warning.id,
        rows=test_rows,
        file_name="尾差调整表_20240603.xlsx"
    )
    print(f"✓ {result['message']}")
    print(f"  - 导入总数: {result['imported_count']} 条")
    print(f"  - 异常记录: {result['abnormal_count']} 条")

    print("\n【第三步】查看自检结果")
    warning = store.get_warning(warning.id)
    print(f"✓ 自检项目数: {len(warning.self_check_results)} 项")
    for check in warning.self_check_results:
        status = "✓" if check['passed'] else "✗"
        print(f"  {status} {check['check_name']}: {check['message']}")

    print("\n【第四步】查看异常记录详情")
    for entry in warning.entries:
        if entry.abnormal_types:
            print(f"\n  原始行号: {entry.original_row_number}")
            print(f"  证券代码: {entry.security_code}")
            print(f"  证券名称: {entry.security_name}")
            print(f"  原始金额: {entry.original_amount} {entry.original_currency}")
            print(f"  当前状态: {entry.current_status}")
            print(f"  异常类型: {', '.join(entry.abnormal_types)}")
            print(f"  币种同列原始值: {entry.mixed_currency_note}")

    print("\n【第五步】模拟托管对接人复核币种同列记录")
    mixed_entry = next(e for e in warning.entries if AbnormalType.MIXED_CURRENCY in e.abnormal_types)
    print(f"✓ 复核记录: {mixed_entry.security_name}")
    print(f"  原值: {mixed_entry.mixed_currency_note}")

    confirm_result = PositionGapService.custodian_confirm(
        entry_id=mixed_entry.id,
        warning_id=warning.id,
        custodian_operator="托管对接人小张",
        confirmed_amount=68000,
        confirmed_currency="CNY",
        remark="核对后确认为人民币68000元",
        is_correction=True
    )
    print(f"✓ {confirm_result['message']}")

    print("\n【第六步】林姐人工调整尾差")
    normal_entry = next(e for e in warning.entries if not e.abnormal_types)
    adjust_result = PositionGapService.apply_manual_adjustment(
        entry_id=normal_entry.id,
        warning_id=warning.id,
        operator="林姐",
        adjustment_amount=-500,
        remark="尾差调整"
    )
    print(f"✓ {adjust_result['message']}")
    print(f"  原始金额: {adjust_result['original_amount']}")
    print(f"  调整金额: {adjust_result['adjustment']}")
    print(f"  最终金额: {adjust_result['final_amount']}")

    print("\n【第七步】更新审计明细")
    audit_result = PositionGapService.update_audit_details(
        warning_id=warning.id,
        operator="林姐"
    )
    print(f"✓ {audit_result['message']}")

    print("\n【第八步】验证数据一致性（导出/页面/接口同一份数据）")
    export_data = PositionGapService.get_export_data(warning.id)
    page_data = PositionGapService.get_page_display_data(warning.id)
    api_data = PositionGapService.get_api_response_data(warning.id)

    assert len(export_data['entries']) == len(page_data['entries']) == len(api_data['entries'])
    assert export_data['abnormal_count'] == page_data['abnormal_count'] == api_data['abnormal_count']
    print("✓ 数据一致性校验通过")
    print(f"  记录数一致: {len(export_data['entries'])} 条")
    print(f"  异常数一致: {export_data['abnormal_count']} 条")

    print("\n【第九步】查看审计追踪记录")
    warning = store.get_warning(warning.id)
    for entry in warning.entries[:2]:
        print(f"\n  --- {entry.security_name} 的审计追踪:")
        for trail in entry.audit_trails:
            print(f"    [{trail.timestamp.strftime('%H:%M:%S')}] {trail.operator} - {trail.action}")
            if trail.before_value or trail.after_value:
                print(f"      {trail.before_value} → {trail.after_value}")

    print("\n" + "=" * 60)
    print("演示完成！")
    print("=" * 60)
    print("\n核心特性总结:")
    print("1. ✓ 重复导入检测")
    print("2. ✓ 币种同列检测")
    print("3. ✓ 人工调整留痕")
    print("4. ✓ 三步工作流程")
    print("5. ✓ 数据一致性（导出/页面/接口）")
    print("6. ✓ 完整审计追踪")
    print("7. ✓ 原始行号保留")
    print("8. ✓ 币种异常留待托管复核")


if __name__ == "__main__":
    run_demo()
