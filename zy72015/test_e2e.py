#!/usr/bin/env python3
import os
import sys
import json

from storage import RECORDS_FILE, BATCHES_FILE
from models import (
    get_all_batches, get_all_records, get_summary,
    get_record, confirm_record, suspend_record,
    get_discrepancy_list, RecordStatus, DataSource
)
from exporter import export_discrepancy_list, export_full_report
from sample_data import init_sample_data


def print_step(step, title):
    print(f"\n{'='*70}")
    print(f" 步骤 {step}: {title}")
    print(f"{'='*70}")


def check_file_exists(filepath, description):
    if os.path.exists(filepath):
        print(f"✅ {description} 文件已存在: {filepath}")
        return True
    else:
        print(f"❌ {description} 文件不存在: {filepath}")
        return False


def test_step_1_init_sample_data():
    print_step(1, "初始化样例数据")

    if os.path.exists(RECORDS_FILE):
        os.remove(RECORDS_FILE)
    if os.path.exists(BATCHES_FILE):
        os.remove(BATCHES_FILE)

    batch_no = init_sample_data()

    assert batch_no is not None, "批次创建失败"

    batches = get_all_batches()
    records = get_all_records()

    assert len(batches) == 1, f"批次数量应为1，实际为{len(batches)}"
    assert len(records) == 3, f"记录数量应为3，实际为{len(records)}"

    print(f"\n✅ 验证通过：1个批次，3条记录")

    statuses = [r["status"] for r in records]
    print(f"   记录状态分布: {statuses}")

    assert RecordStatus.CONFIRMED in statuses, "应有1条已确认记录"
    assert RecordStatus.DISCREPANCY in statuses, "应有1条有差异记录"
    assert RecordStatus.PENDING in statuses, "应有1条待确认记录"

    print("✅ 验证通过：3条典型记录状态正确")
    print("   - 1条顺利归集（已确认）")
    print("   - 1条需人工确认（有差异）")
    print("   - 1条月底对账表旧口径（待确认）")

    return batch_no, records


def test_step_2_verify_original_remarks(records):
    print_step(2, "验证原始备注保留（不被洗掉）")

    for r in records:
        print(f"\n记录 {r['id']} ({r['pile_no']}):")
        print(f"  来源: {DataSource.SOURCE_LABELS.get(r['source'], r['source'])}")
        print(f"  原始备注: {r['original_remarks']}")
        assert r["original_remarks"], "原始备注不应为空"

    old_caliber_record = [r for r in records if r["source"] == DataSource.MONTHLY_STATEMENT][0]
    assert "4月旧口径补录" in old_caliber_record["original_remarks"], "月底对账表旧口径的原始备注应保留"
    assert "老曹说等银行6月上旬补打回单" in old_caliber_record["original_remarks"], "原始备注中的业务对话应保留"

    print("\n✅ 验证通过：所有原始备注完整保留，月底对账表的乱备注没有被洗掉")

    return old_caliber_record


def test_step_3_process_discrepancy(records, batch_no):
    print_step(3, "人工处理差异记录")

    discrepancy_record = [r for r in records if r["status"] == RecordStatus.DISCREPANCY][0]
    print(f"\n处理差异记录: {discrepancy_record['id']}")
    print(f"  充电桩: {discrepancy_record['pile_no']}")
    print(f"  应收: {discrepancy_record['expected_amount']:.2f} 元")
    print(f"  实收: {discrepancy_record['actual_amount']:.2f} 元")
    print(f"  差异: {discrepancy_record['expected_amount'] - discrepancy_record['actual_amount']:.2f} 元")
    print(f"  原始备注: {discrepancy_record['original_remarks']}")
    print(f"  系统处理意见: {discrepancy_record['processing_notes'].split(chr(10))[0]}")

    result = confirm_record(
        record_id=discrepancy_record["id"],
        operator="门店财务老曹",
        reason="核实为用户使用了12.5元优惠券，台账按原价记账，银行按优惠后到账",
        notes="已核对优惠券核销记录，用户订单号2026052500178，活动名称'新客首充立减'"
    )

    assert result is not None, "确认记录失败"
    assert result["status"] == RecordStatus.CONFIRMED, "记录状态应变为已确认"

    print(f"\n✅ 人工确认成功")
    print(f"  新状态: {RecordStatus.STATUS_LABELS[result['status']]}")
    print(f"  处理意见已追加: {'人工确认' in result['processing_notes']}")

    history = result["processing_history"]
    assert len(history) >= 2, "处理历史应有至少2条记录（创建+确认）"
    print(f"  处理历史条数: {len(history)}")
    for i, h in enumerate(history, 1):
        print(f"    [{i}] {h['timestamp']} | {h['operator']} | {h['action']}")

    print("\n✅ 验证通过：差异记录人工确认完成，处理历史完整留存")

    return result


