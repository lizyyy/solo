# -*- coding: utf-8 -*-
"""
CLI入口模块
整合所有命令行功能
"""

import sys
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import click

from . import __version__
from .config import ConfigManager, SamplingPoint, BlankSample
from .csv_parser import SampleCSVParser, TitrationCSVParser, SampleInfo
from .calculator import GranEndpointCalculator, AlkalinityCalculator, AlkalinityResult
from .quality_control import QualityControlChecker, QCStatus, get_qc_status_icon, get_qc_status_color
from .storage import DatabaseManager, CalculationBatch
from .reporter import MarkdownReporter, CSVExporter, generate_report_from_database


@click.group()
@click.version_option(__version__)
@click.pass_context
def main(ctx):
    """
    碱度滴定计算工具 (AlkCalc)
    
    用于野外水质采样小组的碱度滴定数据计算和质控分析。
    """
    ctx.ensure_object(dict)
    ctx.obj['config_manager'] = ConfigManager()


@main.command()
@click.argument('project_name', default='碱度分析项目')
@click.pass_context
def init(ctx, project_name):
    """
    初始化新项目。
    
    创建项目配置文件和数据目录。
    
    PROJECT_NAME: 项目名称（可选）
    """
    config_manager: ConfigManager = ctx.obj['config_manager']
    
    if config_manager.is_project_initialized():
        click.echo(click.style("错误: 项目已存在", fg='red'))
        click.echo(f"配置文件位置: {config_manager.config_path}")
        sys.exit(1)
    
    try:
        config = config_manager.init_project(project_name)
        click.echo(click.style("✓ 项目初始化成功", fg='green'))
        click.echo(f"  项目名称: {config.project_name}")
        click.echo(f"  创建时间: {config.created_at}")
        click.echo(f"  配置文件: {config_manager.config_path}")
        click.echo(f"  数据目录: {config_manager.data_dir}")
        click.echo("")
        click.echo("下一步:")
        click.echo("  1. 使用 'alkcalc config add-point' 添加采样点")
        click.echo("  2. 使用 'alkcalc config set-standard' 设置标准液浓度")
        click.echo("  3. 使用 'alkcalc import-samples' 导入样品清单")
        click.echo("  4. 使用 'alkcalc import-titration' 导入滴定数据")
        click.echo("  5. 使用 'alkcalc calculate' 计算碱度")
    except Exception as e:
        click.echo(click.style(f"错误: {e}", fg='red'))
        sys.exit(1)


@main.group()
@click.pass_context
def config(ctx):
    """管理项目配置。"""
    config_manager: ConfigManager = ctx.obj['config_manager']
    if not config_manager.is_project_initialized():
        click.echo(click.style("错误: 项目未初始化，请先运行 'alkcalc init'", fg='red'))
        sys.exit(1)


@config.command('show')
@click.pass_context
def config_show(ctx):
    """显示当前配置。"""
    config_manager: ConfigManager = ctx.obj['config_manager']
    config = config_manager.load_config()
    
    click.echo(click.style("=== 项目配置 ===", fg='cyan', bold=True))
    click.echo(f"项目名称: {config.project_name}")
    click.echo(f"创建时间: {config.created_at}")
    click.echo("")
    
    click.echo(click.style("=== 采样点 ===", fg='cyan', bold=True))
    if config.sampling_points:
        for sp_id, sp in config.sampling_points.items():
            click.echo(f"  {sp_id}: {sp.name}")
            if sp.description:
                click.echo(f"       描述: {sp.description}")
    else:
        click.echo("  (无)")
    click.echo("")
    
    click.echo(click.style("=== 空白样 ===", fg='cyan', bold=True))
    if config.blank_samples:
        for blank_id, blank in config.blank_samples.items():
            click.echo(f"  {blank_id}: {blank.name}")
            if blank.description:
                click.echo(f"       描述: {blank.description}")
            if blank.expected_volume_ml:
                click.echo(f"       预期体积: {blank.expected_volume_ml} ml")
    else:
        click.echo("  (无)")
    click.echo("")
    
    click.echo(click.style("=== 标准液 ===", fg='cyan', bold=True))
    if config.standard_solution and config.standard_solution.concentration_mol_l:
        click.echo(f"  名称: {config.standard_solution.name}")
        click.echo(f"  浓度: {config.standard_solution.concentration_mol_l:.6f} mol/L")
        if config.standard_solution.batch_number:
            click.echo(f"  批号: {config.standard_solution.batch_number}")
    else:
        click.echo("  (未设置)")
    click.echo("")
    
    click.echo(click.style("=== 质控阈值 ===", fg='cyan', bold=True))
    click.echo(f"  平行样相对偏差限值: {config.qc_thresholds.duplicate_rpd_limit}%")
    click.echo(f"  最小读数点数: {config.qc_thresholds.min_readings}")
    click.echo(f"  pH单调性容差: {config.qc_thresholds.ph_monotonic_tolerance}")


