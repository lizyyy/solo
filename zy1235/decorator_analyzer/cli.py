"""Command-line interface for Decorator Analyzer."""

import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

from decorator_analyzer import __version__
from decorator_analyzer.analyzer import AnalysisConfig, DecoratorAnalyzer
from decorator_analyzer.exporter import JsonExporter, MarkdownExporter
from decorator_analyzer.models import RiskLevel
from decorator_analyzer.parser.jsonl_parser import JsonlParseError
from decorator_analyzer.parser.py_parser import PyParseError
from decorator_analyzer.parser.yaml_parser import YamlParseError
from decorator_analyzer.storage import SQLiteStorage

console = Console()
error_console = Console(stderr=True, style="bold red")


def get_project_dir(ctx: click.Context) -> Path:
    """Get the project directory from context or default to current directory."""
    return Path(ctx.obj.get("project_dir", "."))


def get_db_path(project_dir: Path) -> Path:
    """Get the SQLite database path."""
    return project_dir / ".decorator_analyzer" / "analysis.db"


def ensure_project_dir(project_dir: Path) -> None:
    """Ensure the project directory structure exists."""
    (project_dir / ".decorator_analyzer").mkdir(parents=True, exist_ok=True)
    (project_dir / "snippets").mkdir(exist_ok=True)


@click.group()
@click.version_option(__version__, "-v", "--version")
@click.option(
    "-p", "--project",
    type=click.Path(exists=False, file_okay=False, dir_okay=True),
    default=".",
    help="Project directory (default: current directory)",
)
@click.pass_context
def main(ctx: click.Context, project: str) -> None:
    """Decorator Analyzer - 分析 Python 装饰器调用链的工具。
    
    此工具帮助你理解装饰器如何修改函数调用链，检测潜在风险，并生成报告。
    """
    ctx.ensure_object(dict)
    ctx.obj["project_dir"] = Path(project).resolve()


@main.command()
@click.option(
    "--seed",
    is_flag=True,
    default=False,
    help="使用样例数据初始化项目",
)
@click.pass_context
def init(ctx: click.Context, seed: bool) -> None:
    """初始化一个新的装饰器分析项目。
    
    创建必要的目录结构和配置文件。
    """
    project_dir = get_project_dir(ctx)
    
    if project_dir.exists() and any(project_dir.iterdir()):
        if not click.confirm(f"目录 '{project_dir}' 已存在且非空，是否继续？"):
            error_console.print("操作已取消")
            sys.exit(1)
    
    ensure_project_dir(project_dir)
    
    yaml_path = project_dir / "decorators.yaml"
    jsonl_path = project_dir / "events.jsonl"
    snippets_dir = project_dir / "snippets"
    
    if seed:
        from decorator_analyzer.seed_data import generate_seed_data
        generate_seed_data(project_dir)
        console.print(Panel.fit(
            "[green]✓[/green] 项目已初始化，包含样例数据！\n"
            f"位置: {project_dir}\n"
            "\n"
            "下一步:\n"
            "  1. 查看 snippets/ 目录中的样例代码\n"
            "  2. 运行 'decorator-analyzer analyze' 进行分析\n"
            "  3. 运行 'decorator-analyzer export' 生成报告",
            title="初始化成功",
            border_style="green"
        ))
    else:
        if not yaml_path.exists():
            yaml_path.write_text("""# 装饰器定义配置文件
# 用于描述被装饰的函数及其装饰器
# 格式说明：
# functions:
#   - name: 函数名
#     module: 模块名
#     signature: 函数签名 (如: (a: int, b: str) -> bool)
#     docstring: 函数文档字符串
#     is_async: 是否为异步函数
#     is_method: 是否为类方法
#     decorators:
#       - name: 装饰器名
#         type: 装饰器类型 (simple/with_args/functools_wraps/class_decorator/descriptor/async)
#         line_number: 行号
#         has_wraps: 是否使用 functools.wraps
#         parameters: 装饰器参数
#         source_code: 装饰器源代码

functions: []
""", encoding="utf-8")
        
        if not jsonl_path.exists():
            jsonl_path.touch()
        
        snippets_dir.mkdir(exist_ok=True)
        
        console.print(Panel.fit(
            "[green]✓[/green] 项目已初始化！\n"
            f"位置: {project_dir}\n"
            "\n"
            "创建的文件:\n"
            "  - decorators.yaml: 装饰器定义配置\n"
            "  - events.jsonl: 调用事件日志\n"
            "  - snippets/: Python 代码片段目录\n"
            "\n"
            "使用 --seed 选项可以初始化带样例数据的项目。",
            title="初始化成功",
            border_style="green"
        ))


