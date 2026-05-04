"""CLI 入口 - 命令行交互界面"""
import click
from pathlib import Path
from datetime import date, datetime
from typing import Optional, List

from .parser import DataParser
from .validator import DataValidator
from .simulator import Simulator, SimulationStrategy
from .strategy import StrategyComparator
from .exporter import ReportExporter
from .models import DataBundle


CONTEXT_SETTINGS = dict(help_option_names=['-h', '--help'])


@click.group(context_settings=CONTEXT_SETTINGS)
@click.version_option(version='0.1.0', prog_name='hydroponic-cli')
def main():
    """
    水培营养液调配 CLI 工具
    
    用于管理水培系统的营养液调配，支持：
    - 数据校验
    - 操作模拟
    - 策略比较
    - 报告导出
    """
    pass


def load_data(
    reservoirs_path: Optional[str],
    crops_path: Optional[str],
    recipes_path: Optional[str],
    readings_path: Optional[str],
    inventory_path: Optional[str],
    data_dir: Optional[str] = None
) -> DataBundle:
    """加载数据文件"""
    parser = DataParser()
    
    if data_dir:
        base_path = Path(data_dir)
        reservoirs_path = str(base_path / "reservoirs.json") if reservoirs_path is None else reservoirs_path
        crops_path = str(base_path / "crops.csv") if crops_path is None else crops_path
        recipes_path = str(base_path / "recipes.json") if recipes_path is None else recipes_path
        readings_path = str(base_path / "readings.csv") if readings_path is None else readings_path
        inventory_path = str(base_path / "inventory.json") if inventory_path is None else inventory_path
    
    data = parser.parse_all(
        reservoirs_path=reservoirs_path,
        crops_path=crops_path,
        recipes_path=recipes_path,
        readings_path=readings_path,
        inventory_path=inventory_path
    )
    
    if parser.errors:
        for error in parser.errors:
            click.echo(f"⚠️ 解析错误: {error}", err=True)
    
    if parser.warnings:
        for warning in parser.warnings:
            click.echo(f"💡 解析警告: {warning}")
    
    return data


def validate_data(data: DataBundle) -> bool:
    """校验数据并显示结果"""
    validator = DataValidator()
    result = validator.validate_all(data)
    data.validation_result = result
    
    if result.errors:
        click.echo(f"\n❌ 发现 {len(result.errors)} 个错误:")
        for i, error in enumerate(result.errors, 1):
            source = f" [{error.source_file}]" if error.source_file else ""
            row = f" (第 {error.row_index} 行)" if error.row_index else ""
            click.echo(f"  {i}. [{error.field}]: {error.message}{source}{row}")
    
    if result.warnings:
        click.echo(f"\n⚠️ 发现 {len(result.warnings)} 个警告:")
        for i, warning in enumerate(result.warnings, 1):
            source = f" [{warning.source_file}]" if warning.source_file else ""
            row = f" (第 {warning.row_index} 行)" if warning.row_index else ""
            click.echo(f"  {i}. [{warning.field}]: {warning.message}{source}{row}")
    
    if result.info:
        click.echo(f"\nℹ️ 其他信息:")
        for info in result.info:
            click.echo(f"  - {info}")
    
    if result.valid:
        click.echo("\n✅ 数据校验通过！")
    else:
        click.echo(f"\n❌ 数据校验失败，共 {len(result.errors)} 个错误")
    
    return result.valid


@main.command('validate')
@click.option('--reservoirs', '-r', type=click.Path(exists=False), help='reservoirs.json 路径')
@click.option('--crops', '-c', type=click.Path(exists=False), help='crops.csv 路径')
@click.option('--recipes', '-p', type=click.Path(exists=False), help='recipes.json 路径')
@click.option('--readings', '-d', type=click.Path(exists=False), help='readings.csv 路径')
@click.option('--inventory', '-i', type=click.Path(exists=False), help='inventory.json 路径')
@click.option('--data-dir', '-D', type=click.Path(exists=True, file_okay=False), help='数据目录（自动查找各数据文件）')
def validate_cmd(reservoirs, crops, recipes, readings, inventory, data_dir):
    """
    校验数据文件
    
    检查数据文件的完整性、字段有效性、单位是否正确等。
    """
    click.echo("=" * 60)
    click.echo("水培营养液调配工具 - 数据校验")
    click.echo("=" * 60)
    
    data = load_data(reservoirs, crops, recipes, readings, inventory, data_dir)
    
    click.echo(f"\n📊 数据统计:")
    click.echo(f"  储液桶数量: {len(data.reservoirs)}")
    click.echo(f"  作物种类: {len(data.crops)}")
    click.echo(f"  配方数量: {len(data.recipes)}")
    click.echo(f"  读数记录: {len(data.readings)}")
    click.echo(f"  库存项数: {len(data.inventory)}")
    
    validate_data(data)


