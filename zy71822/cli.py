#!/usr/bin/env python3
import argparse
import sys
import os
from typing import List

from models import ReviewStatus, AnomalyType, SourceType
from island_supply_service import IslandSupplyService


class Color:
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    RESET = "\033[0m"


def print_warning(msg: str):
    print(f"{Color.YELLOW}⚠️  {msg}{Color.RESET}")


def print_error(msg: str):
    print(f"{Color.RED}❌ {msg}{Color.RESET}")


def print_success(msg: str):
    print(f"{Color.GREEN}✅ {msg}{Color.RESET}")


def print_info(msg: str):
    print(f"{Color.BLUE}ℹ️  {msg}{Color.RESET}")


def print_header(title: str):
    print(f"\n{Color.BOLD}{Color.CYAN}{'=' * 60}{Color.RESET}")
    print(f"{Color.BOLD}{Color.CYAN}  {title}{Color.RESET}")
    print(f"{Color.BOLD}{Color.CYAN}{'=' * 60}{Color.RESET}\n")


def cmd_import_drop_config(args):
    service = IslandSupplyService(db_path=args.db)
    try:
        configs = service.import_drop_configs(args.file, operator=args.operator)
        print_success(f"成功导入 {len(configs)} 条掉落配置")
        for cfg in configs:
            print(f"  - {cfg.stage}: {cfg.item_name} ({cfg.drop_rate}%)")
    except Exception as e:
        print_error(f"导入失败: {e}")
        sys.exit(1)


def cmd_import_leaderboard(args):
    service = IslandSupplyService(db_path=args.db)
    source_type_map = {
        "screenshot": SourceType.SCREENSHOT,
        "config": SourceType.DROP_CONFIG,
        "manual": SourceType.MANUAL,
    }
    source_type = source_type_map.get(args.source_type, SourceType.SCREENSHOT)

    try:
        result = service.import_leaderboard(
            args.file,
            source_type=source_type,
            source_ref=args.source_ref,
            operator=args.operator,
            auto_detect_anomaly=not args.no_auto_detect,
        )

        print_header("导入结果")
        print(f"批次ID: {Color.MAGENTA}{result.batch.batch_id}{Color.RESET}")
        print(f"来源文件: {result.batch.source_file}")
        print(f"导入时间: {result.batch.created_at}")
        print()

        if result.new_records:
            print_success(f"新增记录: {len(result.new_records)} 条")
            for r in result.new_records[:10]:
                print(f"  + {r.player_name} (ID: {r.player_id}) - {r.score}分")

        if result.updated_records:
            print_info(f"更新记录: {len(result.updated_records)} 条")
            for r in result.updated_records[:10]:
                print(f"  ~ {r.player_name} (ID: {r.player_id}) - 版本 {r.version}")

        if result.version_diffs:
            print_warning(f"版本变更: {len(result.version_diffs)} 处")
            for diff in result.version_diffs[:10]:
                old_vals = ", ".join([f"{k}={v}" for k, v in diff.old_values.items()])
                new_vals = ", ".join([f"{k}={v}" for k, v in diff.new_values.items()])
                print(f"  ! {diff.old_record.player_name}: {old_vals} → {new_vals}")

        if result.skipped_records:
            print_info(f"跳过记录: {len(result.skipped_records)} 条")
            for r, reason in result.skipped_records[:10]:
                print(f"  - {r.player_name}: {reason}")

        anomaly_marked = [
            r for r in result.updated_records
            if r.review_status == ReviewStatus.PENDING_CONFIRM
        ]
        if anomaly_marked:
            print_warning(f"\n⚠️  自动标记 {len(anomaly_marked)} 条疑似断线进度错乱记录为待确认")
            for r in anomaly_marked[:10]:
                print(f"  ! {r.player_name} (ID: {r.player_id}): {r.anomaly_note}")

        diff_warnings = service.get_version_diff_warnings(result.batch.batch_id)
        if diff_warnings:
            print_warning(f"\n⚠️  该批次覆盖了 {len(diff_warnings)} 条旧版本数据，请仔细核对！")
            for w in diff_warnings:
                print(f"  - {w['player_name']}: {w['changes']}")

    except Exception as e:
        print_error(f"导入失败: {e}")
        sys.exit(1)


