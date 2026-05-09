import json
import os
from datetime import datetime, timedelta
from typing import Optional, List

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

from .core.database import QueueDatabase
from .core.models import (
    CompensationMessage, MessageStatus, ErrorCategory, RetryStrategy
)
from .core.state_machine import RetryStateMachine
from .core.analyzer import DeadLetterAnalyzer
from .core.idempotent import IdempotentManager
from .utils.exporter import ReportExporter


console = Console()


def get_db(db_path: Optional[str] = None) -> QueueDatabase:
    return QueueDatabase(db_path)


@click.group()
@click.option("--db-path", "-d", help="数据库路径 (默认: ~/.queue_inspector/queue.db)")
@click.pass_context
def cli(ctx: click.Context, db_path: Optional[str]) -> None:
    ctx.ensure_object(dict)
    ctx.obj["db_path"] = db_path


@cli.command("import")
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--topic", "-t", help="消息主题 (如果JSON中没有定义)")
@click.option("--idempotent-fields", "-k", multiple=True, 
              help="用于生成幂等键的字段 (可多次指定)")
@click.option("--max-retries", "-m", type=int, default=3, help="最大重试次数")
@click.pass_context
def import_snapshot(ctx: click.Context, file_path: str, topic: Optional[str],
                   idempotent_fields: tuple, max_retries: int) -> None:
    db = get_db(ctx.obj.get("db_path"))
    idempotent_mgr = IdempotentManager(db)
    
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if isinstance(data, dict) and "messages" in data:
        messages_data = data["messages"]
    elif isinstance(data, list):
        messages_data = data
    else:
        messages_data = [data]
    
    imported = 0
    skipped = 0
    
    for msg_data in messages_data:
        msg_topic = msg_data.get("topic") or topic
        if not msg_topic:
            console.print(f"[yellow]跳过消息: 缺少topic字段[/yellow]")
            skipped += 1
            continue
        
        payload = msg_data.get("payload", msg_data)
        
        idempotent_key = msg_data.get("idempotent_key")
        if not idempotent_key and idempotent_fields:
            idempotent_key = idempotent_mgr.generate_key(
                payload=payload,
                key_fields=list(idempotent_fields),
                topic=msg_topic,
            )
        
        msg = CompensationMessage(
            id=msg_data.get("id", f"msg-{datetime.now().timestamp()}-{imported}"),
            topic=msg_topic,
            payload=payload,
            retry_count=msg_data.get("retry_count", 0),
            max_retries=msg_data.get("max_retries", max_retries),
            status=MessageStatus(msg_data.get("status", "pending")),
            last_error_message=msg_data.get("last_error_message"),
            error_category=ErrorCategory(msg_data["error_category"]) 
                          if msg_data.get("error_category") else None,
            idempotent_key=idempotent_key,
        )
        
        db.insert_message(msg)
        imported += 1
    
    console.print(Panel.fit(
        f"[green]导入完成[/green]\n"
        f"成功导入: {imported} 条\n"
        f"跳过: {skipped} 条",
        title="导入结果"
    ))


@cli.command("list")
@click.option("--status", "-s", type=click.Choice([s.value for s in MessageStatus]),
              help="按状态过滤")
@click.option("--topic", "-t", help="按主题过滤 (模糊匹配)")
@click.option("--error-category", "-e", type=click.Choice([c.value for c in ErrorCategory]),
              help="按错误类型过滤")
@click.option("--min-retry", type=int, help="最小重试次数")
@click.option("--max-retry", type=int, help="最大重试次数")
@click.option("--idempotent-key", "-k", help="按幂等键过滤")
@click.option("--days", type=int, help="最近N天的消息")
@click.option("--limit", "-n", type=int, default=50, help="显示数量 (默认50)")
@click.option("--offset", type=int, default=0, help="偏移量")
@click.option("--order-by", type=click.Choice(["created_at", "updated_at", "retry_count"]),
              default="created_at", help="排序字段")
