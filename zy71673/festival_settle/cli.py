import argparse
import os
import sys
import glob as glob_mod
from datetime import datetime
from typing import List, Optional

from .db import Database
from .parsers import (
    parse_contracts, parse_box_office, parse_sponsors, parse_payments,
    classify_file
)
from .engine import calculate_settlements
from .reporter import generate_reports, print_terminal_summary
from .models import RecordStatus, PipelineStage, PipelineState


def now_iso() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def load_input_files(input_dir: str, db: Database, now: str) -> dict:
    stats = {"contracts": 0, "box_office": 0, "sponsors": 0, "payments": 0, "skipped": 0}
    csv_files = sorted(
        glob_mod.glob(os.path.join(input_dir, "*.csv"))
        + glob_mod.glob(os.path.join(input_dir, "*.CSV"))
    )

    if not csv_files:
        print(f"  ⚠  输入目录 {input_dir} 未找到 CSV 文件")
        return stats

    for filepath in csv_files:
        filename = os.path.basename(filepath)
        table = classify_file(filename)

        if table is None:
            stats["skipped"] += 1
            print(f"    跳过未识别文件: {filename}")
            continue

        print(f"    解析: {filename} → {table}")

        try:
            if table == "contracts":
                records = parse_contracts(filepath, now)
                for r in records:
                    if not db.hash_exists("contracts", r.content_hash):
                        db.insert_contract(r)
                        stats["contracts"] += 1
            elif table == "box_office":
                records = parse_box_office(filepath, now)
                for r in records:
                    if not db.hash_exists("box_office", r.content_hash):
                        db.insert_box_office(r)
                        stats["box_office"] += 1
            elif table == "sponsors":
                records = parse_sponsors(filepath, now)
                for r in records:
                    if not db.hash_exists("sponsors", r.content_hash):
                        db.insert_sponsor(r)
                        stats["sponsors"] += 1
            elif table == "payments":
                records = parse_payments(filepath, now)
                for r in records:
                    if not db.hash_exists("payments", r.content_hash):
                        db.insert_payment(r)
                        stats["payments"] += 1
        except Exception as e:
            print(f"    ✗ 解析失败 {filename}: {e}")

    return stats


def run_pipeline(input_dir: str, output_dir: str, force: bool = False):
    now = now_iso()
    os.makedirs(output_dir, exist_ok=True)

    db = Database(output_dir)
    db.connect()

    try:
        print(f"\n▶ 音乐节艺人分账表 — 开始处理")
        print(f"  输入目录: {input_dir}")
        print(f"  输出目录: {output_dir}")
        print(f"  时间: {now}\n")

        print("  [1/5] 加载输入文件...")
        stats = load_input_files(input_dir, db, now)
        print(
            f"    合同: {stats['contracts']}  "
            f"票房: {stats['box_office']}  "
            f"赞助: {stats['sponsors']}  "
            f"付款: {stats['payments']}  "
            f"跳过: {stats['skipped']}"
        )

        contracts = db.get_contracts()
        box_office = db.get_box_office()
        sponsors = db.get_sponsors()
        payments = db.get_payments()

        if not contracts:
            print("\n  ⚠  无合同数据，无法继续分账。请检查输入目录。")
            return

        print("  [2/5] 票房归集...")
        for c in contracts:
            state = db.get_pipeline_state(c.artist_name)
            if not state or state.stage.value < PipelineStage.BOX_OFFICE_COLLECTED.value:
                db.upsert_pipeline_state(PipelineState(
                    artist_name=c.artist_name,
                    stage=PipelineStage.BOX_OFFICE_COLLECTED,
                    status=RecordStatus.PROVISIONAL,
                    updated_at=now,
                ))
        print(f"    已归集 {len(box_office)} 条票房记录")

        print("  [3/5] 付款匹配...")
        dup_count = 0
        from .engine import detect_duplicate_guarantees
        dups = detect_duplicate_guarantees(payments)
        dup_count = sum(len(v) for v in dups.values())
        for c in contracts:
            state = db.get_pipeline_state(c.artist_name)
            if state and state.stage.value < PipelineStage.PAYMENT_MATCHED.value:
                db.upsert_pipeline_state(PipelineState(
                    artist_name=c.artist_name,
                    stage=PipelineStage.PAYMENT_MATCHED,
                    status=RecordStatus.PROVISIONAL,
                    updated_at=now,
                ))
        if dup_count:
            print(f"    ⚠  发现 {dup_count} 笔保底重复付款")
        print(f"    已匹配 {len(payments)} 条付款记录")

        print("  [4/5] 分账计算...")
        if force:
            db.clear_provisional_settlements()
        settlements, issues_log = calculate_settlements(
            contracts, box_office, sponsors, payments, now
        )
        for s in settlements:
            db.upsert_settlement(s)
            db.upsert_pipeline_state(PipelineState(
                artist_name=s.artist_name,
                stage=PipelineStage.SETTLEMENT_CALCULATED,
                status=s.status,
                updated_at=now,
            ))
        print(f"    生成 {len(settlements)} 条分账记录")
        if issues_log:
            print(f"    ⚠  发现 {len(issues_log)} 个异常")

        print("  [5/5] 报告导出...")
        all_settlements = db.get_settlements()
        reports = generate_reports(all_settlements, issues_log, output_dir)
        print(f"    明细报告: {reports['detail']}")
        print(f"    异常清单: {reports['issues']}")

        for c in contracts:
            db.upsert_pipeline_state(PipelineState(
                artist_name=c.artist_name,
                stage=PipelineStage.REPORT_EXPORTED,
                status=RecordStatus.PROVISIONAL,
                updated_at=now,
            ))

        print(f"\n✓ 处理完成\n")

    finally:
        db.close()


