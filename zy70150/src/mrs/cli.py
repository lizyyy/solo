import json
import sys
from datetime import datetime
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

from .database import init_db
from .config import settings
from .services import (
    ReplayService,
    ReportService,
    MessageLocator,
    SeedService,
    IdempotencyService,
)
from .exceptions import (
    MRSException,
    ApprovalRequiredError,
    RequestAlreadyProcessedError,
    NoMessagesFoundError,
    InvalidScopeError,
)


console = Console()


def _print_error(message: str) -> None:
    console.print(f"[red]✗ {message}[/red]")


def _print_success(message: str) -> None:
    console.print(f"[green]✓ {message}[/green]")


def _print_info(message: str) -> None:
    console.print(f"[cyan]ℹ {message}[/cyan]")


def _print_warning(message: str) -> None:
    console.print(f"[yellow]⚠ {message}[/yellow]")


@click.group()
@click.version_option(package_name="message-replay-service")
def cli():
    """
    消息重放审批服务 (Message Replay Service)
    
    用于安全、可控、可追溯地重放生产环境消息。
    核心特性：
    • 消息定位 - 支持多种方式定位需要重放的消息
    • 审批流程 - 支持创建、审批、拒绝重放请求
    • 幂等校验 - 确保重复操作后结果一致
    • 速率控制 - 限制重放速率，防止系统过载
    • 执行回执 - 每条消息的执行结果可追溯
    • 重放报告 - 生成详细的重放报告并支持导出
    """
    pass


@cli.group()
def init():
    """系统初始化命令"""
    pass


@init.command("database")
def init_database():
    """初始化数据库表结构"""
    try:
        init_db()
        _print_success("数据库初始化完成")
        console.print(f"  数据库位置: {settings.database_url}")
    except Exception as e:
        _print_error(f"数据库初始化失败: {e}")
        sys.exit(1)


@init.command("sample-data")
@click.option("--count", "-n", default=20, help="生成的消息数量，默认20")
def init_sample_data(count: int):
    """生成示例消息数据用于测试"""
    try:
        init_db()
        with SeedService() as service:
            message_ids = service.create_sample_messages(count)
        
        _print_success(f"成功生成 {len(message_ids)} 条示例消息")
        console.print("")
        console.print("示例数据说明:")
        console.print("  • 消息主题: order.events, payment.events, inventory.events, coupon.events")
        console.print("  • 业务类型: order(订单), payment(支付), inventory(库存), coupon(优惠券)")
        console.print("  • 每条消息都包含幂等键、业务主键和相关的金额/数量/名额数据")
        console.print("")
        console.print(f"  前5条消息ID: {', '.join(message_ids[:5])}")
    except Exception as e:
        _print_error(f"生成示例数据失败: {e}")
        sys.exit(1)


@cli.group()
def message():
    """消息管理命令"""
    pass


@message.command("list")
@click.option("--topic", "-t", help="按主题筛选")
@click.option("--business-type", "-b", help="按业务类型筛选")
@click.option("--limit", "-n", default=20, help="显示条数，默认20")
def list_messages(topic: Optional[str], business_type: Optional[str], limit: int):
    """列出消息元数据"""
    from .database import SessionLocal
    from .models import MessageMetadata

    db = SessionLocal()
    try:
        query = db.query(MessageMetadata)
        if topic:
            query = query.filter(MessageMetadata.topic == topic)
        if business_type:
            query = query.filter(MessageMetadata.business_type == business_type)
        
        messages = query.order_by(MessageMetadata.source_timestamp.desc()).limit(limit).all()

        if not messages:
            _print_warning("未找到任何消息")
            return

        table = Table(title="消息列表", box=box.SIMPLE)
        table.add_column("消息ID", style="cyan")
        table.add_column("主题")
        table.add_column("业务类型")
        table.add_column("业务主键")
        table.add_column("金额", justify="right")
        table.add_column("数量", justify="right")
        table.add_column("名额", justify="right")
        table.add_column("产生时间")

        for msg in messages:
            table.add_row(
                msg.message_id,
                msg.topic,
                msg.business_type or "-",
                msg.business_key or "-",
                f"{msg.amount:.2f}" if msg.amount else "-",
                str(msg.quantity) if msg.quantity else "-",
                str(msg.quota) if msg.quota else "-",
                msg.source_timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            )

        console.print(table)
        console.print(f"")
        _print_info(f"共显示 {len(messages)} 条消息")
    finally:
        db.close()


