import argparse
import os
import sys
from typing import Any, Dict, List, Optional

from config import config
from utils import colorize, print_separator, load_json
from backup_inventory import inventory
from temp_recovery import temp_recovery
from validation_checker import validation_checker
from permission_checker import permission_checker
from failure_samples import failure_samples
from report_generator import report_generator
from drill_orchestrator import drill_orchestrator


def show_header():
    print(colorize("\n" + "=" * 80, "blue"))
    print(colorize("            备份恢复演练脚本", "blue"))
    print(colorize("  场景: 备份每天显示成功,但恢复时才发现缺表或权限不够", "blue"))
    print(colorize("=" * 80, "blue"))


def cmd_list_backups(args):
    print_separator("备份清单")
    backups = inventory.list_backups(
        status_filter=args.status,
        drill_status_filter=args.drill_status,
        limit=args.limit,
    )
    inventory.display_list(backups)


def cmd_backup_detail(args):
    inventory.display_detail(args.backup_id)


def cmd_add_backup(args):
    tables = args.tables.split(",") if args.tables else config.CRITICAL_TABLES.copy()
    backup_info = inventory.add_backup(
        backup_id=args.backup_id or f"bkp_manual_{config.TIMESTAMP_FORMAT}",
        backup_path=args.path or os.path.join(config.BACKUPS_DIR, "manual_backup.tar.gz"),
        backup_type=args.type,
        status="success",
        tables=tables,
        size_bytes=args.size * 1024 * 1024,
    )
    print(colorize(f"已添加备份: {backup_info['backup_id']}", "green"))
    inventory.display_detail(backup_info["backup_id"])


def cmd_export_inventory(args):
    output = args.output or os.path.join(config.REPORTS_DIR, "backup_inventory_export.json")
    inventory.export_inventory(output)


def cmd_run_normal(args):
    drill_orchestrator.run_normal_drill(backup_id=args.backup_id)


def cmd_run_failure(args):
    if args.sample:
        drill_orchestrator.run_failure_drill(sample_id=args.sample, backup_id=args.backup_id)
    else:
        print(colorize("请指定失败样本ID。可用样本:", "yellow"))
        failure_samples.display_samples()


def cmd_run_all(args):
    drill_orchestrator.run_both_scenarios()


def cmd_list_samples(args):
    failure_samples.display_samples()


def cmd_sample_detail(args):
    failure_samples.display_sample_detail(args.sample_id)


def cmd_permission_check(args):
    result = permission_checker.run_full_check()
    permission_checker.display_result(result)


def cmd_table_check(args):
    if not args.backup_id:
        print(colorize("请指定备份ID", "red"))
        return

    backup = inventory.get_backup(args.backup_id)
    if backup:
        result = validation_checker.check_missing_tables(backup)
        validation_checker.display_result(result, "表完整性检查")
    else:
        print(colorize(f"未找到备份: {args.backup_id}", "red"))
        print(colorize("可用的备份列表:", "yellow"))
        inventory.display_list()


def cmd_validation(args):
    recovery_id = args.recovery_id

    if recovery_id:
        recovery_path = os.path.join(config.RECOVERIES_DIR, recovery_id)
        recovery_result_file = os.path.join(recovery_path, "recovery_result.json")
        if not os.path.exists(recovery_result_file):
            print(colorize(f"未找到恢复记录: {recovery_id}", "red"))
            print(colorize("可用的恢复:", "yellow"))
            _list_recoveries()
            return
        recovery_result = load_json(recovery_result_file)
    else:
        recovery_result = _find_latest_recovery()
        if not recovery_result:
            print(colorize("未找到任何恢复记录。请先执行恢复操作或使用完整演练命令。", "red"))
            print(colorize("使用 --recovery-id 指定特定恢复，或运行 python3 main.py run-normal", "yellow"))
            return

    print(colorize(f"\n使用恢复记录: {recovery_result['recovery_id']}", "blue"))
    print(colorize(f"备份ID: {recovery_result['backup_id']}", "blue"))

    backup_id = recovery_result.get("backup_id")
    backup_info = inventory.get_backup(backup_id)
    if not backup_info:
        backup_info = {
            "backup_id": backup_id,
            "tables": recovery_result.get("restored_tables", []),
        }

    validation_result = validation_checker.run_data_validation_queries(
        recovery_result, backup_info
    )
    validation_checker.display_result(validation_result, "数据校验结果")


def _find_latest_recovery() -> Optional[Dict[str, Any]]:
    if not os.path.exists(config.RECOVERIES_DIR):
        return None

    recovery_dirs = [
        d for d in os.listdir(config.RECOVERIES_DIR)
        if os.path.isdir(os.path.join(config.RECOVERIES_DIR, d))
    ]

    if not recovery_dirs:
        return None

    latest_dir = sorted(recovery_dirs)[-1]
    recovery_path = os.path.join(config.RECOVERIES_DIR, latest_dir)
    recovery_result_file = os.path.join(recovery_path, "recovery_result.json")

    if not os.path.exists(recovery_result_file):
        return None

    return load_json(recovery_result_file)


