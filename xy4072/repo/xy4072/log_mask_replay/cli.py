"""CLI 主程序 - 日志脱敏回放盒命令行接口"""

import os
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console
from rich.table import Table

from .config.models import (
    AppConfig,
    create_default_config,
)
from .masker.engine import MaskingEngine
from .parser import get_parser
from .storage.mapping import MappingStore, MappingSource

console = Console()


class Context:
    """CLI 上下文"""
    
    def __init__(self):
        self.config: Optional[AppConfig] = None
        self.config_path: Optional[Path] = None
        self.workspace: Optional[Path] = None
        self.mapping_store: Optional[MappingStore] = None
        self.masking_engine: Optional[MaskingEngine] = None
        self.key: Optional[bytes] = None


pass_context = click.make_pass_decorator(Context, ensure=True)


def load_config(ctx: Context, config_path: Optional[str] = None) -> None:
    """
    加载配置文件
    
    Args:
        ctx: CLI 上下文
        config_path: 配置文件路径
    """
    if config_path:
        ctx.config_path = Path(config_path)
    else:
        # 尝试从默认位置加载
        default_paths = [
            Path("./log-mask-config.json"),
            Path("./.log-mask-config.json"),
            Path.home() / ".log-mask-config.json",
        ]
        for path in default_paths:
            if path.exists():
                ctx.config_path = path
                break
    
    if ctx.config_path and ctx.config_path.exists():
        ctx.config = AppConfig.from_file(ctx.config_path)
        ctx.workspace = Path(ctx.config.workspace)
        
        # 初始化工作区目录
        if ctx.workspace:
            ctx.workspace.mkdir(parents=True, exist_ok=True)
            (ctx.workspace / "input").mkdir(exist_ok=True)
            (ctx.workspace / "output").mkdir(exist_ok=True)
            (ctx.workspace / "mappings").mkdir(exist_ok=True)
            (ctx.workspace / "reports").mkdir(exist_ok=True)
    else:
        console.print("[yellow]未找到配置文件，请先运行 init 命令初始化[/yellow]")


def save_config(ctx: Context) -> None:
    """
    保存配置文件
    
    Args:
        ctx: CLI 上下文
    """
    if ctx.config and ctx.config_path:
        ctx.config.to_file(ctx.config_path)
        console.print(f"[green]配置已保存到: {ctx.config_path}[/green]")


def get_mapping_store(ctx: Context) -> MappingStore:
    """
    获取或创建映射存储
    
    Args:
        ctx: CLI 上下文
        
    Returns:
        映射存储实例
    """
    if ctx.mapping_store is None:
        if ctx.workspace:
            mapping_path = ctx.workspace / "mappings" / "mapping-store.json"
            ctx.mapping_store = MappingStore(mapping_path, ctx.key)
            
            # 尝试加载已有的映射
            if mapping_path.exists():
                try:
                    ctx.mapping_store.load(key=ctx.key)
                except Exception as e:
                    console.print(f"[yellow]加载映射存储时出错: {e}[/yellow]")
        else:
            ctx.mapping_store = MappingStore(key=ctx.key)
    
    return ctx.mapping_store


def get_masking_engine(ctx: Context) -> MaskingEngine:
    """
    获取或创建脱敏引擎
    
    Args:
        ctx: CLI 上下文
        
    Returns:
        脱敏引擎实例
    """
    if ctx.masking_engine is None and ctx.config:
        ctx.masking_engine = MaskingEngine(ctx.config.masking_policy)
        
        # 加载已有的映射
        mapping_store = get_mapping_store(ctx)
        if mapping_store:
            simple_mappings = mapping_store.export_simple_mappings()
            ctx.masking_engine.load_mappings(simple_mappings)
    
    return ctx.masking_engine


@click.group()
@click.option("--config", "-c", type=click.Path(), help="配置文件路径")
@click.option("--key", "-k", type=str, help="加密密钥（用于加密/解密映射存储）")
@click.option("--key-file", type=click.Path(exists=True), help="密钥文件路径")
@pass_context
def main(ctx: Context, config: Optional[str], key: Optional[str], key_file: Optional[str]):
    """
    日志脱敏回放盒 - 安全运营人员的日志脱敏、验证、回放和审计工具
    
    主要功能：
    - init: 初始化配置和工作区
    - scan: 扫描日志文件识别敏感字段
    - mask: 对日志进行脱敏处理
    - verify: 验证脱敏结果
    - replay: 按时间窗口重组问题会话
    - restore: 恢复脱敏的敏感字段（需要密钥）
    - export: 导出审计报告
    """
    # 加载密钥
    if key_file:
        with open(key_file, "rb") as f:
            ctx.key = f.read().strip()
    elif key:
        ctx.key = key.encode("utf-8")
    
    # 加载配置
    load_config(ctx, config)


