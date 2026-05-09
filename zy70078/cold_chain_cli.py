#!/usr/bin/env python3
import click
import sys
import uuid
from datetime import datetime
from pathlib import Path

from cold_chain_monitor.data_importer import DataImporter
from cold_chain_monitor.simulation_engine import SimulationEngine
from cold_chain_monitor.risk_evaluator import RiskEvaluator
from cold_chain_monitor.storage import Storage
from cold_chain_monitor.report_generator import ReportGenerator
from cold_chain_monitor.models import SimulationConfig


@click.group()
def cli():
    """冷链运输温控风险推演工具"""
    pass


@cli.command()
@click.option('--route', '-r', required=True, help='路线配置YAML文件路径')
@click.option('--sensor', '-s', required=True, help='传感器数据CSV文件路径')
@click.option('--output', '-o', default=None, help='报告输出目录')
@click.option('--format', '-f', 'report_format', default='both', 
              type=click.Choice(['markdown', 'csv', 'both']),
              help='报告格式')
@click.option('--db', default='data/simulations.db', help='SQLite数据库路径')
@click.option('--no-save', is_flag=True, help='不保存到数据库')
@click.option('--temp-drift', default=0.1, type=float, help='温度漂移速率 (°C/小时)')
@click.option('--door-open-rate', default=2.0, type=float, help='开门升温速率 (°C/小时)')
@click.option('--cooling-rate', default=-1.5, type=float, help='补冷速率 (°C/小时)')
@click.option('--max-missing', default=30, type=int, help='最大允许连续缺测时间 (分钟)')
@click.option('--seed', default=42, type=int, help='随机种子')
def run(route, sensor, output, report_format, db, no_save,
        temp_drift, door_open_rate, cooling_rate, max_missing, seed):
    """运行温度风险推演"""
    
    click.echo('📦 导入数据...')
    
    try:
        data_importer = DataImporter()
        route_data = data_importer.import_route(route)
        sensor_data = data_importer.import_sensor_data(sensor)
    except Exception as e:
        click.echo(f'❌ 数据导入失败: {e}', err=True)
        sys.exit(1)
    
    click.echo(f'✅ 导入 {len(route_data.orders)} 个订单, {len(sensor_data)} 条传感器记录')
    
    config = SimulationConfig(
        temp_drift_rate=temp_drift,
        door_open_rate=door_open_rate,
        cooling_rate=cooling_rate,
        max_missing_duration_min=max_missing,
        random_seed=seed
    )
    
    click.echo('🔬 运行模拟...')
    engine = SimulationEngine(config)
    segment_results, compartment_profiles = engine.run_simulation(route_data, sensor_data)
    
    click.echo('📊 评估风险...')
    evaluator = RiskEvaluator(config)
    results = evaluator.evaluate(route_data, segment_results, compartment_profiles)
    
    result_dicts = [
        {
            'order_id': r.order_id,
            'route_id': r.route_id,
            'risk_level': r.risk_level,
            'total_overtime_min': r.total_overtime_min,
            'max_temp_violation': r.max_temp_violation,
            'min_temp_violation': r.min_temp_violation,
            'triggers': r.triggers,
            'missing_data_count': r.missing_data_count,
            'missing_data_duration_min': r.missing_data_duration_min,
            'recommendations': r.recommendations,
            'simulation_timestamp': r.simulation_timestamp.isoformat(),
            'segment_details': r.segment_details
        }
        for r in results
    ]
    
    simulation_id = f'sim_{uuid.uuid4().hex[:8]}'
    
    if not no_save:
        click.echo('💾 保存到数据库...')
        storage = Storage(db)
        storage.save_simulation(simulation_id, route_data, results)
        click.echo(f'✅ 已保存，推演ID: {simulation_id}')
    
    if output:
        output_path = Path(output)
        output_path.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if report_format in ['markdown', 'both']:
            md_path = output_path / f'report_{simulation_id}_{timestamp}.md'
            md_content = ReportGenerator.generate_markdown(
                result_dicts,
                simulation_id,
                route_data.route_id,
                results[0].simulation_timestamp if results else datetime.now()
            )
            md_path.write_text(md_content, encoding='utf-8')
            click.echo(f'📄 Markdown报告已生成: {md_path}')
        
        if report_format in ['csv', 'both']:
            csv_path = output_path / f'report_{simulation_id}_{timestamp}.csv'
            ReportGenerator.generate_csv(result_dicts, str(csv_path))
            click.echo(f'📊 CSV报告已生成: {csv_path}')
    
    _print_summary(results)