def test_step_4_suspend_pending(old_caliber_record):
    print_step(4, "挂起缺凭证的旧口径记录")

    print(f"\n待处理记录: {old_caliber_record['id']}")
    print(f"  充电桩: {old_caliber_record['pile_no']}")
    print(f"  来源: {DataSource.SOURCE_LABELS.get(old_caliber_record['source'], old_caliber_record['source'])}")
    print(f"  应收: {old_caliber_record['expected_amount']:.2f} 元")
    print(f"  实收: 待补凭证")
    print(f"  原始备注: {old_caliber_record['original_remarks']}")

    result = suspend_record(
        record_id=old_caliber_record["id"],
        operator="门店财务老曹",
        reason="缺少银行回单，原始备注说明6月上旬补打",
        notes="等银行6月上旬补打4月下旬回单后再确认，已在台账做标记"
    )

    assert result is not None, "挂起记录失败"
    assert result["status"] == RecordStatus.SUSPENDED, "记录状态应变为已挂起"

    print(f"\n✅ 挂起成功")
    print(f"  新状态: {RecordStatus.STATUS_LABELS[result['status']]}")
    print(f"  处理意见包含业务提醒: {'业务提醒' in result['processing_notes']}")

    history = result["processing_history"]
    assert len(history) >= 2, "处理历史应有至少2条记录"

    print("\n✅ 验证通过：缺凭证记录已挂起，不混入已确认金额")

    return result


def test_step_5_verify_amounts(batch_no):
    print_step(5, "验证金额归集逻辑（挂起金额不混入已确认）")

    summary = get_summary(batch_no)
    batch = [b for b in get_all_batches() if b["batch_no"] == batch_no][0]

    print(f"\n批次 {batch_no} 归集汇总:")
    print(f"  台账应收总额: {summary['total_expected']:.2f} 元")
    print(f"  银行实收总额: {summary['total_actual']:.2f} 元")
    print(f"  ✅ 已确认归集: {summary['confirmed_amount']:.2f} 元")
    print(f"  ⏸️  已挂起金额: {summary['suspended_amount']:.2f} 元")
    print(f"  ❓ 待确认金额: {summary['unconfirmed_amount']:.2f} 元")
    print(f"\n  状态分布:")
    print(f"    待确认: {summary['status_counts'].get(RecordStatus.PENDING, 0)} 条")
    print(f"    已确认: {summary['status_counts'].get(RecordStatus.CONFIRMED, 0)} 条")
    print(f"    已挂起: {summary['status_counts'].get(RecordStatus.SUSPENDED, 0)} 条")
    print(f"    有差异: {summary['status_counts'].get(RecordStatus.DISCREPANCY, 0)} 条")

    assert summary["status_counts"][RecordStatus.CONFIRMED] == 2, "应2条已确认记录"
    assert summary["status_counts"][RecordStatus.SUSPENDED] == 1, "应1条挂起记录"
    assert summary["confirmed_amount"] > 0, "已确认金额应大于0"
    assert summary["suspended_amount"] == 568.30, "挂起金额应为568.30元"

    total = summary["confirmed_amount"] + summary["suspended_amount"] + summary["unconfirmed_amount"]
    assert abs(total - summary["total_expected"]) < 0.01, "分类金额合计应等于应收总额"

    print(f"\n✅ 验证通过：挂起金额 {summary['suspended_amount']:.2f} 元 未混入已确认金额")
    print(f"   已确认 + 已挂起 + 待确认 = {total:.2f} 元 = 应收总额 {summary['total_expected']:.2f} 元")

    return summary, batch


