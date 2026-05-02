import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .config import MachineConfig, MachineLimits
from .parser import (
    FixtureJSONParser,
    GCodeParser,
    ToolCSVParser,
    WorkpieceParser,
)
from .reporter import Reporter
from .rules import RuleEngine, Severity, ViolationSummary
from .session import (
    ReviewDecision,
    ReviewItem,
    Session,
    SessionStatus,
    SessionStore,
)
from .simulator import MotionSimulator, SimulationState

console = Console()


def get_session_store() -> SessionStore:
    return SessionStore()


def get_current_session_or_exit() -> Session:
    store = get_session_store()
    if not store.is_initialized():
        console.print(Panel(
            "[bold red]错误: 项目未初始化[/bold red]\n"
            "请先运行 'gcode-guardian init' 命令初始化项目",
            title="错误",
            style="red"
        ))
        sys.exit(1)

    session = store.get_current_session()
    if not session:
        console.print(Panel(
            "[bold red]错误: 没有活动的会话[/bold red]\n"
            "请先运行 'gcode-guardian import' 命令导入数据创建会话",
            title="错误",
            style="red"
        ))
        sys.exit(1)

    return session


def print_violation_summary(summary: ViolationSummary):
    table = Table(title="违规统计")
    table.add_column("级别", style="cyan")
    table.add_column("数量", justify="right", style="magenta")

    table.add_row(
        "[bold red]CRITICAL (严重)[/bold red]",
        f"[bold red]{summary.critical_count}[/bold red]"
    )
    table.add_row(
        "[bold orange_red1]ERROR (错误)[/bold orange_red1]",
        f"[bold orange_red1]{summary.error_count}[/bold orange_red1]"
    )
    table.add_row(
        "[bold yellow]WARNING (警告)[/bold yellow]",
        f"[bold yellow]{summary.warning_count}[/bold yellow]"
    )
    table.add_row(
        "[bold blue]INFO (信息)[/bold blue]",
        f"[bold blue]{summary.info_count}[/bold blue]"
    )
    table.add_row(
        "[bold]总计[/bold]",
        f"[bold]{summary.total_count}[/bold]"
    )

    console.print(table)


def print_violations(violations, show_details: bool = False):
    if not violations:
        console.print("[green]✓ 没有发现违规问题[/green]")
        return

    for i, v in enumerate(violations, 1):
        severity_style = {
            Severity.CRITICAL: "bold red",
            Severity.ERROR: "bold orange_red1",
            Severity.WARNING: "bold yellow",
            Severity.INFO: "bold blue",
        }.get(v.severity, "white")

        console.print(f"\n[{severity_style}]#{i} {v.severity.value.upper()}: {v.message}[/{severity_style}]")

        if show_details:
            if v.line_number:
                console.print(f"  行号: {v.line_number}")
            if v.raw_code:
                console.print(f"  代码: {v.raw_code}")
            if v.position:
                console.print(f"  位置: ({v.position[0]:.3f}, {v.position[1]:.3f}, {v.position[2]:.3f})")
            if v.details:
                console.print(f"  详情: {v.details}")


@click.group()
@click.version_option()
def main():
    """刀路干运行守门员 - G-code干运行检查工具

    用于在数控加工前检查G-code程序的潜在问题，包括：
    - 行程越界检查
    - 进给/主轴转速异常检查
    - 刀具缺失检查
    - 安全高度检查
    - 夹具碰撞检测
    """
    pass


