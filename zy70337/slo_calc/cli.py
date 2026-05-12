import sys
from pathlib import Path
import click
from typing import List, Optional

from .config import load_config, SLOConfig
from .log_parser import LogParser
from .calculator import SLOCalculator, SLOResult
from .reporter import ReportGenerator


@click.group()
@click.version_option()
def main():
    """本地 SLO 计算 CLI - 从访问日志计算服务质量指标"""
    pass


def _load_config(config_path: Path) -> SLOConfig:
    try:
        return load_config(config_path)
    except Exception as e:
        click.echo(f"❌ 加载配置失败: {e}", err=True)
        sys.exit(1)


def _parse_logs(config: SLOConfig, log_files: List[Path],
                exclude_health_checks: bool, remove_duplicates: bool):
    parser = LogParser(config)
    try:
        return parser.parse_files(
            log_files,
            exclude_health_checks=exclude_health_checks,
            remove_duplicates=remove_duplicates,
            sort_by_time=True
        )
    except Exception as e:
        click.echo(f"❌ 解析日志失败: {e}", err=True)
        sys.exit(1)


@main.command()
@click.option('--config', '-c', required=True, type=click.Path(exists=True, path_type=Path),
              help='SLO 配置文件路径')
@click.option('--logs', '-l', multiple=True, type=click.Path(exists=True, path_type=Path),
              help='日志文件路径(可多个)')
@click.option('--log-dir', type=click.Path(exists=True, path_type=Path),
              help='日志目录(会扫描所有 .log 文件)')
@click.option('--exclude-health/--include-health', default=True,
              help='是否排除健康检查请求(默认排除)')
@click.option('--remove-duplicates/--keep-duplicates', default=True,
              help='是否移除重复日志行(默认移除)')
@click.option('--window-days', type=int, default=None,
              help='计算窗口天数(覆盖配置)')
@click.option('--view', '-v', type=click.Choice(['management', 'technical', 'both']),
              default='both', help='报告视角(管理/技术/全部)')
def calc(config: Path, logs: List[Path], log_dir: Optional[Path],
         exclude_health: bool, remove_duplicates: bool,
         window_days: Optional[int], view: str):
    """计算 SLO 指标并生成报告"""
    cfg = _load_config(config)

    all_logs = list(logs)
    if log_dir:
        all_logs.extend(log_dir.glob('*.log'))
        all_logs.extend(log_dir.glob('*.log.*'))

    if not all_logs:
        click.echo("❌ 未提供任何日志文件", err=True)
        sys.exit(1)

    click.echo(f"📂 正在解析 {len(all_logs)} 个日志文件...")
    entries, stats = _parse_logs(cfg, all_logs, exclude_health, remove_duplicates)
    click.echo(f"  解析完成: {stats.parsed_lines} 条有效记录")

    click.echo("🔢 正在计算 SLO 指标...")
    calculator = SLOCalculator(cfg)
    result = calculator.calculate(entries, stats, window_days)

    reporter = ReportGenerator(cfg)
    report = reporter.format_console_report(result, view)
    click.echo("")
    click.echo(report)


@main.command()
@click.option('--config', '-c', required=True, type=click.Path(exists=True, path_type=Path),
              help='SLO 配置文件路径')
def validate(config: Path):
    """验证 SLO 配置文件"""
    click.echo(f"📋 验证配置文件: {config}")
    cfg = _load_config(config)

    errors = cfg.validate()
    if errors:
        click.echo("❌ 配置验证失败:")
        for err in errors:
            click.echo(f"  - {err}")
        sys.exit(1)

    click.echo("✅ 配置验证通过")
    click.echo(f"   - {len(cfg.rules)} 个 SLO 规则")
    click.echo(f"   - {len(cfg.endpoint_groups)} 个接口分组")
    click.echo("")
    click.echo("SLO 规则列表:")
    for rule in cfg.rules:
        status = "✅" if rule.target else "⚠️"
        click.echo(f"  {status} {rule.name} ({rule.type}) - 目标: {rule.target}{rule.unit}")


@main.command()
@click.option('--config', '-c', required=True, type=click.Path(exists=True, path_type=Path),
              help='SLO 配置文件路径')
@click.option('--rule', '-r', required=True, help='要解释的 SLO 规则名称')
@click.option('--logs', '-l', multiple=True, type=click.Path(exists=True, path_type=Path),
              help='日志文件路径(可多个)')
@click.option('--log-dir', type=click.Path(exists=True, path_type=Path),
              help='日志目录')