def cmd_revoke_batch(args):
    service = IslandSupplyService(db_path=args.db)
    success = service.revoke_batch(args.batch_id, args.reason, operator=args.operator)
    if success:
        print_success(f"已撤回批次 {args.batch_id}，原因: {args.reason}")
        print_info("该批次下的所有记录已标记为已驳回")
    else:
        print_error(f"撤回失败：批次不存在或已被撤回")
        sys.exit(1)


def cmd_list_batches(args):
    service = IslandSupplyService(db_path=args.db)
    batches = service.list_batches()

    if not batches:
        print_info("暂无导入批次")
        return

    print_header("导入批次列表")
    for b in batches:
        batch = b["batch"]
        status_color = Color.RED if batch["is_revoked"] else Color.GREEN
        status = "已撤回" if batch["is_revoked"] else "正常"
        warning_flag = f"{Color.YELLOW} ⚠️有变更{Color.RESET}" if b["has_warnings"] else ""

        print(
            f"[{status_color}{status}{Color.RESET}] "
            f"{Color.MAGENTA}{batch['batch_id']}{Color.RESET}"
            f"{warning_flag}"
        )
        print(f"  文件: {batch['source_file']} | 类型: {batch['record_type']} | 数量: {b['record_count']}")
        print(f"  时间: {batch['created_at']} | 操作人: {batch['operator'] or '未填写'}")
        if batch["is_revoked"]:
            print(f"  撤回原因: {batch['revoke_reason']}")
        if b["has_warnings"] and args.show_warnings:
            print(f"  变更详情:")
            for w in b["warnings"]:
                print(f"    - {w['player_name']}: {w['changes']}")
        print()


def cmd_mark_anomaly(args):
    service = IslandSupplyService(db_path=args.db)
    anomaly_type_map = {
        "disconnect": AnomalyType.DISCONNECT_PROGRESS_CORRUPT,
        "restart": AnomalyType.RESTART_BRUSH_SCORE,
        "reward": AnomalyType.REWARD_MISSED,
    }
    anomaly_type = anomaly_type_map.get(args.type, AnomalyType.NONE)

    record = service.mark_anomaly(
        args.record_id, anomaly_type, args.note, operator=args.operator
    )

    if record:
        print_success(
            f"已标记记录 {args.record_id} 为异常: {anomaly_type.value}"
        )
        print(f"  玩家: {record.player_name} | 状态: {record.review_status.value}")
    else:
        print_error(f"记录 {args.record_id} 不存在")
        sys.exit(1)


def cmd_confirm(args):
    service = IslandSupplyService(db_path=args.db)
    record = service.confirm_record(
        args.record_id, is_normal=args.normal, note=args.note, operator=args.operator
    )

    if record:
        result = "正常" if args.normal else "已驳回"
        print_success(f"记录 {args.record_id} 审核完成: {result}")
        print(f"  玩家: {record.player_name} | 状态: {record.review_status.value}")
    else:
        print_error(f"记录 {args.record_id} 不存在")
        sys.exit(1)


def cmd_detect(args):
    service = IslandSupplyService(db_path=args.db)

    print_header("异常检测结果")

    if args.type in ["all", "disconnect"]:
        suspicious = service.detect_disconnect_corruption(args.score_threshold)
        if suspicious:
            print_warning(f"发现 {len(suspicious)} 条疑似断线进度错乱记录:")
            for r in suspicious:
                print(f"  - {r.player_name} (ID: {r.player_id}): {r.score}分")
        else:
            print_success("未发现断线进度错乱异常")

    if args.type in ["all", "restart"]:
        suspicious = service.detect_restart_brush_score(args.rank_threshold)
        if suspicious:
            print_warning(f"发现 {len(suspicious)} 条疑似重开刷分记录:")
            for r in suspicious:
                print(f"  - {r.player_name} (ID: {r.player_id}): 排名{r.rank}")
        else:
            print_success("未发现重开刷分异常")


