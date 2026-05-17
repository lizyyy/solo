import click
from pathlib import Path

from .parser import DataParser
from .rules import RuleEngine
from .reporter import ReportGenerator


@click.group()
@click.version_option(version="1.0.0", prog_name="gate-checker")
def cli():
    pass


@cli.command()
@click.argument('input_file', type=click.Path(exists=True, dir_okay=False))
@click.option('--output', '-o', type=click.Path(dir_okay=False), help='输出Excel报告路径')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def check(input_file, output, verbose):
    input_path = Path(input_file)
    
    if not output:
        output = input_path.parent / f"{input_path.stem}_检查结果.xlsx"
    
    click.echo(f"正在读取数据文件: {input_file}")
    
    parser = DataParser()
    data = parser.parse_all(input_file)
    
    click.echo(f"  人员档案: {len(data['persons'])} 条")
    click.echo(f"  闸机记录: {len(data['events'])} 条")
    click.echo(f"  访客申请: {len(data['visitor_apps'])} 条")
    click.echo(f"  培训记录: {len(data['training_records'])} 条")
    click.echo(f"  黑名单记录: {len(data['blacklist_records'])} 条")
    click.echo(f"  坏记录: {len(data['bad_records'])} 条")
    
    click.echo("\n正在执行规则检查...")
    engine = RuleEngine()
    results = engine.process_all(
        events=data['events'],
        persons=data['persons'],
        visitor_apps=data['visitor_apps'],
        training_records=data['training_records'],
        blacklist_records=data['blacklist_records']
    )
    
    reporter = ReportGenerator()
    reporter.print_console_summary(results, data['bad_records'])
    
    click.echo(f"\n正在导出报告: {output}")
    reporter.export_to_excel(results, data['bad_records'], str(output))
    
    click.echo(click.style("\n检查完成！", fg='green'))
    click.echo(f"报告已保存到: {output}")


@cli.command()
@click.argument('output_file', type=click.Path(dir_okay=False))
def template(output_file):
    import pandas as pd
    from datetime import datetime, timedelta
    
    click.echo(f"正在生成模板文件: {output_file}")
    
    person_data = {
        '人员ID': ['P001', 'P002', 'P003', 'V001'],
        '姓名': ['张三', '李四', '王五', '访客甲'],
        '身份证号': ['110101199001011234', '110101199001012345', '110101199001013456', '110101199001014567'],
        '人员类型': ['员工', '员工', '承包商', '访客'],
        '部门': ['工程部', '安全部', '外包队', ''],
        '电话': ['13800138001', '13800138002', '13800138003', '13800138004']
    }
    df_persons = pd.DataFrame(person_data)
    
    event_data = {
        '事件ID': ['E001', 'E002', 'E003', 'E004', 'E005'],
        '人员ID': ['P001', 'P002', 'P003', 'V001', 'V001'],
        '姓名': ['张三', '李四', '王五', '访客甲', '访客甲'],
        '事件时间': [
            datetime.now().strftime('%Y-%m-%d 08:00:00'),
            datetime.now().strftime('%Y-%m-%d 08:05:00'),
            datetime.now().strftime('%Y-%m-%d 08:10:00'),
            datetime.now().strftime('%Y-%m-%d 09:00:00'),
            datetime.now().strftime('%Y-%m-%d 18:00:00')
        ],
        '闸机名称': ['东门闸机1', '东门闸机1', '西门闸机1', '东门闸机2', '东门闸机2'],
        '事件类型': ['entry', 'entry', 'entry', 'entry', 'exit']
    }
    df_events = pd.DataFrame(event_data)
    
    visitor_data = {
        '申请ID': ['A001'],
        '人员ID': ['V001'],
        '姓名': ['访客甲'],
        '来访单位': ['某某公司'],
        '开始时间': [datetime.now().strftime('%Y-%m-%d 08:30:00')],
        '结束时间': [datetime.now().strftime('%Y-%m-%d 17:30:00')],
        '是否批准': ['是']
    }
    df_visitors = pd.DataFrame(visitor_data)
    
    training_data = {
        '记录ID': ['T001', 'T002', 'T003', 'T004'],
        '人员ID': ['P001', 'P002', 'P003', 'V001'],
        '姓名': ['张三', '李四', '王五', '访客甲'],
        '培训名称': ['安全培训A', '安全培训A', '安全培训A', '访客安全培训'],
        '培训状态': ['通过', '通过', '未开始', '通过'],
        '有效期至': [
            (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d'),
            (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d'),
            '',
            (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        ]
    }
    df_training = pd.DataFrame(training_data)
    
    blacklist_data = {
        '记录ID': ['B001'],
        '人员ID': ['P003'],
        '姓名': ['王五'],
        '原因': ['未佩戴安全帽累计3次'],
        '添加时间': [datetime.now().strftime('%Y-%m-%d')],
        '是否有效': ['是']
    }
    df_blacklist = pd.DataFrame(blacklist_data)
    
    with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
        df_persons.to_excel(writer, sheet_name='人员档案', index=False)
        df_events.to_excel(writer, sheet_name='闸机记录', index=False)
        df_visitors.to_excel(writer, sheet_name='访客申请', index=False)
        df_training.to_excel(writer, sheet_name='培训状态', index=False)
        df_blacklist.to_excel(writer, sheet_name='黑名单', index=False)
    
    click.echo(click.style("模板文件生成成功！", fg='green'))
    click.echo("\n模板包含以下工作表:")
    click.echo("  - 人员档案: 员工、承包商、访客的基本信息")
    click.echo("  - 闸机记录: 闸机通行事件记录")
    click.echo("  - 访客申请: 访客的访问申请和时段")
    click.echo("  - 培训状态: 安全培训记录和状态")
    click.echo("  - 黑名单: 黑名单人员记录")


if __name__ == '__main__':
    cli()