@click.option("--desc/--asc", default=True, help="降序/升序")
@click.option("--json", "output_json", is_flag=True, help="输出JSON格式")
@click.pass_context
def list_messages(ctx: click.Context, status: Optional[str], topic: Optional[str],
                 error_category: Optional[str], min_retry: Optional[int],
                 max_retry: Optional[int], idempotent_key: Optional[str],
                 days: Optional[int], limit: int, offset: int,
                 order_by: str, desc: bool, output_json: bool) -> None:
    db = get_db(ctx.obj.get("db_path"))
    
    created_after = None
    if days:
        created_after = datetime.now() - timedelta(days=days)
    
    messages = db.list_messages(
        status=MessageStatus(status) if status else None,
        topic=topic,
        error_category=ErrorCategory(error_category) if error_category else None,
        min_retry_count=min_retry,
        max_retry_count=max_retry,
        idempotent_key=idempotent_key,
        created_after=created_after,
        limit=limit,
        offset=offset,
        order_by=order_by,
        order_dir="DESC" if desc else "ASC",
    )
    
    if output_json:
        result = [m.model_dump(mode="json") for m in messages]
        console.print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    
    table = Table(title=f"消息列表 (共 {len(messages)} 条)", box=box.ROUNDED)
    table.add_column("ID", style="cyan", no_wrap=True)
    table.add_column("主题", style="magenta")
    table.add_column("状态", style="yellow")
    table.add_column("重试", justify="center")
    table.add_column("错误类型", style="red")
    table.add_column("创建时间", style="green")
    
    for msg in messages:
        status_style = {
            "success": "green",
            "pending": "yellow",
            "retrying": "blue",
            "dead_letter": "red",
            "archived": "dim",
        }.get(msg.status.value, "")
        
        table.add_row(
            msg.id[:20] + "..." if len(msg.id) > 20 else msg.id,
            msg.topic,
            f"[{status_style}]{msg.status.value}[/{status_style}]",
            f"{msg.retry_count}/{msg.max_retries}",
            msg.error_category.value if msg.error_category else "-",
            msg.created_at.strftime("%m-%d %H:%M") if msg.created_at else "-",
        )
    
    console.print(table)


@cli.command("show")
@click.argument("message_id")
@click.option("--json", "output_json", is_flag=True, help="输出JSON格式")
@click.pass_context
def show_message(ctx: click.Context, message_id: str, output_json: bool) -> None:
    db = get_db(ctx.obj.get("db_path"))
    
    msg = db.get_message(message_id)
    if not msg:
        console.print(f"[red]未找到消息: {message_id}[/red]")
        return
    
    if output_json:
        console.print(json.dumps(msg.model_dump(mode="json"), ensure_ascii=False, indent=2))
        return
    
    analyzer = DeadLetterAnalyzer(db)
    analysis = analyzer.analyze_message(msg)
    history = db.get_retry_history(message_id)
    
    console.print(Panel.fit(
        f"[cyan]ID:[/cyan] {msg.id}\n"
        f"[cyan]主题:[/cyan] {msg.topic}\n"
        f"[cyan]状态:[/cyan] {msg.status.value}\n"
        f"[cyan]重试计数:[/cyan] {msg.retry_count}/{msg.max_retries}\n"
        f"[cyan]幂等键:[/cyan] {msg.idempotent_key or '-'}\n"
        f"[cyan]创建时间:[/cyan] {msg.created_at}\n"
        f"[cyan]最近失败:[/cyan] {msg.last_failed_at or '-'}\n"
        f"[cyan]错误类型:[/cyan] {msg.error_category.value if msg.error_category else '-'}\n"
        f"[cyan]错误信息:[/cyan] {msg.last_error_message or '-'}\n"
        f"[cyan]消息时长:[/cyan] {analysis['age_hours'] or 0} 小时",
        title="消息详情"
    ))
    
    if history:
        table = Table(title="重试历史", box=box.ROUNDED)
        table.add_column("次数", justify="center")
        table.add_column("状态")
        table.add_column("开始时间")
        table.add_column("耗时(ms)")
        table.add_column("错误")
        
        for record in history:
            status_style = "green" if record.status == "success" else "red"
            table.add_row(
                str(record.attempt_number),
                f"[{status_style}]{record.status}[/{status_style}]",
                record.started_at.strftime("%H:%M:%S") if record.started_at else "-",
                str(record.duration_ms) if record.duration_ms else "-",
                record.error_message or "-",
            )
        console.print(table)
    
    console.print(Panel.fit(
        f"[cyan]Payload:[/cyan]\n{json.dumps(msg.payload, ensure_ascii=False, indent=2)}",
        title="消息负载"
    ))


