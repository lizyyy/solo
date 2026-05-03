import json
import click
from pathlib import Path
from datetime import datetime
from typing import Optional

from .parser import Parser
from .calculator import Calculator
from .rules import RuleEngine, IssueSeverity
from .exporter import Exporter
from . import sample_data


@click.group()
@click.version_option(version='0.1.0')
def main():
    """洁净厂房压差级联和换气配置复核工具"""
    pass


@main.command()
@click.option('--rooms', '-r', type=click.Path(exists=True, path_type=Path),
              help='房间配置 JSON 文件路径')
@click.option('--pressure', '-p', type=click.Path(exists=True, path_type=Path),
              help='压力读数 CSV 文件路径')
@click.option('--airflow', '-a', type=click.Path(exists=True, path_type=Path),
              help='气流设定值 YAML 文件路径')
@click.option('--door', '-d', type=click.Path(exists=True, path_type=Path),
              help='门事件 JSONL 文件路径')
@click.option('--output', '-o', type=click.Path(path_type=Path), default=Path('.'),
              help='输出目录路径 (默认: 当前目录)')
@click.option('--pressure-tolerance', type=float, default=2.0,
              help='压差容差 (Pa, 默认: 2.0)')
@click.option('--ach-tolerance', type=float, default=0.1,
              help='ACH 容差 (比例, 默认: 0.1 即 10%)')
@click.option('--sensor-gap-threshold', type=int, default=300,
              help='传感器缺采阈值 (秒, 默认: 300)')
@click.option('--transient-threshold', type=float, default=5.0,
              help='门瞬态阈值 (Pa, 默认: 5.0)')
@click.option('--verbose', '-v', is_flag=True,
              help='显示详细输出')
