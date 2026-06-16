#!/usr/bin/env python3
"""演出票价动态分层 - 命令行工具"""
import click
import os
import sys

from ticket_pricing.config import Config
from ticket_pricing.calculator import TicketPricingCalculator
from ticket_pricing.models import RecordManager, PricingRecord
from ticket_pricing.io_handler import IOHandler


@click.group()
@click.version_option(version="1.0.0", prog_name="ticket-pricing")
def cli():
    """演出票价动态分层系统"""
    pass


@cli.command()
@click.option('--production-cost', '-pc', type=float, required=True, help='制作成本')
@click.option('--production-cost-unit', '-pcu', default='CNY', help='制作成本单位 (默认: CNY)')
@click.option('--expected-attendance', '-ea', type=float, required=True, help='预期观众人数')
@click.option('--attendance-unit', '-au', default='person', help='人数单位 (默认: person)')
@click.option('--profit-margin', '-pm', type=float, required=True, help='利润率 (0-1)')
@click.option('--days-to-show', '-d', type=int, required=True, help='距离演出天数')
@click.option('--ticket-sold-rate', '-tsr', type=float, required=True, help='售票率 (0-1)')
@click.option('--weekend-factor', '-wf', type=int, default=0, help='周末因素 (0或1)')
@click.option('--verbose', '-v', is_flag=True, help='显示详细计算过程')
def calculate(production_cost, production_cost_unit, expected_attendance, attendance_unit,
              profit_margin, days_to_show, ticket_sold_rate, weekend_factor, verbose):
    """单条记录票价计算"""
    config = Config()
    calculator = TicketPricingCalculator(config)
    
    click.echo("\n" + "="*60)
    click.echo("演出票价动态分层 - 单条计算")
    click.echo("="*60)
    
    click.echo(f"\n输入参数:")
    click.echo(f"  制作成本: {production_cost} {production_cost_unit}")
    click.echo(f"  预期观众: {expected_attendance} {attendance_unit}")
    click.echo(f"  利润率: {profit_margin*100:.1f}%")
    click.echo(f"  距演出天数: {days_to_show} 天")
    click.echo(f"  售票率: {ticket_sold_rate*100:.1f}%")
    click.echo(f"  周末场: {'是' if weekend_factor else '否'}")
    
    result = calculator.calculate(
        production_cost=production_cost,
        production_cost_unit=production_cost_unit,
        expected_attendance=expected_attendance,
        attendance_unit=attendance_unit,
        profit_margin=profit_margin,
        days_to_show=days_to_show,
        ticket_sold_rate=ticket_sold_rate,
        weekend_factor=weekend_factor
    )
    
    explanation = calculator.explain_result(result)
    
    click.echo(f"\n计算结果:")
    click.echo(f"  状态: {'成功' if result.success else '失败'}")
    
    if result.success:
        click.echo(f"  基础票价: ¥{result.base_price}")
        click.echo(f"  动态倍率: {result.dynamic_multiplier}x")
        click.echo(f"  最终票价: ¥{result.final_price}")
        click.secho(f"  票价分层: {result.tier}", fg='green', bold=True)
    else:
        click.secho(f"  错误: {result.error_message}", fg='red')
    
    if verbose:
        click.echo(f"\n计算详情:")
        for detail in explanation["formula_details"]:
            click.echo(f"\n  [{detail['name']}] (来源: {detail['source']})")
            click.echo(f"    公式: {detail['expression']}")
            click.echo(f"    输入: {detail['inputs']}")
            click.echo(f"    结果: {detail['result']}")
    
    if explanation["boundary_checks"]:
        click.echo(f"\n边界检查:")
        for check in explanation["boundary_checks"]:
            color = 'yellow' if check['level'] == '警告' else 'red'
            click.secho(f"  [{check['level']}] {check['message']}", fg=color)
    
    if explanation["conflicts"]:
        click.echo(f"\n与课堂讲义冲突:")
        for conflict in explanation["conflicts"]:
            click.echo(f"\n  项目: {conflict['item']}")
            click.secho(f"  讲义说法: {conflict['lecture_says']}", fg='blue')
            click.secho(f"  数据情况: {conflict['data_says']}", fg='magenta')
            click.echo(f"  建议: {conflict['suggestion']}")
    
    if result.success and explanation["tier_explanation"]:
        click.echo(f"\n分层判定: {explanation['tier_explanation']}")
    
    click.echo("\n" + "="*60 + "\n")


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), help='输出文件路径')
@click.option('--abnormal-output', '-ao', type=click.Path(), help='异常清单输出路径')
@click.option('--format', '-f', type=click.Choice(['csv', 'xlsx']), default='csv', help='输出格式')
@click.option('--source-name', '-sn', help='数据源名称')
def batch(input_file, output, abnormal_output, format, source_name):
    """批量处理票价数据"""
    config = Config()
    calculator = TicketPricingCalculator(config)
    manager = RecordManager()
    io_handler = IOHandler(manager)
    
    click.echo("\n" + "="*60)
    click.echo("演出票价动态分层 - 批量处理")
    click.echo("="*60)
    
    ext = os.path.splitext(input_file)[1].lower()
    
    click.echo(f"\n导入数据: {input_file}")
    
    if ext == '.csv':
        result = io_handler.import_from_csv(input_file, source_name)
    elif ext in ['.xlsx', '.xls']:
        result = io_handler.import_from_excel(input_file, source_name)
    else:
        click.secho(f"不支持的文件格式: {ext}", fg='red')
        sys.exit(1)
    
    click.echo(f"  成功导入: {result['success']} 条")
    if result['failed'] > 0:
        click.secho(f"  导入失败: {result['failed']} 条", fg='yellow')
        for err in result['errors']:
            click.secho(f"    - {err}", fg='yellow')
    
    click.echo(f"\n开始批量计算...")
    manager.batch_process(calculator)
    
    stats = manager.get_statistics()
    
    click.echo(f"\n处理统计:")
    click.echo(f"  总记录数: {stats['total_records']}")
    click.secho(f"  成功: {stats['success_count']} 条", fg='green')
    click.secho(f"  失败: {stats['failed_count']} 条", fg='red')
    click.echo(f"  待审核: {stats['needs_review_count']} 条")
    click.echo(f"  成功率: {stats['success_rate']:.1f}%")
    
    if stats['tiers_distribution']:
        click.echo(f"\n分层分布:")
        for tier, count in sorted(stats['tiers_distribution'].items()):
            click.echo(f"  {tier}: {count} 条")
    
    if output:
        output_path = output
        if not os.path.splitext(output_path)[1]:
            output_path = f"{output_path}.{format}"
        
        if format == 'xlsx' or output_path.endswith('.xlsx'):
            export_result = io_handler.export_to_excel(output_path)
        else:
            export_result = io_handler.export_to_csv(output_path)
        
        click.echo(f"\n结果已导出: {export_result['filepath']}")
    
    if abnormal_output:
        ao_path = abnormal_output
        if not os.path.splitext(ao_path)[1]:
            ao_path = f"{ao_path}.{format}"
        
        abnormal_result = io_handler.export_abnormal_list(ao_path)
        click.echo(f"异常清单已导出: {abnormal_result['filepath']}")
    
    if stats['failed_count'] > 0 or stats['needs_review_count'] > 0:
        click.echo(f"\n异常详情:")
        for record in manager.records:
            if record.process_status != 'success' or record.needs_review:
                status_color = 'red' if record.process_status == 'failed' else 'yellow'
                click.echo(f"\n  记录ID: {record.record_id}")
                click.secho(f"  状态: {record.process_status}", fg=status_color)
                if record.failure_reason:
                    click.echo(f"  失败原因: {record.failure_reason}")
                if record.needs_review:
                    click.echo(f"  审核备注: {record.review_notes}")
                if record.calculation_result:
                    if record.calculation_result.warnings:
                        for w in record.calculation_result.warnings:
                            click.secho(f"  警告: {w.message}", fg='yellow')
                    if record.calculation_result.conflicts:
                        for c in record.calculation_result.conflicts:
                            click.secho(f"  冲突: {c.item} - {c.suggestion}", fg='magenta')
    
    click.echo("\n" + "="*60 + "\n")


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), required=True, help='异常清单输出路径')
@click.option('--format', '-f', type=click.Choice(['csv', 'xlsx']), default='csv', help='输出格式')
def export_abnormal(input_file, output, format):
    """仅导出异常清单"""
    config = Config()
    calculator = TicketPricingCalculator(config)
    manager = RecordManager()
    io_handler = IOHandler(manager)
    
    click.echo("\n" + "="*60)
    click.echo("演出票价动态分层 - 导出异常清单")
    click.echo("="*60)
    
    ext = os.path.splitext(input_file)[1].lower()
    if ext == '.csv':
        io_handler.import_from_csv(input_file)
    elif ext in ['.xlsx', '.xls']:
        io_handler.import_from_excel(input_file)
    
    manager.batch_process(calculator)
    
    ao_path = output
    if not os.path.splitext(ao_path)[1]:
        ao_path = f"{ao_path}.{format}"
    
    result = io_handler.export_abnormal_list(ao_path)
    
    click.echo(f"\n导出结果:")
    click.echo(f"  异常记录数: {result['exported']}")
    if isinstance(result.get('abnormal_types'), dict):
        click.echo(f"  - 计算失败: {result['abnormal_types']['failed']} 条")
        click.echo(f"  - 需人工审核: {result['abnormal_types']['needs_review']} 条")
    click.echo(f"  输出文件: {result['filepath']}")
    
    click.echo("\n" + "="*60 + "\n")


