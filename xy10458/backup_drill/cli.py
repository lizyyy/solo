import click
from tabulate import tabulate
from datetime import datetime, timedelta
from typing import Optional

from .models import (
    DataStore,
    DrillStatus,
)
from .services import (
    BackupRegistrationService,
    ChecksumService,
    RecoveryDrillService,
    TrendAnalysisService,
    ReportService,
    BackupDrillError,
    BackupExpiredError,
    ChecksumMissingError,
    DirectoryConflictError,
)


pass_data_store = click.make_pass_decorator(DataStore)


@click.group()
@click.option(
    "--data-dir",
    type=click.Path(),
    default=None,
    help="数据存储目录（默认为 ~/.backup_drill）",
)
@click.pass_context
def cli(ctx: click.Context, data_dir: Optional[str]):
    """备份恢复演练 CLI 工具 - 帮助小团队验证备份可用性"""
    ctx.obj = DataStore(data_dir)


@cli.group()
def backup():
    """备份集管理命令"""
    pass


@backup.command("list")
@pass_data_store
def backup_list(data_store: DataStore):
    """列出所有活跃备份集"""
    backups = data_store.get_active_backups()

    if not backups:
        click.echo("暂无活跃备份集")
        return

    table = []
    for b in backups:
        expired = "是" if b.is_expired() else "否"
        table.append([
            b.id[:8] + "...",
            b.name,
            b.backup_date[:19] if len(b.backup_date) > 19 else b.backup_date,
            f"{b.retention_days} 天",
            expired,
            format_size(b.size_bytes),
            b.description or "-",
        ])

    click.echo(tabulate(
        table,
        headers=["ID", "名称", "备份日期", "保留期", "已过期", "大小", "描述"],
        tablefmt="grid",
    ))


@backup.command("register")
@click.option("--name", required=True, help="备份集名称（唯一）")
@click.option("--source", required=True, type=click.Path(exists=True), help="备份文件或目录路径")
@click.option("--checksum", required=True, help="备份校验值")
@click.option("--algorithm", default="md5", type=click.Choice(["md5", "sha1", "sha256", "sha512"]), help="校验算法")
@click.option("--retention", default=30, type=int, help="保留天数")
@click.option("--backup-date", default=None, help="备份日期（ISO 格式），默认为当前时间")
@click.option("--description", default=None, help="备份描述")
@pass_data_store
def backup_register(
    data_store: DataStore,
    name: str,
    source: str,
    checksum: str,
    algorithm: str,
    retention: int,
    backup_date: Optional[str],
    description: Optional[str],
):
    """登记新的备份集"""
    registration_service = BackupRegistrationService(data_store)

    try:
        backup_set = registration_service.register_backup(
            name=name,
            source_path=source,
            checksum=checksum,
            checksum_algorithm=algorithm,
            retention_days=retention,
            backup_date=backup_date,
            description=description,
        )
        click.echo(f"✓ 备份集登记成功")
        click.echo(f"  名称: {backup_set.name}")
        click.echo(f"  ID: {backup_set.id}")
        click.echo(f"  路径: {backup_set.source_path}")
        click.echo(f"  校验算法: {backup_set.checksum_algorithm}")
        click.echo(f"  保留期: {backup_set.retention_days} 天")
    except ChecksumMissingError as e:
        click.echo(f"✗ 登记失败: {e}", err=True)
        raise click.Abort()
    except BackupDrillError as e:
        click.echo(f"✗ 登记失败: {e}", err=True)
        raise click.Abort()


@backup.command("deactivate")
@click.option("--name", help="备份集名称")
@click.option("--id", "backup_id", help="备份集 ID")
@pass_data_store
def backup_deactivate(data_store: DataStore, name: Optional[str], backup_id: Optional[str]):
    """停用备份集（不会删除历史记录）"""
    if not name and not backup_id:
        click.echo("✗ 必须提供 --name 或 --id", err=True)
        raise click.Abort()

    backup = None
    if name:
        backup = data_store.get_backup_by_name(name)
    if backup_id:
        backup = data_store.get_backup_by_id(backup_id)

    if not backup:
        click.echo("✗ 未找到备份集", err=True)
        raise click.Abort()

    data_store.deactivate_backup(backup.id)
    click.echo(f"✓ 备份集已停用: {backup.name}")


@backup.command("calc-checksum")
@click.option("--path", required=True, type=click.Path(exists=True), help="要计算的文件或目录路径")
@click.option("--algorithm", default="md5", type=click.Choice(["md5", "sha1", "sha256", "sha512"]), help="校验算法")
def backup_calc_checksum(path: str, algorithm: str):
    """计算文件或目录的校验值"""
    checksum_service = ChecksumService()
    try:
        checksum = checksum_service.calculate_checksum(path, algorithm)
        click.echo(f"✓ 校验值计算完成")
        click.echo(f"  路径: {path}")
        click.echo(f"  算法: {algorithm}")
        click.echo(f"  校验值: {checksum}")
    except BackupDrillError as e:
        click.echo(f"✗ 计算失败: {e}", err=True)
        raise click.Abort()