@cli.command("retry")
@click.argument("message_id")
@click.option("--reset", is_flag=True, help="重置重试计数")
@click.option("--reason", "-r", help="重试原因/备注")
@click.pass_context
def retry_message(ctx: click.Context, message_id: str, reset: bool, 
                  reason: Optional[str]) -> None:
    db = get_db(ctx.obj.get("db_path"))
    state_machine = RetryStateMachine(db)
    
    msg = db.get_message(message_id)
    if not msg:
        console.print(f"[red]未找到消息: {message_id}[/red]")
        return
    
    if state_machine.force_retry(message_id, reset_retry_count=reset):
        status = "已重置并重试" if reset else "已标记重试"
        console.print(f"[green]消息 {message_id} {status}[/green]")
        if reason:
            console.print(f"[yellow]备注: {reason}[/yellow]")
    else:
        console.print(f"[red]操作失败[/red]")


@cli.command("retry-all")
@click.option("--status", "-s", type=click.Choice(["dead_letter", "pending", "retrying"]),
              default="dead_letter", help="重试指定状态的消息")
@click.option("--topic", "-t", help="指定主题")
@click.option("--error-category", "-e", type=click.Choice([c.value for c in ErrorCategory]),
              help="指定错误类型")
@click.option("--dry-run", is_flag=True, help="仅显示将重试的消息，不实际执行")
@click.pass_context
def retry_all(ctx: click.Context, status: str, topic: Optional[str],
              error_category: Optional[str], dry_run: bool) -> None:
    db = get_db(ctx.obj.get("db_path"))
    state_machine = RetryStateMachine(db)
    
    messages = db.list_messages(
        status=MessageStatus(status),
        topic=topic,
        error_category=ErrorCategory(error_category) if error_category else None,
    )
    
    if dry_run:
        table = Table(title=f"将重试的消息 ({len(messages)} 条)", box=box.ROUNDED)
        table.add_column("ID", style="cyan")
        table.add_column("主题", style="magenta")
        table.add_column("重试次数")
        for msg in messages:
            table.add_row(msg.id, msg.topic, str(msg.retry_count))
        console.print(table)
        return
    
    count = 0
    for msg in messages:
        if state_machine.force_retry(msg.id):
            count += 1
    
    console.print(f"[green]已标记 {count} 条消息为重试状态[/green]")


@cli.command("dead-letter")
@click.argument("message_id")
@click.option("--reason", "-r", required=True, help="标记原因")
@click.pass_context
def mark_dead_letter(ctx: click.Context, message_id: str, reason: str) -> None:
    db = get_db(ctx.obj.get("db_path"))
    state_machine = RetryStateMachine(db)
    
    if state_machine.mark_as_dead_letter(message_id, reason):
        console.print(f"[green]消息 {message_id} 已标记为死信[/green]")
    else:
        console.print(f"[red]操作失败[/red]")


@cli.command("archive")
@click.argument("message_id")
@click.pass_context
def archive_message(ctx: click.Context, message_id: str) -> None:
    db = get_db(ctx.obj.get("db_path"))
    state_machine = RetryStateMachine(db)
    
    if state_machine.mark_as_archived(message_id):
        console.print(f"[green]消息 {message_id} 已归档[/green]")
    else:
        console.print(f"[red]操作失败[/red]")


@cli.command("delete")
@click.argument("message_id")
@click.option("--force", is_flag=True, help="跳过确认")
@click.pass_context
def delete_message(ctx: click.Context, message_id: str, force: bool) -> None:
    db = get_db(ctx.obj.get("db_path"))
    idempotent_mgr = IdempotentManager(db)
    
    msg = db.get_message(message_id)
    if not msg:
        console.print(f"[red]未找到消息: {message_id}[/red]")
        return
    
    safe = idempotent_mgr.safe_to_delete(msg)
    
    if not force:
        if safe:
            confirm = click.confirm(f"确定删除消息 {message_id}? (判断为可安全删除)")
        else:
            confirm = click.confirm(
                f"[yellow]警告: 该消息可能不安全删除[/yellow]\n"
                f"确定删除消息 {message_id}?",
                default=False,
            )
        if not confirm:
            console.print("[yellow]已取消[/yellow]")
            return
    
    db.delete_message(message_id)
    console.print(f"[green]消息 {message_id} 已删除[/green]")


