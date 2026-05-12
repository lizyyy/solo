import os
import sys
from datetime import datetime
from typing import Optional, List

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from .loader import DataLoader
from .analyzer import LockAnalyzer
from .releaser import ReleaseChecker
from .models import (
    LockStatus,
    ReleaseResult,
    ReleaseRecord,
    AbnormalReport,
)

console = Console()


def get_status_color(status: LockStatus) -> str:
    mapping = {
        LockStatus.NORMAL: "green",
        LockStatus.SUSPICIOUS: "yellow",
        LockStatus.LEAK: "red",
        LockStatus.RELEASED: "dim",
    }
    return mapping.get(status, "white")


def get_status_text(status: LockStatus) -> str:
    mapping = {
        LockStatus.NORMAL: "正常",
        LockStatus.SUSPICIOUS: "可疑",
        LockStatus.LEAK: "疑似泄漏",
        LockStatus.RELEASED: "已释放",
    }
    return mapping.get(status, "未知")


def get_risk_stars(level: int) -> str:
    return "★" * level + "☆" * (3 - level)


@click.group()
@click.option(
    "--data-dir",
    "-d",
    default="./data",
    help="数据目录，包含锁快照、心跳、日志等JSON文件",
    show_default=True,
)
@click.option(
    "--current-time",
    "-t",
    default=None,
    help="指定当前时间（用于调试），格式: YYYY-MM-DDTHH:MM:SS",
)
@click.pass_context
def cli(ctx, data_dir, current_time):
    """分布式锁泄漏排查 CLI 工具
    
    用于分析分布式锁是否存在泄漏，支持扫描、详情查看、安全释放等操作。
    """
    ctx.ensure_object(dict)
    ctx.obj["data_dir"] = data_dir
    if current_time:
        ctx.obj["current_time"] = datetime.fromisoformat(current_time)
    else:
        ctx.obj["current_time"] = datetime.now()


@cli.command()
@click.option(
    "--filter",
    "-f",
    type=click.Choice(["all", "suspicious", "leak", "normal"]),
    default="all",
    help="按状态过滤",
)
@click.option(
    "--min-risk",
    "-r",
    type=int,
    default=0,
    help="最低风险等级 (0-3)",
)
@click.pass_context
def scan(ctx, filter, min_risk):
    """扫描所有锁，列出状态和风险等级"""
    data_dir = ctx.obj["data_dir"]
    current_time = ctx.obj["current_time"]

    loader = DataLoader(data_dir)
    data_source = loader.load()
    analyzer = LockAnalyzer(data_source, current_time)

    analyses = analyzer.analyze_all()

    if filter != "all":
        status_map = {
            "normal": LockStatus.NORMAL,
            "suspicious": LockStatus.SUSPICIOUS,
            "leak": LockStatus.LEAK,
        }
        target_status = status_map[filter]
        analyses = [a for a in analyses if a.status == target_status]

    if min_risk > 0:
        analyses = [a for a in analyses if a.risk_level >= min_risk]

    if not analyses:
        console.print("[yellow]没有找到匹配的锁记录[/yellow]")
        return

    table = Table(title="锁扫描结果", show_lines=True)
    table.add_column("锁键", style="cyan", no_wrap=True)
    table.add_column("状态", style="bold")
    table.add_column("持有时间", justify="right")
    table.add_column("风险", justify="center")
    table.add_column("策略", no_wrap=True)
    table.add_column("最后心跳", no_wrap=True)

    for analysis in analyses:
        status_color = get_status_color(analysis.status)
        status_text = get_status_text(analysis.status)
        
        policy_name = analysis.policy.task_name if analysis.policy else "-"
        
        heartbeat_text = "-"
        if analysis.last_heartbeat:
            heartbeat_age = int((current_time - analysis.last_heartbeat.timestamp).total_seconds())
            if heartbeat_age < 60:
                heartbeat_text = f"{heartbeat_age}秒前"
            elif heartbeat_age < 3600:
                heartbeat_text = f"{heartbeat_age // 60}分前"
            else:
                heartbeat_text = f"[{analysis.last_heartbeat.timestamp.strftime('%H:%M')}]"

        table.add_row(
            analysis.lock_key,
            f"[{status_color}]{status_text}[/{status_color}]",
            analysis.age_human,
            get_risk_stars(analysis.risk_level),
            policy_name,
            heartbeat_text,
        )

    console.print(table)

    summary = analyzer.get_summary(analyses)
    console.print(f"\n总计: [green]正常 {summary.get('normal', 0)}[/green] | [yellow]可疑 {summary.get('suspicious', 0)}[/yellow] | [red]疑似泄漏 {summary.get('leak', 0)}[/red]")
    console.print("\n使用 [cyan]lock-leak explain <lock-key>[/cyan] 查看详情")


