"""
巡检包断点补账员 - 主CLI入口
地下管廊机器人巡检数据处理命令行工具
"""

import os
import sys
from pathlib import Path
from typing import List, Optional
from datetime import datetime

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn

# 导入模块
from .modules.parser import DataParser, InspectionPackage
from .modules.validator import DataValidator, ValidationResult, ValidationSeverity
from .modules.merger import DefectMerger, MergeResult
from .modules.scorer import DefectScorer, ScoringResult, RiskLevel
from .modules.exporter import ReportExporter
from .sample_data import SampleDataGenerator


console = Console()


class AppContext:
    """应用上下文"""
    
    def __init__(self):
        self.parser = DataParser()
        self.validator = DataValidator()
        self.merger = DefectMerger()
        self.scorer = DefectScorer()
        self.exporter = ReportExporter()
        self.verbose = False


pass_context = click.make_pass_decorator(AppContext, ensure=True)


@click.group()
@click.option('--verbose', '-v', is_flag=True, help='显示详细输出')
@pass_context
def main(ctx: AppContext, verbose: bool):
    """
    巡检包断点补账员 - 地下管廊机器人巡检数据处理工具
    
    功能：
    - 解析巡检包数据（JSON/CSV/YAML）
    - 校验数据连续性（时间戳、里程桩号）
    - 归并重复缺陷标注
    - 计算风险等级
    - 导出分析报告
    """
    ctx.verbose = verbose


