import os
import sys
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich import print as rprint
from datetime import datetime

from .config import Config
from .service import RefundService
from .models import RefundStatus
from . import sample_data

console = Console()


def get_service(workspace=None):
    config = Config(workspace)
    return RefundService(config)


def format_amount(amount: float) -> str:
    return f"¥{amount:,.2f}"


def get_status_style(status: RefundStatus) -> str:
    styles = {
        RefundStatus.APPROVED: "green bold",
        RefundStatus.REVIEW_REQUIRED: "yellow bold",
        RefundStatus.BLOCKED: "red bold",
        RefundStatus.PENDING: "blue",
        RefundStatus.PROCESSED: "cyan",
        RefundStatus.REJECTED: "strike red"
    }
    return styles.get(status, "white")


def get_status_label(status: RefundStatus) -> str:
    labels = {
        RefundStatus.APPROVED: "✅ 可打款",
        RefundStatus.REVIEW_REQUIRED: "⚠️  需复核",
        RefundStatus.BLOCKED: "🚫 禁止打款",
        RefundStatus.PENDING: "⏳ 待检查",
        RefundStatus.PROCESSED: "💰 已打款",
        RefundStatus.REJECTED: "❌ 已拒绝"
    }
    return labels.get(status, status)


@click.group(invoke_without_command=True)
@click.option('--workspace', '-w', default=None, help='工作目录路径')
@click.pass_context
def main(ctx, workspace):
    """财务批量退款异常拦截 CLI 工具"""
    ctx.ensure_object(dict)
    ctx.obj['workspace'] = workspace
    
    if ctx.invoked_subcommand is None:
        click.echo(ctx.get_help())


@main.command()
@click.option('--with-samples', is_flag=True, help='同时加载样例数据')
@click.pass_context
def init(ctx, with_samples):
    """初始化工作目录"""
    service = get_service(ctx.obj['workspace'])
    
    with console.status("[bold green]正在初始化..."):
        state = service.init_workspace()
    
    console.print(Panel.fit(
        f"[bold green]✓ 工作目录初始化成功[/bold green]\n"
        f"初始化时间: {state.initialized_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"工作目录: {service.config.workspace_path}",
        title="初始化完成"
    ))
    
    if with_samples:
        sample_path = sample_data.create_sample_files(service.config.import_dir)
        console.print(f"\n[bold blue]样例数据已创建在:[/bold blue] {sample_path}")
        console.print("\n[yellow]提示: 使用以下命令导入样例数据:")
        console.print(f"  refund-interceptor import --type payments {sample_path}/payments.json")
        console.print(f"  refund-interceptor import --type blacklist {sample_path}/blacklist.json")
        console.print(f"  refund-interceptor import --type approvals {sample_path}/approvals.json")
        console.print(f"  refund-interceptor import --type historical {sample_path}/historical_refunds.json")
        console.print(f"  refund-interceptor import --type requests {sample_path}/refund_requests.json")


@main.group()
def import_cmd():
    """导入各类数据"""
    pass


@import_cmd.command('payments')
@click.argument('file_path')
@click.pass_context
def import_payments(ctx, file_path):
    """导入订单支付数据"""
    service = get_service(ctx.obj['workspace'])
    
    if not service.is_initialized():
        console.print("[bold red]错误: 工作目录未初始化，请先运行 init 命令[/bold red]")
        sys.exit(1)
    
    count = service.import_payments(file_path)
    console.print(f"[bold green]✓ 成功导入 {count} 条订单支付记录[/bold green]")


@import_cmd.command('blacklist')
@click.argument('file_path')
@click.pass_context
def import_blacklist(ctx, file_path):
    """导入黑名单数据"""
    service = get_service(ctx.obj['workspace'])
    
    if not service.is_initialized():
        console.print("[bold red]错误: 工作目录未初始化，请先运行 init 命令[/bold red]")
        sys.exit(1)
    
    count = service.import_blacklist(file_path)
    console.print(f"[bold green]✓ 成功导入 {count} 条黑名单记录[/bold green]")


