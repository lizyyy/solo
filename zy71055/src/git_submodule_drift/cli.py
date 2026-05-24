import sys
from pathlib import Path
from typing import Optional
import click
from rich.console import Console
from . import __version__
from .drift_detector import DriftDetector
from .reporter import Reporter
from .models import RiskLevel


console = Console()
EXIT_OK = 0
EXIT_ERROR = 1
EXIT_DRIFT = 2
EXIT_WARNING = 3


def validate_repo_path(ctx, param, value):
    if value is None:
        value = Path.cwd()
    path = Path(value).resolve()
    if not path.exists():
        raise click.BadParameter(f"路径不存在: {path}")
    return path


def validate_lock_file(ctx, param, value):
    if value is None:
        return None
    path = Path(value).resolve()
    if not path.exists():
        raise click.BadParameter(f"锁定文件不存在: {path}")
    if not path.is_file():
        raise click.BadParameter(f"不是文件: {path}")
    return path


def validate_output_dir(ctx, param, value):
    if value is None:
        return Path.cwd()
    path = Path(value).resolve()
    try:
        path.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise click.BadParameter(f"无法创建输出目录: {e}")
    return path


@click.group(invoke_without_command=True)
@click.version_option(__version__, "-v", "--version", prog_name="git-submodule-drift")
@click.pass_context
def main(ctx):
    """Git 子模块漂移检测 CLI 工具

    检测 Git 子模块的版本漂移、游离头状态和嵌套子模块问题。
    """
    if ctx.invoked_subcommand is None:
        click.echo(ctx.get_help())


@main.command()
@click.argument(
    "repo_path",
    type=click.Path(),
    callback=validate_repo_path,
    default=lambda: Path.cwd(),
    required=False,
)
@click.option(
    "-l", "--lock-file",
    type=click.Path(),
    callback=validate_lock_file,
    help="子模块锁定清单文件路径",
)
@click.option(
    "-o", "--output-dir",
    type=click.Path(),
    callback=validate_output_dir,
    help="报告输出目录",
)
@click.option(
    "-r", "--recursive/--no-recursive",
    default=True,
    help="递归检测嵌套子模块",
)
@click.option(
    "-v", "--verbose",
    is_flag=True,
    help="显示详细信息",
)
@click.option(
    "--json/--no-json",
    default=False,
    help="导出 JSON 格式报告",
)
@click.option(
    "--markdown/--no-markdown",
    default=False,
    help="导出 Markdown 格式报告",
)
@click.option(
    "--all-formats",
    is_flag=True,
    help="导出所有格式的报告",
)
@click.option(
    "--tree",
    is_flag=True,
    help="以树形结构显示子模块",
)
@click.option(
    "--fail-on",
    type=click.Choice(["critical", "high", "medium", "low", "any"]),
    help="指定风险级别阈值，超过则非零退出",
)
@click.option(
    "--strict",
    is_flag=True,
    help="严格模式，任何漂移或警告都返回非零退出码",
)
def scan(
    repo_path: Path,
    lock_file: Optional[Path],
    output_dir: Path,
    recursive: bool,
    verbose: bool,
    json: bool,
    markdown: bool,
    all_formats: bool,
    tree: bool,
    fail_on: Optional[str],
    strict: bool,
):
    """扫描 Git 仓库检测子模块漂移"""
    try:
        with console.status("[bold blue]正在扫描子模块..."):
            detector = DriftDetector(repo_path, lock_file)
            report = detector.detect(recursive=recursive)

        if report.errors:
            for error in report.errors:
                console.print(f"[red]错误: {error}[/red]")
            sys.exit(EXIT_ERROR)

        reporter = Reporter(report, output_dir)
        reporter.print_console_summary(verbose=verbose)

        if tree:
            reporter.print_tree_view()

        exported = {}
        if all_formats or json:
            json_path = reporter.export_json()
            exported["json"] = json_path
            console.print(f"\n[dim]JSON 报告已导出: {json_path}[/dim]")

        if all_formats or markdown:
            md_path = reporter.export_markdown()
            exported["markdown"] = md_path
            console.print(f"[dim]Markdown 报告已导出: {md_path}[/dim]")

        exit_code = _calculate_exit_code(report, fail_on, strict)
        sys.exit(exit_code)

    except Exception as e:
        console.print(f"[red]扫描失败: {e}[/red]")
        if verbose:
            import traceback
            console.print(traceback.format_exc())
        sys.exit(EXIT_ERROR)


