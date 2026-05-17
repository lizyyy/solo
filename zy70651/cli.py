import click
import os
from datetime import datetime
from data_reader import ExcelDataReader
from analyzer import BatchAnalyzer
from report_generator import ReportGenerator


@click.group()
def cli():
    """药品效期冻结批次调拨建议排查工具"""
    pass


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
@click.option('--near-expiry-days', '-n', default=90, help='近效期天数阈值，默认90天')
@click.option('--critical-expiry-days', '-c', default=30, help='危急效期天数阈值，默认30天')
@click.option('--output-json', '-j', type=click.Path(), help='输出JSON报告路径')
@click.option('--output-text', '-t', type=click.Path(), help='输出文本报告路径')
@click.option('--output-dir', '-d', type=click.Path(), help='输出目录，自动生成所有报告')
@click.option('--quiet', '-q', is_flag=True, help='静默模式，不打印控制台报告')
def analyze(input_file, near_expiry_days, critical_expiry_days, output_json, output_text, output_dir, quiet):
    """分析Excel文件并生成报告"""
    
    click.echo(click.style(f"正在读取文件: {input_file}", fg='cyan'))
    
    reader = ExcelDataReader()
    batches, warnings, errors = reader.read_excel(input_file)
    
    if errors:
        click.echo(click.style(f"读取错误 ({len(errors)}):", fg='red'))
        for err in errors:
            click.echo(click.style(f"  - {err}", fg='red'))
    
    if warnings:
        click.echo(click.style(f"数据警告 ({len(warnings)}):", fg='yellow'))
        for warn in warnings:
            click.echo(click.style(f"  - {warn}", fg='yellow'))
    
    click.echo(click.style(f"成功读取 {len(batches)} 条记录", fg='green'))
    
    click.echo(click.style(f"\n正在分析数据...", fg='cyan'))
    analyzer = BatchAnalyzer(
        near_expiry_days=near_expiry_days,
        critical_expiry_days=critical_expiry_days
    )
    result = analyzer.analyze(batches, input_file)
    
    if not quiet:
        generator = ReportGenerator()
        generator.generate_console_report(result)
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    base_name = os.path.splitext(os.path.basename(input_file))[0]
    
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        output_json = os.path.join(output_dir, f"{base_name}_report_{timestamp}.json")
        output_text = os.path.join(output_dir, f"{base_name}_report_{timestamp}.txt")
    
    generator = ReportGenerator()
    
    if output_json:
        generator.generate_json_report(result, output_json)
        click.echo(click.style(f"JSON报告已生成: {output_json}", fg='green'))
    
    if output_text:
        generator.generate_text_report(result, output_text)
        click.echo(click.style(f"文本报告已生成: {output_text}", fg='green'))
    
    click.echo(click.style("\n分析完成!", fg='green', bold=True))


@cli.command()
@click.argument('output_dir', type=click.Path(), default='sample_data')
def generate_samples(output_dir):
    """生成样例数据文件（正常输入、脏数据、边界冲突、空结果）"""
    import pandas as pd
    from datetime import date, timedelta
    
    os.makedirs(output_dir, exist_ok=True)
    
    today = date.today()
    
    sample_normal = pd.DataFrame({
        '批号': ['B2024001', 'B2024002', 'B2024003', 'B2024004', 'B2024005', 'B2024006'],
        '药品名称': ['阿莫西林胶囊', '布洛芬片', '阿莫西林胶囊', '维生素C片', '布洛芬片', '维生素C片'],
        '门店': ['中心店', '中心店', '分店A', '中心店', '分店A', '分店A'],
        '库存数量': [100, 50, 80, 200, 60, 150],
        '效期日期': [
            today + timedelta(days=15),
            today + timedelta(days=45),
            today + timedelta(days=15),
            today + timedelta(days=365),
            today + timedelta(days=45),
            today + timedelta(days=365)
        ],
        '冻结状态': ['未冻结', '未冻结', '未冻结', '未冻结', '冻结', '未冻结']
    })
    normal_path = os.path.join(output_dir, '01_正常输入.xlsx')
    sample_normal.to_excel(normal_path, index=False)
    click.echo(click.style(f"已生成: {normal_path}", fg='green'))
    
    sample_dirty = pd.DataFrame({
        '批号': ['B2024001', None, 'B2024003', 'B2024004', 'B2024005', ''],
        '药品名称': ['阿莫西林胶囊', '布洛芬片', '', '维生素C片', None, '布洛芬片'],
        '门店': ['中心店', '中心店', '分店A', None, '分店A', '分店A'],
        '库存数量': ['一百', 50, -10, 200, 'abc', ''],
        '效期日期': ['2024/13/01', '2024-15-45', '2024年13月1日', today, 'invalid', None],
        '冻结状态': ['是', '否', '未知状态', None, '冻结', '待审核']
    })
    dirty_path = os.path.join(output_dir, '02_脏数据.xlsx')
    sample_dirty.to_excel(dirty_path, index=False)
    click.echo(click.style(f"已生成: {dirty_path}", fg='green'))
    
    sample_edge = pd.DataFrame({
        '批号': ['B2024001', 'B2024001', 'B2024001', 'B2024001', 'B2024002'],
        '药品名称': ['阿莫西林胶囊', '阿莫西林胶囊', '阿莫西林胶囊', '阿莫西林胶囊', '布洛芬片'],
        '门店': ['中心店', '分店A', '分店B', '分店C', '中心店'],
        '库存数量': [50, 50, 50, 50, 100],
        '效期日期': [
            today + timedelta(days=20),
            today + timedelta(days=1),
            today + timedelta(days=-5),
            today + timedelta(days=200),
            today + timedelta(days=10)
        ],
        '冻结状态': ['未冻结', '未冻结', '冻结', '未冻结', '未冻结']
    })
    edge_path = os.path.join(output_dir, '03_边界冲突.xlsx')
    sample_edge.to_excel(edge_path, index=False)
    click.echo(click.style(f"已生成: {edge_path}", fg='green'))
    
    sample_empty = pd.DataFrame(columns=['批号', '药品名称', '门店', '库存数量', '效期日期', '冻结状态'])
    empty_path = os.path.join(output_dir, '04_空结果.xlsx')
    sample_empty.to_excel(empty_path, index=False)
    click.echo(click.style(f"已生成: {empty_path}", fg='green'))
    
    click.echo(click.style(f"\n所有样例数据已生成到: {output_dir}", fg='green', bold=True))
    click.echo(click.style("使用方法: python cli.py analyze sample_data/01_正常输入.xlsx", fg='cyan'))


