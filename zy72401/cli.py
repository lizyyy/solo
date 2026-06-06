import argparse
import json
import sys
from datetime import datetime
from typing import List

from engine import SettlementEngine
from models import TicketType, BatchStatus, AlertLevel, ActionType


def print_separator(title: str):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_batch_summary(batches):
    print(f"{'批次':<12} {'票种分布':<25} {'金额':<10} {'状态':<15} {'需复核'}")
    print("-" * 75)
    for batch_no, batch in batches.items():
        dist = f"赠{batch.free_count}/售{batch.paid_count}/疑{batch.unknown_count}"
        status_icon = "🔴" if batch.status == BatchStatus.MIXED else "🟢"
        print(f"{batch_no:<12} {dist:<25} {batch.total_amount:<10.2f} {status_icon} {batch.status.value:<12} {'是' if batch.needs_review else '否'}")


def print_alerts(alerts):
    if not alerts:
        print("  （无授权提醒）")
        return
    for i, alert in enumerate(alerts, 1):
        level_icon = "🛑" if alert.level == AlertLevel.BLOCKER else "⚠️"
        status = "✅ 已解决" if alert.resolved else "⏳ 待处理"
        print(f"\n  [{i}] {level_icon} {alert.title}  -  {status}")
        print(f"      负责人: {alert.assignee}")
        print(f"      原因: {alert.reason}")
        print(f"      缺材料: {', '.join(alert.missing_materials)}")
        print(f"      下一步: {alert.next_step}")
        print(f"      创建于: {alert.created_at.strftime('%Y-%m-%d %H:%M')}")
        if alert.resolved_at:
            print(f"      解决于: {alert.resolved_at.strftime('%Y-%m-%d %H:%M')}")


def print_tickets(tickets, batch_filter: str = None):
    filtered = [t for t in tickets if (not batch_filter or t.batch_no == batch_filter)]
    print(f"{'票号':<10} {'批次':<10} {'艺人':<12} {'金额':<8} {'票种':<8} {'授权期限':<15} {'备注'}")
    print("-" * 80)
    for t in filtered:
        auth = t.auth_period or "(未补)"
        remark = t.audio_remark[:20] + "..." if len(t.audio_remark) > 20 else t.audio_remark
        print(f"{t.ticket_no:<10} {t.batch_no:<10} {t.artist_name:<12} {t.amount:<8.2f} {t.ticket_type.value:<8} {auth:<15} {remark}")


