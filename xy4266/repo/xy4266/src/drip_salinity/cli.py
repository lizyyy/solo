"""CLI命令模块 - 滴灌盐分回算器命令行界面"""

import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Optional, List

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from . import __version__
from .config import (
    ProjectConfig, CropConfig, SubstrateConfig, 
    ThresholdConfig, BedConfig, CropType, SubstrateType, ECUnit
)
from .csv_parser import CSVParser, DataValidator, ValidationError, ValidationErrorType
from .calculator import MultiBedCalculator, RiskLevel
from .storage import StorageManager
from .reporter import ReportGenerator


console = Console()


def get_project_path(ctx: click.Context) -> Path:
    """从上下文获取项目路径"""
    return Path(ctx.obj['project_path'])


def create_storage(ctx: click.Context) -> StorageManager:
    """创建存储管理器"""
    project_path = get_project_path(ctx)
    return StorageManager(str(project_path))


def check_initialized(ctx: click.Context, require: bool = True) -> bool:
    """检查项目是否已初始化"""
    storage = create_storage(ctx)
    is_init = storage.is_initialized()
    
    if require and not is_init:
        console.print("[red]错误: 项目未初始化，请先运行 'drip-salinity init'[/red]")
        sys.exit(1)
    
    return is_init


@click.group()
@click.option('--project', '-p', 
              default=lambda: os.environ.get('DRIP_PROJECT', '.'),
              help='项目路径 (环境变量: DRIP_PROJECT)')
@click.version_option(__version__, '-v', '--version')
@click.pass_context
def main(ctx: click.Context, project: str):
    """
    滴灌盐分回算器 - 温室种植盐分监测与管理工具
    
    用于分析滴灌系统中的盐分累积情况，提供冲洗建议。
    """
    ctx.ensure_object(dict)
    ctx.obj['project_path'] = Path(project).absolute()


@main.command()
@click.option('--name', '-n', default='温室滴灌项目', help='项目名称')
@click.option('--crop', '-c', type=click.Choice([t.value for t in CropType]), 
              default=CropType.TOMATO.value, help='作物类型')
@click.option('--planting-date', '-d', type=str, default=None, 
              help='定植日期 (YYYY-MM-DD，默认今天)')
@click.option('--substrate', '-s', type=click.Choice([t.value for t in SubstrateType]), 
              default=SubstrateType.COCO_PEAT.value, help='基质类型')
@click.option('--volume', '-V', type=float, default=100.0, 
              help='每畦基质体积 (L)')
@click.option('--beds', '-b', type=str, default='A01,A02,A03,A04', 
              help='畦号列表，用逗号分隔')
@click.option('--ec-warning', type=float, default=4.0, 
              help='EC预警阈值 (mS/cm)')
@click.option('--ec-danger', type=float, default=5.0, 
              help='EC危险阈值 (mS/cm)')
@click.option('--force', '-f', is_flag=True, help='强制覆盖现有配置')
@click.pass_context
def init(ctx: click.Context, name: str, crop: str, planting_date: str, 
         substrate: str, volume: float, beds: str, 
         ec_warning: float, ec_danger: float, force: bool):
    """
    初始化新项目，创建作物、基质和阈值配置。
    
    示例:
      drip-salinity init --name "番茄棚A区" --crop 番茄 --beds A01,A02,A03
    """
    project_path = get_project_path(ctx)
    storage = StorageManager(str(project_path))
    
    # 检查是否已初始化
    if storage.is_initialized() and not force:
        console.print(f"[yellow]项目已存在于: {project_path}[/yellow]")
        console.print("[yellow]使用 --force 选项覆盖现有配置[/yellow]")
        sys.exit(1)
    
    # 解析定植日期
    if planting_date:
        try:
            plant_date = date.fromisoformat(planting_date)
        except ValueError:
            console.print(f"[red]日期格式错误: {planting_date}，请使用 YYYY-MM-DD 格式[/red]")
            sys.exit(1)
    else:
        plant_date = date.today()
    
    # 解析畦号
    bed_list = [b.strip() for b in beds.split(',') if b.strip()]
    bed_configs = [BedConfig(bed_id=bed_id, plant_count=100) for bed_id in bed_list]
    
    # 创建配置
    crop_config = CropConfig(
        crop_type=CropType(crop),
        planting_date=plant_date,
        expected_ec_range=(2.0, 3.5),
        max_tolerated_ec=ec_danger
    )
    
    substrate_config = SubstrateConfig(
        substrate_type=SubstrateType(substrate),
        volume_per_bed=volume
    )
    
    threshold_config = ThresholdConfig(
        ec_warning_threshold=ec_warning,
        ec_danger_threshold=ec_danger
    )
    
    project_config = ProjectConfig(
        project_name=name,
        crop=crop_config,
        substrate=substrate_config,
        thresholds=threshold_config,
        beds=bed_configs,
        default_ec_unit=ECUnit.MS_CM
    )
    
    # 保存配置
    config_path = storage.save_config(project_config)
    
    # 显示结果
    console.print(Panel.fit(
        f"[green]项目初始化成功![/green]\n\n"
        f"项目路径: {project_path}\n"
        f"配置文件: {config_path}\n\n"
        f"项目名称: {name}\n"
        f"作物类型: {crop}\n"
        f"基质类型: {substrate}\n"
        f"畦号数量: {len(bed_list)} ({', '.join(bed_list)})\n"
        f"预警阈值: {ec_warning} mS/cm\n"
        f"危险阈值: {ec_danger} mS/cm",
        title="初始化结果",
        border_style="green"
    ))