@main.command()
@click.argument('package_dirs', nargs=-1, type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--output', '-o', type=click.Path(), help='输出报告路径（不含扩展名）')
@click.option('--format', '-f', 'formats', multiple=True, 
              type=click.Choice(['markdown', 'csv', 'json']),
              default=['markdown', 'csv'],
              help='输出格式（可多选）')
@click.option('--skip-invalid', '-s', is_flag=True, help='跳过无效的巡检包')
@click.option('--include-warnings', '-w', is_flag=True, 
              help='包含有警告的巡检包（默认只包含完全有效的）')
@pass_context
def process(
    ctx: AppContext,
    package_dirs: List[str],
    output: Optional[str],
    formats: List[str],
    skip_invalid: bool,
    include_warnings: bool
):
    """
    处理多个巡检包，执行完整流程：解析 -> 校验 -> 归并 -> 评分 -> 导出
    
    PACKAGE_DIRS: 一个或多个巡检包目录路径
    """
    if not package_dirs:
        console.print("[red]错误: 请指定至少一个巡检包目录[/red]")
        sys.exit(1)
    
    console.print(Panel.fit(
        "[bold cyan]巡检包断点补账员[/bold cyan]\n"
        "[dim]地下管廊机器人巡检数据处理工具[/dim]",
        title="开始处理",
        border_style="cyan"
    ))
    
    # 步骤1: 解析巡检包
    console.print("\n[bold yellow]步骤1: 解析巡检包[/bold yellow]")
    packages = []
    
    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}")) as progress:
        task = progress.add_task("解析巡检包...", total=len(package_dirs))
        
        for pkg_dir in package_dirs:
            pkg_path = Path(pkg_dir)
            progress.update(task, description=f"解析: {pkg_path.name}")
            
            try:
                package = ctx.parser.parse_package(pkg_path)
                packages.append(package)
                
                if ctx.verbose:
                    console.print(f"  [green]✓[/green] {pkg_path.name}: "
                                  f"{len(package.video_index)} 视频片段, "
                                  f"{len(package.sensor_data)} 传感器记录, "
                                  f"{len(package.defect_annotations)} 缺陷标注")
            except Exception as e:
                console.print(f"  [red]✗[/red] {pkg_path.name}: 解析失败 - {str(e)}")
                if not skip_invalid:
                    console.print("[red]处理终止（使用 --skip-invalid 可跳过无效包）[/red]")
                    sys.exit(1)
            
            progress.advance(task)
    
    if not packages:
        console.print("[red]错误: 没有成功解析任何巡检包[/red]")
        sys.exit(1)
    
    console.print(f"[green]成功解析 {len(packages)} 个巡检包[/green]")
    
    # 步骤2: 数据校验
    console.print("\n[bold yellow]步骤2: 数据校验[/bold yellow]")
    
    validation_results = ctx.validator.validate_multiple_packages(packages)
    
    # 显示校验结果
    valid_packages = []
    for pkg_name, result in validation_results.items():
        status = "✅ 有效" if not result.is_critical else "❌ 无效"
        if result.is_valid and result.issues:
            status = "⚠️ 有警告"
        
        console.print(f"  {status}: {pkg_name}")
        
        if result.issues and ctx.verbose:
            for issue in result.issues:
                severity_style = {
                    ValidationSeverity.CRITICAL: "red",
                    ValidationSeverity.WARNING: "yellow",
                    ValidationSeverity.INFO: "blue"
                }.get(issue.severity, "white")
                
                console.print(f"    [{severity_style}]{issue.severity.value}: {issue.message}[/{severity_style}]")
    
    # 筛选有效包
    if include_warnings:
        # 包含只有警告的包
        valid_packages = [p for p in packages if not validation_results[p.package_name].is_critical]
    else:
        # 只包含完全没有问题的包
        valid_packages = [p for p in packages 
                         if validation_results[p.package_name].is_valid 
                         and not validation_results[p.package_name].issues]
    
    invalid_count = len(packages) - len(valid_packages)
    
    if invalid_count > 0:
        console.print(f"\n[yellow]警告: {invalid_count} 个巡检包存在问题[/yellow]")
        if not valid_packages:
            console.print("[red]错误: 没有有效的巡检包可以处理[/red]")
            sys.exit(1)
    
    console.print(f"[green]使用 {len(valid_packages)} 个有效巡检包继续处理[/green]")
    
    # 步骤3: 缺陷归并
    console.print("\n[bold yellow]步骤3: 缺陷归并[/bold yellow]")
    
    merge_result = ctx.merger.merge_packages(valid_packages)
    
    console.print(f"  原始缺陷数: {merge_result.total_defects_before}")
    console.print(f"  去重后缺陷数: {merge_result.total_defects_after}")
    console.print(f"  去重率: {merge_result.reduction_rate:.1f}%")
    console.print(f"  合并缺陷组: {len(merge_result.merged_defects)}")
    console.print(f"  唯一缺陷: {len(merge_result.unique_defects)}")
    
    if ctx.verbose:
        # 显示按管段统计
        console.print("\n  按管段统计:")
        for segment, stats in merge_result.by_segment.items():
            console.print(f"    {segment}: {stats['total_before']} -> {stats['total_after']}")
    
    # 步骤4: 风险评分
    console.print("\n[bold yellow]步骤4: 风险评分[/bold yellow]")
    
    scoring_result = ctx.scorer.score_defects(merge_result)
    
    # 显示风险等级分布
    console.print("  风险等级分布:")
    for level in RiskLevel:
        count = scoring_result.by_risk_level.get(level.value, 0)
        icon = {
            RiskLevel.CRITICAL: "🔴",
            RiskLevel.HIGH: "🟠",
            RiskLevel.MEDIUM: "🟡",
            RiskLevel.LOW: "🟢",
            RiskLevel.INFO: "🔵",
        }.get(level, "⚪")
        
        label = {
            RiskLevel.CRITICAL: "紧急",
            RiskLevel.HIGH: "高风险",
            RiskLevel.MEDIUM: "中等",
            RiskLevel.LOW: "低风险",
            RiskLevel.INFO: "信息",
        }.get(level, level.value)
        
        console.print(f"    {icon} {label}: {count}")
    
    if scoring_result.statistics:
        stats = scoring_result.statistics
        console.print(f"\n  平均分数: {stats.get('average_score', 0):.1f}")
        console.print(f"  多来源缺陷: {stats.get('source_analysis', {}).get('multi_source', 0)}")
        console.print(f"  多巡检包缺陷: {stats.get('source_analysis', {}).get('multi_package', 0)}")
    
    # 步骤5: 导出报告
    console.print("\n[bold yellow]步骤5: 导出报告[/bold yellow]")
    
    # 确定输出路径
    if output:
        output_path = Path(output)
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = Path(f"inspection_report_{timestamp}")
    
    # 确保输出目录存在
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # 导出报告
    exported_files = ctx.exporter.export_full_report(
        output_path=output_path,
        packages=packages,
        validation_results=validation_results,
        merge_result=merge_result,
        scoring_result=scoring_result,
        formats=list(formats)
    )
    
    console.print("[green]报告已导出:[/green]")
    for fmt, filepath in exported_files.items():
        console.print(f"  - {fmt}: {filepath}")
    
    # 显示摘要
    console.print("\n" + Panel.fit(
        f"[bold green]处理完成！[/bold green]\n\n"
        f"巡检包: {len(packages)} 个\n"
        f"有效包: {len(valid_packages)} 个\n"
        f"原始缺陷: {merge_result.total_defects_before} 个\n"
        f"去重后缺陷: {merge_result.total_defects_after} 个\n"
        f"去重率: {merge_result.reduction_rate:.1f}%\n\n"
        f"报告已保存到: {output_path.parent}",
        title="处理摘要",
        border_style="green"
    ))