@message.command("locate")
@click.option("--scope-type", "-s", required=True, type=click.Choice(["time_range", "message_ids", "business_keys", "business_ids", "offset_range"]),
              help="定位范围类型")
@click.option("--scope-value", "-v", required=True, help="范围值(JSON格式)")
@click.option("--topic", "-t", help="按主题筛选")
@click.option("--business-type", "-b", help="按业务类型筛选")
def locate_command(scope_type: str, scope_value: str, topic: Optional[str], business_type: Optional[str]):
    """定位需要重放的消息"""
    try:
        scope_value_dict = json.loads(scope_value)
    except json.JSONDecodeError:
        _print_error("scope_value 不是有效的JSON格式")
        sys.exit(1)

    try:
        with MessageLocator() as locator:
            messages = locator.locate(scope_type, scope_value_dict, topic, business_type)
            summary = locator.get_message_summary(messages)

        table = Table(title=f"定位结果 - {scope_type}", box=box.SIMPLE)
        table.add_column("序号")
        table.add_column("消息ID", style="cyan")
        table.add_column("业务类型")
        table.add_column("业务主键")
        table.add_column("金额", justify="right")
        table.add_column("数量", justify="right")
        table.add_column("名额", justify="right")

        for idx, msg in enumerate(messages[:20], 1):
            table.add_row(
                str(idx),
                msg.message_id,
                msg.business_type or "-",
                msg.business_key or "-",
                f"{msg.amount:.2f}" if msg.amount else "-",
                str(msg.quantity) if msg.quantity else "-",
                str(msg.quota) if msg.quota else "-",
            )

        console.print(table)

        if len(messages) > 20:
            _print_warning(f"仅显示前20条消息，共 {len(messages)} 条")

        console.print("")
        console.print(Panel.fit(
            f"[bold]消息汇总[/bold]\n\n"
            f"总消息数: {summary['count']}\n"
            f"涉及金额: {summary['total_amount']:.2f} 元\n"
            f"涉及数量: {summary['total_quantity']}\n"
            f"涉及名额: {summary['total_quota']}\n"
            f"涉及业务类型: {', '.join(summary['business_types']) or '-'}",
            title="统计信息",
            border_style="cyan",
        ))
    except NoMessagesFoundError as e:
        _print_warning(str(e))
    except InvalidScopeError as e:
        _print_error(str(e))
        sys.exit(1)
    except Exception as e:
        _print_error(f"定位消息失败: {e}")
        sys.exit(1)


@cli.group()
def request():
    """重放请求管理"""
    pass


@request.command("create")
@click.option("--requester", "-r", required=True, help="申请人")
@click.option("--reason", "-R", required=True, help="申请原因")
@click.option("--scope-type", "-s", required=True, type=click.Choice(["time_range", "message_ids", "business_keys", "business_ids", "offset_range"]),
              help="重放范围类型")
