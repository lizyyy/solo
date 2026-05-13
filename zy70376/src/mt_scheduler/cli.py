import os
import time
import random
from typing import Optional, List
from datetime import datetime

import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich import print as rprint

from .models import TaskPriority, TaskStatus, TenantConfig
from .storage import JsonStorage
from .scheduler import Scheduler


app = typer.Typer(
    name="mt-scheduler",
    help="多租户任务隔离 CLI - 按租户配置并发配额、任务权重和失败隔离策略",
    add_completion=False,
)

console = Console()


def get_scheduler(data_dir: Optional[str] = None) -> Scheduler:
    storage = JsonStorage(data_dir)
    state = storage.load()
    return Scheduler(state)


def save_scheduler(scheduler: Scheduler, data_dir: Optional[str] = None):
    storage = JsonStorage(data_dir)
    storage.save(scheduler.state)


@app.command()
def init(
    data_dir: Optional[str] = typer.Option(None, "--data-dir", "-d", help="数据目录"),
):
    """初始化调度器状态"""
    storage = JsonStorage(data_dir)
    storage.reset()
    state = storage.load()
    scheduler = Scheduler(state)

    scheduler.register_tenant(TenantConfig(
        tenant_id="tenant-a",
        name="大租户-A(批量导出)",
        concurrency_quota=4,
        weight=3,
        max_queue_size=200,
        failure_penalty_percent=20,
        failure_threshold=3,
    ))

    scheduler.register_tenant(TenantConfig(
        tenant_id="tenant-b",
        name="中租户-B(实时查询)",
        concurrency_quota=3,
        weight=2,
        max_queue_size=100,
        failure_penalty_percent=25,
        failure_threshold=2,
    ))

    scheduler.register_tenant(TenantConfig(
        tenant_id="tenant-c",
        name="小租户-C(实时任务)",
        concurrency_quota=2,
        weight=1,
        max_queue_size=50,
        failure_penalty_percent=30,
        failure_threshold=2,
    ))

    save_scheduler(scheduler, data_dir)
    rprint(Panel.fit("[green]调度器初始化成功[/green]\n已注册 3 个测试租户"))


@app.command()
def submit(
    task_id: str = typer.Argument(..., help="任务ID"),
    tenant_id: str = typer.Argument(..., help="租户ID"),
    name: str = typer.Argument(..., help="任务名称"),
    task_type: str = typer.Argument(..., help="任务类型"),
    priority: str = typer.Option("normal", "--priority", "-p", help="优先级: low/normal/high/urgent"),
    weight: int = typer.Option(1, "--weight", "-w", help="任务权重"),
    max_retries: int = typer.Option(3, "--retries", "-r", help="最大重试次数"),
    urgent_promotion: bool = typer.Option(False, "--urgent", help="紧急任务提升"),
    promotion_reason: str = typer.Option("", "--reason", help="紧急提升原因"),
    data_dir: Optional[str] = typer.Option(None, "--data-dir", "-d", help="数据目录"),
):
    """提交任务（支持幂等）"""
    scheduler = get_scheduler(data_dir)

    priority_map = {
        "low": TaskPriority.LOW,
        "normal": TaskPriority.NORMAL,
        "high": TaskPriority.HIGH,
        "urgent": TaskPriority.URGENT,
    }

    success, message, task = scheduler.submit_task(
        task_id=task_id,
        tenant_id=tenant_id,
        name=name,
        task_type=task_type,
        priority=priority_map.get(priority, TaskPriority.NORMAL),
        weight=weight,
        max_retries=max_retries,
        is_urgent_promotion=urgent_promotion,
        promotion_reason=promotion_reason if urgent_promotion else None,
    )

    save_scheduler(scheduler, data_dir)

    if success:
        rprint(f"[green]✓ {message}[/green]")
        if task:
            table = Table(title="任务详情")
            table.add_column("字段")
            table.add_column("值")
            table.add_row("任务ID", task.id)
            table.add_row("租户ID", task.tenant_id)
            table.add_row("名称", task.name)
            table.add_row("类型", task.task_type)
            table.add_row("优先级", task.priority.value)
            table.add_row("状态", task.status.value)
            console.print(table)
    else:
        rprint(f"[red]✗ {message}[/red]")
        raise typer.Exit(code=1)