@import_cmd.command('approvals')
@click.argument('file_path')
@click.pass_context
def import_approvals(ctx, file_path):
    """导入审批记录"""
    service = get_service(ctx.obj['workspace'])
    
    if not service.is_initialized():
        console.print("[bold red]错误: 工作目录未初始化，请先运行 init 命令[/bold red]")
        sys.exit(1)
    
    count = service.import_approvals(file_path)
    console.print(f"[bold green]✓ 成功导入 {count} 条审批记录[/bold green]")


@import_cmd.command('historical')
@click.argument('file_path')
@click.pass_context
def import_historical(ctx, file_path):
    """导入历史退款数据"""
    service = get_service(ctx.obj['workspace'])
    
    if not service.is_initialized():
        console.print("[bold red]错误: 工作目录未初始化，请先运行 init 命令[/bold red]")
        sys.exit(1)
    
    count = service.import_historical_refunds(file_path)
    console.print(f"[bold green]✓ 成功导入 {count} 条历史退款记录[/bold green]")


@import_cmd.command('requests')
@click.argument('file_path')
@click.pass_context
def import_requests(ctx, file_path):
    """导入退款申请数据"""
    service = get_service(ctx.obj['workspace'])
    
    if not service.is_initialized():
        console.print("[bold red]错误: 工作目录未初始化，请先运行 init 命令[/bold red]")
        sys.exit(1)
    
    count = service.import_refund_requests(file_path)
    console.print(f"[bold green]✓ 成功导入 {count} 条退款申请[/bold green]")


@main.command()
@click.option('--request-id', '-r', default=None, help='指定检查单个退款申请ID')
@click.pass_context
def check(ctx, request_id):
    """执行退款规则检查"""
    service = get_service(ctx.obj['workspace'])
    
    if not service.is_initialized():
        console.print("[bold red]错误: 工作目录未初始化，请先运行 init 命令[/bold red]")
        sys.exit(1)
    
    with console.status("[bold blue]正在执行规则检查..."):
        results = service.check_all()
    
    table = Table(title="检查结果汇总", show_lines=True)
    table.add_column("申请ID", style="cyan", no_wrap=True)
    table.add_column("订单ID", style="blue")
    table.add_column("金额", justify="right")
    table.add_column("状态", justify="center")
    table.add_column("失败规则", style="red")
    
    for req in results:
        failed_rules = [r.rule_name for r in req.check_results if not r.passed]
        failed_str = ", ".join(failed_rules) if failed_rules else "-"
        
        table.add_row(
            req.request_id,
            req.order_id,
            format_amount(req.amount),
            f"[{get_status_style(req.status)}]{get_status_label(req.status)}[/{get_status_style(req.status)}]",
            failed_str
        )
    
    console.print()
    console.print(table)
    
    report = service.get_report()
    summary = report['summary']
    
    summary_panel = Panel(
        f"[green]可打款: {summary['approved_count']} 笔 ({format_amount(summary['total_amount_approved'])})[/green]\n"
        f"[yellow]需复核: {summary['review_count']} 笔 ({format_amount(summary['total_amount_review'])})[/yellow]\n"
        f"[red]禁止打款: {summary['blocked_count']} 笔 ({format_amount(summary['total_amount_blocked'])})[/red]",
        title="状态统计"
    )
    console.print()
    console.print(summary_panel)


