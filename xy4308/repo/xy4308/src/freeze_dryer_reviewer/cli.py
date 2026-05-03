"""冻干曲线复盘器 CLI 入口"""
from pathlib import Path
from typing import Optional, List
import json
import csv
from datetime import datetime

import click

from . import __version__
from .models import BatchData
from .parser import MultiSourceCSVParser, DataValidator
from .simulator import SublimationFrontSimulator, MoistureEstimator
from .rules import RuleEngine, RuleSeverity
from .reporter import ReportGenerator


class Context:
    """CLI上下文"""
    
    def __init__(self):
        self.batch: Optional[BatchData] = None
        self.check_results = None
        self.simulation_results = {}
        self.verbose = False


pass_context = click.make_pass_decorator(Context)


@click.group()
@click.version_option(__version__, '-v', '--version')
@click.option('--verbose', '-V', is_flag=True, help='显示详细输出')
@click.pass_context
def cli(ctx, verbose):
    """
    冻干曲线复盘器 - 生物制剂工艺科学计算CLI工具
    
    用于分析冻干工艺数据，检测工艺问题，模拟升华前沿和残余水分。
    """
    ctx.obj = Context()
    ctx.obj.verbose = verbose


@cli.command()
@click.option('--input-dir', '-i', type=click.Path(exists=True, file_okay=False),
              help='包含CSV数据文件的目录')
@click.option('--batch-id', '-b', help='批次号')
@click.option('--shelf-temp', help='搁板温度CSV文件路径')
@click.option('--product-temp', help='产品温度CSV文件路径')
@click.option('--vacuum', help='真空度CSV文件路径')
@click.option('--moisture', help='水分数据CSV文件路径')
@click.option('--recipe', help='配方数据CSV文件路径')
@click.option('--output', '-o', type=click.Path(), help='输出JSON文件路径')
@pass_context
def import_cmd(ctx, input_dir, batch_id, shelf_temp, product_temp, vacuum, moisture, recipe, output):
    """
    导入并校验多源曲线数据
    
    支持从目录自动解析或指定单个文件导入。
    """
    click.echo("📂 正在导入数据...")
    
    parser = MultiSourceCSVParser()
    
    if input_dir:
        batch = parser.parse_from_directory(Path(input_dir), batch_id)
    elif any([shelf_temp, product_temp, vacuum, moisture]):
        batch = parser.parse_from_files(
            batch_id=batch_id or "IMPORT-001",
            shelf_temp_file=Path(shelf_temp) if shelf_temp else None,
            product_temp_file=Path(product_temp) if product_temp else None,
            vacuum_file=Path(vacuum) if vacuum else None,
            moisture_file=Path(moisture) if moisture else None,
            recipe_file=Path(recipe) if recipe else None,
        )
    else:
        click.echo("❌ 请指定 --input-dir 或至少一个数据文件参数")
        raise click.Abort()
    
    if batch is None:
        click.echo("❌ 数据导入失败")
        raise click.Abort()
    
    ctx.batch = batch
    
    click.echo(f"✅ 批次 {batch.metadata.batch_id} 数据导入成功")
    
    validator = DataValidator()
    validation_result = validator.validate_batch(batch)
    
    if not validation_result.is_valid:
        click.echo(f"⚠️ 数据验证发现错误:")
        for error in validation_result.errors:
            click.echo(f"   - {error.message}")
    else:
        click.echo("✅ 数据验证通过")
    
    if ctx.verbose:
        click.echo("\n📊 数据概览:")
        if batch.shelf_temp:
            click.echo(f"   搁板温度: {len(batch.shelf_temp)} 个数据点")
        if batch.product_temp:
            click.echo(f"   产品温度: {len(batch.product_temp)} 个数据点")
        if batch.vacuum:
            click.echo(f"   腔体真空: {len(batch.vacuum)} 个数据点")
        if batch.moisture:
            click.echo(f"   水分数据: {len(batch.moisture.values)} 个样品")
    
    if output:
        output_path = Path(output)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump({
                "batch_id": batch.metadata.batch_id,
                "product_name": batch.metadata.product_name,
                "has_shelf_temp": batch.shelf_temp is not None,
                "has_product_temp": batch.product_temp is not None,
                "has_vacuum": batch.vacuum is not None,
                "has_moisture": batch.moisture is not None,
                "validation_errors": batch.validation_errors,
            }, f, ensure_ascii=False, indent=2)
        click.echo(f"\n💾 数据摘要已保存到: {output_path}")