@cli.command()
@click.argument("lock_key")
@click.pass_context
def explain(ctx, lock_key):
    """详细分析指定锁的情况"""
    data_dir = ctx.obj["data_dir"]
    current_time = ctx.obj["current_time"]

    loader = DataLoader(data_dir)
    data_source = loader.load()
    analyzer = LockAnalyzer(data_source, current_time)

    snapshot = None
    for s in data_source.snapshots:
        if s.lock_key == lock_key:
            snapshot = s
            break

    if not snapshot:
        console.print(f"[red]未找到锁: {lock_key}[/red]")
        sys.exit(1)

    analysis = analyzer.analyze_lock(snapshot)

    console.print(Panel.fit(
        f"[bold cyan]锁详情: {lock_key}[/bold cyan]",
        border_style="cyan",
    ))

    info_table = Table(show_header=False, show_lines=False)
    info_table.add_column("属性", style="bold")
    info_table.add_column("值")

    info_table.add_row("持有者ID", snapshot.holder_id)
    info_table.add_row("持有者名称", snapshot.holder_name)
    info_table.add_row("持有者IP", snapshot.holder_ip)
    info_table.add_row("进程PID", str(snapshot.holder_pid))
    info_table.add_row("获取时间", str(snapshot.acquired_at))
    info_table.add_row("过期时间", str(snapshot.expire_at))
    info_table.add_row("已持有", analysis.age_human)
    info_table.add_row("状态", f"[{get_status_color(analysis.status)}]{get_status_text(analysis.status)}[/{get_status_color(analysis.status)}]")
    info_table.add_row("风险等级", get_risk_stars(analysis.risk_level))

    console.print(info_table)

    if analysis.policy:
        console.print("\n[bold]匹配的锁策略:[/bold]")
        policy_table = Table(show_header=False, show_lines=False)
        policy_table.add_column("属性", style="bold")
        policy_table.add_column("值")
        policy_table.add_row("任务名", analysis.policy.task_name)
        policy_table.add_row("描述", analysis.policy.description)
        policy_table.add_row("最大执行时间", str(analysis.policy.max_execution_time) + "秒")
        policy_table.add_row("心跳间隔", str(analysis.policy.heartbeat_interval) + "秒")
        policy_table.add_row("心跳超时", str(analysis.policy.heartbeat_timeout) + "秒")
        console.print(policy_table)
    else:
        console.print("\n[yellow]未找到匹配的锁策略配置[/yellow]")

    if analysis.last_heartbeat:
        heartbeat_age = int((current_time - analysis.last_heartbeat.timestamp).total_seconds())
        console.print(f"\n[bold]最后心跳:[/bold] {analysis.last_heartbeat.timestamp} ({heartbeat_age}秒前)，状态={analysis.last_heartbeat.status}")
        if analysis.last_heartbeat.load is not None:
            console.print(f"  负载={analysis.last_heartbeat.load}, 内存={analysis.last_heartbeat.memory_usage}%")
    else:
        console.print("\n[yellow]无心跳数据[/yellow]")

    if analysis.last_execution_log:
        console.print(f"\n[bold]最后执行日志:[/bold] {analysis.last_execution_log.timestamp} - {analysis.last_execution_log.event}")
        if analysis.last_execution_log.details:
            for k, v in analysis.last_execution_log.details.items():
                console.print(f"  {k}={v}")

    if analysis.reasons:
        console.print("\n[bold red]分析原因:[/bold red]")
        for i, reason in enumerate(analysis.reasons, 1):
            console.print(f"  {i}. {reason}")

    if analysis.recommendations:
        console.print("\n[bold green]建议:[/bold green]")
        for i, rec in enumerate(analysis.recommendations, 1):
            console.print(f"  {i}. {rec}")

    prev_release = None
    for r in data_source.release_history:
        if r.lock_key == lock_key:
            prev_release = r
            break

    if prev_release:
        console.print(f"\n[yellow]⚠️  该锁已有释放记录: {prev_release.release_time}, 结果={prev_release.result.value}[/yellow]")


