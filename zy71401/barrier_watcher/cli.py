from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path

from .calendar import fill_observation_calendar, missing_observation_dates
from .engine import BarrierEngine
from .history import HistoryManager
from .models import (
    BarrierDirection,
    BarrierJudgment,
    BarrierType,
    Contract,
    HistoryEntry,
    JudgmentStatus,
    ObservationFreq,
    ObservationPrice,
    Reminder,
)
from .processor import BatchProcessor, format_report
from .reminder import ReminderManager
from .store import Store


def _parse_date(s: str) -> date:
    return date.fromisoformat(s)


def _parse_datetime(s: str) -> datetime:
    return datetime.fromisoformat(s)


def cmd_init(args: argparse.Namespace) -> None:
    store = Store(args.workspace)
    store.init_workspace()
    print(f"工作区已初始化: {args.workspace}")


def cmd_import_contracts(args: argparse.Namespace) -> None:
    store = Store(args.workspace)
    store.init_workspace()
    with open(args.file, "r", encoding="utf-8") as f:
        data = json.load(f)
    contracts = [Contract.from_dict(d) for d in data]
    updated = store.upsert_contracts(contracts)
    print(f"导入合约: {len(updated)} 条")
    for cid in updated:
        print(f"  合约 {cid}")


def cmd_import_conditions(args: argparse.Namespace) -> None:
    store = Store(args.workspace)
    store.init_workspace()
    with open(args.file, "r", encoding="utf-8") as f:
        data = json.load(f)

    count = 0
    for item in data:
        cid = item["contract_id"]
        bt = item.get("barrier_type")
        bl = item.get("barrier_level")
        bd = item.get("barrier_direction")
        od = None
        if "observation_dates" in item and item["observation_dates"]:
            od = [date.fromisoformat(d) for d in item["observation_dates"]]
        c = store.update_barrier_conditions(cid, bt, bl, bd, od)
        if c:
            count += 1
            print(f"  合约 {cid}: 障碍条件已更新")
        else:
            print(f"  合约 {cid}: 未找到，跳过", file=sys.stderr)

    judgments_before = store.load_judgments()
    print(f"更新障碍条件: {count} 条")
    print(f"已有判定未受影响: {len(judgments_before)} 条保留")


def cmd_import_prices(args: argparse.Namespace) -> None:
    store = Store(args.workspace)
    store.init_workspace()
    with open(args.file, "r", encoding="utf-8") as f:
        data = json.load(f)
    prices = [ObservationPrice.from_dict(d) for d in data]
    added = store.add_prices(prices)
    print(f"导入观察价格: 新增 {added} 条, 总计 {len(prices)} 条")


def cmd_process(args: argparse.Namespace) -> None:
    store = Store(args.workspace)
    store.init_workspace()

    report_date = _parse_date(args.date) if args.date else date.today()

    contracts = store.load_contracts()
    prices = store.load_prices()
    existing_judgments = store.load_judgments()
    existing_reminders = store.load_reminders()
    history_entries = store.load_history()

    history_mgr = HistoryManager.from_dicts([e.to_dict() for e in history_entries])

    engine = BarrierEngine(determined_at=datetime.now())
    reminder_mgr = ReminderManager()
    processor = BatchProcessor(
        engine, reminder_mgr, history_mgr,
        timestamp_tolerance_hours=args.ts_tolerance,
    )

    report = processor.process(
        report_date=report_date,
        contracts=list(contracts.values()),
        prices=prices,
        existing_judgments=existing_judgments,
        existing_reminders=existing_reminders,
    )

    store.save_judgments(existing_judgments)
    store.save_contracts(contracts)

    for r in report.new_reminders:
        existing_reminders[r.reminder_id] = r
    store.save_reminders(existing_reminders)

    store.append_history(report.history_entries)

    output = format_report(report)
    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(output, encoding="utf-8")
        print(f"日报已保存: {args.output}")
    else:
        print(output)

    print(f"\n统计: 正常记录 {len(report.normal_records)} | "
          f"问题记录 {len(report.problem_records)} | "
          f"新增提醒 {len(report.new_reminders)} | "
          f"已有提醒 {len(report.existing_reminders)}")


