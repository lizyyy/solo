#!/usr/bin/env python3

from store import store
from engine import PositionGapService, SelfCheckEngine
from models import ProcessingStatus, AbnormalType, EntrySource
import uuid


def run_user_scenario():
    print("=" * 70)
    print("资金头寸缺口预警 - 重复导入预检拦截测试")
    print("按用户指定顺序实际操作，只说实际看到的结果")
    print("=" * 70)

    print("\n===== 操作 1：新建一条预警 =====")
    warning = store.create_warning(
        report_date="2024-06-19",
        fund_code="TEST-001",
        fund_name="重复导入测试基金"
    )
    print(f"实际看到：预警记录创建成功，ID: {warning.id[:8]}...")
    print(f"实际看到：当前明细条目数：{len(warning.entries)} 条")
    print(f"实际看到：当前缺口总额：{warning.total_gap_amount}")
    assert len(warning.entries) == 0

    print("\n===== 操作 2：第一次导入 same.xlsx（1 条平安银行） =====")
    rows_1 = [
        {"证券代码": "000001", "证券名称": "平安银行", "金额": "150000"},
    ]
    result_1 = PositionGapService.import_adjustment_entries(
        warning_id=warning.id,
        rows=rows_1,
        file_name="same.xlsx"
    )
    print(f"实际看到：导入返回 success={result_1['success']}")
    print(f"实际看到：导入返回消息：{result_1.get('message', '')}")
    print(f"实际看到：导入条数：{result_1.get('imported_count', 0)}")
    assert result_1['success'] is True
    assert result_1['imported_count'] == 1

    warning = store.get_warning(warning.id)
    print(f"实际看到：当前明细条目数：{len(warning.entries)} 条")
    print(f"实际看到：当前缺口总额：{warning.total_gap_amount}")
    for e in warning.entries:
        print(f"  行号 {e.original_row_number}: {e.security_name} {e.original_amount} {e.original_currency}")
    assert len(warning.entries) == 1

    print("\n===== 操作 3：获取页面展示数据 =====")
    page_data = PositionGapService.get_page_display_data(warning.id)
    print(f"实际看到：页面数据 - 总条目数：{page_data['total_entries']}")
    print(f"实际看到：页面数据 - 异常数：{page_data['abnormal_count']}")
    print(f"实际看到：页面数据 - 缺口总额：{page_data['total_gap_amount']}")
    assert page_data['total_entries'] == 1

    print("\n===== 操作 4：获取导出内容 =====")
    export_data = PositionGapService.get_export_data(warning.id)
    print(f"实际看到：导出数据 - 总条目数：{export_data['total_entries']}")
    print(f"实际看到：导出数据 - 异常数：{export_data['abnormal_count']}")
    print(f"实际看到：导出数据 - 缺口总额：{export_data['total_gap_amount']}")
    assert export_data['total_entries'] == 1

    print("\n===== 操作 5：第一次重算 =====")
    recalc_1 = PositionGapService.recalculate(warning.id, "林姐")
    print(f"实际看到：重算返回 success={recalc_1['success']}")
    print(f"实际看到：重算消息：{recalc_1['message']}")
    print(f"实际看到：重算后缺口总额：{recalc_1['after_gap']}")
    print(f"实际看到：一致性校验：{recalc_1['consistency_ok']}")
    assert recalc_1['consistency_ok'] is True

    print("\n===== 操作 5a：记录基线（第二次导入前的状态） =====")
    warning = store.get_warning(warning.id)
    baseline_entries_count = len(warning.entries)
    baseline_gap = warning.total_gap_amount
    baseline_page = PositionGapService.get_page_display_data(warning.id)
    baseline_export = PositionGapService.get_export_data(warning.id)
    print(f"实际看到：基线 - 条目数：{baseline_entries_count}，缺口：{baseline_gap}")

    print("\n===== 操作 6：第二次导入同一个 same.xlsx（应该被拦住） =====")
    rows_2 = [
        {"证券代码": "000001", "证券名称": "平安银行", "金额": "150000"},
    ]
    result_2 = PositionGapService.import_adjustment_entries(
        warning_id=warning.id,
        rows=rows_2,
        file_name="same.xlsx"
    )
    print(f"实际看到：导入返回 success={result_2['success']}")
    print(f"实际看到：导入返回消息：{result_2.get('message', '')}")
    assert result_2['success'] is False
    assert "same.xlsx 已导入过，本次未写入明细" in result_2['message']

    print("\n===== 操作 7：验证明细没有增加，还是 1 条 =====")
    warning = store.get_warning(warning.id)
    print(f"实际看到：当前明细条目数：{len(warning.entries)} 条")
    print(f"实际看到：当前缺口总额：{warning.total_gap_amount}")
    for e in warning.entries:
        print(f"  行号 {e.original_row_number}: {e.security_name} {e.original_amount} {e.original_currency}")
    assert len(warning.entries) == 1, f"明细条目数应该还是 1，但实际是 {len(warning.entries)}"

    print("\n===== 操作 8：再次查看页面数据，确认没被带偏（与基线比较） =====")
    page_data_2 = PositionGapService.get_page_display_data(warning.id)
    print(f"实际看到：页面数据 - 总条目数：{page_data_2['total_entries']}")
    print(f"实际看到：页面数据 - 异常数：{page_data_2['abnormal_count']}")
    print(f"实际看到：页面数据 - 缺口总额：{page_data_2['total_gap_amount']}")
    assert page_data_2['total_entries'] == baseline_entries_count
    assert page_data_2['total_gap_amount'] == baseline_gap
    assert page_data_2['total_entries'] == baseline_page['total_entries']
    assert page_data_2['total_gap_amount'] == baseline_page['total_gap_amount']
    assert page_data_2['abnormal_count'] == baseline_page['abnormal_count']

    print("\n===== 操作 9：再次查看导出内容，确认没被带偏（与基线比较） =====")
    export_data_2 = PositionGapService.get_export_data(warning.id)
    print(f"实际看到：导出数据 - 总条目数：{export_data_2['total_entries']}")
    print(f"实际看到：导出数据 - 异常数：{export_data_2['abnormal_count']}")
    print(f"实际看到：导出数据 - 缺口总额：{export_data_2['total_gap_amount']}")
    assert export_data_2['total_entries'] == baseline_entries_count
    assert export_data_2['total_gap_amount'] == baseline_gap
    assert export_data_2['total_entries'] == baseline_export['total_entries']
    assert export_data_2['total_gap_amount'] == baseline_export['total_gap_amount']
    assert export_data_2['abnormal_count'] == baseline_export['abnormal_count']

    print("\n===== 操作 10：再次重算，确认结果没被带偏（与基线比较） =====")
    recalc_2 = PositionGapService.recalculate(warning.id, "林姐")
    print(f"实际看到：重算返回 success={recalc_2['success']}")
    print(f"实际看到：重算消息：{recalc_2['message']}")
    print(f"实际看到：重算后缺口总额：{recalc_2['after_gap']}")
    print(f"实际看到：一致性校验：{recalc_2['consistency_ok']}")
    assert recalc_2['after_gap'] == baseline_gap
    assert recalc_2['consistency_ok'] is True

    print("\n===== 操作 11：导入不同文件名 other.xlsx（应该能成功） =====")
    rows_3 = [
        {"证券代码": "600036", "证券名称": "招商银行", "金额": "HKD250000"},
    ]
    result_3 = PositionGapService.import_adjustment_entries(
        warning_id=warning.id,
        rows=rows_3,
        file_name="other.xlsx"
    )
    print(f"实际看到：导入返回 success={result_3['success']}")
    print(f"实际看到：导入返回消息：{result_3.get('message', '')}")
    print(f"实际看到：导入条数：{result_3.get('imported_count', 0)}")
    assert result_3['success'] is True
    assert result_3['imported_count'] == 1

    warning = store.get_warning(warning.id)
    print(f"实际看到：当前明细条目数：{len(warning.entries)} 条")
    for e in warning.entries:
        print(f"  行号 {e.original_row_number}: {e.security_name} {e.original_amount} {e.original_currency}")
    assert len(warning.entries) == 2

    print("\n===== 操作 12：导入币种同列（留待托管复核） =====")
    rows_4 = [
        {"证券代码": "000858", "证券名称": "五粮液", "金额": "HKD80000/RMB68000"},
    ]
    result_4 = PositionGapService.import_adjustment_entries(
        warning_id=warning.id,
        rows=rows_4,
        file_name="mixed.xlsx"
    )
    print(f"实际看到：导入返回 success={result_4['success']}")
    print(f"实际看到：导入异常数：{result_4.get('abnormal_count', 0)}")
    assert result_4['success'] is True
    assert result_4['abnormal_count'] == 1

    warning = store.get_warning(warning.id)
    mixed_entry = next(e for e in warning.entries if AbnormalType.MIXED_CURRENCY in e.abnormal_types)
    print(f"实际看到：币种同列记录：{mixed_entry.security_name}")
    print(f"实际看到：当前状态：{mixed_entry.current_status}")
    print(f"实际看到：原始值：{mixed_entry.mixed_currency_note}")
    assert mixed_entry.current_status == ProcessingStatus.NEEDS_REVIEW

    print("\n===== 操作 13：补录一条，确认补录正常 =====")
    supp_rows = [
        {"证券代码": "002415", "证券名称": "海康威视", "金额": "200000"},
    ]
    supp_result = PositionGapService.supplement_entries(
        warning_id=warning.id,
        rows=supp_rows,
        operator="林姐",
        remark="测试补录"
    )
    print(f"实际看到：补录返回 success={supp_result['success']}")
    print(f"实际看到：补录消息：{supp_result.get('message', '')}")
    assert supp_result['success'] is True

    warning = store.get_warning(warning.id)
    supp_entry = next(e for e in warning.entries if e.source == EntrySource.SUPPLEMENT)
    print(f"实际看到：补录条目：行号 {supp_entry.original_row_number} - {supp_entry.security_name}")
    print(f"实际看到：来源标记：{supp_entry.source}")
    assert supp_entry.source == EntrySource.SUPPLEMENT

    print("\n===== 操作 14：补录后重算，确认正常 =====")
    before_gap = warning.total_gap_amount
    recalc_3 = PositionGapService.recalculate(warning.id, "林姐")
    print(f"实际看到：重算前缺口：{before_gap}")
    print(f"实际看到：重算后缺口：{recalc_3['after_gap']}")
    print(f"实际看到：重算条目数：{recalc_3['recalculated_count']}")
    print(f"实际看到：一致性校验：{recalc_3['consistency_ok']}")
    assert recalc_3['consistency_ok'] is True

    print("\n===== 操作 15：第三次导入 same.xlsx（再次验证被拦） =====")
    result_5 = PositionGapService.import_adjustment_entries(
        warning_id=warning.id,
        rows=rows_1,
        file_name="same.xlsx"
    )
    print(f"实际看到：导入返回 success={result_5['success']}")
    print(f"实际看到：导入返回消息：{result_5.get('message', '')}")
    assert result_5['success'] is False
    assert "same.xlsx 已导入过，本次未写入明细" in result_5['message']

    warning = store.get_warning(warning.id)
    final_count = len(warning.entries)
    print(f"实际看到：最终明细条目数：{final_count} 条")
    for e in warning.entries:
        print(f"  行号 {e.original_row_number}: {e.security_name} {e.original_amount} {e.original_currency} 来源={e.source} 状态={e.current_status}")

    print("\n" + "=" * 70)
    print("完整操作路验证通过")
    print("=" * 70)
    print("\n实际验证过的结论：")
    print("  ✓ same.xlsx 首次导入成功，1 条明细")
    print("  ✓ same.xlsx 第二次导入被拦住，明细保持 1 条")
    print("  ✓ 被拦时页面数据、导出内容、重算结果都没被带偏")
    print("  ✓ other.xlsx 不同文件名正常导入")
    print("  ✓ 币种同列记录留待托管复核（状态=需托管复核）")
    print("  ✓ 补录功能正常，来源标记=补录")
    print("  ✓ 补录后重算正常，一致性校验通过")
    print("  ✓ same.xlsx 第三次导入仍然被拦住")


if __name__ == "__main__":
    run_user_scenario()