@cli.command()
def show_formulas():
    """显示计算公式和边界值"""
    config = Config()
    
    click.echo("\n" + "="*60)
    click.echo("演出票价动态分层 - 公式与配置")
    click.echo("="*60)
    
    click.echo("\n【计算公式】")
    for key, formula in config.formulas.items():
        click.echo(f"\n{formula.name}:")
        click.echo(f"  来源: {formula.source}")
        click.echo(f"  说明: {formula.description}")
        click.echo(f"  公式: {formula.expression}")
        click.echo(f"  变量: {', '.join(formula.variables)}")
    
    click.echo("\n【边界值规则】")
    for rule in config.boundaries:
        severity = '错误' if rule.severity == 'error' else '警告'
        color = 'red' if rule.severity == 'error' else 'yellow'
        range_str = ""
        if rule.min_value is not None:
            range_str += f" >= {rule.min_value}"
        if rule.max_value is not None:
            range_str += f" <= {rule.max_value}"
        click.secho(f"  {rule.variable}: {range_str} {rule.unit} [{severity}]", fg=color)
    
    color_map = {
        "4CAF50": "green",
        "2196F3": "blue",
        "FF9800": "yellow",
        "9C27B0": "magenta",
        "F44336": "red",
    }
    click.echo("\n【票价分层】")
    for tier in config.tiers:
        if tier.max_price == float('inf'):
            range_str = f">= ¥{tier.min_price}"
        else:
            range_str = f"¥{tier.min_price} ~ ¥{tier.max_price}"
        color_key = tier.color[1:]
        fg_color = color_map.get(color_key, "white")
        click.secho(f"  {tier.tier}: {range_str}", fg=fg_color)
    
    click.echo("\n【课堂讲义要点】")
    for key, note in config.lecture_notes.items():
        click.echo(f"  - {note}")
    
    click.echo("\n【支持单位】")
    for key, unit in config.units.items():
        click.echo(f"  {unit.symbol} {unit.name} ({key})")
    
    click.echo("\n" + "="*60 + "\n")


