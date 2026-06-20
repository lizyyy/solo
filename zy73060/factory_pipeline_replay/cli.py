"""工厂管线工单回放 CLI

使用方式示例（在仓库根目录运行）：

  # 新手上手：查看可用命令
  python -m factory_pipeline_replay.cli --help

  # 1) 回放一份 CSV 工单材料（入口最常用）
  python -m factory_pipeline_replay.cli replay --file data/sample_orders.csv --operator 小宋 --shift 早班

  # 2) 查看所有回放会话
  python -m factory_pipeline_replay.cli list

  # 3) 按条件筛选（比如只看采样断档的行）
  python -m factory_pipeline_replay.cli filter --session <会话ID> --has-gap

  # 4) 查看某行详情（含改判历史、交接记录）
  python -m factory_pipeline_replay.cli detail --session <会话ID> --line 7

  # 5) 给断档行补录材料并改判
  python -m factory_pipeline_replay.cli fill --session <会话ID> --line 7 \\
      --material 1.28 --operator 小王 --reason "巡检发现断档，现场重测补录" \\
      --remark "现场于 14:35 重新采样，温度 24℃"

  # 6) 导出 CSV（复核人带走给项目经理）
  python -m factory_pipeline_replay.cli export --session <会话ID> --out data/exported.csv

  # 7) 项目经理三栏汇总视图（截图用）
  python -m factory_pipeline_replay.cli report --session <会话ID>

  # 8) 录入班组交接记录（上一班改了什么写清楚）
  python -m factory_pipeline_replay.cli handover --date 2026-06-09 \\
      --from-shift 早班 --from-operator 小宋 --to-shift 中班 --to-operator 小王 \\
      --summary "3# 管廊压力突升，已减压；WO-2026-00017 第 7 行补录" \\
      --changed-lines 7,12

异常出口（出了问题这样排查）：
  - 回放显示"坏行"多：用 detail --line <n> 看具体原因，多半是工单号/管线号格式错
  - 显示"跳过行"：detail 里能看到是管线标记为废弃
  - 显示"待补材料"：用 fill 补录
  - 结论跟预期不符：detail 能看到旧→新的完整改判轨迹
"""
from __future__ import annotations

import argparse
import os
import sys
import textwrap
from datetime import datetime
from typing import List, Optional, Dict, Any

from . import storage
from . import engine
from .models import (
    HandoverRecord, Remark, LineStatus, WorkOrderConclusion, Shift
)


# ---------- 终端颜色（无依赖实现） ----------
class C:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RED = "\033[31m"
    GREEN = "\033[32m"
    YELLOW = "\033[33m"
    BLUE = "\033[34m"
    MAGENTA = "\033[35m"
    CYAN = "\033[36m"
    WHITE = "\033[37m"
    BG_RED = "\033[41m"
    BG_GREEN = "\033[42m"
    BG_YELLOW = "\033[43m"
    BG_BLUE = "\033[44m"
    BG_MAGENTA = "\033[45m"


def _c(text: str, color: str) -> str:
    if not sys.stdout.isatty():
        return text
    return f"{color}{text}{C.RESET}"


def _status_color(status: str) -> str:
    return {
        LineStatus.PROCESSED.value: C.GREEN,
        LineStatus.SKIPPED.value: C.YELLOW,
        LineStatus.BAD.value: C.RED,
        LineStatus.PENDING_MATERIAL.value: C.MAGENTA,
        LineStatus.MANUAL_JUDGED.value: C.CYAN,
    }.get(status, C.WHITE)


def _wrap(text: str, width: int = 40) -> str:
    if not text:
        return ""
    return "\n".join(textwrap.wrap(text, width=width, subsequent_indent="    "))


