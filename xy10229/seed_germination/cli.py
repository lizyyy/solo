import click
import sys
import os
from typing import Optional

from .analyzer import Analyzer
from .reporter import ConsoleReporter, FileReporter


@click.group()
@click.version_option()
def main():
    """种子发芽率实验记录 CLI - 多组种子发芽实验的记录、验证和分析工具
    
    本工具用于：
    1. 验证实验组导入是否生效
    2. 检查每日记录是否可靠
    3. 审计补记记录与原始数据的一致性
    4. 生成表格和图表报告
    """
    pass


@main.command()
@click.argument('records_file', type=click.Path(exists=True, dir_okay=False))
@click.option(
    '--groups', '-g', 
    type=click.Path(exists=True, dir_okay=False),
    help='实验组配置文件路径（CSV格式）'
)
@click.option(
    '--output', '-o',
    type=click.Path(file_okay=False),
    default='./output',
    help='输出目录路径（默认：./output）'
)
@click.option(
    '--no-charts',
    is_flag=True,
    help='不生成图表（仅生成文本报告）'
)
@click.option(
    '--verbose', '-v',
    is_flag=True,
    help='显示详细信息'
)
def analyze(records_file, groups, output, no_charts, verbose):
    """分析种子发芽率实验数据
    
    RECORDS_FILE: 每日记录数据文件（CSV格式）
    
    输出状态码：
      0: 通过 - 所有检查通过
      1: 警告 - 存在警告，建议人工检查
      2: 失败 - 存在错误，必须修正后重跑
    """
    click.echo(f"📂 读取数据文件: {records_file}")
    if groups:
        click.echo(f"📂 读取实验组配置: {groups}")
    
    try:
        analyzer = Analyzer(records_file, groups)
        result = analyzer.analyze()
    except Exception as e:
        click.echo(f"❌ 分析失败: {e}", err=True)
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(2)
    
    console_reporter = ConsoleReporter(result)
    console_reporter.print_summary()
    
    click.echo(f"\n📁 生成文件报告到: {output}")
    file_reporter = FileReporter(result, output)
    generated_files = file_reporter.generate_all(
        generate_charts=not no_charts
    )
    
    for file_type, filepath in generated_files.items():
        click.echo(f"  ✓ {file_type}: {filepath}")
    
    exit_code = console_reporter.get_exit_code()
    
    if exit_code == 0:
        click.echo("\n✅ 分析通过！")
    elif exit_code == 1:
        click.echo("\n⚠️  存在警告，请查看审计报告后决定是否重跑")
    else:
        click.echo("\n❌ 存在错误，请修正数据后重新运行")
    
    sys.exit(exit_code)


@main.command('validate')
@click.argument('records_file', type=click.Path(exists=True, dir_okay=False))
@click.option(
    '--groups', '-g', 
    type=click.Path(exists=True, dir_okay=False),
    help='实验组配置文件路径'
)
def validate_only(records_file, groups):
    """仅验证数据，不生成统计报告
    
    快速检查数据格式和完整性
    """
    click.echo(f"🔍 验证数据文件: {records_file}")
    
    try:
        analyzer = Analyzer(records_file, groups)
        result = analyzer.analyze()
    except Exception as e:
        click.echo(f"❌ 验证失败: {e}", err=True)
        sys.exit(2)
    
    audit = result.audit_report
    summary = audit.summary
    
    click.echo(f"\n📊 数据概览:")
    click.echo(f"  总记录数: {audit.total_records}")
    click.echo(f"  有效记录: {audit.valid_records}")
    click.echo(f"  无效记录: {audit.invalid_records}")
    click.echo(f"  缺失天数: {audit.missing_records}")
    click.echo(f"  补记记录: {audit.backfilled_records}")
    
    if summary.get('has_errors'):
        click.echo(f"\n❌ 存在 {summary['severity_counts']['error']} 个错误")
        for finding in audit.findings:
            if finding.severity == 'error':
                click.echo(f"  - [{finding.group_id}] {finding.message}")
        sys.exit(2)
    
    if summary.get('has_warnings'):
        click.echo(f"\n⚠️  存在 {summary['severity_counts']['warning']} 个警告")
        for finding in audit.findings:
            if finding.severity == 'warning':
                click.echo(f"  - [{finding.group_id}] {finding.message}")
        sys.exit(1)
    
    click.echo("\n✅ 数据验证通过")
    sys.exit(0)


@main.command('template')
@click.option(
    '--type', '-t',
    type=click.Choice(['records', 'groups', 'all']),
    default='all',
    help='生成的模板类型'
)
@click.option(
    '--output', '-o',
    type=click.Path(file_okay=False),
    default='./templates',
    help='输出目录'
)
def generate_template(type, output):
    """生成样例数据模板
    
    创建可以直接使用的CSV样例文件
    """
    os.makedirs(output, exist_ok=True)
    
    records_template = """group_id,experiment_date,germinated_count,total_seeds,record_type,record_date,operator,notes
G1,2025-05-01,5,100,daily,,,
G1,2025-05-02,12,100,daily,,,
G1,2025-05-03,18,100,daily,,,
G1,2025-05-04,25,100,daily,,,
G1,2025-05-05,32,100,daily,,,
G1,2025-05-06,38,100,daily,,,
G1,2025-05-07,42,100,daily,,,
G2,2025-05-01,3,100,daily,,,
G2,2025-05-02,8,100,daily,,,
G2,2025-05-03,15,100,backfill,2025-05-04,张三,前一天漏记，今日补记
G2,2025-05-04,22,100,daily,,,
G2,2025-05-05,28,100,daily,,,
G2,2025-05-06,35,100,daily,,,
G2,2025-05-07,40,100,daily,,,
G3,2025-05-01,2,100,daily,,,
G3,2025-05-02,7,100,daily,,,
G3,2025-05-04,20,100,daily,,,
G3,2025-05-05,26,100,daily,,,
G3,2025-05-06,31,100,daily,,,
G3,2025-05-07,35,100,daily,,,
"""
    
    groups_template = """group_id,group_name,total_seeds,start_date,end_date,variety,location,notes
G1,对照组,100,2025-05-01,2025-05-07,常规品种,A区,
G2,处理组A,100,2025-05-01,2025-05-07,处理品种A,B区,
G3,处理组B,100,2025-05-01,2025-05-07,处理品种B,C区,
"""
    
    if type in ('records', 'all'):
        records_path = os.path.join(output, 'records_template.csv')
        with open(records_path, 'w', encoding='utf-8') as f:
            f.write(records_template)
        click.echo(f"✓ 记录模板: {records_path}")
    
    if type in ('groups', 'all'):
        groups_path = os.path.join(output, 'groups_template.csv')
        with open(groups_path, 'w', encoding='utf-8') as f:
            f.write(groups_template)
        click.echo(f"✓ 实验组模板: {groups_path}")
    
    click.echo("\n💡 模板说明:")
    click.echo("  - records_template.csv: 日常记录模板")
    click.echo("  - groups_template.csv: 实验组配置模板")
    click.echo("  - record_type: daily=日常记录, backfill=补记记录")
    click.echo("  - 5月3日G2是补记示例，5月3日G3是漏记示例")


if __name__ == '__main__':
    main()
