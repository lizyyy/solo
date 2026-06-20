import sys
import argparse
from .store import RecordStore
from .engine import VerificationEngine
from .reporter import Reporter
from .models import VerificationRecord


def cmd_run(args):
    store = RecordStore()
    engine = VerificationEngine()
    records = store.load_all()
    if not records:
        print("没有找到任何验算记录。请先在 data/records.json 中放入样例数据。")
        return 1
    results = engine.batch_verify(records)
    store.save_all(records)
    print(Reporter.format_summary(results, records))
    suspended = [r for r in results if r["status"] == "挂起待确认"]
    if suspended:
        print("")
        print("退出提示：以下记录卡在外推越界或单位换算异常，已挂起等待排班同事人工确认：")
        for s in suspended:
            print(f"  - 记录 {s['record_id']}（{s['student']}）：{s['message']}")
        print("请使用 confirm 子命令人工确认，不要靠人回忆口径变更原因。")
        return 2
    return 0


def cmd_list(args):
    store = RecordStore()
    records = store.load_all()
    if not records:
        print("暂无记录。")
        return 0
    for r in records:
        print(Reporter.format_record_detail(r))
    return 0


def cmd_show(args):
    store = RecordStore()
    record = store.find_by_id(args.record_id)
    if not record:
        print(f"找不到记录: {args.record_id}")
        return 1
    print(Reporter.format_record_detail(record))
    return 0


def cmd_confirm(args):
    store = RecordStore()
    record = store.find_by_id(args.record_id)
    if not record:
        print(f"找不到记录: {args.record_id}")
        return 1
    status_val = record.status.value if hasattr(record.status, 'value') else record.status
    if status_val != "挂起待确认":
        print(f"记录当前状态为【{status_val}】，不是挂起状态，无需确认。")
        print("如仍需强制修改口径，请使用 --force 参数。")
        if not args.force:
            return 1
    store.confirm_record(args.record_id, args.operator, args.note, args.override)
    updated = store.find_by_id(args.record_id)
    print("确认成功！已记录旧值、新判断和原因：")
    print(Reporter.format_record_detail(updated))
    return 0


def cmd_attach(args):
    store = RecordStore()
    ok = store.append_attachment(args.record_id, args.kind, args.content)
    if not ok:
        print(f"找不到记录: {args.record_id}")
        return 1
    print(f"已向记录 {args.record_id} 添加附件/备注。")
    return 0


def main():
    parser = argparse.ArgumentParser(
        prog="prob-check",
        description="概率模拟批量验算系统 — 一条命令跑完，外推越界挂起，历史全程留痕",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="运行批量验算（一条命令跑完所有样例）")
    p_run.set_defaults(func=cmd_run)

    p_list = sub.add_parser("list", help="列出所有记录及其历史")
    p_list.set_defaults(func=cmd_list)

    p_show = sub.add_parser("show", help="查看单条记录的详细信息（含历史与附件）")
    p_show.add_argument("record_id", help="记录ID，如 CASE003")
    p_show.set_defaults(func=cmd_show)

    p_confirm = sub.add_parser("confirm", help="人工确认挂起记录，自动记录旧值、新判断、原因")
    p_confirm.add_argument("record_id", help="记录ID")
    p_confirm.add_argument("operator", help="确认人姓名，如 张排班")
    p_confirm.add_argument("note", help="确认原因/改口径说明")
    p_confirm.add_argument("--override", type=float, default=None, help="人工修正后的数值（可选）")
    p_confirm.add_argument("--force", action="store_true", help="强制对非挂起记录也做口径变更")
    p_confirm.set_defaults(func=cmd_confirm)

    p_attach = sub.add_parser("attach", help="给记录补充附件/备注/截图引用（保留历史）")
    p_attach.add_argument("record_id", help="记录ID")
    p_attach.add_argument("kind", help="类型，如 草稿备注 / 截图引用 / 补录说明")
    p_attach.add_argument("content", help="内容")
    p_attach.set_defaults(func=cmd_attach)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