# ---------- 命令：replay ----------
def cmd_replay(args: argparse.Namespace) -> int:
    """回放 CSV 并打印分类统计 + 明细（含嵌入备注）。"""
    csv_path = args.file
    if not os.path.isfile(csv_path):
        print(_c(f"[入口错误] 找不到材料文件：{csv_path}", C.RED))
        print(_c("提示：先用 --file 指向一份 CSV，列名包含【工单号、管线号、采样点、采样时间、材料值】", C.DIM))
        return 2

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        csv_text = f.read()

    # 加载当日交接记录（若存在）
    today = datetime.now().strftime("%Y-%m-%d")
    handovers = storage.list_handovers(today)
    handover = None
    if handovers:
        # 选择与当前班次匹配的
        for h in handovers:
            if h.get("to_shift") == args.shift:
                handover = HandoverRecord(**h)
                break
        if not handover:
            handover = HandoverRecord(**handovers[-1])

    # 加载后补备注
    remarks_for_lines = []
    for h in handovers:
        remarks_for_lines.extend(h.get("remarks", []))

    print(_c(f"{'='*70}", C.BLUE))
    print(_c(f"  工厂管线工单回放  —  入口材料：{os.path.basename(csv_path)}", C.BOLD + C.CYAN))
    print(_c(f"  操作人：{args.operator or '未填'}    班组：{args.shift or '未填'}    时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", C.DIM))
    print(_c(f"{'='*70}", C.BLUE))

    session = engine.run_replay(
        csv_text=csv_text,
        operator=args.operator,
        shift=args.shift,
        source_file=os.path.abspath(csv_path),
        handover=handover,
        remarks=remarks_for_lines if remarks_for_lines else None,
    )

    # 分类统计
    counters = session.counters()
    total = len(session.lines)
    print()
    print(_c("  ◆ 分类统计（总数以外，坏行/跳过行/已处理行 分开说）", C.BOLD))
    print(f"    总行数:     {total}")
    print(f"    {_c('已处理    :', _status_color('已处理'))} {counters['已处理']:>4}  行")
    print(f"    {_c('跳过行    :', _status_color('跳过行'))} {counters['跳过行']:>4}  行   (提示：管线废弃等原因)")
    print(f"    {_c('坏行      :', _status_color('坏行'))} {counters['坏行']:>4}  行   (提示：工单号/管线号格式等)")
    print(f"    {_c('待补材料  :', _status_color('待补材料'))} {counters['待补材料']:>4}  行   (提示：采样断档需补录)")
    print(f"    {_c('人工改判  :', _status_color('人工改判'))} {counters['人工改判']:>4}  行")
    print()
    print(_c("  ◆ 采样断档追踪（原始断档信息永不抹掉）", C.BOLD))
    print(f"    原始断档 未补录: {counters['原始断档_未补']:>4}  行   （--gap-pending 筛）")
    print(f"    原始断档 已补录: {counters['原始断档_已补']:>4}  行   （--gap-filled  筛）")
    print(f"    原始断档 合计  : {counters['原始断档_未补'] + counters['原始断档_已补']:>4}  行   （--had-gap     筛）")
    print()

    # 明细
    print(_c("  ◆ 回放明细（后补备注跟在结果旁；⚑ 表示该行曾经断档过，可溯源）", C.BOLD))
    print("  ┌─┬─────┬──────────────┬──────────┬──────────┬────────────┬──────────┬──────────────────────────────────────┐")
    print("  │溯│行号 │ 工单号       │ 管线号   │ 采样点   │ 材料值     │ 当前结论 │ 处理状态 + 说明 + 后补备注            │")
    print("  ├─┼─────┼──────────────┼──────────┼──────────┼────────────┼──────────┼──────────────────────────────────────┤")
    for ln in session.lines:
        mv = ln.material_value or _c("(断档)", C.MAGENTA)
        concl_color = C.GREEN if ln.current_conclusion == WorkOrderConclusion.PASS.value else (
            C.YELLOW if ln.current_conclusion == WorkOrderConclusion.PENDING.value else C.RED
        )
        status_cell = _c(ln.status, _status_color(ln.status))
        trace_tag = _c("⚑", C.MAGENTA + C.BOLD) if getattr(ln, "original_has_gap", False) else " "
        reason_and_remark = ln.status_reason or ""
        # 嵌入后补备注
        for rmk in ln.remarks:
            reason_and_remark += f"\n  💬 [{rmk.get('remark_type')}/{rmk.get('shift')}] {rmk.get('author')}: {rmk.get('content')}"
        reason_and_remark_wrapped = _wrap(reason_and_remark, 38)
        first_line_reason = reason_and_remark_wrapped.split("\n")[0] if reason_and_remark_wrapped else ""
        other_lines = reason_and_remark_wrapped.split("\n")[1:] if reason_and_remark_wrapped else []

        print(f"  │{trace_tag}│ {ln.line_no:>3} │ {ln.work_order_id:<12} │ {ln.pipeline_id:<8} │ {ln.sample_point:<8} │ {str(mv):>10} │ {_c(ln.current_conclusion, concl_color):<8} │ {status_cell} {first_line_reason:<32} │")
        for extra in other_lines:
            print(f"  │ │     │              │          │          │            │          │     {extra:<36} │")
    print("  └─┴─────┴──────────────┴──────────┴──────────┴────────────┴──────────┴──────────────────────────────────────┘")

    print()
    print(_c(f"  ◆ 会话 ID 保存：{session.session_id}", C.BLUE))
    print(_c(f"    下一手操作（从筛选 → 详情 → 导出 全链路可追）：", C.BOLD))
    print(_c(f"      所有曾断档（最常用）→  python -m factory_pipeline_replay.cli filter --session {session.session_id} --had-gap", C.CYAN))
    print(_c(f"      仅未补的断档       →  python -m factory_pipeline_replay.cli filter --session {session.session_id} --gap-pending", C.CYAN))
    print(_c(f"      已补完的断档       →  python -m factory_pipeline_replay.cli filter --session {session.session_id} --gap-filled", C.CYAN))
    print(_c(f"      看某行详情         →  python -m factory_pipeline_replay.cli detail --session {session.session_id} --line <行号>", C.CYAN))
    print(_c(f"      补录并改判         →  python -m factory_pipeline_replay.cli fill --session {session.session_id} --line <行号> --material <值> ...", C.CYAN))
    print(_c(f"      导出复核表         →  python -m factory_pipeline_replay.cli export --session {session.session_id} --out <路径>", C.CYAN))
    print(_c(f"      经理汇总图         →  python -m factory_pipeline_replay.cli report --session {session.session_id}", C.CYAN))
    print()
    return 0