@main.command()
@click.option("--workspace", "-w", type=click.Path(), default="./workspace", help="工作区目录")
@click.option("--force", "-f", is_flag=True, help="强制覆盖现有配置")
@pass_context
def init(ctx: Context, workspace: str, force: bool):
    """
    初始化配置和工作区
    
    创建默认配置文件和工作区目录结构。
    """
    workspace_path = Path(workspace).absolute()
    
    # 确定配置文件路径
    if ctx.config_path:
        config_path = ctx.config_path
    else:
        config_path = Path("./log-mask-config.json")
    
    # 检查配置文件是否已存在
    if config_path.exists() and not force:
        console.print(f"[yellow]配置文件已存在: {config_path}[/yellow]")
        console.print("[yellow]使用 --force 选项覆盖现有配置[/yellow]")
        return
    
    # 创建默认配置
    config = create_default_config(str(workspace_path))
    
    # 生成密钥（如果没有提供）
    if ctx.key is None:
        ctx.key = MappingStore.generate_key()
        console.print(f"[green]已生成新的加密密钥[/green]")
        console.print(f"[yellow]请妥善保存此密钥，用于后续的恢复操作[/yellow]")
        console.print(f"[cyan]密钥: {ctx.key.decode('utf-8')}[/cyan]")
    
    # 保存配置
    config.to_file(config_path)
    ctx.config = config
    ctx.config_path = config_path
    ctx.workspace = workspace_path
    
    # 创建工作区目录结构
    workspace_path.mkdir(parents=True, exist_ok=True)
    (workspace_path / "input").mkdir(exist_ok=True)
    (workspace_path / "output").mkdir(exist_ok=True)
    (workspace_path / "mappings").mkdir(exist_ok=True)
    (workspace_path / "reports").mkdir(exist_ok=True)
    
    # 保存密钥到密钥文件（可选）
    key_file = workspace_path / "mappings" / "key.txt"
    if not key_file.exists() or force:
        with open(key_file, "wb") as f:
            f.write(ctx.key)
        console.print(f"[green]密钥已保存到: {key_file}[/green]")
    
    console.print(f"[green]初始化完成！[/green]")
    console.print(f"[cyan]配置文件: {config_path}[/cyan]")
    console.print(f"[cyan]工作区: {workspace_path}[/cyan]")
    
    # 显示配置摘要
    console.print("\n[bold]默认脱敏策略:[/bold]")
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("字段类型")
    table.add_column("脱敏策略")
    table.add_column("状态")
    
    for rule in config.masking_policy.rules:
        status = "启用" if rule.enabled else "禁用"
        table.add_row(rule.name, rule.mask_strategy.value, status)
    
    console.print(table)


@main.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True))
@click.option("--input-dir", "-i", type=click.Path(exists=True), help="输入目录（处理目录下所有文件）")
@click.option("--output", "-o", type=click.Path(), help="输出文件路径")
@click.option("--show-details", "-d", is_flag=True, help="显示详细的敏感字段信息")
@pass_context
def scan(ctx: Context, files: tuple, input_dir: Optional[str], output: Optional[str], show_details: bool):
    """
    扫描日志文件识别敏感字段
    
    扫描指定的日志文件，识别其中的敏感字段（手机号、邮箱、token等）。
    """
    if ctx.config is None:
        console.print("[red]错误: 未找到配置文件，请先运行 init 命令[/red]")
        return
    
    # 收集要处理的文件
    files_to_process: List[Path] = []
    
    # 添加命令行指定的文件
    for file_path in files:
        files_to_process.append(Path(file_path))
    
    # 添加输入目录下的文件
    if input_dir:
        input_path = Path(input_dir)
        for ext in ["*.txt", "*.jsonl", "*.csv", "*.log"]:
            files_to_process.extend(input_path.glob(ext))
    
    if not files_to_process:
        console.print("[yellow]没有找到要处理的文件[/yellow]")
        return
    
    console.print(f"[cyan]扫描 {len(files_to_process)} 个文件...[/cyan]")
    
    # 获取脱敏引擎
    engine = get_masking_engine(ctx)
    
    # 统计信息
    total_entries = 0
    total_sensitive = 0
    sensitive_by_type: dict = {}
    
    # 扫描结果
    scan_results = []
    
    for file_path in files_to_process:
        console.print(f"\n[bold]扫描文件: {file_path}[/bold]")
        
        try:
            # 解析文件
            parser = get_parser(str(file_path))
            entries = parser.parse(file_path)
            
            file_sensitive_count = 0
            
            for entry in entries:
                total_entries += 1
                
                # 扫描敏感字段
                sensitive_fields = engine.scan_log_entry(entry)
                
                if sensitive_fields:
                    file_sensitive_count += 1
                    total_sensitive += 1
                    
                    # 统计
                    for field_type, values in sensitive_fields.items():
                        if field_type not in sensitive_by_type:
                            sensitive_by_type[field_type] = 0
                        sensitive_by_type[field_type] += len(values)
                    
                    # 记录结果
                    scan_results.append({
                        "file": str(file_path),
                        "line": entry.line_number,
                        "content": entry.raw_content[:100] + "..." if len(entry.raw_content) > 100 else entry.raw_content,
                        "sensitive_fields": sensitive_fields,
                    })
                    
                    if show_details:
                        console.print(f"  行 {entry.line_number}: 发现敏感字段")
                        for field_type, values in sensitive_fields.items():
                            console.print(f"    {field_type}: {', '.join(values[:3])}{'...' if len(values) > 3 else ''}")
            
            if file_sensitive_count > 0:
                console.print(f"  [yellow]发现 {file_sensitive_count} 条包含敏感字段的日志[/yellow]")
            else:
                console.print(f"  [green]未发现敏感字段[/green]")
                
        except Exception as e:
            console.print(f"[red]处理文件时出错: {file_path} - {e}[/red]")
    
    # 显示统计信息
    console.print("\n" + "=" * 60)
    console.print("[bold]扫描统计[/bold]")
    console.print(f"总日志条目: {total_entries}")
    console.print(f"包含敏感字段的条目: {total_sensitive}")
    
    if sensitive_by_type:
        console.print("\n[bold]敏感字段类型统计:[/bold]")
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("字段类型")
        table.add_column("出现次数")
        
        for field_type, count in sensitive_by_type.items():
            table.add_row(field_type, str(count))
        
        console.print(table)
    
    # 保存结果（如果指定了输出文件）
    if output and scan_results:
        import json
        output_path = Path(output)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump({
                "scan_time": datetime.now().isoformat(),
                "total_entries": total_entries,
                "total_sensitive": total_sensitive,
                "sensitive_by_type": sensitive_by_type,
                "results": scan_results,
            }, f, ensure_ascii=False, indent=2)
        console.print(f"\n[green]扫描结果已保存到: {output_path}[/green]")