@main.command('simulate')
@click.option('--reservoir', '-R', required=True, help='储液桶 ID')
@click.option('--days', '-n', default=7, type=int, help='模拟天数 (默认: 7)')
@click.option('--crop', '-c', help='作物 ID')
@click.option('--stage', '-s', help='作物阶段 (seedling/vegetative/flowering/fruiting)')
@click.option('--recipe', '-p', help='配方 ID')
@click.option('--strategy', '-S', type=click.Choice(['stable', 'save']), default='stable',
              help='策略: stable (稳 EC) 或 save (省营养液)')
@click.option('--reservoirs', type=click.Path(exists=False), help='reservoirs.json 路径')
@click.option('--crops', type=click.Path(exists=False), help='crops.csv 路径')
@click.option('--recipes', type=click.Path(exists=False), help='recipes.json 路径')
@click.option('--readings', type=click.Path(exists=False), help='readings.csv 路径')
@click.option('--inventory', type=click.Path(exists=False), help='inventory.json 路径')
@click.option('--data-dir', '-D', type=click.Path(exists=True, file_okay=False), help='数据目录')
@click.option('--detail', '-d', is_flag=True, help='显示详细每日操作')
def simulate_cmd(reservoir, days, crop, stage, recipe, strategy,
                  reservoirs, crops, recipes, readings, inventory, data_dir, detail):
    """
    模拟营养液调配方案
    
    根据当前状态和目标参数，生成未来几天的补水、加液、调 pH 方案。
    """
    click.echo("=" * 60)
    click.echo("水培营养液调配工具 - 模拟计算")
    click.echo("=" * 60)
    
    data = load_data(reservoirs, crops, recipes, readings, inventory, data_dir)
    
    if not validate_data(data):
        if not click.confirm("\n数据存在错误，是否继续？", default=False):
            return
    
    strategy_map = {
        'stable': SimulationStrategy.STABLE_EC,
        'save': SimulationStrategy.SAVE_NUTRIENT
    }
    strategy_id = strategy_map.get(strategy, SimulationStrategy.STABLE_EC)
    
    strategy_name = "稳 EC 策略" if strategy == 'stable' else "省营养液策略"
    click.echo(f"\n📋 模拟参数:")
    click.echo(f"  储液桶: {reservoir}")
    click.echo(f"  模拟天数: {days}")
    click.echo(f"  策略: {strategy_name}")
    if crop:
        click.echo(f"  作物: {crop}")
    if stage:
        click.echo(f"  阶段: {stage}")
    if recipe:
        click.echo(f"  配方: {recipe}")
    
    simulator = Simulator(data, strategy=strategy_id)
    result = simulator.simulate_reservoir(
        reservoir_id=reservoir,
        days=days,
        crop_id=crop,
        crop_stage=stage,
        recipe_id=recipe
    )
    
    if result.errors:
        click.echo(f"\n❌ 模拟错误:")
        for error in result.errors:
            click.echo(f"  - {error}")
        return
    
    if result.warnings:
        click.echo(f"\n⚠️ 模拟警告:")
        for warning in result.warnings:
            click.echo(f"  - {warning}")
    
    summary = result.summary
    click.echo(f"\n📊 模拟摘要 ({result.start_date} - {result.end_date}):")
    click.echo(f"\n  资源消耗:")
    click.echo(f"    补水总量: {summary.total_water_added_liters:.2f} L")
    click.echo(f"    A 液总量: {summary.total_a_added_ml:.1f} mL")
    click.echo(f"    B 液总量: {summary.total_b_added_ml:.1f} mL")
    click.echo(f"    酸液总量: {summary.total_acid_added_ml:.1f} mL")
    click.echo(f"    碱液总量: {summary.total_base_added_ml:.1f} mL")
    click.echo(f"    排液总量: {summary.total_drained_liters:.2f} L")
    
    click.echo(f"\n  状态变化:")
    click.echo(f"    平均 EC: {summary.average_ec:.3f} mS/cm")
    click.echo(f"    平均 pH: {summary.average_ph:.2f}")
    click.echo(f"    最终 EC: {summary.end_ec:.3f} mS/cm")
    click.echo(f"    最终 pH: {summary.end_ph:.2f}")
    click.echo(f"    最终体积: {summary.end_volume:.2f} L")
    
    click.echo(f"\n  风险指标:")
    click.echo(f"    需要换液次数: {summary.full_changes_required}")
    click.echo(f"    EC 超出范围天数: {summary.ec_out_of_range_days}")
    click.echo(f"    pH 超出范围天数: {summary.ph_out_of_range_days}")
    
    if detail:
        click.echo(f"\n📅 每日操作详情:")
        click.echo("-" * 80)
        for action in result.daily_actions:
            click.echo(f"\n第 {action.day} 天 ({action.date}):")
            click.echo(f"  操作: {', '.join(action.actions)}")
            click.echo(f"  补水: {action.add_water_liters:.2f} L | "
                       f"A液: {action.add_a_ml:.1f} mL | B液: {action.add_b_ml:.1f} mL")
            if action.add_acid_ml > 0 or action.add_base_ml > 0:
                click.echo(f"  酸液: {action.add_acid_ml:.1f} mL | 碱液: {action.add_base_ml:.1f} mL")
            if action.drain_liters > 0:
                click.echo(f"  排液: {action.drain_liters:.2f} L")
            if action.expected_ec is not None:
                click.echo(f"  预计 EC: {action.expected_ec:.3f} mS/cm | 预计 pH: {action.expected_ph:.2f}")
            
            if action.notes:
                click.echo(f"  说明:")
                for note in action.notes:
                    click.echo(f"    - {note}")
            if action.warnings:
                click.echo(f"  警告:")
                for warning in action.warnings:
                    click.echo(f"    ⚠️ {warning}")


