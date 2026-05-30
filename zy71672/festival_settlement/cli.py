#!/usr/bin/env python3
import argparse
import os
import sys
from datetime import datetime

from .contract import load_contracts
from .boxoffice import load_boxoffice, load_schedules, aggregate_by_artist
from .sponsor import load_sponsors, calculate_deductions
from .payment import load_payments
from .detector import detect_anomalies
from .settlement import calculate_settlement, explain_variance
from .notes import add_note, extract_notes_from_data
from .report import (
    export_reports, build_summary, format_terminal_summary,
    format_terminal_detail,
)
from .db import Database
from .models import RecordStatus


DEFAULT_DB = os.path.join(os.path.expanduser("~"), ".festival_settlement", "settlement.db")


def cmd_run(args):
    input_dir = os.path.abspath(args.input_dir)
    output_dir = os.path.abspath(args.output_dir)
    db_path = os.path.abspath(args.db) if args.db else DEFAULT_DB

    if not os.path.isdir(input_dir):
        print(f"错误: 输入目录不存在: {input_dir}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    db = Database(db_path)

    try:
        print(f"[1/7] 加载艺人合同 ...")
        contracts = load_contracts(input_dir)
        for c in contracts:
            db.upsert_contract(c)
            if c.notes:
                for n in extract_notes_from_data(
                    {"notes": c.notes}, "contract", c.contract_id
                ):
                    add_note(db, "contract", c.contract_id, n)
        print(f"      共加载 {len(contracts)} 份合同")

        print(f"[2/7] 加载演出时段 ...")
        schedules = load_schedules(input_dir)
        for s in schedules:
            db.upsert_schedule(s)
        print(f"      共加载 {len(schedules)} 条时段")

        print(f"[3/7] 加载票房流水 ...")
        transactions = load_boxoffice(input_dir)
        for t in transactions:
            db.upsert_boxoffice(t)
            if t.notes:
                for n in extract_notes_from_data(
                    {"notes": t.notes}, "boxoffice", t.txn_id
                ):
                    add_note(db, "boxoffice", t.txn_id, n)
        print(f"      共加载 {len(transactions)} 条流水")

        print(f"[4/7] 加载赞助条款 ...")
        sponsors = load_sponsors(input_dir)
        for s in sponsors:
            db.upsert_sponsor(s)
            if s.notes:
                for n in extract_notes_from_data(
                    {"notes": s.notes}, "sponsor", s.sponsor_id
                ):
                    add_note(db, "sponsor", s.sponsor_id, n)
        print(f"      共加载 {len(sponsors)} 条赞助")

        print(f"[5/7] 加载付款记录 ...")
        payments = load_payments(input_dir)
        for p in payments:
            db.upsert_payment(p)
            if p.notes:
                for n in extract_notes_from_data(
                    {"notes": p.notes}, "payment", p.payment_id
                ):
                    add_note(db, "payment", p.payment_id, n)
        print(f"      共加载 {len(payments)} 条付款")

        print(f"[6/7] 票房归集 + 赞助扣款 + 异常检测 ...")
        artist_boxoffice = aggregate_by_artist(transactions, schedules)
        all_artist_ids = list({c.artist_id for c in contracts})
        artist_deductions = calculate_deductions(sponsors, all_artist_ids)
        anomalies = detect_anomalies(contracts, sponsors, artist_boxoffice, artist_deductions)
        for a in anomalies:
            db.upsert_anomaly(a)
        print(f"      票房归集 {len(artist_boxoffice)} 位艺人")
        print(f"      赞助扣款 {len(artist_deductions)} 位艺人")
        print(f"      检测到 {len(anomalies)} 项异常")

        print(f"[7/7] 计算分账 + 导出报告 ...")
        settlements = calculate_settlement(
            contracts, artist_boxoffice, artist_deductions, payments, db,
        )
        for sl in settlements:
            db.upsert_settlement(sl)

        all_notes = db.get_notes()
        result = export_reports(output_dir, settlements, anomalies, all_notes, db)

        summary = build_summary(settlements, anomalies)
        print()
        print(format_terminal_summary(summary))
        print()
        if anomalies:
            print("异常清单:")
            for a in anomalies:
                marker = "[!]" if a.severity == "error" else "[?]"
                print(f"  {marker} {a.anomaly_type}: {a.description}")
            print()

        print(format_terminal_detail(settlements))
        print()

        print("导出文件:")
        for key, path in result.items():
            if key != "summary":
                print(f"  {key}: {path}")

    finally:
        db.close()


def cmd_status(args):
    db_path = os.path.abspath(args.db) if args.db else DEFAULT_DB
    if not os.path.isfile(db_path):
        print("尚未初始化数据库，请先运行 run 命令", file=sys.stderr)
        sys.exit(1)

    db = Database(db_path)
    try:
        settlements = db.get_settlements()
        anomalies = db.get_anomalies(resolved=False)

        if settlements:
            summary = build_summary(settlements, anomalies)
            print(format_terminal_summary(summary))
            print()
            print(format_terminal_detail(settlements))
        else:
            print("数据库中暂无分账记录")

        if anomalies:
            print()
            print(f"未解决异常 ({len(anomalies)}):")
            for a in anomalies:
                marker = "[!]" if a.severity == "error" else "[?]"
                print(f"  {marker} {a.anomaly_type}: {a.description}")
    finally:
        db.close()


def cmd_confirm(args):
    db_path = os.path.abspath(args.db) if args.db else DEFAULT_DB
    db = Database(db_path)
    try:
        settlement = db.get_settlement(args.settlement_id)
        if not settlement:
            print(f"未找到分账记录: {args.settlement_id}", file=sys.stderr)
            sys.exit(1)
        db.update_settlement_status(args.settlement_id, RecordStatus.CONFIRMED)
        if args.note:
            add_note(db, "settlement", args.settlement_id, args.note, author="user")
        print(f"已确认: {args.settlement_id}")
    finally:
        db.close()


def cmd_reject(args):
    db_path = os.path.abspath(args.db) if args.db else DEFAULT_DB
    db = Database(db_path)
    try:
        settlement = db.get_settlement(args.settlement_id)
        if not settlement:
            print(f"未找到分账记录: {args.settlement_id}", file=sys.stderr)
            sys.exit(1)
        db.update_settlement_status(args.settlement_id, RecordStatus.REJECTED)
        if args.note:
            add_note(db, "settlement", args.settlement_id, args.note, author="user")
        print(f"已退回: {args.settlement_id}")
    finally:
        db.close()


def cmd_note(args):
    db_path = os.path.abspath(args.db) if args.db else DEFAULT_DB
    db = Database(db_path)
    try:
        note = add_note(
            db, args.entity_type, args.entity_id, args.content, author="user",
        )
        print(f"备注已添加: {note.note_id}")
    finally:
        db.close()


def cmd_resolve_anomaly(args):
    db_path = os.path.abspath(args.db) if args.db else DEFAULT_DB
    db = Database(db_path)
    try:
        db.resolve_anomaly(args.anomaly_id, resolution_note=args.note or "")
        print(f"异常已解决: {args.anomaly_id}")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        prog="festival-settlement",
        description="音乐节艺人分账表 - 保底·票房分成·赞助扣款统一核算",
    )
    parser.add_argument("--db", default=None, help=f"数据库路径 (默认: {DEFAULT_DB})")

    sub = parser.add_subparsers(dest="command", help="子命令")

    run_p = sub.add_parser("run", help="执行完整分账流程")
    run_p.add_argument("input_dir", help="输入数据目录")
    run_p.add_argument("output_dir", help="输出报告目录")

    sub.add_parser("status", help="查看当前分账状态")

    confirm_p = sub.add_parser("confirm", help="确认分账记录")
    confirm_p.add_argument("settlement_id", help="分账记录ID")
    confirm_p.add_argument("--note", default="", help="确认备注")

    reject_p = sub.add_parser("reject", help="退回分账记录")
    reject_p.add_argument("settlement_id", help="分账记录ID")
    reject_p.add_argument("--note", default="", help="退回备注")

    note_p = sub.add_parser("note", help="添加人工备注")
    note_p.add_argument("entity_type", help="实体类型 (contract/boxoffice/sponsor/payment/settlement)")
    note_p.add_argument("entity_id", help="实体ID")
    note_p.add_argument("content", help="备注内容")

    resolve_p = sub.add_parser("resolve", help="解决异常")
    resolve_p.add_argument("anomaly_id", help="异常ID")
    resolve_p.add_argument("--note", default="", help="解决说明")

    args = parser.parse_args()

    if args.command == "run":
        cmd_run(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "confirm":
        cmd_confirm(args)
    elif args.command == "reject":
        cmd_reject(args)
    elif args.command == "note":
        cmd_note(args)
    elif args.command == "resolve":
        cmd_resolve_anomaly(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