@config.command('add-point')
@click.argument('point_id')
@click.argument('name')
@click.option('--description', '-d', default='', help='采样点描述')
@click.pass_context
def config_add_point(ctx, point_id, name, description):
    """
    添加采样点。
    
    POINT_ID: 采样点ID
    NAME: 采样点名称
    """
    config_manager: ConfigManager = ctx.obj['config_manager']
    
    try:
        sp = config_manager.add_sampling_point(point_id, name, description)
        click.echo(click.style(f"✓ 已添加采样点: {sp.id} - {sp.name}", fg='green'))
    except ValueError as e:
        click.echo(click.style(f"错误: {e}", fg='red'))
        sys.exit(1)


@config.command('remove-point')
@click.argument('point_id')
@click.pass_context
def config_remove_point(ctx, point_id):
    """
    删除采样点。
    
    POINT_ID: 采样点ID
    """
    config_manager: ConfigManager = ctx.obj['config_manager']
    
    try:
        config_manager.remove_sampling_point(point_id)
        click.echo(click.style(f"✓ 已删除采样点: {point_id}", fg='green'))
    except ValueError as e:
        click.echo(click.style(f"错误: {e}", fg='red'))
        sys.exit(1)


@config.command('add-blank')
@click.argument('blank_id')
@click.argument('name')
@click.option('--description', '-d', default='', help='空白样描述')
@click.option('--expected-volume', '-v', type=float, help='预期滴定体积 (ml)')
@click.pass_context
def config_add_blank(ctx, blank_id, name, description, expected_volume):
    """
    添加空白样。
    
    BLANK_ID: 空白样ID
    NAME: 空白样名称
    """
    config_manager: ConfigManager = ctx.obj['config_manager']
    
    try:
        blank = config_manager.add_blank_sample(blank_id, name, description, expected_volume)
        click.echo(click.style(f"✓ 已添加空白样: {blank.id} - {blank.name}", fg='green'))
    except ValueError as e:
        click.echo(click.style(f"错误: {e}", fg='red'))
        sys.exit(1)


@config.command('remove-blank')
@click.argument('blank_id')
@click.pass_context
def config_remove_blank(ctx, blank_id):
    """
    删除空白样。
    
    BLANK_ID: 空白样ID
    """
    config_manager: ConfigManager = ctx.obj['config_manager']
    
    try:
        config_manager.remove_blank_sample(blank_id)
        click.echo(click.style(f"✓ 已删除空白样: {blank_id}", fg='green'))
    except ValueError as e:
        click.echo(click.style(f"错误: {e}", fg='red'))
        sys.exit(1)


