#!/usr/bin/env python3
import sys
import os
import json
from importlib import reload

from storage import RECORDS_FILE, BATCHES_FILE, load_records, load_batches

print_sep = lambda: print("=" * 70)


def print_step(step, title):
    print(f"\n{'='*70}")
    print(f" 步骤 {step}: {title}")
    print(f"{'='*70}")


print_step(1, "读取当前持久化数据")

assert os.path.exists(RECORDS_FILE), "记录文件不存在"
assert os.path.exists(BATCHES_FILE), "批次文件不存在"
print(f"✅ 数据文件存在:")
print(f"   - {RECORDS_FILE}")
print(f"   - {BATCHES_FILE}")

with open(RECORDS_FILE, "r", encoding="utf-8") as f:
    records_before = json.load(f)
with open(BATCHES_FILE, "r", encoding="utf-8") as f:
    batches_before = json.load(f)

print(f"\n📊 读取到:")
print(f"   批次: {len(batches_before)} 个")
print(f"   记录: {len(records_before)} 条")

batch_before = batches_before[0]
print(f"\n📦 批次信息:")
print(f"   批次号: {batch_before['batch_no']}")
print(f"   账期: {batch_before['period']}")
print(f"   已确认金额: {batch_before['confirmed_amount']:.2f} 元")
print(f"   已挂起金额: {batch_before['suspended_amount']:.2f} 元")
print(f"   已确认记录: {batch_before['confirmed_count']} 条")
print(f"   已挂起记录: {batch_before['suspended_count']} 条")

assert batch_before["confirmed_count"] == 2, "应2条已确认记录"
assert batch_before["suspended_count"] == 1, "应1条挂起记录"
assert abs(batch_before["confirmed_amount"] - 2136.80) < 0.01, "已确认金额应为2136.80元"
assert abs(batch_before["suspended_amount"] - 568.30) < 0.01, "挂起金额应为568.30元"

print_step(2, "验证单条记录完整信息")

print(f"\n🔍 检查每条记录的原始备注和处理历史:")
for rec in records_before:
    status_icon = {"confirmed": "✅", "pending": "❓", "suspended": "⏸️", "discrepancy": "⚠️"}.get(rec["status"], "  ")
    print(f"\n   {status_icon} {rec['id']} ({rec['pile_no']}):")
    print(f"      来源: {rec['source']}")
    print(f"      状态: {rec['status']}")
    print(f"      应收: {rec['expected_amount']:.2f} 元")
    actual = f"{rec['actual_amount']:.2f} 元" if rec["actual_amount"] else "待补"
    print(f"      实收: {actual}")
    print(f"      原始备注: {rec['original_remarks'][:50]}..." if len(rec["original_remarks"]) > 50 else f"      原始备注: {rec['original_remarks']}")
    print(f"      处理历史: {len(rec['processing_history'])} 条")
    for i, h in enumerate(rec["processing_history"], 1):
        print(f"        [{i}] {h['timestamp']} | {h['operator']} | {h['action']}")
        print(f"            原因: {h['reason']}")

    assert rec["original_remarks"], f"记录{rec['id']}原始备注为空"
    assert len(rec["processing_history"]) >= 1, f"记录{rec['id']}处理历史为空"

old_caliber = [r for r in records_before if r["source"] == "monthly_statement"][0]
assert "4月旧口径补录" in old_caliber["original_remarks"], "月底对账表旧口径的原始备注丢失"
assert "老曹说等银行6月上旬补打回单" in old_caliber["original_remarks"], "原始备注中的业务对话丢失"
assert "业务提醒" in old_caliber["processing_notes"], "处理意见丢失"
assert len(old_caliber["processing_history"]) == 2, "挂起记录应有2条处理历史"

discrepancy_processed = [r for r in records_before if r["status"] == "confirmed" and len(r["processing_history"]) == 2][0]
assert "人工确认" in discrepancy_processed["processing_notes"], "人工确认意见丢失"
assert "优惠券" in discrepancy_processed["processing_history"][1]["reason"], "确认原因丢失"

