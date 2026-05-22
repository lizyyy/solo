import os
import json
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
from rich.syntax import Syntax

from . import __version__
from .database import (
    get_session, init_database, create_default_users,
    authenticate, DB_PATH
)
from .models import DataSource, Role, RecordStatus
from .permissions import (
    can_perform_action, can_view_field, filter_fields_by_role,
    get_role_display_name
)
from .importer import (
    import_wms_csv, import_temperature_log,
    import_shift_record, import_driver_photo_metadata
)
from .checker import run_all_checks, get_issue_summary
from .fixer import (
    fix_record_field, auto_fix_amount, auto_fix_cross_day,
    reimport_fixed_records, get_fix_history, mark_approved
)
from .reporter import (
    generate_supervisor_report, get_operation_history,
    get_batch_list, export_to_csv, export_issues_to_csv
)

console = Console()
current_user = None


def require_login():
    global current_user
    if not current_user:
        console.print("[red]错误: 请先登录[/red]")
        raise click.Abort()
    return current_user


def require_permission(action):
    user = require_login()
    if not can_perform_action(user.role, action):
        console.print(f"[red]错误: 角色 {get_role_display_name(user.role)} 无权执行此操作[/red]")
        raise click.Abort()
    return user


@click.group()
@click.version_option(__version__)
def cli():
    """冷链中转多源导入巡检 CLI 工具"""
    pass


@cli.command()
def init():
    """初始化本地数据库和默认用户"""
    console.print(Panel.fit("正在初始化冷链巡检系统...", title="初始化"))
    
    init_database()
    session = get_session()
    create_default_users(session)
    
    console.print(f"[green]✓[/green] 数据库已创建: {DB_PATH}")
    console.print("[green]✓[/green] 默认用户已创建:")
    console.print("  - 数据录入员: entry / entry123")
    console.print("  - 复核员: reviewer / reviewer123")
    console.print("  - 运营主管: supervisor / supervisor123")
    console.print("  - 只读查看: viewer / viewer123")
    console.print("\n[green]初始化完成！[/green]")


@cli.command()
@click.option("--username", "-u", prompt=True, help="用户名")
@click.option("--password", "-p", prompt=True, hide_input=True, help="密码")
def login(username, password):
    """登录系统"""
    global current_user
    
    if not os.path.exists(DB_PATH):
        console.print("[yellow]数据库不存在，请先执行 init 命令[/yellow]")
        return
    
    session = get_session()
    user = authenticate(session, username, password)
    
    if user:
        current_user = user
        console.print(f"[green]✓[/green] 登录成功！欢迎 {user.username}")
        console.print(f"  角色: {get_role_display_name(user.role)}")
        console.print(f"  权限: {', '.join([a for a in ['init', 'import', 'view', 'check', 'fix', 'report', 'history', 'export'] if can_perform_action(user.role, a)])}")
    else:
        console.print("[red]✗[/red] 用户名或密码错误")


@cli.command()
@click.argument("source_type", type=click.Choice(["wms", "temperature", "shift", "photo"]))
@click.argument("filepath", type=click.Path(exists=True))
def import_data(source_type, filepath):
    """导入数据: wms|temperature|shift|photo 文件路径"""
    user = require_permission("import")
    session = get_session()
    
    source_map = {
        "wms": ("WMS箱号表", import_wms_csv),
        "temperature": ("温度记录仪", import_temperature_log),
        "shift": ("班次记录", import_shift_record),
        "photo": ("司机照片元数据", import_driver_photo_metadata),
    }
    
    source_name, import_func = source_map[source_type]
    
    with console.status(f"正在导入 {source_name}..."):
        try:
            batch = import_func(session, filepath, user)
            console.print(f"[green]✓[/green] 导入成功！")
            console.print(f"  批次号: {batch.batch_no}")
            console.print(f"  文件名: {batch.filename}")
            console.print(f"  记录数: {batch.total_rows}")
            
            check = click.confirm("是否立即执行数据检查？", default=True)
            if check:
                issues = run_all_checks(session, user, batch.id)
                console.print(f"\n[yellow]检查完成，发现 {len(issues)} 个问题[/yellow]")
                
                summary = get_issue_summary(session, batch.id)
                for itype, stats in summary.items():
                    console.print(f"  - {itype}: {stats['count']} 个")
                    
        except ValueError as e:
            console.print(f"[red]✗[/red] {e}")
        except Exception as e:
            console.print(f"[red]✗[/red] 导入失败: {e}")