def cmd_status(args: argparse.Namespace) -> None:
    store = Store(args.workspace)
    contracts = store.load_contracts()
    judgments = store.load_judgments()
    prices = store.load_prices()
    reminders = store.load_reminders()

    if args.contract:
        cid = args.contract
        if cid not in contracts:
            print(f"合约 {cid} 不存在", file=sys.stderr)
            return
        c = contracts[cid]
        _print_contract_detail(c, judgments, prices, reminders)
    else:
        for c in contracts.values():
            _print_contract_summary(c, judgments)


def _print_contract_summary(
    c: Contract, judgments: dict[str, BarrierJudgment]
) -> None:
    c_judgments = {
        jid: j for jid, j in judgments.items()
        if j.contract_id == c.contract_id
    }
    breached = sum(1 for j in c_judgments.values() if j.status == JudgmentStatus.BREACHED)
    pending = sum(1 for j in c_judgments.values() if j.status == JudgmentStatus.PENDING)
    ok = sum(1 for j in c_judgments.values() if j.status == JudgmentStatus.NOT_BREACHED)
    manual = sum(1 for j in c_judgments.values() if j.manually_overridden)
    condition_status = "完整" if c.has_barrier_condition else "缺少障碍条件"
    calendar_status = f"{len(c.observation_dates or [])}日" if c.has_observation_calendar else "缺少观察日历"
    print(
        f"合约 {c.contract_id} | 客户 {c.client_id} | 标的 {c.underlying} | "
        f"条件: {condition_status} | 日历: {calendar_status} | "
        f"判定: 正常{ok} 触碰{breached} 待定{pending} 手动{manual}"
    )


def _print_contract_detail(
    c: Contract,
    judgments: dict[str, BarrierJudgment],
    prices: dict[str, list[ObservationPrice]],
    reminders: dict[str, Reminder],
) -> None:
    print(f"合约: {c.contract_id}")
    print(f"  客户: {c.client_id}")
    print(f"  标的: {c.underlying}")
    print(f"  期权类型: {c.option_type}")
    print(f"  期限: {c.start_date} ~ {c.end_date}")
    print(f"  障碍类型: {c.barrier_type.value if c.barrier_type else '未设置'}")
    print(f"  障碍水平: {c.barrier_level if c.barrier_level is not None else '未设置'}")
    print(f"  障碍方向: {c.barrier_direction.value if c.barrier_direction else '未设置'}")

    c_prices = prices.get(c.contract_id, [])
    price_dates = {p.observation_date for p in c_prices}
    missing = missing_observation_dates(c, price_dates)

    print(f"  观察日历: {len(c.observation_dates or [])} 日")
    if missing:
        print(f"  缺少价格的观察日: {', '.join(d.isoformat() for d in missing)}")

    c_judgments = sorted(
        [j for j in judgments.values() if j.contract_id == c.contract_id],
        key=lambda j: j.observation_date,
    )
    print(f"  判定记录: {len(c_judgments)} 条")
    for j in c_judgments:
        override = " [手动覆盖]" if j.manually_overridden else ""
        print(
            f"    {j.observation_date} | {j.status.value}{override} | "
            f"价格={j.price_at_observation} | 水平={j.barrier_level_used}"
        )

    c_reminders = [r for r in reminders.values() if r.contract_id == c.contract_id]
    if c_reminders:
        print(f"  提醒: {len(c_reminders)} 条")
        for r in c_reminders:
            print(f"    {r.event_type.value}: {r.message}")


def cmd_override(args: argparse.Namespace) -> None:
    store = Store(args.workspace)
    store.init_workspace()

    obs_date = _parse_date(args.date)
    result = store.override_judgment(
        contract_id=args.contract,
        observation_date=obs_date,
        new_status=args.status,
        reason=args.reason,
        changed_by=args.user or "manual",
    )

    if result is None:
        print(f"合约 {args.contract} 观察日 {args.date} 无已有判定，无法覆盖", file=sys.stderr)
        return

    history_mgr = HistoryManager()
    history_mgr.record_override(
        old_judgment=result,
        new_status=JudgmentStatus(args.status),
        new_breach_type=result.breach_type,
        changed_by=args.user or "manual",
        reason=args.reason,
    )
    store.append_history(history_mgr.entries)

    print(f"已覆盖: 合约 {args.contract} 观察日 {args.date}")
    print(f"  新状态: {result.status.value}")
    print(f"  原因: {args.reason}")
    print(f"  操作人: {args.user or 'manual'}")