@cli.command()
@click.option('--output-dir', '-o', default='./examples', help='示例文件输出目录')
def generate_examples(output_dir):
    """生成示例数据文件"""
    os.makedirs(output_dir, exist_ok=True)
    
    import csv
    
    example_file = os.path.join(output_dir, 'sample_data.csv')
    
    headers = [
        'production_cost', 'production_cost_unit', 'expected_attendance',
        'attendance_unit', 'profit_margin', 'days_to_show',
        'ticket_sold_rate', 'weekend_factor', 'manual_notes'
    ]
    
    examples = [
        ['500000', 'CNY', '2000', 'person', '0.3', '30', '0.6', '0', '示例1: 正常数据 - 音乐会'],
        ['1000000', 'CNY', '5000', 'person', '0.25', '7', '0.85', '1', '示例2: 热门演出 - 周末场'],
        ['200000', 'CNY', '800', 'person', '0.4', '60', '0.3', '0', '示例3: 小剧场 - 销售低迷'],
        ['50000', 'CNY', '200', 'person', '0.6', '45', '0.5', '0', '示例4: 利润率60%超出讲义建议15%-50%'],
        ['600000', 'CNY', '3000', 'person', '0.3', '0', '1.0', '1', '示例5: 动态倍率上调75%超出讲义建议±50%'],
        ['5000', 'CNY', '1000', 'person', '0.2', '10', '0.7', '0', '示例6: 制作成本过低 - 越界'],
        ['100000', 'CNY', '30', 'person', '0.3', '20', '0.5', '0', '示例7: 观众人数过少 - 越界'],
        ['800000', 'CNY', '3000', 'person', '0.3', '400', '0.4', '0', '示例8: 天数超出范围 - 越界'],
        ['300000', 'CNY', '1500', 'person', '0.2', '15', '1.2', '0', '示例9: 售票率异常 - 越界'],
    ]
    
    with open(example_file, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(examples)
    
    click.echo(f"\n示例文件已生成: {example_file}")
    click.echo(f"\n包含 {len(examples)} 条示例数据:")
    click.echo("  1-3: 正常计算示例")
    click.echo("  4: 与讲义冲突示例 - 利润率60%")
    click.echo("  5: 与讲义冲突示例 - 动态调整75%")
    click.echo("  6-9: 越界错误示例")
    click.echo(f"\n使用命令: python3 cli.py batch {example_file} -o results.csv -ao abnormal.csv")
    click.echo("")


if __name__ == '__main__':
    cli()