print(f"\n✅ 原始备注和处理历史验证通过")

print_step(3, "模拟系统重启 - 重新加载数据")

print(f"\n🔄 重新加载 models 和 storage 模块...")
import models
import storage
reload(storage)
reload(models)

from models import get_all_records, get_all_batches, get_summary, get_record

records_after = get_all_records()
batches_after = get_all_batches()

print(f"\n📊 重启后读取到:")
print(f"   批次: {len(batches_after)} 个 (重启前: {len(batches_before)})")
print(f"   记录: {len(records_after)} 条 (重启前: {len(records_before)})")

assert len(records_after) == len(records_before), "重启后记录数量不一致"
assert len(batches_after) == len(batches_before), "重启后批次数量不一致"

batch_after = batches_after[0]
print(f"\n📦 重启后批次信息:")
print(f"   批次号: {batch_after['batch_no']} (重启前: {batch_before['batch_no']})")
print(f"   已确认金额: {batch_after['confirmed_amount']:.2f} (重启前: {batch_before['confirmed_amount']:.2f})")
print(f"   已挂起金额: {batch_after['suspended_amount']:.2f} (重启前: {batch_before['suspended_amount']:.2f})")
print(f"   已确认记录: {batch_after['confirmed_count']} (重启前: {batch_before['confirmed_count']})")
print(f"   已挂起记录: {batch_after['suspended_count']} (重启前: {batch_before['suspended_count']})")

assert batch_after["batch_no"] == batch_before["batch_no"], "重启后批次号不一致"
assert abs(batch_after["confirmed_amount"] - batch_before["confirmed_amount"]) < 0.01, "重启后已确认金额不一致"
assert abs(batch_after["suspended_amount"] - batch_before["suspended_amount"]) < 0.01, "重启后挂起金额不一致"
assert batch_after["confirmed_count"] == batch_before["confirmed_count"], "重启后已确认记录数不一致"
assert batch_after["suspended_count"] == batch_before["suspended_count"], "重启后挂起记录数不一致"

print_step(4, "验证单条记录重启后完整保留")

for i, (rec_before, rec_after) in enumerate(zip(records_before, records_after), 1):
    print(f"\n🔍 记录 {i}: {rec_after['id']}")
    print(f"   原始备注: 重启前后一致 = {rec_before['original_remarks'] == rec_after['original_remarks']}")
    print(f"   处理历史条数: 重启前 {len(rec_before['processing_history'])} = 重启后 {len(rec_after['processing_history'])}")
    print(f"   状态: 重启前 {rec_before['status']} = 重启后 {rec_after['status']}")

    assert rec_before["original_remarks"] == rec_after["original_remarks"], f"记录{rec_after['id']}原始备注不一致"
    assert len(rec_before["processing_history"]) == len(rec_after["processing_history"]), f"记录{rec_after['id']}处理历史条数不一致"
    assert rec_before["status"] == rec_after["status"], f"记录{rec_after['id']}状态不一致"

    for h_before, h_after in zip(rec_before["processing_history"], rec_after["processing_history"]):
        assert h_before["timestamp"] == h_after["timestamp"], "时间戳不一致"
        assert h_before["operator"] == h_after["operator"], "操作人不一致"
        assert h_before["action"] == h_after["action"], "动作不一致"
        assert h_before["reason"] == h_after["reason"], "原因不一致"

print(f"\n✅ 所有记录重启后完全一致")

print_step(5, "验证导出功能重启后数字一致")

from exporter import export_full_report, export_discrepancy_list

print(f"\n📤 重启后导出完整报告...")
report_path = export_full_report(fmt="csv")
print(f"   报告已导出: {report_path}")

with open(report_path, "r", encoding="utf-8-sig") as f:
    report_content = f.read()