@cli.command("analyze")
@click.option("--status", "-s", type=click.Choice([s.value for s in MessageStatus]),
              help="分析指定状态")
@click.option("--topic", "-t", help="分析指定主题")
@click.pass_context
def analyze(ctx: click.Context, status: Optional[str], topic: Optional[str]) -> None:
    db = get_db(ctx.obj.get("db_path"))
    analyzer = DeadLetterAnalyzer(db)
    
    result = analyzer.analyze_error_patterns(
        status=MessageStatus(status) if status else None,
        topic=topic,
    )
    
    console.print(Panel.fit(
        f"消息总数: {result['total_messages']}",
        title="错误模式分析"
    ))
    
    if result["by_category"]:
        table = Table(title="按错误类型", box=box.ROUNDED)
        table.add_column("错误类型", style="cyan")
        table.add_column("数量", justify="center")
        for category, count in result["by_category"].items():
            table.add_row(category, str(count))
        console.print(table)
    
    if result["by_error_pattern"]:
        table = Table(title="常见错误模式", box=box.ROUNDED)
        table.add_column("错误模式", style="red")
        table.add_column("出现次数", justify="center")
        for pattern, count in result["by_error_pattern"]:
            table.add_row(pattern, str(count))
        console.print(table)
    
    if result["by_topic"]:
        table = Table(title="按主题分布", box=box.ROUNDED)
        table.add_column("主题", style="magenta")
        table.add_column("数量", justify="center")
        for topic_name, count in result["by_topic"].items():
            table.add_row(topic_name, str(count))
        console.print(table)


@cli.command("duplicates")
@click.option("--json", "output_json", is_flag=True, help="输出JSON格式")
@click.pass_context
def list_duplicates(ctx: click.Context, output_json: bool) -> None:
    db = get_db(ctx.obj.get("db_path"))
    idempotent_mgr = IdempotentManager(db)
    
    groups = idempotent_mgr.get_duplicate_groups()
    
    if not groups:
        console.print("[green]没有发现重复的幂等键[/green]")
        return
    
    if output_json:
        result = {
            key: [m.model_dump(mode="json") for m in msgs]
            for key, msgs in groups.items()
        }
        console.print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    
    table = Table(title=f"发现 {len(groups)} 组重复消息", box=box.ROUNDED)
    table.add_column("幂等键", style="cyan")
    table.add_column("消息数", justify="center")
    table.add_column("有成功", justify="center")
    table.add_column("全死信", justify="center")
    table.add_column("跨度(小时)")
    
    for key in groups:
        analysis = idempotent_mgr.analyze_duplicate_group(key)
        table.add_row(
            key[:20] + "..." if len(key) > 20 else key,
            str(analysis["count"]),
            "[green]是[/green]" if analysis["has_success"] else "[red]否[/red]",
            "[green]是[/green]" if analysis["all_dead"] else "[red]否[/red]",
            f"{analysis['time_span_hours']:.2f}",
        )
    
    console.print(table)


@cli.command("cleanup")
@click.option("--min-age", type=int, default=168, help="最小存在时长(小时), 默认168(7天)")
@click.option("--include-success", is_flag=True, default=True, help="包含成功消息")
@click.option("--export", type=click.Path(), help="导出建议到文件")
@click.option("--json", "output_json", is_flag=True, help="输出JSON格式")
@click.pass_context
def cleanup_suggestions(ctx: click.Context, min_age: int, include_success: bool,
                       export: Optional[str], output_json: bool) -> None:
    db = get_db(ctx.obj.get("db_path"))
    analyzer = DeadLetterAnalyzer(db)
    
    suggestions = analyzer.get_cleanup_suggestions(
        min_age_hours=min_age,
        include_success=include_success,
    )
    
    if not suggestions:
        console.print("[green]暂无可清理的消息[/green]")
        return
    
    if export:
        ReportExporter.suggestions_to_csv(suggestions, export)
        console.print(f"[green]清理建议已导出到: {export}[/green]")
    
    if output_json:
        result = [s.model_dump(mode="json") for s in suggestions]
        console.print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    
    table = Table(title=f"清理建议 ({len(suggestions)} 条)", box=box.ROUNDED)
    table.add_column("消息ID", style="cyan")
    table.add_column("主题", style="magenta")
    table.add_column("风险等级")
    table.add_column("原因")
    table.add_column("建议")
    table.add_column("可删")
    
    for s in suggestions:
        risk_style = {
            "low": "green",
            "medium": "yellow",
            "high": "red",
        }.get(s.risk_level, "")
        
        table.add_row(
            s.message_id[:20] + "..." if len(s.message_id) > 20 else s.message_id,
            s.topic,
            f"[{risk_style}]{s.risk_level}[/{risk_style}]",
            s.reason[:30] + "..." if len(s.reason) > 30 else s.reason,
            s.suggestion[:30] + "..." if len(s.suggestion) > 30 else s.suggestion,
            "[green]是[/green]" if s.safe_to_delete else "[red]否[/red]",
        )
    
    console.print(table)
    
    safe_count = sum(1 for s in suggestions if s.safe_to_delete)
    console.print(f"\n[cyan]可安全删除: {safe_count}/{len(suggestions)}[/cyan]")