@cli.command()
@click.option('--input-dir', '-i', type=click.Path(exists=True, file_okay=False),
              help='包含CSV数据文件的目录')
@click.option('--batch-id', '-b', help='批次号')
@click.option('--output', '-o', type=click.Path(), help='输出JSON文件路径')
@pass_context
def simulate(ctx, input_dir, batch_id, output):
    """
    估算升华前沿和残余水分
    
    基于温度数据进行升华前沿和残余水分的科学计算。
    """
    click.echo("🔬 正在执行模拟计算...")
    
    if not ctx.batch and not input_dir:
        click.echo("❌ 请先运行 import 命令或指定 --input-dir")
        raise click.Abort()
    
    if input_dir and not ctx.batch:
        parser = MultiSourceCSVParser()
        ctx.batch = parser.parse_from_directory(Path(input_dir), batch_id)
    
    if ctx.batch is None:
        click.echo("❌ 没有有效数据进行模拟")
        raise click.Abort()
    
    sublimation_simulator = SublimationFrontSimulator()
    sublimation_result = sublimation_simulator.simulate(ctx.batch)
    
    click.echo("\n❄️ 升华前沿估算结果:")
    click.echo(f"   升华速率: {sublimation_result.estimated_sublimation_rate_g_h:.2f} g/h")
    click.echo(f"   剩余冰量: {sublimation_result.estimated_remaining_ice_mass_g:.2f} g")
    click.echo(f"   升华界面位置: {sublimation_result.estimated_subline_position_mm:.2f} mm")
    click.echo(f"   一次干燥完成度: {sublimation_result.estimated_primary_drying_completion_pct:.1f} %")
    
    for warning in sublimation_result.warnings:
        click.echo(f"   ⚠️ {warning}")
    
    moisture_estimator = MoistureEstimator()
    moisture_result = moisture_estimator.estimate(ctx.batch)
    
    click.echo("\n💧 残余水分估算结果:")
    click.echo(f"   估算残余水分: {moisture_result.estimated_residual_moisture_pct:.2f} %")
    click.echo(f"   结合水比例: {moisture_result.estimated_bound_water_pct:.2f} %")
    click.echo(f"   游离水比例: {moisture_result.estimated_free_water_pct:.2f} %")
    click.echo(f"   干燥速率: {moisture_result.estimated_drying_rate_pct_h:.3f} %/h")
    
    for warning in moisture_result.warnings:
        click.echo(f"   ⚠️ {warning}")
    
    ctx.simulation_results = {
        "sublimation": sublimation_result,
        "moisture": moisture_result
    }
    
    if output:
        output_path = Path(output)
        result_dict = {
            "sublimation": sublimation_result.to_dict(),
            "moisture": moisture_result.to_dict(),
        }
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result_dict, f, ensure_ascii=False, indent=2)
        click.echo(f"\n💾 模拟结果已保存到: {output_path}")


@cli.command()
@click.option('--input-dir', '-i', type=click.Path(exists=True, file_okay=False),
              help='包含CSV数据文件的目录')