@cli.command()
@click.argument("lock_key")
@click.option(
    "--force",
    is_flag=True,
    help="跳过所有安全检查（高危，仅紧急情况使用）",
)
@click.option(
    "--yes",
    "-y",
    is_flag=True,
    help="跳过人工确认（需配合 --force 使用）",
)
@click.pass_context
def release(ctx, lock_key, force, yes):
    """安全释放指定锁"""
    data_dir = ctx.obj["data_dir"]
    current_time = ctx.obj["current_time"]

    loader = DataLoader(data_dir)
    data_source = loader.load()
    analyzer = LockAnalyzer(data_source, current_time)
    checker = ReleaseChecker(data_source, analyzer, current_time)

    prev_release = checker.get_previous_release(lock_key)
    if prev_release:
        console.print(f"\n[yellow]⚠️  该锁已有释放记录[/yellow]")
        console.print(f"  释放时间: {prev_release.release_time}")
        console.print(f"  结果: {prev_release.result.value}")
        console.print(f"  确认码: {prev_release.confirmation_code}")
        
        if prev_release.result == ReleaseResult.SUCCESS:
            console.print("\n[green]该锁已成功释放，无需重复操作[/green]")
        elif prev_release.result == ReleaseResult.ABORTED:
            console.print("\n[yellow]上次用户主动中止，可重新执行[/yellow]")
        elif prev_release.result == ReleaseResult.HEARTBEAT_ACTIVE:
            console.print("\n[red]上次因心跳活跃被阻止，确认进程已死再执行[/red]")
        
        if prev_release.result in [ReleaseResult.SUCCESS, ReleaseResult.ALREADY_RELEASED]:
            console.print("\n[dim]返回已有处理结果，不执行新操作[/dim]")
            return

    snapshot = checker.find_snapshot(lock_key)
    if not snapshot:
        console.print(f"[red]未找到锁: {lock_key}[/red]")
        sys.exit(1)

    analysis = analyzer.analyze_lock(snapshot)

    if analysis.status == LockStatus.NORMAL and not force:
        console.print(f"[yellow]锁状态为正常，不建议释放[/yellow]")
        if not click.confirm("确定要继续吗？"):
            return

    console.print(Panel.fit(
        f"[bold red]释放锁安全检查[/bold red]\n[cyan]{lock_key}[/cyan]",
        border_style="red",
    ))

    if force:
        console.print("[yellow]⚠️  已启用 --force，跳过安全检查[/yellow]")
        checks, can_release = [], True
    else:
        checks, can_release = checker.run_release_checks(snapshot)

        check_table = Table(title="安全检查清单", show_lines=True)
        check_table.add_column("#", justify="center", style="dim")
        check_table.add_column("检查项")
        check_table.add_column("结果")
        check_table.add_column("详情")

        for i, check in enumerate(checks, 1):
            result_icon = "[green]✓[/green]" if check["passed"] else "[red]✗[/red]"
            if check.get("blocking"):
                result_icon += " [red][阻塞][/red]"
            
            details = check.get("details", "")
            if check.get("note"):
                details += f"\n[yellow]{check['note']}[/yellow]"

            check_table.add_row(
                str(i),
                check["name"],
                result_icon + " " + check["message"],
                details,
            )

        console.print(check_table)

        if not can_release:
            console.print("\n[red]❌  检查未通过，存在阻塞项[/red]")
            confirmation_code = checker.generate_confirmation_code(lock_key, snapshot.holder_id)
            
            report = AbnormalReport(
                type="release_check_failed",
                lock_key=lock_key,
                message="释放锁检查未通过，存在阻塞项（通常是心跳活跃）",
                timestamp=current_time,
                details={"checks": checks, "confirmation_code": confirmation_code},
            )
            loader.save_abnormal_report(report)
            
            console.print(f"\n确认码: [bold cyan]{confirmation_code}[/bold cyan]")
            console.print("如果你确认进程已死、需要强制释放，请输入确认码后再次运行:")
            console.print(f"  [cyan]lock-leak release {lock_key} --force[/cyan]")
            
            record = ReleaseRecord(
                lock_key=lock_key,
                release_time=current_time,
                result=ReleaseResult.HEARTBEAT_ACTIVE,
                confirmation_code=confirmation_code,
                checks=checks,
                notes="因心跳活跃被阻止",
            )
            loader.save_release_record(record)
            return

        if not analysis.policy:
            console.print("\n[yellow]⚠️  警告: 未找到匹配的锁策略[/yellow]")
            report = AbnormalReport(
                type="policy_mismatch",
                lock_key=lock_key,
                message="未找到匹配的锁策略配置",
                timestamp=current_time,
                details={},
            )
            loader.save_abnormal_report(report)

    confirmation_code = checker.generate_confirmation_code(lock_key, snapshot.holder_id)
    console.print(f"\n[bold]确认码:[/bold] [cyan]{confirmation_code}[/cyan]")

    user_confirmation = None
    if yes and force:
        user_confirmation = "AUTO_CONFIRMED_WITH_FORCE"
        console.print("[yellow]已使用 --yes --force 自动确认[/yellow]")
    else:
        console.print("\n[bold]请仔细阅读以上信息后确认:[/bold]")
        console.print("  1. 确认持有者进程已崩溃或已停止")
        console.print("  2. 确认释放锁不会导致数据不一致")
        console.print("  3. 输入确认码以确认释放\n")
        
        user_input = click.prompt("请输入确认码", type=str)
        if user_input.strip().upper() != confirmation_code:
            console.print("[red]确认码不匹配，操作中止[/red]")
            record = ReleaseRecord(
                lock_key=lock_key,
                release_time=current_time,
                result=ReleaseResult.ABORTED,
                confirmation_code=confirmation_code,
                checks=checks,
                user_confirmation=user_input,
                notes="确认码不匹配",
            )
            loader.save_release_record(record)
            sys.exit(1)
        user_confirmation = user_input.strip().upper()

    console.print("\n[green]✓ 确认通过[/green]")
    console.print(f"[bold]执行锁释放: {lock_key}[/bold]")

    console.print("\n[dim]模拟释放操作...（实际环境这里会调用 Redis/数据库删除锁）[/dim]")

    record = ReleaseRecord(
        lock_key=lock_key,
        release_time=current_time,
        result=ReleaseResult.SUCCESS,
        confirmation_code=confirmation_code,
        checks=checks,
        user_confirmation=user_confirmation,
    )
    loader.save_release_record(record)

    console.print("\n[green]✓ 锁已释放[/green]")
    console.print("\n[yellow]⚠️  请检查任务是否已恢复执行[/yellow]")
    console.print("  - 若任务已恢复: 问题解决")
    console.print("  - 若任务仍未恢复: 可能不是锁泄漏导致，请排查其他原因（数据库、网络、代码逻辑等）")
    console.print("\n使用 [cyan]lock-leak report[/cyan] 查看异常报告")