@main.command()
@click.argument('request_id')
@click.pass_context
def detail(ctx, request_id):
    """查看退款申请详情"""
    service = get_service(ctx.obj['workspace'])
    
    if not service.is_initialized():
        console.print("[bold red]错误: 工作目录未初始化，请先运行 init 命令[/bold red]")
        sys.exit(1)
    
    detail_data = service.get_request_detail(request_id)
    
    if not detail_data:
        console.print(f"[bold red]未找到退款申请: {request_id}[/bold red]")
        sys.exit(1)
    
    req = detail_data['request']
    payment = detail_data['payment']
    approval = detail_data['approval']
    blacklist = detail_data['blacklist_item']
    historical = detail_data['historical_refunds']
    corrections = detail_data['corrections']
    
    console.print(Panel(
        f"[bold]申请ID:[/bold] {req.request_id}\n"
        f"[bold]订单ID:[/bold] {req.order_id}\n"
        f"[bold]退款账户:[/bold] {req.user_account}\n"
        f"[bold]申请金额:[/bold] {format_amount(req.amount)}\n"
        f"[bold]申请原因:[/bold] {req.reason}\n"
        f"[bold]申请人:[/bold] {req.requested_by}\n"
        f"[bold]申请时间:[/bold] {req.requested_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"[bold]当前状态:[/bold] [{get_status_style(req.status)}]{get_status_label(req.status)}[/{get_status_style(req.status)}]",
        title="退款申请信息",
        border_style="cyan"
    ))
    
    if payment:
        console.print()
        historical_total = sum(h.amount for h in historical) if historical else 0
        remaining = payment.amount - historical_total
        
        console.print(Panel(
            f"[bold]实付金额:[/bold] {format_amount(payment.amount)}\n"
            f"[bold]支付时间:[/bold] {payment.paid_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"[bold]历史退款累计:[/bold] {format_amount(historical_total)}\n"
            f"[bold]剩余可退:[/bold] {format_amount(remaining)}",
            title="订单支付信息",
            border_style="blue"
        ))
    else:
        console.print("\n[bold red]⚠️  未找到该订单的支付记录[/bold red]")
    
    if blacklist:
        console.print()
        console.print(Panel(
            f"[bold red]⚠️  账户在黑名单中[/bold red]\n"
            f"[bold]加入原因:[/bold] {blacklist.reason}\n"
            f"[bold]加入时间:[/bold] {blacklist.added_at.strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"[bold]操作人:[/bold] {blacklist.added_by}",
            title="黑名单警告",
            border_style="red"
        ))
    
    if approval:
        console.print()
        approval_status = "✅ 已审批" if approval.status == "approved" else f"⚠️  {approval.status}"
        expired_str = ""
        if approval.expires_at:
            now = datetime.now()
            if now > approval.expires_at:
                expired_str = " [red](已过期)[/red]"
        
        console.print(Panel(
            f"[bold]审批ID:[/bold] {approval.approval_id}\n"
            f"[bold]审批人:[/bold] {approval.approver}\n"
            f"[bold]审批金额:[/bold] {format_amount(approval.amount)}\n"
            f"[bold]审批状态:[/bold] {approval_status}{expired_str}\n"
            f"[bold]审批时间:[/bold] {approval.approved_at.strftime('%Y-%m-%d %H:%M:%S') if approval.approved_at else '-'}\n"
            f"[bold]有效期至:[/bold] {approval.expires_at.strftime('%Y-%m-%d %H:%M:%S') if approval.expires_at else '无限制'}",
            title="审批信息",
            border_style="green" if approval.status == "approved" else "yellow"
        ))
    else:
        console.print("\n[bold red]⚠️  未找到该申请的审批记录[/bold red]")
    
    if historical:
        console.print()
        hist_table = Table(title="历史退款记录", show_lines=True)
        hist_table.add_column("退款ID", style="cyan")
        hist_table.add_column("金额", justify="right")
        hist_table.add_column("处理时间")
        hist_table.add_column("状态")
        
        for h in historical:
            hist_table.add_row(
                h.refund_id,
                format_amount(h.amount),
                h.processed_at.strftime('%Y-%m-%d %H:%M:%S'),
                h.status
            )
        console.print(hist_table)
    
    if req.check_results:
        console.print()
        check_tree = Tree("📋 规则检查结果")
        
        for result in req.check_results:
            status_icon = "✅" if result.passed else "❌"
            branch = check_tree.add(f"{status_icon} {result.rule_name}")
            branch.add(f"[dim]描述: {result.message}[/dim]")
            if result.details:
                detail_branch = branch.add("[dim]详情:[/dim]")
                for key, value in result.details.items():
                    detail_branch.add(f"[dim]{key}: {value}[/dim]")
        
        console.print(check_tree)
    
    if corrections:
        console.print()
        corr_table = Table(title="人工修正记录", show_lines=True)
        corr_table.add_column("修正ID", style="cyan")
        corr_table.add_column("字段")
        corr_table.add_column("旧值", style="strike red")
        corr_table.add_column("新值", style="green")
        corr_table.add_column("修正人")
        corr_table.add_column("修正时间")
        corr_table.add_column("原因")
        
        for c in corrections:
            corr_table.add_row(
                c.correction_id[:8] + "...",
                c.field,
                c.old_value,
                c.new_value,
                c.corrected_by,
                c.corrected_at.strftime('%Y-%m-%d %H:%M:%S'),
                c.reason
            )
        console.print(corr_table)