@cli.group()
def drill():
    """恢复演练命令"""
    pass


@drill.command("run")
@click.option("--name", help="备份集名称")
@click.option("--id", "backup_id", help="备份集 ID")
@click.option("--restore-path", type=click.Path(), default=None, help="恢复目标目录（默认为临时目录）")
@click.option("--skip-checksum", is_flag=True, help="跳过校验和验证")
@pass_data_store
def drill_run(
    data_store: DataStore,
    name: Optional[str],
    backup_id: Optional[str],
    restore_path: Optional[str],
    skip_checksum: bool,
):
    """执行恢复演练"""
    if not name and not backup_id:
        click.echo("✗ 必须提供 --name 或 --id", err=True)
        raise click.Abort()

    backup = None
    if name:
        backup = data_store.get_backup_by_name(name)
    if backup_id:
        backup = data_store.get_backup_by_id(backup_id)

    if not backup:
        click.echo("✗ 未找到备份集", err=True)
        raise click.Abort()

    checksum_service = ChecksumService()
    recovery_service = RecoveryDrillService(data_store, checksum_service)

    click.echo(f"开始恢复演练: {backup.name}")
    click.echo(f"  备份日期: {backup.backup_date}")
    click.echo(f"  保留期: {backup.retention_days} 天")

    try:
        drill_record = recovery_service.run_drill(
            backup_set_id=backup.id,
            restore_path=restore_path,
            skip_checksum=skip_checksum,
        )

        click.echo("")
        click.echo("✓ 恢复演练成功！")
        click.echo(f"  演练 ID: {drill_record.id}")
        click.echo(f"  耗时: {drill_record.duration_seconds:.2f} 秒")
        click.echo(f"  恢复路径: {drill_record.restored_path}")
        if drill_record.checksum_verified is not None:
            click.echo(f"  校验和验证: {'通过' if drill_record.checksum_verified else '失败'}")

    except BackupExpiredError as e:
        click.echo("")
        click.echo(f"✗ 演练失败（备份已过期）: {e}", err=True)
        raise click.Abort()
    except DirectoryConflictError as e:
        click.echo("")
        click.echo(f"✗ 演练失败（目录冲突）: {e}", err=True)
        raise click.Abort()
    except BackupDrillError as e:
        click.echo("")
        click.echo(f"✗ 演练失败: {e}", err=True)
        raise click.Abort()


@drill.command("list")
@click.option("--limit", default=10, type=int, help="显示最近 N 条记录")
@click.option("--all", "show_all", is_flag=True, help="显示所有记录")
@pass_data_store
def drill_list(data_store: DataStore, limit: int, show_all: bool):
    """查看演练记录"""
    if show_all:
        drills = data_store.get_all_drills()
    else:
        drills = data_store.get_recent_drills(limit)

    if not drills:
        click.echo("暂无演练记录")
        return

    table = []
    for d in drills:
        backup = data_store.get_backup_by_id(d.backup_set_id)
        backup_name = backup.name if backup else "未知备份"

        status_map = {
            DrillStatus.SUCCESS.value: "成功",
            DrillStatus.FAILED.value: "失败",
            DrillStatus.IN_PROGRESS.value: "进行中",
            DrillStatus.PENDING.value: "待执行",
        }

        table.append([
            d.id[:8] + "...",
            backup_name,
            d.started_at[:19] if len(d.started_at) > 19 else d.started_at,
            status_map.get(d.status, d.status),
            f"{d.duration_seconds:.2f}s" if d.duration_seconds else "-",
            "是" if d.manually_confirmed else "-",
            "是" if d.re_backed_up else "-",
        ])

    click.echo(tabulate(
        table,
        headers=["ID", "备份集", "开始时间", "状态", "耗时", "人工确认", "已重备份"],
        tablefmt="grid",
    ))


@drill.command("mark-confirmed")
@click.option("--id", "drill_id", required=True, help="演练记录 ID")
@click.option("--notes", default=None, help="备注信息")
@pass_data_store
def drill_mark_confirmed(data_store: DataStore, drill_id: str, notes: Optional[str]):
    """标记演练为人工确认"""
    drill = data_store.get_drill_by_id(drill_id)
    if not drill:
        click.echo("✗ 未找到演练记录", err=True)
        raise click.Abort()

    drill.manually_confirmed = True
    if notes:
        drill.notes = notes
    data_store.save_drill(drill)

    click.echo(f"✓ 演练 {drill_id} 已标记为人工确认")


