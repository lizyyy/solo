import click
from pathlib import Path
from .file_scanner import RecordingScanner
from .data_parser import DataParser
from .matching_engine import MatchingEngine
from .attribution import AttributionEngine
from .sampling import SamplingEngine
from .reporter import ReportGenerator


@click.group()
def cli():
    """工单录音匹配缺失归因抽样清单排查工具"""
    pass


@cli.command()
@click.option('--recording-dir', '-r', required=True, help='录音文件目录路径')
@click.option('--ticket-file', '-t', required=True, help='工单表文件路径 (CSV/Excel)')
@click.option('--agent-file', '-a', help='坐席表文件路径 (CSV/Excel)')
@click.option('--sample-size', '-s', default=50, help='抽样数量，默认50')
@click.option('--sample-method', '-m', default='stratified', type=click.Choice(['stratified', 'weighted', 'simple']), help='抽样方法')
@click.option('--seed', '-e', default=42, help='随机种子，保证结果可复现')
@click.option('--min-duration', '-d', default=10, help='最短通话时长(秒)，默认10')
@click.option('--output-dir', '-o', default='./output', help='输出目录')
@click.option('--filename', '-f', help='输出文件名')
@click.option('--strict', is_flag=True, help='严格匹配模式')
def run(recording_dir, ticket_file, agent_file, sample_size, sample_method, seed, min_duration, output_dir, filename, strict):
    """执行完整的排查流程：扫描->解析->匹配->归因->抽样->报告"""
    
    click.echo("=" * 60)
    click.echo("  开始执行工单录音匹配排查流程")
    click.echo("=" * 60)
    
    click.echo(f"\n[1/6] 扫描录音文件目录: {recording_dir}")
    try:
        scanner = RecordingScanner(recording_dir)
        recordings = scanner.scan()
        click.echo(f"   找到 {len(recordings)} 个录音文件")
    except Exception as e:
        click.echo(f"   错误: {str(e)}", err=True)
        return
    
    click.echo(f"\n[2/6] 解析工单表: {ticket_file}")
    try:
        parser = DataParser()
        tickets = parser.parse_ticket_file(ticket_file)
        click.echo(f"   解析到 {len(tickets)} 条工单数据")
        valid_count = sum(1 for t in tickets if t.is_valid)
        click.echo(f"   有效工单: {valid_count} 条")
    except Exception as e:
        click.echo(f"   错误: {str(e)}", err=True)
        return
    
    agents = []
    if agent_file:
        click.echo(f"\n[3/6] 解析坐席表: {agent_file}")
        try:
            agents = parser.parse_agent_file(agent_file)
            click.echo(f"   解析到 {len(agents)} 条坐席数据")
        except Exception as e:
            click.echo(f"   错误: {str(e)}", err=True)
            return
    else:
        click.echo("\n[3/6] 未提供坐席表，跳过坐席匹配")
    
    click.echo("\n[4/6] 执行匹配引擎")
    try:
        matcher = MatchingEngine(strict_mode=strict)
        match_results = matcher.match_all(tickets, recordings, agents)
        status_counts = {}
        for r in match_results:
            status_counts[r.match_status] = status_counts.get(r.match_status, 0) + 1
        for status, count in status_counts.items():
            click.echo(f"   {status}: {count} 条")
    except Exception as e:
        click.echo(f"   错误: {str(e)}", err=True)
        return
    
    click.echo("\n[5/6] 执行缺失归因分析")
    try:
        attribution_engine = AttributionEngine(min_duration_seconds=min_duration)
        attribution_results = attribution_engine.attribute_all(match_results)
        click.echo(f"   分析完成 {len(attribution_results)} 条结果")
    except Exception as e:
        click.echo(f"   错误: {str(e)}", err=True)
        return
    
    click.echo(f"\n[6/6] 执行抽样 (方法: {sample_method}, 数量: {sample_size})")
    try:
        sampling_engine = SamplingEngine(seed=seed, sample_size=sample_size)
        sample_results = sampling_engine.sample(
            attribution_results,
            method=sample_method,
            sample_size=sample_size
        )
        click.echo(f"   抽取到 {len(sample_results)} 条样本")
    except Exception as e:
        click.echo(f"   错误: {str(e)}", err=True)
        return
    
    click.echo("\n正在生成报告...")
    try:
        reporter = ReportGenerator(output_dir=output_dir)
        hash_values = {
            '录音扫描': scanner.scan_hash,
            '工单解析': parser.tickets_hash,
            '坐席解析': parser.agents_hash,
            '匹配结果': matcher.match_hash,
            '归因分析': attribution_engine.attribution_hash,
            '抽样结果': sampling_engine.sample_hash
        }
        report_path = reporter.generate_report(
            match_results=match_results,
            attribution_results=attribution_results,
            sample_results=sample_results,
            hash_values=hash_values,
            filename=filename
        )
        click.echo(f"\n报告已生成: {report_path}")
        
        reporter.print_console_summary(match_results, attribution_results, sample_results)
    except Exception as e:
        click.echo(f"   错误: {str(e)}", err=True)
        return
    
    click.echo("\n流程执行完成！")


@cli.command('scan')
@click.option('--recording-dir', '-r', required=True, help='录音文件目录路径')
def scan_recordings(recording_dir):
    """仅扫描录音文件目录并显示解析结果"""
    click.echo(f"扫描录音目录: {recording_dir}")
    scanner = RecordingScanner(recording_dir)
    recordings = scanner.scan()
    
    click.echo(f"\n共找到 {len(recordings)} 个录音文件:")
    for rec in recordings[:20]:
        status_icon = "✓" if rec.parsed_ticket_id else "✗"
        click.echo(f"  {status_icon} {rec.file_name}")
        click.echo(f"    工单号: {rec.parsed_ticket_id or '未解析'}")
        if rec.parsed_agent_id:
            click.echo(f"    坐席号: {rec.parsed_agent_id}")
    
    if len(recordings) > 20:
        click.echo(f"  ... 还有 {len(recordings) - 20} 个文件")


@cli.command('sample-only')
@click.option('--report-file', '-i', required=True, help='已有的排查报告文件路径')
@click.option('--sample-size', '-s', default=50, help='抽样数量')
@click.option('--seed', '-e', default=42, help='随机种子')
@click.option('--output-dir', '-o', default='./output', help='输出目录')
def sample_only(report_file, sample_size, seed, output_dir):
    """从已有报告中重新抽样"""
    click.echo("此功能需要完整的归因结果数据，建议使用完整的 run 命令")
    click.echo("或者直接从Excel的'抽样清单'工作表中手动筛选")


@cli.command('verify')
@click.option('--old-report', '-o', required=True, help='旧报告文件路径')
@click.option('--new-report', '-n', required=True, help='新报告文件路径')
def verify_reports(old_report, new_report):
    """验证两次运行结果的一致性"""
    click.echo("报告比对功能")
    click.echo(f"  旧报告: {old_report}")
    click.echo(f"  新报告: {new_report}")
    click.echo("\n提示: 请检查'数据校验追踪'工作表中的哈希值是否一致")


def main():
    cli()


if __name__ == '__main__':
    main()
