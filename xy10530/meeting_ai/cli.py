import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box
from typing import Optional
import os
import sys
from getpass import getuser
from datetime import datetime, date, timedelta

from .database import init_db, get_db_path
from .repository import (
    ParticipantRepository, RoleRepository, ActionItemRepository,
    MeetingRepository, AuditLogRepository, ImportRecordRepository
)
from .services import (
    MeetingService, ActionItemService, ParticipantService,
    ValidationError, ImportResult, CheckResult
)
from .models import ActionItemStatus, OperationType


console = Console()


def get_operator() -> str:
    return os.environ.get("MEETING_AI_OPERATOR") or getuser()


def format_date(d: Optional[date]) -> str:
    if d is None:
        return "-"
    return d.strftime("%Y-%m-%d")


def format_datetime(dt: Optional[datetime]) -> str:
    if dt is None:
        return "-"
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def get_status_color(status: ActionItemStatus) -> str:
    colors = {
        ActionItemStatus.PENDING: "blue",
        ActionItemStatus.IN_PROGRESS: "cyan",
        ActionItemStatus.BLOCKED: "yellow",
        ActionItemStatus.OVERDUE: "red",
        ActionItemStatus.DONE: "green",
        ActionItemStatus.CANCELLED: "grey50",
    }
    return colors.get(status, "white")


def get_status_label(status: ActionItemStatus) -> str:
    labels = {
        ActionItemStatus.PENDING: "待办",
        ActionItemStatus.IN_PROGRESS: "进行中",
        ActionItemStatus.BLOCKED: "阻塞",
        ActionItemStatus.OVERDUE: "逾期",
        ActionItemStatus.DONE: "已完成",
        ActionItemStatus.CANCELLED: "已取消",
    }
    return labels.get(status, status.value)


@click.group()
def cli():
    """会议纪要行动项 CLI - 管理会议纪要中的行动项、负责人、截止日期和依赖关系"""
    pass


@cli.command()
def init():
    """初始化本地数据库"""
    db_path = get_db_path()
    
    if init_db():
        console.print(f"[green]✓ 数据库初始化成功:[/green] {db_path}")
        console.print("\n[bold]下一步:[/bold]")
        console.print("  meeting-ai import <纪要文件>   导入会议纪要")
        console.print("  meeting-ai check                检查所有行动项状态")
    else:
        console.print(f"[yellow]! 数据库已存在:[/yellow] {db_path}")
        console.print("  如需重新初始化，请先删除数据库文件")


@cli.command()
@click.argument('file_path', type=click.Path(exists=True, readable=True))
@click.option('--force', is_flag=True, help='强制导入（即使已存在）')
@click.option('--operator', help='操作者名称')
def import_cmd(file_path, force, operator):
    """导入会议纪要文件（Markdown 或文本）"""
    op = operator or get_operator()
    console.print(f"[cyan]正在导入:[/cyan] {file_path}")
    console.print(f"[cyan]操作者:[/cyan] {op}")
    
    result = MeetingService.import_file(file_path, operator=op, force=force)
    
    if result.skipped_duplicate:
        console.print("\n[yellow]⚠ 该纪要已导入，跳过重复导入[/yellow]")
        for w in result.warnings:
            console.print(f"  [yellow]-[/yellow] {w.message}")
        return
    
    if result.success:
        console.print(f"\n[green]✓ 导入成功[/green]")
        console.print(f"  会议 ID: {result.meeting_id}")
        console.print(f"  行动项数: {result.action_count}")
    else:
        console.print(f"\n[red]✗ 导入失败[/red]")
        for e in result.errors:
            console.print(f"  [red]-[/red] [{e.code}] {e.message}")
        sys.exit(1)
    
    if result.warnings:
        console.print(f"\n[yellow]⚠ 警告 ({len(result.warnings)} 条):[/yellow]")
        for w in result.warnings:
            console.print(f"  [yellow]-[/yellow] [{w.code}] {w.message}")
            if w.detail:
                console.print(f"       {w.detail}")


