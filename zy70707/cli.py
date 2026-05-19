#!/usr/bin/env python3
import json
import sys
from datetime import datetime
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.tree import Tree

from trace_sampler.engine import SamplingEngine
from trace_sampler.models import TagMatchType, AdjustmentStatus


console = Console()
engine: Optional[SamplingEngine] = None


@click.group()
@click.option("--data-dir", default="./data", help="数据目录")
def cli(data_dir: str):
    """采样预算Trace标签规则排查工具"""
    global engine
    engine = SamplingEngine(data_dir=data_dir)


@cli.command()
@click.argument("service_name")
@click.argument("daily_budget", type=int)
@click.option("--date", help="日期 (YYYY-MM-DD)，默认今天")
def create_budget(service_name: str, daily_budget: int, date: Optional[str]):
    """创建服务预算"""
    try:
        budget = engine.create_budget(service_name, daily_budget, date)
        console.print(f"[green]✓[/green] 预算创建成功: {service_name}")
        console.print(f"  日预算: {budget.daily_budget}")
        console.print(f"  日期: {budget.date}")
    except ValueError as e:
        console.print(f"[red]✗[/red] {e}")
        sys.exit(1)


@cli.command(name="list-services")
def list_services():
    """列出所有服务"""
    services = engine.list_services()
    if not services:
        console.print("[yellow]没有找到服务[/yellow]")
        return

    table = Table(title="服务列表")
    table.add_column("服务名称", style="cyan")
    table.add_column("预算状态", style="green")

    for service in services:
        budget = engine.get_budget(service)
        if budget:
            status = f"{budget.used_budget}/{budget.daily_budget} ({budget.utilization_rate:.1%})"
        else:
            status = "无预算"
        table.add_row(service, status)

    console.print(table)


@cli.command()
@click.argument("rule_id")
@click.argument("service_name")
@click.argument("tag_key")
@click.option("--tag-value", help="标签值")
@click.option("--match-type", type=click.Choice(["exact", "prefix", "regex", "exists"]), default="exact", help="匹配类型")
@click.option("--priority", type=int, default=50, help="优先级 (0-100)")
@click.option("--sampling-rate", type=float, default=1.0, help="采样率 (0-1)")
@click.option("--budget-reservation", type=int, default=0, help="预算预留")
@click.option("--created-by", default="cli", help="创建人")
def create_rule(
    rule_id: str,
    service_name: str,
    tag_key: str,
    tag_value: Optional[str],
    match_type: str,
    priority: int,
    sampling_rate: float,
    budget_reservation: int,
    created_by: str,
):
    """创建采样规则"""
    try:
        rule = engine.create_rule(
            rule_id=rule_id,
            service_name=service_name,
            tag_key=tag_key,
            tag_value=tag_value,
            match_type=TagMatchType(match_type),
            priority=priority,
            sampling_rate=sampling_rate,
            budget_reservation=budget_reservation,
            created_by=created_by,
        )
        console.print(f"[green]✓[/green] 规则创建成功: {rule_id}")
        console.print(f"  服务: {rule.service_name}")
        console.print(f"  标签: {rule.tag_key}={rule.tag_value}")
        console.print(f"  匹配类型: {rule.match_type}")
        console.print(f"  优先级: {rule.priority}")
        console.print(f"  采样率: {rule.sampling_rate:.1%}")
    except ValueError as e:
        console.print(f"[red]✗[/red] {e}")
        sys.exit(1)


@cli.command(name="list-rules")
@click.option("--service", help="服务名称过滤")
def list_rules(service: Optional[str]):
    """列出所有规则"""
    rules = engine.list_rules(service)
    if not rules:
        console.print("[yellow]没有找到规则[/yellow]")
        return

    table = Table(title="采样规则列表")
    table.add_column("规则ID", style="cyan")
    table.add_column("服务", style="magenta")
    table.add_column("标签键", style="green")
    table.add_column("标签值")
    table.add_column("匹配类型")
    table.add_column("优先级", justify="right")
    table.add_column("采样率", justify="right")
    table.add_column("状态")

    for rule in rules:
        status = "[green]活跃[/green]" if rule.is_active else "[red]停用[/red]"
        table.add_row(
            rule.rule_id,
            rule.service_name,
            rule.tag_key,
            rule.tag_value or "-",
            rule.match_type.value,
            str(rule.priority),
            f"{rule.sampling_rate:.1%}",
            status,
        )

    console.print(table)


@cli.command()
@click.argument("trace_id")
@click.argument("service_name")
@click.option("--tag", multiple=True, help="标签 (key=value)，可多次指定")
def decide(trace_id: str, service_name: str, tag):
    """做出采样决策"""
    tags = {}
    for t in tag:
        if "=" in t:
            k, v = t.split("=", 1)
            tags[k.strip()] = v.strip()

    decision = engine.decide_sampling(trace_id, service_name, tags)

    color = "green" if decision.sampled else "red"
    status = "采样" if decision.sampled else "丢弃"

    console.print(f"[{color}]{status}[/{color}]: trace_id={trace_id}")
    console.print(f"  原因: {decision.reason}")
    if decision.matched_rule_id:
        console.print(f"  匹配规则: {decision.matched_rule_id}")
    console.print(f"  预算影响: {decision.budget_impact}")