# ---------- 命令：list ----------
def cmd_list(args: argparse.Namespace) -> int:
    sessions = storage.list_sessions()
    if not sessions:
        print(_c("还没有回放会话。先跑 replay 命令。", C.YELLOW))
        return 0
    print(_c("  会话 ID                     开始时间            操作人   班组  总行数 已处理 跳过  坏行  待补  改判  材料文件", C.BOLD))
    print("  " + "-" * 120)
    for s in sessions:
        lines = s.get("lines", [])
        total = len(lines)
        c = {"已处理": 0, "跳过行": 0, "坏行": 0, "待补材料": 0, "人工改判": 0}
        for ln in lines:
            if ln.get("status") == LineStatus.PROCESSED.value: c["已处理"] += 1
            elif ln.get("status") == LineStatus.SKIPPED.value: c["跳过行"] += 1
            elif ln.get("status") == LineStatus.BAD.value: c["坏行"] += 1
            elif ln.get("status") == LineStatus.PENDING_MATERIAL.value: c["待补材料"] += 1
            if ln.get("is_manual_judged"): c["人工改判"] += 1
        src = os.path.basename(s.get("source_file", "")) or "-"
        print(f"  {s.get('session_id'):<27} {s.get('started_at'):<19} {s.get('operator','-'):<7} {s.get('shift','-'):<4} {total:>4}  {c['已处理']:>4} {c['跳过行']:>4} {c['坏行']:>4} {c['待补材料']:>4} {c['人工改判']:>4}  {src}")
    return 0