@click.option("--scope-value", "-v", required=True, help="范围值(JSON格式)")
@click.option("--target-env", "-e", default="prod", show_default=True, help="目标环境")
@click.option("--target-topic", "-T", help="目标主题(可选)")
@click.option("--rate-sec", default=10, show_default=True, help="每秒速率限制")
@click.option("--rate-min", default=300, show_default=True, help="每分钟速率限制")
@click.option("--rate-hour", default=10000, show_default=True, help="每小时速率限制")
@click.option("--topic", "-t", help="按主题筛选")
@click.option("--business-type", "-b", help="按业务类型筛选")
def create_request(
    requester: str,
    reason: str,
    scope_type: str,
    scope_value: str,
    target_env: str,
    target_topic: Optional[str],
    rate_sec: int,
    rate_min: int,
    rate_hour: int,
    topic: Optional[str],
    business_type: Optional[str],
):
    """创建重放请求"""
    try:
        scope_value_dict = json.loads(scope_value)
    except json.JSONDecodeError:
        _print_error("scope_value 不是有效的JSON格式")
        sys.exit(1)

    try:
        with ReplayService() as service:
            result = service.create_request(
                requester=requester,
                reason=reason,
                scope_type=scope_type,
                scope_value=scope_value_dict,
                target_environment=target_env,
                target_topic=target_topic,
                rate_limit_per_second=rate_sec,
                rate_limit_per_minute=rate_min,
                rate_limit_per_hour=rate_hour,
                topic=topic,
                business_type=business_type,
            )

        summary = result["message_summary"]

        console.print(Panel.fit(
            f"[bold green]重放请求创建成功[/bold green]\n\n"
            f"[bold]请求ID:[/bold] {result['request_id']}\n"
            f"[bold]申请人:[/bold] {result['requester']}\n"
            f"[bold]审批状态:[/bold] {result['approval_status']}\n"
            f"[bold]目标环境:[/bold] {result['target_environment']}\n\n"
            f"[bold]涉及消息:[/bold] {summary['total_messages']} 条\n"
            f"[bold]涉及金额:[/bold] {summary['total_amount']:.2f} 元\n"
            f"[bold]涉及数量:[/bold] {summary['total_quantity']}\n"
            f"[bold]涉及名额:[/bold] {summary['total_quota']}",
            title="创建结果",
            border_style="green",
        ))

        _print_info("请等待审批人审批后执行重放")
        console.print(f"  审批命令: mrs request approve {result['request_id']} --approver <审批人>")
    except NoMessagesFoundError as e:
        _print_warning(str(e))
        sys.exit(1)
    except InvalidScopeError as e:
        _print_error(str(e))
        sys.exit(1)
    except Exception as e:
        _print_error(f"创建请求失败: {e}")
        sys.exit(1)


@request.command("approve")
@click.argument("request_id")
@click.option("--approver", "-a", required=True, help="审批人")
@click.option("--comment", "-c", help="审批意见")
def approve_request(request_id: str, approver: str, comment: Optional[str]):
    """审批通过重放请求"""
    try:
        with ReplayService() as service:
            result = service.approve_request(request_id, approver, comment)

        _print_success(f"请求 {request_id} 已由 {approver} 审批通过")
        if comment:
            console.print(f"  审批意见: {comment}")
        console.print("")
        _print_info("现在可以执行重放了")
        console.print(f"  执行命令: mrs request execute {request_id} --executor <执行人>")
    except ValueError as e:
        _print_error(str(e))
        sys.exit(1)
    except Exception as e:
        _print_error(f"审批失败: {e}")
        sys.exit(1)


@request.command("reject")
@click.argument("request_id")
@click.option("--approver", "-a", required=True, help="审批人")
@click.option("--reason", "-r", required=True, help="拒绝原因")
def reject_request(request_id: str, approver: str, reason: str):
    """拒绝重放请求"""
    try:
        with ReplayService() as service:
            result = service.reject_request(request_id, approver, reason)

        _print_warning(f"请求 {request_id} 已由 {approver} 拒绝")
        console.print(f"  拒绝原因: {reason}")
    except ValueError as e:
        _print_error(str(e))
        sys.exit(1)
    except Exception as e:
        _print_error(f"拒绝失败: {e}")
        sys.exit(1)