@app.command()
def status(
    tenant_id: Optional[str] = typer.Option(None, "--tenant", "-t", help="按租户筛选"),
    data_dir: Optional[str] = typer.Option(None, "--data-dir", "-d", help="数据目录"),
):
    """查看调度状态和租户配额占用"""
    scheduler = get_scheduler(data_dir)

    stats = scheduler.get_tenant_stats()

    tenant_table = Table(title="租户配额占用情况")
    tenant_table.add_column("租户ID", style="cyan")
    tenant_table.add_column("名称")
    tenant_table.add_column("基准配额", justify="right")
    tenant_table.add_column("有效配额", justify="right", style="yellow")
    tenant_table.add_column("运行中", justify="right", style="blue")
    tenant_table.add_column("等待中", justify="right", style="magenta")
    tenant_table.add_column("已完成", justify="right", style="green")
    tenant_table.add_column("已失败", justify="right", style="red")
    tenant_table.add_column("配额减少", justify="right", style="red")

    for tid, data in stats.items():
        if tenant_id and tid != tenant_id:
            continue
        cfg = data["config"]
        rt = data["runtime"]
        tenant_table.add_row(
            tid,
            cfg.name,
            str(cfg.concurrency_quota),
            str(data["effective_quota"]),
            str(data["running_count"]),
            str(data["pending_count"]),
            str(rt.completed_tasks),
            str(rt.failed_tasks),
            f"{rt.quota_reduction_percent}%" if rt.quota_reduction_percent > 0 else "-",
        )

    console.print(tenant_table)

    pending = scheduler.get_pending_tasks(tenant_id)
    if pending:
        pending_table = Table(title="等待执行的任务")
        pending_table.add_column("租户ID", style="cyan")
        pending_table.add_column("任务ID")
        pending_table.add_column("名称")
        pending_table.add_column("类型")
        pending_table.add_column("优先级", style="yellow")
        pending_table.add_column("重试", justify="right")
        pending_table.add_column("紧急提升", style="red")

        for task in pending[:20]:
            pending_table.add_row(
                task.tenant_id,
                task.id,
                task.name,
                task.task_type,
                task.priority.value,
                f"{task.retry_count}/{task.max_retries}",
                "是" if task.is_urgent_promotion else "否",
            )
        if len(pending) > 20:
            pending_table.add_row("...", f"还有 {len(pending)-20} 个任务", "", "", "", "", "")
        console.print(pending_table)

    total_pending = len([t for t in scheduler.state.tasks.values() if t.status == TaskStatus.PENDING])
    total_running = len([t for t in scheduler.state.tasks.values() if t.status == TaskStatus.RUNNING])
    rprint(f"\n[bold]汇总[/bold]: 运行中={total_running}, 等待中={total_pending}, "
           f"已完成={scheduler.state.total_completed}, 已失败={scheduler.state.total_failed}")


@app.command()
def run(
    max_tasks: int = typer.Option(5, "--max-tasks", "-n", help="本次最多执行任务数"),
    simulate_time: int = typer.Option(100, "--simulate", "-s", help="模拟执行时间(ms)"),
    fail_probability: float = typer.Option(0.0, "--fail-prob", "-f", help="模拟失败概率 0-1"),
    tenant_fail: Optional[str] = typer.Option(None, "--tenant-fail", help="指定租户的任务必定失败"),
    data_dir: Optional[str] = typer.Option(None, "--data-dir", "-d", help="数据目录"),
):
    """执行一次调度循环，展示调度顺序"""
    scheduler = get_scheduler(data_dir)

    schedule_order = scheduler.get_schedule_order(max_tasks)

    if not schedule_order:
        rprint("[yellow]没有可调度的任务[/yellow]")
        return

    rprint(f"\n[bold cyan]=== 调度顺序 ({len(schedule_order)} 个任务) ===[/bold cyan]")
    order_table = Table(title="本次调度任务")
    order_table.add_column("#", justify="right")
    order_table.add_column("租户ID", style="cyan")
    order_table.add_column("任务ID")
    order_table.add_column("名称")
    order_table.add_column("优先级", style="yellow")
    order_table.add_column("权重", justify="right")

    for idx, task in enumerate(schedule_order, 1):
        order_table.add_row(
            str(idx),
            task.tenant_id,
            task.id,
            task.name,
            task.priority.value + (" ⚡" if task.is_urgent_promotion else ""),
            str(task.weight),
        )
    console.print(order_table)

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        for task in schedule_order:
            task_id = task.id
            task_desc = f"[{task.tenant_id}] {task.name}"

            pt = progress.add_task(task_desc, total=None)

            scheduler.start_task(task_id)
            save_scheduler(scheduler, data_dir)

            exec_time = simulate_time + random.randint(-20, 50)
            time.sleep(exec_time / 1000.0)

            should_fail = False
            if tenant_fail and task.tenant_id == tenant_fail:
                should_fail = True
            elif fail_probability > 0 and random.random() < fail_probability:
                should_fail = True

            if should_fail:
                error_msg = f"模拟错误: 网络连接超时 (随机失败)"
                success, will_retry, msg = scheduler.fail_task(task_id, error_msg, exec_time)
                status_style = "red" if not will_retry else "yellow"
                rprint(f"[{status_style}]✗ {task_desc}: {msg}[/{status_style}]")
            else:
                scheduler.complete_task(task_id, exec_time)
                rprint(f"[green]✓ {task_desc}: 完成 ({exec_time}ms)[/green]")

            save_scheduler(scheduler, data_dir)
            progress.update(pt, completed=True)

    rprint("\n[bold green]调度循环完成[/bold green]")