@main.command('import-day')
@click.argument('csv_file', type=click.Path(exists=True, readable=True))
@click.option('--ec-unit', '-u', type=click.Choice(['mS/cm', 'μS/cm', 'dS/m']),
              default='mS/cm', help='默认EC单位')
@click.option('--dry-run', '-n', is_flag=True, 
              help='仅校验，不保存数据')
@click.option('--force', '-f', is_flag=True,
              help='忽略警告，强制导入')
@click.pass_context
def import_day(ctx: click.Context, csv_file: str, ec_unit: str, 
               dry_run: bool, force: bool):
    """
    导入每日记录并进行数据校验。
    
    校验内容包括:
    - 缺字段检查
    - 时间倒序检查
    - EC单位混乱检查
    - 排液率异常检查
    - 重复畦号检查
    
    示例:
      drip-salinity import-day ./data/2024-01-20.csv
      drip-salinity import-day ./data/2024-01-20.csv --dry-run
    """
    check_initialized(ctx)
    storage = create_storage(ctx)
    config = storage.load_config()
    
    # 解析CSV
    parser = CSVParser()
    console.print(f"[blue]正在解析文件: {csv_file}[/blue]")
    
    records, parse_errors = parser.parse_file(csv_file, ec_unit)
    
    # 显示解析错误
    if parse_errors:
        error_table = Table(title="解析错误", show_lines=True)
        error_table.add_column("行号", style="cyan")
        error_table.add_column("错误类型", style="red")
        error_table.add_column("畦号", style="yellow")
        error_table.add_column("字段", style="magenta")
        error_table.add_column("描述", style="white")
        
        for err in parse_errors:
            error_table.add_row(
                str(err.row_number) if err.row_number > 0 else "-",
                err.error_type.value,
                err.bed_id or "-",
                err.field_name or "-",
                err.message
            )
        
        console.print(error_table)
        
        fatal_errors = [e for e in parse_errors 
                       if e.error_type in [ValidationErrorType.MISSING_FIELD,
                                          ValidationErrorType.INVALID_DATE,
                                          ValidationErrorType.INVALID_NUMBER]]
        if fatal_errors and not force:
            console.print("[red]存在致命错误，无法继续导入。使用 --force 忽略警告。[/red]")
            sys.exit(1)
    
    # 数据校验
    console.print(f"[blue]正在校验 {len(records)} 条记录...[/blue]")
    
    validator = DataValidator(config.thresholds)
    existing_bed_dates = storage.get_existing_bed_dates()
    
    # 获取已存在的(畦号, 日期)组合
    existing_keys = set()
    for bed_id, dates in existing_bed_dates.items():
        for d in dates:
            existing_keys.add((bed_id, d))
    
    # 检查新记录是否有重复
    new_keys = set((r.bed_id, r.record_date) for r in records)
    duplicates = new_keys & existing_keys
    
    if duplicates:
        console.print(f"[yellow]发现 {len(duplicates)} 条重复记录 (畦号+日期已存在):[/yellow]")
        for bed_id, record_date in sorted(duplicates):
            console.print(f"  - {bed_id}: {record_date}")
        
        if not force:
            console.print("[yellow]使用 --force 覆盖现有记录[/yellow]")
            # 移除重复记录
            records = [r for r in records if (r.bed_id, r.record_date) not in duplicates]
            if not records:
                console.print("[red]没有新记录可导入[/red]")
                sys.exit(0)
    
    # 执行校验
    validation_errors = validator.validate(records)
    
    if validation_errors:
        warn_table = Table(title="数据校验警告", show_lines=True)
        warn_table.add_column("错误类型", style="yellow")
        warn_table.add_column("畦号", style="cyan")
        warn_table.add_column("描述", style="white")
        
        for err in validation_errors:
            warn_table.add_row(
                err.error_type.value,
                err.bed_id or "-",
                err.message
            )
        
        console.print(warn_table)
    
    # 统计信息
    if records:
        stats_table = Table(title="导入统计")
        stats_table.add_column("项目", style="cyan")
        stats_table.add_column("数值", style="green")
        
        unique_beds = set(r.bed_id for r in records)
        date_range = (min(r.record_date for r in records), 
                      max(r.record_date for r in records))
        
        stats_table.add_row("记录数量", str(len(records)))
        stats_table.add_row("涉及畦号", str(len(unique_beds)))
        stats_table.add_row("日期范围", f"{date_range[0]} 至 {date_range[1]}")
        
        console.print(stats_table)
    
    if dry_run:
        console.print("[yellow]--dry-run 模式: 数据未保存[/yellow]")
        return
    
    # 保存记录
    if records:
        storage.save_records(records)
        console.print(f"[green]已保存 {len(records)} 条记录[/green]")