@cli.command()
def check():
    """检查所有行动项的状态（自动检测逾期和阻塞）"""
    console.print("[cyan]正在检查所有行动项状态...[/cyan]")
    
    result = ActionItemService.check_all_status()
    
    table = Table(title="状态概览", box=box.ROUNDED)
    table.add_column("状态", style="bold")
    table.add_column("数量", justify="right")
    
    total_ongoing = result.total_actions - result.done_count
    
    table.add_row("📋 总计", f"{result.total_actions}")
    table.add_row("[blue]🆕 新增/待办[/blue]", f"{result.new_count}")
    table.add_row("[red]⏰ 逾期[/red]", f"{result.overdue_count}")
    table.add_row("[yellow]🔒 阻塞[/yellow]", f"{result.blocked_count}")
    table.add_row("[green]✅ 已完成[/green]", f"{result.done_count}")
    table.add_row("📊 闭环率", f"{(result.done_count/result.total_actions*100):.1f}%" if result.total_actions > 0 else "0.0%")
    
    console.print(table)
    
    if result.errors:
        console.print(f"\n[red]✗ 错误 ({len(result.errors)} 条):[/red]")
        for e in result.errors:
            action_str = f" #{e.action_id}" if e.action_id else ""
            console.print(f"  [red]-[/red] [{e.code}] 行动项{action_str}: {e.message}")
            if e.detail:
                console.print(f"       {e.detail}")
    
    if result.warnings:
        console.print(f"\n[yellow]⚠ 警告 ({len(result.warnings)} 条):[/yellow]")
        for w in result.warnings:
            action_str = f" #{w.action_id}" if w.action_id else ""
            console.print(f"  [yellow]-[/yellow] [{w.code}] 行动项{action_str}: {w.message}")


@cli.command()
@click.argument('action_id', type=int)
@click.option('--history', is_flag=True, help='显示历史记录')
def detail(action_id, history):
    """查看单个行动项的详细信息"""
    action = ActionItemRepository.get_by_id(action_id)
    
    if action is None:
        console.print(f"[red]✗ 行动项 #{action_id} 不存在[/red]")
        sys.exit(1)
    
    meeting = MeetingRepository.get_all()
    meeting_title = "未知"
    for m in meeting:
        if m.id == action.meeting_id:
            meeting_title = m.title
            break
    
    status_color = get_status_color(action.status)
    status_label = get_status_label(action.status)
    
    deps = []
    for dep_id in action.dependencies:
        dep = ActionItemRepository.get_by_id(dep_id)
        if dep:
            deps.append(f"#{dep_id} [{get_status_label(dep.status)}]")
    
    panel_content = f"""
[bold]描述:[/bold] {action.description}

[bold]负责人:[/bold] {', '.join(action.assignees) if action.assignees else '-'}
[bold]截止日期:[/bold] {format_date(action.due_date)}
[bold]状态:[/bold] [{status_color}]{status_label}[/{status_color}]
[bold]依赖:[/bold] {', '.join(deps) if deps else '-'}

[bold]来自会议:[/bold] {meeting_title}
[bold]创建时间:[/bold] {format_datetime(action.created_at)}
[bold]更新时间:[/bold] {format_datetime(action.updated_at)}
[bold]完成时间:[/bold] {format_datetime(action.completed_at)}
"""
    if action.notes:
        panel_content += f"\n[bold]备注:[/bold] {action.notes}"
    
    console.print(Panel(panel_content, title=f"行动项 #{action_id}", expand=False))
    
    if history:
        logs = AuditLogRepository.get_by_entity("action_item", action_id)
        if logs:
            console.print(f"\n[bold]历史记录 ({len(logs)} 条):[/bold]")
            for log in logs:
                console.print(f"\n  [{log.created_at.strftime('%H:%M:%S')}] {log.operator} 执行 {log.operation_type.value}")
                if log.old_value:
                    console.print(f"    [red]-[/red] {log.old_value}")
                if log.new_value:
                    console.print(f"    [green]+[/green] {log.new_value}")
                if log.reason:
                    console.print(f"    原因: {log.reason}")
        else:
            console.print("\n[yellow]无历史记录[/yellow]")