@config.command('set-standard')
@click.argument('concentration', type=float)
@click.option('--name', '-n', default='盐酸标准溶液', help='标准液名称')
@click.option('--batch', '-b', default='', help='标准液批号')
@click.pass_context
def config_set_standard(ctx, concentration, name, batch):
    """
    设置标准液浓度。
    
    CONCENTRATION: 标准液浓度 (mol/L)
    """
    config_manager: ConfigManager = ctx.obj['config_manager']
    
    try:
        ss = config_manager.set_standard_solution(concentration, name, batch)
        click.echo(click.style(f"✓ 已设置标准液", fg='green'))
        click.echo(f"  浓度: {ss.concentration_mol_l:.6f} mol/L")
        click.echo(f"  名称: {ss.name}")
        if ss.batch_number:
            click.echo(f"  批号: {ss.batch_number}")
    except ValueError as e:
        click.echo(click.style(f"错误: {e}", fg='red'))
        sys.exit(1)


@config.command('set-qc')
@click.option('--rpd-limit', type=float, help='平行样相对偏差限值 (%)')
@click.option('--min-readings', type=int, help='最小读数点数')
@click.pass_context
def config_set_qc(ctx, rpd_limit, min_readings):
    """设置质控阈值。"""
    config_manager: ConfigManager = ctx.obj['config_manager']
    
    try:
        qc = config_manager.set_qc_threshold(
            duplicate_rpd_limit=rpd_limit,
            min_readings=min_readings
        )
        click.echo(click.style("✓ 已更新质控阈值", fg='green'))
        click.echo(f"  平行样相对偏差限值: {qc.duplicate_rpd_limit}%")
        click.echo(f"  最小读数点数: {qc.min_readings}")
    except ValueError as e:
        click.echo(click.style(f"错误: {e}", fg='red'))
        sys.exit(1)


@main.command('import-samples')
@click.argument('csv_file', type=click.Path(exists=True, dir_okay=False))
@click.pass_context
def import_samples(ctx, csv_file):
    """
    导入样品清单CSV。
    
    CSV_FILE: 样品清单CSV文件路径
    """
    config_manager: ConfigManager = ctx.obj['config_manager']
    if not config_manager.is_project_initialized():
        click.echo(click.style("错误: 项目未初始化，请先运行 'alkcalc init'", fg='red'))
        sys.exit(1)
    
    csv_path = Path(csv_file)
    parser = SampleCSVParser()
    
    click.echo(f"正在解析样品清单: {csv_path}")
    
    try:
        samples = parser.parse(csv_path)
        click.echo(click.style(f"✓ 成功解析 {len(samples)} 个样品", fg='green'))
        
        if parser.warnings:
            click.echo(click.style(f"\n警告 ({len(parser.warnings)}):", fg='yellow'))
            for w in parser.warnings:
                click.echo(f"  - {w}")
        
        # 显示样品信息摘要
        click.echo("\n样品摘要:")
        click.echo(f"  总样品数: {len(samples)}")
        
        # 统计采样点
        sampling_points = set(s.sampling_point for s in samples if s.sampling_point)
        if sampling_points:
            click.echo(f"  涉及采样点: {len(sampling_points)} 个")
        
        # 统计空白样
        blank_count = sum(1 for s in samples if s.is_blank)
        if blank_count > 0:
            click.echo(f"  空白样: {blank_count} 个")
        
        # 统计平行样
        duplicate_count = sum(1 for s in samples if s.is_duplicate)
        if duplicate_count > 0:
            click.echo(f"  平行样: {duplicate_count} 个")
        
        click.echo("\n样品数据已准备就绪，可以与滴定数据进行匹配。")
        
    except ValueError as e:
        click.echo(click.style(f"解析失败: {e}", fg='red'))
        sys.exit(1)