@main.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True))
@click.option("--input-dir", "-i", type=click.Path(exists=True), help="输入目录（处理目录下所有文件）")
@click.option("--output-dir", "-o", type=click.Path(), help="输出目录")
@click.option("--preserve-structure", "-s", is_flag=True, help="保留原目录结构")
@click.option("--save-mappings", "-m", is_flag=True, default=True, help="保存映射关系")
@pass_context
def mask(ctx: Context, files: tuple, input_dir: Optional[str], output_dir: Optional[str], 
         preserve_structure: bool, save_mappings: bool):
    """
    对日志进行脱敏处理
    
    按照配置的脱敏策略，对日志文件中的敏感字段进行脱敏处理，
    生成一致化的假值，并保存映射关系以便后续恢复。
    """
    if ctx.config is None:
        console.print("[red]错误: 未找到配置文件，请先运行 init 命令[/red]")
        return
    
    # 确定输出目录
    if output_dir:
        output_path = Path(output_dir)
    elif ctx.workspace:
        output_path = ctx.workspace / "output"
    else:
        output_path = Path("./output")
    
    output_path.mkdir(parents=True, exist_ok=True)
    
    # 收集要处理的文件
    files_to_process: List[Path] = []
    
    # 添加命令行指定的文件
    for file_path in files:
        files_to_process.append(Path(file_path))
    
    # 添加输入目录下的文件
    if input_dir:
        input_path = Path(input_dir)
        for ext in ["*.txt", "*.jsonl", "*.csv", "*.log"]:
            files_to_process.extend(input_path.glob(ext))
    
    if not files_to_process:
        console.print("[yellow]没有找到要处理的文件[/yellow]")
        return
    
    console.print(f"[cyan]脱敏处理 {len(files_to_process)} 个文件...[/cyan]")
    
    # 获取脱敏引擎和映射存储
    engine = get_masking_engine(ctx)
    mapping_store = get_mapping_store(ctx)
    
    # 统计信息
    total_entries = 0
    total_masked = 0
    
    for file_path in files_to_process:
        console.print(f"\n[bold]处理文件: {file_path}[/bold]")
        
        try:
            # 解析文件
            parser = get_parser(str(file_path))
            entries = parser.parse(file_path)
            
            file_masked_count = 0
            masked_lines = []
            
            for entry in entries:
                total_entries += 1
                
                # 脱敏处理
                result = engine.mask_log_entry(entry)
                
                if result.matches:
                    file_masked_count += 1
                    total_masked += 1
                    
                    # 保存映射关系
                    for match in result.matches:
                        mapping_store.add_mapping(
                            field_type=match.field_type.value,
                            original_value=match.original_value,
                            masked_value=match.masked_value or "",
                            source=MappingSource.MASK,
                            source_file=str(file_path),
                            line_number=entry.line_number,
                        )
                
                # 收集脱敏后的内容
                if entry.masked_content:
                    masked_lines.append(entry.masked_content)
                else:
                    masked_lines.append(entry.raw_content)
            
            # 确定输出文件路径
            if preserve_structure and input_dir:
                # 保留相对路径结构
                rel_path = file_path.relative_to(Path(input_dir))
                output_file = output_path / rel_path
                output_file.parent.mkdir(parents=True, exist_ok=True)
            else:
                output_file = output_path / file_path.name
            
            # 写入脱敏后的文件
            with open(output_file, "w", encoding="utf-8") as f:
                for line in masked_lines:
                    f.write(line + "\n")
            
            if file_masked_count > 0:
                console.print(f"  [green]已脱敏 {file_masked_count} 条日志[/green]")
            else:
                console.print(f"  [cyan]没有需要脱敏的内容[/cyan]")
            
            console.print(f"  [cyan]输出文件: {output_file}[/cyan]")
            
        except Exception as e:
            console.print(f"[red]处理文件时出错: {file_path} - {e}[/red]")
    
    # 保存映射关系
    if save_mappings and mapping_store:
        mapping_store.save()
        console.print(f"\n[green]映射关系已保存[/green]")
    
    # 显示统计信息
    console.print("\n" + "=" * 60)
    console.print("[bold]脱敏统计[/bold]")
    console.print(f"总日志条目: {total_entries}")
    console.print(f"已脱敏条目: {total_masked}")
    
    # 显示映射统计
    stats = mapping_store.get_statistics()
    console.print(f"\n[bold]映射统计:[/bold]")
    console.print(f"总映射数: {stats['total_mappings']}")
    
    if stats['by_field_type']:
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("字段类型")
        table.add_column("映射数量")
        
        for field_type, count in stats['by_field_type'].items():
            table.add_row(field_type, str(count))
        
        console.print(table)