@cli.command()
@click.option('--by-assignee', is_flag=True, help='按负责人分组显示')
@click.option('--status', type=click.Choice(['pending', 'in_progress', 'blocked', 'overdue', 'done', 'cancelled'], case_sensitive=False),
              help='筛选状态')
@click.option('--assignee', help='筛选负责人')
def report(by_assignee, status, assignee):
    """生成行动项报告"""
    all_actions = ActionItemRepository.get_all()
    
    filtered = all_actions
    
    if status:
        status_enum = ActionItemStatus(status.lower())
        filtered = [a for a in filtered if a.status == status_enum]
    
    if assignee:
        filtered = [a for a in filtered if assignee in a.assignees]
    
    if by_assignee:
        assignee_map = ActionItemService.get_by_assignee()
        
        for assignee_name, actions in sorted(assignee_map.items()):
            if assignee and assignee != assignee_name:
                continue
            
            if status:
                status_enum = ActionItemStatus(status.lower())
                actions = [a for a in actions if a.status == status_enum]
            
            if not actions and assignee is None:
                continue
            
            table = Table(title=f"👤 {assignee_name}", box=box.SIMPLE)
            table.add_column("#", style="dim", justify="right")
            table.add_column("状态")
            table.add_column("截止日期")
            table.add_column("描述")
            
            for action in actions:
                status_color = get_status_color(action.status)
                status_label = get_status_label(action.status)
                table.add_row(
                    str(action.id),
                    f"[{status_color}]{status_label}[/{status_color}]",
                    format_date(action.due_date),
                    action.description[:50] + "..." if len(action.description) > 50 else action.description
                )
            
            console.print(table)
        
        return
    
    table = Table(title="📊 行动项报告", box=box.ROUNDED)
    table.add_column("#", style="dim", justify="right")
    table.add_column("状态")
    table.add_column("负责人")
    table.add_column("截止日期")
    table.add_column("依赖")
    table.add_column("描述")
    
    for action in filtered:
        status_color = get_status_color(action.status)
        status_label = get_status_label(action.status)
        table.add_row(
            str(action.id),
            f"[{status_color}]{status_label}[/{status_color}]",
            ", ".join(action.assignees),
            format_date(action.due_date),
            ",".join(f"#{d}" for d in action.dependencies) if action.dependencies else "-",
            action.description[:40] + "..." if len(action.description) > 40 else action.description
        )
    
    console.print(table)
    
    total = len(filtered)
    done = sum(1 for a in filtered if a.status == ActionItemStatus.DONE)
    overdue = sum(1 for a in filtered if a.status == ActionItemStatus.OVERDUE)
    blocked = sum(1 for a in filtered if a.status == ActionItemStatus.BLOCKED)
    
    console.print(f"\n[bold]统计:[/bold] 总计 {total} | [green]已完成 {done}[/green] | [red]逾期 {overdue}[/red] | [yellow]阻塞 {blocked}[/yellow]")
    if total > 0:
        console.print(f"[bold]闭环率:[/bold] {(done/total*100):.1f}%")


@cli.command()
@click.argument('action_id', type=int)
@click.option('--reason', help='完成原因/备注')
@click.option('--operator', help='操作者名称')
def complete(action_id, reason, operator):
    """标记行动项为已完成"""
    op = operator or get_operator()
    success, errors = ActionItemService.complete_action(action_id, op, reason)
    
    if success:
        console.print(f"[green]✓ 行动项 #{action_id} 已标记为完成[/green]")
    else:
        for e in errors:
            console.print(f"[red]✗ [{e.code}] {e.message}[/red]")
        sys.exit(1)