@main.command('import-titration')
@click.argument('csv_file', type=click.Path(exists=True, dir_okay=False))
@click.pass_context
def import_titration(ctx, csv_file):
    """
    导入滴定读数CSV。
    
    CSV_FILE: 滴定数据CSV文件路径
    """
    config_manager: ConfigManager = ctx.obj['config_manager']
    if not config_manager.is_project_initialized():
        click.echo(click.style("错误: 项目未初始化，请先运行 'alkcalc init'", fg='red'))
        sys.exit(1)
    
    csv_path = Path(csv_file)
    parser = TitrationCSVParser()
    
    click.echo(f"正在解析滴定数据: {csv_path}")
    
    try:
        titration_data = parser.parse(csv_path)
        click.echo(click.style(f"✓ 成功解析 {len(titration_data)} 个样品的滴定数据", fg='green'))
        
        # 显示摘要
        total_readings = sum(len(d.readings) for d in titration_data.values())
        click.echo(f"\n数据摘要:")
        click.echo(f"  样品数: {len(titration_data)}")
        click.echo(f"  总读数点数: {total_readings}")
        
        # 统计每个样品的读数数
        reading_counts = [len(d.readings) for d in titration_data.values()]
        click.echo(f"  平均每样品读数: {sum(reading_counts)/len(reading_counts):.1f}")
        click.echo(f"  最少读数: {min(reading_counts)}")
        click.echo(f"  最多读数: {max(reading_counts)}")
        
        if parser.warnings:
            click.echo(click.style(f"\n警告 ({len(parser.warnings)}):", fg='yellow'))
            for w in parser.warnings:
                click.echo(f"  - {w}")
        
    except ValueError as e:
        click.echo(click.style(f"解析失败: {e}", fg='red'))
        sys.exit(1)