@request.command("execute")
@click.argument("request_id")
@click.option("--executor", "-e", required=True, help="执行人")
@click.option("--dry-run", is_flag=True, help="试运行模式，不实际重放")
def execute_request(request_id: str, executor: str, dry_run: bool):
    """执行重放请求"""
    try:
        with ReplayService() as service:
            result = service.execute_request(request_id, executor, dry_run)

        summary = result["summary"]

        if dry_run:
            console.print(Panel.fit(
                f"[bold yellow]试运行模式[/bold yellow]\n\n"
                f"[bold]请求ID:[/bold] {result['request_id']}\n"
                f"[bold]执行人:[/bold] {result['executor']}\n"
                f"[bold]报告ID:[/bold] {result['report_id']}\n\n"
                f"[bold]总消息数:[/bold] {summary['total_messages']}\n"
                f"[bold]成功:[/bold] [green]{summary['success_count']}[/green]\n"
                f"[bold]失败:[/bold] [red]{summary['failed_count']}[/red]\n"
                f"[bold]跳过:[/bold] [yellow]{summary['skipped_count']}[/yellow]\n"
                f"[bold]成功率:[/bold] {summary['success_rate']:.1f}%\n\n"
                f"[bold]涉及金额:[/bold] {summary['total_amount']:.2f} 元\n"
                f"[bold]总耗时:[/bold] {summary['total_duration_ms']} ms",
                title="试运行结果",
                border_style="yellow",
            ))
        else:
            status_color = "green" if summary["failed_count"] == 0 else "yellow"
            console.print(Panel.fit(
                f"[bold {status_color}]重放执行完成[/bold {status_color}]\n\n"
                f"[bold]请求ID:[/bold] {result['request_id']}\n"
                f"[bold]执行人:[/bold] {result['executor']}\n"
                f"[bold]报告ID:[/bold] {result['report_id']}\n\n"
                f"[bold]总消息数:[/bold] {summary['total_messages']}\n"
                f"[bold]成功:[/bold] [green]{summary['success_count']}[/green]\n"
                f"[bold]失败:[/bold] [red]{summary['failed_count']}[/red]\n"
                f"[bold]跳过:[/bold] [yellow]{summary['skipped_count']}[/yellow]\n"
                f"[bold]成功率:[/bold] {summary['success_rate']:.1f}%\n\n"
                f"[bold]涉及金额:[/bold] {summary['total_amount']:.2f} 元\n"
                f"[bold]涉及数量:[/bold] {summary['total_quantity']}\n"
                f"[bold]涉及名额:[/bold] {summary['total_quota']}\n"
                f"[bold]总耗时:[/bold] {summary['total_duration_ms']} ms",
                title="执行结果",
                border_style=status_color,
            ))

        if result["execution_results"]:
            console.print("")
            table = Table(title="执行明细(前10条)", box=box.SIMPLE)
            table.add_column("消息ID", style="cyan")
            table.add_column("业务主键")
            table.add_column("状态")

            for item in result["execution_results"][:10]:
                status_color = (
                    "green" if item["status"] == "执行成功"
                    else "red" if item["status"] == "执行失败"
                    else "yellow"
                )
                table.add_row(
                    item["message_id"],
                    item["business_key"] or "-",
                    f"[{status_color}]{item['status']}[/{status_color}]",
                )

            console.print(table)

            if len(result["execution_results"]) > 10:
                _print_warning(f"仅显示前10条，共 {len(result['execution_results'])} 条，详情请查看报告")

        console.print("")
        _print_info(f"查看报告详情: mrs report show {result['report_id']}")
    except ApprovalRequiredError as e:
        _print_error(str(e))
        sys.exit(1)
    except RequestAlreadyProcessedError as e:
        _print_error(str(e))
        sys.exit(1)
    except ValueError as e:
        _print_error(str(e))
        sys.exit(1)
    except Exception as e:
        _print_error(f"执行失败: {e}")
        sys.exit(1)