# ---------- 命令：filter ----------
def cmd_filter(args: argparse.Namespace) -> int:
    sess = storage.load_session(args.session)
    if not sess:
        print(_c(f"找不到会话 {args.session}", C.RED))
        return 2
    kwargs: Dict[str, Any] = {}
    if args.status:
        kwargs["status"] = args.status
    # 三种断档筛选（互斥优先级：had-gap > gap-pending > gap-filled > has-gap）
    if args.had_gap:
        # 所有曾经断档过的行：未补 + 已补 均命中（复核人最常用）
        kwargs["original_has_gap"] = True
    elif args.gap_pending:
        # 只看仍未补的断档行：原始断档 + 当前仍断档
        kwargs["original_has_gap"] = True
        kwargs["has_gap"] = True
    elif args.gap_filled:
        # 已补录完成的断档行：原始断档 + 已补录
        kwargs["original_has_gap"] = True
        kwargs["is_material_filled"] = True
    elif args.has_gap:
        # 兼容旧参数：等价于 gap-pending
        kwargs["original_has_gap"] = True
        kwargs["has_gap"] = True
    if args.manual:
        kwargs["is_manual_judged"] = True
    if args.work_order:
        kwargs["work_order_id"] = args.work_order
    if args.line:
        kwargs["line_no"] = args.line
    results = engine.filter_lines(sess, **kwargs)
    filter_note = ""
    if args.had_gap: filter_note = "（所有曾有采样断档的行：未补 + 已补）"
    elif args.gap_pending or args.has_gap: filter_note = "（仍待补的断档行）"
    elif args.gap_filled: filter_note = "（已补录的断档行）"
    print(_c(f"  筛选条件命中 {len(results)} 行{filter_note}（从筛选 → 详情 → 导出 都能追到每条）", C.BOLD))
    for ln in results:
        mv = ln.get("material_value") or _c("(断档)", C.MAGENTA)
        status = _c(ln.get("status"), _status_color(ln.get("status")))
        tags = []
        if ln.get("original_has_gap"): tags.append("⚑断档溯源")
        if ln.get("has_gap"): tags.append("⚠待补")
        if ln.get("is_material_filled"): tags.append("✔已补")
        if ln.get("is_manual_judged"): tags.append("✎改判")
        tag_str = " ".join(_c(t, C.YELLOW) for t in tags)
        reason = _wrap(ln.get("status_reason", ""), 60)
        print(f"    行{ln.get('line_no'):>3} │ {ln.get('work_order_id'):<12} │ {ln.get('pipeline_id'):<8} │ 材料={mv:<8} │ 结论={ln.get('current_conclusion'):<4} │ {status} {tag_str}")
        # 原始断档信息：只要原始有断档，就单独展示一行，不被补录抹掉
        if ln.get("original_has_gap"):
            print(f"           🔍 原始断档：{ln.get('original_gap_detail') or '采样值缺失'}")
            if ln.get("is_material_filled"):
                print(f"           🔍 补录信息：值={ln.get('filled_material')} 人={ln.get('filled_by')} 时间={ln.get('filled_at')}")
                if ln.get("filled_reason"):
                    print(f"           🔍 补录原因：{ln.get('filled_reason')}")
        if reason:
            print(f"           原因：{reason}")
        if ln.get("remarks"):
            for r in ln["remarks"]:
                print(f"           💬 [{r.get('remark_type')}] {r.get('author')}: {r.get('content')}")
    print()
    if args.had_gap or args.gap_pending or args.gap_filled or args.has_gap:
        print(_c(f"  断档追踪提示：挑一个行号，用 detail --session {args.session} --line <行号> 可看原始断档+补录+改判完整链路。", C.CYAN))
    return 0