@click.option('--exclude-health/--include-health', default=True)
@click.option('--remove-duplicates/--keep-duplicates', default=True)
def explain(config: Path, rule: str, logs: List[Path], log_dir: Optional[Path],
            exclude_health: bool, remove_duplicates: bool):
    """解释某个接口为什么违反 SLO"""
    cfg = _load_config(config)

    all_logs = list(logs)
    if log_dir:
        all_logs.extend(log_dir.glob('*.log'))
        all_logs.extend(log_dir.glob('*.log.*'))

    entries, stats = _parse_logs(cfg, all_logs, exclude_health, remove_duplicates)

    calculator = SLOCalculator(cfg)
    result = calculator.calculate(entries, stats)

    explanation = calculator.explain_violation(rule, result)

    reporter = ReportGenerator(cfg)
    click.echo(reporter.format_explain_report(explanation))


@main.command()
@click.option('--config', '-c', required=True, type=click.Path(exists=True, path_type=Path),
              help='SLO 配置文件路径')
@click.option('--logs1', '-1', multiple=True, type=click.Path(exists=True, path_type=Path),
              help='第一时段的日志文件')
@click.option('--logs2', '-2', multiple=True, type=click.Path(exists=True, path_type=Path),
              help='第二时段的日志文件')
@click.option('--dir1', type=click.Path(exists=True, path_type=Path), help='第一时段日志目录')
@click.option('--dir2', type=click.Path(exists=True, path_type=Path), help='第二时段日志目录')
@click.option('--exclude-health/--include-health', default=True)
@click.option('--remove-duplicates/--keep-duplicates', default=True)
def compare(config: Path, logs1, logs2, dir1, dir2,
            exclude_health: bool, remove_duplicates: bool):
    """比较两个时段的 SLO 指标变化"""
    cfg = _load_config(config)

    all_logs1 = list(logs1)
    if dir1:
        all_logs1.extend(dir1.glob('*.log'))
        all_logs1.extend(dir1.glob('*.log.*'))

    all_logs2 = list(logs2)
    if dir2:
        all_logs2.extend(dir2.glob('*.log'))
        all_logs2.extend(dir2.glob('*.log.*'))

    if not all_logs1 or not all_logs2:
        click.echo("❌ 两个时段都需要提供日志", err=True)
        sys.exit(1)

    click.echo("📊 正在计算两个时段的 SLO...")
    parser = LogParser(cfg)

    entries1, stats1 = parser.parse_files(all_logs1,
                                           exclude_health_checks=exclude_health,
                                           remove_duplicates=remove_duplicates)

    entries2, stats2 = parser.parse_files(all_logs2,
                                           exclude_health_checks=exclude_health,
                                           remove_duplicates=remove_duplicates)

    calculator = SLOCalculator(cfg)
    result1 = calculator.calculate(entries1, stats1)
    result2 = calculator.calculate(entries2, stats2)

    comparison = calculator.compare_results(result1, result2)

    reporter = ReportGenerator(cfg)
    click.echo(reporter.format_comparison_report(comparison))


@main.command()
@click.option('--config', '-c', required=True, type=click.Path(exists=True, path_type=Path))
@click.option('--logs', '-l', multiple=True, type=click.Path(exists=True, path_type=Path))
@click.option('--log-dir', type=click.Path(exists=True, path_type=Path))
@click.option('--format', '-f', 'fmt', type=click.Choice(['json', 'csv']), default='json',
              help='导出格式(json/csv)')
@click.option('--output', '-o', type=click.Path(path_type=Path), default=None,
              help='输出文件路径')
@click.option('--exclude-health/--include-health', default=True)
@click.option('--remove-duplicates/--keep-duplicates', default=True)
def export(config: Path, logs: List[Path], log_dir: Optional[Path],
           fmt: str, output: Optional[Path],
           exclude_health: bool, remove_duplicates: bool):
    """导出 SLO 计算结果"""
    cfg = _load_config(config)

    all_logs = list(logs)
    if log_dir:
        all_logs.extend(log_dir.glob('*.log'))
        all_logs.extend(log_dir.glob('*.log.*'))

    entries, stats = _parse_logs(cfg, all_logs, exclude_health, remove_duplicates)

    calculator = SLOCalculator(cfg)
    result = calculator.calculate(entries, stats)

    reporter = ReportGenerator(cfg)

    if fmt == 'json':
        content = reporter.export_json(result)
    else:
        content = reporter.export_csv(result)

    if output:
        output.write_text(content, encoding='utf-8')
        click.echo(f"✅ 已导出到: {output}")
    else:
        click.echo(content)


if __name__ == '__main__':
    main()