@main.command()
@click.option('--format', '-f', type=click.Choice(['table', 'json']), default='table', help='输出格式')
@click.pass_context
def report(ctx, format):
    """生成检查报告"""
    service = get_service(ctx.obj['workspace'])
    
    if not service.is_initialized():
        console.print("[bold red]错误: 工作目录未初始化，请先运行 init 命令[/bold red]")
        sys.exit(1)
    
    report_data = service.get_report()
    summary = report_data['summary']
    
    if format == 'json':
        import json
        output = {
            'summary': summary,
            'approved': [
                {
                    'request_id': r.request_id,
                    'order_id': r.order_id,
                    'amount': r.amount,
                    'user_account': r.user_account
                }
                for r in report_data['approved']
            ],
            'review_required': [
                {
                    'request_id': r.request_id,
                    'order_id': r.order_id,
                    'amount': r.amount,
                    'user_account': r.user_account,
                    'failed_rules': [x.rule_name for x in r.check_results if not x.passed]
                }
                for r in report_data['review_required']
            ],
            'blocked': [
                {
                    'request_id': r.request_id,
                    'order_id': r.order_id,
                    'amount': r.amount,
                    'user_account': r.user_account,
                    'failed_rules': [x.rule_name for x in r.check_results if not x.passed]
                }
                for r in report_data['blocked']
            ]
        }
        console.print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        console.print(Panel(
            f"[bold]总计:[/bold] {report_data['total']} 笔退款申请\n"
            f"[green bold]可打款:[/green bold] {summary['approved_count']} 笔 ({format_amount(summary['total_amount_approved'])})\n"
            f"[yellow bold]需复核:[/yellow bold] {summary['review_count']} 笔 ({format_amount(summary['total_amount_review'])})\n"
            f"[red bold]禁止打款:[/red bold] {summary['blocked_count']} 笔 ({format_amount(summary['total_amount_blocked'])})\n"
            f"[blue]待检查:[/blue] {summary['pending_count']} 笔",
            title="退款拦截报告",
            border_style="bold cyan"
        ))
        
        if report_data['approved']:
            console.print()
            approved_table = Table(title="✅ 可打款清单", show_lines=True, style="green")
            approved_table.add_column("申请ID", style="cyan")
            approved_table.add_column("订单ID")
            approved_table.add_column("退款账户")
            approved_table.add_column("金额", justify="right")
            
            for r in report_data['approved']:
                approved_table.add_row(
                    r.request_id,
                    r.order_id,
                    r.user_account,
                    format_amount(r.amount)
                )
            console.print(approved_table)
        
        if report_data['review_required']:
            console.print()
            review_table = Table(title="⚠️  需复核清单", show_lines=True, style="yellow")
            review_table.add_column("申请ID", style="cyan")
            review_table.add_column("订单ID")
            review_table.add_column("退款账户")
            review_table.add_column("金额", justify="right")
            review_table.add_column("问题规则", style="red")
            
            for r in report_data['review_required']:
                failed = [x.rule_name for x in r.check_results if not x.passed]
                review_table.add_row(
                    r.request_id,
                    r.order_id,
                    r.user_account,
                    format_amount(r.amount),
                    ", ".join(failed)
                )
            console.print(review_table)
        
        if report_data['blocked']:
            console.print()
            blocked_table = Table(title="🚫 禁止打款清单", show_lines=True, style="red")
            blocked_table.add_column("申请ID", style="cyan")
            blocked_table.add_column("订单ID")
            blocked_table.add_column("退款账户")
            blocked_table.add_column("金额", justify="right")
            blocked_table.add_column("拦截规则", style="red")
            
            for r in report_data['blocked']:
                failed = [x.rule_name for x in r.check_results if not x.passed]
                blocked_table.add_row(
                    r.request_id,
                    r.order_id,
                    r.user_account,
                    format_amount(r.amount),
                    ", ".join(failed)
                )
            console.print(blocked_table)