@cli.command(name="request-adjustment")
@click.argument("request_id")
@click.argument("service_name")
@click.argument("requester")
@click.argument("reason")
@click.argument("adjustment_type")
@click.argument("old_value")
@click.argument("new_value")
@click.argument("idempotency_key")
@click.option("--effective-from", help="生效开始时间")
@click.option("--effective-to", help="生效结束时间")
def request_adjustment(
    request_id: str,
    service_name: str,
    requester: str,
    reason: str,
    adjustment_type: str,
    old_value: str,
    new_value: str,
    idempotency_key: str,
    effective_from: Optional[str],
    effective_to: Optional[str],
):
    """申请调整"""
    try:
        old_val = json.loads(old_value) if old_value.startswith("{") else old_value
        new_val = json.loads(new_value) if new_value.startswith("{") else new_value
    except json.JSONDecodeError:
        old_val = old_value
        new_val = new_value

    ef = datetime.fromisoformat(effective_from) if effective_from else None
    et = datetime.fromisoformat(effective_to) if effective_to else None

    request, is_idempotent = engine.create_adjustment_request(
        request_id=request_id,
        service_name=service_name,
        requester=requester,
        reason=reason,
        adjustment_type=adjustment_type,
        old_value=old_val,
        new_value=new_val,
        idempotency_key=idempotency_key,
        effective_from=ef,
        effective_to=et,
    )

    if is_idempotent:
        console.print(f"[yellow]⚠[/yellow] 幂等命中，使用已有请求: {request_id}")
    else:
        console.print(f"[green]✓[/green] 调整申请创建成功: {request_id}")

    console.print(f"  类型: {request.adjustment_type}")
    console.print(f"  状态: {request.status.value}")
    console.print(f"  原因: {request.reason}")


@cli.command()
@click.argument("request_id")
@click.argument("approver")
def approve(request_id: str, approver: str):
    """批准调整申请"""
    try:
        request = engine.approve_adjustment(request_id, approver)
        if request:
            console.print(f"[green]✓[/green] 申请已批准: {request_id}")
            console.print(f"  批准人: {approver}")
        else:
            console.print(f"[red]✗[/red] 申请不存在: {request_id}")
            sys.exit(1)
    except ValueError as e:
        console.print(f"[red]✗[/red] {e}")
        sys.exit(1)


@cli.command()
@click.argument("request_id")
@click.argument("approver")
def reject(request_id: str, approver: str):
    """拒绝调整申请"""
    request = engine.reject_adjustment(request_id, approver)
    if request:
        console.print(f"[green]✓[/green] 申请已拒绝: {request_id}")
        console.print(f"  拒绝人: {approver}")
    else:
        console.print(f"[red]✗[/red] 申请不存在: {request_id}")
        sys.exit(1)


@cli.command(name="list-adjustments")
@click.option("--service", help="服务名称过滤")
@click.option("--status", type=click.Choice(["pending", "approved", "rejected", "expired"]), help="状态过滤")
def list_adjustments(service: Optional[str], status: Optional[str]):
    """列出调整申请"""
    status_enum = AdjustmentStatus(status) if status else None
    adjustments = engine.list_adjustments(service, status_enum)

    if not adjustments:
        console.print("[yellow]没有找到调整申请[/yellow]")
        return

    table = Table(title="调整申请列表")
    table.add_column("申请ID", style="cyan")
    table.add_column("服务", style="magenta")
    table.add_column("类型", style="green")
    table.add_column("申请人")
    table.add_column("状态")
    table.add_column("原因", style="dim")

    for adj in adjustments:
        status_color = {
            AdjustmentStatus.PENDING: "yellow",
            AdjustmentStatus.APPROVED: "green",
            AdjustmentStatus.REJECTED: "red",
            AdjustmentStatus.EXPIRED: "dim",
        }.get(adj.status, "white")

        table.add_row(
            adj.request_id,
            adj.service_name,
            adj.adjustment_type,
            adj.requester,
            f"[{status_color}]{adj.status.value}[/{status_color}]",
            adj.reason[:30] + "..." if len(adj.reason) > 30 else adj.reason,
        )

    console.print(table)


@cli.command()
@click.argument("service_name")
@click.option("--date", help="日期 (YYYY-MM-DD)，默认今天")
@click.option("--format", type=click.Choice(["human", "json", "both"]), default="both", help="输出格式")
@click.option("--output", help="输出文件 (仅JSON格式)")
def report(service_name: str, date: Optional[str], format: str, output: Optional[str]):
    """生成预算报告"""
    try:
        budget_report = engine.generate_report(service_name, date)

        if format in ["human", "both"]:
            console.print(budget_report.to_human_readable())
            if format == "both":
                console.print("\n" + "=" * 60 + "\n")

        if format in ["json", "both"]:
            json_data = json.dumps(budget_report.to_machine_readable(), default=str, indent=2, ensure_ascii=False)
            if output:
                with open(output, "w") as f:
                    f.write(json_data)
                console.print(f"[green]✓[/green] JSON报告已写入: {output}")
            else:
                if format == "json":
                    print(json_data)
                else:
                    console.print("JSON输出:")
                    print(json_data)

    except ValueError as e:
        console.print(f"[red]✗[/red] {e}")
        sys.exit(1)


if __name__ == "__main__":
    cli()