@main.command()
@click.argument(
    "build_log",
    type=click.File("r", encoding="utf-8"),
)
@click.argument(
    "repo_path",
    type=click.Path(),
    callback=validate_repo_path,
    default=lambda: Path.cwd(),
    required=False,
)
def diagnose(build_log, repo_path: Path):
    """分析构建日志，诊断子模块相关错误"""
    content = build_log.read()
    detector = DriftDetector(repo_path)
    issues = detector.parse_build_log(content)

    if issues:
        console.print(f"[yellow]在构建日志中发现 {len(issues)} 个子模块相关问题:[/yellow]")
        for issue in issues:
            console.print(f"  - {issue}")
        sys.exit(EXIT_WARNING)
    else:
        console.print("[green]未在构建日志中发现子模块相关问题[/green]")
        sys.exit(EXIT_OK)


@main.command()
@click.argument(
    "repo_path",
    type=click.Path(),
    callback=validate_repo_path,
    default=lambda: Path.cwd(),
    required=False,
)
@click.option(
    "-f", "--format",
    type=click.Choice(["json", "yaml", "txt"]),
    default="json",
    help="锁定文件格式",
)
@click.option(
    "-o", "--output",
    type=click.Path(),
    help="输出文件路径",
)
def generate_lock(repo_path: Path, format: str, output: Optional[str]):
    """生成当前子模块状态的锁定清单"""
    from .git_reader import GitReader
    import json
    import yaml

    git_reader = GitReader(repo_path)
    if not git_reader.is_git_repo():
        console.print(f"[red]不是 Git 仓库: {repo_path}[/red]")
        sys.exit(EXIT_ERROR)

    submodules = git_reader.read_submodules(recursive=True)

    lock_data = {
        "version": "1.0",
        "generated_at": __import__("datetime").datetime.now().isoformat(),
        "submodules": {},
    }

    for s in submodules:
        if s.current_commit:
            lock_data["submodules"][s.path] = {
                "commit": s.current_commit,
                "url": s.url,
                "branch": s.branch,
            }

    output_path = Path(output) if output else repo_path / f"submodules.lock.{format}"

    if format == "json":
        output_path.write_text(json.dumps(lock_data, indent=2, ensure_ascii=False))
    elif format == "yaml":
        output_path.write_text(yaml.safe_dump(lock_data, allow_unicode=True))
    else:
        lines = []
        for path, info in lock_data["submodules"].items():
            lines.append(f"{info['commit']} {path}")
        output_path.write_text("\n".join(lines))

    console.print(f"[green]锁定清单已生成: {output_path}[/green]")
    console.print(f"包含 {len(lock_data['submodules'])} 个子模块")
    sys.exit(EXIT_OK)


def _calculate_exit_code(report, fail_on: Optional[str], strict: bool) -> int:
    if strict:
        if report.drifted_count > 0 or report.detached_count > 0 or report.dirty_count > 0:
            return EXIT_DRIFT

    if not fail_on:
        return EXIT_OK

    risk_thresholds = {
        "critical": {RiskLevel.CRITICAL},
        "high": {RiskLevel.CRITICAL, RiskLevel.HIGH},
        "medium": {RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM},
        "low": {RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW},
        "any": {RiskLevel.CRITICAL, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW},
    }

    threshold = risk_thresholds.get(fail_on, set())
    for submodule in report.submodules:
        if submodule.risk_level in threshold:
            return EXIT_DRIFT

    return EXIT_OK


if __name__ == "__main__":
    main()