@main.command()
@click.option('--show-history', '-H', is_flag=True, help='显示历史趋势')
@click.option('--bed', '-b', type=str, default=None, 
              help='指定畦号分析（默认分析所有）')
@click.pass_context
def simulate(ctx: click.Context, show_history: bool, bed: str):
    """
    估算根区盐分趋势和未来3天冲洗需求。
    
    基于历史记录计算盐平衡，分析盐分累积趋势，
    并预测未来3天是否需要冲洗。
    
    示例:
      drip-salinity simulate
      drip-salinity simulate --bed A01
      drip-salinity simulate --show-history
    """
    check_initialized(ctx)
    storage = create_storage(ctx)
    config = storage.load_config()
    
    # 加载记录
    records = storage.load_records()
    
    if not records:
        console.print("[yellow]没有找到记录数据，请先运行 'import-day'[/yellow]")
        return
    
    # 筛选畦号
    if bed:
        records = [r for r in records if r.bed_id == bed]
        if not records:
            console.print(f"[red]没有找到畦号 {bed} 的记录[/red]")
            return
    
    # 创建计算器并处理记录
    calculator = MultiBedCalculator(
        substrate_volume=config.substrate.volume_per_bed,
        initial_ec=config.crop.expected_ec_range[0]
    )
    
    # 按日期排序后处理
    sorted_records = sorted(records, key=lambda r: (r.record_date, r.bed_id))
    
    all_balances = []
    for record in sorted_records:
        balance = calculator.process_record(record)
        all_balances.append(balance)
    
    # 保存计算结果
    storage.save_calculations(all_balances)
    
    # 获取趋势分析
    thresholds = config.thresholds
    trends = calculator.get_all_trends(
        warning_threshold=thresholds.ec_warning_threshold,
        danger_threshold=thresholds.ec_danger_threshold
    )
    
    # 获取冲洗预测
    target_ec = (config.crop.expected_ec_range[0] + config.crop.expected_ec_range[1]) / 2
    forecasts = calculator.get_all_flushing_forecasts(
        warning_threshold=thresholds.ec_warning_threshold,
        danger_threshold=thresholds.ec_danger_threshold,
        target_ec=target_ec
    )
    
    # 显示结果
    console.print(Panel.fit(
        f"[green]盐分趋势分析完成[/green]\n"
        f"分析畦数: {len(trends)}\n"
        f"记录总数: {len(records)}",
        title="模拟分析结果",
        border_style="blue"
    ))
    
    # 显示各畦状态
    status_table = Table(title="各畦盐分状态", show_lines=True)
    status_table.add_column("畦号", style="cyan")
    status_table.add_column("当前EC", style="magenta")
    status_table.add_column("趋势", style="yellow")
    status_table.add_column("风险等级", style="green")
    status_table.add_column("距预警", style="blue")
    status_table.add_column("距危险", style="red")
    status_table.add_column("冲洗需求", style="green")
    
    for bed_id in sorted(trends.keys()):
        trend = trends[bed_id]
        forecast = forecasts.get(bed_id)
        
        # 风险等级颜色
        risk_style = "green"
        if trend.risk_level == RiskLevel.WARNING:
            risk_style = "yellow"
        elif trend.risk_level == RiskLevel.DANGER:
            risk_style = "red"
        
        # 冲洗需求
        flush_status = "-"
        if forecast and forecast.flushing_needed:
            flush_status = forecast.urgency
        
        status_table.add_row(
            bed_id,
            f"{trend.current_ec:.2f} mS/cm",
            trend.ec_trend,
            f"[{risk_style}]{trend.risk_level.value}[/{risk_style}]",
            f"{trend.warning_days} 天" if trend.warning_days < 999 else "-",
            f"{trend.danger_days} 天" if trend.danger_days < 999 else "-",
            flush_status
        )
    
    console.print(status_table)
    
    # 显示需要冲洗的畦
    urgent_forecasts = {k: v for k, v in forecasts.items() if v.flushing_needed}
    if urgent_forecasts:
        flush_table = Table(title="冲洗建议", show_lines=True)
        flush_table.add_column("畦号", style="cyan")
        flush_table.add_column("当前EC", style="magenta")
        flush_table.add_column("目标EC", style="blue")
        flush_table.add_column("紧急程度", style="red")
        flush_table.add_column("建议冲洗量", style="yellow")
        flush_table.add_column("冲洗液EC", style="green")
        
        for bed_id in sorted(urgent_forecasts.keys()):
            f = urgent_forecasts[bed_id]
            flush_table.add_row(
                bed_id,
                f"{f.current_ec:.2f}",
                f"{f.target_ec:.2f}",
                f.urgency,
                f"{f.recommended_flush_volume:.1f} L",
                f"{f.recommended_flush_ec:.2f} mS/cm"
            )
        
        console.print(flush_table)
    
    # 显示历史趋势
    if show_history:
        console.print("\n[blue]历史EC趋势:[/blue]")
        for bed_id in sorted(trends.keys()):
            trend = trends[bed_id]
            if trend.historical_ecs:
                console.print(f"\n  畦号 {bed_id}:")
                for record_date, ec in trend.historical_ecs[-7:]:  # 最近7天
                    console.print(f"    {record_date}: {ec:.2f} mS/cm")