@cli.command("report")
@click.option("--format", "-f", type=click.Choice(["json", "csv", "md"]), default="json",
              help="报告格式")
@click.option("--output", "-o", type=click.Path(), help="输出文件路径")
@click.pass_context
def generate_report(ctx: click.Context, format: str, output: Optional[str]) -> None:
    db = get_db(ctx.obj.get("db_path"))
    analyzer = DeadLetterAnalyzer(db)
    
    report = analyzer.generate_inspection_report()
    
    if not output:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output = f"queue_report_{timestamp}.{format}"
    
    if format == "json":
        ReportExporter.to_json(report, output)
    elif format == "md":
        ReportExporter.generate_markdown_report(report, output)
    elif format == "csv":
        messages = db.list_messages()
        ReportExporter.messages_to_csv(messages, output)
    
    console.print(f"[green]报告已生成: {output}[/green]")


@cli.command("stats")
@click.pass_context
def show_stats(ctx: click.Context) -> None:
    db = get_db(ctx.obj.get("db_path"))
    analyzer = DeadLetterAnalyzer(db)
    
    total = db.count_messages()
    
    stats = {}
    for status in MessageStatus:
        stats[status.value] = db.count_messages(status=status)
    
    console.print(Panel.fit(
        f"[cyan]消息总数:[/cyan] {total}\n\n"
        f"[green]成功:[/green] {stats.get('success', 0)}\n"
        f"[yellow]待处理:[/yellow] {stats.get('pending', 0)}\n"
        f"[blue]重试中:[/blue] {stats.get('retrying', 0)}\n"
        f"[red]死信:[/red] {stats.get('dead_letter', 0)}\n"
        f"[dim]已归档:[/dim] {stats.get('archived', 0)}",
        title="队列统计"
    ))
    
    duplicates = db.get_duplicate_idempotent_keys()
    if duplicates:
        console.print(f"[yellow]警告: 发现 {len(duplicates)} 组重复的幂等键[/yellow]")


@cli.command("history")
@click.argument("message_id")
@click.option("--json", "output_json", is_flag=True, help="输出JSON格式")
@click.pass_context
def show_history(ctx: click.Context, message_id: str, output_json: bool) -> None:
    db = get_db(ctx.obj.get("db_path"))
    
    history = db.get_retry_history(message_id)
    
    if not history:
        console.print(f"[yellow]消息 {message_id} 没有重试历史[/yellow]")
        return
    
    if output_json:
        result = [r.model_dump(mode="json") for r in history]
        console.print(json.dumps(result, ensure_ascii=False, indent=2))
        return
    
    table = Table(title=f"重试历史 (共 {len(history)} 次)", box=box.ROUNDED)
    table.add_column("次数", justify="center")
    table.add_column("状态")
    table.add_column("开始时间")
    table.add_column("结束时间")
    table.add_column("耗时(ms)")
    table.add_column("错误信息")
    
    for record in history:
        status_style = "green" if record.status == "success" else "red"
        table.add_row(
            str(record.attempt_number),
            f"[{status_style}]{record.status}[/{status_style}]",
            record.started_at.strftime("%Y-%m-%d %H:%M:%S") if record.started_at else "-",
            record.finished_at.strftime("%H:%M:%S") if record.finished_at else "-",
            str(record.duration_ms) if record.duration_ms else "-",
            (record.error_message[:40] + "...") if record.error_message and len(record.error_message) > 40 else (record.error_message or "-"),
        )
    
    console.print(table)


if __name__ == "__main__":
    cli()