def cmd_export(args):
    service = IslandSupplyService(db_path=args.db)

    status_map = {
        "normal": ReviewStatus.NORMAL,
        "pending": ReviewStatus.PENDING_CONFIRM,
        "rejected": ReviewStatus.REJECTED,
        None: None,
    }
    anomaly_map = {
        "disconnect": AnomalyType.DISCONNECT_PROGRESS_CORRUPT,
        "restart": AnomalyType.RESTART_BRUSH_SCORE,
        "reward": AnomalyType.REWARD_MISSED,
        None: None,
    }

    try:
        results = service.export_with_trace(
            args.output,
            review_status=status_map.get(args.status),
            anomaly_type=anomaly_map.get(args.anomaly),
            min_score=args.min_score,
            include_pending=args.include_pending,
            include_trace=not args.no_trace,
        )

        base = os.path.splitext(args.output)[0]
        print_header("导出完成")
        print_success(f"共导出 {len(results)} 条记录")
        print(f"  汇总表: {base}_summary.csv")
        if not args.no_trace:
            print(f"  详情JSON: {base}_detail.json")
        print(f"  警告信息: {base}_warnings.txt")

        normal_count = sum(
            1 for r in results if r.record.review_status == ReviewStatus.NORMAL
        )
        pending_count = sum(
            1 for r in results if r.record.review_status == ReviewStatus.PENDING_CONFIRM
        )

        print(f"\n统计: 正常 {normal_count} 条, 待确认 {pending_count} 条")

        if pending_count > 0:
            print_warning("有待确认记录，请先完成审核再使用导出结果！")

    except Exception as e:
        print_error(f"导出失败: {e}")
        sys.exit(1)


def cmd_trace(args):
    service = IslandSupplyService(db_path=args.db)
    trace = service.get_record_trace(args.record_id)

    if not trace:
        print_error(f"记录 {args.record_id} 不存在")
        sys.exit(1)

    rec = trace["record"]
    print_header(f"记录溯源 - {rec['player_name']} (ID: {rec['player_id']})")

    print(f"{Color.BOLD}基本信息:{Color.RESET}")
    print(f"  记录ID: {rec['id']} | 版本: {rec['version']}")
    print(f"  分数: {rec['score']} | 排名: {rec['rank']} | 进度: 关卡{rec['stage_progress']}")
    print(f"  审核状态: {rec['review_status']} | 异常类型: {rec['anomaly_type']}")
    if rec["anomaly_note"]:
        print(f"  异常说明: {rec['anomaly_note']}")
    print()

    print(f"{Color.BOLD}证据来源:{Color.RESET}")
    print(f"  来源类型: {trace['evidence']['source_type']}")
    print(f"  来源文件: {trace['evidence']['source_file']}")
    print(f"  来源引用: {trace['evidence']['source_ref']}")
    print()

    if trace["import_batch"]:
        batch = trace["import_batch"]
        print(f"{Color.BOLD}导入批次:{Color.RESET}")
        print(f"  批次ID: {batch['batch_id']}")
        print(f"  导入时间: {batch['created_at']}")
        print(f"  操作人: {batch['operator'] or '未填写'}")
        if batch["is_revoked"]:
            print_warning(f"  批次已撤回: {batch['revoke_reason']}")
        print()

    if trace["related_drop_configs"]:
        print(f"{Color.BOLD}关联掉落配置 (关卡{rec['stage_progress']}):{Color.RESET}")
        for cfg in trace["related_drop_configs"]:
            print(f"  - {cfg['item_name']}: {cfg['drop_rate']}% (来源: {cfg['source_file']})")
        print()

    if trace["version_history"]:
        print(f"{Color.BOLD}版本历史:{Color.RESET}")
        for h in trace["version_history"]:
            old_v = h["old_version"]
            new_v = h["new_version"]
            print(f"  v{old_v} → v{new_v}: {h['change_summary']}")
            if h["operator"]:
                print(f"    操作人: {h['operator']} | 时间: {h['created_at']}")


