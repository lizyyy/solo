#!/usr/bin/env python3
"""钢琴考级曲目准备 - 命令行工具
所有操作都有记录，可复盘、可重跑
"""
import sys
import argparse
import json
from datetime import datetime

from .storage import Storage
from .engine import PrepEngine
from .models import ReviewStatus, WorkflowStage


def cmd_import(args):
    """第一步：导入排练群接龙"""
    storage = Storage(args.data_dir)
    engine = PrepEngine(storage)

    with open(args.input_file, "r", encoding="utf-8") as f:
        lines = [line.rstrip("\n") for line in f if line.strip()]

    added, skipped = engine.import_signups(args.batch_id, lines, args.operator)
    print(f"✅ 导入完成: 新增 {added} 条, 重复跳过 {skipped} 条")
    print(f"   批次 ID: {args.batch_id}")
    print(f"   操作人: {args.operator}")


def cmd_supplement_contract(args):
    """第二步：补录合同页截图"""
    storage = Storage(args.data_dir)
    engine = PrepEngine(storage)

    record = engine.supplement_contract(
        record_id=args.record_id,
        contract_id=args.contract_id,
        song_copyright_name=args.copyright_name,
        screenshot_path=args.screenshot,
        operator=args.operator,
        note=args.note,
    )
    print(f"✅ 合同补录完成")
    print(f"   记录 ID: {record.record_id}")
    print(f"   学生: {record.student_name}")
    print(f"   现场名: {record.song_display_name}")
    print(f"   版权名: {record.contract_info.song_copyright_name}")
    if record.review_status == ReviewStatus.NEEDS_REVIEW:
        print(f"   ⚠️  状态: 需音乐老师复核 (歌名不一致)")
        print(f"   说明: {record.discrepancy_note}")


def cmd_review(args):
    """第三步：音乐老师复核"""
    storage = Storage(args.data_dir)
    engine = PrepEngine(storage)

    record = engine.review_record(
        record_id=args.record_id,
        operator=args.operator,
        confirm=args.confirm,
        final_song_name=args.final_name,
        review_note=args.note,
    )
    status = "✅ 通过" if args.confirm else "❌ 驳回"
    print(f"复核完成: {status}")
    print(f"   记录 ID: {record.record_id}")
    print(f"   当前状态: {record.review_status.value}")
    if args.final_name:
        print(f"   最终歌名: {record.song_display_name}")


def cmd_weekly_report(args):
    """生成给店长的周报"""
    storage = Storage(args.data_dir)
    engine = PrepEngine(storage)

    entries = engine.generate_weekly_report(args.operator)
    print(f"📋 钢琴考级曲目准备周报 ({datetime.now().strftime('%Y-%m-%d')})")
    print("=" * 60)
    print(f"{'学生':<8} {'曲目':<20} {'状态':<10} {'有合同':<6} 备注")
    print("-" * 60)
    for e in entries:
        status_map = {
            "pending": "待处理",
            "needs_review": "待复核",
            "confirmed": "已确认",
            "rejected": "已驳回",
        }
        status = status_map.get(e.review_status.value, e.review_status.value)
        contract = "是" if e.has_contract else "否"
        note = e.discrepancy_note or ""
        print(f"{e.student_name:<8} {e.song_display_name:<20} {status:<10} {contract:<6} {note}")
    print("-" * 60)
    print(f"总计: {len(entries)} 条")
    needs = sum(1 for e in entries if e.review_status == ReviewStatus.NEEDS_REVIEW)
    confirmed = sum(1 for e in entries if e.review_status == ReviewStatus.CONFIRMED)
    print(f"已确认: {confirmed}, 待复核: {needs}")


def cmd_list(args):
    """列出所有曲目记录"""
    storage = Storage(args.data_dir)
    records = storage.list_records()

    status_map = {
        "pending": "待处理",
        "needs_review": "待复核",
        "confirmed": "已确认",
        "rejected": "已驳回",
    }
    stage_map = {
        "imported": "已导入",
        "contract_supplemented": "已补合同",
        "weekly_report_generated": "已入周报",
    }

    print(f"{'记录ID':<14} {'学生':<8} {'曲目':<20} {'阶段':<10} {'状态':<10}")
    print("-" * 70)
    for r in records:
        stage = stage_map.get(r.workflow_stage.value, r.workflow_stage.value)
        status = status_map.get(r.review_status.value, r.review_status.value)
        print(f"{r.record_id:<14} {r.student_name:<8} {r.song_display_name:<20} {stage:<10} {status:<10}")