@main.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True))
@click.option("--input-dir", "-i", type=click.Path(exists=True), help="输入目录（检查目录下所有文件）")
@click.option("--output", "-o", type=click.Path(), help="验证报告输出路径")
@pass_context
def verify(ctx: Context, files: tuple, input_dir: Optional[str], output: Optional[str]):
    """
    验证脱敏结果
    
    检查脱敏后的日志文件，验证：
    1. 是否还有残留的敏感词
    2. 格式是否被破坏
    3. 跨文件映射是否一致
    """
    if ctx.config is None:
        console.print("[red]错误: 未找到配置文件，请先运行 init 命令[/red]")
        return
    
    # 收集要检查的文件
    files_to_process: List[Path] = []
    
    # 添加命令行指定的文件
    for file_path in files:
        files_to_process.append(Path(file_path))
    
    # 添加输入目录下的文件
    if input_dir:
        input_path = Path(input_dir)
        for ext in ["*.txt", "*.jsonl", "*.csv", "*.log"]:
            files_to_process.extend(input_path.glob(ext))
    
    if not files_to_process:
        console.print("[yellow]没有找到要检查的文件[/yellow]")
        return
    
    console.print(f"[cyan]验证 {len(files_to_process)} 个文件...[/cyan]")
    
    # 获取脱敏引擎（用于重新扫描验证）
    engine = get_masking_engine(ctx)
    
    # 验证结果
    verification_results = {
        "total_files": len(files_to_process),
        "total_entries": 0,
        "issues": [],
        "cross_file_checks": [],
    }
    
    # 用于跨文件一致性检查
    all_masked_values: Dict[str, set] = {}  # {original_value: {masked_value}}
    
    for file_path in files_to_process:
        console.print(f"\n[bold]验证文件: {file_path}[/bold]")
        
        try:
            # 解析文件
            parser = get_parser(str(file_path))
            entries = parser.parse(file_path)
            
            file_issues = []
            
            for entry in entries:
                verification_results["total_entries"] += 1
                
                # 1. 检查是否还有残留的敏感字段
                sensitive_fields = engine.scan_log_entry(entry)
                
                if sensitive_fields:
                    # 检查这些敏感字段是否是映射库中的假值
                    mapping_store = get_mapping_store(ctx)
                    is_residue = False
                    
                    for field_type, values in sensitive_fields.items():
                        for value in values:
                            # 检查是否是原始值（如果是则表示残留）
                            original = mapping_store.get_original_value(field_type, value)
                            if original is None:
                                # 不是映射的假值，可能是残留的敏感信息
                                is_residue = True
                                file_issues.append({
                                    "type": "sensitive_residue",
                                    "line": entry.line_number,
                                    "field_type": field_type,
                                    "value": value,
                                    "content_preview": entry.raw_content[:100],
                                })
                    
                    if is_residue:
                        console.print(f"  [red]行 {entry.line_number}: 发现可能的敏感信息残留[/red]")
                
                # 2. 检查格式破坏（针对 JSONL 和 CSV）
                # 对于 JSONL，检查是否能重新解析
                if file_path.suffix.lower() == ".jsonl":
                    try:
                        import json
                        if entry.masked_content:
                            json.loads(entry.masked_content)
                        else:
                            json.loads(entry.raw_content)
                    except json.JSONDecodeError:
                        file_issues.append({
                            "type": "format_break",
                            "line": entry.line_number,
                            "format": "jsonl",
                            "content_preview": (entry.masked_content or entry.raw_content)[:100],
                        })
                        console.print(f"  [yellow]行 {entry.line_number}: JSON 格式可能被破坏[/yellow]")
            
            if file_issues:
                console.print(f"  [yellow]发现 {len(file_issues)} 个问题[/yellow]")
                verification_results["issues"].extend([
                    {**issue, "file": str(file_path)} for issue in file_issues
                ])
            else:
                console.print(f"  [green]未发现问题[/green]")
                
        except Exception as e:
            console.print(f"[red]验证文件时出错: {file_path} - {e}[/red]")
            verification_results["issues"].append({
                "type": "error",
                "file": str(file_path),
                "message": str(e),
            })
    
    # 3. 跨文件映射一致性检查
    console.print("\n[bold]执行跨文件映射一致性检查...[/bold]")
    mapping_store = get_mapping_store(ctx)
    
    consistency_issues = []
    for field_type, mappings in mapping_store.get_all_mappings().items():
        # 检查是否有同一个原始值映射到不同的假值
        # （由于我们的映射存储是唯一的，这种情况不应该发生）
        # 但我们可以检查是否有不同的原始值映射到同一个假值（冲突）
        masked_to_original: Dict[str, str] = {}
        
        for original, entry in mappings.items():
            masked = entry.masked_value
            
            if masked in masked_to_original:
                # 发现冲突：不同的原始值映射到同一个假值
                if masked_to_original[masked] != original:
                    consistency_issues.append({
                        "type": "mapping_conflict",
                        "field_type": field_type,
                        "masked_value": masked,
                        "original_values": [masked_to_original[masked], original],
                    })
                    console.print(f"  [red]映射冲突: {field_type} - 假值 '{masked}' 映射到多个原始值[/red]")
            else:
                masked_to_original[masked] = original
    
    if consistency_issues:
        verification_results["cross_file_checks"] = consistency_issues
    else:
        console.print("  [green]跨文件映射一致性检查通过[/green]")
    
    # 显示验证结果摘要
    console.print("\n" + "=" * 60)
    console.print("[bold]验证结果摘要[/bold]")
    
    total_issues = len(verification_results["issues"])
    total_conflicts = len(verification_results["cross_file_checks"])
    
    if total_issues == 0 and total_conflicts == 0:
        console.print("[green]✓ 所有验证通过[/green]")
    else:
        console.print(f"[red]✗ 发现 {total_issues} 个问题和 {total_conflicts} 个映射冲突[/red]")
    
    # 保存验证报告
    if output:
        import json
        output_path = Path(output)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump({
                "verification_time": datetime.now().isoformat(),
                **verification_results,
            }, f, ensure_ascii=False, indent=2)
        console.print(f"\n[green]验证报告已保存到: {output_path}[/green]")