@main.command()
@click.option(
    "-d", "--description",
    type=str,
    default=None,
    help="此次分析的描述",
)
@click.option(
    "--strict",
    is_flag=True,
    default=False,
    help="严格模式：所有警告都视为高风险",
)
@click.option(
    "--no-sig-check",
    is_flag=True,
    default=False,
    help="跳过签名保真检查",
)
@click.option(
    "--no-meta-check",
    is_flag=True,
    default=False,
    help="跳过元数据保真检查",
)
@click.pass_context
def analyze(
    ctx: click.Context,
    description: Optional[str],
    strict: bool,
    no_sig_check: bool,
    no_meta_check: bool,
) -> None:
    """分析装饰器并检测潜在风险。
    
    读取 decorators.yaml、events.jsonl 和 snippets/*.py，
    分析装饰器调用链、检测风险，并将结果写入 SQLite 数据库。
    """
    project_dir = get_project_dir(ctx)
    yaml_path = project_dir / "decorators.yaml"
    jsonl_path = project_dir / "events.jsonl"
    snippets_dir = project_dir / "snippets"
    db_path = get_db_path(project_dir)
    
    if not yaml_path.exists() and not snippets_dir.exists():
        error_console.print(f"错误: 找不到 decorators.yaml 或 snippets/ 目录")
        error_console.print(f"请先运行 'decorator-analyzer init' 初始化项目")
        sys.exit(1)
    
    config = AnalysisConfig(
        strict_mode=strict,
        check_signature_fidelity=not no_sig_check,
        check_metadata_fidelity=not no_meta_check,
    )
    
    analyzer = DecoratorAnalyzer(config)
    
    try:
        with console.status("[bold cyan]正在分析..."):
            result = analyzer.analyze_from_files(
                yaml_path=yaml_path,
                jsonl_path=jsonl_path if jsonl_path.exists() else None,
                snippets_dir=snippets_dir if snippets_dir.exists() else None,
                description=description,
            )
        
        ensure_project_dir(project_dir)
        storage = SQLiteStorage(db_path)
        session_id = storage.save_analysis(result, description)
        
        table = Table(title="分析结果摘要", show_header=True, header_style="bold magenta")
        table.add_column("指标", style="cyan")
        table.add_column("数值", justify="right")
        table.add_row("被装饰函数", str(len(result.decorated_functions)))
        table.add_row("调用事件", str(len(result.call_events)))
        table.add_row("风险总数", str(len(result.risks)))
        
        if result.risks:
            risk_table = Table(title="风险分布", show_header=True, header_style="bold magenta")
            risk_table.add_column("风险等级", style="cyan")
            risk_table.add_column("数量", justify="right")
            
            for level in [RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
                count = sum(1 for r in result.risks if r.level == level)
                if count > 0:
                    style = {
                        RiskLevel.CRITICAL: "bold red",
                        RiskLevel.HIGH: "bold orange",
                        RiskLevel.MEDIUM: "bold yellow",
                        RiskLevel.LOW: "bold green",
                    }.get(level, "")
                    risk_table.add_row(level.value.upper(), str(count), style=style)
            
            console.print(risk_table)
        
        console.print(table)
        console.print(f"\n[green]✓[/green] 分析完成，会话 ID: [bold]{session_id}[/bold]")
        console.print(f"[dim]数据已保存到: {db_path}[/dim]")
        
        if result.risks:
            critical_count = sum(1 for r in result.risks if r.level in [RiskLevel.CRITICAL, RiskLevel.HIGH])
            if critical_count > 0:
                console.print(f"\n[bold red]⚠ 发现 {critical_count} 个高风险问题！[/bold red]")
                console.print("建议运行 'decorator-analyzer export --format markdown' 查看详细报告")
    
    except (YamlParseError, JsonlParseError, PyParseError) as e:
        error_console.print(f"解析错误: {e}")
        sys.exit(1)
    except Exception as e:
        error_console.print(f"分析错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@main.command(name="list")
@click.option(
    "-n", "--limit",
    type=int,
    default=10,
    help="显示的会话数量 (默认: 10)",
)
@click.pass_context
def list_sessions(ctx: click.Context, limit: int) -> None:
    """列出历史分析会话。"""
    project_dir = get_project_dir(ctx)
    db_path = get_db_path(project_dir)
    
    if not db_path.exists():
        error_console.print("错误: 找不到分析数据库")
        error_console.print("请先运行 'decorator-analyzer analyze' 进行分析")
        sys.exit(1)
    
    storage = SQLiteStorage(db_path)
    sessions = storage.list_sessions(limit)
    
    if not sessions:
        console.print("没有找到历史分析会话")
        return
    
    table = Table(title="历史分析会话", show_header=True, header_style="bold magenta")
    table.add_column("#", style="cyan")
    table.add_column("会话 ID", style="bold")
    table.add_column("时间", style="dim")
    table.add_column("描述")
    table.add_column("函数", justify="right")
    table.add_column("风险", justify="right")
    
    for idx, session in enumerate(sessions, 1):
        desc = session.description or "-"
        if len(desc) > 30:
            desc = desc[:27] + "..."
        
        table.add_row(
            str(idx),
            session.id[:12] + "...",
            session.timestamp.strftime("%Y-%m-%d %H:%M"),
            desc,
            str(session.func_count),
            str(session.risk_count),
        )
    
    console.print(table)


@main.command()
@click.argument("session_ids", nargs=-1, required=True)
@click.option(
    "-l", "--label",
    multiple=True,
    help="每个会话的标签（用于对比报告）",
)
@click.option(
    "-f", "--format",
    type=click.Choice(["markdown", "json"]),
    default="markdown",
    help="输出格式 (默认: markdown)",
)
@click.option(
    "-o", "--output",
    type=click.Path(writable=True, dir_okay=False),
    default=None,
    help="输出文件路径 (默认: 生成到项目目录)",
)
@click.pass_context
def compare(
    ctx: click.Context,
    session_ids: tuple[str, ...],
    label: tuple[str, ...],
    format: str,
    output: Optional[str],
) -> None:
    """对比多个分析会话的结果。
    
    至少需要提供两个会话 ID。
    """
    if len(session_ids) < 2:
        error_console.print("错误: 对比功能至少需要两个会话 ID")
        sys.exit(1)
    
    project_dir = get_project_dir(ctx)
    db_path = get_db_path(project_dir)
    
    if not db_path.exists():
        error_console.print("错误: 找不到分析数据库")
        sys.exit(1)
    
    storage = SQLiteStorage(db_path)
    
    results = []
    labels = list(label) if label else [f"会话 {i+1}" for i in range(len(session_ids))]
    
    for sid in session_ids:
        result = storage.load_analysis(sid)
        if result is None:
            error_console.print(f"错误: 找不到会话 ID: {sid}")
            sys.exit(1)
        results.append(result)
    
    if output:
        output_path = Path(output)
    else:
        timestamp = results[0].timestamp.strftime("%Y%m%d_%H%M%S")
        ext = "md" if format == "markdown" else "json"
        output_path = project_dir / f"comparison_{timestamp}.{ext}"
    
    try:
        with console.status(f"[bold cyan]正在生成 {format} 对比报告..."):
            if format == "markdown":
                exporter = MarkdownExporter()
                exporter.export_compare(results, output_path, labels)
            else:
                exporter = JsonExporter()
                exporter.export_compare(results, output_path, labels)
        
        console.print(f"[green]✓[/green] 对比报告已生成: [bold]{output_path}[/bold]")
    
    except Exception as e:
        error_console.print(f"导出错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@main.command()
@click.option(
    "-s", "--session",
    type=str,
    default=None,
    help="要导出的会话 ID (默认: 最新会话)",
)
@click.option(
    "-f", "--format",
    type=click.Choice(["markdown", "json"]),
    default="markdown",
    help="输出格式 (默认: markdown)",
)
@click.option(
    "-o", "--output",
    type=click.Path(writable=True, dir_okay=False),
    default=None,
    help="输出文件路径 (默认: 生成到项目目录)",
)
@click.pass_context
def export(
    ctx: click.Context,
    session: Optional[str],
    format: str,
    output: Optional[str],
) -> None:
    """导出分析报告。
    
    支持 Markdown 和 JSON 格式。
    """
    project_dir = get_project_dir(ctx)
    db_path = get_db_path(project_dir)
    
    if not db_path.exists():
        error_console.print("错误: 找不到分析数据库")
        error_console.print("请先运行 'decorator-analyzer analyze' 进行分析")
        sys.exit(1)
    
    storage = SQLiteStorage(db_path)
    
    if session:
        result = storage.load_analysis(session)
        if result is None:
            error_console.print(f"错误: 找不到会话 ID: {session}")
            sys.exit(1)
    else:
        sessions = storage.list_sessions(1)
        if not sessions:
            error_console.print("错误: 没有找到历史分析会话")
            sys.exit(1)
        result = storage.load_analysis(sessions[0].id)
        if result is None:
            error_console.print("错误: 无法加载最新会话")
            sys.exit(1)
    
    if output:
        output_path = Path(output)
    else:
        timestamp = result.timestamp.strftime("%Y%m%d_%H%M%S")
        ext = "md" if format == "markdown" else "json"
        output_path = project_dir / f"analysis_{timestamp}.{ext}"
    
    try:
        with console.status(f"[bold cyan]正在生成 {format} 报告..."):
            if format == "markdown":
                exporter = MarkdownExporter()
                exporter.export(result, output_path)
            else:
                exporter = JsonExporter()
                exporter.export(result, output_path)
        
        console.print(f"[green]✓[/green] 报告已生成: [bold]{output_path}[/bold]")
        
        if result.risks:
            critical_count = sum(1 for r in result.risks if r.level in [RiskLevel.CRITICAL, RiskLevel.HIGH])
            if critical_count > 0:
                console.print(f"\n[bold red]⚠ 报告中包含 {critical_count} 个高风险问题[/bold red]")
    
    except Exception as e:
        error_console.print(f"导出错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@main.command()
@click.pass_context
def info(ctx: click.Context) -> None:
    """显示项目信息和配置。"""
    project_dir = get_project_dir(ctx)
    db_path = get_db_path(project_dir)
    yaml_path = project_dir / "decorators.yaml"
    jsonl_path = project_dir / "events.jsonl"
    snippets_dir = project_dir / "snippets"
    
    tree = Tree(f"[bold]{project_dir}[/bold]")
    
    yaml_node = tree.add("decorators.yaml")
    if yaml_path.exists():
        yaml_node.add(f"[green]✓ 存在[/green]")
    else:
        yaml_node.add(f"[red]✗ 不存在[/red]")
    
    jsonl_node = tree.add("events.jsonl")
    if jsonl_path.exists():
        line_count = sum(1 for _ in open(jsonl_path, "r"))
        jsonl_node.add(f"[green]✓ 存在[/green] ({line_count} 行)")
    else:
        jsonl_node.add(f"[yellow]~ 可选[/yellow]")
    
    snippets_node = tree.add("snippets/")
    if snippets_dir.exists():
        py_files = list(snippets_dir.glob("*.py"))
        snippets_node.add(f"[green]✓ 存在[/green] ({len(py_files)} 个 .py 文件)")
    else:
        snippets_node.add(f"[yellow]~ 可选[/yellow]")
    
    db_node = tree.add(".decorator_analyzer/")
    if db_path.exists():
        db_node.add(f"[green]✓ analysis.db 存在[/green]")
    else:
        db_node.add(f"[dim]尚未初始化[/dim]")
    
    console.print(Panel(tree, title="项目结构", border_style="cyan"))
    
    console.print(f"\n工具版本: [bold]{__version__}[/bold]")
    console.print(f"Python 版本: [bold]{sys.version.split()[0]}[/bold]")


if __name__ == "__main__":
    main()