@cli.command()
@click.option("--batch", "-b", type=int, help="批次ID，不指定则检查全部")
def check(batch):
    """检查数据质量问题"""
    user = require_permission("check")
    session = get_session()
    
    with console.status("正在检查数据..."):
        issues = run_all_checks(session, user, batch)
    
    console.print(f"检查完成，共发现 [yellow]{len(issues)}[/yellow] 个问题")
    
    summary = get_issue_summary(session, batch)
    if summary:
        table = Table(title="问题分类统计")
        table.add_column("问题类型")
        table.add_column("总数", justify="right")
        table.add_column("已解决", justify="right")
        table.add_column("未解决", justify="right")
        
        for itype, stats in summary.items():
            table.add_row(
                itype,
                str(stats["count"]),
                str(stats["resolved"]),
                str(stats["count"] - stats["resolved"])
            )
        console.print(table)


@cli.command()
@click.option("--record", "-r", type=int, help="记录ID")
@click.option("--field", "-f", help="字段名")
@click.option("--value", "-v", help="新值")
@click.option("--reason", "-m", help="修改原因")
def fix(record, field, value, reason):
    """修复问题记录"""
    user = require_permission("fix")
    session = get_session()
    
    if record and field and value:
        if not reason:
            reason = click.prompt("请输入修改原因")
        
        fix_history = fix_record_field(session, record, field, value, reason, user)
        console.print(f"[green]✓[/green] 修复成功！")
        console.print(f"  字段: {field}")
        console.print(f"  原值: {fix_history.old_value}")
        console.print(f"  新值: {fix_history.new_value}")
        console.print(f"  原因: {fix_history.fix_reason}")
    else:
        from .models import ColdChainRecord, RecordIssue
        records = session.query(ColdChainRecord).filter_by(
            status=RecordStatus.ISSUE_FOUND
        ).limit(20).all()
        
        if not records:
            console.print("[green]没有需要修复的记录[/green]")
            return
        
        table = Table(title="待修复记录 (前20条)")
        table.add_column("ID")
        table.add_column("原始行号")
        table.add_column("箱号")
        table.add_column("问题")
        
        for r in records:
            issues = session.query(RecordIssue).filter_by(
                record_id=r.id, resolved=False
            ).all()
            issue_types = ", ".join([i.issue_type.value for i in issues[:2]])
            if len(issues) > 2:
                issue_types += f"..."
            
            table.add_row(str(r.id), str(r.original_line_no), r.box_no or "-", issue_types)
        
        console.print(table)
        console.print("\n使用: cci fix -r <记录ID> -f <字段> -v <新值> -m <原因>")


@cli.command()
@click.option("--batch", "-b", type=int, help="批次ID")
@click.option("--days", "-d", type=int, default=7, help="统计天数")
def report(batch, days):
    """运营主管报表"""
    user = require_permission("report")
    session = get_session()
    
    with console.status("正在生成报表..."):
        report_data = generate_supervisor_report(session, batch, days)
    
    console.print(Panel.fit(
        f"冷链中转巡检报表 - 近{days}天",
        title="运营主管报表",
        subtitle=f"生成时间: {report_data['generated_at']}"
    ))
    
    console.print("\n[bold]一、总体概览[/bold]")
    summary = report_data["summary"]
    table = Table()
    table.add_column("指标")
    table.add_column("数值", justify="right")
    table.add_row("总记录数", str(summary.get("total_records", 0)))
    table.add_row("总问题数", str(summary.get("total_issues", 0)))
    
    status_map = {
        "pending": "待处理",
        "issue_found": "有问题",
        "fixed": "已修复",
        "approved": "已审批",
        "rejected": "已拒绝"
    }
    for status, count in summary.get("by_status", {}).items():
        table.add_row(f"状态: {status_map.get(status, status)}", str(count))
    console.print(table)
    
    console.print("\n[bold]二、问题分类[/bold]")
    if report_data["issue_by_type"]:
        table = Table()
        table.add_column("问题类型")
        table.add_column("总数", justify="right")
        table.add_column("已解决", justify="right")
        
        for itype, data in report_data["issue_by_type"].items():
            table.add_row(
                itype,
                str(data["count"]),
                str(data["resolved"])
            )
        console.print(table)
    
    failed = report_data["failed_records"]
    if failed:
        console.print(f"\n[bold red]三、失败清单 ({len(failed)} 条)[/bold red]")
        table = Table(show_lines=True)
        table.add_column("记录ID")
        table.add_column("原始行号")
        table.add_column("箱号")
        table.add_column("问题描述")
        
        for r in failed[:10]:
            issues_desc = "\n".join([f"{i['type']}: {i['description']}" for i in r["issues"]])
            table.add_row(
                str(r["record_id"]),
                str(r["original_line_no"] or "-"),
                r["box_no"] or "-",
                issues_desc
            )
        console.print(table)
        if len(failed) > 10:
            console.print(f"  ... 还有 {len(failed) - 10} 条")
    
    fixed = report_data["fixed_records"]
    if fixed:
        console.print(f"\n[bold green]四、已修复记录 ({len(fixed)} 条)[/bold green]")
        table = Table()
        table.add_column("记录ID")
        table.add_column("原始行号")
        table.add_column("箱号")
        table.add_column("修复次数", justify="right")
        
        for r in fixed[:10]:
            table.add_row(
                str(r["record_id"]),
                str(r["original_line_no"] or "-"),
                r["box_no"] or "-",
                str(r["fix_count"])
            )
        console.print(table)
    
    reimport = report_data["reimport_summary"]
    if reimport:
        console.print(f"\n[bold blue]五、修正后再导入 ({len(reimport)} 批次)[/bold blue]")
        table = Table()
        table.add_column("批次号")
        table.add_column("文件名")
        table.add_column("记录数", justify="right")
        
        for b in reimport:
            table.add_row(b["batch_no"], b["filename"] or "-", str(b["total_rows"]))
        console.print(table)


