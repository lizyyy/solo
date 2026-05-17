#!/usr/bin/env python3
import click
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from social_work_cli.parsers.data_manager import DataManager
from social_work_cli.rules.risk_classifier import RiskClassifier
from social_work_cli.rules.scheduler import VisitScheduler
from social_work_cli.rules.material_verifier import MaterialVerifier
from social_work_cli.rules.visit_merger import VisitMerger
from social_work_cli.tracking.source_tracker import SourceTracker
from social_work_cli.reports.report_generator import ReportGenerator


@click.group()
@click.version_option(version='1.0.0', prog_name='社工走访风险分级物资核销排查CLI')
def cli():
    pass


@cli.command()
@click.option('--residents', '-r', multiple=True, help='居民数据文件路径 (可多次指定)')
@click.option('--visits', '-v', multiple=True, help='走访记录文件路径 (可多次指定)')
@click.option('--materials', '-m', multiple=True, help='物资发放文件路径 (可多次指定)')
@click.option('--sheet', '-s', default=None, help='工作表名称 (Excel文件用)')
@click.option('--output', '-o', default=None, help='输出报告文件名')
@click.option('--output-dir', '-d', default=None, help='输出目录')
def process(residents, visits, materials, sheet, output, output_dir):
    data_manager = DataManager()
    source_tracker = SourceTracker()
    
    click.echo('=' * 60)
    click.echo('社工走访风险分级物资核销排查工具')
    click.echo('=' * 60)
    click.echo('')
    
    for f in residents:
        if os.path.exists(f):
            click.echo(f'正在加载居民数据: {f}')
            try:
                count = data_manager.load_residents(f, sheet)
                df = data_manager.get_all_residents()
                source_tracker.track_source(df, '居民', f, sheet or '')
                click.echo(f'  成功加载 {count} 条记录')
            except Exception as e:
                click.echo(f'  加载失败: {str(e)}', err=True)
        else:
            click.echo(f'  文件不存在: {f}', err=True)
    
    for f in visits:
        if os.path.exists(f):
            click.echo(f'正在加载走访记录: {f}')
            try:
                count = data_manager.load_visits(f, sheet)
                df = data_manager.get_all_visits()
                source_tracker.track_source(df, '走访', f, sheet or '')
                click.echo(f'  成功加载 {count} 条记录')
            except Exception as e:
                click.echo(f'  加载失败: {str(e)}', err=True)
        else:
            click.echo(f'  文件不存在: {f}', err=True)
    
    for f in materials:
        if os.path.exists(f):
            click.echo(f'正在加载物资数据: {f}')
            try:
                count = data_manager.load_materials(f, sheet)
                df = data_manager.get_all_materials()
                source_tracker.track_source(df, '物资', f, sheet or '')
                click.echo(f'  成功加载 {count} 条记录')
            except Exception as e:
                click.echo(f'  加载失败: {str(e)}', err=True)
        else:
            click.echo(f'  文件不存在: {f}', err=True)
    
    click.echo('')
    click.echo('开始规则处理...')
    click.echo('')
    
    residents_df = data_manager.get_all_residents()
    visits_df = data_manager.get_all_visits()
    materials_df = data_manager.get_all_materials()
    bad_rows = data_manager.get_bad_rows()
    statistics = data_manager.get_statistics()
    
    click.echo('[1/5] 风险分级处理...')
    risk_classifier = RiskClassifier()
    risk_results = risk_classifier.classify_all_residents(residents_df, visits_df, materials_df)
    click.echo(f'  完成 {len(risk_results)} 位居民的风险分级')
    
    click.echo('[2/5] 回访计划安排...')
    scheduler = VisitScheduler()
    schedule_results = scheduler.generate_schedule(residents_df, risk_results, visits_df)
    click.echo(f'  完成 {len(schedule_results)} 位居民的回访安排')
    
    click.echo('[3/5] 物资核销检查...')
    material_verifier = MaterialVerifier()
    material_results = material_verifier.verify_materials(materials_df, residents_df)
    click.echo(f'  完成 {len(material_results)} 条物资记录的核销')
    
    click.echo('[4/5] 重复走访合并...')
    visit_merger = VisitMerger()
    merge_result = visit_merger.merge_duplicates(visits_df, residents_df)
    duplicate_results = merge_result['duplicates']
    click.echo(f'  发现 {merge_result["duplicate_count"]} 条重复记录')
    
    click.echo('[5/5] 收集追踪数据...')
    source_results = source_tracker.get_all_sources()
    change_results = source_tracker.get_all_changes()
    bad_rows_results = source_tracker.get_bad_rows_report(bad_rows)
    click.echo('  完成数据收集')
    
    click.echo('')
    click.echo('正在生成报告...')
    
    report_data = {
        'risk_results': risk_results,
        'schedule_results': schedule_results,
        'material_results': material_results,
        'duplicate_results': duplicate_results,
        'source_results': source_results,
        'change_results': change_results,
        'bad_rows_results': bad_rows_results,
        'statistics': statistics
    }
    
    reporter = ReportGenerator(output_dir)
    report_path = reporter.generate_full_report(report_data, output)
    summary_text = reporter.generate_summary_text(report_data)
    
    click.echo('')
    click.echo(summary_text)
    click.echo('')
    click.echo(f'报告已生成: {report_path}')
    click.echo('')


