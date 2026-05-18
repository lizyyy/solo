import click
import os
from datetime import datetime

from .table_reader import TableReader
from .tax_calculator import TaxCalculator
from .delivery_sorter import DeliverySorter
from .report_exporter import ReportExporter


@click.group()
def cli():
    """采购比价税率折算缺项提示排查CLI工具"""
    pass


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--output-dir', '-o', default='./output', help='输出目录')
@click.option('--name', '-n', default=None, help='报告文件名(不含扩展名)')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def process(input_file, output_dir, name, verbose):
    """处理采购报价文件并生成报告"""
    try:
        click.echo(f"开始处理文件: {input_file}")
        
        if name is None:
            base_name = os.path.splitext(os.path.basename(input_file))[0]
            name = f"{base_name}_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        reader = TableReader()
        reader_result = reader.process(input_file)
        
        if verbose:
            for w in reader_result.get('warnings', []):
                click.echo(f"  [WARN] {w}")
        
        calculator = TaxCalculator()
        calc_result = calculator.batch_process(reader_result['data'])
        
        sorter = DeliverySorter()
        sort_result = sorter.process(calc_result['records'])
        
        all_warnings = reader_result.get('warnings', []) + calc_result.get('warnings', []) + sort_result.get('warnings', [])
        all_errors = calc_result.get('errors', []) + sort_result.get('errors', [])
        
        final_result = {
            **reader_result,
            **calc_result,
            **sort_result,
            'warnings': all_warnings,
            'errors': all_errors,
        }
        
        exporter = ReportExporter()
        files = exporter.export(final_result, output_dir, name)
        
        click.echo(f"\n处理完成!")
        click.echo(f"  原始数据: {final_result['raw_rows']} 行")
        click.echo(f"  有效数据: {final_result['valid_count']} 行")
        click.echo(f"  警告: {len(final_result.get('warnings', []))} 条")
        click.echo(f"  错误: {len(final_result.get('errors', []))} 条")
        click.echo(f"\n报告已生成:")
        click.echo(f"  人类可读报告: {files['human_readable']}")
        click.echo(f"  机器可读报告: {files['machine_readable']}")
        
        if verbose:
            click.echo("\n" + "=" * 60)
            human_report = exporter.generate_human_readable(final_result)
            click.echo(human_report)
        
    except Exception as e:
        click.echo(f"处理失败: {str(e)}", err=True)
        raise click.Abort()


@cli.command()
@click.argument('report_file', type=click.Path(exists=True))
def show(report_file):
    """显示已生成的报告内容"""
    try:
        with open(report_file, 'r', encoding='utf-8') as f:
            content = f.read()
        click.echo(content)
    except Exception as e:
        click.echo(f"读取报告失败: {str(e)}", err=True)
        raise click.Abort()


@cli.command()
def info():
    """显示工具信息和支持的格式"""
    click.echo("采购比价税率折算缺项提示排查CLI工具 v1.0.0")
    click.echo("")
    click.echo("支持功能:")
    click.echo("  - 读取 Excel (.xlsx, .xls) 和 CSV 文件")
    click.echo("  - 自动识别列名(供应商、报价、税率、交期、采购品类)")
    click.echo("  - 税率验证和不含税价折算")
    click.echo("  - 交期解析和排序")
    click.echo("  - 缺项字段检测")
    click.echo("  - 冲突检测(重复报价、价格异常等)")
    click.echo("  - 生成人类可读报告(.txt)和机器可读报告(.json)")
    click.echo("")
    click.echo("标准税率: 0%, 3%, 6%, 9%, 13%, 16%, 17%")


if __name__ == '__main__':
    cli()
