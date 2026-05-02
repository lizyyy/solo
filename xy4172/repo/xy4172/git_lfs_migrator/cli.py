"""Git LFS 迁移预检员 - 主 CLI 入口"""
import json
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.tree import Tree

from git_lfs_migrator._version import __version__
from git_lfs_migrator.git_data.parser import GitDataParser
from git_lfs_migrator.models import (
    CheckResult,
    IssueSeverity,
    LFSMigrationPlan,
    ReportPackage,
    ScanResult,
)
from git_lfs_migrator.plan.generator import generate_migration_plan
from git_lfs_migrator.reporter.generator import (
    generate_csv_report,
    generate_json_report,
    generate_markdown_report,
)
from git_lfs_migrator.rules_engine.checker import perform_full_check
from git_lfs_migrator.sandbox.sandbox import MigrationSandbox, run_sandbox_migration


console = Console()


def _format_size(size: int) -> str:
    """格式化大小"""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} PB"


def _severity_to_color(severity: IssueSeverity) -> str:
    """严重程度转换为颜色"""
    mapping = {
        IssueSeverity.CRITICAL: "bold red",
        IssueSeverity.HIGH: "bold yellow",
        IssueSeverity.MEDIUM: "yellow",
        IssueSeverity.LOW: "green",
    }
    return mapping.get(severity, "white")


def _display_scan_result(scan_result: ScanResult) -> None:
    """显示扫描结果"""
    console.print("\n[bold cyan]📊 仓库扫描摘要[/bold cyan]")
    console.print("-" * 50)
    
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("指标", style="dim")
    table.add_column("值")
    
    table.add_row("总文件数", str(scan_result.total_files))
    table.add_row("总大小", _format_size(scan_result.total_size))
    table.add_row("二进制文件数", str(scan_result.binary_files))
    table.add_row("大文件数 (>100KB)", str(scan_result.large_files))
    table.add_row("提交数", str(len(scan_result.rev_list)))
    
    console.print(table)
    
    if scan_result.file_sizes:
        console.print("\n[bold cyan]📁 大文件列表 (前 10 个)[/bold cyan]")
        console.print("-" * 50)
        
        file_table = Table(show_header=True, header_style="bold magenta")
        file_table.add_column("#", style="dim", width=3)
        file_table.add_column("文件路径")
        file_table.add_column("大小", justify="right")
        file_table.add_column("类型")
        
        large_files = sorted(
            scan_result.file_sizes.values(),
            key=lambda f: f.size,
            reverse=True,
        )[:10]
        
        for i, f in enumerate(large_files, 1):
            file_type = "二进制" if f.file_type.value == 2 else "文本" if f.file_type.value == 1 else "未知"
            file_table.add_row(
                str(i),
                f.path,
                _format_size(f.size),
                file_type,
            )
        
        console.print(file_table)


def _display_check_result(check_result: CheckResult) -> None:
    """显示检查结果"""
    console.print("\n[bold cyan]🔍 风险检查结果[/bold cyan]")
    console.print("-" * 50)
    
    if not check_result.issues:
        console.print("[green]✓ 未发现问题[/green]")
        return
    
    critical = [i for i in check_result.issues if i.severity == IssueSeverity.CRITICAL]
    high = [i for i in check_result.issues if i.severity == IssueSeverity.HIGH]
    medium = [i for i in check_result.issues if i.severity == IssueSeverity.MEDIUM]
    low = [i for i in check_result.issues if i.severity == IssueSeverity.LOW]
    
    summary_table = Table(show_header=True, header_style="bold magenta")
    summary_table.add_column("严重程度")
    summary_table.add_column("数量", justify="right")
    
    if critical:
        summary_table.add_row("[bold red]🔴 严重 (CRITICAL)[/bold red]", str(len(critical)))
    if high:
        summary_table.add_row("[bold yellow]🟠 高 (HIGH)[/bold yellow]", str(len(high)))
    if medium:
        summary_table.add_row("[yellow]🟡 中 (MEDIUM)[/yellow]", str(len(medium)))
    if low:
        summary_table.add_row("[green]🟢 低 (LOW)[/green]", str(len(low)))
    
    console.print(summary_table)
    
    console.print("\n[bold cyan]📋 问题详情[/bold cyan]")
    console.print("-" * 50)
    
    for issue in check_result.issues:
        color = _severity_to_color(issue.severity)
        console.print(f"\n[{color}]⚠️  {issue.message}[/{color}]")
        console.print(f"   严重程度: [{color}]{issue.severity.name}[/{color}]")
        console.print(f"   问题类型: {issue.issue_type.name}")
        
        if issue.affected_files:
            console.print(f"   受影响文件 ({len(issue.affected_files)} 个):")
            for f in issue.affected_files[:5]:
                console.print(f"      - {f}")
            if len(issue.affected_files) > 5:
                console.print(f"      - ... 等 {len(issue.affected_files)} 个文件")
        
        if issue.suggestion:
            console.print(f"   💡 建议: {issue.suggestion}")