# ---------- 命令：detail ----------
def cmd_detail(args: argparse.Namespace) -> int:
    sess = storage.load_session(args.session)
    if not sess:
        print(_c(f"找不到会话 {args.session}", C.RED))
        return 2
    detail = engine.line_detail(sess, args.line)
    if not detail:
        print(_c(f"会话 {args.session} 里没有行号 {args.line}", C.RED))
        return 2

    print(_c(f"{'='*70}", C.BLUE))
    print(_c(f"  回放行详情  行号 {args.line}   会话 {args.session}", C.BOLD + C.CYAN))
    print(_c(f"{'='*70}", C.BLUE))
    base_fields = [
        "work_order_id","pipeline_id","sample_point","sample_time","material_value",
        "original_conclusion","current_conclusion","status","status_reason",
    ]
    gap_fields = [
        "original_has_gap","original_gap_detail",
        "has_gap","gap_detail",
    ]
    fill_fields = [
        "is_material_filled","filled_material","filled_by","filled_at","filled_reason",
    ]
    judge_fields = ["is_manual_judged","manual_judge_reason"]

    label_map = {
        "work_order_id":"工单号","pipeline_id":"管线号","sample_point":"采样点",
        "sample_time":"采样时间","material_value":"材料值",
        "original_conclusion":"原始结论","current_conclusion":"当前结论",
        "status":"处理状态","status_reason":"状态说明",
        "original_has_gap":"原始是否断档（永不改变）",
        "original_gap_detail":"原始断档说明（永不改变）",
        "has_gap":"当前是否仍待补（断档未补）",
        "gap_detail":"当前断档说明",
        "is_material_filled":"是否已补录材料",
        "filled_material":"补录材料值",
        "filled_by":"补录操作人",
        "filled_at":"补录时间",
        "filled_reason":"补录原因",
        "is_manual_judged":"是否人工改判",
        "manual_judge_reason":"改判原因",
    }
    for sec_name, fields in [("基础信息", base_fields),
                               ("采样断档追踪（原始信息永不抹掉）", gap_fields),
                               ("补录信息（后续处理）", fill_fields),
                               ("改判信息", judge_fields)]:
        print(_c(f"  ─ {sec_name}", C.DIM))
        for k in fields:
            v = detail.get(k)
            if isinstance(v, bool): v = "是" if v else "否"
            if v is None or v == "": v = _c("（空）", C.DIM)
            print(f"  {label_map.get(k, k):<22}: {v}")

    # 关联交接
    if detail.get("handover"):
        h = detail["handover"]
        print()
        print(_c("  ◆ 关联班组交接（知道上一班改了什么）", C.BOLD))
        print(f"    日期    : {h.get('date')}")
        print(f"    交班    : {h.get('from_shift')} {h.get('from_operator')} → {h.get('to_shift')} {h.get('to_operator')}")
        print(f"    交接摘要: {_wrap(h.get('summary',''), 60)}")
        print(f"    本班改动行: {h.get('changed_line_nos')}")
        for r in h.get("remarks", []):
            print(f"    💬 [{r.get('remark_type')}/{r.get('shift')}] {r.get('author')}@{r.get('created_at')}: {r.get('content')}")

    # 改判历史（补录前后对比留痕）
    hist = detail.get("rejudge_histories") or detail.get("history_snapshots") or []
    if hist:
        print()
        print(_c("  ◆ 补录 & 改判历史（旧材料 / 新备注 / 改判原因 都留痕）", C.BOLD))
        for i, h in enumerate(hist, 1):
            print(f"    [{i}] {h.get('rejudge_time')}  操作人 {h.get('operator')}")
            print(f"        旧材料: {h.get('old_material') or '(空/断档)'}   →   新材料: {h.get('new_material')}")
            print(f"        旧结论: {h.get('old_conclusion')}   →   新结论: {h.get('new_conclusion')}")
            print(f"        改判原因: {h.get('reason')}")
            if h.get("new_remark"):
                print(f"        新备注  : {h.get('new_remark')}")
    else:
        print(_c("  （尚无改判历史）", C.DIM))

    # 后补备注
    if detail.get("remarks"):
        print()
        print(_c("  ◆ 本条的后补备注（已内嵌到结果旁）", C.BOLD))
        for r in detail["remarks"]:
            print(f"    💬 [{r.get('remark_type')}/{r.get('shift')}] {r.get('author')}@{r.get('created_at')}: {r.get('content')}")
    print()
    return 0


# ---------- 命令：fill ----------
def cmd_fill(args: argparse.Namespace) -> int:
    ok, msg, hist = engine.fill_material_and_rejudge(
        session_id=args.session,
        line_no=args.line,
        new_material=args.material,
        operator=args.operator,
        reason=args.reason,
        remark_content=args.remark,
    )
    if not ok:
        print(_c(f"[异常出口] {msg}", C.RED))
        print(_c("排查：先用 detail --line 看该行当前状态，再决定是否补录。", C.DIM))
        return 2
    print(_c(f"✓ {msg}", C.GREEN))
    if hist:
        print(_c("  改判已留痕：", C.BOLD))
        print(f"    旧材料: {hist.old_material or '(空/断档)'}   →   新材料: {hist.new_material}")
        print(f"    旧结论: {hist.old_conclusion}   →   新结论: {hist.new_conclusion}")
        print(f"    改判原因: {hist.reason}")
        if hist.new_remark:
            print(f"    新备注  : {hist.new_remark}")
        print(_c(f"  查看详情：python -m factory_pipeline_replay.cli detail --session {args.session} --line {args.line}", C.CYAN))
    return 0


