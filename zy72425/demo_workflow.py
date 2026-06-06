#!/usr/bin/env python3
"""
完整工作流演示脚本
走通: 排练群接龙导入 → 老周补录合同 → 音乐老师复核 → 生成周报
"""
import os
import shutil
from datetime import datetime

from piano_exam_prep.storage import Storage
from piano_exam_prep.engine import PrepEngine
from piano_exam_prep.models import ReviewStatus


def banner(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")


def main():
    DATA_DIR = "demo_data"

    if os.path.exists(DATA_DIR):
        shutil.rmtree(DATA_DIR)

    storage = Storage(DATA_DIR)
    engine = PrepEngine(storage)

    banner("第一步: 导入排练群接龙 (操作人: 琴行店长老周)")

    lines = [
        "1. 小明 - 小星星",
        "2. 小红 - 致爱丽丝",
        "3. 小华 - 月光奏鸣曲",
        "4. 小李 - 梦中的婚礼",
        "5. 小张 - 童年的回忆",
    ]
    added, skipped = engine.import_signups("BATCH_001", lines, "老周")
    print(f"导入结果: 新增 {added} 条, 跳过 {skipped} 条")

    print("\n📋 当前记录列表:")
    for r in storage.list_records():
        print(f"  {r.record_id} | {r.student_name} | {r.song_display_name} | {r.workflow_stage.value}")

    banner("验证: 重复导入同一批，数量不翻倍")
    added2, skipped2 = engine.import_signups("BATCH_001", lines, "老周")
    print(f"第二次导入: 新增 {added2} 条, 跳过 {skipped2} 条")
    total_records = len(storage.list_records())
    print(f"当前总记录数: {total_records} (应为 5)")
    assert total_records == 5, "防重复导入失败!"
    print("✅ 防重复导入验证通过")

    banner("第二步: 老周补看合同页截图 (操作人: 老周)")

    records = storage.list_records()
    for r in records:
        if r.student_name == "小明":
            print(f"→ 小明: 现场名「小星星」, 合同版权名「小星星变奏曲」(不一致!)")
            engine.supplement_contract(
                record_id=r.record_id,
                contract_id="CT-2024-001",
                song_copyright_name="小星星变奏曲",
                screenshot_path="screenshots/ct_2024_001.png",
                operator="老周",
                note="合同第3页截图",
            )
            ming_record = r
        elif r.student_name == "小红":
            print(f"→ 小红: 现场名「致爱丽丝」, 合同版权名「致爱丽丝」(一致)")
            engine.supplement_contract(
                record_id=r.record_id,
                contract_id="CT-2024-002",
                song_copyright_name="致爱丽丝",
                screenshot_path="screenshots/ct_2024_002.png",
                operator="老周",
            )
        else:
            print(f"→ {r.student_name}: 暂未补合同")

    print("\n📋 补录合同后的状态:")
    for r in storage.list_records():
        status = "⚠️ 待复核" if r.review_status == ReviewStatus.NEEDS_REVIEW else r.review_status.value
        contract = "有合同" if r.contract_info else "无合同"
        print(f"  {r.student_name:<6} | {r.song_display_name:<12} | {contract:<8} | {status}")

    ming_record = storage.load_record(ming_record.record_id)
    print(f"\n⚠️  小明的曲目被自动标记为「需复核」:")
    print(f"   原因: {ming_record.discrepancy_note}")
    print(f"   规则: 现场名≠版权名时，不急着归正常，留给音乐老师复核")

    banner("演示: 老周只改了一条备注，历史里能看出差别")
    engine.update_remark(
        record_id=ming_record.record_id,
        field_name="discrepancy_note",
        new_value=f"{ming_record.discrepancy_note} | 老周补充: 家长说孩子平时就叫小星星",
        operator="老周",
        change_note="补充家长反馈信息",
    )
    print("✅ 备注已修改")
    print("\n📜 小明记录的变更历史:")
    for h in storage.list_history(ming_record.record_id):
        print(h.human_readable())
        print()

    banner("第三步: 音乐老师复核 (操作人: 王老师)")
    print("王老师复查小明的曲目...")
    engine.review_record(
        record_id=ming_record.record_id,
        operator="王老师",
        confirm=True,
        final_song_name="小星星变奏曲",
        review_note="已确认，以版权名为准",
    )
    ming_record = storage.load_record(ming_record.record_id)
    print(f"✅ 复核完成")
    print(f"   最终歌名: {ming_record.song_display_name}")
    print(f"   状态: {ming_record.review_status.value}")

    banner("三段追溯演示: 第二天王老师复查，不用翻聊天记录")
    trace = engine.trace_record(ming_record.record_id)
    print("🔍 第一段: 排练群接龙来源")
    for s in trace["stage_1_signup_source"]:
        print(f"   批次 {s['batch_id']} 第{s['original_line_number']}行: {s['raw_text']}")
    print("\n🔍 第二段: 合同页截图补录")
    c = trace["stage_2_contract_supplement"]
    print(f"   合同号: {c['contract_id']}, 版权名: {c['song_copyright_name']}")
    print(f"   补录人: {c['supplemented_by']}")
    print("\n🔍 第三段: 人工确认")
    r = trace["stage_3_manual_confirmation"]
    print(f"   状态: {r['review_status']}, 确认人: {r['confirmed_by']}")

    banner("生成给店长看的周报")
    entries = engine.generate_weekly_report("老周")
    print(f"📋 钢琴考级曲目准备周报 ({datetime.now().strftime('%Y-%m-%d')})")
    print(f"{'学生':<6} {'曲目':<16} {'状态':<10} {'合同':<6} 备注")
    print("-" * 60)
    for e in entries:
        status_map = {"pending": "待处理", "needs_review": "待复核", "confirmed": "已确认", "rejected": "已驳回"}
        status = status_map.get(e.review_status.value, e.review_status.value)
        contract = "是" if e.has_contract else "否"
        note = (e.discrepancy_note or "")[:30]
        print(f"{e.student_name:<6} {e.song_display_name:<16} {status:<10} {contract:<6} {note}")
    print("-" * 60)
    confirmed = sum(1 for e in entries if e.review_status == ReviewStatus.CONFIRMED)
    print(f"总计 {len(entries)} 条, 已确认 {confirmed} 条")

    banner("✅ 完整工作流演示结束")
    print(f"数据目录: {DATA_DIR}/")
    print("可运行以下命令复盘:")
    print("  python prep.py --data-dir demo_data list")
    print("  python prep.py --data-dir demo_data trace --record-id <记录ID>")
    print("  python prep.py --data-dir demo_data history --record-id <记录ID>")


if __name__ == "__main__":
    main()