@main.command('calculate')
@click.argument('samples_csv', type=click.Path(exists=True, dir_okay=False))
@click.argument('titration_csv', type=click.Path(exists=True, dir_okay=False))
@click.option('--batch-name', '-b', default=None, help='批次名称')
@click.option('--sample-volume', '-v', type=float, default=50.0, help='样品体积 (ml), 默认50ml')
@click.option('--blank-sample', '-k', default=None, help='空白样ID (用于空白扣除)')
@click.option('--save/--no-save', default=True, help='是否保存到数据库')
@click.pass_context
def calculate(ctx, samples_csv, titration_csv, batch_name, sample_volume, blank_sample, save):
    """
    计算碱度并执行质控检查。
    
    使用Gran法估算端点体积，计算总碱度(mg/L as CaCO3)，
    并执行完整的质控检查。
    
    SAMPLES_CSV: 样品清单CSV文件
    TITRATION_CSV: 滴定数据CSV文件
    """
    config_manager: ConfigManager = ctx.obj['config_manager']
    if not config_manager.is_project_initialized():
        click.echo(click.style("错误: 项目未初始化，请先运行 'alkcalc init'", fg='red'))
        sys.exit(1)
    
    config = config_manager.load_config()
    
    # 检查标准液浓度
    if not config.standard_solution or not config.standard_solution.concentration_mol_l:
        click.echo(click.style("错误: 标准液浓度未设置，请先运行 'alkcalc config set-standard'", fg='red'))
        sys.exit(1)
    
    standard_concentration = config.standard_solution.concentration_mol_l
    
    # 解析CSV文件
    click.echo("解析输入文件...")
    
    sample_parser = SampleCSVParser()
    titration_parser = TitrationCSVParser()
    
    try:
        samples = sample_parser.parse(Path(samples_csv))
        titration_data = titration_parser.parse(Path(titration_csv))
    except ValueError as e:
        click.echo(click.style(f"解析失败: {e}", fg='red'))
        sys.exit(1)
    
    sample_infos = {s.sample_id: s for s in samples}
    
    # 准备计算
    click.echo("\n开始计算...")
    
    gran_calc = GranEndpointCalculator()
    alk_calc = AlkalinityCalculator()
    qc_checker = QualityControlChecker(
        min_readings=config.qc_thresholds.min_readings,
        ph_monotonic_tolerance=config.qc_thresholds.ph_monotonic_tolerance,
        duplicate_rpd_limit=config.qc_thresholds.duplicate_rpd_limit
    )
    
    # 获取空白样体积（如果指定）
    blank_volume = 0.0
    if blank_sample:
        if blank_sample in titration_data:
            try:
                blank_gran = gran_calc.calculate(
                    titration_data[blank_sample].readings,
                    sample_volume
                )
                blank_volume = blank_gran.endpoint_volume_ml
                click.echo(f"  空白样 '{blank_sample}' 端点体积: {blank_volume:.4f} ml")
            except Exception as e:
                click.echo(click.style(f"  警告: 无法计算空白样端点体积: {e}", fg='yellow'))
        else:
            click.echo(click.style(f"  警告: 空白样 '{blank_sample}' 未找到滴定数据", fg='yellow'))
    
    # 计算每个样品
    alkalinity_results: Dict[str, AlkalinityResult] = {}
    calculation_errors: Dict[str, str] = {}
    
    with click.progressbar(samples, label='计算样品碱度') as bar:
        for sample in bar:
            sample_id = sample.sample_id
            
            if sample_id not in titration_data:
                calculation_errors[sample_id] = "缺少滴定数据"
                continue
            
            try:
                # Gran法计算端点
                gran_result = gran_calc.calculate(
                    titration_data[sample_id].readings,
                    sample_volume
                )
                
                # 计算碱度
                alk_result = alk_calc.calculate(
                    sample_id=sample_id,
                    endpoint_volume_ml=gran_result.endpoint_volume_ml,
                    standard_concentration_mol_l=standard_concentration,
                    sample_volume_used_ml=sample_volume,
                    blank_volume_ml=blank_volume if not sample.is_blank else 0.0,
                    temperature_c=sample.temperature_c,
                    dilution_factor=sample.dilution_factor,
                    gran_fit=gran_result
                )
                
                alkalinity_results[sample_id] = alk_result
                
            except Exception as e:
                calculation_errors[sample_id] = str(e)
    
    # 执行质控检查
    click.echo("\n执行质控检查...")
    
    batch_qc_result = qc_checker.check_batch_qc(
        sample_infos=sample_infos,
        titration_data=titration_data,
        alkalinity_results=alkalinity_results,
        standard_concentration=standard_concentration
    )
    
    # 显示结果摘要
    click.echo(click.style("\n=== 计算结果摘要 ===", fg='cyan', bold=True))
    
    overall_icon = get_qc_status_icon(batch_qc_result.overall_status)
    overall_color = get_qc_status_color(batch_qc_result.overall_status)
    click.echo(click.style(
        f"整体质控状态: {overall_icon} {batch_qc_result.overall_status.value}",
        fg=overall_color, bold=True
    ))
    
    summary = batch_qc_result.summary
    click.echo(f"\n  总样品数: {summary.get('total_samples', 0)}")
    click.echo(f"  成功计算: {len(alkalinity_results)}")
    click.echo(f"  计算失败: {len(calculation_errors)}")
    click.echo(f"  质控通过: {summary.get('qc_counts', {}).get('PASS', 0)}")
    click.echo(f"  质控警告: {summary.get('qc_counts', {}).get('WARNING', 0)}")
    click.echo(f"  质控失败: {summary.get('qc_counts', {}).get('FAIL', 0)}")
    
    # 显示碱度统计
    if alkalinity_results:
        alk_values = [r.total_alkalinity_mg_l_caco3 for r in alkalinity_results.values()]
        click.echo(f"\n  碱度范围: {min(alk_values):.2f} - {max(alk_values):.2f} mg/L as CaCO3")
        click.echo(f"  平均碱度: {sum(alk_values)/len(alk_values):.2f} mg/L as CaCO3")
    
    # 显示问题样品
    if batch_qc_result.all_issues:
        click.echo(click.style("\n=== 质控问题 ===", fg='yellow', bold=True))
        
        issues_by_sample: Dict[str, List] = {}
        for issue in batch_qc_result.all_issues:
            if issue.sample_id not in issues_by_sample:
                issues_by_sample[issue.sample_id] = []
            issues_by_sample[issue.sample_id].append(issue)
        
        for sample_id, issues in issues_by_sample.items():
            icon = get_qc_status_icon(max(issues, key=lambda i: i.status.value).status)
            click.echo(f"\n  {icon} {sample_id}:")
            for issue in issues:
                issue_icon = get_qc_status_icon(issue.status)
                click.echo(f"    {issue_icon} [{issue.rule_code}] {issue.message}")
    
    # 显示计算错误
    if calculation_errors:
        click.echo(click.style("\n=== 计算错误 ===", fg='red', bold=True))
        for sample_id, error in calculation_errors.items():
            click.echo(f"  ✕ {sample_id}: {error}")
    
    # 保存到数据库
    if save:
        click.echo("\n保存到数据库...")
        
        db_manager = DatabaseManager(config_manager.get_data_dir())
        
        if not batch_name:
            batch_name = f"批次_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            batch_id = db_manager.save_calculation_batch(
                batch_name=batch_name,
                project_name=config.project_name,
                standard_concentration_mol_l=standard_concentration,
                sample_volume_used_ml=sample_volume,
                sample_results=alkalinity_results,
                sample_infos=sample_infos,
                batch_qc_result=batch_qc_result,
                notes=f"空白扣除: {blank_sample} = {blank_volume:.4f}ml" if blank_sample else ""
            )
            
            click.echo(click.style(f"✓ 已保存到数据库 (批次ID: {batch_id})", fg='green'))
            click.echo(f"\n使用 'alkcalc history' 查看历史记录")
            click.echo(f"使用 'alkcalc report {batch_id}' 导出报告")
            
        except Exception as e:
            click.echo(click.style(f"保存失败: {e}", fg='red'))