@cli.command()
@click.option("--user", "-u", type=int, help="用户ID")
@click.option("--action", "-a", help="操作类型")
@click.option("--days", "-d", type=int, default=30, help="查询天数")
@click.option("--limit", "-l", type=int, default=50, help="显示条数")
def history(user, action, days, limit):
    """查看操作历史"""
    user = require_permission("history")
    session = get_session()
    
    logs = get_operation_history(session, user, action, days)
    
    console.print(f"操作历史 (近{days}天，显示前{limit}条):")
    table = Table()
    table.add_column("时间")
    table.add_column("用户ID")
    table.add_column("操作")
    table.add_column("资源类型")
    table.add_column("资源ID")
    
    for log in logs[:limit]:
        table.add_row(
            log["created_at"][:19] if log["created_at"] else "-",
            str(log["user_id"] or "-"),
            log["action"],
            log["resource_type"] or "-",
            str(log["resource_id"] or "-")
        )
    console.print(table)


@cli.command()
def batches():
    """查看导入批次列表"""
    _ = require_login()
    session = get_session()
    
    batches = get_batch_list(session)
    
    table = Table(title="导入批次列表")
    table.add_column("ID")
    table.add_column("批次号")
    table.add_column("来源")
    table.add_column("文件名")
    table.add_column("记录数")
    table.add_column("问题数")
    table.add_column("状态")
    table.add_column("导入时间")
    
    for b in batches:
        table.add_row(
            str(b["id"]),
            b["batch_no"],
            b["source"] or "-",
            b["filename"] or "-",
            str(b["actual_records"]),
            str(b["issues"]),
            b["status"],
            b["imported_at"][:19] if b["imported_at"] else "-"
        )
    console.print(table)


@cli.command()
@click.option("--batch", "-b", type=int, help="批次ID")
@click.option("--output", "-o", default="export.csv", help="输出文件名")
@click.option("--issues/--no-issues", default=False, help="导出问题而非记录")
def export(batch, output, issues):
    """导出数据"""
    user = require_permission("export")
    session = get_session()
    
    if issues:
        count = export_issues_to_csv(session, output, batch)
        console.print(f"[green]✓[/green] 已导出 {count} 条问题记录到 {output}")
    else:
        count = export_to_csv(session, output, batch)
        console.print(f"[green]✓[/green] 已导出 {count} 条记录到 {output}")


@cli.command()
@click.argument("batch_id", type=int)
def reimport(batch_id):
    """重新导入已修复的记录"""
    user = require_permission("fix")
    session = get_session()
    
    result = reimport_fixed_records(session, batch_id, user)
    console.print(f"[green]✓[/green] {result['message']}")
    if result.get("new_batch_no"):
        console.print(f"  新批次号: {result['new_batch_no']}")


@cli.command()
@click.argument("record_id", type=int)
def approve(record_id):
    """审批通过记录 (主管专用)"""
    user = require_permission("approve")
    session = get_session()
    
    try:
        mark_approved(session, record_id, user)
        console.print(f"[green]✓[/green] 记录 {record_id} 已审批通过")
    except (PermissionError, ValueError) as e:
        console.print(f"[red]✗[/red] {e}")


def main():
    cli()


if __name__ == "__main__":
    main()