@main.command()
@click.argument('request_id')
@click.option('--field', '-f', required=True, help='要修正的字段名')
@click.option('--value', '-v', required=True, help='新值')
@click.option('--operator', '-o', required=True, help='操作人')
@click.option('--reason', '-r', required=True, help='修正原因')
@click.pass_context
def correct(ctx, request_id, field, value, operator, reason):
    """人工修正退款申请"""
    service = get_service(ctx.obj['workspace'])
    
    if not service.is_initialized():
        console.print("[bold red]错误: 工作目录未初始化，请先运行 init 命令[/bold red]")
        sys.exit(1)
    
    req = service.correct_request(request_id, field, value, operator, reason)
    
    if req:
        console.print(Panel(
            f"[bold green]✓ 修正成功[/bold green]\n"
            f"修正字段: {field}\n"
            f"操作人: {operator}\n"
            f"修正原因: {reason}\n\n"
            f"[yellow]提示: 请重新运行 check 命令重新检查该申请[/yellow]",
            title="人工修正完成"
        ))
    else:
        console.print(f"[bold red]未找到退款申请: {request_id}[/bold red]")
        sys.exit(1)


@main.command()
@click.pass_context
def demo(ctx):
    """一键演示：初始化 + 导入样例数据 + 执行检查 + 生成报告"""
    workspace = ctx.obj['workspace']
    service = get_service(workspace)
    
    console.print(Panel("[bold blue]🚀 开始一键演示流程[/bold blue]"))
    
    console.print("\n[bold]步骤 1: 初始化工作目录[/bold]")
    service.init_workspace()
    console.print("[green]✓ 工作目录初始化完成[/green]")
    
    console.print("\n[bold]步骤 2: 创建样例数据[/bold]")
    sample_path = sample_data.create_sample_files(service.config.import_dir)
    console.print(f"[green]✓ 样例数据创建完成: {sample_path}[/green]")
    
    console.print("\n[bold]步骤 3: 导入订单支付数据[/bold]")
    count = service.import_payments(str(sample_path / "payments.json"))
    console.print(f"[green]✓ 导入 {count} 条订单支付记录[/green]")
    
    console.print("\n[bold]步骤 4: 导入黑名单数据[/bold]")
    count = service.import_blacklist(str(sample_path / "blacklist.json"))
    console.print(f"[green]✓ 导入 {count} 条黑名单记录[/green]")
    
    console.print("\n[bold]步骤 5: 导入审批记录[/bold]")
    count = service.import_approvals(str(sample_path / "approvals.json"))
    console.print(f"[green]✓ 导入 {count} 条审批记录[/green]")
    
    console.print("\n[bold]步骤 6: 导入历史退款数据[/bold]")
    count = service.import_historical_refunds(str(sample_path / "historical_refunds.json"))
    console.print(f"[green]✓ 导入 {count} 条历史退款记录[/green]")
    
    console.print("\n[bold]步骤 7: 导入退款申请[/bold]")
    count = service.import_refund_requests(str(sample_path / "refund_requests.json"))
    console.print(f"[green]✓ 导入 {count} 条退款申请[/green]")
    
    console.print("\n[bold]步骤 8: 执行规则检查[/bold]")
    service.check_all()
    console.print("[green]✓ 规则检查完成[/green]")
    
    console.print("\n[bold]步骤 9: 生成报告[/bold]")
    report_data = service.get_report()
    summary = report_data['summary']
    
    console.print(Panel(
        f"[bold]总计:[/bold] {report_data['total']} 笔退款申请\n"
        f"[green bold]可打款:[/green bold] {summary['approved_count']} 笔 ({format_amount(summary['total_amount_approved'])})\n"
        f"[yellow bold]需复核:[/yellow bold] {summary['review_count']} 笔 ({format_amount(summary['total_amount_review'])})\n"
        f"[red bold]禁止打款:[/red bold] {summary['blocked_count']} 笔 ({format_amount(summary['total_amount_blocked'])})",
        title="演示完成 - 最终报告",
        border_style="bold green"
    ))
    
    console.print("\n[bold blue]💡 下一步操作建议:[/bold blue]")
    console.print("1. 查看详情: refund-interceptor detail REQ-001")
    console.print("2. 查看详情: refund-interceptor detail REQ-002 (重复退款)")
    console.print("3. 查看详情: refund-interceptor detail REQ-004 (黑名单)")
    console.print("4. 查看详情: refund-interceptor detail REQ-005 (审批缺失)")


if __name__ == '__main__':
    main()