@cli.command()
@click.argument('action_id', type=int)
@click.option('--reason', help='原因')
@click.option('--operator', help='操作者名称')
def cancel(action_id, reason, operator):
    """取消行动项"""
    op = operator or get_operator()
    success = ActionItemService.cancel_action(action_id, op, reason)
    
    if success:
        console.print(f"[green]✓ 行动项 #{action_id} 已取消[/green]")
    else:
        console.print(f"[red]✗ 操作失败[/red]")
        sys.exit(1)


@cli.command()
@click.argument('action_id', type=int)
@click.option('--reason', help='原因')
@click.option('--operator', help='操作者名称')
def start(action_id, reason, operator):
    """标记行动项为进行中"""
    op = operator or get_operator()
    success = ActionItemService.mark_in_progress(action_id, op, reason)
    
    if success:
        console.print(f"[green]✓ 行动项 #{action_id} 已标记为进行中[/green]")
    else:
        console.print(f"[red]✗ 操作失败[/red]")
        sys.exit(1)


@cli.command()
@click.argument('action_id', type=int)
@click.option('--due', help='新截止日期 (YYYY-MM-DD)')
@click.option('--assignee', help='新负责人（多个用逗号分隔）')
@click.option('--depends', help='依赖的行动项 ID（多个用逗号分隔）')
@click.option('--reason', help='修改原因')
@click.option('--operator', help='操作者名称')
def update(action_id, due, assignee, depends, reason, operator):
    """修改行动项信息"""
    op = operator or get_operator()
    
    changes = []
    if due:
        changes.append(f"截止日期 -> {due}")
    if assignee:
        changes.append(f"负责人 -> {assignee}")
    if depends:
        changes.append(f"依赖 -> {depends}")
    
    if not changes:
        console.print("[yellow]! 未指定任何修改内容[/yellow]")
        console.print("  使用 --due, --assignee, --depends 指定修改项")
        sys.exit(0)
    
    console.print(f"[cyan]修改行动项 #{action_id}:[/cyan]")
    for c in changes:
        console.print(f"  - {c}")
    
    assignee_list = None
    if assignee:
        assignee_list = [a.strip() for a in assignee.replace('，', ',').split(',')]
    
    depends_list = None
    if depends:
        try:
            depends_list = [int(d.strip()) for d in depends.replace('，', ',').split(',')]
        except ValueError:
            console.print("[red]✗ 依赖 ID 必须是数字[/red]")
            sys.exit(1)
    
    due_date = None
    if due:
        try:
            due_date = datetime.strptime(due, '%Y-%m-%d').date()
        except ValueError:
            console.print("[red]✗ 日期格式错误，应为 YYYY-MM-DD[/red]")
            sys.exit(1)
    
    success, errors = ActionItemService.update_action(
        action_id=action_id,
        operator=op,
        due_date=due_date,
        assignees=assignee_list,
        dependencies=depends_list,
        reason=reason
    )
    
    if success:
        console.print(f"[green]✓ 行动项 #{action_id} 已更新[/green]")
        if errors:
            for w in errors:
                console.print(f"  [yellow]-[/yellow] [{w.code}] {w.message}")
    else:
        for e in errors:
            console.print(f"[red]✗ [{e.code}] {e.message}[/red]")
        sys.exit(1)


@cli.group()
def people():
    """管理参会人和角色"""
    pass


@people.command('add')
@click.argument('name')
@click.option('--email', help='邮箱')
@click.option('--role', help='角色')
@click.option('--operator', help='操作者名称')
def add_person(name, email, role, operator):
    """添加参会人"""
    op = operator or get_operator()
    success, p_id = ParticipantService.add_participant(name, email, op)
    
    if p_id:
        console.print(f"[green]✓ 添加参会人: {name} (ID: {p_id})[/green]")
    else:
        console.print(f"[yellow]! 参会人已存在: {name}[/yellow]")
    
    if role:
        ok, errors = ParticipantService.assign_role(name, role, op)
        if ok:
            console.print(f"[green]✓ 分配角色: {name} -> {role}[/green]")
        else:
            for e in errors:
                console.print(f"[red]✗ {e}[/red]")