def cmd_list(args):
    service = IslandSupplyService(db_path=args.db)

    status_map = {
        "normal": ReviewStatus.NORMAL,
        "pending": ReviewStatus.PENDING_CONFIRM,
        "rejected": ReviewStatus.REJECTED,
        None: None,
    }
    anomaly_map = {
        "disconnect": AnomalyType.DISCONNECT_PROGRESS_CORRUPT,
        "restart": AnomalyType.RESTART_BRUSH_SCORE,
        "reward": AnomalyType.REWARD_MISSED,
        None: None,
    }

    records = service.db.query_leaderboard(
        review_status=status_map.get(args.status),
        anomaly_type=anomaly_map.get(args.anomaly),
        min_score=args.min_score,
        include_revoked=args.include_revoked,
        limit=args.limit,
    )

    if not records:
        print_info("没有符合条件的记录")
        return

    print_header(f"排行榜记录 ({len(records)} 条)")
    print(f"{'排名':<6}{'玩家':<20}{'分数':<10}{'进度':<8}{'状态':<14}{'异常':<20}{'版本':<6}{'ID':<8}")
    print("-" * 92)

    for i, r in enumerate(records, 1):
        status_color = (
            Color.GREEN
            if r.review_status == ReviewStatus.NORMAL
            else Color.YELLOW
            if r.review_status == ReviewStatus.PENDING_CONFIRM
            else Color.RED
        )
        status_display = r.review_status.value
        anomaly_display = r.anomaly_type.value if r.anomaly_type != AnomalyType.NONE else "-"

        print(
            f"{i:<6}{r.player_name:<20}{r.score:<10}{r.stage_progress:<8}"
            f"{status_color}{status_display:<14}{Color.RESET}"
            f"{anomaly_display:<20}{r.version:<6}{r.id:<8}"
        )

    pending_count = sum(
        1 for r in records if r.review_status == ReviewStatus.PENDING_CONFIRM
    )
    if pending_count > 0:
        print_warning(f"\n⚠️  其中 {pending_count} 条记录待确认")