@main.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True))
@click.option("--input-dir", "-i", type=click.Path(exists=True), help="输入目录")
@click.option("--start-time", "-s", type=str, help="开始时间（格式: YYYY-MM-DD HH:MM:SS）")
@click.option("--end-time", "-e", type=str, help="结束时间（格式: YYYY-MM-DD HH:MM:SS）")
@click.option("--time-window", "-w", type=int, help="时间窗口（分钟），用于自动查找相关日志")
@click.option("--session-id", type=str, help="会话ID，用于重组特定会话")
@click.option("--output", "-o", type=click.Path(), help="输出文件路径")
@pass_context
def replay(ctx: Context, files: tuple, input_dir: Optional[str], start_time: Optional[str], 
           end_time: Optional[str], time_window: Optional[int], session_id: Optional[str], 
           output: Optional[str]):
    """
    按时间窗口重组问题会话
    
    从多个脱敏后的日志文件中，按时间窗口或会话ID重组问题会话，
    用于复现和分析问题。
    """
    if ctx.config is None:
        console.print("[red]错误: 未找到配置文件，请先运行 init 命令[/red]")
        return
    
    # 收集要处理的文件
    files_to_process: List[Path] = []
    
    # 添加命令行指定的文件
    for file_path in files:
        files_to_process.append(Path(file_path))
    
    # 添加输入目录下的文件
    if input_dir:
        input_path = Path(input_dir)
        for ext in ["*.txt", "*.jsonl", "*.csv", "*.log"]:
            files_to_process.extend(input_path.glob(ext))
    
    if not files_to_process:
        console.print("[yellow]没有找到要处理的文件[/yellow]")
        return
    
    console.print(f"[cyan]从 {len(files_to_process)} 个文件中重组会话...[/cyan]")
    
    # 解析所有日志条目
    all_entries = []
    
    for file_path in files_to_process:
        try:
            parser = get_parser(str(file_path))
            entries = parser.parse(file_path)
            all_entries.extend(entries)
        except Exception as e:
            console.print(f"[red]读取文件时出错: {file_path} - {e}[/red]")
    
    if not all_entries:
        console.print("[yellow]没有找到日志条目[/yellow]")
        return
    
    console.print(f"[cyan]共加载 {len(all_entries)} 条日志[/cyan]")
    
    # 过滤和重组
    filtered_entries = []
    
    # 1. 按时间窗口过滤
    if start_time or end_time:
        try:
            start_dt = None
            end_dt = None
            
            if start_time:
                start_dt = datetime.strptime(start_time, "%Y-%m-%d %H:%M:%S")
            if end_time:
                end_dt = datetime.strptime(end_time, "%Y-%m-%d %H:%M:%S")
            
            # 按时间过滤
            for entry in all_entries:
                if entry.timestamp:
                    include = True
                    if start_dt and entry.timestamp < start_dt:
                        include = False
                    if end_dt and entry.timestamp > end_dt:
                        include = False
                    if include:
                        filtered_entries.append(entry)
            
            console.print(f"[cyan]按时间窗口过滤后剩余 {len(filtered_entries)} 条日志[/cyan]")
            
        except ValueError as e:
            console.print(f"[red]时间格式错误: {e}[/red]")
            console.print("[yellow]请使用格式: YYYY-MM-DD HH:MM:SS[/yellow]")
            return
    
    # 2. 按会话ID过滤（如果指定）
    if session_id:
        session_entries = []
        for entry in filtered_entries or all_entries:
            # 在日志内容中查找会话ID
            if session_id in (entry.masked_content or entry.raw_content):
                session_entries.append(entry)
        
        filtered_entries = session_entries
        console.print(f"[cyan]按会话ID '{session_id}' 过滤后剩余 {len(filtered_entries)} 条日志[/cyan]")
    
    # 3. 按时间窗口自动查找相关日志（如果指定）
    if time_window and filtered_entries:
        # 按时间排序
        filtered_entries.sort(key=lambda x: x.timestamp or datetime.min)
        
        # 以第一条日志为基准，查找时间窗口内的所有相关日志
        if filtered_entries[0].timestamp:
            base_time = filtered_entries[0].timestamp
            from datetime import timedelta
            window_start = base_time - timedelta(minutes=time_window)
            window_end = base_time + timedelta(minutes=time_window)
            
            # 在所有条目（不仅仅是已过滤的）中查找时间窗口内的日志
            expanded_entries = []
            for entry in all_entries:
                if entry.timestamp and window_start <= entry.timestamp <= window_end:
                    expanded_entries.append(entry)
            
            filtered_entries = expanded_entries
            console.print(f"[cyan]扩展时间窗口后共 {len(filtered_entries)} 条日志[/cyan]")
    
    # 按时间排序
    filtered_entries.sort(key=lambda x: x.timestamp or datetime.min)
    
    # 显示结果
    console.print("\n" + "=" * 60)
    console.print(f"[bold]重组结果（共 {len(filtered_entries)} 条日志）[/bold]")
    
    for i, entry in enumerate(filtered_entries[:100]):  # 最多显示100条
        ts = entry.timestamp.strftime("%Y-%m-%d %H:%M:%S") if entry.timestamp else "N/A"
        level = entry.log_level or "INFO"
        content = (entry.masked_content or entry.raw_content)[:80]
        
        console.print(f"[{ts}] [{level:8}] {content}")
    
    if len(filtered_entries) > 100:
        console.print(f"... 还有 {len(filtered_entries) - 100} 条日志")
    
    # 保存结果
    if output and filtered_entries:
        output_path = Path(output)
        
        # 确定输出格式
        if output_path.suffix.lower() == ".json":
            # JSON 格式
            import json
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump({
                    "replay_time": datetime.now().isoformat(),
                    "filters": {
                        "start_time": start_time,
                        "end_time": end_time,
                        "time_window_minutes": time_window,
                        "session_id": session_id,
                    },
                    "total_entries": len(filtered_entries),
                    "entries": [
                        {
                            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
                            "log_level": e.log_level,
                            "source_file": e.source_file,
                            "line_number": e.line_number,
                            "content": e.masked_content or e.raw_content,
                        }
                        for e in filtered_entries
                    ],
                }, f, ensure_ascii=False, indent=2)
        else:
            # 文本格式
            with open(output_path, "w", encoding="utf-8") as f:
                for entry in filtered_entries:
                    ts = entry.timestamp.strftime("%Y-%m-%d %H:%M:%S") if entry.timestamp else "N/A"
                    level = entry.log_level or "INFO"
                    f.write(f"[{ts}] [{level}] {entry.masked_content or entry.raw_content}\n")
        
        console.print(f"\n[green]重组结果已保存到: {output_path}[/green]")