@main.command()
@click.option("--name", "-n", default="Default CNC Mill", help="机床名称")
@click.option("--x-min", type=float, default=-500.0, help="X轴最小行程")
@click.option("--x-max", type=float, default=500.0, help="X轴最大行程")
@click.option("--y-min", type=float, default=-500.0, help="Y轴最小行程")
@click.option("--y-max", type=float, default=500.0, help="Y轴最大行程")
@click.option("--z-min", type=float, default=-100.0, help="Z轴最小行程")
@click.option("--z-max", type=float, default=200.0, help="Z轴最大行程")
@click.option("--max-feed", type=float, default=5000.0, help="最大进给速度 (mm/min)")
@click.option("--max-speed", type=float, default=10000.0, help="最大主轴转速 (RPM)")
@click.option("--safe-height", type=float, default=50.0, help="安全高度 (mm)")
@click.option("--tool-change-height", type=float, default=100.0, help="换刀高度 (mm)")
@click.option("--force", "-f", is_flag=True, help="强制重新初始化")
def init(
    name: str,
    x_min: float,
    x_max: float,
    y_min: float,
    y_max: float,
    z_min: float,
    z_max: float,
    max_feed: float,
    max_speed: float,
    safe_height: float,
    tool_change_height: float,
    force: bool,
):
    """初始化项目，创建机床配置"""

    store = get_session_store()

    if store.is_initialized() and not force:
        console.print(Panel(
            "[yellow]项目已初始化[/yellow]\n"
            "使用 --force 选项强制重新初始化",
            title="提示",
            style="yellow"
        ))
        sys.exit(0)

    limits = MachineLimits(
        x_min=x_min,
        x_max=x_max,
        y_min=y_min,
        y_max=y_max,
        z_min=z_min,
        z_max=z_max,
    )

    config = MachineConfig(
        name=name,
        description=f"机床配置: {name}",
        limits=limits,
        max_feed_rate=max_feed,
        max_spindle_speed=max_speed,
        safe_height=safe_height,
        tool_change_height=tool_change_height,
    )

    store.initialize(config)

    console.print(Panel(
        f"[bold green]项目初始化成功[/bold green]\n\n"
        f"机床: {name}\n"
        f"行程: X({x_min}~{x_max}), Y({y_min}~{y_max}), Z({z_min}~{z_max})\n"
        f"最大进给: {max_feed} mm/min\n"
        f"最大转速: {max_speed} RPM\n"
        f"安全高度: {safe_height} mm\n"
        f"换刀高度: {tool_change_height} mm",
        title="初始化成功",
        style="green"
    ))


@main.command()
@click.option("--gcode", "-g", type=click.Path(exists=True, dir_okay=False), required=True, help="G-code文件路径")
@click.option("--tools", "-t", type=click.Path(exists=True, dir_okay=False), help="刀具表CSV文件路径")
@click.option("--fixtures", "-f", type=click.Path(exists=True, dir_okay=False), help="夹具配置JSON文件路径")
@click.option("--workpiece", "-w", type=click.Path(exists=True, dir_okay=False), help="毛坯尺寸文件路径")
@click.option("--name", "-n", help="会话名称")
@click.option("--description", "-d", help="会话描述")
def import_(
    gcode: str,
    tools: Optional[str],
    fixtures: Optional[str],
    workpiece: Optional[str],
    name: Optional[str],
    description: Optional[str],
):
    """导入G-code、刀具表、夹具配置和毛坯尺寸"""

    store = get_session_store()
    if not store.is_initialized():
        console.print(Panel(
            "[bold red]错误: 项目未初始化[/bold red]\n"
            "请先运行 'gcode-guardian init' 命令",
            title="错误",
            style="red"
        ))
        sys.exit(1)

    gcode_path = Path(gcode)
    session_name = name or f"Import_{gcode_path.stem}"

    session = store.create_session(name=session_name, description=description or "")
    session.metadata.gcode_filename = gcode_path.name

    console.print(f"[cyan]正在解析G-code文件: {gcode_path}[/cyan]")
    gcode_parser = GCodeParser()
    gcode_blocks = gcode_parser.parse_file(gcode_path)
    console.print(f"[green]  解析完成: {len(gcode_blocks)} 个代码块[/green]")

    if tools:
        tools_path = Path(tools)
        session.metadata.tools_filename = tools_path.name
        console.print(f"[cyan]正在解析刀具表: {tools_path}[/cyan]")
        tool_parser = ToolCSVParser()
        session.tools = tool_parser.parse(tools_path)
        console.print(f"[green]  解析完成: {len(session.tools)} 把刀具[/green]")

    if fixtures:
        fixtures_path = Path(fixtures)
        session.metadata.fixtures_filename = fixtures_path.name
        console.print(f"[cyan]正在解析夹具配置: {fixtures_path}[/cyan]")
        fixture_parser = FixtureJSONParser()
        session.fixtures = fixture_parser.parse(fixtures_path)
        console.print(f"[green]  解析完成: {len(session.fixtures)} 个夹具[/green]")

    if workpiece:
        workpiece_path = Path(workpiece)
        session.metadata.workpiece_filename = workpiece_path.name
        console.print(f"[cyan]正在解析毛坯尺寸: {workpiece_path}[/cyan]")
        wp_parser = WorkpieceParser()
        session.workpiece = wp_parser.parse(workpiece_path)
        console.print(f"[green]  解析完成[/green]")

    session.metadata.status = SessionStatus.IMPORTED
    store.save_session(session)

    console.print(Panel(
        f"[bold green]导入成功[/bold green]\n\n"
        f"会话ID: {session.metadata.id}\n"
        f"会话名称: {session.metadata.name}\n"
        f"G-code: {session.metadata.gcode_filename} ({len(gcode_blocks)} 块)\n"
        f"刀具: {len(session.tools)} 把\n"
        f"夹具: {len(session.fixtures)} 个\n"
        f"毛坯: {'已设置' if session.workpiece else '未设置'}",
        title="导入成功",
        style="green"
    ))