def cmd_export_history(args: argparse.Namespace) -> None:
    store = Store(args.workspace)
    count = store.export_history_csv(args.output)
    print(f"历史已导出: {args.output} ({count} 条)")


def cmd_reminders(args: argparse.Namespace) -> None:
    store = Store(args.workspace)
    reminders = store.load_reminders()
    pending = [r for r in reminders.values() if not r.sent]
    sent = [r for r in reminders.values() if r.sent]

    print(f"提醒汇总: 待发送 {len(pending)} | 已发送 {len(sent)}")
    if pending:
        print("\n[待发送]")
        for r in pending:
            date_str = r.observation_date.isoformat() if r.observation_date else "N/A"
            print(
                f"  ID {r.reminder_id} | 客户 {r.client_id} | "
                f"合约 {r.contract_id} | 观察日 {date_str} | "
                f"类型 {r.event_type.value}"
            )
            print(f"    {r.message}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="barrier-watcher",
        description="期权障碍观察日报工具",
    )
    parser.add_argument(
        "--workspace", "-w",
        default="./barrier_data",
        help="工作区目录 (默认: ./barrier_data)",
    )

    sub = parser.add_subparsers(dest="command", help="子命令")

    p_init = sub.add_parser("init", help="初始化工作区")
    p_init.set_defaults(func=cmd_init)

    p_import = sub.add_parser("import", help="导入数据")
    imp_sub = p_import.add_subparsers(dest="import_type")

    p_contracts = imp_sub.add_parser("contracts", help="导入合约")
    p_contracts.add_argument("--file", "-f", required=True, help="合约JSON文件")
    p_contracts.set_defaults(func=cmd_import_contracts)

    p_conditions = imp_sub.add_parser("conditions", help="补充障碍条件")
    p_conditions.add_argument("--file", "-f", required=True, help="障碍条件JSON文件")
    p_conditions.set_defaults(func=cmd_import_conditions)

    p_prices = imp_sub.add_parser("prices", help="导入观察价格")
    p_prices.add_argument("--file", "-f", required=True, help="观察价格JSON文件")
    p_prices.set_defaults(func=cmd_import_prices)

    p_process = sub.add_parser("process", help="处理并生成日报")
    p_process.add_argument("--date", "-d", help="报告日期 (YYYY-MM-DD)")
    p_process.add_argument("--output", "-o", help="输出文件路径")
    p_process.add_argument(
        "--ts-tolerance", type=int, default=24,
        help="价格时点容差(小时), 默认24",
    )
    p_process.set_defaults(func=cmd_process)

    p_status = sub.add_parser("status", help="查询合约状态")
    p_status.add_argument("--contract", "-c", help="合约ID (不填则列出全部)")
    p_status.set_defaults(func=cmd_status)

    p_override = sub.add_parser("override", help="手动覆盖判定")
    p_override.add_argument("--contract", "-c", required=True, help="合约ID")
    p_override.add_argument("--date", "-d", required=True, help="观察日期")
    p_override.add_argument(
        "--status", "-s", required=True,
        choices=["not_breached", "breached", "pending"],
        help="新判定状态",
    )
    p_override.add_argument("--reason", "-r", required=True, help="覆盖原因")
    p_override.add_argument("--user", "-u", help="操作人")
    p_override.set_defaults(func=cmd_override)

    p_export = sub.add_parser("export-history", help="导出变更历史")
    p_export.add_argument("--output", "-o", required=True, help="输出CSV文件路径")
    p_export.set_defaults(func=cmd_export_history)

    p_reminders = sub.add_parser("reminders", help="查看提醒")
    p_reminders.set_defaults(func=cmd_reminders)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.print_help()
        sys.exit(1)
    args.func(args)


if __name__ == "__main__":
    main()