@main.command('compare')
@click.option('--reservoir', '-R', required=True, help='储液桶 ID')
@click.option('--days', '-n', default=7, type=int, help='模拟天数 (默认: 7)')
@click.option('--crop', '-c', help='作物 ID')
@click.option('--stage', '-s', help='作物阶段')
@click.option('--recipe', '-p', help='配方 ID')
@click.option('--reservoirs', type=click.Path(exists=False), help='reservoirs.json 路径')
@click.option('--crops', type=click.Path(exists=False), help='crops.csv 路径')
@click.option('--recipes', type=click.Path(exists=False), help='recipes.json 路径')
@click.option('--readings', type=click.Path(exists=False), help='readings.csv 路径')
@click.option('--inventory', type=click.Path(exists=False), help='inventory.json 路径')
@click.option('--data-dir', '-D', type=click.Path(exists=True, file_okay=False), help='数据目录')
def compare_cmd(reservoir, days, crop, stage, recipe,
                 reservoirs, crops, recipes, readings, inventory, data_dir):
    """
    比较不同策略
    
    对比"稳 EC"和"省营养液"两种策略的成本和风险。
    """
    click.echo("=" * 60)
    click.echo("水培营养液调配工具 - 策略比较")
    click.echo("=" * 60)
    
    data = load_data(reservoirs, crops, recipes, readings, inventory, data_dir)
    
    if not validate_data(data):
        if not click.confirm("\n数据存在错误，是否继续？", default=False):
            return
    
    comparator = StrategyComparator(data)
    
    click.echo(f"\n📋 比较参数:")
    click.echo(f"  储液桶: {reservoir}")
    click.echo(f"  模拟天数: {days}")
    
    comparisons = comparator.compare_strategies(
        reservoir_id=reservoir,
        days=days,
        crop_id=crop,
        crop_stage=stage,
        recipe_id=recipe
    )
    
    summary = comparator.get_comparison_summary(comparisons)
    
    stable = comparisons.get(SimulationStrategy.STABLE_EC)
    save = comparisons.get(SimulationStrategy.SAVE_NUTRIENT)
    
    click.echo(f"\n📊 策略对比:")
    click.echo("-" * 60)
    click.echo(f"{'指标':<15} | {'稳 EC 策略':<15} | {'省营养液策略':<15}")
    click.echo("-" * 60)
    
    if stable and save:
        click.echo(f"{'补水总量':<15} | {stable.total_water_liters:>12.2f} L | {save.total_water_liters:>12.2f} L")
        click.echo(f"{'营养液总量':<15} | {stable.total_nutrient_ml:>12.1f} mL | {save.total_nutrient_ml:>12.1f} mL")
        click.echo(f"{'酸/碱总量':<15} | {stable.total_acid_base_ml:>12.1f} mL | {save.total_acid_base_ml:>12.1f} mL")
        click.echo(f"{'换液次数':<15} | {stable.full_changes:>12d} | {save.full_changes:>12d}")
        click.echo(f"{'估算成本':<15} | ¥{stable.estimated_cost:>12.2f} | ¥{save.estimated_cost:>12.2f}")
        click.echo(f"{'风险评分':<15} | {str(stable.risk_score) + '/10':>12} | {str(save.risk_score) + '/10':>12}")
        click.echo("-" * 60)
        
        for strategy_id, comp in comparisons.items():
            name = "稳 EC 策略" if strategy_id == SimulationStrategy.STABLE_EC else "省营养液策略"
            click.echo(f"\n📌 {name}:")
            click.echo(f"  描述: {comp.description}")
            click.echo(f"\n  优势:")
            for benefit in comp.key_benefits:
                click.echo(f"    ✅ {benefit}")
            click.echo(f"\n  风险:")
            for risk in comp.key_risks:
                click.echo(f"    ⚠️ {risk}")
    
    if summary.get("recommendation"):
        click.echo(f"\n💡 建议: {summary['recommendation']}")