# ---------- 命令：export ----------
def cmd_export(args: argparse.Namespace) -> int:
    sess = storage.load_session(args.session)
    if not sess:
        print(_c(f"找不到会话 {args.session}", C.RED))
        return 2
    csv_text = engine.export_to_csv(sess)
    out_path = args.out or f"export_{args.session}.csv"
    with open(out_path, "w", encoding="utf-8-sig") as f:
        f.write(csv_text)
    lines = csv_text.count("\n")
    print(_c(f"✓ 已导出 {lines} 行到 {out_path}", C.GREEN))
    print(_c("  导出列包含：后补备注、改判历史、关联交接 — 复核人从筛选→详情→导出全程可追溯。", C.DIM))
    return 0


# ---------- 命令：report（项目经理视图：已处理 / 断档未补 / 断档已补 / 人工改判 四栏） ----------
def cmd_report(args: argparse.Namespace) -> int:
    sess = storage.load_session(args.session)
    if not sess:
        print(_c(f"找不到会话 {args.session}", C.RED))
        return 2

    lines = sess.get("lines", [])
    processed = [l for l in lines if l.get("status") == LineStatus.PROCESSED.value]
    gap_pending = [l for l in lines
                   if l.get("original_has_gap") and (not l.get("is_material_filled"))]  # 未补
    gap_filled = [l for l in lines
                  if l.get("original_has_gap") and l.get("is_material_filled")]    # 已补
    judged = [l for l in lines if l.get("is_manual_judged")]

    def _short(ln: Dict[str, Any]) -> str:
        tags = []
        if ln.get("original_has_gap"): tags.append("断档")
        if ln.get("original_has_gap") and (not ln.get("is_material_filled")): tags.append("未补")
        if ln.get("is_material_filled"): tags.append("已补")
        if ln.get("is_manual_judged"): tags.append("改判")
        mv = ln.get("material_value") or "(空)"
        tag = f" [{','.join(tags)}]" if tags else ""
        return f"行{ln['line_no']:<3} {ln['work_order_id']} {ln['pipeline_id']} 材={mv:<6} 结论={ln['current_conclusion']}{tag}"

    W = 42
    def _box(title: str, items: List[str], color: str) -> List[str]:
        rows = []
        rows.append(_c("┌" + "─"*(W-2) + "┐", color))
        rows.append(_c("│ " + f"{title}（共 {len(items)} 条）".ljust(W-4) + " │", color + C.BOLD))
        rows.append(_c("├" + "─"*(W-2) + "┤", color))
        if not items:
            rows.append(_c("│ " + "（无）".ljust(W-4) + " │", C.DIM))
        else:
            for it in items:
                for sub in textwrap.wrap(it, width=W-4) or [""]:
                    rows.append(_c("│ " + sub.ljust(W-4) + " │", color))
        rows.append(_c("└" + "─"*(W-2) + "┘", color))
        return rows

    col1 = _box("① 已处理记录", [_short(l) for l in processed], C.GREEN)
    col2 = _box("② 采样断档·未补", [_short(l) for l in gap_pending], C.MAGENTA)
    col3 = _box("③ 采样断档·已补（含改判）", [_short(l) for l in gap_filled], C.YELLOW)
    col4 = _box("④ 人工改判", [_short(l) for l in judged], C.CYAN)

    max_rows = max(len(col1), len(col2), len(col3), len(col4))
    def pad(col, n):
        return col + [" "*(W)]*(n-len(col))
    col1, col2, col3, col4 = pad(col1, max_rows), pad(col2, max_rows), pad(col3, max_rows), pad(col4, max_rows)

    total_gap = len(gap_pending) + len(gap_filled)
    print()
    print(_c(f"{'='*(W*4+6)}", C.BLUE))
    title = f"  工厂管线工单回放 · 项目经理汇总视图（四栏）  会话 {args.session}"
    print(_c(title.ljust(W*4+4), C.BOLD + C.CYAN))
    print(_c(f"  操作人：{sess.get('operator','-')}   班组：{sess.get('shift','-')}   材料：{os.path.basename(sess.get('source_file','-'))}   时间：{sess.get('started_at','-')}", C.DIM))
    print(_c(f"  采样断档追踪合计：{total_gap} 条 —— 未补 {len(gap_pending)} 条 / 已补 {len(gap_filled)} 条（改判 {len(judged)} 条）", C.MAGENTA + C.BOLD))
    print(_c(f"{'='*(W*4+6)}", C.BLUE))
    for a, b, c_, d in zip(col1, col2, col3, col4):
        print(f"  {a}  {b}  {c_}  {d}")
    print()
    print(_c("  【底部总说明 · 截图交付用】", C.BOLD))
    print(_c("  ① 已处理记录：原始数据正常、无需补录、结论由阈值自动判定的行。", C.DIM))
    print(_c("  ② 采样断档·未补：原始回放时材料值缺失（采样断档）、截止目前仍未补录的行，下一班组需优先处理。", C.DIM))
    print(_c("  ③ 采样断档·已补（含改判）：原始断档但已执行 fill 补录的行，保留原始断档信息+补录值+补录人+补录时间+补录原因。", C.DIM))
    print(_c("  ④ 人工改判：补录后结论与原始结论不一致的行，旧材料/新材料/旧结论/新结论/改判原因全量留痕，detail 可展开历史。", C.DIM))
    print(_c("  * 任意断档行的完整追踪链路：filter --had-gap 筛 → detail --line N 查（原始断档+补录+改判+备注+交接） → export 导出 CSV 给复核人。", C.DIM))
    print()
    return 0