@cli.command()
@click.option('--db', default='data/simulations.db', help='SQLite数据库路径')
@click.option('--limit', '-n', default=10, help='显示最近的N条记录')
def list(db, limit):
    """列出历史推演记录"""
    storage = Storage(db)
    simulations = storage.list_simulations(limit)
    
    if not simulations:
        click.echo('暂无推演记录')
        return
    
    click.echo('推演历史记录:')
    click.echo('-' * 120)
    click.echo(f'{"推演ID":<20} {"路线ID":<15} {"推演时间":<20} {"订单数":<8} {"严重":<6} {"高":<6} {"中":<6} {"低":<6} {"无":<6}')
    click.echo('-' * 120)
    
    for sim in simulations:
        click.echo(
            f'{sim["simulation_id"]:<20} {sim["route_id"]:<15} '
            f'{sim["simulation_timestamp"][:19]:<20} '
            f'{sim["order_count"]:<8} {sim["critical_count"]:<6} '
            f'{sim["high_count"]:<6} {sim["medium_count"]:<6} '
            f'{sim["low_count"]:<6} {sim["none_count"]:<6}'
        )


@cli.command()
@click.argument('simulation_id')
@click.option('--db', default='data/simulations.db', help='SQLite数据库路径')
@click.option('--output', '-o', default=None, help='报告输出目录')
@click.option('--format', '-f', 'report_format', default='markdown',
              type=click.Choice(['markdown', 'csv']),
              help='报告格式')
def export(simulation_id, db, output, report_format):
    """导出指定推演的报告"""
    storage = Storage(db)
    simulation = storage.get_simulation(simulation_id)
    
    if not simulation:
        click.echo(f'❌ 未找到推演记录: {simulation_id}', err=True)
        sys.exit(1)
    
    results = simulation['results']
    route_id = simulation['route_id']
    sim_time = datetime.fromisoformat(simulation['simulation_timestamp'])
    
    if output:
        output_path = Path(output)
        output_path.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        if report_format == 'markdown':
            md_path = output_path / f'report_{simulation_id}_{timestamp}.md'
            md_content = ReportGenerator.generate_markdown(
                results, simulation_id, route_id, sim_time
            )
            md_path.write_text(md_content, encoding='utf-8')
            click.echo(f'📄 Markdown报告已生成: {md_path}')
        else:
            csv_path = output_path / f'report_{simulation_id}_{timestamp}.csv'
            ReportGenerator.generate_csv(results, str(csv_path))
            click.echo(f'📊 CSV报告已生成: {csv_path}')
    else:
        if report_format == 'markdown':
            md_content = ReportGenerator.generate_markdown(
                results, simulation_id, route_id, sim_time
            )
            click.echo(md_content)
        else:
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
                ReportGenerator.generate_csv(results, f.name)
                f.seek(0)
                click.echo(open(f.name, encoding='utf-8').read())


@cli.command()
@click.argument('simulation_id')
@click.option('--db', default='data/simulations.db', help='SQLite数据库路径')
def delete(simulation_id, db):
    """删除指定的推演记录"""
    storage = Storage(db)
    if storage.delete_simulation(simulation_id):
        click.echo(f'✅ 已删除推演记录: {simulation_id}')
    else:
        click.echo(f'❌ 删除失败: {simulation_id}', err=True)
        sys.exit(1)


@cli.command()
@click.argument('order_id')
@click.option('--db', default='data/simulations.db', help='SQLite数据库路径')
@click.option('--limit', '-n', default=5, help='显示最近的N条记录')
def history(order_id, db, limit):
    """查看订单历史记录"""
    storage = Storage(db)
    records = storage.get_order_history(order_id, limit)
    
    if not records:
        click.echo(f'未找到订单 {order_id} 的历史记录')
        return
    
    click.echo(f'订单 {order_id} 的历史推演记录:')
    click.echo('-' * 100)
    click.echo(f'{"推演ID":<20} {"风险等级":<10} {"超限时长":<12} {"推演时间":<20}')
    click.echo('-' * 100)
    
    for rec in records:
        risk_label = ReportGenerator.RISK_LABELS.get(rec['risk_level'], rec['risk_level'])
        click.echo(
            f'{rec["simulation_id"]:<20} {risk_label:<10} '
            f'{rec["total_overtime_min"]:<12} {rec["simulation_timestamp"][:19]:<20}'
        )


def _print_summary(results):
    """打印推演摘要"""
    stats = {
        'CRITICAL': 0, 'HIGH': 0, 'MEDIUM': 0, 'LOW': 0, 'NONE': 0
    }
    
    for r in results:
        stats[r.risk_level] += 1
    
    click.echo('')
    click.echo('=' * 60)
    click.echo('推演结果摘要')
    click.echo('=' * 60)
    
    total = len(results)
    for level, label in ReportGenerator.RISK_LABELS.items():
        count = stats[level]
        pct = (count / total * 100) if total else 0
        
        if level == 'CRITICAL':
            marker = '🔴'
        elif level == 'HIGH':
            marker = '🟠'
        elif level == 'MEDIUM':
            marker = '🟡'
        elif level == 'LOW':
            marker = '🔵'
        else:
            marker = '🟢'
        
        click.echo(f'{marker} {label}: {count} ({pct:.1f}%)')
    
    click.echo('=' * 60)


if __name__ == '__main__':
    cli()