@click.option('--batch-id', '-b', help='批次号')
@click.option('--collapse-temp', type=float, help='塌陷温度 (°C)')
@click.option('--output', '-o', type=click.Path(), help='输出JSON文件路径')
@pass_context
def check(ctx, input_dir, batch_id, collapse_temp, output):
    """
    检查工艺规则问题
    
    检测真空波动、温度越界、平台期不足、传感器漂移、过早升温等问题。
    """
    click.echo("🔍 正在执行工艺规则检查...")
    
    if not ctx.batch and not input_dir:
        click.echo("❌ 请先运行 import 命令或指定 --input-dir")
        raise click.Abort()
    
    if input_dir and not ctx.batch:
        parser = MultiSourceCSVParser()
        ctx.batch = parser.parse_from_directory(Path(input_dir), batch_id)
    
    if ctx.batch is None:
        click.echo("❌ 没有有效数据进行检查")
        raise click.Abort()
    
    rule_engine = RuleEngine(
        collapse_temp_c=collapse_temp
    )
    
    check_results = rule_engine.run_all_checks(ctx.batch)
    ctx.check_results = check_results
    
    summary = rule_engine.generate_summary(check_results)
    
    click.echo(f"\n📋 检查结果摘要:")
    click.echo(f"   总检查项: {summary['total_checks']}")
    click.echo(f"   通过: {summary['passed']}")
    click.echo(f"   未通过: {summary['failed']}")
    click.echo(f"   严重问题: {summary['critical_issues']}")
    click.echo(f"   警告: {summary['warnings']}")
    click.echo(f"   整体状态: {summary['overall_status']}")
    
    critical_issues = rule_engine.get_critical_issues(check_results)
    if critical_issues:
        click.echo("\n🚨 严重问题:")
        for issue in critical_issues:
            click.echo(f"\n   ❌ {issue.rule_name}:")
            click.echo(f"      {issue.message}")
            if issue.occurrences:
                for occ in issue.occurrences[:3]:
                    click.echo(f"      - {occ.get('message', '检测到异常')}")
                if len(issue.occurrences) > 3:
                    click.echo(f"      - ... 共 {len(issue.occurrences)} 处")
    
    if summary['recommendations']:
        click.echo("\n💡 建议措施:")
        for rec in summary['recommendations']:
            click.echo(f"   - {rec}")
    
    if output:
        output_path = Path(output)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        click.echo(f"\n💾 检查结果已保存到: {output_path}")


@cli.command()
@click.argument('batch1_dir', type=click.Path(exists=True, file_okay=False))
@click.argument('batch2_dir', type=click.Path(exists=True, file_okay=False))
@click.option('--output', '-o', type=click.Path(), help='输出JSON文件路径')
@pass_context
def compare(ctx, batch1_dir, batch2_dir, output):
    """
    对比两批工艺数据
    
    参数:
        batch1_dir: 第一批数据目录
        batch2_dir: 第二批数据目录
    """
    click.echo("📊 正在对比两批工艺数据...")
    
    parser = MultiSourceCSVParser()
    
    batch1 = parser.parse_from_directory(Path(batch1_dir))
    batch2 = parser.parse_from_directory(Path(batch2_dir))
    
    if batch1 is None or batch2 is None:
        click.echo("❌ 数据解析失败")
        raise click.Abort()
    
    comparison = _compare_batches(batch1, batch2)
    
    click.echo(f"\n📋 批次对比结果:")
    click.echo(f"\n   批次1: {batch1.metadata.batch_id}")
    click.echo(f"   批次2: {batch2.metadata.batch_id}")
    
    click.echo("\n📈 关键参数对比:")
    for key, value in comparison['summary'].items():
        if isinstance(value, dict):
            click.echo(f"\n   {key}:")
            click.echo(f"      批次1: {value.get('batch1', 'N/A')}")
            click.echo(f"      批次2: {value.get('batch2', 'N/A')}")
            diff = value.get('diff')
            if diff is not None:
                click.echo(f"      差异: {diff}")
    
    if comparison['differences']:
        click.echo("\n⚠️ 检测到的差异:")
        for diff in comparison['differences']:
            click.echo(f"   - {diff}")
    
    if output:
        output_path = Path(output)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(comparison, f, ensure_ascii=False, indent=2, default=str)
        click.echo(f"\n💾 对比结果已保存到: {output_path}")


@cli.command()
@click.option('--input-dir', '-i', type=click.Path(exists=True, file_okay=False),
              help='包含CSV数据文件的目录')
@click.option('--batch-id', '-b', help='批次号')
@click.option('--format', '-f', type=click.Choice(['markdown', 'csv', 'json', 'all']),
              default='markdown', help='输出格式')