# ---------- 命令：handover ----------
def cmd_handover(args: argparse.Namespace) -> int:
    import uuid
    record = HandoverRecord(
        handover_id="HO-" + datetime.now().strftime("%Y%m%d%H%M%S"),
        date=args.date,
        from_shift=args.from_shift,
        from_operator=args.from_operator,
        to_shift=args.to_shift,
        to_operator=args.to_operator,
        handover_time=datetime.now().isoformat(timespec="seconds"),
        summary=args.summary,
        changed_line_nos=[int(x) for x in args.changed_lines.split(",") if x.strip()] if args.changed_lines else [],
    )
    # 如果给了后补备注，挂到交接记录上，回放时会嵌入对应行
    if args.remark_line and args.remark_text:
        rmk = Remark(
            remark_id="RMK-" + uuid.uuid4().hex[:8],
            author=args.from_operator,
            shift=args.from_shift,
            created_at=datetime.now().isoformat(timespec="seconds"),
            content=args.remark_text,
            attached_to_line_no=int(args.remark_line),
            remark_type="交接后补备注",
        )
        record.remarks.append(storage.to_dict(rmk))
    storage.save_handover(record)
    print(_c(f"✓ 班组交接记录已保存：{record.handover_id}", C.GREEN))
    print(f"  {record.from_shift} {record.from_operator} → {record.to_shift} {record.to_operator}")
    print(f"  改动行号：{record.changed_line_nos or '(未填)'}")
    if record.remarks:
        for r in record.remarks:
            print(f"  💬 后补备注绑定到行{r.get('attached_to_line_no')}: {r.get('content')}")
    print(_c("  下次 replay 时，本班改动的行会在说明栏提示上一班有谁改了什么。", C.DIM))
    return 0


