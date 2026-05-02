import click
import os
from pathlib import Path
from .parser import parse_downtime_events, parse_shift_schedule, parse_yarn_batches, parse_sensor_data
from .validator import remove_duplicate_events, validate_time_order, flag_overlapping_events
from .aligner import align_events_to_shifts
from .root_cause import classify_root_causes
from .statistics import calculate_summary_statistics, create_downtime_summary_df
from .exporter import export_downtime_summary, export_root_cause_report, export_machine_timeline


@click.command()
@click.option('--events', '-e', required=True, help='停台事件CSV文件路径')
@click.option('--shifts', '-s', required=True, help='班次计划JSON文件路径')
@click.option('--yarn', '-y', required=True, help='纱线批次YAML文件路径')
@click.option('--sensors', '-n', required=True, help='传感器时序JSONL文件路径')
@click.option('--output-dir', '-o', default='./output', help='输出目录 (默认: ./output)')
@click.option('--verbose', '-v', is_flag=True, help='显示详细输出')
def main(events, shifts, yarn, sensors, output_dir, verbose):
    """
    纺织车间织机停台原因分析工具
    
    示例:
        loom-analyze -e sample_data/downtime_events.csv -s sample_data/shifts.json -y sample_data/yarn_batches.yaml -n sample_data/sensors.jsonl -o ./output
    """
    click.echo("🚀 开始织机停台分析...")
    
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)
    
    if verbose:
        click.echo("📥 正在解析数据文件...")
    
    events_df = parse_downtime_events(events)
    shifts_data = parse_shift_schedule(shifts)
    yarn_batches = parse_yarn_batches(yarn)
    sensor_data = parse_sensor_data(sensors)
    
    if verbose:
        click.echo(f"✅ 解析完成: 找到 {len(events_df)} 个停台事件")
    
    if verbose:
        click.echo("🔍 正在校验数据...")
    
    events_df, removed = remove_duplicate_events(events_df)
    if removed > 0 and verbose:
        click.echo(f"⚠️ 移除了 {removed} 个重复事件")
    
    events_df = validate_time_order(events_df)
    events_df = flag_overlapping_events(events_df)
    
    if verbose:
        click.echo("⏰ 正在对齐班次...")
    
    events_df = align_events_to_shifts(events_df, shifts_data)
    
    if verbose:
        click.echo("🔬 正在分析根因...")
    
    events_df = classify_root_causes(events_df, sensor_data)
    
    if verbose:
        click.echo("📊 正在计算统计数据...")
    
    stats = calculate_summary_statistics(events_df)
    summary_df = create_downtime_summary_df(events_df)
    
    if verbose:
        click.echo("📤 正在导出结果...")
    
    export_downtime_summary(summary_df, str(output_path / 'downtime_summary.csv'))
    export_root_cause_report(stats, str(output_path / 'root_cause_report.md'))
    export_machine_timeline(events_df, str(output_path / 'machine_timeline.html'))
    
    click.echo("\n✅ 分析完成！")
    click.echo(f"📁 输出目录: {output_path.absolute()}")
    click.echo(f"   - downtime_summary.csv")
    click.echo(f"   - root_cause_report.md")
    click.echo(f"   - machine_timeline.html (可直接用浏览器打开)")
    click.echo(f"\n📈 总停台次数: {stats['total_events']}")
    click.echo(f"⏱️  总停台时间: {stats['total_downtime_min']} 分钟")


if __name__ == '__main__':
    main()
