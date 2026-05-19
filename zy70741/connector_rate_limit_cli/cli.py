import click
from pathlib import Path
from typing import List

from .parser import LogParser
from .state_machine import RateLimitRuleEngine, SessionManager
from .tracker import SourceTracker, FailureCauseAnalyzer, AnalysisResult
from .reporter import ConsoleReporter, FileReporter


class RateLimitAnalyzer:
    def __init__(
        self,
        rate_limit_window: int = 60,
        min_sleep_interval: int = 0,
        max_consecutive_sleep: int = 10,
        preserve_order: bool = True,
    ):
        self.parser = LogParser()
        self.rule_engine = RateLimitRuleEngine(
            rate_limit_window=rate_limit_window,
            min_sleep_interval=min_sleep_interval,
            max_consecutive_sleep=max_consecutive_sleep,
        )
        self.session_manager = SessionManager(self.rule_engine)
        self.source_tracker = SourceTracker(preserve_order=preserve_order)
        self.failure_analyzer = FailureCauseAnalyzer()

    def analyze_files(self, file_paths: List[str]) -> AnalysisResult:
        sorted_files = sorted(file_paths)
        records = self.parser.parse_files(sorted_files)
        return self._analyze_records(records, sorted_files)

    def _analyze_records(self, records, file_paths):
        sessions = self.session_manager.process_records(records)
        traces = self.source_tracker.track_records(records)

        all_causes = []
        record_causes = self.failure_analyzer.analyze_records(records)
        all_causes.extend(record_causes)

        for session in sessions:
            session_causes = self.failure_analyzer.analyze_session(session)
            all_causes.extend(session_causes)

        all_causes.sort(key=lambda c: (-c.confidence, c.cause_type))
        causes_by_type = {}
        for cause in all_causes:
            if cause.cause_type not in causes_by_type:
                causes_by_type[cause.cause_type] = cause
        unique_causes = list(causes_by_type.values())

        result = AnalysisResult()
        result.records = records
        result.sessions = sessions
        result.traces = traces
        result.failure_causes = unique_causes
        result.metadata = {
            'input_files': sorted(file_paths),
            'rate_limit_window': self.rule_engine.rate_limit_window,
            'min_sleep_interval': self.rule_engine.min_sleep_interval,
            'max_consecutive_sleep': self.rule_engine.max_consecutive_sleep,
        }

        return result


@click.group()
def cli():
    """连接器限速休眠恢复分析工具"""
    pass


@cli.command()
@click.argument('log_files', nargs=-1, type=click.Path(exists=True))
@click.option('--rate-limit-window', '-w', default=60, type=int,
              help='限流检测时间窗口（秒），默认60')
@click.option('--min-sleep-interval', '-i', default=0, type=int,
              help='最小休眠间隔（秒），用于幂等性检测')
@click.option('--max-consecutive-sleep', '-c', default=10, type=int,
              help='最大连续休眠次数，默认10')
@click.option('--no-color', is_flag=True, help='禁用彩色输出')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def analyze(
    log_files,
    rate_limit_window,
    min_sleep_interval,
    max_consecutive_sleep,
    no_color,
    verbose,
):
    """分析日志文件中的限速休眠恢复问题"""
    if not log_files:
        click.echo("错误: 请指定至少一个日志文件")
        return

    click.echo(f"正在分析 {len(log_files)} 个文件...")

    analyzer = RateLimitAnalyzer(
        rate_limit_window=rate_limit_window,
        min_sleep_interval=min_sleep_interval,
        max_consecutive_sleep=max_consecutive_sleep,
        preserve_order=True,
    )

    result = analyzer.analyze_files(list(log_files))

    reporter = ConsoleReporter(use_colors=not no_color)
    if verbose:
        reporter.print_full_report(result)
    else:
        reporter.print_summary(result)
        reporter.print_failure_causes(result)

    if result.failure_causes:
        click.get_current_context().exit(1)


@cli.command()
@click.argument('log_files', nargs=-1, type=click.Path(exists=True))
@click.option('--output-dir', '-o', default='.', type=click.Path(),
              help='输出目录，默认当前目录')
@click.option('--format', '-f', 'output_format',
              type=click.Choice(['json', 'csv', 'excel', 'all']),
              default='all',
              help='输出格式，默认全部格式')
@click.option('--rate-limit-window', '-w', default=60, type=int,
              help='限流检测时间窗口（秒），默认60')
@click.option('--min-sleep-interval', '-i', default=0, type=int,
              help='最小休眠间隔（秒），用于幂等性检测')
@click.option('--max-consecutive-sleep', '-c', default=10, type=int,
              help='最大连续休眠次数，默认10')
def export(
    log_files,
    output_dir,
    output_format,
    rate_limit_window,
    min_sleep_interval,
    max_consecutive_sleep,
):
    """导出分析结果到文件"""
    if not log_files:
        click.echo("错误: 请指定至少一个日志文件")
        return

    click.echo(f"正在分析 {len(log_files)} 个文件...")

    analyzer = RateLimitAnalyzer(
        rate_limit_window=rate_limit_window,
        min_sleep_interval=min_sleep_interval,
        max_consecutive_sleep=max_consecutive_sleep,
        preserve_order=True,
    )

    result = analyzer.analyze_files(list(log_files))

    reporter = FileReporter(output_dir=output_dir)

    if output_format == 'json':
        path = reporter.export_json(result)
        click.echo(f"已导出 JSON: {path}")
    elif output_format == 'csv':
        files = reporter.export_csv(result)
        for name, path in files.items():
            click.echo(f"已导出 CSV ({name}): {path}")
    elif output_format == 'excel':
        try:
            path = reporter.export_excel(result)
            click.echo(f"已导出 Excel: {path}")
        except ImportError as e:
            click.echo(f"错误: {e}")
    else:
        outputs = reporter.export_all(result)
        click.echo("\n已导出文件:")
        click.echo(f"  JSON: {outputs['json']}")
        for name, path in outputs['csv'].items():
            click.echo(f"  CSV ({name}): {path}")
        if 'excel' in outputs:
            click.echo(f"  Excel: {outputs['excel']}")


@cli.command()
@click.argument('log_files', nargs=-1, type=click.Path(exists=True))
def badlines(log_files):
    """仅显示坏行记录"""
    if not log_files:
        click.echo("错误: 请指定至少一个日志文件")
        return

    parser = LogParser()
    records = parser.parse_files(list(log_files))
    bad_records = [r for r in records if r.is_bad_line]

    if not bad_records:
        click.echo("未检测到坏行")
        return

    click.echo(f"检测到 {len(bad_records)} 条坏行:\n")
    for record in bad_records:
        click.echo(f"文件: {record.file_path}")
        click.echo(f"行号: {record.line_number}")
        click.echo(f"内容: {record.raw_content}")
        click.echo("-" * 60)


@cli.command()
def version():
    """显示版本信息"""
    from . import __version__
    click.echo(f"连接器限速休眠恢复分析工具 v{__version__}")


def main():
    cli()


if __name__ == '__main__':
    main()