@drill.command("mark-rebacked")
@click.option("--id", "drill_id", required=True, help="演练记录 ID")
@click.option("--notes", default=None, help="备注信息")
@pass_data_store
def drill_mark_rebacked(data_store: DataStore, drill_id: str, notes: Optional[str]):
    """标记失败演练已重新备份"""
    drill = data_store.get_drill_by_id(drill_id)
    if not drill:
        click.echo("✗ 未找到演练记录", err=True)
        raise click.Abort()

    if drill.status != DrillStatus.FAILED.value:
        click.echo("⚠  警告：该演练记录不是失败状态")

    drill.re_backed_up = True
    if notes:
        if drill.notes:
            drill.notes = drill.notes + "; " + notes
        else:
            drill.notes = notes
    data_store.save_drill(drill)

    click.echo(f"✓ 演练 {drill_id} 已标记为已重新备份")


@drill.command("cleanup")
@click.option("--id", "drill_id", required=True, help="演练记录 ID")
@pass_data_store
def drill_cleanup(data_store: DataStore, drill_id: str):
    """清理演练产生的临时恢复文件"""
    checksum_service = ChecksumService()
    recovery_service = RecoveryDrillService(data_store, checksum_service)

    if recovery_service.cleanup_restore(drill_id):
        click.echo(f"✓ 已清理演练 {drill_id} 的恢复文件")
    else:
        click.echo("⚠  没有可清理的文件，或演练记录不存在")


@cli.group()
def analyze():
    """趋势分析命令"""
    pass


@analyze.command("trend")
@click.option("--name", help="备份集名称")
@click.option("--id", "backup_id", help="备份集 ID")
@click.option("--limit", default=10, type=int, help="分析最近 N 次演练")
@pass_data_store
def analyze_trend(data_store: DataStore, name: Optional[str], backup_id: Optional[str], limit: int):
    """分析备份集的恢复趋势"""
    if not name and not backup_id:
        click.echo("✗ 必须提供 --name 或 --id", err=True)
        raise click.Abort()

    backup = None
    if name:
        backup = data_store.get_backup_by_name(name)
    if backup_id:
        backup = data_store.get_backup_by_id(backup_id)

    if not backup:
        click.echo("✗ 未找到备份集", err=True)
        raise click.Abort()

    trend_service = TrendAnalysisService(data_store)
    result = trend_service.analyze_backup_trend(backup.id, limit)

    click.echo(f"趋势分析: {backup.name}")
    click.echo(f"  备份 ID: {backup.id}")
    click.echo("-" * 60)
    click.echo(f"  总演练次数: {result['total_drills']}")
    click.echo(f"  成功次数: {result.get('success_count', 0)}")
    click.echo(f"  失败次数: {result.get('failed_count', 0)}")
    click.echo(f"  成功率: {result['success_rate']}%")
    click.echo(f"  平均耗时: {result.get('avg_duration_seconds', 0)} 秒")

    trend_map = {
        "improving": "改善中",
        "worsening": "恶化中（需关注！）",
        "stable": "稳定",
        "insufficient_data": "数据不足",
        "no_data": "暂无演练数据",
    }
    click.echo(f"  趋势: {trend_map.get(result['trend'], result['trend'])}")

    if result["drills"]:
        click.echo("")
        click.echo("  历史记录:")
        table = []
        for d in result["drills"]:
            table.append([
                d["id"][:8] + "...",
                d["started_at"][:19],
                "成功" if d["status"] == DrillStatus.SUCCESS.value else "失败",
                f"{d['duration']:.2f}s" if d["duration"] else "-",
            ])
        click.echo(tabulate(
            table,
            headers=["    ID", "时间", "状态", "耗时"],
            tablefmt="simple",
        ))


@analyze.command("overview")
@pass_data_store
def analyze_overview(data_store: DataStore):
    """查看整体统计概览"""
    trend_service = TrendAnalysisService(data_store)
    stats = trend_service.get_overall_stats()

    click.echo("整体统计概览")
    click.echo("=" * 60)
    click.echo(f"总演练次数: {stats['total_drills']}")
    click.echo(f"  成功: {stats['success_drills']}")
    click.echo(f"  失败: {stats['failed_drills']}")
    click.echo(f"  成功率: {stats['success_rate']}%")
    click.echo("")
    click.echo(f"活跃备份集: {stats['active_backups']}")
    click.echo(f"  已过期: {stats['expired_backups']}")
    click.echo(f"  从未演练: {stats['never_drilled_backups']}")
    click.echo("")
    if stats["backups_requiring_attention"] > 0:
        click.echo(f"⚠  需要关注的备份: {stats['backups_requiring_attention']} 个")
    else:
        click.echo("✓ 所有备份状态良好")


@cli.command("report")
@click.option("--output", "-o", type=click.Path(), default=None, help="输出文件路径")
@pass_data_store
def generate_report(data_store: DataStore, output: Optional[str]):
    """生成完整报告"""
    trend_service = TrendAnalysisService(data_store)
    report_service = ReportService(data_store, trend_service)

    report = report_service.generate_text_report(output)

    if output:
        click.echo(f"✓ 报告已保存到: {output}")
    else:
        click.echo(report)


def format_size(bytes_size: int) -> str:
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} PB"


def main():
    cli()


if __name__ == "__main__":
    main()