@cli.command()
@click.argument("lock_key", required=False)
@click.pass_context
def history(ctx, lock_key):
    """查看锁释放历史"""
    data_dir = ctx.obj["data_dir"]

    loader = DataLoader(data_dir)
    data_source = loader.load()

    records = data_source.release_history
    if lock_key:
        records = [r for r in records if r.lock_key == lock_key]

    if not records:
        console.print("[yellow]暂无释放历史记录[/yellow]")
        return

    table = Table(title="锁释放历史", show_lines=True)
    table.add_column("时间", no_wrap=True)
    table.add_column("锁键", style="cyan")
    table.add_column("结果")
    table.add_column("确认码")
    table.add_column("用户确认")
    table.add_column("备注")

    for record in records:
        result_color = "green" if record.result == ReleaseResult.SUCCESS else "yellow"
        user_confirm = record.user_confirmation or "-"
        notes = record.notes or "-"

        table.add_row(
            str(record.release_time),
            record.lock_key,
            f"[{result_color}]{record.result.value}[/{result_color}]",
            record.confirmation_code,
            user_confirm,
            notes,
        )

    console.print(table)


@cli.command()
@click.pass_context
def report(ctx):
    """查看异常报告汇总"""
    data_dir = ctx.obj["data_dir"]

    loader = DataLoader(data_dir)
    data_source = loader.load()

    console.print(Panel.fit("[bold]异常报告汇总[/bold]", border_style="red"))

    if data_source.release_history:
        console.print(f"\n[bold]释放操作记录:[/bold] {len(data_source.release_history)} 条")
        success_count = sum(1 for r in data_source.release_history if r.result == ReleaseResult.SUCCESS)
        aborted_count = sum(1 for r in data_source.release_history if r.result == ReleaseResult.ABORTED)
        heartbeat_blocked = sum(1 for r in data_source.release_history if r.result == ReleaseResult.HEARTBEAT_ACTIVE)
        console.print(f"  成功: {success_count}, 用户中止: {aborted_count}, 心跳阻止: {heartbeat_blocked}")

    if not data_source.abnormal_reports:
        console.print("\n[green]无异常报告[/green]")
        return

    console.print(f"\n[bold]异常事件:[/bold] {len(data_source.abnormal_reports)} 条")

    table = Table(title="异常详情", show_lines=True)
    table.add_column("时间", no_wrap=True)
    table.add_column("类型")
    table.add_column("锁键", style="cyan")
    table.add_column("消息")

    for report in data_source.abnormal_reports:
        type_color = {
            "release_check_failed": "red",
            "policy_mismatch": "yellow",
            "heartbeat_missing": "red",
            "task_not_recovered": "magenta",
        }.get(report.type, "white")

        table.add_row(
            str(report.timestamp),
            f"[{type_color}]{report.type}[/{type_color}]",
            report.lock_key,
            report.message,
        )

    console.print(table)