@main.command()
@click.argument('package_dirs', nargs=-1, type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--output', '-o', type=click.Path(), help='输出报告路径')
@pass_context
def validate(ctx: AppContext, package_dirs: List[str], output: Optional[str]):
    """
    仅校验巡检包数据，不执行归并和评分
    
    检查：
    - 时间戳连续性（检测断电跳变）
    - 里程桩号连续性（检测倒退）
    - 数据完整性
    """
    if not package_dirs:
        console.print("[red]错误: 请指定至少一个巡检包目录[/red]")
        sys.exit(1)
    
    console.print(Panel.fit(
        "[bold cyan]数据校验模式[/bold cyan]",
        title="开始校验",
        border_style="cyan"
    ))
    
    # 解析包
    packages = []
    for pkg_dir in package_dirs:
        try:
            package = ctx.parser.parse_package(Path(pkg_dir))
            packages.append(package)
        except Exception as e:
            console.print(f"[red]解析失败 {pkg_dir}: {str(e)}[/red]")
    
    if not packages:
        console.print("[red]没有可校验的巡检包[/red]")
        sys.exit(1)
    
    # 执行校验
    validation_results = ctx.validator.validate_multiple_packages(packages)
    
    # 显示结果表
    table = Table(title="校验结果")
    table.add_column("巡检包", style="cyan")
    table.add_column("状态", style="bold")
    table.add_column("严重错误", justify="center")
    table.add_column("警告", justify="center")
    table.add_column("信息", justify="center")
    
    total_critical = 0
    total_warning = 0
    total_info = 0
    
    for pkg_name, result in validation_results.items():
        critical = len(result.get_issues_by_severity(ValidationSeverity.CRITICAL))
        warning = len(result.get_issues_by_severity(ValidationSeverity.WARNING))
        info = len(result.get_issues_by_severity(ValidationSeverity.INFO))
        
        total_critical += critical
        total_warning += warning
        total_info += info
        
        if result.is_critical:
            status = "[red]❌ 无效[/red]"
        elif result.issues:
            status = "[yellow]⚠️ 有警告[/yellow]"
        else:
            status = "[green]✅ 有效[/green]"
        
        table.add_row(
            pkg_name,
            status,
            str(critical) if critical > 0 else "-",
            str(warning) if warning > 0 else "-",
            str(info) if info > 0 else "-"
        )
    
    console.print(table)
    
    # 详细问题列表
    if total_critical + total_warning + total_info > 0:
        console.print("\n[bold]详细问题:[/bold]")
        
        for pkg_name, result in validation_results.items():
            if not result.issues:
                continue
            
            console.print(f"\n[cyan]{pkg_name}:[/cyan]")
            
            for issue in result.issues:
                severity_style = {
                    ValidationSeverity.CRITICAL: "red",
                    ValidationSeverity.WARNING: "yellow",
                    ValidationSeverity.INFO: "blue"
                }.get(issue.severity, "white")
                
                icon = {
                    ValidationSeverity.CRITICAL: "⛔",
                    ValidationSeverity.WARNING: "⚠️",
                    ValidationSeverity.INFO: "ℹ️"
                }.get(issue.severity, "•")
                
                console.print(
                    f"  {icon} [{severity_style}]{issue.severity.value}[/{severity_style}] "
                    f"[{issue.location}]: {issue.message}"
                )
    
    # 导出校验报告
    if output:
        output_path = Path(output)
        exported = ctx.exporter.export_validation_report(
            output_path=output_path,
            validation_results=validation_results
        )
        console.print(f"\n[green]校验报告已导出: {exported}[/green]")


@main.command()
@click.option('--output-dir', '-o', type=click.Path(), default='./test_samples',
              help='示例数据输出目录')
@click.option('--types', '-t', 'sample_types', multiple=True,
              type=click.Choice(['normal', 'timestamp_jump', 'mileage_backtrack', 
                                'overlapping', 'empty', 'corrupt', 'all']),
              default=['all'],
              help='要生成的示例数据类型')
@pass_context
def generate_samples(ctx: AppContext, output_dir: str, sample_types: List[str]):
    """
    生成示例巡检包数据用于测试
    
    可用类型：
    - normal: 正常的巡检包
    - timestamp_jump: 包含时间戳跳变（模拟断电）
    - mileage_backtrack: 包含里程桩号倒退
    - overlapping: 多机器人重复标注相同缺陷
    - empty: 空巡检包
    - corrupt: 损坏的数据文件
    - all: 生成所有类型
    """
    output_path = Path(output_dir)
    
    console.print(Panel.fit(
        f"[bold cyan]生成示例数据[/bold cyan]\n"
        f"输出目录: {output_path.absolute()}",
        title="示例数据生成器",
        border_style="cyan"
    ))
    
    generator = SampleDataGenerator()
    
    if 'all' in sample_types:
        # 生成所有类型
        packages = generator.generate_all_samples(output_path)
        
        console.print("\n[green]生成的示例巡检包:[/green]")
        for name, path in packages.items():
            console.print(f"  - {name}: {path}")
    else:
        # 生成指定类型
        for sample_type in sample_types:
            console.print(f"\n生成 {sample_type}...")
            
            if sample_type == 'normal':
                path = generator.generate_normal_package(output_path)
            elif sample_type == 'timestamp_jump':
                path = generator.generate_package_with_timestamp_jump(output_path)
            elif sample_type == 'mileage_backtrack':
                path = generator.generate_package_with_mileage_backtrack(output_path)
            elif sample_type == 'overlapping':
                paths = generator.generate_overlapping_packages(output_path, package_count=3)
                for i, p in enumerate(paths):
                    console.print(f"  重叠包 {i+1}: {p}")
                continue
            elif sample_type == 'empty':
                path = generator.generate_empty_package(output_path)
            elif sample_type == 'corrupt':
                path = generator.generate_corrupt_package(output_path)
            else:
                console.print(f"[yellow]未知类型: {sample_type}[/yellow]")
                continue
            
            console.print(f"  已生成: {path}")
    
    console.print(f"\n[green]示例数据生成完成！[/green]")
    console.print(f"输出目录: {output_path.absolute()}")


@main.command()
@pass_context
def version(ctx: AppContext):
    """显示版本信息"""
    from . import __version__
    console.print(f"[bold cyan]巡检包断点补账员[/bold cyan] v{__version__}")
    console.print("[dim]地下管廊机器人巡检数据处理工具[/dim]")


if __name__ == "__main__":
    main()
