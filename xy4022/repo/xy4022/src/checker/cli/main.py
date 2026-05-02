"""资料包交付巡检器 - CLI主入口"""

import os
import sys
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from checker.config.models import (
    Config,
    ScanResult,
    FileReference,
    CheckIssue,
    IssueLevel,
    IssueType,
)
from checker.markdown_parser.parser import MarkdownParser, LinkReference, ImageReference
from checker.rules.validator import Validator
from checker.cache.manager import CacheManager
from checker.packer.packer import Packer, PackResult
from checker.reporter.exporter import export_markdown_report, export_csv_report

console = Console()

CONFIG_FILE = ".checkerrc.json"
IGNORE_FILE = ".checkerignore"


def load_config() -> Optional[Config]:
    """加载配置文件"""
    config_path = Path.cwd() / CONFIG_FILE
    
    if not config_path.exists():
        return None
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return Config(
            root_dir=data.get("root_dir", "."),
            dist_dir=data.get("dist_dir", "dist"),
            cache_dir=data.get("cache_dir", ".checker_cache"),
            ignore_patterns=data.get("ignore_patterns", [
                "**/__pycache__/**",
                "**/.git/**",
                "**/.DS_Store",
                "**/node_modules/**",
                "**/*.pyc",
            ]),
            large_file_threshold=data.get("large_file_threshold", 5 * 1024 * 1024),
            report_dir=data.get("report_dir", "reports"),
        )
    except Exception as e:
        console.print(f"[red]读取配置文件失败: {e}[/red]")
        return None