def _list_recoveries() -> None:
    if not os.path.exists(config.RECOVERIES_DIR):
        print("  (无恢复记录)")
        return

    recovery_dirs = [
        d for d in os.listdir(config.RECOVERIES_DIR)
        if os.path.isdir(os.path.join(config.RECOVERIES_DIR, d))
    ]

    if not recovery_dirs:
        print("  (无恢复记录)")
        return

    for d in sorted(recovery_dirs):
        print(f"  {d}")


def main():
    parser = argparse.ArgumentParser(
        description="备份恢复演练脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
关键验收命令链路:
  1. 备份清单
     python3 main.py list-backups              # 列出所有备份
     python3 main.py backup-detail <backup_id>  # 查看备份详情
     python3 main.py export-inventory            # 导出备份清单

  2. 表完整性校验
     python3 main.py table-check --backup-id bkp_normal_20260509_212250

  3. 权限检查
     python3 main.py permission-check

  4. 数据校验（需先有恢复记录）
     python3 main.py validation                  # 使用最新恢复记录
     python3 main.py validation --recovery-id recovery_bkp_normal_xxx

  5. 完整演练
     python3 main.py run-normal                  # 正常流程演练
     python3 main.py run-failure --sample missing_critical_table  # 失败流程演练
     python3 main.py run-all                    # 完整测试套件（正常+失败）

其他命令:
  python3 main.py list-samples                 # 列出可用的失败样本
  python3 main.py sample-detail <sample_id>      # 查看失败样本详情
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    list_backups_parser = subparsers.add_parser("list-backups", help="列出备份清单")
    list_backups_parser.add_argument("--status", help="按备份状态筛选")
    list_backups_parser.add_argument("--drill-status", help="按演练状态筛选")
    list_backups_parser.add_argument("--limit", type=int, help="限制显示数量")
    list_backups_parser.set_defaults(func=cmd_list_backups)

    backup_detail_parser = subparsers.add_parser("backup-detail", help="查看备份详情")
    backup_detail_parser.add_argument("backup_id", help="备份ID")
    backup_detail_parser.set_defaults(func=cmd_backup_detail)

    add_backup_parser = subparsers.add_parser("add-backup", help="添加备份记录")
    add_backup_parser.add_argument("--backup-id", help="自定义备份ID")
    add_backup_parser.add_argument("--path", help="备份路径")
    add_backup_parser.add_argument("--type", default="full", choices=["full", "incremental", "differential"], help="备份类型")
    add_backup_parser.add_argument("--tables", help="包含的表名，逗号分隔")
    add_backup_parser.add_argument("--size", type=int, default=10, help="备份大小(MB)")
    add_backup_parser.set_defaults(func=cmd_add_backup)

    export_parser = subparsers.add_parser("export-inventory", help="导出备份清单")
    export_parser.add_argument("--output", help="输出文件路径")
    export_parser.set_defaults(func=cmd_export_inventory)

    normal_parser = subparsers.add_parser("run-normal", help="运行正常流程演练")
    normal_parser.add_argument("--backup-id", help="指定备份ID")
    normal_parser.set_defaults(func=cmd_run_normal)

    failure_parser = subparsers.add_parser("run-failure", help="运行失败流程演练")
    failure_parser.add_argument("--sample", help="失败样本ID")
    failure_parser.add_argument("--backup-id", help="指定备份ID")
    failure_parser.set_defaults(func=cmd_run_failure)

    all_parser = subparsers.add_parser("run-all", help="运行完整测试套件（正常+失败）")
    all_parser.set_defaults(func=cmd_run_all)

    list_samples_parser = subparsers.add_parser("list-samples", help="列出失败样本")
    list_samples_parser.set_defaults(func=cmd_list_samples)

    sample_detail_parser = subparsers.add_parser("sample-detail", help="查看失败样本详情")
    sample_detail_parser.add_argument("sample_id", help="样本ID")
    sample_detail_parser.set_defaults(func=cmd_sample_detail)

    perm_parser = subparsers.add_parser("permission-check", help="检查权限")
    perm_parser.set_defaults(func=cmd_permission_check)

    table_parser = subparsers.add_parser("table-check", help="检查表完整性")
    table_parser.add_argument("--backup-id", help="备份ID")
    table_parser.set_defaults(func=cmd_table_check)

    valid_parser = subparsers.add_parser("validation", help="执行数据校验查询（支持表存在性、主键完整性、行数等校验）")
    valid_parser.add_argument("--recovery-id", help="指定恢复ID（可选，默认使用最新的恢复记录）")
    valid_parser.set_defaults(func=cmd_validation)

    args = parser.parse_args()

    if not args.command:
        show_header()
        parser.print_help()
        sys.exit(0)

    show_header()
    args.func(args)


if __name__ == "__main__":
    main()