@request.command("show")
@click.argument("request_id")
def show_request(request_id: str):
    """查看重放请求详情"""
    try:
        with ReplayService() as service:
            req = service.get_request(request_id)

        if not req:
            _print_warning(f"找不到请求: {request_id}")
            return

        console.print(Panel.fit(
            f"[bold]请求ID:[/bold] {req['request_id']}\n"
            f"[bold]申请人:[/bold] {req['requester']}\n"
            f"[bold]申请原因:[/bold] {req['reason']}\n"
            f"[bold]范围类型:[/bold] {req['scope_type']}\n"
            f"[bold]目标环境:[/bold] {req['target_environment']}\n\n"
            f"[bold]审批状态:[/bold] {req['approval_status']}\n"
            f"[bold]审批人:[/bold] {req['approver'] or '-'}\n"
            f"[bold]审批意见:[/bold] {req['approval_comment'] or '-'}\n\n"
            f"[bold]执行状态:[/bold] {req['execution_status']}\n"
            f"[bold]开始时间:[/bold] {req['started_at'] or '-'}\n"
            f"[bold]完成时间:[/bold] {req['completed_at'] or '-'}",
            title="请求详情",
            border_style="cyan",
        ))
    except Exception as e:
        _print_error(f"查询失败: {e}")
        sys.exit(1)


@cli.group()
def report():
    """重放报告管理"""
    pass


@report.command("list")
@click.option("--requester", "-r", help="按申请人筛选")
@click.option("--executor", "-e", help="按执行人筛选")
@click.option("--limit", "-n", default=20, help="显示条数，默认20")
def list_reports(requester: Optional[str], executor: Optional[str], limit: int):
    """列出重放报告"""
    try:
        with ReportService() as service:
            reports = service.list_reports(
                requester=requester,
                executor=executor,
                limit=limit,
            )

        if not reports:
            _print_warning("未找到任何报告")
            return

        table = Table(title="报告列表", box=box.SIMPLE)
        table.add_column("报告ID", style="cyan")
        table.add_column("请求ID")
        table.add_column("状态")
        table.add_column("总数", justify="right")
        table.add_column("成功", justify="right")
        table.add_column("失败", justify="right")
        table.add_column("跳过", justify="right")
        table.add_column("金额", justify="right")
        table.add_column("成功率", justify="right")
        table.add_column("执行人")
        table.add_column("创建时间")

        for r in reports:
            status_color = (
                "green" if r["status"] == "全部成功"
                else "red" if r["status"] == "存在失败"
                else "yellow"
            )
            table.add_row(
                r["report_id"],
                r["request_id"],
                f"[{status_color}]{r['status']}[/{status_color}]",
                str(r["total_messages"]),
                f"[green]{r['success_count']}[/green]",
                f"[red]{r['failed_count']}[/red]",
                f"[yellow]{r['skipped_count']}[/yellow]",
                f"{r['total_amount']:.2f}" if r["total_amount"] else "-",
                f"{r['success_rate']}%",
                r["executor"] or "-",
                r["created_at"][:19].replace("T", " "),
            )

        console.print(table)
    except Exception as e:
        _print_error(f"查询失败: {e}")
        sys.exit(1)