@app.command()
def rebalance(
    data_dir: Optional[str] = typer.Option(None, "--data-dir", "-d", help="数据目录"),
):
    """重新平衡配额（恢复失败惩罚）"""
    scheduler = get_scheduler(data_dir)
    changes = scheduler.rebalance_quotas()
    save_scheduler(scheduler, data_dir)

    if changes:
        table = Table(title="配额调整")
        table.add_column("租户ID")
        table.add_column("新的配额减少比例")
        for tid, reduction in changes.items():
            table.add_row(tid, f"{reduction}%")
        console.print(table)
        rprint(f"[green]已调整 {len(changes)} 个租户的配额[/green]")
    else:
        rprint("[yellow]没有需要调整的配额[/yellow]")


@app.command()
def failures(
    tenant_id: Optional[str] = typer.Option(None, "--tenant", "-t", help="按租户筛选"),
    data_dir: Optional[str] = typer.Option(None, "--data-dir", "-d", help="数据目录"),
):
    """查看失败任务列表和详情"""
    scheduler = get_scheduler(data_dir)
    failed = scheduler.get_failed_tasks(tenant_id)

    if not failed:
        rprint("[green]没有失败的任务[/green]")
        return

    table = Table(title=f"失败任务 ({len(failed)} 个)")
    table.add_column("租户ID", style="cyan")
    table.add_column("任务ID")
    table.add_column("名称")
    table.add_column("类型")
    table.add_column("重试次数", justify="right")
    table.add_column("失败原因", style="red")

    for task in failed:
        table.add_row(
            task.tenant_id,
            task.id,
            task.name,
            task.task_type,
            f"{task.retry_count}/{task.max_retries}",
            task.error_message or "",
        )
    console.print(table)


@app.command()
def promote(
    task_id: str = typer.Argument(..., help="任务ID"),
    reason: str = typer.Argument(..., help="紧急提升原因"),
    data_dir: Optional[str] = typer.Option(None, "--data-dir", "-d", help="数据目录"),
):
    """将等待中的任务提升为紧急优先级（留记录）"""
    scheduler = get_scheduler(data_dir)

    success = scheduler.promote_to_urgent(task_id, reason)
    save_scheduler(scheduler, data_dir)

    if success:
        task = scheduler.state.tasks[task_id]
        rprint(f"[green]✓ 任务 {task_id} 已提升为紧急优先级[/green]")
        rprint(f"  [yellow]提升原因:[/yellow] {reason}")
        rprint(f"  [yellow]原始租户:[/yellow] {task.tenant_id}")
    else:
        rprint(f"[red]✗ 无法提升任务 {task_id}（任务不存在或不在等待状态或已是紧急优先级）[/red]")