assert "2136.80" in report_content, "导出报告中已确认金额不一致"
assert "568.30" in report_content, "导出报告中挂起金额不一致"
assert "2717.60" in report_content, "导出报告中应收总额不一致"

print(f"✅ 导出报告数字验证通过:")
print(f"   已确认: 2136.80 元")
print(f"   已挂起: 568.30 元")
print(f"   应收总额: 2717.60 元")

print_step(6, "模拟换人接手 - 验证判断过程可追溯")

print(f"\n👤 模拟新接手人查看挂起记录详情:")

suspended_record = [r for r in records_after if r["status"] == "suspended"][0]
detail = get_record(suspended_record["id"])

print(f"\n📋 接手人看到的完整信息:")
print(f"   ┌─ 基本信息 ───────────────────────────────────────")
print(f"   │ 记录ID: {detail['id']}")
print(f"   │ 充电桩: {detail['pile_no']}")
print(f"   │ 数据来源: 月底对账表")
print(f"   │ 来源参考: {detail['source_ref']}")
print(f"   │ 交易日期: {detail['transaction_date']}")
print(f"   │ 台账应收: {detail['expected_amount']:.2f} 元")
print(f"   │ 银行实收: 待补凭证")
print(f"   │ 当前状态: 已挂起")
print(f"   │ 创建时间: {detail['created_at']}")
print(f"   │ 更新时间: {detail['updated_at']}")
print(f"   ├─ 原始备注（月底对账表原文）────────────────────")
print(f"   │ {detail['original_remarks']}")
print(f"   ├─ 处理意见 ─────────────────────────────────────")
for line in detail["processing_notes"].split("\n"):
    print(f"   │ {line}")
print(f"   ├─ 处理历史（可追溯）───────────────────────────")
for i, h in enumerate(detail["processing_history"], 1):
    print(f"   │ [{i}] {h['timestamp']}")
    print(f"   │     操作人: {h['operator']}")
    print(f"   │     动作: {h['action']}")
    print(f"   │     原因: {h['reason']}")
    if h.get("notes"):
        print(f"   │     备注: {h['notes'][:60]}...")
print(f"   └────────────────────────────────────────────────")

assert "老曹" in detail["processing_history"][1]["operator"], "操作人信息丢失，接手人不知道谁处理的"
assert "6月上旬补打" in detail["processing_history"][1]["reason"], "原因丢失，接手人不知道为什么挂起"
assert "业务提醒" in detail["processing_notes"], "业务提醒丢失，接手人不知道该怎么做"
assert "4月旧口径补录" in detail["original_remarks"], "原始备注丢失，接手人看不到历史"

print(f"\n✅ 接手人友好性验证通过:")
print(f"   - 知道是谁处理的（老曹）")
print(f"   - 知道为什么挂起（缺银行回单）")
print(f"   - 知道该怎么做（等6月补打回单）")
print(f"   - 知道历史背景（4月旧口径补录）")

print(f"\n{'='*70}")
print(f"  🎉 重启验证全部通过！")
print(f"{'='*70}")
print(f"\n✅ 关键验证结论:")
print(f"   1. 数据文件持久化: {RECORDS_FILE}")
print(f"   2. 重启后批次完整: {batch_after['batch_no']}")
print(f"   3. 金额完全一致: 已确认{batch_after['confirmed_amount']:.2f}元，挂起{batch_after['suspended_amount']:.2f}元")
print(f"   4. 原始备注保留: 月底对账表乱备注完整保留，未被洗掉")
print(f"   5. 处理历史完整: 每条记录的判断过程全程可追溯")
print(f"   6. 导出数字一致: 重启前后导出的报告数字完全相同")
print(f"   7. 接手友好: 任何人都能看懂前一次的判断依据")
print(f"\n💾 数据安全: 所有数据保存在本地JSON文件，重启不丢失")
print(f"   - 记录文件: {RECORDS_FILE}")
print(f"   - 批次文件: {BATCHES_FILE}")
print(f"{'='*70}\n")

sys.exit(0)