@cli.command()
@click.pass_context
def samples(ctx):
    """生成测试样例数据"""
    data_dir = ctx.obj["data_dir"]
    current_time = ctx.obj["current_time"]

    import json
    import os
    from datetime import timedelta

    os.makedirs(data_dir, exist_ok=True)

    policies = [
        {
            "task_name": "daily_etl_job",
            "lock_key_pattern": "lock:etl:daily:*",
            "max_execution_time": 3600,
            "heartbeat_interval": 60,
            "heartbeat_timeout": 300,
            "allowed_holders": ["etl-worker-01", "etl-worker-02"],
            "description": "每日 ETL 任务，预期执行1小时内完成",
        },
        {
            "task_name": "long_report_job",
            "lock_key_pattern": "lock:report:monthly:*",
            "max_execution_time": 7200,
            "heartbeat_interval": 120,
            "heartbeat_timeout": 600,
            "allowed_holders": ["report-worker-01"],
            "description": "月度报表任务，允许长时间运行",
        },
        {
            "task_name": "quick_cleanup",
            "lock_key_pattern": "lock:cleanup:*",
            "max_execution_time": 300,
            "heartbeat_interval": 30,
            "heartbeat_timeout": 120,
            "allowed_holders": ["cleanup-worker-*"],
            "description": "快速清理任务，5分钟内应完成",
        },
    ]

    t_30min = (current_time - timedelta(minutes=30)).replace(second=0, microsecond=0)
    t_12h = (current_time - timedelta(hours=12)).replace(second=0, microsecond=0)
    t_26h = (current_time - timedelta(hours=26)).replace(second=0, microsecond=0)
    t_8min = (current_time - timedelta(minutes=8)).replace(second=0, microsecond=0)
    t_3min = (current_time - timedelta(minutes=3)).replace(second=0, microsecond=0)
    t_5h = (current_time - timedelta(hours=5)).replace(second=0, microsecond=0)
    t_now = current_time.replace(second=0, microsecond=0)
    t_5sec = (t_now + timedelta(seconds=5))

    snapshots = [
        {
            "lock_key": "lock:etl:daily:20240115",
            "lock_value": "uuid-001",
            "holder_id": "etl-worker-01",
            "holder_name": "ETL Worker Node 1",
            "holder_ip": "192.168.1.10",
            "holder_pid": 12345,
            "acquired_at": t_30min.isoformat(),
            "expire_at": t_30min.isoformat(),
            "last_heartbeat_at": t_now.isoformat(),
            "metadata": {"task_version": "v2.1.0"},
        },
        {
            "lock_key": "lock:report:monthly:202401",
            "lock_value": "uuid-002",
            "holder_id": "report-worker-01",
            "holder_name": "Report Worker Node 1",
            "holder_ip": "192.168.1.20",
            "holder_pid": 54321,
            "acquired_at": t_12h.isoformat(),
            "expire_at": t_12h.isoformat(),
            "last_heartbeat_at": t_now.isoformat(),
            "metadata": {"retry_count": 0},
        },
        {
            "lock_key": "lock:etl:daily:20240114",
            "lock_value": "uuid-003",
            "holder_id": "etl-worker-02",
            "holder_name": "ETL Worker Node 2",
            "holder_ip": "192.168.1.11",
            "holder_pid": 99999,
            "acquired_at": t_26h.isoformat(),
            "expire_at": t_26h.isoformat(),
            "last_heartbeat_at": (t_26h + timedelta(hours=2, minutes=30)).isoformat(),
            "metadata": {"task_version": "v2.1.0", "crash_signal": "SIGKILL"},
        },
        {
            "lock_key": "lock:cleanup:temp_files",
            "lock_value": "uuid-004",
            "holder_id": "cleanup-worker-01",
            "holder_name": "Cleanup Worker 1",
            "holder_ip": "192.168.1.30",
            "holder_pid": 88888,
            "acquired_at": t_8min.isoformat(),
            "expire_at": t_8min.isoformat(),
            "last_heartbeat_at": t_3min.isoformat(),
            "metadata": {},
        },
        {
            "lock_key": "lock:unknown:orphan_key",
            "lock_value": "uuid-999",
            "holder_id": "mystery-worker",
            "holder_name": "Unknown Worker",
            "holder_ip": "10.0.0.99",
            "holder_pid": 77777,
            "acquired_at": t_5h.isoformat(),
            "expire_at": t_5h.isoformat(),
            "last_heartbeat_at": None,
            "metadata": {},
        },
    ]

    heartbeats = [
        {"holder_id": "etl-worker-01", "timestamp": t_now.isoformat(), "status": "alive", "load": 0.8, "memory_usage": 45},
        {"holder_id": "report-worker-01", "timestamp": t_now.isoformat(), "status": "alive", "load": 2.5, "memory_usage": 78},
        {"holder_id": "etl-worker-02", "timestamp": (t_26h + timedelta(hours=2, minutes=30)).isoformat(), "status": "alive", "load": 1.2, "memory_usage": 55},
        {"holder_id": "cleanup-worker-01", "timestamp": t_3min.isoformat(), "status": "alive", "load": 0.3, "memory_usage": 20},
    ]

    execution_logs = [
        {"lock_key": "lock:etl:daily:20240115", "holder_id": "etl-worker-01", "event": "task_started", "timestamp": (t_30min + timedelta(seconds=5)).isoformat(), "details": {"batch_id": "batch-001"}},
        {"lock_key": "lock:etl:daily:20240115", "holder_id": "etl-worker-01", "event": "progress", "timestamp": (t_now + timedelta(seconds=30)).isoformat(), "details": {"stage": "extract", "progress": 45}},
        {"lock_key": "lock:report:monthly:202401", "holder_id": "report-worker-01", "event": "task_started", "timestamp": (t_12h + timedelta(minutes=5)).isoformat(), "details": {"report_type": "finance"}},
        {"lock_key": "lock:report:monthly:202401", "holder_id": "report-worker-01", "event": "progress", "timestamp": t_now.isoformat(), "details": {"stage": "aggregation", "progress": 80}},
        {"lock_key": "lock:etl:daily:20240114", "holder_id": "etl-worker-02", "event": "task_started", "timestamp": (t_26h + timedelta(minutes=5)).isoformat(), "details": {"batch_id": "batch-000"}},
        {"lock_key": "lock:cleanup:temp_files", "holder_id": "cleanup-worker-01", "event": "task_started", "timestamp": (t_8min + timedelta(seconds=5)).isoformat(), "details": {"target_dir": "/tmp/data"}},
    ]

    with open(os.path.join(data_dir, "lock_policies.json"), "w", encoding="utf-8") as f:
        json.dump(policies, f, ensure_ascii=False, indent=2)

    with open(os.path.join(data_dir, "lock_snapshots.json"), "w", encoding="utf-8") as f:
        json.dump(snapshots, f, ensure_ascii=False, indent=2)

    with open(os.path.join(data_dir, "heartbeats.json"), "w", encoding="utf-8") as f:
        json.dump(heartbeats, f, ensure_ascii=False, indent=2)

    with open(os.path.join(data_dir, "execution_logs.json"), "w", encoding="utf-8") as f:
        json.dump(execution_logs, f, ensure_ascii=False, indent=2)

    console.print(Panel.fit("[bold green]样例数据已生成[/bold green]", border_style="green"))
    console.print(f"\n数据目录: {data_dir}")
    console.print("\n生成的样例包含:")
    console.print("  1. [green]lock:etl:daily:20240115[/green] - 正常运行中的任务（约30分钟）")
    console.print("  2. [green]lock:report:monthly:202401[/green] - 正常长任务（约12小时，心跳活跃）")
    console.print("  3. [red]lock:etl:daily:20240114[/red] - 疑似泄漏（进程崩溃遗留锁，心跳超时）")
    console.print("  4. [yellow]lock:cleanup:temp_files[/yellow] - 心跳延迟（超时未到，可疑）")
    console.print("  5. [red]lock:unknown:orphan_key[/red] - 无策略无心跳，高风险泄漏")
    console.print("\n现在运行: [cyan]lock-leak scan[/cyan] 查看扫描结果")


if __name__ == "__main__":
    cli()
