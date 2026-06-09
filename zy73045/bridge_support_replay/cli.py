"""命令行入口 — 让没参与开发的人也能上手。

入口子命令：
  bsr replay WO-XXX              回放单条，打印结论 + 异常出口
  bsr list [handled|pending|stuck|all]  按状态列出
  bsr timeline WO-XXX            打印时间线（含补录/改判历史）
  bsr raw WO-XXX [OUTDIR]        导出原始快照（给接手同事留痕）
  bsr demo-init                  生成几条示例工单，立刻能试

异常出口约定：
  退出码 0 = 正常（哪怕回放发现待补证据，只要脚本本身没崩）
  退出码 2 = 参数错误（打印用法）
  退出码 1 = 执行出错（附带可读信息）

所有 stdout 输出都默认是给人看的文本；加 --json 输出机器可读结构。
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Optional

from .models import WorkOrderStatus
from .storage import (
    load_workorder,
    save_workorder,
    create_workorder_from_raw,
    add_cleaned_spare_part,
    export_raw_backup,
)
from .replay_engine import replay_workorder
from .classifier import list_workorders, classify_workorder
from .timeline import build_timeline, record_manual_note, record_alarm
from .supplement import supplement_evidence, reverse_decision


def _print_json(obj: Any) -> None:
    print(json.dumps(obj, ensure_ascii=False, indent=2))


def _print_human_replay(result_dict: dict) -> None:
    rid = result_dict["workorder_id"]
    status = result_dict["status"]
    label = {
        "handled": "✅ 已处理",
        "pending_evidence": "📋 待补证据",
        "stuck": "🚧 还卡着",
    }.get(status, f"状态：{status}")
    ok = "✅ 回放通过" if result_dict["success"] else "⚠️ 回放未通过"
    print(f"工单 {rid}  —  {label}  —  {ok}")
    print("结论：", result_dict.get("current_conclusion") or "(未填写)")
    if result_dict.get("suggested_next_step"):
        print("下一步：", result_dict["suggested_next_step"])

    fr = result_dict.get("failure_reason")
    if fr:
        print()
        print("════════════════════════════════════")
        print(f"失败码：{fr['code']}")
        print(f"说明：  {fr['message']}")
        if fr.get("details"):
            # 打印关键细节，避免刷屏
            det = fr["details"]
            if "missing_items" in det:
                print("缺材料：")
                for m in det["missing_items"]:
                    print(f"  · {m}")
            if "conflicts" in det:
                print("备件冲突：")
                for c in det["conflicts"]:
                    print(f"  · {c['part_id']} {c['field']}: "
                          f"{c['old']} → {c['new']} （{c['note']}）")
            if "bad_photos" in det:
                print("问题照片：")
                for p in det["bad_photos"]:
                    print(f"  · {p['photo_id']} 严重程度={p['severity']} "
                          f"差 {p['max_delta_minutes']}min")
        if fr.get("suggested_actions"):
            print()
            print("处理建议（给接手同事）：")
            for i, a in enumerate(fr["suggested_actions"], 1):
                print(f"  {i:>2}. {a}")

    # 时间线简述
    tl = result_dict.get("timeline", [])
    if tl:
        print()
        print(f"时间线（共 {len(tl)} 条）：")
        for e in tl[:10]:
            print(f"  [{e['timestamp'][:16]}] {e['actor']:<8} {e['summary']}")
        if len(tl) > 10:
            print(f"  ... (还有 {len(tl)-10} 条，用 `bsr timeline {rid}` 查看全部)")

    print()
    print("════════════════════════════════════")
    print(f"材料入口：bsr replay --json {rid}     （机器可读）")
    print(f"         bsr timeline {rid}          （时间线+补录历史）")
    print(f"         bsr raw {rid} ./export      （原始快照留痕）")


def cmd_replay(args: argparse.Namespace) -> int:
    wo = load_workorder(args.workorder_id)
    if wo is None:
        print(f"[错误] 工单 {args.workorder_id} 不存在。", file=sys.stderr)
        print("用 `bsr demo-init` 生成示例数据后再试。", file=sys.stderr)
        return 1
    result = replay_workorder(wo, strict=args.strict)
    d = result.to_dict()
    if args.json:
        _print_json(d)
    else:
        _print_human_replay(d)
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    status_map = {
        "all": None,
        "handled": WorkOrderStatus.HANDLED,
        "pending": WorkOrderStatus.PENDING_EVIDENCE,
        "stuck": WorkOrderStatus.STUCK,
    }
    data = list_workorders(status_filter=status_map.get(args.status))
    if args.json:
        _print_json(data)
        return 0

    if "items" in data:
        items = data["items"]
        print(f"共 {len(items)} 条：")
        for it in items:
            print(f"  {it['workorder_id']}  {it['status_label']}  {it['title']}")
        return 0

    s = data["summary"]
    print(f"概览：总数 {s['total']} | 已处理 {s['handled_count']} | "
          f"待补 {s['pending_evidence_count']} | 卡壳 {s['stuck_count']}")
    print()
    for key, title in [("handled", "✅ 已处理"),
                       ("pending_evidence", "📋 待补证据"),
                       ("stuck", "🚧 还卡着")]:
        items = data[key]
        if not items:
            continue
        print(f"—— {title} ({len(items)}) ——")
        for it in items:
            tags = []
            if it.get("override_note"):
                tags.append("⚠️标记/实际不符")
            if it.get("missing_items"):
                tags.append(f"缺{len(it['missing_items'])}项")
            if it.get("blockers"):
                tags.append(f"阻塞{len(it['blockers'])}项")
            tag_str = (" " + " ".join(tags)) if tags else ""
            print(f"  {it['workorder_id']}  {it['title']}{tag_str}")
        print()
    print("查详情：bsr replay <工单ID>")
    return 0


def cmd_timeline(args: argparse.Namespace) -> int:
    wo = load_workorder(args.workorder_id)
    if wo is None:
        print(f"[错误] 工单 {args.workorder_id} 不存在。", file=sys.stderr)
        return 1
    tl = build_timeline(wo, include_raw=args.include_raw)
    if args.json:
        _print_json({"workorder_id": wo.workorder_id,
                     "conclusion_history": wo.conclusion_history,
                     "timeline": tl})
        return 0
    print(f"工单 {wo.workorder_id} 时间线")
    print(f"当前结论：{wo.current_conclusion or '(未填写)'}")
    print(f"当前备注：{(wo.current_note or '(无)')[:200]}")
    if wo.conclusion_history:
        print()
        print("—— 结论变更历史（旧材料 → 新备注 / 改判原因） ——")
        for i, h in enumerate(wo.conclusion_history, 1):
            print(f" [{i}] {h['timestamp'][:16]} by {h['actor']}")
            print(f"      旧结论：{h.get('old_conclusion') or '(无)'}")
            print(f"      新结论：{h.get('new_conclusion') or '(无)'}")
            print(f"      改判原因：{h.get('reversal_reason')}")
            print(f"      旧备注：{(h.get('old_note') or '')[:100]}")
            print(f"      新备注：{(h.get('new_note') or '')[:100]}")
            print()
    print("—— 事件流 ——")
    for e in tl:
        extras = ""
        if args.include_raw:
            extras = f" | before_keys={list(e.get('before',{}).keys())} after_keys={list(e.get('after',{}).keys())}"
        print(f"  [{e['timestamp'][:19]}] {e['type']:<18} {e['actor']:<10} {e['summary']}{extras}")
    return 0


def cmd_raw(args: argparse.Namespace) -> int:
    out_dir = Path(args.out_dir or "./bsr_raw_exports")
    try:
        path = export_raw_backup(args.workorder_id, out_dir)
    except FileNotFoundError:
        print(f"[错误] 工单 {args.workorder_id} 不存在。", file=sys.stderr)
        return 1
    print(f"已导出原始快照到：{path}")
    print("里面包含：raw_snapshot / cleaning_log / 每条备件的 raw_entry")
    return 0


def cmd_supplement(args: argparse.Namespace) -> int:
    try:
        wo = supplement_evidence(
            args.workorder_id,
            actor=args.actor,
            note=args.note,
            new_conclusion=args.conclusion,
            reversal_reason=args.reversal_reason,
        )
    except FileNotFoundError:
        print(f"[错误] 工单 {args.workorder_id} 不存在。", file=sys.stderr)
        return 1
    print(f"已补录。工单状态：{wo.status.value} | 当前结论：{wo.current_conclusion}")
    return 0


def cmd_demo_init(args: argparse.Namespace) -> int:
    from .sample_data import generate_demo_workorders
    count = generate_demo_workorders()
    print(f"已生成 {count} 条示例工单。现在可以：")
    print("  bsr list                    看总览")
    print("  bsr replay WO-2025-S001     回放『已处理』样例")
    print("  bsr replay WO-2025-S002     回放『待补证据』样例")
    print("  bsr replay WO-2025-S003     回放『卡壳』样例（照片错位 + 报警对不上）")
    print("  bsr timeline WO-2025-S003   看它的完整时间线（含补录改判历史）")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="bsr",
        description="桥梁支座工单回放 — 材料入口、异常出口一目了然。",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "常用流程（接手同事）:\n"
            "  1. bsr list                  →  看手里有多少卡壳的\n"
            "  2. bsr replay WO-XXX         →  知道哪有问题 + 怎么处理\n"
            "  3. bsr timeline WO-XXX       →  看之前同事做了什么、改了什么\n"
            "  4. bsr supplement ...        →  补录证据/改判\n"
            "  5. bsr raw WO-XXX ./export   →  拿原始来源去解释\n"
        ),
    )
    sp = p.add_subparsers(dest="command", required=True)

    # replay
    r = sp.add_parser("replay", help="回放单条工单")
    r.add_argument("workorder_id")
    r.add_argument("--strict", action="store_true",
                   help="严格模式（发现high/critical问题直接视为失败）")
    r.add_argument("--json", action="store_true", help="输出机器可读JSON")
    r.set_defaults(func=cmd_replay)

    # list
    l = sp.add_parser("list", help="按状态列出工单")
    l.add_argument("status", nargs="?", default="all",
                   choices=["all", "handled", "pending", "stuck"])
    l.add_argument("--json", action="store_true")
    l.set_defaults(func=cmd_list)

    # timeline
    t = sp.add_parser("timeline", help="打印时间线 + 补录/改判历史")
    t.add_argument("workorder_id")
    t.add_argument("--include-raw", action="store_true",
                   help="显示每条事件的 before/after 快照键")
    t.add_argument("--json", action="store_true")
    t.set_defaults(func=cmd_timeline)

    # raw
    ra = sp.add_parser("raw", help="导出原始快照（留痕）")
    ra.add_argument("workorder_id")
    ra.add_argument("out_dir", nargs="?", default=None,
                    help="输出目录（默认 ./bsr_raw_exports）")
    ra.set_defaults(func=cmd_raw)

    # supplement
    su = sp.add_parser("supplement", help="补录证据/改判结论")
    su.add_argument("workorder_id")
    su.add_argument("--actor", required=True, help="操作人姓名")
    su.add_argument("--note", required=True, help="补录说明（给接手同事看）")
    su.add_argument("--conclusion", default=None, help="新的处理结论")
    su.add_argument("--reversal-reason", default=None,
                    help="改判原因（变更结论时强烈建议填）")
    su.set_defaults(func=cmd_supplement)

    # demo-init
    d = sp.add_parser("demo-init", help="生成示例工单，立刻能上手")
    d.set_defaults(func=cmd_demo_init)

    return p


def main(argv: Optional[list[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