def print_audit_logs(logs):
    if not logs:
        print("  （无审计记录）")
        return
    for log in logs:
        action_map = {
            ActionType.IMPORT: "📥 导入",
            ActionType.MANUAL_EDIT: "✏️ 人工修正",
            ActionType.RERUN: "🔄 重跑",
            ActionType.AUTH_UPDATE: "📄 授权更新",
            ActionType.REVIEW: "✅ 复核"
        }
        action_str = action_map.get(log.action, log.action.value)
        print(f"\n  {action_str}  -  {log.operator}  -  {log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"      原因: {log.reason}")
        if log.changes:
            for field, change in log.changes.items():
                if isinstance(change, dict) and "old" in change and "new" in change:
                    print(f"      修改: {field} = {change['old']} → {change['new']}")
                else:
                    print(f"      修改: {field} = {change}")
        if log.affected_results:
            print(f"      影响: {'; '.join(log.affected_results)}")


def cmd_import(engine, args):
    with open(args.file, "r", encoding="utf-8") as f:
        if args.file.endswith(".json"):
            audio_data = json.load(f)
        else:
            audio_data = []
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = [p.strip() for p in line.split("|")]
                if len(parts) >= 5:
                    audio_data.append({
                        "batch_no": parts[0],
                        "ticket_no": parts[1],
                        "artist_name": parts[2],
                        "amount": float(parts[3]),
                        "remark": parts[4]
                    })

    run = engine.import_audio_remarks(audio_data, args.operator, args.file)
    print_separator(f"导入完成 - 运行 #{run.run_no}")
    print_batch_summary(run.batches)
    print("\n" + "-" * 60)
    print_alerts(run.alerts)
    return run


def cmd_batches(engine, args):
    run = engine.get_latest_run()
    if not run:
        print("尚无数据，请先导入")
        return
    print_separator(f"批次汇总 - 运行 #{run.run_no}")
    print_batch_summary(run.batches)


def cmd_tickets(engine, args):
    run = engine.get_latest_run()
    if not run:
        print("尚无数据，请先导入")
        return
    print_separator(f"票务明细 - 运行 #{run.run_no}")
    print_tickets(run.tickets, args.batch)


def cmd_alerts(engine, args):
    run = engine.get_latest_run()
    if not run:
        print("尚无数据，请先导入")
        return
    print_separator(f"授权提醒 - 运行 #{run.run_no}")
    print_alerts(run.alerts)


def cmd_update_auth(engine, args):
    run = engine.get_latest_run()
    if not run:
        print("尚无数据，请先导入")
        return
    ticket, alert = engine.update_auth_period(run.run_id, args.ticket, args.period, args.operator)
    if ticket:
        print_separator("授权期限已更新")
        print(f"  票号: {ticket.ticket_no}")
        print(f"  艺人: {ticket.artist_name}")
        print(f"  授权期限: {ticket.auth_period}")
        if alert:
            print(f"\n  提醒状态已同步更新")
    else:
        print("未找到对应票号")


def cmd_edit(engine, args):
    run = engine.get_latest_run()
    if not run:
        print("尚无数据，请先导入")
        return
    ticket = engine.manual_edit_ticket(run.run_id, args.ticket, args.field, args.value, args.operator, args.reason)
    if ticket:
        print_separator("人工修正已保存")
        print(f"  票号: {ticket.ticket_no}")
        print(f"  {args.field}: {getattr(ticket, args.field)}")
    else:
        print("未找到对应票号")


def cmd_rerun(engine, args):
    run = engine.get_latest_run()
    if not run:
        print("尚无数据，请先导入")
        return
    new_run = engine.rerun(run.run_id, args.operator)
    if new_run:
        print_separator(f"重跑完成 - 运行 #{new_run.run_no}（基于 #{run.run_no}）")
        print_batch_summary(new_run.batches)
        print("\n" + "-" * 60)
        print_alerts(new_run.alerts)


def cmd_review(engine, args):
    run = engine.get_latest_run()
    if not run:
        print("尚无数据，请先导入")
        return
    batch = engine.review_batch(run.run_id, args.batch, args.reviewer, args.comment)
    if batch:
        print_separator(f"批次 {args.batch} 复核完成")
        print(f"  复核人: {batch.reviewer}")
        print(f"  复核意见: {args.comment}")
        print(f"  当前状态: {batch.status.value}")


def cmd_audit(engine, args):
    run = engine.get_latest_run()
    if not run and not args.all:
        print("尚无数据，请先导入")
        return
    logs = engine.get_audit_trail(run.run_id if run and not args.all else None, args.batch)
    print_separator("审计轨迹")
    print_audit_logs(logs)


def cmd_demo(engine, args):
    print_separator("🎬 演示流程：音乐节艺人餐补结算")
    print("  场景：录音师晚上催结果，小鹿翻音频备注发现赠票售票混批")
    print("=" * 60)

    demo_data = [
        {"batch_no": "B20260601", "ticket_no": "T001", "artist_name": "乐队A", "amount": 0.0, "remark": "赠票-艺人工作证-音乐节后台"},
        {"batch_no": "B20260601", "ticket_no": "T002", "artist_name": "乐队A", "amount": 380.0, "remark": "售票-内场VIP-歌迷购买"},
        {"batch_no": "B20260601", "ticket_no": "T003", "artist_name": "乐队B", "amount": 0.0, "remark": "赠票-嘉宾票-乐队B成员"},
        {"batch_no": "B20260602", "ticket_no": "T004", "artist_name": "歌手C", "amount": 280.0, "remark": "售票-看台票-正常售票"},
        {"batch_no": "B20260602", "ticket_no": "T005", "artist_name": "组合D", "amount": 280.0, "remark": "售票-看台票-正常售票"},
    ]

    print("\n📌 第一步：导入音频文件备注")
    print("-" * 60)
    run1 = engine.import_audio_remarks(demo_data, "版权运营小鹿", "audio_remarks_20260606.txt")
    print(f"  来源: {run1.source_files[0]}")
    print(f"  导入人: {run1.operator}")
    print(f"  记录数: {len(run1.tickets)}")
    print_batch_summary(run1.batches)
    print_alerts(run1.alerts)

    print("\n\n📌 第二步：录音师复核混批")
    print("-" * 60)
    batch = engine.review_batch(run1.run_id, "B20260601", "录音师老张", "确认T001、T003是赠票，T002是售票，分属不同艺人，可以分开结算")
    print(f"  复核人: {batch.reviewer}")
    print(f"  复核意见: 确认T001、T003是赠票，T002是售票，分属不同艺人，可以分开结算")
    print(f"  状态: {batch.status.value}")
    print_alerts([a for a in run1.alerts if a.batch_no == "B20260601"])

    print("\n\n📌 第三步：小鹿补授权期限页")
    print("-" * 60)
    auth_updates = [
        ("T001", "2026-06-01 至 2026-12-31"),
        ("T002", "2026-06-01 至 2026-08-31"),
        ("T003", "2026-06-01 至 2026-12-31"),
        ("T004", "2026-06-01 至 2026-09-30"),
    ]
    for ticket_no, period in auth_updates:
        ticket, _ = engine.update_auth_period(run1.run_id, ticket_no, period, "版权运营小鹿")
        print(f"  ✅ {ticket.artist_name}({ticket_no}): {period}")

    print("\n  补完授权后，提醒自动更新：")
    print_alerts([a for a in run1.alerts if "授权期限" in a.title])

    print("\n\n📌 第四步：一次人工修正")
    print("-" * 60)
    ticket = engine.manual_edit_ticket(
        run1.run_id, "T005", "amount", "320.0", "版权运营小鹿",
        "核对纸质底单发现T005实际是内场票，金额应为320，不是280"
    )
    print(f"  修改票号: {ticket.ticket_no}")
    print(f"  修改字段: amount = 280.0 → 320.0")
    print(f"  修改原因: 核对纸质底单发现T005实际是内场票")

    print("\n\n📌 第五步：重跑结算")
    print("-" * 60)
    run2 = engine.rerun(run1.run_id, "版权运营小鹿")
    print(f"  运行 #{run2.run_no}（重跑自 #{run1.run_no}）")
    print_batch_summary(run2.batches)

    print("\n\n📌 第六步：查看审计轨迹（谁改了什么，为什么，影响什么）")
    print("-" * 60)
    logs = engine.get_audit_trail(run1.run_id)
    print_audit_logs(logs)

    print("\n\n" + "=" * 60)
    print("  🎉 演示完成！完整流程：")
    print("  1. 导入音频备注 → 自动标记混批")
    print("  2. 录音师复核 → 解除阻断")
    print("  3. 小鹿补授权 → 提醒自动更新")
    print("  4. 人工修正金额 → 留痕可追溯")
    print("  5. 重跑结算 → 结果可对比")
    print("  6. 审计轨迹 → 谁改了什么一清二楚")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="音乐节艺人餐补结算系统")
    parser.add_argument("--operator", default="系统管理员", help="操作人")
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_import = subparsers.add_parser("import", help="导入音频备注")
    p_import.add_argument("file", help="音频备注文件路径（.txt 或 .json）")
    p_import.set_defaults(func=cmd_import)

    p_batches = subparsers.add_parser("batches", help="查看批次汇总")
    p_batches.set_defaults(func=cmd_batches)

    p_tickets = subparsers.add_parser("tickets", help="查看票务明细")
    p_tickets.add_argument("--batch", help="按批次过滤")
    p_tickets.set_defaults(func=cmd_tickets)

    p_alerts = subparsers.add_parser("alerts", help="查看授权提醒")
    p_alerts.set_defaults(func=cmd_alerts)

    p_auth = subparsers.add_parser("update-auth", help="补录授权期限")
    p_auth.add_argument("ticket", help="票号")
    p_auth.add_argument("period", help="授权期限，如 2026-06-01至2026-12-31")
    p_auth.set_defaults(func=cmd_update_auth)

    p_edit = subparsers.add_parser("edit", help="人工修正")
    p_edit.add_argument("ticket", help="票号")
    p_edit.add_argument("field", help="字段名（amount/ticket_type/artist_name等）")
    p_edit.add_argument("value", help="新值")
    p_edit.add_argument("--reason", required=True, help="修改原因")
    p_edit.set_defaults(func=cmd_edit)

    p_rerun = subparsers.add_parser("rerun", help="重跑结算")
    p_rerun.set_defaults(func=cmd_rerun)

    p_review = subparsers.add_parser("review", help="录音师复核")
    p_review.add_argument("batch", help="批次号")
    p_review.add_argument("--reviewer", required=True, help="复核人")
    p_review.add_argument("--comment", required=True, help="复核意见")
    p_review.set_defaults(func=cmd_review)

    p_audit = subparsers.add_parser("audit", help="查看审计轨迹")
    p_audit.add_argument("--all", action="store_true", help="查看全部记录")
    p_audit.add_argument("--batch", help="按批次过滤")
    p_audit.set_defaults(func=cmd_audit)

    p_demo = subparsers.add_parser("demo", help="运行完整演示流程")
    p_demo.set_defaults(func=cmd_demo)

    args = parser.parse_args()
    engine = SettlementEngine()
    args.func(engine, args)


if __name__ == "__main__":
    main()