@people.command('add-role')
@click.argument('name')
@click.option('--description', help='描述')
@click.option('--operator', help='操作者名称')
def add_role(name, description, operator):
    """添加角色"""
    op = operator or get_operator()
    success, r_id = ParticipantService.add_role(name, description, op)
    
    if r_id:
        console.print(f"[green]✓ 添加角色: {name} (ID: {r_id})[/green]")
    else:
        console.print(f"[yellow]! 角色已存在: {name}[/yellow]")


@people.command('list')
def list_people():
    """列出所有参会人"""
    participants = ParticipantRepository.get_all()
    roles = RoleRepository.get_all()
    
    console.print(f"[bold]参会人 ({len(participants)} 人):[/bold]")
    for p in participants:
        p_roles = ParticipantRoleRepository.get_participant_roles(p.id if p.id else 0)
        role_names = ", ".join(r.name for r in p_roles)
        console.print(f"  - {p.name} [{role_names or '-'}]")
    
    console.print(f"\n[bold]角色 ({len(roles)} 个):[/bold]")
    for r in roles:
        console.print(f"  - {r.name}: {r.description or '-'}")


@cli.command()
def audits():
    """查看审计日志（最近100条）"""
    logs = AuditLogRepository.get_all(100)
    
    if not logs:
        console.print("[yellow]无审计记录[/yellow]")
        return
    
    table = Table(title="📜 审计日志", box=box.SIMPLE)
    table.add_column("时间")
    table.add_column("操作者")
    table.add_column("操作")
    table.add_column("实体")
    table.add_column("原因")
    
    for log in logs:
        table.add_row(
            format_datetime(log.created_at),
            log.operator,
            log.operation_type.value,
            f"{log.entity_type}#{log.entity_id}",
            log.reason or "-"
        )
    
    console.print(table)


@cli.command()
@click.argument('file_path', type=click.Path(writable=True))
@click.option('--type', type=click.Choice(['product', 'dev', 'test'], case_sensitive=False),
              default='product', help='样例类型')
def generate(file_path, type):
    """生成样例会议纪要文件"""
    samples = {
        'product': """# 产品需求评审会议
会议时间: 2026-05-10
参会人: 张产品, 李研发, 王测试, 赵设计

## 会议内容
讨论了用户中心模块的改版需求，确认了以下行动项：

## 行动项

1. 张产品负责完成用户中心需求文档初稿，截止 2026-05-15
2. 李研发、赵设计负责设计用户中心页面原型，依赖需求文档
3. @王测试 准备测试用例模板，截止本周五
4. @张产品 同步业务方确认验收标准

## 讨论要点
- 用户中心需要支持多账号绑定
- 需要增加实名认证流程
""",
        'dev': """# 技术方案评审会议
会议时间: 2026-05-11
参会人: 李研发, 王架构, 陈运维, 张产品

## 会议内容
讨论了用户中心的技术实现方案

## 行动项

- @李研发 负责编写接口设计文档，截止 2026-05-12
- @王架构 负责数据库表结构设计，截止 2026-05-13
- 陈运维负责搭建测试环境，截止 2026-05-14
- 李研发、陈运维联调部署流程，依赖接口文档和表结构

## 技术决策
- 使用 MySQL 存储用户数据
- 采用 JWT 做用户认证
""",
        'test': """# 测试计划会议
会议时间: 2026-05-12
参会人: 王测试, 李研发, 张产品

## 会议内容
制定用户中心测试计划

## 行动项

1. @王测试 编写功能测试用例，截止 2026-05-16
2. 李研发提供测试数据，截止 2026-05-14
3. 王测试准备自动化测试脚本，截止 2026-05-18
4. @张产品 协助准备验收场景
"""
    }
    
    content = samples.get(type.lower(), samples['product'])
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    console.print(f"[green]✓ 样例文件已生成: {file_path}[/green]")
    console.print(f"  类型: {type}")
    console.print(f"\n导入命令: meeting-ai import {file_path}")


if __name__ == '__main__':
    cli()