@click.option('--output', '-o', type=click.Path(), required=True, help='输出文件路径（不含扩展名）')
@click.option('--include-simulate', is_flag=True, help='包含模拟计算结果')
@click.option('--include-check', is_flag=True, help='包含规则检查结果')
@pass_context
def report(ctx, input_dir, batch_id, format, output, include_simulate, include_check):
    """
    导出分析报告
    
    支持 Markdown、CSV、JSON 三种格式。
    """
    click.echo("📄 正在生成报告...")
    
    if not ctx.batch and not input_dir:
        click.echo("❌ 请先运行 import 命令或指定 --input-dir")
        raise click.Abort()
    
    if input_dir and not ctx.batch:
        parser = MultiSourceCSVParser()
        ctx.batch = parser.parse_from_directory(Path(input_dir), batch_id)
    
    if ctx.batch is None:
        click.echo("❌ 没有有效数据生成报告")
        raise click.Abort()
    
    if include_simulate and not ctx.simulation_results:
        sublimation_simulator = SublimationFrontSimulator()
        moisture_estimator = MoistureEstimator()
        
        sub_result = sublimation_simulator.simulate(ctx.batch)
        moist_result = moisture_estimator.estimate(ctx.batch)
        
        ctx.simulation_results = {
            "sublimation": sub_result.to_dict() if hasattr(sub_result, 'to_dict') else sub_result,
            "moisture": moist_result.to_dict() if hasattr(moist_result, 'to_dict') else moist_result
        }
    
    if include_check and not ctx.check_results:
        rule_engine = RuleEngine()
        ctx.check_results = rule_engine.run_all_checks(ctx.batch)
    
    report_gen = ReportGenerator(ctx.batch)
    
    if ctx.check_results:
        report_gen.set_check_results(ctx.check_results)
    
    if ctx.simulation_results:
        for key, value in ctx.simulation_results.items():
            report_gen.set_simulation_results(key, value)
    
    output_base = Path(output)
    
    if format in ['markdown', 'all']:
        md_path = output_base.with_suffix('.md')
        report_gen.save_markdown(md_path)
        click.echo(f"   ✅ Markdown报告: {md_path}")
    
    if format in ['csv', 'all']:
        csv_path = output_base.with_suffix('.csv')
        report_gen.save_csv(csv_path)
        click.echo(f"   ✅ CSV报告: {csv_path}")
    
    if format in ['json', 'all']:
        json_path = output_base.with_suffix('.json')
        report_gen.save_json(json_path)
        click.echo(f"   ✅ JSON报告: {json_path}")
    
    click.echo(f"\n📊 报告生成完成!")


def _compare_batches(batch1: BatchData, batch2: BatchData) -> dict:
    """对比两批数据"""
    comparison = {
        "batch1": {
            "batch_id": batch1.metadata.batch_id,
            "product_name": batch1.metadata.product_name,
        },
        "batch2": {
            "batch_id": batch2.metadata.batch_id,
            "product_name": batch2.metadata.product_name,
        },
        "summary": {},
        "differences": [],
    }
    
    if batch1.shelf_temp and batch2.shelf_temp:
        stats1 = batch1.shelf_temp.get_stats()
        stats2 = batch2.shelf_temp.get_stats()
        
        comparison["summary"]["搁板温度均值"] = {
            "batch1": f"{stats1.get('mean', 0):.2f} °C",
            "batch2": f"{stats2.get('mean', 0):.2f} °C",
            "diff": f"{stats1.get('mean', 0) - stats2.get('mean', 0):.2f} °C",
        }
    
    if batch1.product_temp and batch2.product_temp:
        stats1 = batch1.product_temp.get_stats()
        stats2 = batch2.product_temp.get_stats()
        
        comparison["summary"]["产品温度均值"] = {
            "batch1": f"{stats1.get('mean', 0):.2f} °C",
            "batch2": f"{stats2.get('mean', 0):.2f} °C",
            "diff": f"{stats1.get('mean', 0) - stats2.get('mean', 0):.2f} °C",
        }
    
    if batch1.vacuum and batch2.vacuum:
        stats1 = batch1.vacuum.get_stats()
        stats2 = batch2.vacuum.get_stats()
        
        comparison["summary"]["真空度均值"] = {
            "batch1": f"{stats1.get('mean', 0):.2f} mTorr",
            "batch2": f"{stats2.get('mean', 0):.2f} mTorr",
            "diff": f"{stats1.get('mean', 0) - stats2.get('mean', 0):.2f} mTorr",
        }
    
    if batch1.recipe and batch2.recipe:
        if batch1.recipe.collapse_temp_c != batch2.recipe.collapse_temp_c:
            comparison["differences"].append(
                f"塌陷温度不同: 批次1={batch1.recipe.collapse_temp_c}°C, 批次2={batch2.recipe.collapse_temp_c}°C"
            )
    
    return comparison


def main():
    """CLI入口函数"""
    cli(obj=Context())


if __name__ == '__main__':
    main()