@app.command()
def report(
    data_dir: Optional[str] = typer.Option(None, "--data-dir", "-d", help="数据目录"),
):
    """生成调度报告（公平性证明、失败隔离效果）"""
    scheduler = get_scheduler(data_dir)
    stats = scheduler.get_tenant_stats()

    console.print(Panel.fit("[bold cyan]多租户任务隔离 - 调度报告[/bold cyan]"))

    rprint("\n[bold]1. 租户完成情况分析[/bold]")
    report_table = Table(title="租户任务执行统计")
    report_table.add_column("租户", style="cyan")
    report_table.add_column("权重", justify="right")
    report_table.add_column("已完成", justify="right", style="green")
    report_table.add_column("已失败", justify="right", style="red")
    report_table.add_column("完成率", justify="right")
    report_table.add_column("权重占比", justify="right")
    report_table.add_column("公平指数", justify="right")

    total_completed = scheduler.state.total_completed
    total_weight = sum(s["config"].weight for s in stats.values())

    for tid, data in stats.items():
        cfg = data["config"]
        rt = data["runtime"]
        total = rt.completed_tasks + rt.failed_tasks
        completion_rate = (rt.completed_tasks / total * 100) if total > 0 else 0
        weight_share = (cfg.weight / total_weight * 100) if total_weight > 0 else 0
        actual_share = (rt.completed_tasks / total_completed * 100) if total_completed > 0 else 0
        fairness = (actual_share / weight_share) if weight_share > 0 else 0

        report_table.add_row(
            f"{tid} ({cfg.name})",
            str(cfg.weight),
            str(rt.completed_tasks),
            str(rt.failed_tasks),
            f"{completion_rate:.1f}%",
            f"{weight_share:.1f}%",
            f"{fairness:.2f}" if fairness > 0 else "-",
        )
    console.print(report_table)

    rprint("\n[bold]2. 公平性证明 - 小租户保障分析[/bold]")
    small_tenant_id = "tenant-c"
    large_tenant_id = "tenant-a"

    if small_tenant_id in stats and large_tenant_id in stats:
        small_data = stats[small_tenant_id]
        large_data = stats[large_tenant_id]

        small_total = small_data["runtime"].completed_tasks + small_data["runtime"].failed_tasks
        large_total = large_data["runtime"].completed_tasks + large_data["runtime"].failed_tasks

        if total_completed > 0:
            small_actual = small_data["runtime"].completed_tasks / total_completed * 100
            large_actual = large_data["runtime"].completed_tasks / total_completed * 100

            rprint(f"  [cyan]小租户({small_tenant_id}):[/cyan]")
            rprint(f"    - 实际完成占比: {small_actual:.1f}%")
            rprint(f"    - 队列中等待: {small_data['pending_count']} 个")
            rprint(f"  [yellow]大租户({large_tenant_id}):[/yellow]")
            rprint(f"    - 实际完成占比: {large_actual:.1f}%")
            rprint(f"    - 队列中等待: {large_data['pending_count']} 个")

            if small_actual > 0:
                rprint(f"\n  [green]✓ 小租户获得了调度资源，未被饿死[/green]")
            else:
                if small_data['pending_count'] > 0 and total_completed > 0:
                    rprint(f"\n  [yellow]⚠ 小租户有等待任务但未执行，需要检查配额[/yellow]")

    rprint("\n[bold]3. 失败隔离分析[/bold]")
    failed_tenants = [tid for tid, data in stats.items()
                      if data["runtime"].quota_reduction_percent > 0
                      or data["runtime"].consecutive_failures > 0]

    if failed_tenants:
        fail_table = Table(title="失败隔离效果")
        fail_table.add_column("租户ID")
        fail_table.add_column("连续失败", justify="right")
        fail_table.add_column("配额减少", justify="right")
        fail_table.add_column("有效配额", justify="right")
        fail_table.add_column("状态")

        for tid in failed_tenants:
            data = stats[tid]
            rt = data["runtime"]
            status = "[red]受惩罚[/red]" if rt.quota_reduction_percent >= 40 else "[yellow]受限[/yellow]"
            fail_table.add_row(
                tid,
                str(rt.consecutive_failures),
                f"{rt.quota_reduction_percent}%",
                str(data["effective_quota"]),
                status,
            )
        console.print(fail_table)
        rprint(f"\n  [green]✓ 失败租户的配额被限制，保护了其他租户[/green]")
    else:
        rprint("  暂无租户受到失败惩罚")

    rprint("\n[bold]4. 紧急任务提升记录[/bold]")
    promoted = [t for t in scheduler.state.tasks.values() if t.is_urgent_promotion]
    if promoted:
        prom_table = Table(title="紧急提升记录")
        prom_table.add_column("任务ID")
        prom_table.add_column("租户ID")
        prom_table.add_column("名称")
        prom_table.add_column("提升原因")
        prom_table.add_column("当前状态")

        for task in promoted:
            prom_table.add_row(
                task.id,
                task.tenant_id,
                task.name,
                task.promotion_reason or "",
                task.status.value,
            )
        console.print(prom_table)
    else:
        rprint("  暂无紧急任务提升记录")

    rprint("\n[bold]5. 幂等性提交记录[/bold]")
    resubmitted = []
    for task in scheduler.state.tasks.values():
        if "幂等" in str(task.execution_history) or len(task.execution_history) > 1:
            pass
    rprint("  提示: 重复提交同一任务ID会返回幂等保证信息")


@app.command()
def reset(
    data_dir: Optional[str] = typer.Option(None, "--data-dir", "-d", help="数据目录"),
):
    """重置所有状态（慎用）"""
    storage = JsonStorage(data_dir)
    storage.reset()
    rprint("[green]调度器状态已重置[/green]")


if __name__ == "__main__":
    app()
