#!/usr/bin/env python3
import os
import shutil
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from backup_drill.models import DataStore, generate_id, BackupStatus, DrillStatus
from backup_drill.services import (
    BackupRegistrationService,
    ChecksumService,
    RecoveryDrillService,
    TrendAnalysisService,
    ReportService,
)


def print_header(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def print_separator():
    print("-" * 70)


def create_demo_backups(base_dir: Path):
    print_header("步骤 1: 创建样例备份数据")

    success_backup = base_dir / "success_backup"
    success_backup.mkdir()
    (success_backup / "data.txt").write_text("重要业务数据 - 版本 1.0")
    (success_backup / "config.json").write_text('{"setting": "value", "version": 1}')
    (success_backup / "subdir").mkdir()
    (success_backup / "subdir" / "nested.txt").write_text("嵌套目录中的文件")
    print(f"  ✓ 创建成功备份: {success_backup}")

    corrupted_backup = base_dir / "corrupted_backup"
    corrupted_backup.mkdir()
    (corrupted_backup / "data.txt").write_text("损坏的数据 - 原内容已被篡改")
    (corrupted_backup / "config.json").write_text('{"broken": true}')
    print(f"  ✓ 创建损坏备份: {corrupted_backup}")

    expired_backup = base_dir / "expired_backup"
    expired_backup.mkdir()
    (expired_backup / "old_data.txt").write_text("已过期的历史数据")
    print(f"  ✓ 创建过期备份: {expired_backup}")

    print("\n  三个备份已创建:")
    print(f"    1. success_backup - 正常完整的备份")
    print(f"    2. corrupted_backup - 内容被篡改的损坏备份")
    print(f"    3. expired_backup - 超过保留期的过期备份")

    return success_backup, corrupted_backup, expired_backup


def calculate_checksums(success_backup: Path, corrupted_backup: Path):
    print_header("步骤 2: 计算正确的校验值")

    checksum_service = ChecksumService()

    success_checksum = checksum_service.calculate_checksum(str(success_backup), "md5")
    print(f"  ✓ success_backup 的 MD5: {success_checksum}")

    corrupted_checksum = checksum_service.calculate_checksum(str(corrupted_backup), "md5")
    print(f"  ✓ corrupted_backup 的 MD5: {corrupted_checksum}")

    print("\n  注意: 将使用 success_backup 的校验值来演示损坏检测")
    return success_checksum, corrupted_checksum


def register_backups(
    data_store: DataStore,
    success_backup: Path,
    corrupted_backup: Path,
    expired_backup: Path,
    success_checksum: str,
):
    print_header("步骤 3: 登记备份集")

    registration_service = BackupRegistrationService(data_store)
    checksum_service = ChecksumService()

    print_separator()
    print("  [备份 1] 正常备份 (保留期 30 天)")
    try:
        backup1 = registration_service.register_backup(
            name="prod_daily_backup_20260511",
            source_path=str(success_backup),
            checksum=success_checksum,
            checksum_algorithm="md5",
            retention_days=30,
            description="生产环境每日备份 - 正常",
        )
        print(f"    ✓ 登记成功，ID: {backup1.id}")
    except Exception as e:
        print(f"    ✗ 登记失败: {e}")
        backup1 = None

    print_separator()
    print("  [备份 2] 损坏备份 (使用正确校验值来演示检测)")
    try:
        backup2 = registration_service.register_backup(
            name="prod_daily_backup_20260510",
            source_path=str(corrupted_backup),
            checksum=success_checksum,
            checksum_algorithm="md5",
            retention_days=30,
            description="模拟损坏的备份 - 校验值不匹配",
        )
        print(f"    ✓ 登记成功，ID: {backup2.id}")
    except Exception as e:
        print(f"    ✗ 登记失败: {e}")
        backup2 = None

    print_separator()
    print("  [备份 3] 过期备份 (备份日期设为 60 天前)")
    expired_checksum = checksum_service.calculate_checksum(str(expired_backup), "md5")
    expired_date = (datetime.now() - timedelta(days=60)).isoformat()

    try:
        backup3 = registration_service.register_backup(
            name="prod_monthly_backup_20260312",
            source_path=str(expired_backup),
            checksum=expired_checksum,
            checksum_algorithm="md5",
            retention_days=30,
            backup_date=expired_date,
            description="历史月度备份 - 已过期",
        )
        print(f"    ✓ 登记成功，ID: {backup3.id}")
    except Exception as e:
        print(f"    ✗ 登记失败: {e}")
        backup3 = None

    return backup1, backup2, backup3


def test_duplicate_registration(data_store: DataStore, success_backup: Path, success_checksum: str):
    print_header("步骤 4: 测试重复登记保护")

    registration_service = BackupRegistrationService(data_store)
    print_separator()
    print("  尝试重复登记已存在的备份集...")

    try:
        registration_service.register_backup(
            name="prod_daily_backup_20260511",
            source_path=str(success_backup),
            checksum=success_checksum,
            checksum_algorithm="md5",
            retention_days=30,
        )
        print("    ✗ 不应成功，但成功了！")
    except Exception as e:
        print(f"    ✓ 正确阻止了重复登记: {e}")


def test_missing_checksum(data_store: DataStore, success_backup: Path):
    print_header("步骤 5: 测试缺少校验值的错误处理")

    registration_service = BackupRegistrationService(data_store)
    print_separator()
    print("  尝试登记没有校验值的备份...")

    try:
        registration_service.register_backup(
            name="test_invalid_backup",
            source_path=str(success_backup),
            checksum="",
            checksum_algorithm="md5",
            retention_days=30,
        )
        print("    ✗ 不应成功，但成功了！")
    except Exception as e:
        print(f"    ✓ 正确报告错误: {e}")


def run_recovery_drills(
    data_store: DataStore,
    backup1,
    backup2,
    backup3,
):
    print_header("步骤 6: 执行恢复演练")

    checksum_service = ChecksumService()
    recovery_service = RecoveryDrillService(data_store, checksum_service)

    drill_results = []

    print_separator()
    print("  [演练 1] 正常备份的恢复演练")
    if backup1:
        try:
            drill1 = recovery_service.run_drill(backup_set_id=backup1.id)
            print(f"    ✓ 演练成功！")
            print(f"      耗时: {drill1.duration_seconds:.2f} 秒")
            print(f"      恢复路径: {drill1.restored_path}")
            print(f"      校验和验证: {'通过' if drill1.checksum_verified else '失败'}")
            drill_results.append(drill1)
        except Exception as e:
            print(f"    ✗ 演练失败: {e}")
            drill_results.append(None)
    else:
        print("    - 跳过（备份未登记）")
        drill_results.append(None)

    print_separator()
    print("  [演练 2] 损坏备份的恢复演练（预期失败）")
    if backup2:
        try:
            drill2 = recovery_service.run_drill(backup_set_id=backup2.id)
            print(f"    ✗ 不应成功，但成功了！")
            drill_results.append(drill2)
        except Exception as e:
            print(f"    ✓ 正确检测到损坏: {e}")
            drills = data_store.get_drills_by_backup(backup2.id)
            if drills:
                drill2 = drills[0]
                print(f"      失败已记录，演练 ID: {drill2.id}")
                drill_results.append(drill2)
            else:
                drill_results.append(None)
    else:
        print("    - 跳过（备份未登记）")
        drill_results.append(None)

    print_separator()
    print("  [演练 3] 过期备份的恢复演练（预期失败）")
    if backup3:
        try:
            drill3 = recovery_service.run_drill(backup_set_id=backup3.id)
            print(f"    ✗ 不应成功，但成功了！")
            drill_results.append(drill3)
        except Exception as e:
            print(f"    ✓ 正确检测到过期: {e}")
            drills = data_store.get_drills_by_backup(backup3.id)
            if drills:
                drill3 = drills[0]
                print(f"      失败已记录，演练 ID: {drill3.id}")
                drill_results.append(drill3)
            else:
                drill_results.append(None)
    else:
        print("    - 跳过（备份未登记）")
        drill_results.append(None)

    return drill_results


def test_directory_conflict(data_store: DataStore, backup1, base_dir: Path):
    print_header("步骤 7: 测试恢复目录冲突检测")

    checksum_service = ChecksumService()
    recovery_service = RecoveryDrillService(data_store, checksum_service)

    conflict_dir = base_dir / "conflict_test"
    conflict_dir.mkdir()
    (conflict_dir / "existing_file.txt").write_text("已有文件")

    print_separator()
    print(f"  创建非空目录: {conflict_dir}")
    print("  尝试恢复到已存在的非空目录...")

    if backup1:
        try:
            recovery_service.run_drill(
                backup_set_id=backup1.id,
                restore_path=str(conflict_dir),
            )
            print("    ✗ 不应成功，但成功了！")
        except Exception as e:
            print(f"    ✓ 正确检测到冲突: {e}")
    else:
        print("    - 跳过（备份未登记）")


def mark_drill_statuses(data_store: DataStore, drill_results):
    print_header("步骤 8: 标记演练状态")

    drill1, drill2, drill3 = drill_results

    print_separator()
    if drill1 and drill1.status == DrillStatus.SUCCESS.value:
        drill1.manually_confirmed = True
        drill1.notes = "人工确认恢复内容完整"
        data_store.save_drill(drill1)
        print(f"  ✓ 演练 {drill1.id[:8]}... 已标记为人工确认")
    else:
        print("  - 跳过（演练 1 不存在或未成功）")

    print_separator()
    if drill2 and drill2.status == DrillStatus.FAILED.value:
        drill2.re_backed_up = True
        drill2.notes = "检测到备份损坏，已重新执行备份"
        data_store.save_drill(drill2)
        print(f"  ✓ 演练 {drill2.id[:8]}... 已标记为已重新备份")
    else:
        print("  - 跳过（演练 2 不存在或未失败）")

    print_separator()
    if drill3 and drill3.status == DrillStatus.FAILED.value:
        drill3.notes = "备份已过期，将被新备份替换"
        data_store.save_drill(drill3)
        print(f"  ✓ 演练 {drill3.id[:8]}... 已添加备注")
    else:
        print("  - 跳过（演练 3 不存在或未失败）")


def run_multiple_drills_for_trend(data_store: DataStore, backup1):
    print_header("步骤 9: 执行多次演练以生成趋势数据")

    checksum_service = ChecksumService()
    recovery_service = RecoveryDrillService(data_store, checksum_service)

    if not backup1:
        print("  - 跳过（备份未登记）")
        return

    print_separator()
    print("  对成功备份执行 3 次演练以展示趋势分析...")

    for i in range(3):
        try:
            drill = recovery_service.run_drill(backup_set_id=backup1.id)
            print(f"    演练 {i+1}: 成功 ({drill.duration_seconds:.2f}s)")
            time.sleep(0.1)
        except Exception as e:
            print(f"    演练 {i+1}: 失败 - {e}")


def analyze_and_report(data_store: DataStore, output_dir: Path):
    print_header("步骤 10: 趋势分析和报告生成")

    trend_service = TrendAnalysisService(data_store)
    report_service = ReportService(data_store, trend_service)

    print_separator()
    print("  [概览统计]")
    stats = trend_service.get_overall_stats()
    print(f"    总演练次数: {stats['total_drills']}")
    print(f"    成功率: {stats['success_rate']}%")
    print(f"    活跃备份: {stats['active_backups']}")
    print(f"    需关注: {stats['backups_requiring_attention']}")

    active_backups = data_store.get_active_backups()
    if active_backups:
        print_separator()
        print("  [趋势分析 - 成功备份]")
        trend = trend_service.analyze_backup_trend(active_backups[0].id)
        print(f"    演练次数: {trend['total_drills']}")
        print(f"    成功率: {trend['success_rate']}%")
        print(f"    平均耗时: {trend.get('avg_duration_seconds', 0)} 秒")
        print(f"    趋势: {trend['trend']}")

    print_separator()
    print("  [生成报告]")
    report_path = output_dir / "backup_drill_report.txt"
    report = report_service.generate_text_report(str(report_path))
    print(f"    ✓ 报告已保存: {report_path}")

    print_separator()
    print("\n  报告摘要:")
    for line in report.split("\n")[:20]:
        print(f"    {line}")


def list_records(data_store: DataStore):
    print_header("步骤 11: 查看所有记录")

    print_separator()
    print("  [活跃备份集]")
    backups = data_store.get_active_backups()
    for b in backups:
        expired = " (已过期)" if b.is_expired() else ""
        print(f"    - {b.name}{expired} (ID: {b.id[:8]}...)")

    print_separator()
    print("  [所有演练记录]")
    drills = data_store.get_all_drills()
    for d in drills:
        backup = data_store.get_backup_by_id(d.backup_set_id)
        backup_name = backup.name if backup else "未知"
        status = "成功" if d.status == DrillStatus.SUCCESS.value else "失败"
        manual = " (人工确认)" if d.manually_confirmed else ""
        rebacked = " (已重备份)" if d.re_backed_up else ""
        duration = f"{d.duration_seconds:.2f}s" if d.duration_seconds else "-"
        print(f"    - {d.id[:8]}... [{status}] {backup_name} ({duration}){manual}{rebacked}")


def main():
    print("\n" + "#" * 70)
    print("#  备份恢复演练 CLI - 完整流程演示")
    print("#" * 70)

    demo_dir = Path(tempfile.mkdtemp(prefix="backup_drill_demo_"))
    data_dir = demo_dir / "data"
    backups_dir = demo_dir / "backups"
    output_dir = demo_dir / "output"
    backups_dir.mkdir()
    output_dir.mkdir()

    print(f"\n演示目录: {demo_dir}")
    print(f"数据目录: {data_dir}")

    try:
        data_store = DataStore(data_dir)
        checksum_service = ChecksumService()

        success_backup, corrupted_backup, expired_backup = create_demo_backups(backups_dir)
        success_checksum, corrupted_checksum = calculate_checksums(success_backup, corrupted_backup)
        backup1, backup2, backup3 = register_backups(
            data_store, success_backup, corrupted_backup, expired_backup, success_checksum
        )

        test_duplicate_registration(data_store, success_backup, success_checksum)
        test_missing_checksum(data_store, success_backup)

        drill_results = run_recovery_drills(data_store, backup1, backup2, backup3)
        test_directory_conflict(data_store, backup1, backups_dir)

        mark_drill_statuses(data_store, drill_results)
        run_multiple_drills_for_trend(data_store, backup1)

        analyze_and_report(data_store, output_dir)
        list_records(data_store)

        print("\n" + "#" * 70)
        print("#  演示完成！")
        print("#" * 70)
        print(f"\n演示数据保存在: {demo_dir}")
        print(f"报告文件: {output_dir / 'backup_drill_report.txt'}")
        print("\n你可以运行以下命令来使用 CLI:")
        print("  python run.py --help")
        print("  python run.py backup list")
        print("  python run.py drill list")
        print("  python run.py analyze overview")
        print(f"  python run.py report -o /tmp/report.txt")
        print(f"\n使用演示数据的命令示例:")
        print(f"  python run.py --data-dir {data_dir} backup list")
        print(f"  python run.py --data-dir {data_dir} drill list")

    except Exception as e:
        print(f"\n✗ 演示执行出错: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