@main.command('history')
@click.option('--start-date', '-s', type=click.DateTime(formats=['%Y-%m-%d']), help='开始日期 (YYYY-MM-DD)')
@click.option('--end-date', '-e', type=click.DateTime(formats=['%Y-%m-%d']), help='结束日期 (YYYY-MM-DD)')
@click.option('--sampling-point', '-p', help='采样点过滤')
@click.option('--qc-status', '-q', type=click.Choice(['PASS', 'WARNING', 'FAIL', 'ERROR']), help='质控状态过滤')
@click.option('--sample-id', '-i', help='样品ID过滤 (支持模糊匹配)')
@click.option('--detail', '-d', is_flag=True, help='显示详细信息')
@click.pass_context
def history(ctx, start_date, end_date, sampling_point, qc_status, sample_id, detail):
    """查询历史计算结果。"""
    config_manager: ConfigManager = ctx.obj['config_manager']
    if not config_manager.is_project_initialized():
        click.echo(click.style("错误: 项目未初始化，请先运行 'alkcalc init'", fg='red'))
        sys.exit(1)
    
    db_manager = DatabaseManager(config_manager.get_data_dir())
    
    # 转换日期
    start_date_obj = start_date.date() if start_date else None
    end_date_obj = end_date.date() if end_date else None
    
    # 查询
    results = db_manager.query_history(
        start_date=start_date_obj,
        end_date=end_date_obj,
        sampling_point=sampling_point,
        qc_status=qc_status,
        sample_id=sample_id
    )
    
    if not results:
        click.echo("未找到匹配的历史记录")
        return
    
    click.echo(click.style(f"找到 {len(results)} 个批次", fg='cyan', bold=True))
    
    for batch_id, batch_data in sorted(results.items(), key=lambda x: x[0], reverse=True):
        batch_info = batch_data.get("batch_info", {})
        samples = batch_data.get("samples", [])
        
        click.echo(f"\n{'='*60}")
        click.echo(f"批次 #{batch_id}: {batch_info.get('batch_name', '未命名')}")
        click.echo(f"  创建时间: {batch_info.get('created_at', '-')}")
        click.echo(f"  项目: {batch_info.get('project_name', '-')}")
        click.echo(f"  样品数: {len(samples)}")
        
        if detail and samples:
            click.echo("\n  样品详情:")
            for sample in samples:
                status = sample.get('qc_status', 'UNKNOWN')
                icon = get_qc_status_icon(QCStatus(status)) if status != 'UNKNOWN' else '?'
                click.echo(
                    f"    {icon} {sample.get('sample_id', '-'):12} "
                    f"{sample.get('sampling_point', '-'):15} "
                    f"{sample.get('total_alkalinity_mg_l_caco3', 0):>10.2f} mg/L "
                    f"[{status}]"
                )