def show_status(output_dir: str, artist: Optional[str] = None):
    db = Database(output_dir)
    db.connect()
    try:
        states = db.get_all_pipeline_states()
        if not states:
            print("  暂无处理记录。请先运行 run 命令。")
            return

        if artist:
            states = [s for s in states if s.artist_name == artist]

        print("\n  管线状态:")
        print(f"  {'艺人':<14} {'阶段':<20} {'状态':<8} {'更新时间'}")
        print(f"  {'─'*14} {'─'*20} {'─'*8} {'─'*20}")
        stage_names = {
            "contract_parsed": "合同已解析",
            "box_office_collected": "票房已归集",
            "payment_matched": "付款已匹配",
            "settlement_calculated": "分账已计算",
            "report_exported": "报告已导出",
        }
        status_names = {
            "provisional": "暂存",
            "confirmed": "已确认",
            "rejected": "已退回",
        }
        for s in states:
            stage_name = stage_names.get(s.stage.value, s.stage.value)
            status_name = status_names.get(s.status.value, s.status.value)
            print(f"  {s.artist_name:<14} {stage_name:<20} {status_name:<8} {s.updated_at}")

        settlements = db.get_settlements()
        if artist:
            settlements = [s for s in settlements if s.artist_name == artist]
        if settlements:
            print(f"\n  分账记录 ({len(settlements)} 条):")
            confirmed = sum(1 for s in settlements if s.status == RecordStatus.CONFIRMED)
            provisional = sum(1 for s in settlements if s.status == RecordStatus.PROVISIONAL)
            rejected = sum(1 for s in settlements if s.status == RecordStatus.REJECTED)
            print(f"    已确认: {confirmed}  |  暂存: {provisional}  |  已退回: {rejected}")
        print()

    finally:
        db.close()


def update_status(output_dir: str, artist: str, action: str, slot: str = ""):
    db = Database(output_dir)
    db.connect()
    try:
        now = now_iso()
        if action == "confirm":
            db.update_settlement_status(artist, slot, RecordStatus.CONFIRMED, now)
            print(f"  ✓ 艺人 {artist} (时段: {slot or '*'}) 分账已确认")
        elif action == "reject":
            db.update_settlement_status(artist, slot, RecordStatus.REJECTED, now)
            print(f"  ✗ 艺人 {artist} (时段: {slot or '*'}) 分账已退回")
        elif action == "reset":
            db.update_settlement_status(artist, slot, RecordStatus.PROVISIONAL, now)
            print(f"  ↺ 艺人 {artist} (时段: {slot or '*'}) 分账已重置为暂存")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        prog="festival-settle",
        description="音乐节艺人分账表 — 保底/分成/赞助统一核算",
    )
    sub = parser.add_subparsers(dest="command", help="子命令")

    run_p = sub.add_parser("run", help="运行分账管线")
    run_p.add_argument("-i", "--input", required=True, help="输入目录（含CSV文件）")
    run_p.add_argument("-o", "--output", required=True, help="输出目录（报告+数据库）")
    run_p.add_argument("--force", action="store_true", help="强制重新计算暂存记录")

    status_p = sub.add_parser("status", help="查看管线状态")
    status_p.add_argument("-o", "--output", required=True, help="输出目录（数据库所在）")
    status_p.add_argument("-a", "--artist", default=None, help="指定艺人")

    confirm_p = sub.add_parser("confirm", help="确认艺人分账")
    confirm_p.add_argument("-o", "--output", required=True, help="输出目录")
    confirm_p.add_argument("-a", "--artist", required=True, help="艺人名称")
    confirm_p.add_argument("-s", "--slot", default="", help="演出时段")

    reject_p = sub.add_parser("reject", help="退回艺人分账")
    reject_p.add_argument("-o", "--output", required=True, help="输出目录")
    reject_p.add_argument("-a", "--artist", required=True, help="艺人名称")
    reject_p.add_argument("-s", "--slot", default="", help="演出时段")

    reset_p = sub.add_parser("reset", help="重置分账状态为暂存")
    reset_p.add_argument("-o", "--output", required=True, help="输出目录")
    reset_p.add_argument("-a", "--artist", required=True, help="艺人名称")
    reset_p.add_argument("-s", "--slot", default="", help="演出时段")

    args = parser.parse_args()

    if args.command == "run":
        run_pipeline(args.input, args.output, args.force)
    elif args.command == "status":
        show_status(args.output, args.artist)
    elif args.command == "confirm":
        update_status(args.output, args.artist, "confirm", args.slot)
    elif args.command == "reject":
        update_status(args.output, args.artist, "reject", args.slot)
    elif args.command == "reset":
        update_status(args.output, args.artist, "reset", args.slot)
    else:
        parser.print_help()