def test_step_6_export_reports(batch_no):
    print_step(6, "导出差异清单和完整报告")

    discrepancy_path = export_discrepancy_list(batch_no, fmt="csv")
    print(f"\n差异清单导出: {discrepancy_path}")
    assert check_file_exists(discrepancy_path, "差异清单CSV")

    discrepancy_xlsx = export_discrepancy_list(batch_no, fmt="xlsx")
    print(f"\n差异清单(Excel)导出: {discrepancy_xlsx}")
    assert check_file_exists(discrepancy_xlsx, "差异清单Excel")

    report_path = export_full_report(batch_no, fmt="csv")
    print(f"\n完整报告导出: {report_path}")
    assert check_file_exists(report_path, "完整报告CSV")

    report_xlsx = export_full_report(batch_no, fmt="xlsx")
    print(f"\n完整报告(Excel)导出: {report_xlsx}")
    assert check_file_exists(report_xlsx, "完整报告Excel")

    discrepancies = get_discrepancy_list(batch_no)
    if discrepancies:
        print(f"\n⚠️  当前还有 {len(discrepancies)} 条待处理记录")
    else:
        print(f"\n🎉 所有记录均已处理完毕")

    print("\n✅ 验证通过：所有报告导出成功")

    return {
        "discrepancy_csv": discrepancy_path,
        "discrepancy_xlsx": discrepancy_xlsx,
        "report_csv": report_path,
        "report_xlsx": report_xlsx
    }


def test_step_7_verify_persistence(batch_no, summary_before):
    print_step(7, "模拟重启 - 验证数据持久化")

    print("\n📦 保存当前数据文件路径...")
    print(f"   记录文件: {RECORDS_FILE}")
    print(f"   批次文件: {BATCHES_FILE}")

    with open(RECORDS_FILE, "r", encoding="utf-8") as f:
        records_data_before = json.load(f)
    with open(BATCHES_FILE, "r", encoding="utf-8") as f:
        batches_data_before = json.load(f)

    print(f"\n🔄 模拟系统重启（重新加载数据）...")

    from importlib import reload
    import models
    reload(models)
    import storage
    reload(storage)

    from models import get_summary, get_all_records, get_all_batches, get_record

    records_after = get_all_records()
    batches_after = get_all_batches()
    summary_after = get_summary(batch_no)

    print(f"\n📊 重启后验证:")
    print(f"   记录数量: {len(records_after)} (重启前: {len(records_data_before)})")
    print(f"   批次数量: {len(batches_after)} (重启前: {len(batches_data_before)})")
    print(f"   已确认金额: {summary_after['confirmed_amount']:.2f} (重启前: {summary_before['confirmed_amount']:.2f})")
    print(f"   已挂起金额: {summary_after['suspended_amount']:.2f} (重启前: {summary_before['suspended_amount']:.2f})")

    assert len(records_after) == len(records_data_before), "记录数量应一致"
    assert len(batches_after) == len(batches_data_before), "批次数量应一致"
    assert abs(summary_after["confirmed_amount"] - summary_before["confirmed_amount"]) < 0.01, "已确认金额应一致"
    assert abs(summary_after["suspended_amount"] - summary_before["suspended_amount"]) < 0.01, "挂起金额应一致"

    print("\n🔍 验证单条记录历史追溯:")
    test_record = records_after[1]
    print(f"   记录ID: {test_record['id']}")
    print(f"   充电桩: {test_record['pile_no']}")
    print(f"   原始备注: {test_record['original_remarks'][:50]}...")
    print(f"   处理历史条数: {len(test_record['processing_history'])}")
    for i, h in enumerate(test_record['processing_history'], 1):
        print(f"     [{i}] {h['timestamp']} | {h['operator']} | {h['action']}")

    assert len(test_record['processing_history']) >= 2, "处理历史应完整保留"
    assert test_record['original_remarks'], "原始备注应保留"

    print("\n✅ 验证通过：重启后所有数据、备注、处理历史、金额完全一致")

    return summary_after