@main.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True))
@click.option("--input-dir", "-i", type=click.Path(exists=True), help="输入目录")
@click.option("--output-dir", "-o", type=click.Path(), help="输出目录")
@click.option("--field-type", "-t", type=str, help="指定要恢复的字段类型")
@click.option("--field-value", "-v", type=str, help="指定要恢复的字段值（假值）")
@click.option("--all-fields", "-a", is_flag=True, help="恢复所有敏感字段")
@pass_context
def restore(ctx: Context, files: tuple, input_dir: Optional[str], output_dir: Optional[str],
            field_type: Optional[str], field_value: Optional[str], all_fields: bool):
    """
    恢复脱敏的敏感字段（需要密钥）
    
    使用保存的映射关系，将脱敏后的假值恢复为原始值。
    必须提供正确的密钥才能执行此操作。
    """
    if ctx.config is None:
        console.print("[red]错误: 未找到配置文件，请先运行 init 命令[/red]")
        return
    
    if ctx.key is None:
        console.print("[red]错误: 恢复操作需要密钥，请使用 --key 或 --key-file 选项提供密钥[/red]")
        return
    
    # 确定输出目录
    if output_dir:
        output_path = Path(output_dir)
    elif ctx.workspace:
        output_path = ctx.workspace / "restored"
    else:
        output_path = Path("./restored")
    
    output_path.mkdir(parents=True, exist_ok=True)
    
    # 收集要处理的文件
    files_to_process: List[Path] = []
    
    # 添加命令行指定的文件
    for file_path in files:
        files_to_process.append(Path(file_path))
    
    # 添加输入目录下的文件
    if input_dir:
        input_path = Path(input_dir)
        for ext in ["*.txt", "*.jsonl", "*.csv", "*.log"]:
            files_to_process.extend(input_path.glob(ext))
    
    if not files_to_process:
        console.print("[yellow]没有找到要处理的文件[/yellow]")
        return
    
    # 获取映射存储
    mapping_store = get_mapping_store(ctx)
    
    console.print(f"[cyan]恢复 {len(files_to_process)} 个文件...[/cyan]")
    
    # 统计信息
    total_restored = 0
    
    for file_path in files_to_process:
        console.print(f"\n[bold]处理文件: {file_path}[/bold]")
        
        try:
            # 读取文件内容
            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            
            restored_lines = []
            file_restored_count = 0
            
            for line in lines:
                original_line = line.rstrip()
                restored_line = original_line
                
                # 获取所有需要恢复的映射
                mappings = mapping_store.get_all_mappings()
                
                for f_type, type_mappings in mappings.items():
                    # 如果指定了字段类型，只恢复该类型
                    if field_type and f_type != field_type:
                        continue
                    
                    for original_value, entry in type_mappings.items():
                        masked_value = entry.masked_value
                        
                        # 如果指定了字段值，只恢复该值
                        if field_value and masked_value != field_value:
                            continue
                        
                        # 替换假值为原始值
                        if masked_value in restored_line:
                            restored_line = restored_line.replace(masked_value, original_value)
                            file_restored_count += 1
                            total_restored += 1
                
                restored_lines.append(restored_line + "\n")
            
            # 保存恢复后的文件
            output_file = output_path / file_path.name
            with open(output_file, "w", encoding="utf-8") as f:
                f.writelines(restored_lines)
            
            if file_restored_count > 0:
                console.print(f"  [green]已恢复 {file_restored_count} 处敏感字段[/green]")
            else:
                console.print(f"  [cyan]没有需要恢复的内容[/cyan]")
            
            console.print(f"  [cyan]输出文件: {output_file}[/cyan]")
            
        except Exception as e:
            console.print(f"[red]恢复文件时出错: {file_path} - {e}[/red]")
    
    # 显示统计信息
    console.print("\n" + "=" * 60)
    console.print("[bold]恢复统计[/bold]")
    console.print(f"总恢复次数: {total_restored}")