def cmd_trace(args):
    """三段追溯查询"""
    storage = Storage(args.data_dir)
    engine = PrepEngine(storage)

    trace = engine.trace_record(args.record_id)

    print(f"🔍 三段追溯 - 记录 {trace['record_id']}")
    print(f"   学生: {trace['student_name']} | 曲目: {trace['song_display_name']}")
    print("=" * 60)

    print("\n📌 第一段: 排练群接龙来源")
    for s in trace["stage_1_signup_source"]:
        print(f"   批次 {s['batch_id']} 第{s['original_line_number']}行: {s['raw_text']}")
        print(f"   导入时间: {s['imported_at']}")

    print("\n📌 第二段: 合同页截图补录")
    c = trace["stage_2_contract_supplement"]
    if c:
        print(f"   合同号: {c['contract_id']}")
        print(f"   版权名: {c['song_copyright_name']}")
        print(f"   截图: {c['screenshot_path']}")
        print(f"   补录人: {c['supplemented_by']} @ {c['supplemented_at']}")
    else:
        print("   (未补录)")

    print("\n📌 第三段: 人工确认")
    r = trace["stage_3_manual_confirmation"]
    print(f"   审核状态: {r['review_status']}")
    if r["confirmed_by"]:
        print(f"   确认人: {r['confirmed_by']} @ {r['confirmed_at']}")
    if r["discrepancy_note"]:
        print(f"   备注: {r['discrepancy_note']}")

    print("\n📜 完整变更历史:")
    for h in trace["full_change_history"]:
        print(f"   {h}")


def cmd_history(args):
    """查看变更历史"""
    storage = Storage(args.data_dir)
    history = storage.list_history(args.record_id)

    print(f"📜 变更历史 - 记录 {args.record_id if args.record_id else '(全部)'}")
    print("=" * 60)
    for h in history:
        print(h.human_readable())
        print()


def cmd_update_remark(args):
    """修改备注 - 只改一条也能看出差别"""
    storage = Storage(args.data_dir)
    engine = PrepEngine(storage)

    record = engine.update_remark(
        record_id=args.record_id,
        field_name=args.field,
        new_value=args.value,
        operator=args.operator,
        change_note=args.note,
    )
    print(f"✅ 修改完成: {args.field} = {args.value}")


def cmd_reimport_test(args):
    """测试重复导入 - 验证数量不翻倍"""
    storage = Storage(args.data_dir)
    engine = PrepEngine(storage)

    with open(args.input_file, "r", encoding="utf-8") as f:
        lines = [line.rstrip("\n") for line in f if line.strip()]

    print("第一次导入...")
    a1, s1 = engine.import_signups(args.batch_id, lines, args.operator)
    print(f"  结果: 新增 {a1}, 跳过 {s1}")

    print("\n第二次导入(同一批)...")
    a2, s2 = engine.import_signups(args.batch_id, lines, args.operator)
    print(f"  结果: 新增 {a2}, 跳过 {s2}")

    if a2 == 0 and s2 == a1:
        print("\n✅ 防重复导入验证通过: 第二次导入没有新增")
    else:
        print("\n❌ 防重复导入验证失败!")


def main():
    parser = argparse.ArgumentParser(description="钢琴考级曲目准备系统")
    parser.add_argument("--data-dir", default="data", help="数据目录")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # 导入
    p_import = subparsers.add_parser("import", help="导入排练群接龙")
    p_import.add_argument("--batch-id", required=True, help="批次ID")
    p_import.add_argument("--input-file", required=True, help="接龙文本文件")
    p_import.add_argument("--operator", required=True, help="操作人")
    p_import.set_defaults(func=cmd_import)

    # 补录合同
    p_contract = subparsers.add_parser("supplement", help="补录合同页截图")
    p_contract.add_argument("--record-id", required=True)
    p_contract.add_argument("--contract-id", required=True)
    p_contract.add_argument("--copyright-name", required=True, help="版权名")
    p_contract.add_argument("--screenshot", required=True, help="截图路径")
    p_contract.add_argument("--operator", required=True)
    p_contract.add_argument("--note")
    p_contract.set_defaults(func=cmd_supplement_contract)

    # 复核
    p_review = subparsers.add_parser("review", help="音乐老师复核")
    p_review.add_argument("--record-id", required=True)
    p_review.add_argument("--operator", required=True)
    p_review.add_argument("--confirm", action="store_true", help="确认通过")
    p_review.add_argument("--final-name", help="最终统一歌名")
    p_review.add_argument("--note", help="复核备注")
    p_review.set_defaults(func=cmd_review)

    # 周报
    p_report = subparsers.add_parser("weekly-report", help="生成周报")
    p_report.add_argument("--operator", required=True)
    p_report.set_defaults(func=cmd_weekly_report)

    # 列表
    p_list = subparsers.add_parser("list", help="列出所有记录")
    p_list.set_defaults(func=cmd_list)

    # 追溯
    p_trace = subparsers.add_parser("trace", help="三段追溯查询")
    p_trace.add_argument("--record-id", required=True)
    p_trace.set_defaults(func=cmd_trace)

    # 历史
    p_history = subparsers.add_parser("history", help="查看变更历史")
    p_history.add_argument("--record-id", help="指定记录ID")
    p_history.set_defaults(func=cmd_history)

    # 修改备注
    p_update = subparsers.add_parser("update", help="修改字段(备注等)")
    p_update.add_argument("--record-id", required=True)
    p_update.add_argument("--field", required=True, help="字段名")
    p_update.add_argument("--value", required=True, help="新值")
    p_update.add_argument("--operator", required=True)
    p_update.add_argument("--note", help="修改说明")
    p_update.set_defaults(func=cmd_update_remark)

    # 重复导入测试
    p_test = subparsers.add_parser("reimport-test", help="测试防重复导入")
    p_test.add_argument("--batch-id", required=True)
    p_test.add_argument("--input-file", required=True)
    p_test.add_argument("--operator", required=True)
    p_test.set_defaults(func=cmd_reimport_test)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