@main.command()
@click.option("--session", "-s", help="指定会话ID (默认使用当前会话)")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
@click.option("--show-violations", is_flag=True, help="显示所有违规详情")
def simulate(session: Optional[str], verbose: bool, show_violations: bool):
    """模拟G-code运动轨迹并执行规则检查"""

    store = get_session_store()

    if session:
        sess = store.load_session(session)
        if not sess:
            console.print(Panel(
                f"[bold red]错误: 会话 '{session}' 不存在[/bold red]",
                title="错误",
                style="red"
            ))
            sys.exit(1)
    else:
        sess = get_current_session_or_exit()

    if sess.metadata.status == SessionStatus.CREATED:
        console.print(Panel(
            "[bold red]错误: 会话未导入数据[/bold red]\n"
            "请先运行 'gcode-guardian import' 命令",
            title="错误",
            style="red"
        ))
        sys.exit(1)

    gcode_path = Path.cwd() / sess.metadata.gcode_filename
    if not gcode_path.exists():
        possible_paths = [
            Path.cwd() / sess.metadata.gcode_filename,
            Path.cwd().parent / sess.metadata.gcode_filename,
        ]
        found = False
        for p in possible_paths:
            if p.exists():
                gcode_path = p
                found = True
                break
        if not found:
            console.print(Panel(
                f"[bold red]错误: 找不到G-code文件 '{sess.metadata.gcode_filename}'[/bold red]",
                title="错误",
                style="red"
            ))
            sys.exit(1)

    console.print("[cyan]正在解析G-code...[/cyan]")
    gcode_parser = GCodeParser()
    gcode_blocks = gcode_parser.parse_file(gcode_path)
    console.print(f"[green]  解析完成: {len(gcode_blocks)} 个代码块[/green]")

    console.print("[cyan]正在进行运动模拟...[/cyan]")
    simulator = MotionSimulator(sess.machine_config)
    motion_segments = simulator.simulate_blocks(gcode_blocks)
    sim_state = simulator.get_state()
    console.print(f"[green]  模拟完成: {len(motion_segments)} 个运动段[/green]")

    sess.statistics.total_blocks = len(gcode_blocks)
    sess.statistics.motion_blocks = sim_state.motion_count
    sess.statistics.tool_changes = len(sim_state.tool_changes)
    sess.statistics.rapid_motions = sum(1 for s in motion_segments if s.is_rapid)
    sess.statistics.cutting_motions = sum(1 for s in motion_segments if not s.is_rapid)
    sess.statistics.tools_used = sorted(set(sim_state.tool_changes))

    if motion_segments:
        all_positions = []
        for seg in motion_segments:
            all_positions.append(seg.start)
            all_positions.append(seg.end)

        sess.statistics.min_x = min(p.x for p in all_positions)
        sess.statistics.max_x = max(p.x for p in all_positions)
        sess.statistics.min_y = min(p.y for p in all_positions)
        sess.statistics.max_y = max(p.y for p in all_positions)
        sess.statistics.min_z = min(p.z for p in all_positions)
        sess.statistics.max_z = max(p.z for p in all_positions)

    console.print("[cyan]正在执行规则检查...[/cyan]")
    rule_engine = RuleEngine(
        machine_config=sess.machine_config,
        tools=sess.tools,
        fixtures=sess.fixtures,
        workpiece=sess.workpiece,
    )
    sess.violations = rule_engine.check_all(gcode_blocks, motion_segments, sim_state)
    summary = ViolationSummary(sess.violations)
    console.print(f"[green]  检查完成: {summary.total_count} 个违规[/green]")

    sess.metadata.status = SessionStatus.SIMULATED
    store.save_session(sess)

    print("\n")
    print_violation_summary(summary)

    if show_violations or verbose:
        print_violations(sess.violations, show_details=verbose)

    if summary.has_blocking_issues:
        console.print(Panel(
            "[bold red]存在严重问题，不建议直接执行[/bold red]\n"
            "请使用 'gcode-guardian review' 进行人工审核",
            title="警告",
            style="red"
        ))
    else:
        if summary.warning_count > 0:
            console.print(Panel(
                "[bold yellow]检查通过，但存在警告[/bold yellow]\n"
                "建议使用 'gcode-guardian review' 进行人工审核",
                title="注意",
                style="yellow"
            ))
        else:
            console.print(Panel(
                "[bold green]所有检查通过[/bold green]\n"
                "可以使用 'gcode-guardian report' 导出验收报告",
                title="通过",
                style="green"
            ))