@main.command()
@click.option("--output", "-o", type=click.Path(), required=True, help="输出文件路径")
@click.option("--format", "-f", type=click.Choice(["markdown", "csv", "json"]), default="markdown", help="输出格式")
@click.option("--include-mappings", "-m", is_flag=True, help="包含映射关系（谨慎使用，包含敏感信息）")
@click.option("--include-audit-log", "-a", is_flag=True, help="包含审计日志")
@pass_context
def export(ctx: Context, output: str, format: str, include_mappings: bool, include_audit_log: bool):
    """
    导出审计报告
    
    导出脱敏操作的审计报告，支持 Markdown、CSV、JSON 格式。
    """
    if ctx.config is None:
        console.print("[red]错误: 未找到配置文件，请先运行 init 命令[/red]")
        return
    
    # 获取映射存储
    mapping_store = get_mapping_store(ctx)
    
    console.print(f"[cyan]导出审计报告（格式: {format}）[/cyan]")
    
    # 准备报告数据
    stats = mapping_store.get_statistics()
    audit_log = mapping_store.get_audit_log() if include_audit_log else []
    mappings = mapping_store.get_all_mappings() if include_mappings else {}
    
    output_path = Path(output)
    
    if format == "json":
        # JSON 格式
        import json
        report = {
            "export_time": datetime.now().isoformat(),
            "statistics": stats,
        }
        
        if include_audit_log:
            report["audit_log"] = audit_log
        
        if include_mappings:
            report["mappings"] = {
                field_type: {
                    original: {
                        "masked_value": entry.masked_value,
                        "source": entry.source.value,
                        "created_at": entry.created_at.isoformat(),
                        "source_file": entry.source_file,
                        "line_number": entry.line_number,
                    }
                    for original, entry in type_mappings.items()
                }
                for field_type, type_mappings in mappings.items()
            }
        
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
    
    elif format == "csv":
        # CSV 格式
        import csv
        
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            
            # 写入统计信息
            writer.writerow(["统计信息"])
            writer.writerow(["总映射数", stats["total_mappings"]])
            writer.writerow(["已验证数", stats["verified_count"]])
            writer.writerow([])
            
            # 写字段类型统计
            writer.writerow(["字段类型统计"])
            writer.writerow(["字段类型", "数量"])
            for field_type, count in stats["by_field_type"].items():
                writer.writerow([field_type, count])
            writer.writerow([])
            
            # 写映射关系（如果包含）
            if include_mappings and mappings:
                writer.writerow(["映射关系"])
                writer.writerow(["字段类型", "原始值", "假值", "来源", "源文件", "行号"])
                
                for field_type, type_mappings in mappings.items():
                    for original, entry in type_mappings.items():
                        writer.writerow([
                            field_type,
                            original,
                            entry.masked_value,
                            entry.source.value,
                            entry.source_file or "",
                            entry.line_number or "",
                        ])
            
            # 写审计日志（如果包含）
            if include_audit_log and audit_log:
                writer.writerow([])
                writer.writerow(["审计日志"])
                writer.writerow(["时间戳", "操作", "详情"])
                
                for log_entry in audit_log[-100:]:  # 最多显示最近100条
                    writer.writerow([
                        log_entry.get("timestamp", ""),
                        log_entry.get("action", ""),
                        str(log_entry.get("details", "")),
                    ])
    
    else:  # markdown
        # Markdown 格式
        lines = []
        
        lines.append("# 日志脱敏审计报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        # 统计信息
        lines.append("## 统计信息")
        lines.append("")
        lines.append("| 指标 | 值 |")
        lines.append("|------|-----|")
        lines.append(f"| 总映射数 | {stats['total_mappings']} |")
        lines.append(f"| 已验证数 | {stats['verified_count']} |")
        lines.append("")
        
        # 字段类型统计
        if stats['by_field_type']:
            lines.append("## 字段类型统计")
            lines.append("")
            lines.append("| 字段类型 | 数量 |")
            lines.append("|----------|------|")
            for field_type, count in stats['by_field_type'].items():
                lines.append(f"| {field_type} | {count} |")
            lines.append("")
        
        # 映射关系（如果包含）
        if include_mappings and mappings:
            lines.append("## 映射关系")
            lines.append("")
            lines.append("**注意**: 此部分包含原始敏感信息，请谨慎处理！")
            lines.append("")
            
            for field_type, type_mappings in mappings.items():
                lines.append(f"### {field_type}")
                lines.append("")
                lines.append("| 原始值 | 假值 | 来源 | 源文件 | 行号 |")
                lines.append("|--------|------|------|--------|------|")
                
                for original, entry in type_mappings.items():
                    lines.append(f"| {original} | {entry.masked_value} | {entry.source.value} | {entry.source_file or '-'} | {entry.line_number or '-'} |")
                
                lines.append("")
        
        # 审计日志（如果包含）
        if include_audit_log and audit_log:
            lines.append("## 审计日志")
            lines.append("")
            lines.append("| 时间戳 | 操作 | 详情 |")
            lines.append("|--------|------|------|")
            
            for log_entry in audit_log[-50:]:  # 最多显示最近50条
                lines.append(f"| {log_entry.get('timestamp', '-')} | {log_entry.get('action', '-')} | {str(log_entry.get('details', '-'))} |")
            
            lines.append("")
        
        # 写入文件
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
    
    console.print(f"[green]审计报告已导出到: {output_path}[/green]")
    
    if include_mappings:
        console.print("[yellow]警告: 报告包含原始敏感信息，请妥善处理！[/yellow]")


if __name__ == "__main__":
    main()