def main():
    parser = argparse.ArgumentParser(
        prog="island_supply",
        description="海岛补给竞速 - 社群运营数据管理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 导入掉落配置
  island_supply import-drop drop_config.csv

  # 导入排行榜（自动检测异常）
  island_supply import-leaderboard leaderboard_v1.csv

  # 导入排行榜（指定来源为截图，带引用）
  island_supply import-leaderboard leaderboard_v2.csv --source-ref "截图1_20260531.png"

  # 查看导入批次及警告
  island_supply list-batches --show-warnings

  # 撤回错误批次
  island_supply revoke-batch BATCH-20260531-XXXXXXX --reason "截图上传错误"

  # 手动标记异常
  island_supply mark-anomaly 1 --type disconnect --note "玩家反馈断线后分数异常"

  # 审核记录
  island_supply confirm 1 --normal --note "核对截图无误"
  island_supply confirm 2 --no-normal --note "确认刷分，不予发奖"

  # 自动检测异常
  island_supply detect --type all

  # 导出排行榜（含待确认，完整追溯）
  island_supply export result.csv --include-pending

  # 查看记录完整溯源
  island_supply trace 1

  # 列出所有待确认记录
  island_supply list --status pending
        """,
    )

    parser.add_argument(
        "--db", default="island_supply.db", help="数据库文件路径 (默认: island_supply.db)"
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    p_import_drop = subparsers.add_parser("import-drop", help="导入掉落配置CSV")
    p_import_drop.add_argument("file", help="掉落配置CSV文件路径")
    p_import_drop.add_argument("--operator", default="", help="操作人")
    p_import_drop.set_defaults(func=cmd_import_drop_config)

    p_import_lb = subparsers.add_parser("import-leaderboard", help="导入排行榜CSV")
    p_import_lb.add_argument("file", help="排行榜CSV文件路径")
    p_import_lb.add_argument(
        "--source-type",
        choices=["screenshot", "config", "manual"],
        default="screenshot",
        help="数据来源类型 (默认: screenshot)",
    )
    p_import_lb.add_argument("--source-ref", default="", help="来源引用，如截图文件名")
    p_import_lb.add_argument("--operator", default="", help="操作人")
    p_import_lb.add_argument(
        "--no-auto-detect",
        action="store_true",
        help="禁用自动异常检测",
    )
    p_import_lb.set_defaults(func=cmd_import_leaderboard)

    p_revoke = subparsers.add_parser("revoke-batch", help="撤回整个导入批次")
    p_revoke.add_argument("batch_id", help="要撤回的批次ID")
    p_revoke.add_argument("--reason", required=True, help="撤回原因")
    p_revoke.add_argument("--operator", default="", help="操作人")
    p_revoke.set_defaults(func=cmd_revoke_batch)

    p_batches = subparsers.add_parser("list-batches", help="列出所有导入批次")
    p_batches.add_argument(
        "--show-warnings",
        action="store_true",
        help="显示版本变更警告详情",
    )
    p_batches.set_defaults(func=cmd_list_batches)

    p_mark = subparsers.add_parser("mark-anomaly", help="手动标记异常")
    p_mark.add_argument("record_id", type=int, help="记录ID")
    p_mark.add_argument(
        "--type",
        required=True,
        choices=["disconnect", "restart", "reward"],
        help="异常类型: disconnect=断线错乱, restart=重开刷分, reward=奖励漏发",
    )
    p_mark.add_argument("--note", required=True, help="异常说明")
    p_mark.add_argument("--operator", default="", help="操作人")
    p_mark.set_defaults(func=cmd_mark_anomaly)

    p_confirm = subparsers.add_parser("confirm", help="审核确认记录")
    p_confirm.add_argument("record_id", type=int, help="记录ID")
    p_confirm.add_argument(
        "--normal/--no-normal",
        required=True,
        help="--normal 标记为正常, --no-normal 标记为驳回",
    )
    p_confirm.add_argument("--note", default="", help="审核说明")
    p_confirm.add_argument("--operator", default="", help="操作人")
    p_confirm.set_defaults(func=cmd_confirm)

    p_detect = subparsers.add_parser("detect", help="自动检测异常记录")
    p_detect.add_argument(
        "--type",
        choices=["all", "disconnect", "restart"],
        default="all",
        help="检测类型 (默认: all)",
    )
    p_detect.add_argument(
        "--score-threshold",
        type=int,
        default=5000,
        help="断线检测分数下降阈值 (默认: 5000)",
    )
    p_detect.add_argument(
        "--rank-threshold",
        type=int,
        default=20,
        help="刷分检测排名跳升阈值 (默认: 20)",
    )
    p_detect.set_defaults(func=cmd_detect)

    p_export = subparsers.add_parser("export", help="导出排行榜数据")
    p_export.add_argument("output", help="输出文件路径（将自动生成_summary.csv等）")
    p_export.add_argument(
        "--status",
        choices=["normal", "pending", "rejected"],
        help="按审核状态筛选",
    )
    p_export.add_argument(
        "--anomaly",
        choices=["disconnect", "restart", "reward"],
        help="按异常类型筛选",
    )
    p_export.add_argument("--min-score", type=int, help="最低分数筛选")
    p_export.add_argument(
        "--include-pending",
        action="store_true",
        help="包含待确认记录（默认只导出正常）",
    )
    p_export.add_argument(
        "--no-trace",
        action="store_true",
        help="不导出版本追溯详情",
    )
    p_export.set_defaults(func=cmd_export)

    p_trace = subparsers.add_parser("trace", help="查看记录完整溯源信息")
    p_trace.add_argument("record_id", type=int, help="记录ID")
    p_trace.set_defaults(func=cmd_trace)

    p_list = subparsers.add_parser("list", help="列出排行榜记录")
    p_list.add_argument(
        "--status",
        choices=["normal", "pending", "rejected"],
        help="按审核状态筛选",
    )
    p_list.add_argument(
        "--anomaly",
        choices=["disconnect", "restart", "reward"],
        help="按异常类型筛选",
    )
    p_list.add_argument("--min-score", type=int, help="最低分数筛选")
    p_list.add_argument(
        "--include-revoked",
        action="store_true",
        help="包含已撤回批次的记录",
    )
    p_list.add_argument("--limit", type=int, help="限制显示数量")
    p_list.set_defaults(func=cmd_list)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