@cli.command()
@click.argument('input_file', type=click.Path(exists=True))
def validate(input_file):
    """验证机器可读输出与人读报告一致性"""
    import json
    import tempfile
    
    reader = ExcelDataReader()
    batches, _, _ = reader.read_excel(input_file)
    
    analyzer = BatchAnalyzer()
    result = analyzer.analyze(batches, input_file)
    
    generator = ReportGenerator()
    
    with tempfile.NamedTemporaryFile(suffix='.json', delete=False, mode='w', encoding='utf-8') as f:
        json_path = f.name
    generator.generate_json_report(result, json_path)
    
    with tempfile.NamedTemporaryFile(suffix='.txt', delete=False, mode='w', encoding='utf-8') as f:
        text_path = f.name
    generator.generate_text_report(result, text_path)
    
    with open(json_path, 'r', encoding='utf-8') as f:
        json_data = json.load(f)
    
    with open(text_path, 'r', encoding='utf-8') as f:
        text_content = f.read()
    
    checks = []
    
    json_total = json_data['summary']['total_batches']
    text_has_total = f"总批次数: {json_total}" in text_content
    checks.append(("总批次数一致", text_has_total))
    
    json_normal = json_data['expiry_distribution']['normal']
    json_near = json_data['expiry_distribution']['near_expiry']
    json_critical = json_data['expiry_distribution']['critical']
    json_expired = json_data['expiry_distribution']['expired']
    
    text_has_normal = f"正常: {json_normal}" in text_content
    text_has_near = f"近效期: {json_near}" in text_content
    text_has_critical = f"危急: {json_critical}" in text_content
    text_has_expired = f"已过期: {json_expired}" in text_content
    checks.append(("效期分布一致", all([text_has_normal, text_has_near, text_has_critical, text_has_expired])))
    
    json_problem_count = len(json_data['problem_batches'])
    text_has_problem = f"问题批次数量: {json_problem_count}" in text_content
    checks.append(("问题批次数量一致", text_has_problem))
    
    json_transfer_count = len(json_data['transfer_suggestions'])
    text_has_transfer = f"调拨建议数量: {json_transfer_count}" in text_content
    checks.append(("调拨建议数量一致", text_has_transfer))
    
    json_validation = json_data['validation']['expiry_count_match']
    text_has_validation = "效期统计校验: PASS" in text_content if json_validation else "效期统计校验: FAIL" in text_content
    checks.append(("校验结果一致", text_has_validation))
    
    click.echo(click.style("数据一致性校验报告", fg='cyan', bold=True))
    click.echo("=" * 50)
    
    all_passed = True
    for check_name, passed in checks:
        status = "✓ PASS" if passed else "✗ FAIL"
        color = 'green' if passed else 'red'
        click.echo(f"{check_name:<30} {click.style(status, fg=color)}")
        if not passed:
            all_passed = False
    
    click.echo("=" * 50)
    
    if all_passed:
        click.echo(click.style("所有校验通过! 机器可读输出与人读报告一致。", fg='green', bold=True))
    else:
        click.echo(click.style("部分校验失败，请检查报告生成逻辑。", fg='red', bold=True))
    
    os.unlink(json_path)
    os.unlink(text_path)


if __name__ == '__main__':
    cli()
