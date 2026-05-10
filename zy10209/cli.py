import os
import sys
import click
from tabulate import tabulate

from database.db import Database
from services.importer import CSVImporter
from services.validator import BusinessValidator
from services.reporter import Reporter


def get_db(db_path: str = None):
    if db_path is None:
        db_path = os.environ.get('CLINIC_DB', 'clinic.db')
    return Database(db_path)


@click.group()
@click.option('--db', help='数据库文件路径', default=None)
@click.pass_context
def cli(ctx, db):
    ctx.ensure_object(dict)
    ctx.obj['db_path'] = db


@cli.group(name='import')
def import_cmd():
    pass


@import_cmd.command('samplings')
@click.argument('csv_file', type=click.Path(exists=True))
@click.pass_context
def import_samplings(ctx, csv_file):
    db = get_db(ctx.obj.get('db_path'))
    importer = CSVImporter(db)
    result = importer.import_samplings(csv_file)
    _print_import_result("采样记录", result)


@import_cmd.command('tests')
@click.argument('csv_file', type=click.Path(exists=True))
@click.pass_context
def import_tests(ctx, csv_file):
    db = get_db(ctx.obj.get('db_path'))
    importer = CSVImporter(db)
    result = importer.import_test_results(csv_file)
    _print_import_result("检验结果", result)


@import_cmd.command('notifications')
@click.argument('csv_file', type=click.Path(exists=True))
@click.pass_context
def import_notifications(ctx, csv_file):
    db = get_db(ctx.obj.get('db_path'))
    importer = CSVImporter(db)
    result = importer.import_notifications(csv_file)
    _print_import_result("通知记录", result)


@import_cmd.command('followups')
@click.argument('csv_file', type=click.Path(exists=True))
@click.pass_context
def import_followups(ctx, csv_file):
    db = get_db(ctx.obj.get('db_path'))
    importer = CSVImporter(db)
    result = importer.import_followups(csv_file)
    _print_import_result("复查预约", result)


def _print_import_result(data_type, result):
    click.echo(f"\n=== {data_type}导入结果 ===")
    if result.get('error'):
        click.echo(click.style(f"错误: {result['error']}", fg='red'))
        return
    
    stats = [
        ["总计", result['total']],
        ["新增", result['added']],
        ["跳过", result['skipped']]
    ]
    click.echo(tabulate(stats, tablefmt='simple'))
    
    if result.get('duplicates'):
        click.echo(f"\n{click.style('重复记录:', fg='yellow')}")
        for d in result['duplicates'][:10]:
            click.echo(f"  - {d}")
        if len(result['duplicates']) > 10:
            click.echo(f"  ... 还有 {len(result['duplicates']) - 10} 条")
    
    if result.get('warnings'):
        click.echo(f"\n{click.style('警告:', fg='yellow')}")
        for w in result['warnings'][:10]:
            click.echo(f"  - {w}")
    
    if result.get('conflicts'):
        click.echo(f"\n{click.style('冲突记录:', fg='yellow')}")
        for c in result['conflicts']:
            click.echo(f"  - {c}")
    
    if result.get('errors'):
        click.echo(f"\n{click.style('错误:', fg='red')}")
        for e in result['errors']:
            click.echo(f"  - {e}")
        sys.exit(1)
    else:
        click.echo(click.style("\n导入完成", fg='green'))


@cli.group()
def query():
    pass


@query.command('uncollected')
@click.pass_context
def query_uncollected(ctx):
    db = get_db(ctx.obj.get('db_path'))
    reporter = Reporter(db)
    report = reporter.get_uncollected_report()
    click.echo(reporter.format_table(report))


@query.command('abnormal')
@click.pass_context
def query_abnormal(ctx):
    db = get_db(ctx.obj.get('db_path'))
    reporter = Reporter(db)
    report = reporter.get_abnormal_tracking_report()
    click.echo(reporter.format_table(report))


@query.command('summary')
@click.pass_context
def query_summary(ctx):
    db = get_db(ctx.obj.get('db_path'))
    reporter = Reporter(db)
    report = reporter.get_summary_report()
    click.echo(reporter.format_summary(report))


@query.command('all')
@click.pass_context
def query_all(ctx):
    db = get_db(ctx.obj.get('db_path'))
    reporter = Reporter(db)
    
    summary = reporter.get_summary_report()
    click.echo(reporter.format_summary(summary))
    
    uncollected = reporter.get_uncollected_report()
    if uncollected['count'] > 0:
        click.echo(reporter.format_table(uncollected))
    
    abnormal = reporter.get_abnormal_tracking_report()
    if abnormal['count'] > 0:
        click.echo(reporter.format_table(abnormal))


@cli.command()
@click.pass_context
def validate(ctx):
    db = get_db(ctx.obj.get('db_path'))
    validator = BusinessValidator(db)
    results = validator.run_all_validations()
    
    click.echo("\n=== 业务校验结果 ===")
    
    for name, count in results['summary'].items():
        status = click.style("✓ 通过", fg='green') if count == 0 else click.style(f"✗ 发现 {count} 个问题", fg='red')
        click.echo(f"  {name}: {status}")
    
    if results['issues']:
        click.echo(f"\n{click.style('详细问题:', fg='yellow')}")
        for issue in results['issues']:
            click.echo(f"  [{issue['type']}] 采样号 {issue.get('sampling_no', 'N/A')}: {issue['details']}")
    
    if results['has_errors']:
        sys.exit(1)
    else:
        click.echo(click.style("\n所有校验通过 ✓", fg='green'))


@cli.command()
@click.argument('sampling_no')
@click.pass_context
def complete(ctx, sampling_no):
    db = get_db(ctx.obj.get('db_path'))
    validator = BusinessValidator(db)
    success, msg = validator.mark_test_completed(sampling_no)
    if success:
        click.echo(click.style(msg, fg='green'))
    else:
        click.echo(click.style(f"错误: {msg}", fg='red'))
        sys.exit(1)


@cli.command()
@click.option('--sampling', 'data_type', flag_value='sampling', help='生成采样记录模板')
@click.option('--test', 'data_type', flag_value='test', help='生成检验结果模板')
@click.option('--notification', 'data_type', flag_value='notification', help='生成通知记录模板')
@click.option('--followup', 'data_type', flag_value='followup', help='生成复查预约模板')
@click.argument('output_file', type=click.Path())
@click.pass_context
def template(ctx, data_type, output_file):
    templates = {
        'sampling': '''采样编号,姓名,电话,采样日期,采样类型,采样人,状态
S001,张三,13800138001,2024-05-01,血常规,李医生,pending
S002,李四,13800138002,2024-05-01,生化全套,王医生,pending
''',
        'test': '''采样编号,检验日期,状态,检验机构,是否异常,异常指标
S001,2024-05-02,received,社区医院,否,
S002,2024-05-02,abnormal,社区医院,是,白细胞|12.5|4-10|高;血糖|8.2|3.9-6.1|高
''',
        'notification': '''采样编号,通知日期,通知方式,通知人,联系结果,备注
S002,2024-05-03,电话,张护士,已联系,已告知异常结果，建议复查
''',
        'followup': '''采样编号,复查日期,复查时间,复查项目,状态,备注
S002,2024-05-10,09:00,血常规,血糖,pending,
'''
    }
    
    if data_type not in templates:
        click.echo(click.style("请指定数据类型: --sampling, --test, --notification, 或 --followup", fg='red'))
        sys.exit(1)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(templates[data_type])
    
    click.echo(click.style(f"模板已生成: {output_file}", fg='green'))


if __name__ == '__main__':
    cli()