@main.command('export')
@click.option('--output', '-o', required=True, help='输出文件路径')
@click.option('--format', '-f', type=click.Choice(['markdown', 'html', 'json']), default='markdown',
              help='输出格式 (默认: markdown)')
@click.option('--reservoir', '-R', help='储液桶 ID（用于模拟和比较）')
@click.option('--days', '-n', default=7, type=int, help='模拟天数 (默认: 7)')
@click.option('--crop', '-c', help='作物 ID')
@click.option('--stage', '-s', help='作物阶段')
@click.option('--recipe', '-p', help='配方 ID')
@click.option('--compare', '-C', is_flag=True, help='包含策略比较')
@click.option('--reservoirs', type=click.Path(exists=False), help='reservoirs.json 路径')
@click.option('--crops', type=click.Path(exists=False), help='crops.csv 路径')
@click.option('--recipes', type=click.Path(exists=False), help='recipes.json 路径')
@click.option('--readings', type=click.Path(exists=False), help='readings.csv 路径')
@click.option('--inventory', type=click.Path(exists=False), help='inventory.json 路径')
@click.option('--data-dir', '-D', type=click.Path(exists=True, file_okay=False), help='数据目录')
@click.option('--title', '-t', default='水培营养液调配报告', help='报告标题')
def export_cmd(output, format, reservoir, days, crop, stage, recipe, compare,
                reservoirs, crops, recipes, readings, inventory, data_dir, title):
    """
    导出报告
    
    生成 Markdown、HTML 或 JSON 格式的报告，包含校验结果、模拟方案、策略比较。
    """
    click.echo("=" * 60)
    click.echo("水培营养液调配工具 - 报告导出")
    click.echo("=" * 60)
    
    data = load_data(reservoirs, crops, recipes, readings, inventory, data_dir)
    
    validate_data(data)
    
    exporter = ReportExporter(data)
    
    sim_result = None
    comparisons = None
    comp_summary = None
    
    if reservoir:
        click.echo(f"\n📊 执行模拟...")
        simulator = Simulator(data)
        sim_result = simulator.simulate_reservoir(
            reservoir_id=reservoir,
            days=days,
            crop_id=crop,
            crop_stage=stage,
            recipe_id=recipe
        )
        
        if compare:
            click.echo(f"📊 执行策略比较...")
            comparator = StrategyComparator(data)
            comparisons = comparator.compare_strategies(
                reservoir_id=reservoir,
                days=days,
                crop_id=crop,
                crop_stage=stage,
                recipe_id=recipe
            )
            comp_summary = comparator.get_comparison_summary(comparisons)
    
    click.echo(f"\n📝 生成报告...")
    
    if format == 'json':
        export_data = {
            'title': title,
            'generated_at': datetime.now().isoformat(),
            'validation': data.validation_result,
            'simulation': sim_result,
            'comparisons': comparisons,
            'comparison_summary': comp_summary
        }
        exporter.export_json(export_data, output)
    elif format == 'html':
        html_content = exporter.export_html(
            simulation_result=sim_result,
            strategy_comparisons=comparisons,
            validation_result=data.validation_result,
            comparison_summary=comp_summary,
            title=title
        )
        with open(output, 'w', encoding='utf-8') as f:
            f.write(html_content)
    else:
        md_content = exporter.export_markdown(
            simulation_result=sim_result,
            strategy_comparisons=comparisons,
            validation_result=data.validation_result,
            comparison_summary=comp_summary,
            title=title
        )
        with open(output, 'w', encoding='utf-8') as f:
            f.write(md_content)
    
    click.echo(f"\n✅ 报告已导出: {output}")
    click.echo(f"   格式: {format}")


if __name__ == '__main__':
    main()