@main.command('report')
@click.argument('batch_id', type=int)
@click.option('--output-dir', '-o', default='.', type=click.Path(file_okay=False), help='输出目录')
@click.option('--format', '-f', type=click.Choice(['all', 'markdown', 'csv']), default='all', help='输出格式')
@click.pass_context
def report(ctx, batch_id, output_dir, format):
    """
    导出报告。
    
    BATCH_ID: 批次ID
    """
    config_manager: ConfigManager = ctx.obj['config_manager']
    if not config_manager.is_project_initialized():
        click.echo(click.style("错误: 项目未初始化，请先运行 'alkcalc init'", fg='red'))
        sys.exit(1)
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    db_manager = DatabaseManager(config_manager.get_data_dir())
    
    # 检查批次是否存在
    batch = db_manager.get_batch(batch_id)
    if not batch:
        click.echo(click.style(f"错误: 批次 {batch_id} 不存在", fg='red'))
        sys.exit(1)
    
    click.echo(f"正在为批次 #{batch_id} 生成报告...")
    
    sample_results = db_manager.get_sample_results(batch_id)
    statistics = db_manager.get_statistics(batch_id)
    
    generated_files = []
    
    # 生成Markdown报告
    if format in ['all', 'markdown']:
        reporter = MarkdownReporter()
        markdown_content = reporter.generate_batch_report(batch, sample_results, statistics)
        
        md_path = output_path / f"batch_{batch_id}_report.md"
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        generated_files.append(md_path)
        click.echo(click.style(f"✓ Markdown报告: {md_path}", fg='green'))
    
    # 生成CSV
    if format in ['all', 'csv']:
        # 详细结果
        csv_path = output_path / f"batch_{batch_id}_results.csv"
        CSVExporter.export_batch_results(csv_path, sample_results)
        generated_files.append(csv_path)
        click.echo(click.style(f"✓ CSV结果: {csv_path}", fg='green'))
        
        # 统计信息
        stats_csv_path = output_path / f"batch_{batch_id}_statistics.csv"
        CSVExporter.export_statistics(stats_csv_path, statistics, batch)
        generated_files.append(stats_csv_path)
        click.echo(click.style(f"✓ CSV统计: {stats_csv_path}", fg='green'))
    
    click.echo(f"\n共生成 {len(generated_files)} 个文件")


@main.command('list-batches')
@click.pass_context
def list_batches(ctx):
    """列出所有计算批次。"""
    config_manager: ConfigManager = ctx.obj['config_manager']
    if not config_manager.is_project_initialized():
        click.echo(click.style("错误: 项目未初始化，请先运行 'alkcalc init'", fg='red'))
        sys.exit(1)
    
    db_manager = DatabaseManager(config_manager.get_data_dir())
    batches = db_manager.get_all_batches()
    
    if not batches:
        click.echo("暂无计算批次")
        return
    
    click.echo(click.style("=== 计算批次列表 ===", fg='cyan', bold=True))
    
    for batch in batches:
        overall_status = batch.metadata.get('overall_status', 'UNKNOWN') if batch.metadata else 'UNKNOWN'
        icon = get_qc_status_icon(QCStatus(overall_status)) if overall_status != 'UNKNOWN' else '?'
        
        click.echo(f"\n  批次 #{batch.id}: {batch.batch_name}")
        click.echo(f"    创建时间: {batch.created_at}")
        click.echo(f"    项目: {batch.project_name}")
        click.echo(f"    标准液浓度: {batch.standard_concentration_mol_l:.6f} mol/L")
        click.echo(f"    整体状态: {icon} {overall_status}")


if __name__ == '__main__':
    main()