@main.command()
@click.option('--output-dir', '-o', type=click.Path(), default=None,
              help='输出目录（默认项目reports目录）')
@click.option('--format', '-f', type=click.Choice(['all', 'md', 'csv', 'json']),
              default='all', help='输出格式')
@click.pass_context
def report(ctx: click.Context, output_dir: str, format: str):
    """
    导出分析报告。
    
    支持导出:
    - Markdown 建议报告
    - CSV 风险畦清单
    - JSON 审计包
    
    示例:
      drip-salinity report
      drip-salinity report --format md
      drip-salinity report -o ./output
    """
    check_initialized(ctx)
    storage = create_storage(ctx)
    config = storage.load_config()
    
    # 加载记录和计算结果
    records = storage.load_records()
    calculations = storage.load_calculations()
    
    if not records:
        console.print("[yellow]没有找到记录数据，请先运行 'simulate'[/yellow]")
        return
    
    if not calculations:
        # 如果没有计算结果，先运行模拟
        console.print("[blue]正在执行模拟计算...[/blue]")
        calculator = MultiBedCalculator(
            substrate_volume=config.substrate.volume_per_bed,
            initial_ec=config.crop.expected_ec_range[0]
        )
        
        sorted_records = sorted(records, key=lambda r: (r.record_date, r.bed_id))
        for record in sorted_records:
            calculator.process_record(record)
        
        # 重新加载
        calculations = storage.load_calculations()
    
    # 重新计算以获取最新趋势
    calculator = MultiBedCalculator(
        substrate_volume=config.substrate.volume_per_bed,
        initial_ec=config.crop.expected_ec_range[0]
    )
    
    sorted_records = sorted(records, key=lambda r: (r.record_date, r.bed_id))
    all_balances = []
    for record in sorted_records:
        balance = calculator.process_record(record)
        all_balances.append(balance)
    
    # 获取趋势和预测
    thresholds = config.thresholds
    trends = calculator.get_all_trends(
        warning_threshold=thresholds.ec_warning_threshold,
        danger_threshold=thresholds.ec_danger_threshold
    )
    
    target_ec = (config.crop.expected_ec_range[0] + config.crop.expected_ec_range[1]) / 2
    forecasts = calculator.get_all_flushing_forecasts(
        warning_threshold=thresholds.ec_warning_threshold,
        danger_threshold=thresholds.ec_danger_threshold,
        target_ec=target_ec
    )
    
    # 生成报告
    reporter = ReportGenerator(storage, config)
    
    saved_paths = {}
    
    if format in ['all', 'md']:
        md_content = reporter.generate_markdown_report(trends, forecasts, all_balances)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        md_filename = f"salt_report_{timestamp}.md"
        
        if output_dir:
            output_path = Path(output_dir) / md_filename
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(md_content)
            saved_paths['markdown'] = str(output_path)
        else:
            md_path = storage.save_report_file(md_content, md_filename)
            saved_paths['markdown'] = str(md_path)
    
    if format in ['all', 'csv']:
        # 风险畦CSV
        risk_rows, risk_headers = reporter.generate_risk_csv(trends, forecasts)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        risk_filename = f"risk_beds_{timestamp}.csv"
        
        if output_dir:
            output_path = Path(output_dir) / risk_filename
            import csv
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                if risk_headers:
                    writer.writerow(risk_headers)
                writer.writerows(risk_rows)
            saved_paths['risk_csv'] = str(output_path)
        else:
            risk_path = storage.save_csv_report(risk_rows, risk_filename, risk_headers)
            saved_paths['risk_csv'] = str(risk_path)
        
        # 历史数据CSV
        hist_rows, hist_headers = reporter.generate_history_csv(all_balances)
        hist_filename = f"history_data_{timestamp}.csv"
        
        if output_dir:
            output_path = Path(output_dir) / hist_filename
            import csv
            with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)
                if hist_headers:
                    writer.writerow(hist_headers)
                writer.writerows(hist_rows)
            saved_paths['history_csv'] = str(output_path)
        else:
            hist_path = storage.save_csv_report(hist_rows, hist_filename, hist_headers)
            saved_paths['history_csv'] = str(hist_path)
    
    if format in ['all', 'json']:
        # JSON审计包
        audit_data = reporter.generate_audit_data(trends, forecasts, all_balances)
        audit_path = storage.create_audit_package(extra_data={'report_summary': audit_data})
        saved_paths['audit_json'] = str(audit_path)
    
    # 显示结果
    console.print(Panel.fit(
        "[green]报告生成成功![/green]\n\n" +
        "\n".join(f"- {k}: {v}" for k, v in saved_paths.items()),
        title="报告输出",
        border_style="green"
    ))


@main.command('info')
@click.pass_context
def project_info(ctx: click.Context):
    """显示项目信息"""
    storage = create_storage(ctx)
    info = storage.get_project_info()
    
    if not info['initialized']:
        console.print("[yellow]项目未初始化[/yellow]")
        console.print(f"项目路径: {info['project_path']}")
        return
    
    config = storage.load_config()
    
    info_table = Table(title="项目信息")
    info_table.add_column("属性", style="cyan")
    info_table.add_column("值", style="green")
    
    info_table.add_row("项目名称", config.project_name)
    info_table.add_row("创建日期", str(config.created_at))
    info_table.add_row("作物类型", config.crop.crop_type.value)
    info_table.add_row("基质类型", config.substrate.substrate_type.value)
    info_table.add_row("畦号数量", str(len(config.beds)))
    info_table.add_row("记录数量", str(info['record_count']))
    info_table.add_row("涉及畦数", str(info['bed_count']))
    
    if info['date_range']:
        info_table.add_row("日期范围", f"{info['date_range']['start']} 至 {info['date_range']['end']}")
    
    console.print(info_table)


if __name__ == '__main__':
    main()