@report.command("show")
@click.argument("report_id")
def show_report(report_id: str):
    """查看报告详情"""
    try:
        with ReportService() as service:
            report = service.get_report_detail(report_id)

        if not report:
            _print_warning(f"找不到报告: {report_id}")
            return

        summary = report["summary"]

        console.print(Panel.fit(
            f"[bold]报告ID:[/bold] {report['report_id']}\n"
            f"[bold]请求ID:[/bold] {report['request_id']}\n"
            f"[bold]执行人:[/bold] {summary['executor']}\n"
            f"[bold]创建时间:[/bold] {report['created_at']}\n\n"
            f"[bold]总消息数:[/bold] {summary['total_messages']}\n"
            f"[bold]成功:[/bold] [green]{summary['success_count']}[/green]\n"
            f"[bold]失败:[/bold] [red]{summary['failed_count']}[/red]\n"
            f"[bold]跳过:[/bold] [yellow]{summary['skipped_count']}[/yellow]\n"
            f"[bold]成功率:[/bold] {report['success_rate']:.1f}%\n\n"
            f"[bold]涉及金额:[/bold] {summary['total_amount']:.2f} 元\n"
            f"[bold]涉及数量:[/bold] {summary['total_quantity']}\n"
            f"[bold]涉及名额:[/bold] {summary['total_quota']}\n"
            f"[bold]总耗时:[/bold] {summary['total_duration_ms']} ms\n\n"
            f"[bold]执行摘要:[/bold] {summary['summary_text']}",
            title="报告摘要",
            border_style="cyan",
        ))

        if report["execution_details"]:
            console.print("")
            table = Table(title="执行明细(前20条)", box=box.SIMPLE)
            table.add_column("序号", justify="right")
            table.add_column("消息ID", style="cyan")
            table.add_column("业务类型")
            table.add_column("业务ID")
            table.add_column("金额", justify="right")
            table.add_column("状态")
            table.add_column("耗时(ms)", justify="right")

            for item in report["execution_details"][:20]:
                msg = item.get("message_detail", {}) or {}
                status_color = (
                    "green" if item["status"] == "执行成功"
                    else "red" if item["status"] == "执行失败"
                    else "yellow"
                )
                table.add_row(
                    str(item["execution_order"]),
                    item["message_id"],
                    msg.get("business_type", "-"),
                    msg.get("business_id", "-"),
                    f"{msg.get('amount', '-'):.2f}" if msg.get("amount") else "-",
                    f"[{status_color}]{item['status']}[/{status_color}]",
                    str(item.get("duration_ms", "-")),
                )

            console.print(table)

            if len(report["execution_details"]) > 20:
                _print_warning(f"仅显示前20条，共 {len(report['execution_details'])} 条")

        console.print("")
        _print_info("导出报告:")
        console.print(f"  mrs report export {report_id} --format json --output ./report.json")
        console.print(f"  mrs report export {report_id} --format csv --output ./report.csv")
    except Exception as e:
        _print_error(f"查询失败: {e}")
        sys.exit(1)


@report.command("export")
@click.argument("report_id")
@click.option("--format", "-f", "fmt", type=click.Choice(["json", "csv"]), default="json",
              help="导出格式")
@click.option("--output", "-o", required=True, help="输出文件路径")
def export_report(report_id: str, fmt: str, output: str):
    """导出报告"""
    try:
        with ReportService() as service:
            if fmt == "json":
                file_path = service.export_report_json(report_id, output)
            else:
                file_path = service.export_report_csv(report_id, output)

        _print_success(f"报告已导出到: {file_path}")
    except ValueError as e:
        _print_warning(str(e))
        sys.exit(1)
    except Exception as e:
        _print_error(f"导出失败: {e}")
        sys.exit(1)


@cli.group()
def idempotency():
    """幂等记录管理"""
    pass


@idempotency.command("check")
@click.option("--key", "-k", help="幂等键")
@click.option("--message-id", "-m", help="消息ID")
def check_idempotency(key: Optional[str], message_id: Optional[str]):
    """检查幂等记录"""
    if not key and not message_id:
        _print_error("必须指定 --key 或 --message-id")
        sys.exit(1)

    try:
        with IdempotencyService() as service:
            if key:
                record = service.get_status(key)
            else:
                record = service.get_by_message_id(message_id)

        if not record:
            _print_warning("未找到幂等记录")
            return

        status_color = (
            "green" if record["status"] == "成功"
            else "red" if record["status"] == "失败"
            else "yellow"
        )

        console.print(Panel.fit(
            f"[bold]幂等键:[/bold] {record['idempotency_key']}\n"
            f"[bold]状态:[/bold] [{status_color}]{record['status']}[/{status_color}]\n"
            f"[bold]消息ID:[/bold] {record['message_id'] or '-'}\n"
            f"[bold]业务类型:[/bold] {record['business_type'] or '-'}\n"
            f"[bold]业务ID:[/bold] {record['business_id'] or '-'}\n"
            f"[bold]错误信息:[/bold] {record['error_message'] or '-'}\n"
            f"[bold]处理时间:[/bold] {record['processed_at'] or '-'}",
            title="幂等记录",
            border_style="cyan",
        ))

        if record["result_data"]:
            console.print("")
            console.print("[bold]执行结果:[/bold]")
            console.print(json.dumps(record["result_data"], ensure_ascii=False, indent=2))
    except Exception as e:
        _print_error(f"查询失败: {e}")
        sys.exit(1)


if __name__ == "__main__":
    cli()