def _display_migration_plan(plan: LFSMigrationPlan) -> None:
    """显示迁移计划"""
    console.print("\n[bold cyan]📋 迁移计划[/bold cyan]")
    console.print("-" * 50)
    
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("项目", style="dim")
    table.add_column("值")
    
    table.add_row("需要转换的文件数", str(len(plan.files_to_convert)))
    table.add_row("保持不变的文件数", str(len(plan.files_unchanged)))
    table.add_row("预计减少的大小", _format_size(plan.estimated_size_reduction))
    
    console.print(table)
    
    if plan.gitattributes_changes:
        console.print("\n[bold cyan]📝 建议的 .gitattributes 规则[/bold cyan]")
        console.print("-" * 50)
        
        for rule in plan.gitattributes_changes:
            console.print(f"   {rule}")
    
    if plan.warnings:
        console.print("\n[bold yellow]⚠️ 警告[/bold yellow]")
        console.print("-" * 50)
        
        for warning in plan.warnings:
            console.print(f"   - {warning}")
    
    if plan.dry_run_output:
        console.print("\n[bold cyan]🔍 Dry-Run 输出摘要[/bold cyan]")
        console.print("-" * 50)
        console.print(json.dumps(plan.dry_run_output, indent=2, ensure_ascii=False))


@click.group()
@click.version_option(__version__, prog_name="git-lfs-migrator")
def main():
    """Git LFS 迁移预检员 - 给开源仓库维护者用的本地命令行工具
    
    用于在 Git LFS 迁移前进行全面检查和演练。
    """
    pass


@main.command()
@click.argument(
    "repo_path",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    default=Path("."),
)
@click.option(
    "--include-history/--no-include-history",
    default=True,
    help="是否包含历史记录",
)
@click.option(
    "--output-json",
    type=click.Path(dir_okay=False, path_type=Path),
    help="输出 JSON 格式的扫描结果到文件",
)
def scan(repo_path: Path, include_history: bool, output_json: Optional[Path]):
    """扫描仓库，解析 git rev-list、文件大小清单、.gitattributes 和保留分支表
    
    REPO_PATH: Git 仓库路径（默认为当前目录）
    """
    console.print(f"[bold cyan]🔍 正在扫描仓库: {repo_path}[/bold cyan]")
    
    try:
        parser = GitDataParser(repo_path)
        scan_result = parser.full_scan(include_history=include_history)
        
        _display_scan_result(scan_result)
        
        if output_json:
            from git_lfs_migrator.reporter.generator import generate_json_report
            json_data = generate_json_report(scan_result=scan_result)
            output_json.parent.mkdir(parents=True, exist_ok=True)
            with open(output_json, "w", encoding="utf-8") as f:
                json.dump(json_data, f, indent=2, ensure_ascii=False)
            console.print(f"\n[green]✓ JSON 结果已保存到: {output_json}[/green]")
        
        return scan_result
        
    except Exception as e:
        console.print(f"[bold red]✗ 扫描失败: {e}[/bold red]")
        sys.exit(1)