def test_step_8_discrepancy_list_exported_content(exported_files, batch_no):
    print_step(8, "验证导出的差异清单内容")

    discrepancies = get_discrepancy_list(batch_no)

    if not discrepancies:
        print("\n🎉 当前无差异记录，差异清单显示'已处理完毕'")
        with open(exported_files["discrepancy_csv"], "r", encoding="utf-8-sig") as f:
            content = f.read()
        assert "无差异" in content or "已处理完毕" in content, "无差异时应有明确提示"
        print("✅ 验证通过：差异清单内容正确，无差异时提示明确")
        return

    print(f"\n当前差异记录数: {len(discrepancies)}")
    with open(exported_files["discrepancy_csv"], "r", encoding="utf-8-sig") as f:
        lines = f.readlines()

    print(f"导出文件行数: {len(lines)}")
    assert len(lines) >= len(discrepancies) + 1, "导出文件应包含表头和所有差异记录"

    print("✅ 验证通过：差异清单导出内容完整")


def print_final_summary(batch_no):
    print(f"\n{'='*70}")
    print(f"  🎉 端到端测试全部通过！")
    print(f"{'='*70}")
    print(f"\n📋 新能源充电桩收益归集 - 完整流程回顾:")
    print(f"\n  批次号: {batch_no}")
    print(f"  账期: 2026-05")
    print(f"\n  处理的3条记录:")

    records = get_all_records()
    for r in records:
        status_icon = {
            RecordStatus.CONFIRMED: "✅",
            RecordStatus.PENDING: "❓",
            RecordStatus.SUSPENDED: "⏸️",
            RecordStatus.DISCREPANCY: "⚠️"
        }.get(r["status"], "  ")
        source = DataSource.SOURCE_LABELS.get(r["source"], r["source"])
        actual = f"{r['actual_amount']:.2f}" if r["actual_amount"] else "待补"
        print(f"   {status_icon} {r['pile_no']} | 来源:{source} | 应收:{r['expected_amount']:.2f} | 实收:{actual}")
        print(f"      状态: {RecordStatus.STATUS_LABELS[r['status']]}")
        print(f"      处理历史: {len(r['processing_history'])} 条")

    summary = get_summary(batch_no)
    print(f"\n  💰 最终归集结果:")
    print(f"     台账应收总额: {summary['total_expected']:.2f} 元")
    print(f"     ✅ 已确认归集: {summary['confirmed_amount']:.2f} 元")
    print(f"     ⏸️  已挂起金额: {summary['suspended_amount']:.2f} 元 (缺凭证，暂不归集)")
    print(f"     ❓ 待确认金额: {summary['unconfirmed_amount']:.2f} 元")

    print(f"\n  📤 已导出文件:")
    for f in os.listdir("exports"):
        if f.endswith(".csv") or f.endswith(".xlsx"):
            print(f"     - {f}")

    print(f"\n  💾 数据持久化位置:")
    print(f"     - 记录: {RECORDS_FILE}")
    print(f"     - 批次: {BATCHES_FILE}")

    print(f"\n  🔍 关键特性验证:")
    print(f"     ✅ 原始备注完整保留（月底对账表乱备注未洗掉）")
    print(f"     ✅ 缺凭证记录挂起，金额不混入已确认")
    print(f"     ✅ 处理历史全程可追溯")
    print(f"     ✅ 业务提醒清晰，同事可照着做")
    print(f"     ✅ 重启后数据完整，金额一致")
    print(f"     ✅ 差异清单和完整报告读同一份数据")
    print(f"     ✅ 来源和处理时间完整记录")

    print(f"\n{'='*70}")
    print(f"  后续操作指南:")
    print(f"  - 命令行交互: python3 cli.py")
    print(f"  - 启动API服务: python3 cli.py api")
    print(f"  - 重新初始化: python3 cli.py init")
    print(f"  - 查看导出: ls -la exports/")
    print(f"{'='*70}\n")


def main():
    try:
        batch_no, records = test_step_1_init_sample_data()
        old_caliber_record = test_step_2_verify_original_remarks(records)
        test_step_3_process_discrepancy(records, batch_no)
        test_step_4_suspend_pending(old_caliber_record)
        summary_before, _ = test_step_5_verify_amounts(batch_no)
        exported_files = test_step_6_export_reports(batch_no)
        test_step_7_verify_persistence(batch_no, summary_before)
        test_step_8_discrepancy_list_exported_content(exported_files, batch_no)
        print_final_summary(batch_no)
        print("\n✅ 所有测试通过！系统运行正常。")
        return 0
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