def load_ignore_patterns() -> List[str]:
    """加载忽略规则"""
    ignore_path = Path.cwd() / IGNORE_FILE
    patterns = []
    
    if ignore_path.exists():
        with open(ignore_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    patterns.append(line)
    
    return patterns


def save_config(config: Config):
    """保存配置文件"""
    config_path = Path.cwd() / CONFIG_FILE
    
    data = {
        "root_dir": config.root_dir,
        "dist_dir": config.dist_dir,
        "cache_dir": config.cache_dir,
        "ignore_patterns": config.ignore_patterns,
        "large_file_threshold": config.large_file_threshold,
        "report_dir": config.report_dir,
    }
    
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_ignore_patterns(patterns: List[str]):
    """保存忽略规则"""
    ignore_path = Path.cwd() / IGNORE_FILE
    
    with open(ignore_path, 'w', encoding='utf-8') as f:
        f.write("# 资料包交付巡检器忽略规则\n")
        f.write("# 每行一个 glob 模式，# 开头为注释\n")
        f.write("\n")
        for pattern in patterns:
            f.write(f"{pattern}\n")


@click.group()
@click.version_option(version="0.1.0", prog_name="checker")
def cli():
    """资料包交付巡检器 - 用于检查资料包完整性和一致性的命令行工具"""
    pass


@cli.command()
@click.option("--root", "-r", default=".", help="资料根目录 (默认: 当前目录)")
@click.option("--dist", "-d", default="dist", help="输出目录 (默认: dist)")
@click.option("--large-file-threshold", "-l", default=5, help="大文件阈值 (MB, 默认: 5)")
def init(root: str, dist: str, large_file_threshold: int):
    """初始化项目配置和忽略规则"""
    
    console.print(Panel.fit(
        "[bold cyan]初始化资料包交付巡检器配置[/bold cyan]",
        border_style="cyan"
    ))
    
    # 创建默认配置
    config = Config(
        root_dir=root,
        dist_dir=dist,
        cache_dir=".checker_cache",
        ignore_patterns=[
            "**/__pycache__/**",
            "**/.git/**",
            "**/.DS_Store",
            "**/node_modules/**",
            "**/*.pyc",
            ".checker_cache/**",
            "dist/**",
            "reports/**",
        ],
        large_file_threshold=large_file_threshold * 1024 * 1024,
        report_dir="reports",
    )
    
    # 保存配置
    save_config(config)
    console.print(f"[green]✓[/green] 已创建配置文件: {CONFIG_FILE}")
    
    # 保存忽略规则
    save_ignore_patterns(config.ignore_patterns)
    console.print(f"[green]✓[/green] 已创建忽略规则: {IGNORE_FILE}")
    
    # 显示配置摘要
    table = Table(title="配置摘要", show_header=False)
    table.add_column("项目", style="cyan")
    table.add_column("值", style="green")
    
    table.add_row("根目录", root)
    table.add_row("输出目录", dist)
    table.add_row("大文件阈值", f"{large_file_threshold} MB")
    table.add_row("忽略规则数", str(len(config.ignore_patterns)))
    
    console.print(table)
    
    console.print("\n[dim]使用 'checker scan' 开始扫描资料目录[/dim]")


@cli.command()
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
@click.option("--no-cache", is_flag=True, help="不使用缓存，强制重新扫描")
@click.option("--root", "-r", help="指定根目录 (覆盖配置)")
def scan(verbose: bool, no_cache: bool, root: Optional[str]):
    """扫描资料目录，检查所有问题"""
    
    config = load_config()
    if config is None:
        console.print(f"[red]错误: 未找到配置文件，请先运行 'checker init'[/red]")
        sys.exit(1)
    
    # 命令行参数覆盖配置
    if root:
        config.root_dir = root
    
    # 加载忽略规则
    additional_patterns = load_ignore_patterns()
    config.ignore_patterns.extend(additional_patterns)
    
    root_path = Path(config.root_dir).resolve()
    
    console.print(Panel.fit(
        f"[bold cyan]开始扫描: {root_path}[/bold cyan]",
        border_style="cyan"
    ))
    
    # 缓存管理
    cache_manager = CacheManager(config)
    use_cache = not no_cache and cache_manager.is_cache_valid()
    
    if use_cache:
        console.print("[dim]使用缓存，跳过未变化的文件[/dim]")
    else:
        console.print("[dim]不使用缓存，执行完整扫描[/dim]")
        cache_manager.clear_cache()
    
    # 收集所有文件
    all_files: List[str] = []
    markdown_files: List[str] = []
    
    for filepath in root_path.rglob('*'):
        if filepath.is_file():
            rel_path = str(filepath.relative_to(root_path))
            
            # 检查是否被忽略
            from checker.utils.helpers import is_ignored
            if is_ignored(str(filepath), config.ignore_patterns, str(root_path)):
                continue
            
            all_files.append(rel_path)
            
            if filepath.suffix.lower() in ('.md', '.markdown'):
                markdown_files.append(rel_path)
    
    if verbose:
        console.print(f"找到 {len(all_files)} 个文件，{len(markdown_files)} 个 Markdown 文件")
    
    # 解析所有 Markdown 文件
    scan_result = ScanResult()
    scan_result.total_files = len(all_files)
    scan_result.markdown_files = len(markdown_files)
    scan_result.actual_files = all_files
    
    for md_file in markdown_files:
        full_path = str(root_path / md_file)
        
        # 检查缓存
        if use_cache and cache_manager.is_file_cached(md_file, full_path):
            if verbose:
                console.print(f"[dim]跳过缓存文件: {md_file}[/dim]")
            continue
        
        try:
            parser = MarkdownParser(full_path, str(root_path))
            links, images, headings = parser.parse()
            
            # 处理链接
            for link in links:
                ref_type = "anchor" if (link.url == "" and link.anchor) else "link"
                
                target_path = ""
                if link.url:
                    try:
                        target_path = parser.resolve_relative_path(link.url)
                    except Exception:
                        pass
                
                scan_result.references.append(FileReference(
                    source_file=md_file,
                    target_path=target_path,
                    raw_path=link.raw_text,
                    line_number=link.line_number,
                    reference_type=ref_type,
                ))
                
                if target_path:
                    scan_result.referenced_files.append(target_path)
            
            # 处理图片
            for image in images:
                target_path = ""
                if image.url:
                    try:
                        target_path = parser.resolve_relative_path(image.url)
                    except Exception:
                        pass
                
                scan_result.references.append(FileReference(
                    source_file=md_file,
                    target_path=target_path,
                    raw_path=image.raw_text,
                    line_number=image.line_number,
                    reference_type="image",
                ))
                
                if target_path:
                    scan_result.referenced_files.append(target_path)
            
            # 更新缓存
            cache_manager.update_file_cache(md_file, full_path)
            
            if verbose:
                console.print(f"[green]✓[/green] 解析完成: {md_file} (链接:{len(links)}, 图片:{len(images)}, 标题:{len(headings)})")
        
        except Exception as e:
            console.print(f"[yellow]警告[/yellow] 解析 {md_file} 时出错: {e}")
    
    # 执行规则校验
    console.print("\n[bold]执行规则校验...[/bold]")
    
    validator = Validator(config, str(root_path))
    issues = validator.validate_all(scan_result)
    scan_result.issues = issues
    
    # 显示结果
    errors = scan_result.get_errors()
    warnings = scan_result.get_warnings()
    
    table = Table(title="扫描结果")
    table.add_column("类别", style="cyan")
    table.add_column("数量", justify="right")
    
    table.add_row("总文件数", str(scan_result.total_files))
    table.add_row("Markdown文件", str(scan_result.markdown_files))
    table.add_row("引用数量", str(len(scan_result.references)))
    table.add_row("[red]错误[/red]", f"[red]{len(errors)}[/red]")
    table.add_row("[yellow]警告[/yellow]", f"[yellow]{len(warnings)}[/yellow]")
    
    console.print(table)
    
    # 显示问题详情
    if errors:
        console.print("\n[bold red]错误详情:[/bold red]")
        for i, issue in enumerate(errors, 1):
            location = f" ({issue.source_file}"
            if issue.line_number:
                location += f":{issue.line_number}"
            location += ")"
            console.print(f"  [red]{i}.[/red] {issue.message}{location}")
    
    if warnings:
        console.print("\n[bold yellow]警告详情:[/bold yellow]")
        for i, issue in enumerate(warnings, 1):
            location = f" ({issue.source_file}"
            if issue.line_number:
                location += f":{issue.line_number}"
            location += ")"
            console.print(f"  [yellow]{i}.[/yellow] {issue.message}{location}")
    
    # 保存扫描结果到缓存
    files_to_cache = {f: str(root_path / f) for f in all_files}
    cache_manager.mark_full_scan(files_to_cache)
    
    # 保存扫描结果供后续命令使用
    scan_cache_file = Path(config.cache_dir) / "last_scan.json"
    scan_cache_file.parent.mkdir(parents=True, exist_ok=True)
    
    # 简化的扫描结果保存
    scan_summary = {
        "scan_time": scan_result.scan_time.isoformat(),
        "total_files": scan_result.total_files,
        "markdown_files": scan_result.markdown_files,
        "issues": [i.to_dict() for i in scan_result.issues],
        "actual_files": scan_result.actual_files,
        "referenced_files": scan_result.referenced_files,
    }
    
    with open(scan_cache_file, 'w', encoding='utf-8') as f:
        json.dump(scan_summary, f, ensure_ascii=False, indent=2)
    
    # 总结
    if len(errors) > 0:
        console.print(f"\n[bold red]❌ 扫描完成，发现 {len(errors)} 个错误，必须修复后才能打包[/bold red]")
        sys.exit(1)
    else:
        if len(warnings) > 0:
            console.print(f"\n[bold yellow]⚠️ 扫描完成，发现 {len(warnings)} 个警告，建议检查后再打包[/bold yellow]")
        else:
            console.print("\n[bold green]✅ 扫描完成，所有检查通过！[/bold green]")
        
        console.print("[dim]使用 'checker pack' 打包资料，'checker report' 导出报告[/dim]")


@cli.command()
@click.option("--force", "-f", is_flag=True, help="强制覆盖已存在的输出目录")
@click.option("--output", "-o", help="指定输出目录 (覆盖配置)")
def pack(force: bool, output: Optional[str]):
    """打包通过检查的资料到 dist 目录"""
    
    config = load_config()
    if config is None:
        console.print(f"[red]错误: 未找到配置文件，请先运行 'checker init'[/red]")
        sys.exit(1)
    
    if output:
        config.dist_dir = output
    
    root_path = Path(config.root_dir).resolve()
    
    # 检查是否有扫描结果
    scan_cache_file = Path(config.cache_dir) / "last_scan.json"
    if not scan_cache_file.exists():
        console.print(f"[red]错误: 未找到扫描结果，请先运行 'checker scan'[/red]")
        sys.exit(1)
    
    # 加载扫描结果
    with open(scan_cache_file, 'r', encoding='utf-8') as f:
        scan_data = json.load(f)
    
    # 重建扫描结果对象
    scan_result = ScanResult()
    scan_result.scan_time = datetime.fromisoformat(scan_data["scan_time"])
    scan_result.total_files = scan_data["total_files"]
    scan_result.markdown_files = scan_data["markdown_files"]
    scan_result.actual_files = scan_data["actual_files"]
    scan_result.referenced_files = scan_data["referenced_files"]
    
    # 检查是否有错误
    errors = [i for i in scan_data["issues"] if i["level"] == "error"]
    if errors:
        console.print(f"[red]错误: 上次扫描发现 {len(errors)} 个错误，必须先修复并重新扫描[/red]")
        sys.exit(1)
    
    console.print(Panel.fit(
        f"[bold cyan]开始打包资料[/bold cyan]\n源目录: {root_path}\n目标目录: {config.dist_dir}",
        border_style="cyan"
    ))
    
    # 获取要打包的文件
    packer = Packer(config, str(root_path))
    files_to_pack = packer.get_files_to_pack(scan_result)
    
    if not files_to_pack:
        console.print("[yellow]警告: 没有找到需要打包的文件[/yellow]")
        return
    
    console.print(f"将打包 {len(files_to_pack)} 个文件...")
    
    # 执行打包
    result = packer.pack(scan_result, files_to_pack, force)
    
    if not result.success:
        console.print(f"[red]打包失败:[/red]")
        for error in result.errors:
            console.print(f"  - {error}")
        sys.exit(1)
    
    # 显示结果
    table = Table(title="打包结果")
    table.add_column("项目", style="cyan")
    table.add_column("值", style="green")
    
    table.add_row("打包文件数", str(result.copied_files))
    table.add_row("跳过文件数", str(result.skipped_files))
    table.add_row("输出目录", result.dist_directory)
    table.add_row("Manifest文件", result.manifest_path)
    
    console.print(table)
    
    # 显示Manifest摘要
    if result.manifest_path and Path(result.manifest_path).exists():
        with open(result.manifest_path, 'r', encoding='utf-8') as f:
            manifest_data = json.load(f)
        
        console.print(f"\n[bold]Manifest 摘要:[/bold]")
        console.print(f"  版本: {manifest_data.get('version', '1.0')}")
        console.print(f"  生成时间: {manifest_data.get('generated_at', '-')}")
        console.print(f"  总文件数: {manifest_data.get('total_files', 0)}")
    
    console.print(f"\n[bold green]✅ 打包完成！[/bold green]")


@cli.command()
@click.option("--format", "-f", "fmt", default="markdown", 
              type=click.Choice(["markdown", "csv", "all"]),
              help="报告格式 (markdown, csv, all)")
@click.option("--output", "-o", help="输出目录 (默认: reports)")
@click.option("--name", "-n", default="scan_report", help="报告文件名 (不含扩展名)")
def report(fmt: str, output: Optional[str], name: str):
    """导出巡检报告"""
    
    config = load_config()
    if config is None:
        console.print(f"[red]错误: 未找到配置文件，请先运行 'checker init'[/red]")
        sys.exit(1)
    
    output_dir = output or config.report_dir
    
    # 检查是否有扫描结果
    scan_cache_file = Path(config.cache_dir) / "last_scan.json"
    if not scan_cache_file.exists():
        console.print(f"[red]错误: 未找到扫描结果，请先运行 'checker scan'[/red]")
        sys.exit(1)
    
    # 加载扫描结果
    with open(scan_cache_file, 'r', encoding='utf-8') as f:
        scan_data = json.load(f)
    
    # 重建扫描结果对象
    scan_result = ScanResult()
    scan_result.scan_time = datetime.fromisoformat(scan_data["scan_time"])
    scan_result.total_files = scan_data["total_files"]
    scan_result.markdown_files = scan_data["markdown_files"]
    
    # 重建问题列表
    for issue_data in scan_data["issues"]:
        level = IssueLevel(issue_data["level"])
        issue_type = IssueType(issue_data["type"])
        
        scan_result.issues.append(CheckIssue(
            level=level,
            issue_type=issue_type,
            message=issue_data["message"],
            source_file=issue_data.get("source_file"),
            line_number=issue_data.get("line_number"),
            details=issue_data.get("details", {}),
        ))
    
    console.print(Panel.fit(
        f"[bold cyan]导出巡检报告[/bold cyan]\n格式: {fmt}\n输出目录: {output_dir}",
        border_style="cyan"
    ))
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    exported_files = []
    
    if fmt in ["markdown", "all"]:
        md_path = output_path / f"{name}.md"
        export_markdown_report(config, scan_result, str(md_path))
        exported_files.append(str(md_path))
        console.print(f"[green]✓[/green] 已导出 Markdown 报告: {md_path}")
    
    if fmt in ["csv", "all"]:
        csv_path = output_path / f"{name}.csv"
        export_csv_report(config, scan_result, str(csv_path))
        exported_files.append(str(csv_path))
        console.print(f"[green]✓[/green] 已导出 CSV 报告: {csv_path}")
    
    # 显示统计
    errors = scan_result.get_errors()
    warnings = scan_result.get_warnings()
    
    console.print(f"\n[bold]报告摘要:[/bold]")
    console.print(f"  扫描时间: {scan_result.scan_time.strftime('%Y-%m-%d %H:%M:%S')}")
    console.print(f"  总文件数: {scan_result.total_files}")
    console.print(f"  Markdown文件: {scan_result.markdown_files}")
    console.print(f"  错误数: {len(errors)}")
    console.print(f"  警告数: {len(warnings)}")
    
    console.print(f"\n[bold green]✅ 报告导出完成！[/bold green]")


@cli.command()
@click.option("--all", "-a", "clear_all", is_flag=True, help="清除所有缓存（包括配置和忽略规则）")
def cache(clear_all: bool):
    """管理缓存（显示或清除）"""
    
    config = load_config()
    
    if clear_all:
        # 清除所有缓存
        if config:
            cache_dir = Path(config.cache_dir)
            if cache_dir.exists():
                import shutil
                shutil.rmtree(cache_dir)
                console.print(f"[green]✓[/green] 已清除缓存目录: {cache_dir}")
        
        # 清除配置文件
        config_file = Path.cwd() / CONFIG_FILE
        if config_file.exists():
            config_file.unlink()
            console.print(f"[green]✓[/green] 已清除配置文件: {CONFIG_FILE}")
        
        ignore_file = Path.cwd() / IGNORE_FILE
        if ignore_file.exists():
            ignore_file.unlink()
            console.print(f"[green]✓[/green] 已清除忽略规则: {IGNORE_FILE}")
        
        console.print("\n[bold green]✅ 所有缓存已清除[/bold green]")
        return
    
    # 显示缓存状态
    if config is None:
        console.print("[yellow]未找到配置文件，缓存状态未知[/yellow]")
        return
    
    cache_dir = Path(config.cache_dir)
    scan_cache_file = cache_dir / "last_scan.json"
    
    console.print(Panel.fit(
        "[bold cyan]缓存状态[/bold cyan]",
        border_style="cyan"
    ))
    
    table = Table(show_header=False)
    table.add_column("项目", style="cyan")
    table.add_column("值", style="green")
    
    table.add_row("缓存目录", str(cache_dir))
    table.add_row("缓存目录存在", "是" if cache_dir.exists() else "否")
    
    if scan_cache_file.exists():
        with open(scan_cache_file, 'r', encoding='utf-8') as f:
            scan_data = json.load(f)
        table.add_row("上次扫描时间", scan_data.get("scan_time", "-"))
        table.add_row("上次扫描文件数", str(scan_data.get("total_files", 0)))
    else:
        table.add_row("上次扫描", "无")
    
    console.print(table)
    
    console.print("\n[dim]使用 'checker cache --all' 清除所有缓存和配置[/dim]")


if __name__ == "__main__":
    cli()