@main.command()
@click.option("--session", "-s", help="指定会话ID (默认使用当前会话)")
@click.option("--list", "-l", "list_violations", is_flag=True, help="列出所有违规")
@click.option("--approve", "-a", type=int, multiple=True, help="批准指定违规 (序号)")
@click.option("--reject", "-r", type=int, multiple=True, help="拒绝指定违规 (序号)")
@click.option("--waive", "-w", type=int, multiple=True, help="豁免指定违规 (序号)")
@click.option("--reason", help="审核原因")
@click.option("--reviewer", help="审核人")
@click.option("--all-approve", is_flag=True, help="批准所有违规")
@click.option("--all-reject", is_flag=True, help="拒绝所有违规")
def review(
    session: Optional[str],
    list_violations: bool,
    approve: tuple,
    reject: tuple,
    waive: tuple,
    reason: Optional[str],
    reviewer: Optional[str],
    all_approve: bool,
    all_reject: bool,
):
    """人工审核并保存放行意见"""

    store = get_session_store()

    if session:
        sess = store.load_session(session)
        if not sess:
            console.print(Panel(
                f"[bold red]错误: 会话 '{session}' 不存在[/bold red]",
                title="错误",
                style="red"
            ))
            sys.exit(1)
    else:
        sess = get_current_session_or_exit()

    if sess.metadata.status == SessionStatus.CREATED:
        console.print(Panel(
            "[bold red]错误: 会话未导入数据[/bold red]",
            title="错误",
            style="red"
        ))
        sys.exit(1)

    if sess.metadata.status == SessionStatus.IMPORTED:
        console.print(Panel(
            "[bold red]错误: 请先运行 'gcode-guardian simulate' 进行模拟检查[/bold red]",
            title="错误",
            style="red"
        ))
        sys.exit(1)

    if list_violations or (not approve and not reject and not waive and not all_approve and not all_reject):
        if not sess.violations:
            console.print(Panel(
                "[green]该会话没有违规问题[/green]\n"
                "可以直接导出报告",
                title="审核状态",
                style="green"
            ))
        else:
            table = Table(title="违规列表")
            table.add_column("序号", style="cyan")
            table.add_column("级别", style="magenta")
            table.add_column("类别", style="yellow")
            table.add_column("消息", style="white")
            table.add_column("审核状态", style="green")

            for i, v in enumerate(sess.violations):
                review_item = None
                for r in sess.reviews:
                    if r.violation_index == i:
                        review_item = r
                        break

                status = "[dim]未审核[/dim]"
                if review_item:
                    status_text = {
                        ReviewDecision.APPROVE: "[green]✓ 批准[/green]",
                        ReviewDecision.REJECT: "[red]✗ 拒绝[/red]",
                        ReviewDecision.WAIVED: "[yellow]◇ 豁免[/yellow]",
                    }.get(review_item.decision, review_item.decision.value)
                    status = status_text

                table.add_row(
                    str(i + 1),
                    v.severity.value,
                    v.category.value,
                    v.message,
                    status,
                )

            console.print(table)
        return

    if not sess.violations:
        console.print(Panel(
            "[green]没有违规需要审核[/green]",
            title="提示",
            style="green"
        ))
        return

    def add_review(indices, decision):
        for idx in indices:
            if idx < 1 or idx > len(sess.violations):
                console.print(f"[yellow]警告: 违规序号 {idx} 超出范围[/yellow]")
                continue

            existing = None
            for r in sess.reviews:
                if r.violation_index == idx - 1:
                    existing = r
                    break

            if existing:
                existing.decision = decision
                if reason:
                    existing.reason = reason
                if reviewer:
                    existing.reviewer = reviewer
            else:
                sess.reviews.append(
                    ReviewItem(
                        violation_index=idx - 1,
                        decision=decision,
                        reason=reason or "",
                        reviewer=reviewer or "",
                    )
                )

    if all_approve:
        add_review(range(1, len(sess.violations) + 1), ReviewDecision.APPROVE)
        console.print(f"[green]已批准所有 {len(sess.violations)} 个违规[/green]")

    if all_reject:
        add_review(range(1, len(sess.violations) + 1), ReviewDecision.REJECT)
        console.print(f"[red]已拒绝所有 {len(sess.violations)} 个违规[/red]")

    if approve:
        add_review(approve, ReviewDecision.APPROVE)
        console.print(f"[green]已批准 {len(approve)} 个违规[/green]")

    if reject:
        add_review(reject, ReviewDecision.REJECT)
        console.print(f"[red]已拒绝 {len(reject)} 个违规[/red]")

    if waive:
        add_review(waive, ReviewDecision.WAIVED)
        console.print(f"[yellow]已豁免 {len(waive)} 个违规[/yellow]")

    sess.metadata.status = SessionStatus.REVIEWED
    store.save_session(sess)

    console.print(Panel(
        "[bold green]审核意见已保存[/bold green]\n"
        f"已审核: {len(sess.reviews)} / {len(sess.violations)}\n"
        "可以运行 'gcode-guardian report' 导出验收报告",
        title="审核完成",
        style="green"
    ))