@cli.command()
@click.option('--residents', '-r', multiple=True, help='居民数据文件路径 (可多次指定)')
@click.option('--visits', '-v', multiple=True, help='走访记录文件路径 (可多次指定)')
@click.option('--materials', '-m', multiple=True, help='物资发放文件路径 (可多次指定)')
@click.option('--sheet', '-s', default=None, help='工作表名称 (Excel文件用)')
def stats(residents, visits, materials, sheet):
    data_manager = DataManager()
    
    for f in residents:
        if os.path.exists(f):
            data_manager.load_residents(f, sheet)
    
    for f in visits:
        if os.path.exists(f):
            data_manager.load_visits(f, sheet)
    
    for f in materials:
        if os.path.exists(f):
            data_manager.load_materials(f, sheet)
    
    statistics = data_manager.get_statistics()
    
    click.echo('=' * 50)
    click.echo('数据统计')
    click.echo('=' * 50)
    click.echo(f'居民总数: {statistics["total_residents"]}')
    click.echo(f'走访记录总数: {statistics["total_visits"]}')
    click.echo(f'物资发放记录总数: {statistics["total_materials"]}')
    click.echo(f'坏行记录总数: {statistics["total_bad_rows"]}')
    click.echo('')
    click.echo('来源文件:')
    for f in statistics['source_files']:
        click.echo(f'  {f}')
    click.echo('=' * 50)


@cli.command()
@click.argument('data_dir', type=click.Path(exists=True))
@click.option('--output-dir', '-d', default=None, help='输出目录')
def batch(data_dir, output_dir):
    residents_files = []
    visits_files = []
    materials_files = []
    
    for f in os.listdir(data_dir):
        f_path = os.path.join(data_dir, f)
        if os.path.isfile(f_path):
            lower_f = f.lower()
            if '居民' in lower_f or 'resident' in lower_f:
                residents_files.append(f_path)
            elif '走访' in lower_f or 'visit' in lower_f:
                visits_files.append(f_path)
            elif '物资' in lower_f or 'material' in lower_f:
                materials_files.append(f_path)
    
    click.echo(f'发现居民数据: {len(residents_files)} 个文件')
    click.echo(f'发现走访记录: {len(visits_files)} 个文件')
    click.echo(f'发现物资数据: {len(materials_files)} 个文件')
    click.echo('')
    
    if residents_files or visits_files or materials_files:
        sys.argv = [sys.argv[0], 'process']
        for f in residents_files:
            sys.argv.extend(['-r', f])
        for f in visits_files:
            sys.argv.extend(['-v', f])
        for f in materials_files:
            sys.argv.extend(['-m', f])
        if output_dir:
            sys.argv.extend(['-d', output_dir])
        cli()
    else:
        click.echo('未找到可处理的数据文件')


if __name__ == '__main__':
    cli()
