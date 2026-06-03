#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
量化回测滑点归档 - 完整流程演示
演示三步流程：导入 → 补看邮件 → 补录更新
包含：一次人工修正、一次重跑
三种记录类型：正常、机构简称不一致、补录旧口径
"""

import sys
from datetime import datetime

from demo_data import get_counter_records, get_institution_mapping, get_manager_emails
from slippage_archiver import SlippageArchiver
from models import RecordStatus, DiscrepancyType


def print_separator(title: str = ""):
    print("\n" + "=" * 70)
    if title:
        print(f"  {title}")
        print("=" * 70)


def print_record_details(record, show_full: bool = False):
    print(f"  记录ID: {record.record_id}")
    print(f"  流水尾号: {record.tail_number}")
    print(f"  交易日期: {record.trade_date}")
    print(f"  金额: {record.amount:,.2f} 元")
    print(f"  滑点: {record.slippage:.6f}")
    print(f"  导入机构名: 「{record.institution_name_imported}」")
    if record.institution_name_verified:
        print(f"  标准机构名: 「{record.institution_name_verified}」")
    if record.institution_name_supplemented:
        print(f"  补录机构名: 「{record.institution_name_supplemented}」")
    print(f"  当前状态: {record.status.value}")
    if record.discrepancy_type != DiscrepancyType.NONE:
        print(f"  差异类型: {record.discrepancy_type.value}")
    if record.discrepancy_detail:
        print(f"  处理说明: {record.discrepancy_detail}")
    if record.email_reference:
        print(f"  关联邮件: {record.email_reference}")
    if record.manual_fix_note:
        print(f"  人工修正备注: {record.manual_fix_note}")
    if record.rerun_count > 0:
        print(f"  重跑次数: {record.rerun_count}")
    if show_full:
        print(f"  创建时间: {record.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"  更新时间: {record.updated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        if record.archived:
            print(f"  归档时间: {record.archived_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print("  ---")


def print_result_summary(result, step_name: str):
    print(f"\n  【{step_name} 处理结果】")
    print(f"  处理记录数: {result.total_count}")
    if result.normal_count > 0:
        print(f"  ✓ 正常记录: {result.normal_count}")
    if result.pending_review_count > 0:
        print(f"  ⚠  待财务复核: {result.pending_review_count}")
    if result.supplemented_count > 0:
        print(f"  ✓ 已补录: {result.supplemented_count}")
    if result.manually_fixed_count > 0:
        print(f"  ✎ 人工修正: {result.manually_fixed_count}")
    if result.rerun_count > 0:
        print(f"  ↻ 重跑完成: {result.rerun_count}")
    if result.error_messages:
        print(f"\n  【提示信息】")
        for msg in result.error_messages:
            print(f"    - {msg}")


def main():
    print_separator("量化回测滑点归档系统 - 流程演示")
    print(f"  演示时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  演示场景: 支付平台产品阿南向新人讲解完整流程")

    institution_mapping = get_institution_mapping()
    archiver = SlippageArchiver(institution_mapping)

    print_separator("机构映射配置")
    for tail, mapping in institution_mapping.items():
        print(f"  尾号 {tail}: 标准名称「{mapping.official_name}」，历史别名 {mapping.historical_aliases}")

    # ========== 第一步：柜台流水第一次导入 ==========
    print_separator("【第一步】柜台流水尾号第一次导入")
    print("  操作: 支付平台产品阿南导入2026-05-28至29日的柜台流水")

    counter_records = get_counter_records()
    print(f"\n  导入记录共 {len(counter_records)} 条:")
    for r in counter_records:
        print(f"    尾号 {r.tail_number} | {r.trade_date} | 「{r.institution_name}」 | 金额 {r.amount:,.0f}")

    import_result = archiver.import_counter_records(counter_records)

    print_result_summary(import_result, "第一步导入")

    print(f"\n  【导入后各记录状态】")
    for record in import_result.records:
        print_record_details(record)

    pending_records = archiver.get_pending_review_records()
    print(f"\n  ⚠  目前有 {len(pending_records)} 条记录处于「待财务复核」状态")
    print("  （机构简称前后不一致时，系统不会自动归正常，留给财务复核人复核）")

    # ========== 第二步：支付平台产品阿南补看客户经理补充邮件 ==========
    print_separator("【第二步】支付平台产品阿南补看客户经理补充邮件")
    print("  操作: 阿南查收客户经理补发的邮件，准备补录旧口径说明")

    emails = get_manager_emails()
    archiver.load_manager_emails(emails)

    print(f"\n  收到补充邮件共 {len(emails)} 封:")
    for email in emails:
        print(f"    邮件ID: {email.email_id}")
        print(f"      关联尾号: {email.tail_number}")
        print(f"      旧口径名称: 「{email.institution_name_old}」")
        print(f"      补录日期: {email.supplement_date}")
        print(f"      操作人: {email.operator}")
        print(f"      备注: {email.remark}")
        print("      ---")

    # ========== 第三步：补录记录更新 ==========
    print_separator("【第三步】补录记录更新")
    print("  操作: 阿南根据邮件内容补录流水尾号 6617 的旧口径")

    supplement_result_6617 = archiver.apply_supplement("6617")
    print_result_summary(supplement_result_6617, "补录尾号 6617")

    if supplement_result_6617.records:
        print(f"\n  【尾号 6617 补录后状态】")
        for record in supplement_result_6617.records:
            print_record_details(record, show_full=True)

    print(f"\n  操作: 阿南继续补录流水尾号 8823，但先人工修正一条记录")

    pending_8823 = [r for r in pending_records if r.tail_number == "8823"]
    if pending_8823:
        record_to_fix = pending_8823[0]
        print(f"\n  【人工修正】尾号 8823 记录 {record_to_fix.record_id}")
        fix_result = archiver.apply_manual_fix(
            record_id=record_to_fix.record_id,
            operator="阿南",
            note="与财务复核人确认，5月29日华信证券股份应为华信证券，系柜台录入错误",
            corrected_name="华信证券"
        )
        print_result_summary(fix_result, "人工修正")
        if fix_result.records:
            for record in fix_result.records:
                print_record_details(record)

        print(f"\n  【重跑验证】对修正后的记录执行一次重跑")
        rerun_result = archiver.rerun_record(record_to_fix.record_id)
        print_result_summary(rerun_result, "重跑")
        if rerun_result.records:
            for record in rerun_result.records:
                print_record_details(record)

    print(f"\n  操作: 继续补录尾号 8823 的其余记录")
    supplement_result_8823 = archiver.apply_supplement("8823")
    print_result_summary(supplement_result_8823, "补录尾号 8823")

    # ========== 验证三种处理结果不同 ==========
    print_separator("三种记录类型处理结果对比")

    print("\n  【类型一：顺利记录 - 尾号 4452 中信建投】")
    normal_records = archiver.get_records_by_tail("4452")
    for r in normal_records:
        print_record_details(r)

    print("\n  【类型二：机构简称前后不一致 - 尾号 8823】")
    mismatch_records = archiver.get_records_by_tail("8823")
    for r in mismatch_records:
        print_record_details(r)

    print("\n  【类型三：从客户经理邮件补来的旧口径 - 尾号 6617】")
    supplemented_records = archiver.get_supplemented_records()
    for r in supplemented_records:
        print_record_details(r, show_full=True)

    # ========== 验证补录记录与历史记录对上 ==========
    print_separator("补录记录与历史记录匹配验证")

    from demo_data import get_historical_records
    historical = get_historical_records()
    print("\n  【历史归档记录】")
    for h in historical:
        print(f"    尾号 {h['tail_number']} | {h['trade_date']} | 「{h['institution_name']}」 | {h['source']}")

    print("\n  【匹配验证结果】")
    for sup_rec in supplemented_records:
        hist_for_tail = [h for h in historical if h["tail_number"] == sup_rec.tail_number]
        matched = False
        for h in hist_for_tail:
            if h["institution_name"] == sup_rec.institution_name_supplemented:
                print(f"    ✓ 尾号 {sup_rec.tail_number}: 补录名称「{sup_rec.institution_name_supplemented}」")
                print(f"      与历史记录 {h['trade_date']} 的「{h['institution_name']}」完全匹配")
                matched = True
        if not matched:
            print(f"    ✗ 尾号 {sup_rec.tail_number}: 未找到匹配的历史记录")

    # ========== 最终汇总 ==========
    print_separator("最终处理结果汇总")
    print(archiver.print_summary())

    print("\n  【三种处理结果确实不同】")
    print("    1. 正常记录（尾号4452）→ 状态：正常，无差异，可直接归档")
    print("    2. 机构简称不一致（尾号8823）→ 先标记「待财务复核」，人工修正后重跑")
    print("    3. 补录旧口径（尾号6617）→ 标记「已补录」，关联邮件，与历史记录匹配")

    print_separator("演示完成")
    print("  支付平台产品阿南可以用这份演示数据给新人讲解流程了。")
    print("  财务复核人也能看到一份能解释的量化回测滑点归档结果。")
    print("=" * 70 + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