def verify(
    rooms: Path,
    pressure: Path,
    airflow: Path,
    door: Path,
    output: Path,
    pressure_tolerance: float,
    ach_tolerance: float,
    sensor_gap_threshold: int,
    transient_threshold: float,
    verbose: bool
):
    """执行洁净厂房压差级联和换气配置复核"""
    
    click.echo(click.style('🏭 洁净厂房复核工具', fg='cyan', bold=True))
    click.echo(f'开始时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    click.echo('-' * 50)
    
    output.mkdir(parents=True, exist_ok=True)
    
    if verbose:
        click.echo(click.style('📂 正在解析输入文件...', fg='yellow'))
    
    parser = Parser()
    try:
        parsed_data = parser.parse_all(rooms, pressure, airflow, door)
        rooms_data = parsed_data['rooms']
        pressure_readings = parsed_data['pressure_readings']
        airflow_setpoints = parsed_data['airflow_setpoints']
        door_events = parsed_data['door_events']
        
        if verbose:
            click.echo(f'  ✓ 解析 {len(rooms_data)} 个房间')
            click.echo(f'  ✓ 解析 {len(pressure_readings)} 个压力读数')
            click.echo(f'  ✓ 解析 {len(airflow_setpoints)} 个气流设定值')
            click.echo(f'  ✓ 解析 {len(door_events)} 个门事件')
    except Exception as e:
        click.echo(click.style(f'❌ 解析文件失败: {e}', fg='red'), err=True)
        raise click.Abort()
    
    if verbose:
        click.echo(click.style('📊 正在进行计算...', fg='yellow'))
    
    calculator = Calculator()
    try:
        calc_results = calculator.calculate_all(
            rooms_data,
            pressure_readings,
            airflow_setpoints,
            door_events
        )
        pressure_gradients = calc_results['pressure_gradients']
        ach_results = calc_results['ach_results']
        door_impacts = calc_results['door_impacts']
        
        if verbose:
            click.echo(f'  ✓ 计算 {len(pressure_gradients)} 个压差梯度')
            click.echo(f'  ✓ 计算 {len(ach_results)} 个 ACH')
            click.echo(f'  ✓ 分析 {len(door_impacts)} 个门开启影响')
    except Exception as e:
        click.echo(click.style(f'❌ 计算失败: {e}', fg='red'), err=True)
        raise click.Abort()
    
    if verbose:
        click.echo(click.style('🔍 正在执行规则检查...', fg='yellow'))
    
    rule_engine = RuleEngine(
        pressure_tolerance=pressure_tolerance,
        ach_tolerance=ach_tolerance,
        sensor_gap_threshold=sensor_gap_threshold,
        transient_threshold=transient_threshold
    )
    
    try:
        issues = rule_engine.run_all_checks(
            rooms_data,
            pressure_readings,
            pressure_gradients,
            ach_results,
            door_impacts
        )
        
        by_severity = rule_engine.get_issues_by_severity()
        critical_count = len(by_severity.get(IssueSeverity.CRITICAL, []))
        high_count = len(by_severity.get(IssueSeverity.HIGH, []))
        medium_count = len(by_severity.get(IssueSeverity.MEDIUM, []))
        low_count = len(by_severity.get(IssueSeverity.LOW, []))
        
        click.echo('')
        click.echo(click.style('📋 问题汇总', fg='cyan', bold=True))
        click.echo(f'  🔴 严重问题: {critical_count}')
        click.echo(f'  🟠 高优先级问题: {high_count}')
        click.echo(f'  🟡 中优先级问题: {medium_count}')
        click.echo(f'  🟢 低优先级问题: {low_count}')
        click.echo(f'  总计: {len(issues)} 个问题')
        
        if critical_count > 0 or high_count > 0:
            click.echo(click.style('⚠️  检测到高优先级问题，建议立即处理', fg='yellow'))
    except Exception as e:
        click.echo(click.style(f'❌ 规则检查失败: {e}', fg='red'), err=True)
        raise click.Abort()
    
    if verbose:
        click.echo(click.style('📄 正在导出报告...', fg='yellow'))
    
    exporter = Exporter()
    generated_at = datetime.now()
    
    try:
        issues_csv = output / 'issues.csv'
        exporter.export_issues_csv(issues, issues_csv)
        if verbose:
            click.echo(f'  ✓ 导出: {issues_csv}')
        
        report_md = output / 'pressure_report.md'
        exporter.export_pressure_report_md(
            rooms_data,
            pressure_gradients,
            ach_results,
            door_impacts,
            issues,
            report_md,
            generated_at
        )
        if verbose:
            click.echo(f'  ✓ 导出: {report_md}')
        
        trend_html = output / 'pressure_trend.html'
        exporter.export_html_trend(
            rooms_data,
            pressure_readings,
            door_events,
            issues,
            trend_html,
            generated_at
        )
        if verbose:
            click.echo(f'  ✓ 导出: {trend_html}')
    except Exception as e:
        click.echo(click.style(f'❌ 导出失败: {e}', fg='red'), err=True)
        raise click.Abort()
    
    click.echo('')
    click.echo('-' * 50)
    click.echo(f'完成时间: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    click.echo(click.style('✅ 复核完成！', fg='green', bold=True))
    click.echo('')
    click.echo('输出文件:')
    click.echo(f'  - issues.csv       问题列表')
    click.echo(f'  - pressure_report.md   详细报告')
    click.echo(f'  - pressure_trend.html  趋势图表')
    click.echo('')
    
    if critical_count > 0:
        raise click.ClickException(f'检测到 {critical_count} 个严重问题，复核不通过')


@main.command()
@click.option('--output', '-o', type=click.Path(path_type=Path), default=Path('sample_data'),
              help='示例数据输出目录 (默认: sample_data)')
def sample(output: Path):
    """生成示例数据文件"""
    
    output.mkdir(parents=True, exist_ok=True)
    
    click.echo(click.style('📁 生成示例数据...', fg='cyan'))
    
    rooms_path = output / 'rooms.json'
    with open(rooms_path, 'w', encoding='utf-8') as f:
        json.dump(sample_data.ROOMS_DATA, f, indent=2, ensure_ascii=False)
    click.echo(f'  ✓ {rooms_path}')
    
    pressure_path = output / 'pressure_readings.csv'
    with open(pressure_path, 'w', encoding='utf-8', newline='') as f:
        f.write(sample_data.PRESSURE_CSV_CONTENT)
    click.echo(f'  ✓ {pressure_path}')
    
    airflow_path = output / 'airflow_setpoints.yaml'
    with open(airflow_path, 'w', encoding='utf-8') as f:
        f.write(sample_data.AIRFLOW_YAML_CONTENT)
    click.echo(f'  ✓ {airflow_path}')
    
    door_path = output / 'door_events.jsonl'
    with open(door_path, 'w', encoding='utf-8') as f:
        f.write(sample_data.DOOR_JSONL_CONTENT)
    click.echo(f'  ✓ {door_path}')
    
    click.echo('')
    click.echo(click.style('✅ 示例数据已生成！', fg='green'))
    click.echo('')
    click.echo('运行示例:')
    click.echo(f'  cleanroom-verifier verify -r {rooms_path} -p {pressure_path} -a {airflow_path} -d {door_path} -o output -v')
    click.echo('')


if __name__ == '__main__':
    main()