@main.command()
@click.option("--session", "-s", help="指定会话ID (默认使用当前会话)")
@click.option("--output-dir", "-o", type=click.Path(), default="./reports", help="输出目录")
@click.option("--prefix", "-p", default="gcode-check", help="文件名前缀")
@click.option("--markdown", "-m", is_flag=True, help="仅导出Markdown")
@click.option("--csv", "-c", is_flag=True, help="仅导出CSV")
@click.option("--json", "-j", is_flag=True, help="仅导出JSON")
def report(
    session: Optional[str],
    output_dir: str,
    prefix: str,
    markdown: bool,
    csv: bool,
    json: bool,
):
    """导出Markdown、CSV和JSON验收包"""

    store = get_session_store()

    if session:
        sess = store.load_session(session)
        if not sess:
            console.print(Panel(
                f"[bold red]错误: 会话 '{session}' 不存在[/bold red]",
                title="错误",
                style="red"
            ))
            sys.exit(1)
    else:
        sess = get_current_session_or_exit()

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    reporter = Reporter(sess)

    export_all = not (markdown or csv or json)
    exported = {}

    if export_all or markdown:
        md_path = output_path / f"{prefix}_{sess.metadata.id}.md"
        reporter.generate_markdown_report(md_path)
        exported["markdown"] = md_path
        console.print(f"[green]✓ Markdown报告已导出: {md_path}[/green]")

    if export_all or csv:
        csv_path = output_path / f"{prefix}_{sess.metadata.id}.csv"
        reporter.generate_csv_report(csv_path)
        exported["csv"] = csv_path
        console.print(f"[green]✓ CSV报告已导出: {csv_path}[/green]")

    if export_all or json:
        json_path = output_path / f"{prefix}_{sess.metadata.id}.json"
        reporter.generate_json_report(json_path)
        exported["json"] = json_path
        console.print(f"[green]✓ JSON报告已导出: {json_path}[/green]")

    sess.metadata.status = SessionStatus.EXPORTED
    store.save_session(sess)

    summary = ViolationSummary(sess.violations)

    console.print(Panel(
        f"[bold green]报告导出完成[/bold green]\n\n"
        f"会话: {sess.metadata.name} ({sess.metadata.id})\n"
        f"输出目录: {output_path.absolute()}\n\n"
        f"检查结果:\n"
        f"  严重问题: {summary.critical_count}\n"
        f"  错误: {summary.error_count}\n"
        f"  警告: {summary.warning_count}\n"
        f"  信息: {summary.info_count}\n\n"
        f"审核状态: {len(sess.reviews)} / {len(sess.violations)} 已审核",
        title="导出完成",
        style="green"
    ))


@main.command("list")
@click.option("--all", "-a", is_flag=True, help="显示所有历史会话")
def list_sessions(all: bool):
    """列出会话"""

    store = get_session_store()
    if not store.is_initialized():
        console.print(Panel(
            "[bold red]错误: 项目未初始化[/bold red]",
            title="错误",
            style="red"
        ))
        sys.exit(1)

    sessions = store.list_sessions()

    if not sessions:
        console.print("[yellow]没有找到会话[/yellow]")
        return

    current = store.get_current_session()
    current_id = current.metadata.id if current else None

    table = Table(title="会话列表")
    table.add_column("当前", style="cyan")
    table.add_column("ID", style="magenta")
    table.add_column("名称", style="yellow")
    table.add_column("状态", style="green")
    table.add_column("创建时间", style="white")

    for s in sessions:
        is_current = "✓" if s["id"] == current_id else ""
        table.add_row(
            is_current,
            s["id"],
            s["name"],
            s["status"],
            s["created_at"][:19] if s["created_at"] else "",
        )

    console.print(table)


if __name__ == "__main__":
    main()