# ---------- main ----------
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="factory_pipeline_replay",
        description=("工厂管线工单回放 CLI：坏行/跳过行/已处理行 分开统计，"
                     "班组交接后补备注嵌入结果旁，采样断档全链路追踪，"
                     "补录改判留痕（旧材料/新备注/改判原因），以及项目经理三栏汇总截图。"),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
        新手快速开始：
          ① 先准备 CSV（列：工单号,管线号,采样点,采样时间,材料值）
          ② replay --file xxx.csv  → 会打印分类统计+明细+下一手命令提示
          ③ 看到待补材料 → fill 补录；看到坏行 → detail 看原因
          ④ 结束前跑 report → 截图三栏视图给项目经理
        """),
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    # replay
    pr = sub.add_parser("replay", help="回放一份 CSV 工单材料（入口最常用）")
    pr.add_argument("--file", required=True, help="CSV 路径。列名需含【工单号、管线号、采样点、采样时间、材料值】")
    pr.add_argument("--operator", default="", help="操作人，例如：小宋")
    pr.add_argument("--shift", default="", help="班组：早班/中班/晚班")
    pr.set_defaults(func=cmd_replay)

    # list
    pl = sub.add_parser("list", help="列出所有回放会话")
    pl.set_defaults(func=cmd_list)

    # filter
    pf = sub.add_parser("filter", help="按条件筛选回放行（从筛选 → 详情 → 导出）")
    pf.add_argument("--session", required=True, help="会话 ID（从 list 里看）")
    pf.add_argument("--status", choices=[v.value for v in LineStatus], help="按处理状态筛")
    pf.add_argument("--has-gap", action="store_true",
                    help="(兼容旧参数) 只看仍待补的采样断档行，等价于 --gap-pending")
    pf.add_argument("--had-gap", action="store_true",
                    help="看所有【曾经断档】过的行（未补 + 已补都能追到，复核人最常用）")
    pf.add_argument("--gap-pending", action="store_true",
                    help="只看仍待补材料、尚未补录的断档行")
    pf.add_argument("--gap-filled", action="store_true",
                    help="只看原始断档但已补录材料、已处理完毕的行")
    pf.add_argument("--manual", action="store_true", help="只看人工改判过的行")
    pf.add_argument("--work-order", help="按工单号筛")
    pf.add_argument("--line", type=int, help="按具体行号筛")
    pf.set_defaults(func=cmd_filter)

    # detail
    pd = sub.add_parser("detail", help="查看某行详情：改判历史 + 关联交接 + 后补备注")
    pd.add_argument("--session", required=True)
    pd.add_argument("--line", type=int, required=True, help="行号")
    pd.set_defaults(func=cmd_detail)

    # fill
    pf2 = sub.add_parser("fill", help="给某行补录材料并重新判定（结论变化自动留痕）")
    pf2.add_argument("--session", required=True)
    pf2.add_argument("--line", type=int, required=True)
    pf2.add_argument("--material", required=True, help="补录的新材料值，例如 1.28")
    pf2.add_argument("--operator", required=True, help="补录操作人，例如 小王")
    pf2.add_argument("--reason", required=True, help="改判原因，写清为什么要补/改")
    pf2.add_argument("--remark", default="", help="后补备注，会嵌到该结果旁边")
    pf2.set_defaults(func=cmd_fill)

    # export
    pe = sub.add_parser("export", help="导出复核用 CSV（含断档说明、改判历史、关联交接）")
    pe.add_argument("--session", required=True)
    pe.add_argument("--out", default="", help="输出文件路径")
    pe.set_defaults(func=cmd_export)

    # report
    pr2 = sub.add_parser("report", help="项目经理三栏汇总视图：已处理/待补/人工改判（截图用）")
    pr2.add_argument("--session", required=True)
    pr2.set_defaults(func=cmd_report)

    # handover
    ph = sub.add_parser("handover", help="录入班组交接记录（上一班改了什么要写清楚）")
    ph.add_argument("--date", required=True, help="交接日期 YYYY-MM-DD")
    ph.add_argument("--from-shift", required=True, choices=["早班","中班","晚班"])
    ph.add_argument("--from-operator", required=True, help="交班人")
    ph.add_argument("--to-shift", required=True, choices=["早班","中班","晚班"])
    ph.add_argument("--to-operator", required=True, help="接班人")
    ph.add_argument("--summary", required=True, help="交接摘要：这一班干了啥、有啥要注意")
    ph.add_argument("--changed-lines", default="", help="本班改动的行号，逗号分隔，例如 7,12")
    ph.add_argument("--remark-line", type=int, default=0, help="后补备注绑定到某行号（交接后补备注）")
    ph.add_argument("--remark-text", default="", help="后补备注内容")
    ph.set_defaults(func=cmd_handover)

    return p


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except KeyboardInterrupt:
        print(_c("\n[异常出口] 用户中断。", C.YELLOW))
        return 130
    except Exception as e:
        print(_c(f"[异常出口] 未预期错误：{e}", C.RED))
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