@main.command()
@click.argument(
    "repo_path",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    default=Path("."),
)
@click.option(
    "--large-file-threshold",
    type=int,
    default=100,
    help="大文件阈值（KB），默认 100KB",
)
@click.option(
    "--include-history/--no-include-history",
    default=True,
    help="是否包含历史记录",
)
@click.option(
    "--output-json",
    type=click.Path(dir_okay=False, path_type=Path),
    help="输出 JSON 格式的计划到文件",
)
def plan(repo_path: Path, large_file_threshold: int, include_history: bool, output_json: Optional[Path]):
    """生成迁移 dry-run 计划
    
    REPO_PATH: Git 仓库路径（默认为当前目录）
    """
    console.print(f"[bold cyan]📋 正在生成迁移计划: {repo_path}[/bold cyan]")
    
    try:
        parser = GitDataParser(repo_path)
        scan_result = parser.full_scan(include_history=include_history)
        
        threshold_bytes = large_file_threshold * 1024
        migration_plan = generate_migration_plan(
            scan_result=scan_result,
            large_file_threshold=threshold_bytes,
        )
        
        _display_migration_plan(migration_plan)
        
        if output_json:
            from git_lfs_migrator.reporter.generator import generate_json_report
            json_data = generate_json_report(
                scan_result=scan_result,
                migration_plan=migration_plan,
            )
            output_json.parent.mkdir(parents=True, exist_ok=True)
            with open(output_json, "w", encoding="utf-8") as f:
                json.dump(json_data, f, indent=2, ensure_ascii=False)
            console.print(f"\n[green]✓ JSON 计划已保存到: {output_json}[/green]")
        
        return migration_plan
        
    except Exception as e:
        console.print(f"[bold red]✗ 生成计划失败: {e}[/bold red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@main.command()
@click.argument(
    "repo_path",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    default=Path("."),
)
@click.option(
    "--large-file-threshold",
    type=int,
    default=100,
    help="大文件阈值（KB），默认 100KB",
)
@click.option(
    "--include-history/--no-include-history",
    default=True,
    help="是否包含历史记录",
)
@click.option(
    "--output-json",
    type=click.Path(dir_okay=False, path_type=Path),
    help="输出 JSON 格式的检查结果到文件",
)
def check(repo_path: Path, large_file_threshold: int, include_history: bool, output_json: Optional[Path]):
    """检查风险：大文件、规则冲突、路径大小写、受保护标签和回滚风险
    
    REPO_PATH: Git 仓库路径（默认为当前目录）
    """
    console.print(f"[bold cyan]🔍 正在执行风险检查: {repo_path}[/bold cyan]")
    
    try:
        parser = GitDataParser(repo_path)
        scan_result = parser.full_scan(include_history=include_history)
        
        threshold_bytes = large_file_threshold * 1024
        check_result = perform_full_check(
            scan_result=scan_result,
            large_file_threshold=threshold_bytes,
        )
        
        _display_scan_result(scan_result)
        _display_check_result(check_result)
        
        if output_json:
            from git_lfs_migrator.reporter.generator import generate_json_report
            json_data = generate_json_report(
                scan_result=scan_result,
                check_result=check_result,
            )
            output_json.parent.mkdir(parents=True, exist_ok=True)
            with open(output_json, "w", encoding="utf-8") as f:
                json.dump(json_data, f, indent=2, ensure_ascii=False)
            console.print(f"\n[green]✓ JSON 结果已保存到: {output_json}[/green]")
        
        return check_result
        
    except Exception as e:
        console.print(f"[bold red]✗ 检查失败: {e}[/bold red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@main.command()
@click.argument(
    "repo_path",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    default=Path("."),
)
@click.option(
    "--sandbox-dir",
    type=click.Path(file_okay=False, dir_okay=True, path_type=Path),
    help="沙箱目录路径（默认自动创建临时目录）",
)
@click.option(
    "--large-file-threshold",
    type=int,
    default=100,
    help="大文件阈值（KB），默认 100KB",
)
@click.option(
    "--include-history/--no-include-history",
    default=True,
    help="是否包含历史记录",
)
@click.option(
    "--include-tags/--no-include-tags",
    default=False,
    help="是否包含标签",
)
@click.option(
    "--dry-run/--no-dry-run",
    default=True,
    help="是否为 dry-run 模式（默认 True）",
)
@click.option(
    "--keep-sandbox/--no-keep-sandbox",
    default=False,
    help="是否保留沙箱目录（默认删除）",
)
def apply(
    repo_path: Path,
    sandbox_dir: Optional[Path],
    large_file_threshold: int,
    include_history: bool,
    include_tags: bool,
    dry_run: bool,
    keep_sandbox: bool,
):
    """在临时镜像中演练迁移并写审计日志
    
    REPO_PATH: Git 仓库路径（默认为当前目录）
    """
    if dry_run:
        console.print(f"[bold cyan]🧪 正在执行 dry-run 演练: {repo_path}[/bold cyan]")
    else:
        console.print(f"[bold yellow]⚠️  正在执行实际迁移演练（仅在沙箱中）: {repo_path}[/bold yellow]")
    
    try:
        parser = GitDataParser(repo_path)
        scan_result = parser.full_scan(include_history=include_history)
        
        threshold_bytes = large_file_threshold * 1024
        migration_plan = generate_migration_plan(
            scan_result=scan_result,
            large_file_threshold=threshold_bytes,
        )
        
        _display_migration_plan(migration_plan)
        
        console.print(f"\n[bold cyan]📦 创建沙箱...[/bold cyan]")
        
        sandbox = MigrationSandbox(
            source_repo=repo_path,
            sandbox_dir=sandbox_dir,
            cleanup_on_exit=not keep_sandbox,
        )
        
        sandbox.create()
        
        console.print(f"[green]✓ 沙箱已创建: {sandbox.sandbox_dir}[/green]")
        
        if dry_run:
            result = sandbox.run_migration_dry_run(
                migration_plan=migration_plan,
                include_history=include_history,
                include_tags=include_tags,
            )
        else:
            result = sandbox.run_migration_apply(
                migration_plan=migration_plan,
                include_history=include_history,
                include_tags=include_tags,
            )
        
        execution = sandbox.get_execution_result()
        execution.success = result.get("success", False)
        execution.git_log_snapshot = result.get("git_log_snapshot", [])
        execution.errors = result.get("errors", [])
        execution.warnings = result.get("warnings", [])
        execution.final_state = result.get("final_state", {})
        
        console.print(f"\n[bold cyan]📋 演练结果[/bold cyan]")
        console.print("-" * 50)
        
        if execution.success:
            console.print(f"[green]✓ 演练成功[/green]")
        else:
            console.print(f"[bold red]✗ 演练失败[/bold red]")
            for error in execution.errors:
                console.print(f"   - {error}")
        
        console.print(f"   执行 ID: {execution.execution_id}")
        console.print(f"   沙箱目录: {execution.sandbox_dir}")
        
        if execution.git_log_snapshot:
            console.print(f"\n[bold cyan]📜 Git 日志快照[/bold cyan]")
            for log in execution.git_log_snapshot[:10]:
                console.print(f"   {log}")
        
        audit_log_path = sandbox.sandbox_dir / "audit_log.json"
        console.print(f"\n[green]✓ 审计日志已保存到: {audit_log_path}[/green]")
        
        if not keep_sandbox:
            console.print(f"\n[yellow]ℹ️  沙箱将在退出时自动清理[/yellow]")
            sandbox.cleanup()
        else:
            console.print(f"\n[green]✓ 沙箱已保留: {sandbox.sandbox_dir}[/green]")
        
        return execution
        
    except Exception as e:
        console.print(f"[bold red]✗ 演练失败: {e}[/bold red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@main.command()
@click.argument(
    "repo_path",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    default=Path("."),
)
@click.option(
    "--output-dir",
    type=click.Path(file_okay=False, dir_okay=True, path_type=Path),
    default=Path("lfs-migration-report"),
    help="输出目录路径",
)
@click.option(
    "--large-file-threshold",
    type=int,
    default=100,
    help="大文件阈值（KB），默认 100KB",
)
@click.option(
    "--include-history/--no-include-history",
    default=True,
    help="是否包含历史记录",
)
@click.option(
    "--format",
    "formats",
    multiple=True,
    type=click.Choice(["markdown", "csv", "json", "all"]),
    default=["all"],
    help="输出格式（可多选）",
)
def report(
    repo_path: Path,
    output_dir: Path,
    large_file_threshold: int,
    include_history: bool,
    formats: list,
):
    """导出 Markdown、CSV 和 JSON 报告包
    
    REPO_PATH: Git 仓库路径（默认为当前目录）
    """
    console.print(f"[bold cyan]📊 正在生成报告: {repo_path}[/bold cyan]")
    
    try:
        parser = GitDataParser(repo_path)
        scan_result = parser.full_scan(include_history=include_history)
        
        threshold_bytes = large_file_threshold * 1024
        check_result = perform_full_check(
            scan_result=scan_result,
            large_file_threshold=threshold_bytes,
        )
        
        migration_plan = generate_migration_plan(
            scan_result=scan_result,
            large_file_threshold=threshold_bytes,
        )
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_formats = set(formats)
        if "all" in output_formats:
            output_formats = {"markdown", "csv", "json"}
        
        if "markdown" in output_formats:
            md_content = generate_markdown_report(
                scan_result=scan_result,
                check_result=check_result,
                migration_plan=migration_plan,
            )
            md_path = output_dir / "report.md"
            md_path.write_text(md_content, encoding="utf-8")
            console.print(f"[green]✓ Markdown 报告已保存: {md_path}[/green]")
        
        if "csv" in output_formats:
            csv_files = generate_csv_report(
                scan_result=scan_result,
                check_result=check_result,
                migration_plan=migration_plan,
            )
            for filename, content in csv_files.items():
                csv_path = output_dir / filename
                csv_path.write_text(content, encoding="utf-8")
                console.print(f"[green]✓ CSV 报告已保存: {csv_path}[/green]")
        
        if "json" in output_formats:
            json_data = generate_json_report(
                scan_result=scan_result,
                check_result=check_result,
                migration_plan=migration_plan,
            )
            json_path = output_dir / "report.json"
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(json_data, f, indent=2, ensure_ascii=False)
            console.print(f"[green]✓ JSON 报告已保存: {json_path}[/green]")
        
        console.print(f"\n[bold cyan]✅ 报告生成完成！[/bold cyan]")
        console.print(f"   输出目录: {output_dir}")
        
        _display_scan_result(scan_result)
        _display_check_result(check_result)
        _display_migration_plan(migration_plan)
        
    except Exception as e:
        console.print(f"[bold red]✗ 生成报告失败: {e}[/bold red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
